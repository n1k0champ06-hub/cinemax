import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, Search, X } from "lucide-react";
import { MovieCard } from "../movie/MovieCard";
import { GridShimmer } from "../ui/ImageShimmer";
import { useQuery } from "@tanstack/react-query";
import { fetchSearch } from "../../api/phimApi";

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
  const [history, setHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("search_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

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

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ["local_search", debouncedKeyword],
    queryFn: () => fetchSearch(debouncedKeyword),
    enabled: !!debouncedKeyword.trim(),
    staleTime: 5 * 60 * 1000,
  });

  const activeData = searchResults || [];

  // Save successful searches to history
  useEffect(() => {
    const term = debouncedKeyword.trim();
    if (term && searchResults && searchResults.length > 0) {
      setHistory((prev) => {
        const filtered = prev.filter((item) => item.toLowerCase() !== term.toLowerCase());
        const next = [term, ...filtered].slice(0, 10);
        localStorage.setItem("search_history", JSON.stringify(next));
        return next;
      });
    }
  }, [debouncedKeyword, searchResults]);

  // Log search keyword changes and results count
  useEffect(() => {
    const term = debouncedKeyword.trim();
    if (!term) return;

    console.log(
      `%c[USER ACTION: SEARCH]%c Keyword: "${term}"`,
      'background: #E50914; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
      'color: #ffffff; font-weight: bold;',
      {
        keyword: term,
        resultsCount: activeData?.length || 0,
        timestamp: new Date().toISOString()
      }
    );
  }, [debouncedKeyword, activeData]);

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
            onClick={() => {
              console.log(
                `%c[USER ACTION: CLICK]%c Back to Home from Search Page`,
                'background: #6B7280; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
                'color: #ffffff; font-weight: bold;',
                {
                  keyword,
                  timestamp: new Date().toISOString()
                }
              );
              onClose();
            }}
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
              onClick={() => {
                console.log(
                  `%c[USER ACTION: CLICK]%c Clear Search Input`,
                  'background: #EF4444; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
                  'color: #ffffff; font-weight: bold;',
                  {
                    previousKeyword: keyword,
                    timestamp: new Date().toISOString()
                  }
                );
                setKeyword("");
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white p-1.5 rounded-full hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Search History Section */}
        {keyword === "" && history.length > 0 && (
          <div className="mt-4 mb-8">
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-400 text-[10px] uppercase font-extrabold tracking-widest">
                Tìm kiếm gần đây
              </span>
              <button
                onClick={() => {
                  console.log(
                    `%c[USER ACTION: CLICK]%c Clear All Search History`,
                    'background: #EF4444; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
                    'color: #ffffff; font-weight: bold;',
                    {
                      historyCount: history.length,
                      timestamp: new Date().toISOString()
                    }
                  );
                  setHistory([]);
                  localStorage.removeItem("search_history");
                }}
                className="text-[10px] text-gray-500 hover:text-white transition-colors cursor-pointer"
              >
                Xóa tất cả
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {history.map((term, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 bg-[#111] hover:bg-[#181818] border border-white/[0.05] hover:border-white/[0.1] px-3.5 py-1.5 rounded-full transition-all text-xs font-semibold cursor-pointer group text-gray-300 hover:text-white"
                  onClick={() => {
                    console.log(
                      `%c[USER ACTION: CLICK]%c Search History Item: "${term}"`,
                      'background: #10B981; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
                      'color: #ffffff; font-weight: bold;',
                      {
                        term,
                        index: idx,
                        timestamp: new Date().toISOString()
                      }
                    );
                    setKeyword(term);
                  }}
                >
                  <span>{term}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log(
                        `%c[USER ACTION: CLICK]%c Delete Search History Item: "${term}"`,
                        'background: #EF4444; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
                        'color: #ffffff; font-weight: bold;',
                        {
                          term,
                          index: idx,
                          timestamp: new Date().toISOString()
                        }
                      );
                      const next = history.filter((h) => h !== term);
                      setHistory(next);
                      localStorage.setItem("search_history", JSON.stringify(next));
                    }}
                    className="text-gray-500 hover:text-red-500 p-0.5 rounded-full cursor-pointer transition-colors"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="mt-8">
            <GridShimmer />
          </div>
        )}

        {!isLoading && activeData.length === 0 && debouncedKeyword.trim() && (
          <div className="text-center mt-32 text-gray-500 text-xs font-semibold">
            Không tìm thấy phim nào trùng khớp trên máy chủ.
          </div>
        )}

        {!isLoading && activeData.length > 0 && (
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
                  onSelect={onSelect}
                  rowTitle="Kết quả Tìm Kiếm"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
