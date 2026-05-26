/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { NavBar } from "./components/layout/NavBar";
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
import "./lib/firebase";

import { ExternalResolverModal } from "./components/movie/ExternalResolverModal";
import { TmdbRow } from "./components/movie/ImdbRow";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 24 * 60 * 60 * 1000, // 24 giờ - tránh gọi lại API liên tục
      gcTime: 24 * 60 * 60 * 1000,    // Giữ cache 24 giờ trong phiên
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

  const handleSetTab = (tab: string) => {
    setCurrentTab(tab);
    setSelectedMovieSlug(null);
    setShowSearch(false);
    window.history.pushState({}, "", tab === "home" ? "/" : `/?tab=${tab}`);
    window.scrollTo(0, 0);
  };

  const [selectedMovieSlug, setSelectedMovieSlug] = useState<string | null>(
    null,
  );
  const [showSearch, setShowSearch] = useState(false);

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
      <div className="min-h-screen xl:max-w-[1536px] xl:mx-auto bg-[#0a0a0a] text-white selection:bg-red-600/30 selection:text-white font-sans overflow-x-hidden relative">
        <NavBar
          currentTab={currentTab}
          setTab={handleSetTab}
          onShowSearch={() => setShowSearch(true)}
        />

        <AnimatePresence>
          {currentTab === "home" ? (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Hero
                onSelect={setSelectedMovieSlug}
                setTab={handleSetTab}
                onShowSearch={() => setShowSearch(true)}
                onScrollDown={() => {
                  const el = document.getElementById("movie-lists");
                  if (el) {
                    const targetY =
                      el.getBoundingClientRect().top + window.scrollY - 80;
                    const startY = window.scrollY;
                    const difference = targetY - startY;
                    const duration = 800; // ms
                    let startTime: number | null = null;
                    const step = (time: number) => {
                      if (!startTime) startTime = time;
                      const progress = Math.min(
                        (time - startTime) / duration,
                        1,
                      );
                      const ease = 0.5 - Math.cos(progress * Math.PI) / 2;
                      window.scrollTo(0, startY + difference * ease);
                      if (progress < 1) requestAnimationFrame(step);
                    };
                    requestAnimationFrame(step);
                  }
                }}
              />
              <div
                id="movie-lists"
                className="pb-32 mt-4 sm:mt-12 relative z-20 flex flex-col gap-0"
              >
                <ContinueWatchingRow onSelect={setSelectedMovieSlug} />
                <MyListRow onSelect={setSelectedMovieSlug} />
                <TmdbRow title="Xu Hướng Tuần Này" type="trending-week" onSelect={setSelectedMovieSlug} />
                <TmdbRow title="Đang Chiếu Rạp" type="now-playing" onSelect={setSelectedMovieSlug} />
                <TmdbRow title="Top Phim Thế Giới (Bình chọn cao)" type="top250-movies" onSelect={setSelectedMovieSlug} />
                <TmdbRow title="Phim Bộ Phổ Biến Nhất" type="popular-tv" onSelect={setSelectedMovieSlug} />
                <AnimeRankingRow onSelect={setSelectedMovieSlug} />
                <MovieRow
                  title="Phim Lẻ Đáng Xem"
                  type="phim-le"
                  onSelect={setSelectedMovieSlug}
                  variant="landscape"
                />
                <MovieRow
                  title="Hành Động Khét Lẹt"
                  type="the-loai/hanh-dong"
                  onSelect={setSelectedMovieSlug}
                  variant="landscape"
                />
                <MovieRow
                  title="Kinh Dị Rén Ngang"
                  type="the-loai/kinh-di"
                  onSelect={setSelectedMovieSlug}
                  variant="landscape"
                />
                <MovieRow
                  title="Hài Hước Cười Điên"
                  type="the-loai/hai-huoc"
                  onSelect={setSelectedMovieSlug}
                  variant="landscape"
                />
                <MovieRow
                  title="Tình Cảm Suy Ngang"
                  type="the-loai/tinh-cam"
                  onSelect={setSelectedMovieSlug}
                  variant="landscape"
                />
                <MovieRow
                  title="Oppa Hàn Xẻng"
                  type="quoc-gia/han-quoc"
                  onSelect={setSelectedMovieSlug}
                  variant="landscape"
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={currentTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="pt-24 pb-20 min-h-screen"
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
      </div>
    </QueryClientProvider>
  );
}
