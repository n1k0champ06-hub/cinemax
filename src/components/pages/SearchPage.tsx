import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, Search, X } from "lucide-react";
import { MovieCard } from "../movie/MovieCard";
import { GridShimmer } from "../ui/ImageShimmer";
import { useTmdbSearchAdvanced } from "../../hooks/useTmdb";

export const SearchPage = ({
  onClose,
  onSelect,
}: {
  key?: React.Key;
  onClose: () => void;
  onSelect: (slug: string) => void;
}) => {
  const [keyword, setKeyword] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("q") || "";
  });
  const [debouncedKeyword, setDebouncedKeyword] = useState(keyword);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword), 400);
    return () => clearTimeout(timer);
  }, [keyword]);

  // Sync keyword state to URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (keyword) {
      params.set("q", keyword);
    } else {
      params.delete("q");
    }
    const queryString = params.toString();
    const newUrl = queryString ? `/?${queryString}` : "/";
    if (window.location.search !== (queryString ? `?${queryString}` : "")) {
      window.history.replaceState({}, "", newUrl);
    }
  }, [keyword]);

  // Handle popstate for keyword state
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setKeyword(params.get("q") || "");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const { data: advancedData, isLoading } = useTmdbSearchAdvanced(debouncedKeyword);

  // Remap TMDB data to generic standard
  const activeData = advancedData?.results && advancedData.results.length > 0
    ? advancedData.results
        .filter((item: any) => item.media_type !== 'person' && (item.poster_path || item.backdrop_path))
        .map((item: any) => {
          const type = item.media_type || 'movie';
          return {
            id: `tmdb-${item.id}-${type}`,
            slug: `tmdb-${item.id}-${type}`,
            name: item.title || item.name,
            origin_name: item.original_title || item.original_name,
            poster_url: item.poster_path ? (item.poster_path?.startsWith('http') ? item.poster_path : `https://image.tmdb.org/t/p/w342/${item.poster_path?.split('/').pop()}`) : null,
            tmdb: { vote_average: item.vote_average },
            year: (item.release_date || item.first_air_date || '').substring(0, 4),
          };
        })
    : [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-[#050505] overflow-y-auto pt-14 pb-20 px-4 md:px-8"
    >
      {/* Top Red Progress Loading Bar - Ultra Slim YouTube Premium style */}
      <AnimatePresence>
        {isLoading && (
          <motion.div 
            initial={{ width: "0%", opacity: 1 }}
            animate={{ width: ["0%", "30%", "65%", "90%"], opacity: 1 }}
            exit={{ width: "100%", opacity: 0 }}
            transition={{ 
              duration: 4, 
              ease: "easeInOut",
              times: [0, 0.1, 0.4, 0.95],
              exit: { duration: 0.2 }
            }}
            className="fixed top-0 left-0 h-[2.5px] bg-[#E50914] z-[10000] shadow-[0_0_8px_#E50914]"
          />
        )}
      </AnimatePresence>

      <div className="max-w-2xl mx-auto">
        {/* Top Controls Bar */}
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] px-3.5 py-1.5 rounded-full transition-all uppercase tracking-wider font-extrabold cursor-pointer"
          >
            <ChevronLeft size={12} /> Quay lại trang chủ
          </button>
        </div>

        {/* Brand Header Block (Tối giản hoàn toàn, cỡ chữ & icon nhỏ nhắn cân đối, HIDDEN ON MOBILE) */}
        <div className="hidden sm:flex items-center gap-3 mb-6">
          <div className="w-9 h-9 bg-white/[0.02] border border-white/[0.08] rounded-xl flex items-center justify-center shrink-0">
            <Search size={14} className="text-gray-400" />
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-widest text-white leading-tight">
              TÌM KIẾM PHIM
            </h1>
            <p className="text-[10px] text-gray-500 font-medium">
              Tìm phim lẻ, phim bộ, hoạt hình hấp dẫn, cập nhật liên tục mỗi ngày
            </p>
          </div>
        </div>

        {/* Proportional, balanced inputs with smaller dimensions */}
        <div className="relative mb-8 mt-2 sm:mt-0">
          <Search
            size={14}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            autoFocus
            type="text"
            placeholder="Bạn muốn xem gì hôm nay? Nhập tên phim, từ khóa..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-full bg-[#111]/60 hover:bg-[#151515] border border-white/[0.06] focus:border-[#E50914]/40 focus:bg-[#1a1a1a] rounded-xl py-3 pl-11 pr-11 text-xs focus:outline-none transition-all placeholder:text-gray-500 font-semibold text-white shadow-inner"
          />
          {keyword && (
            <button
              onClick={() => setKeyword("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white p-1.5 rounded-full hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {isLoading && (
          <div className="mt-8">
            <GridShimmer />
          </div>
        )}

        {!isLoading && activeData && activeData.length === 0 && debouncedKeyword && (
          <div className="text-center mt-32 text-gray-500 text-xs font-semibold">
            Không tìm thấy phim nào trùng khớp. Vui lòng kiểm tra lại từ khóa.
          </div>
        )}

        {!isLoading && activeData && activeData.length > 0 && (
          <div className="mt-6">
            <h2 className="text-gray-400 text-[10px] uppercase font-extrabold mb-5 tracking-widest">Kết quả tìm kiếm</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {activeData.map((movie: any, idx: number) => (
                <MovieCard
                  key={`${movie.slug || idx}-${idx}`}
                  movie={movie}
                  idx={idx}
                  isTop10={false}
                  className="w-full"
                  onSelect={(slug) => {
                    onSelect(slug);
                    onClose();
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
