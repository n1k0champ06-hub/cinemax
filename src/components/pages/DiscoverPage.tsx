import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, SlidersHorizontal, Loader2, RefreshCw, Check } from 'lucide-react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { cn } from '../../lib/utils';
import { tmdbDiscover } from '../../api/tmdbApi';
import { MovieCard } from '../movie/MovieCard';
import { GridShimmer } from '../ui/ImageShimmer';

interface DiscoverPageProps {
  onSelect: (slug: string) => void;
  setTab: (tab: string) => void;
}

// Vietnamese-friendly Modern Filter Lists Matching Screenshot
const MEDIA_TYPES = [
  { id: 'all', label: 'Phân loại' },
  { id: 'movie', label: 'Phim Lẻ' },
  { id: 'tv', label: 'Phim Bộ' },
  { id: 'anime', label: 'Hoạt hình' },
];

const SORT_OPTIONS = [
  { id: 'popularity.desc', label: 'Phổ biến nhất' },
  { id: 'release_date.desc', label: 'Mới cập nhật' },
  { id: 'vote_average.desc', label: 'Đánh giá tốt nhất' },
];

const GENRES = [
  { id: 'all', label: 'Tất cả thể loại' },
  { id: '28', label: 'Hành Động' },
  { id: '10749', label: 'Tình Cảm' },
  { id: '35', label: 'Hài Hước' },
  { id: '18', label: 'Tâm Lý' },
  { id: '80', label: 'Hình Sự' },
  { id: '10752', label: 'Chiến Tranh' },
  { id: '878', label: 'Viễn Tưởng' },
  { id: '27', label: 'Kinh Dị' },
  { id: '10402', label: 'Âm Nhạc' },
  { id: '10751', label: 'Gia Đình' },
  { id: '99', label: 'Tài Liệu' },
  { id: '16', label: 'Hoạt Hình' },
];

const YEARS = [
  { id: 'all', label: 'Mọi năm' },
  { id: '2026', label: 'Năm 2026' },
  { id: '2025', label: 'Năm 2025' },
  { id: '2024', label: 'Năm 2024' },
  { id: '2023', label: 'Năm 2023' },
  { id: '2022', label: 'Năm 2022' },
  { id: '2020s', label: 'Thập niên 2020' },
  { id: '2010s', label: 'Thập niên 2010' },
  { id: '2000s', label: 'Thập niên 2000' },
];

const COUNTRIES = [
  { id: 'all', label: 'Tất cả quốc gia' },
  { id: 'en', label: 'Âu Mỹ' },
  { id: 'ko', label: 'Hàn Quốc' },
  { id: 'zh', label: 'Trung Quốc' },
  { id: 'ja', label: 'Nhật Bản' },
  { id: 'th', label: 'Thái Lan' },
  { id: 'vi', label: 'Việt Nam' },
  { id: 'hi', label: 'Ấn Độ' },
];

const RATINGS = [
  { id: 'all', label: 'Mọi điểm số' },
  { id: '8', label: 'Từ 8.0⭐ trở lên' },
  { id: '7', label: 'Từ 7.0⭐ trở lên' },
  { id: '6', label: 'Từ 6.0⭐ trở lên' },
];

export const DiscoverPage = ({ onSelect, setTab }: DiscoverPageProps) => {
  const [selectedMediaType, setSelectedMediaType] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("media") || "all";
  });
  const [selectedSort, setSelectedSort] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("sort") || "popularity.desc";
  });
  const [selectedGenre, setSelectedGenre] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("genre") || "all";
  });
  const [selectedCountry, setSelectedCountry] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("country") || "all";
  });
  const [selectedYear, setSelectedYear] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("year") || "all";
  });
  const [selectedRating, setSelectedRating] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("rating") || "all";
  });

  // Active custom select dropdown key
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Sync discover page filters to URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (selectedMediaType !== "all") params.set("media", selectedMediaType);
    else params.delete("media");
    if (selectedSort !== "popularity.desc") params.set("sort", selectedSort);
    else params.delete("sort");
    if (selectedGenre !== "all") params.set("genre", selectedGenre);
    else params.delete("genre");
    if (selectedCountry !== "all") params.set("country", selectedCountry);
    else params.delete("country");
    if (selectedYear !== "all") params.set("year", selectedYear);
    else params.delete("year");
    if (selectedRating !== "all") params.set("rating", selectedRating);
    else params.delete("rating");

    const queryString = params.toString();
    const newUrl = queryString ? `/?${queryString}` : "/";
    if (window.location.search !== (queryString ? `?${queryString}` : "")) {
      window.history.replaceState({}, "", newUrl);
    }
  }, [selectedMediaType, selectedSort, selectedGenre, selectedCountry, selectedYear, selectedRating]);

  // Handle popstate for filters
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setSelectedMediaType(params.get("media") || "all");
      setSelectedSort(params.get("sort") || "popularity.desc");
      setSelectedGenre(params.get("genre") || "all");
      setSelectedCountry(params.get("country") || "all");
      setSelectedYear(params.get("year") || "all");
      setSelectedRating(params.get("rating") || "all");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  
  const filterPanelRef = useRef<HTMLDivElement>(null);

  // Close custom drop-downs when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const clearAllFilters = () => {
    setSelectedMediaType('all');
    setSelectedSort('popularity.desc');
    setSelectedGenre('all');
    setSelectedCountry('all');
    setSelectedYear('all');
    setSelectedRating('all');
    setActiveDropdown(null);
  };

  const hasFiltersApplied = 
    selectedMediaType !== 'all' ||
    selectedSort !== 'popularity.desc' ||
    selectedGenre !== 'all' ||
    selectedCountry !== 'all' ||
    selectedYear !== 'all' ||
    selectedRating !== 'all';

  // Build TMDB discovery parameters dynamically
  const buildParams = (type: 'movie' | 'tv') => {
    const params: Record<string, string | number | boolean> = {
      sort_by: selectedSort,
    };

    if (type === 'tv' && selectedSort.startsWith('release_date')) {
      params.sort_by = selectedSort.replace('release_date', 'first_air_date');
    }

    // Country/Original language mapping
    if (selectedCountry !== 'all') {
      params.with_original_language = selectedCountry;
    }

    // Genres mapping
    let genreId = selectedGenre;
    if (selectedMediaType === 'anime') {
      genreId = genreId === 'all' ? '16' : `${genreId},16`;
    }
    if (genreId !== 'all' && genreId !== '') {
      params.with_genres = genreId;
    }

    // Years scaling query
    if (selectedYear !== 'all') {
      if (selectedYear === '2020s') {
        params[`${type === 'movie' ? 'primary_release_date' : 'first_air_date'}.gte`] = '2020-01-01';
        params[`${type === 'movie' ? 'primary_release_date' : 'first_air_date'}.lte`] = '2029-12-31';
      } else if (selectedYear === '2010s') {
        params[`${type === 'movie' ? 'primary_release_date' : 'first_air_date'}.gte`] = '2010-01-01';
        params[`${type === 'movie' ? 'primary_release_date' : 'first_air_date'}.lte`] = '2019-12-31';
      } else if (selectedYear === '2000s') {
        params[`${type === 'movie' ? 'primary_release_date' : 'first_air_date'}.gte`] = '2000-01-01';
        params[`${type === 'movie' ? 'primary_release_date' : 'first_air_date'}.lte`] = '2009-12-31';
      } else {
        if (type === 'movie') {
          params.primary_release_year = selectedYear;
        } else {
          params.first_air_date_year = selectedYear;
        }
      }
    }

    // Min ratings filter
    if (selectedRating !== 'all') {
      params['vote_average.gte'] = parseFloat(selectedRating);
      params['vote_count.gte'] = 50; 
    } else if (selectedSort.startsWith('vote_average')) {
      params['vote_count.gte'] = 120;
    }

    return params;
  };

  // React Query Fetch Configuration
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery({
    queryKey: ['discover_list', selectedMediaType, selectedSort, selectedGenre, selectedCountry, selectedYear, selectedRating],
    queryFn: async ({ pageParam = 1 }) => {
      let activeType: 'movie' | 'tv' = 'movie';
      if (selectedMediaType === 'tv') {
        activeType = 'tv';
      } else if (selectedMediaType === 'anime') {
        activeType = 'movie'; // Anime is processed via media query + category
      }

      const params = buildParams(activeType);
      const res = await tmdbDiscover(activeType, { ...params, page: pageParam });

      if (res?.results) {
        return {
          ...res,
          results: res.results.map((item: any) => ({
            id: `tmdb-${item.id}-${activeType}`,
            slug: `tmdb-${item.id}-${activeType}`,
            name: item.title || item.name,
            origin_name: item.original_title || item.original_name,
            poster_url: item.poster_path 
              ? (item.poster_path.startsWith('http') ? item.poster_path : `https://image.tmdb.org/t/p/w320/${item.poster_path.split('/').pop()}`) 
              : null,
            tmdb: { vote_average: item.vote_average },
            year: (item.release_date || item.first_air_date || '').substring(0, 4),
            media_type: activeType
          }))
        };
      }
      return { results: [] };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || !lastPage.results || lastPage.results.length === 0) return undefined;
      return allPages.length + 1;
    },
  });

  const movies = data?.pages.flatMap(page => page.results || []) || [];

  const toggleDropdown = (name: string) => {
    setActiveDropdown(prev => prev === name ? null : name);
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-12 w-full pt-4 font-sans select-none pb-20">
      
      {/* Container Frame styled identically to screenshot 3 */}
      <div 
        ref={filterPanelRef}
        className="w-full bg-[#090909]/95 backdrop-blur-2xl border border-white/[0.06] rounded-3xl p-5 md:p-6 mb-8 relative z-30 shadow-[0_24px_50px_rgba(0,0,0,0.95)]"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-gray-300">
              <SlidersHorizontal className="w-5 h-5 text-gray-100" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Khám phá</h1>
              <p className="text-[13px] text-neutral-400 font-medium mt-0.5">Lọc & khám phá nội dung</p>
            </div>
          </div>

          {/* Clean resetting mechanism */}
          <div className="flex items-center">
            {hasFiltersApplied && (
              <button 
                onClick={clearAllFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-transparent hover:bg-white/5 text-gray-300 rounded-lg text-xs font-medium transition-all border border-neutral-700 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Đặt lại
              </button>
            )}
          </div>
        </div>

        {/* Filters Selectors Row - Exact match layout with 2 columns on mobile */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
          
          {/* Selector 1: Category / Phân loại */}
          <div className={cn("relative", activeDropdown === 'category' ? "z-50" : "z-10")}>
            <button 
              type="button"
              onClick={() => toggleDropdown('category')}
              className={cn(
                "flex items-center justify-between w-full px-4 py-3 bg-transparent hover:bg-white/5 border rounded-2xl text-sm font-semibold tracking-wide transition-all duration-200 cursor-pointer text-left shadow-sm",
                selectedMediaType !== 'all' ? "border-white/30 text-white shadow-white/5" : "border-white/10 text-gray-300"
              )}
            >
              <span className="truncate">
                {MEDIA_TYPES.find(m => m.id === selectedMediaType)?.label || 'Phân loại'}
              </span>
              <ChevronDown className={cn("w-3.5 h-3.5 text-neutral-600 transition-transform duration-300", activeDropdown === 'category' && "rotate-180")} />
            </button>
            <AnimatePresence>
              {activeDropdown === 'category' && (
                <motion.div 
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute top-full left-0 right-0 mt-2 bg-[#0e0e0e]/98 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 shadow-[0_20px_40px_rgba(0,0,0,0.85)] z-50 origin-top flex flex-col gap-0.5"
                >
                  {MEDIA_TYPES.map((m, idx) => {
                    const isSelected = selectedMediaType === m.id;
                    return (
                      <React.Fragment key={m.id}>
                        <button 
                          onClick={() => { setSelectedMediaType(m.id); setActiveDropdown(null); }}
                          className={cn(
                            "w-full text-left px-3.5 py-2 text-[13px] font-medium hover:bg-white/10 transition-all duration-150 flex items-center justify-between rounded-xl",
                            isSelected ? "text-white bg-white/5 font-semibold" : "text-gray-400 hover:text-white"
                          )}
                        >
                          <span>{m.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </button>
                        {idx === 0 && <div className="h-px bg-white/5 my-1 mx-1.5" />}
                      </React.Fragment>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Selector 2: Sorting Option */}
          <div className={cn("relative", activeDropdown === 'sort' ? "z-50" : "z-10")}>
            <button 
              type="button"
              onClick={() => toggleDropdown('sort')}
              className={cn(
                "flex items-center justify-between w-full px-4 py-3 bg-transparent hover:bg-white/5 border rounded-2xl text-sm font-semibold tracking-wide transition-all duration-200 cursor-pointer text-left shadow-sm",
                selectedSort !== 'popularity.desc' ? "border-white/30 text-white shadow-white/5" : "border-white/10 text-gray-300"
              )}
            >
              <span className="truncate">
                {SORT_OPTIONS.find(s => s.id === selectedSort)?.label || 'Sắp xếp'}
              </span>
              <ChevronDown className={cn("w-3.5 h-3.5 text-neutral-600 transition-transform duration-300", activeDropdown === 'sort' && "rotate-180")} />
            </button>
            <AnimatePresence>
              {activeDropdown === 'sort' && (
                <motion.div 
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute top-full left-0 right-0 mt-2 bg-[#0e0e0e]/98 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 shadow-[0_20px_40px_rgba(0,0,0,0.85)] z-50 origin-top flex flex-col gap-0.5"
                >
                  {SORT_OPTIONS.map((s, idx) => {
                    const isSelected = selectedSort === s.id;
                    return (
                      <React.Fragment key={s.id}>
                        <button 
                          onClick={() => { setSelectedSort(s.id); setActiveDropdown(null); }}
                          className={cn(
                            "w-full text-left px-3.5 py-2 text-[13px] font-medium hover:bg-white/10 transition-all duration-150 flex items-center justify-between rounded-xl",
                            isSelected ? "text-white bg-white/5 font-semibold" : "text-gray-400 hover:text-white"
                          )}
                        >
                          <span>{s.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </button>
                        {idx === 0 && <div className="h-px bg-white/5 my-1 mx-1.5" />}
                      </React.Fragment>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Selector 3: Genres Selection */}
          <div className={cn("relative", activeDropdown === 'genres' ? "z-50" : "z-10")}>
            <button 
              type="button"
              onClick={() => toggleDropdown('genres')}
              className={cn(
                "flex items-center justify-between w-full px-4 py-3 bg-transparent hover:bg-white/5 border rounded-2xl text-sm font-semibold tracking-wide transition-all duration-200 cursor-pointer text-left shadow-sm",
                selectedGenre !== 'all' ? "border-white/30 text-white shadow-white/5" : "border-white/10 text-gray-300"
              )}
            >
              <span className="truncate">
                {GENRES.find(g => g.id === selectedGenre)?.label || 'Thể loại'}
              </span>
              <ChevronDown className={cn("w-3.5 h-3.5 text-neutral-600 transition-transform duration-300", activeDropdown === 'genres' && "rotate-180")} />
            </button>
            <AnimatePresence>
              {activeDropdown === 'genres' && (
                <motion.div 
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute top-full left-0 right-0 mt-2 bg-[#0e0e0e]/98 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 shadow-[0_20px_40px_rgba(0,0,0,0.85)] z-50 max-h-[300px] overflow-y-auto custom-scrollbar origin-top flex flex-col gap-0.5"
                >
                  {GENRES.map((g, idx) => {
                    const isSelected = selectedGenre === g.id;
                    return (
                      <React.Fragment key={g.id}>
                        <button 
                          onClick={() => { setSelectedGenre(g.id); setActiveDropdown(null); }}
                          className={cn(
                            "w-full text-left px-3.5 py-2 text-[13px] font-medium hover:bg-white/10 transition-all duration-150 flex items-center justify-between rounded-xl",
                            isSelected ? "text-white bg-white/5 font-semibold" : "text-gray-400 hover:text-white"
                          )}
                        >
                          <span>{g.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </button>
                        {idx === 0 && <div className="h-px bg-white/5 my-1 mx-1.5" />}
                      </React.Fragment>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Selector 4: Country Selection */}
          <div className={cn("relative", activeDropdown === 'country' ? "z-50" : "z-10")}>
            <button 
              type="button"
              onClick={() => toggleDropdown('country')}
              className={cn(
                "flex items-center justify-between w-full px-4 py-3 bg-transparent hover:bg-white/5 border rounded-2xl text-sm font-semibold tracking-wide transition-all duration-200 cursor-pointer text-left shadow-sm",
                selectedCountry !== 'all' ? "border-white/30 text-white shadow-white/5" : "border-white/10 text-gray-300"
              )}
            >
              <span className="truncate">
                {COUNTRIES.find(c => c.id === selectedCountry)?.label || 'Quốc gia'}
              </span>
              <ChevronDown className={cn("w-3.5 h-3.5 text-neutral-600 transition-transform duration-300", activeDropdown === 'country' && "rotate-180")} />
            </button>
            <AnimatePresence>
              {activeDropdown === 'country' && (
                <motion.div 
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute top-full left-0 right-0 mt-2 bg-[#0e0e0e]/98 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 shadow-[0_20px_40px_rgba(0,0,0,0.85)] z-50 max-h-[300px] overflow-y-auto custom-scrollbar origin-top flex flex-col gap-0.5"
                >
                  {COUNTRIES.map((c, idx) => {
                    const isSelected = selectedCountry === c.id;
                    return (
                      <React.Fragment key={c.id}>
                        <button 
                          onClick={() => { setSelectedCountry(c.id); setActiveDropdown(null); }}
                          className={cn(
                            "w-full text-left px-3.5 py-2 text-[13px] font-medium hover:bg-white/10 transition-all duration-150 flex items-center justify-between rounded-xl",
                            isSelected ? "text-white bg-white/5 font-semibold" : "text-gray-400 hover:text-white"
                          )}
                        >
                          <span>{c.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </button>
                        {idx === 0 && <div className="h-px bg-white/5 my-1 mx-1.5" />}
                      </React.Fragment>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Selector 5: Release Years Option */}
          <div className={cn("relative", activeDropdown === 'years' ? "z-50" : "z-10")}>
            <button 
              type="button"
              onClick={() => toggleDropdown('years')}
              className={cn(
                "flex items-center justify-between w-full px-4 py-3 bg-transparent hover:bg-white/5 border rounded-2xl text-sm font-semibold tracking-wide transition-all duration-200 cursor-pointer text-left shadow-sm",
                selectedYear !== 'all' ? "border-white/30 text-white shadow-white/5" : "border-white/10 text-gray-300"
              )}
            >
              <span className="truncate">
                {YEARS.find(y => y.id === selectedYear)?.label || 'Mọi năm'}
              </span>
              <ChevronDown className={cn("w-3.5 h-3.5 text-neutral-600 transition-transform duration-300", activeDropdown === 'years' && "rotate-180")} />
            </button>
            <AnimatePresence>
              {activeDropdown === 'years' && (
                <motion.div 
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute top-full left-0 right-0 mt-2 bg-[#0e0e0e]/98 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 shadow-[0_20px_40px_rgba(0,0,0,0.85)] z-50 max-h-[300px] overflow-y-auto custom-scrollbar origin-top flex flex-col gap-0.5"
                >
                  {YEARS.map((y, idx) => {
                    const isSelected = selectedYear === y.id;
                    return (
                      <React.Fragment key={y.id}>
                        <button 
                          onClick={() => { setSelectedYear(y.id); setActiveDropdown(null); }}
                          className={cn(
                            "w-full text-left px-3.5 py-2 text-[13px] font-medium hover:bg-white/10 transition-all duration-150 flex items-center justify-between rounded-xl",
                            isSelected ? "text-white bg-white/5 font-semibold" : "text-gray-400 hover:text-white"
                          )}
                        >
                          <span>{y.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </button>
                        {idx === 0 && <div className="h-px bg-white/5 my-1 mx-1.5" />}
                      </React.Fragment>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>

        {/* Status Indicator at the bottom of grid */}
        <div className="flex items-center justify-start mt-4 pt-1 select-none">
          <span className={cn("text-[13px] font-semibold font-sans tracking-wide", hasFiltersApplied ? "text-neutral-400" : "text-neutral-600")}>
            {hasFiltersApplied ? 'Đang áp dụng bộ lọc' : 'Chưa áp dụng bộ lọc'}
          </span>
        </div>
      </div>

      {/* Movie Grid Section with Smooth Infinite Loading */}
      {isLoading && (
        <div className="mt-8">
          <GridShimmer />
        </div>
      )}

      {!isLoading && movies.length === 0 && (
        <div className="text-center mt-32 text-neutral-500 text-sm flex flex-col items-center justify-center gap-4">
          <p className="font-medium text-neutral-400">Không tìm thấy bộ phim nào phù hợp với bộ lọc bạn chọn.</p>
          <button 
            onClick={clearAllFilters}
            className="text-xs px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-800 rounded-xl cursor-pointer hover:border-neutral-700 transition-colors"
          >
            Mặc định lại bộ lọc
          </button>
        </div>
      )}

      {!isLoading && movies.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-7">
            {movies.map((movie: any, idx: number) => (
              <MovieCard 
                key={`${movie.slug || idx}-${idx}`} 
                movie={movie} 
                idx={idx} 
                isTop10={false}
                onSelect={(slug) => onSelect(slug)} 
                className="w-full"
              />
            ))}
          </div>

          {hasNextPage && (
            <div className="flex justify-center mt-14 mb-8">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="px-8 py-3 bg-neutral-900 border border-neutral-850 text-white hover:bg-white hover:text-black font-bold rounded-xl transition-all flex items-center gap-2.5 disabled:opacity-50 active:scale-95 cursor-pointer shadow-lg hover:border-white text-xs tracking-wider"
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang tải thêm...
                  </>
                ) : (
                  'Tải Thêm'
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
