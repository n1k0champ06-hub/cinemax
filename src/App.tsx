/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, lazy, Suspense } from "react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import * as idb from 'idb-keyval';
import { motion, AnimatePresence } from "motion/react";
import { NavBar } from "./components/layout/NavBar";
import { Footer } from "./components/layout/Footer";
import { Hero } from "./components/Hero";
import {
  MovieRow,
  ContinueWatchingRow,
  MyListRow,
} from "./components/movie/MovieRows";
import { ImdbRow } from "./components/movie/ImdbRow";
import { tmdbGetTrending } from "./api/tmdbApi";
import { initFetchInterceptor, godModeStore } from "./lib/godmode";
import "./lib/firebase";

// Lazy-load heavy page components — only parsed when user navigates there
const importMovieDetail = () => import("./components/movie/MovieDetail");
const importSearchPage = () => import("./components/pages/SearchPage");
const importListingPage = () => import("./components/pages/ListingPage");
const importDiscoverPage = () => import("./components/pages/DiscoverPage");
const importSwipePage = () => import("./components/pages/SwipePage");
const importFootballPage = () => import("./components/pages/FootballPage");
const importMusicPage = () => import("./components/pages/MusicPage");

const MovieDetail = lazy(() => importMovieDetail().then(m => ({ default: m.MovieDetail })));
const SearchPage = lazy(() => importSearchPage().then(m => ({ default: m.SearchPage })));
const ListingPage = lazy(() => importListingPage().then(m => ({ default: m.ListingPage })));
const DiscoverPage = lazy(() => importDiscoverPage().then(m => ({ default: m.DiscoverPage })));
const SwipePage = lazy(() => importSwipePage().then(m => ({ default: m.SwipePage })));
const FootballPage = lazy(() => importFootballPage().then(m => ({ default: m.FootballPage })));
const MusicPage = lazy(() => importMusicPage().then(m => ({ default: m.MusicPage })));
const UserGuideModal = lazy(() => import("./components/layout/UserGuideModal").then(m => ({ default: m.UserGuideModal })));
const ReportNotification = lazy(() => import("./components/layout/ReportNotification").then(m => ({ default: m.ReportNotification })));
const GodModeConsole = lazy(() => import("./components/debug/GodModeConsole").then(m => ({ default: m.GodModeConsole })));
const MobileSimulator = lazy(() => import("./components/debug/MobileSimulator").then(m => ({ default: m.MobileSimulator })));
const ScraperDashboard = lazy(() => import("./components/admin/ScraperDashboard"));
const PWAInstallModal = lazy(() => import("./components/layout/PWAInstallModal").then(m => ({ default: m.PWAInstallModal })));

// Preload primary page bundles during browser idle time so tab clicks respond instantly
if (typeof window !== 'undefined') {
  const preloadAllPages = () => {
    importListingPage();
    importDiscoverPage();
    importSwipePage();
    importFootballPage();
    importMusicPage();
  };
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(preloadAllPages, { timeout: 3000 });
  } else {
    setTimeout(preloadAllPages, 1500);
  }
}

// Minimal fallback for Suspense — invisible, no layout shift
const SuspenseFallback = () => null;


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 24 * 60 * 60 * 1000, // Cache query results for 24 hours by default
      retry: 2,
      refetchOnWindowFocus: false,
      gcTime: 7 * 24 * 60 * 60 * 1000, // Retain cache for 7 days
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => idb.get(key),
    setItem: (key, value) => idb.set(key, value),
    removeItem: (key) => idb.del(key),
  },
});

export default function App() {
  const [currentTab, setCurrentTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const initialTab = params.get("tab");
    if (initialTab) {
      if (initialTab === "swipe" && typeof window !== "undefined" && window.innerWidth >= 768) {
        return "home";
      }
      return initialTab;
    }
    return "home";
  });

  // Redirect swipe page to home on PC/Desktop
  useEffect(() => {
    // Prefetch primary Hero trending movies during initial launch screen loading
    queryClient.prefetchQuery({
      queryKey: ['tmdb', 'hero-trending', 'home'],
      queryFn: async () => {
        const res = await tmdbGetTrending('all', 'day');
        return {
          results: (res?.results || []).map((v: any) => ({
            ...v,
            media_type: v.media_type || (v.first_air_date ? 'tv' : 'movie')
          }))
        };
      },
      staleTime: 24 * 60 * 60 * 1000,
    });

    const checkDesktopSwipe = () => {
      if (currentTab === "swipe" && window.innerWidth >= 768) {
        setCurrentTab("home");
      }
    };
    checkDesktopSwipe();
    window.addEventListener("resize", checkDesktopSwipe);
    return () => window.removeEventListener("resize", checkDesktopSwipe);
  }, [currentTab]);

  const [selectedMovieSlug, setSelectedMovieSlugState] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("movie");
  });

  const [showSearch, setShowSearch] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("search") === "true";
  });

  const [showUserGuide, setShowUserGuide] = useState(false);

  const [notification, setNotification] = useState<{ message: string } | null>(null);

  useEffect(() => {
    (window as any).showCinemaxAlert = (message: string) => {
      setNotification({ message });
    };
    return () => {
      delete (window as any).showCinemaxAlert;
    };
  }, []);

  // Initialize Cinemax God-Mode Console Telemetry & Triggers
  useEffect(() => {
    initFetchInterceptor();

    // URL Query Bypass trigger
    const params = new URLSearchParams(window.location.search);
    if (params.get("godmode") === "activated") {
      godModeStore.setIsOpen(true);
      godModeStore.addLog('SYSTEM', 'INFO', 'God-Mode Auto-Activated via URL query parameter (?godmode=activated).');
    }

    // Secret Key Sequence Trigger (C - I - N - E within 2 seconds)
    let keyHistory: { key: string; time: number }[] = [];
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key events in inputs, textareas, etc. to prevent interference when typing
      const activeEl = document.activeElement;
      if (activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.hasAttribute('contenteditable')
      )) {
        return;
      }

      const key = e.key.toLowerCase();
      if (!['c', 'i', 'n', 'e'].includes(key)) return;
      
      const now = Date.now();
      keyHistory.push({ key, time: now });
      
      // Clean history older than 2s
      keyHistory = keyHistory.filter(item => now - item.time <= 2000);
      
      if (keyHistory.length >= 4) {
        const last4 = keyHistory.slice(-4).map(item => item.key).join('');
        if (last4 === 'cine') {
          const newState = !godModeStore.getIsOpen();
          godModeStore.setIsOpen(newState);
          godModeStore.addLog('SYSTEM', 'INFO', `God-Mode ${newState ? 'Activated' : 'Deactivated'} via Secret Key Sequence.`);
          keyHistory = [];
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSetTab = (tab: string) => {
    setCurrentTab(tab);
    setSelectedMovieSlugState(null);
    setShowSearch(false);
    window.scrollTo(0, 0);
  };

  const setSelectedMovieSlug = (slug: string | null, autoPlay = false) => {
    console.log('[APP] setSelectedMovieSlug called with:', slug);
    if (slug) {
      setSelectedMovieSlugState(slug);
      window.scrollTo({ top: 0, behavior: 'instant' });
      if (autoPlay) {
        const params = new URLSearchParams(window.location.search);
        params.set("play", "true");
        const newUrl = params.toString() ? `/?${params.toString()}` : "/";
        window.history.replaceState({}, "", newUrl);
      }
    } else {
      setSelectedMovieSlugState(null);
    }
  };

  // Sync state changes to URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (currentTab && currentTab !== "home") {
      params.set("tab", currentTab);
    } else {
      params.delete("tab");
    }
    if (selectedMovieSlug) {
      params.set("movie", selectedMovieSlug);
    } else {
      params.delete("movie");
      params.delete("play");
      params.delete("ep");
      params.delete("season");
    }
    if (showSearch) {
      params.set("search", "true");
    } else {
      params.delete("search");
      params.delete("q");
    }

    if (currentTab !== "discover") {
      params.delete("media");
      params.delete("sort");
      params.delete("genre");
      params.delete("year");
      params.delete("rating");
    }
    if (currentTab === "home" || currentTab === "discover") {
      params.delete("filterType");
      params.delete("subgenre");
    }

    const queryString = params.toString();
    const newUrl = queryString ? `/?${queryString}` : "/";

    if (window.location.search !== (queryString ? `?${queryString}` : "")) {
      window.history.pushState({}, "", newUrl);
    }
  }, [currentTab, selectedMovieSlug, showSearch]);

  // Handle browser back / forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab") || "home";
      const movie = params.get("movie");
      const search = params.get("search") === "true";

      setCurrentTab(tab);
      setSelectedMovieSlugState(movie);
      setShowSearch(search);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const handleScrollDown = () => {
    const el = document.getElementById("movie-lists");
    if (el) {
      const targetY = el.getBoundingClientRect().top + window.scrollY - 80;
      const startY = window.scrollY;
      const difference = targetY - startY;
      const duration = 800; // ms
      let startTime: number | null = null;
      const step = (time: number) => {
        if (!startTime) startTime = time;
        const progress = Math.min((time - startTime) / duration, 1);
        const ease = 0.5 - Math.cos(progress * Math.PI) / 2;
        window.scrollTo(0, startY + difference * ease);
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  };

  useEffect(() => {
    // Inject keyframes globally
    if (!document.getElementById("cinemax-styles")) {
      const style = document.createElement("style");
      style.id = "cinemax-styles";
      style.innerHTML = `
        @keyframes shimmer { 100% { transform: translateX(100%); } }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); }
        
        .card-spring-hover {
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), z-index 0.35s step-end, box-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 10;
        }
        /* Desktop hover: promote to GPU only when actively hovering */
        @media (hover: hover) and (pointer: fine) {
          .card-spring-hover:hover {
            will-change: transform;
            transform: scale(1.08) translateY(-8px);
            z-index: 40;
            transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), z-index 0s, box-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .card-spring-hover:not(:hover) {
            will-change: auto;
          }
        }
      `;

      // Inject simulated touch pointer cursor (finger pointer emulation) when running inside iframe
      if (window.self !== window.top) {
        style.innerHTML += `
          * {
            cursor: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI5IiBmaWxsPSJyZ2JhKDEyOCwxMjgsMTI4LDAuNCkiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjYpIiBzdHJva2Utd2lkdGg9IjEuNSIvPjwvc3ZnPg==') 12 12, auto !important;
          }
        `;
      }

      document.head.appendChild(style);
    }
  }, []);

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <Suspense fallback={<SuspenseFallback />}>
      <div className="min-h-screen bg-[#050505] text-white selection:bg-red-600/30 selection:text-white font-sans overflow-x-hidden relative">
        {currentTab !== "scraper" && currentTab !== "admin" && (
          <NavBar
            currentTab={currentTab}
            setTab={handleSetTab}
            onShowSearch={() => setShowSearch(true)}
            onShowGuide={() => setShowUserGuide(true)}
          />
        )}

        <AnimatePresence mode="wait">
          {currentTab === "home" ? (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeInOut" }}
            >
              <Hero
                type="home"
                onSelect={setSelectedMovieSlug}
                setTab={handleSetTab}
                onShowSearch={() => setShowSearch(true)}
                onScrollDown={handleScrollDown}
              />
              <div
                id="movie-lists"
                className="pb-32 mt-4 sm:mt-12 relative z-20 flex flex-col gap-0"
              >
                <ContinueWatchingRow onSelect={setSelectedMovieSlug} />
                <MyListRow onSelect={setSelectedMovieSlug} />
                <div className="lazy-row-section"><ImdbRow title="Xu Hướng Tuần Này" type="popular-movies" onSelect={setSelectedMovieSlug} /></div>
                <div className="lazy-row-section"><ImdbRow title="Top Phim Thế Giới" type="top250-movies" onSelect={setSelectedMovieSlug} /></div>
                <div className="lazy-row-section"><ImdbRow title="Phim Bộ Phổ Biến Nhất" type="popular-tv" onSelect={setSelectedMovieSlug} /></div>
                <div className="lazy-row-section"><MovieRow title="Hành Động Kịch Tính" type="the-loai/hanh-dong" onSelect={setSelectedMovieSlug} /></div>
                <div className="lazy-row-section"><MovieRow title="Kinh Dị & Giật Gân" type="the-loai/kinh-di" onSelect={setSelectedMovieSlug} /></div>
                <div className="lazy-row-section"><MovieRow title="Hài Hước Đặc Sắc" type="the-loai/hai-huoc" onSelect={setSelectedMovieSlug} /></div>
                <div className="lazy-row-section"><MovieRow title="Tình Cảm Lãng Mạn" type="the-loai/tinh-cam" onSelect={setSelectedMovieSlug} /></div>
                <div className="lazy-row-section"><MovieRow title="Cực Phẩm Điện Ảnh Hàn" type="quoc-gia/han-quoc" onSelect={setSelectedMovieSlug} /></div>
                <div className="lazy-row-section"><MovieRow title="Viễn Tưởng & Phiêu Lưu" type="the-loai/vien-tuong" onSelect={setSelectedMovieSlug} /></div>
                <div className="lazy-row-section"><MovieRow title="Điện Ảnh Hoa Ngữ" type="quoc-gia/trung-quoc" onSelect={setSelectedMovieSlug} /></div>
                <div className="lazy-row-section"><MovieRow title="Thế Giới Hoạt Hình" type="hoat-hinh" onSelect={setSelectedMovieSlug} /></div>
                <div className="lazy-row-section"><MovieRow title="Chiến Tranh & Lịch Sử" type="the-loai/chien-tranh" onSelect={setSelectedMovieSlug} /></div>
              </div>
            </motion.div>
          ) : currentTab === "phim-bo" ? (
            <motion.div
              key="phim-bo"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeInOut" }}
            >
              <Hero
                type="phim-bo"
                onSelect={setSelectedMovieSlug}
                setTab={handleSetTab}
                onShowSearch={() => setShowSearch(true)}
                onScrollDown={handleScrollDown}
              />
              <div
                id="movie-lists"
                className="pb-32 mt-4 sm:mt-12 relative z-20 flex flex-col gap-0"
              >
                <ImdbRow title="Phim Bộ Phổ Biến Nhất" type="popular-tv" onSelect={setSelectedMovieSlug} />
                <MovieRow
                  title="Phim Bộ Hàn Quốc"
                  type="quoc-gia/han-quoc"
                  onSelect={setSelectedMovieSlug}
                />
                <MovieRow
                  title="Tỷ Tỷ Cổ Trang"
                  type="the-loai/co-trang"
                  onSelect={setSelectedMovieSlug}
                />
                <MovieRow
                  title="Hành Động & Kịch Tính"
                  type="the-loai/hanh-dong"
                  onSelect={setSelectedMovieSlug}
                />
                <MovieRow
                  title="Viễn Tưởng Siêu Nhiên"
                  type="the-loai/vien-tuong"
                  onSelect={setSelectedMovieSlug}
                />
                <MovieRow
                  title="Trinh Thám & Hình Sự"
                  type="the-loai/hinh-su"
                  onSelect={setSelectedMovieSlug}
                />
              </div>
            </motion.div>
          ) : currentTab === "phim-le" ? (
            <motion.div
              key="phim-le"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeInOut" }}
            >
              <Hero
                type="phim-le"
                onSelect={setSelectedMovieSlug}
                setTab={handleSetTab}
                onShowSearch={() => setShowSearch(true)}
                onScrollDown={handleScrollDown}
              />
              <div
                id="movie-lists"
                className="pb-32 mt-4 sm:mt-12 relative z-20 flex flex-col gap-0"
              >
                <ImdbRow title="Phim Lẻ Đang Thịnh Hành" type="popular-movies" onSelect={setSelectedMovieSlug} />
                <ImdbRow title="Siêu Phẩm Điện Ảnh (IMDb)" type="top250-movies" onSelect={setSelectedMovieSlug} />
                <MovieRow
                  title="Điện Ảnh Hành Động"
                  type="the-loai/hanh-dong"
                  onSelect={setSelectedMovieSlug}
                />
                <MovieRow
                  title="Kinh Dị Đêm Khuya"
                  type="the-loai/kinh-di"
                  onSelect={setSelectedMovieSlug}
                />
                <MovieRow
                  title="Hài Hước Đặc Sắc"
                  type="the-loai/hai-huoc"
                  onSelect={setSelectedMovieSlug}
                />
                <MovieRow
                  title="Tình Cảm Lãng Mạn"
                  type="the-loai/tinh-cam"
                  onSelect={setSelectedMovieSlug}
                />
                <MovieRow
                  title="Viễn Tưởng Kỳ Vĩ"
                  type="the-loai/vien-tuong"
                  onSelect={setSelectedMovieSlug}
                />
              </div>
            </motion.div>
          ) : currentTab === "hoat-hinh" ? (
            <motion.div
              key="hoat-hinh"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeInOut" }}
            >
              <Hero
                type="hoat-hinh"
                onSelect={setSelectedMovieSlug}
                setTab={handleSetTab}
                onShowSearch={() => setShowSearch(true)}
                onScrollDown={handleScrollDown}
              />
              <div
                id="movie-lists"
                className="pb-32 mt-4 sm:mt-12 relative z-20 flex flex-col gap-0"
              >
                <div className="lazy-row-section">
                  <MovieRow
                    title="Anime Mới Cập Nhật"
                    type="hoat-hinh-nhat"
                    onSelect={setSelectedMovieSlug}
                    aspectRatio="landscape"
                    isAnime
                  />
                </div>
                <div className="lazy-row-section">
                  <MovieRow
                    title="Anime Phổ Biến Nhất"
                    type="anime-popular"
                    onSelect={setSelectedMovieSlug}
                    aspectRatio="landscape"
                    isAnime
                  />
                </div>
                <div className="lazy-row-section">
                  <MovieRow
                    title="Hành Động & Kịch Tính"
                    type="anime-action"
                    onSelect={setSelectedMovieSlug}
                    aspectRatio="landscape"
                    isAnime
                  />
                </div>
                <div className="lazy-row-section">
                  <MovieRow
                    title="Phiêu Lưu & Kỳ Ảo"
                    type="anime-fantasy"
                    onSelect={setSelectedMovieSlug}
                    aspectRatio="landscape"
                    isAnime
                  />
                </div>
                <div className="lazy-row-section">
                  <MovieRow
                    title="Tình Cảm & Học Đường"
                    type="anime-romance"
                    onSelect={setSelectedMovieSlug}
                    aspectRatio="landscape"
                    isAnime
                  />
                </div>
                <div className="lazy-row-section">
                  <MovieRow
                    title="Hài Hước & Đời Thường"
                    type="anime-comedy"
                    onSelect={setSelectedMovieSlug}
                    aspectRatio="landscape"
                    isAnime
                  />
                </div>
                <div className="lazy-row-section">
                  <MovieRow
                    title="Tuổi Thơ & Gia Đình"
                    type="anime-kids"
                    onSelect={setSelectedMovieSlug}
                    aspectRatio="landscape"
                    isAnime
                  />
                </div>
              </div>
            </motion.div>

          ) : currentTab === "football" ? (
            <motion.div
              key="football"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeInOut" }}
            >
              <FootballPage />
            </motion.div>
          ) : currentTab === "music" ? (
            <motion.div
              key="music"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeInOut" }}
            >
              <MusicPage />
            </motion.div>
          ) : currentTab === "discover" ? (
            <motion.div
              key="discover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeInOut" }}
              className="pt-6 md:pt-24 pb-24 md:pb-20 min-h-screen"
            >
              <DiscoverPage
                onSelect={setSelectedMovieSlug}
                setTab={handleSetTab}
              />
            </motion.div>
          ) : currentTab === "swipe" ? (
            <motion.div
              key="swipe"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeInOut" }}
            >
              <SwipePage
                onSelect={setSelectedMovieSlug}
                setTab={handleSetTab}
              />
            </motion.div>
          ) : currentTab === "scraper" || currentTab === "admin" ? (
            <motion.div
              key="scraper"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="min-h-screen"
            >
              <ScraperDashboard />
            </motion.div>
          ) : (
            <motion.div
              key={currentTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeInOut" }}
              className="pt-6 md:pt-24 pb-24 md:pb-20 min-h-screen"
            >
              <ListingPage
                currentTab={currentTab}
                setTab={handleSetTab}
                onSelect={setSelectedMovieSlug}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showSearch && (
            <SearchPage
              key="search-page"
              onClose={() => setShowSearch(false)}
              onSelect={setSelectedMovieSlug}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showUserGuide && (
            <UserGuideModal
              key="user-guide-modal"
              onClose={() => setShowUserGuide(false)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {selectedMovieSlug && (
            <motion.div
              key={selectedMovieSlug}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              <MovieDetail
                slug={selectedMovieSlug}
                onClose={() => setSelectedMovieSlug(null)}
                onSelect={setSelectedMovieSlug}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[999] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-[#0c0c0c] border border-white/10 rounded-2xl p-6 max-w-sm w-full text-center relative shadow-2xl"
              >
                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10 text-yellow-500 font-bold text-xl">
                  !
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Thông báo</h3>
                <p className="text-gray-400 text-xs leading-relaxed mb-6">
                  {notification.message}
                </p>
                <button
                  onClick={() => setNotification(null)}
                  className="bg-[#E50914] hover:bg-[#ff2e35] text-white font-bold w-full py-2.5 rounded-xl transition-colors text-xs uppercase tracking-wider cursor-pointer"
                >
                  Đóng
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <Footer />
        <GodModeConsole />
        <MobileSimulator />
        <ReportNotification />
        <PWAInstallModal />
      </div>
      </Suspense>
    </PersistQueryClientProvider>
  );
}
