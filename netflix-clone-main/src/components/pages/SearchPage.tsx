import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, Search, X, SlidersHorizontal } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchSearch } from "../../api/phimApi";
import { SearchResultCard } from "../movie/SearchResultCard";
import { ImdbMovieCard } from "../movie/ImdbMovieCard";
import { GridShimmer } from "../ui/ImageShimmer";
import { useTmdbSearchAdvanced } from "../../hooks/useTmdb";
import { CustomSelect } from "../ui/CustomSelect";
import { RankingCard } from "../movie/RankingCard";

export const SearchPage = ({
  onClose,
  onSelect,
}: {
  key?: React.Key;
  onClose: () => void;
  onSelect: (slug: string) => void;
}) => {
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [type, setType] = useState("");
  const [genre, setGenre] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword), 800);
    return () => clearTimeout(timer);
  }, [keyword]);

  const { data: standardData, isLoading: standardLoading } = useQuery({
    queryKey: ["search", debouncedKeyword],
    queryFn: () => fetchSearch(debouncedKeyword),
    enabled: debouncedKeyword.length > 0 && !isAdvanced,
  });

  const { data: advancedData, isLoading: advancedLoading } = useTmdbSearchAdvanced(debouncedKeyword, type as 'movie' | 'tv' | '', genre);

  // Remap TMDB data to generic standard
  const activeData = isAdvanced ? advancedData?.results?.map((item: any) => ({
    id: `tmdb-${item.id}-${type || (item.media_type) || 'movie'}`,
    slug: `tmdb-${item.id}-${type || (item.media_type) || 'movie'}`,
    name: item.title || item.name,
    origin_name: item.original_title || item.original_name,
    poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null,
    tmdb: { vote_average: item.vote_average },
    year: (item.release_date || item.first_air_date || '').substring(0, 4),
  })) : standardData;
  const isLoading = isAdvanced ? advancedLoading : standardLoading;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-[#050505] overflow-y-auto pt-24 pb-20 px-4 md:px-12"
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors shrink-0"
            >
              <ChevronLeft size={28} />
            </button>

            <div className="relative flex-1">
              <Search
                size={22}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                autoFocus
                type="text"
                placeholder={isAdvanced ? "Tên phim Tiếng Anh (IMDb)..." : "Tên phim..."}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-full bg-[#111] border border-white/10 rounded-full py-3 md:py-4 pl-12 pr-12 text-lg md:text-xl focus:outline-none focus:border-white/30 transition-colors placeholder:text-gray-600"
              />
              {keyword && (
                <button
                  onClick={() => setKeyword("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-2"
                >
                  <X size={20} />
                </button>
              )}
            </div>
            
            <button 
              onClick={() => setIsAdvanced(!isAdvanced)}
              className={`p-3 md:p-4 rounded-full border transition-all ${isAdvanced ? 'bg-purple-600 text-white border-purple-500' : 'bg-[#111] text-gray-400 border-white/10 hover:text-white'}`}
              title="Bộ lọc nâng cao"
            >
              <SlidersHorizontal size={22} />
            </button>
          </div>

          <AnimatePresence>
            {isAdvanced && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="flex flex-wrap items-center gap-4 pl-12 overflow-hidden"
              >
                 <CustomSelect 
                   value={type} 
                   onChange={val => setType(val)}
                   options={[
                     { value: '', label: 'Tất cả định dạng' },
                     { value: 'movie', label: 'Phim Lẻ' },
                     { value: 'tv', label: 'Phim Bộ' },
                   ]}
                 />

                 <CustomSelect 
                   value={genre} 
                   onChange={val => setGenre(val)}
                   options={[
                     { value: '', label: 'Tất cả thể loại' },
                     { value: '28', label: 'Hành Động' },
                     { value: '35', label: 'Hài Hước' },
                     { value: '18', label: 'Tâm Lý' },
                     { value: '27', label: 'Kinh Dị' },
                     { value: '878', label: 'Viễn Tưởng' },
                     { value: '10749', label: 'Tình Cảm' },
                     { value: '16', label: 'Hoạt Hình' },
                     { value: '99', label: 'Tài Liệu' },
                   ]}
                 />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {isLoading && (
          <div className="mt-8">
            <GridShimmer />
          </div>
        )}

        {!isLoading && activeData && activeData.length === 0 && (debouncedKeyword || isAdvanced) && (
          <div className="text-center mt-32 text-gray-500 text-xl">
            Không tìm thấy phim nào.
          </div>
        )}

        {!isLoading && activeData && activeData.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {activeData.map((movie: any, idx: number) => (
              isAdvanced ? (
                <SearchResultCard
                  key={movie.id}
                  movie={movie}
                  idx={idx}
                  onSelect={(slug) => {
                    onSelect(slug);
                    onClose();
                  }}
                />
              ) : (
                <SearchResultCard
                  key={`${movie.slug || idx}-${idx}`}
                  movie={movie}
                  idx={idx}
                  onSelect={(slug) => {
                    onSelect(slug);
                    onClose();
                  }}
                />
              )
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};
