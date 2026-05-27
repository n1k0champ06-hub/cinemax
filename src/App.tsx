/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { NavBar } from "./components/layout/NavBar";
import { Footer } from "./components/layout/Footer";
import { Hero } from "./components/Hero";
import {
  MovieRow,
  ContinueWatchingRow,
  MyListRow,
} from "./components/movie/MovieRows";
import { AnimeRankingRow } from "./components/movie/AnimeRankingRow";
import { MovieDetail } from "./components/movie/MovieDetail";
import { SearchPage } from "./components/pages/SearchPage";
import { ListingPage } from "./components/pages/ListingPage";
import { DiscoverPage } from "./components/pages/DiscoverPage";
import "./lib/firebase";

import { ExternalResolverModal } from "./components/movie/ExternalResolverModal";
import { ImdbRow } from "./components/movie/ImdbRow";
import { getResolvedSlug } from "./utils/movieMatcher";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  const [currentTab, setCurrentTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") || "home";
  });

  const [selectedMovieSlug, setSelectedMovieSlugState] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const movieParam = params.get("movie");
    if (movieParam) {
      const resolved = getResolvedSlug(movieParam);
      return resolved || movieParam;
    }
    return null;
  });

  const [showSearch, setShowSearch] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("search") === "true";
  });

  const handleSetTab = (tab: string) => {
    setCurrentTab(tab);
    setSelectedMovieSlugState(null);
    setShowSearch(false);
    window.scrollTo(0, 0);
  };

  const setSelectedMovieSlug = (slug: string | null) => {
    if (slug) {
      const resolved = getResolvedSlug(slug);
      setSelectedMovieSlugState(resolved || slug);
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
      `;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-[#050505] text-white selection:bg-red-600/30 selection:text-white font-sans overflow-x-hidden relative">
        <NavBar
          currentTab={currentTab}
          setTab={handleSetTab}
          onShowSearch={() => setShowSearch(true)}
        />

        <AnimatePresence mode="wait">
          {currentTab === "home" ? (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
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
                <ImdbRow title="Xu Hướng Tuần Này" type="popular-movies" onSelect={setSelectedMovieSlug} />
                <ImdbRow title="Top Phim Thế Giới" type="top250-movies" onSelect={setSelectedMovieSlug} />
                <ImdbRow title="Phim Bộ Phổ Biến Nhất" type="popular-tv" onSelect={setSelectedMovieSlug} />
                <AnimeRankingRow onSelect={setSelectedMovieSlug} />
                <MovieRow
                  title="Hành Động Kịch Tính"
                  type="the-loai/hanh-dong"
                  onSelect={setSelectedMovieSlug}
                />
                <MovieRow
                  title="Kinh Dị & Giật Gân"
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
                  title="Cực Phẩm Điện Ảnh Hàn"
                  type="quoc-gia/han-quoc"
                  onSelect={setSelectedMovieSlug}
                />
                <MovieRow
                  title="Viễn Tưởng & Phiêu Lưu"
                  type="the-loai/vien-tuong"
                  onSelect={setSelectedMovieSlug}
                />
                <MovieRow
                  title="Điện Ảnh Hoa Ngữ"
                  type="quoc-gia/trung-quoc"
                  onSelect={setSelectedMovieSlug}
                />
                <MovieRow
                  title="Thế Giới Hoạt Hình"
                  type="hoat-hinh"
                  onSelect={setSelectedMovieSlug}
                />
                <MovieRow
                  title="Chiến Tranh & Lịch Sử"
                  type="the-loai/chien-tranh"
                  onSelect={setSelectedMovieSlug}
                />
              </div>
            </motion.div>
          ) : currentTab === "phim-bo" ? (
            <motion.div
              key="phim-bo"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
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
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
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
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
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
                <AnimeRankingRow onSelect={setSelectedMovieSlug} />
                <MovieRow
                  title="Anime Thịnh Hành"
                  type="anime-popular"
                  onSelect={setSelectedMovieSlug}
                />
                <MovieRow
                  title="Anime Hành Động"
                  type="anime-action"
                  onSelect={setSelectedMovieSlug}
                />
                <MovieRow
                  title="Phiêu Lưu & Kỳ Ảo"
                  type="anime-fantasy"
                  onSelect={setSelectedMovieSlug}
                />
                <MovieRow
                  title="Lãng Mạn & Học Đường"
                  type="anime-romance"
                  onSelect={setSelectedMovieSlug}
                />
                <MovieRow
                  title="Hài Hước & Đời Thường"
                  type="anime-comedy"
                  onSelect={setSelectedMovieSlug}
                />
              </div>
            </motion.div>
          ) : currentTab === "discover" ? (
            <motion.div
              key="discover"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="pt-6 md:pt-24 pb-24 md:pb-20 min-h-screen"
            >
              <DiscoverPage
                onSelect={setSelectedMovieSlug}
                setTab={handleSetTab}
              />
            </motion.div>
          ) : (
            <motion.div
              key={currentTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
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
          {selectedMovieSlug && (
            (selectedMovieSlug.startsWith("tt") || selectedMovieSlug.startsWith("tmdb-")) ? (
              <ExternalResolverModal
                id={selectedMovieSlug}
                onClose={() => setSelectedMovieSlug(null)}
                onSelect={setSelectedMovieSlug}
              />
            ) : (
              <MovieDetail
                slug={selectedMovieSlug}
                onClose={() => setSelectedMovieSlug(null)}
                onSelect={setSelectedMovieSlug}
              />
            )
          )}
        </AnimatePresence>

        <Footer />
      </div>
    </QueryClientProvider>
  );
}
