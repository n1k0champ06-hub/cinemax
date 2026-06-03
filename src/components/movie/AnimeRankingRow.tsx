import React from 'react';
import { useAnimeDbRanking, useAnimeDbSeasonNow, useAnimeDbUpcoming, useAnimeDbSearch } from '../../hooks/useAnimeDb';
import { RankingCard } from './RankingCard';
import { ChevronLeft, ChevronRight, Trash2, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const TABS = [
  { id: 'ranking', label: 'Bảng Xếp Hạng' },
  { id: 'airing', label: 'Mùa Hiện Tại' },
  { id: 'upcoming', label: 'Sắp Ra Mắt' }
] as const;

const ANIME_GENRES = [
  { id: '', label: 'Tất cả thể loại' },
  { id: '1', label: 'Hành động (Action)' },
  { id: '2', label: 'Phiêu lưu (Adventure)' },
  { id: '4', label: 'Hài hước (Comedy)' },
  { id: '8', label: 'Chính kịch (Drama)' },
  { id: '10', label: 'Kỳ ảo (Fantasy)' },
  { id: '22', label: 'Tình cảm (Romance)' },
  { id: '24', label: 'Viễn tưởng (Sci-Fi)' },
  { id: '36', label: 'Đời thường (Slice of Life)' },
  { id: '37', label: 'Siêu nhiên (Supernatural)' },
];

const ANIME_TYPES = [
  { id: '', label: 'Tất cả định dạng' },
  { id: 'tv', label: 'Phim bộ (TV Series)' },
  { id: 'movie', label: 'Phim lẻ (Movie)' },
  { id: 'ova', label: 'OVA' },
  { id: 'special', label: 'Đặc biệt (Special)' },
  { id: 'ona', label: 'ONA' },
];

const ANIME_STATUS = [
  { id: '', label: 'Tất cả trạng thái' },
  { id: 'airing', label: 'Đang chiếu (Airing)' },
  { id: 'complete', label: 'Trọn bộ (Complete)' },
  { id: 'upcoming', label: 'Sắp chiếu (Upcoming)' },
];

const ANIME_SCORES = [
  { id: '', label: 'Mọi điểm số' },
  { id: '9', label: 'Từ 9.0⭐ trở lên' },
  { id: '8', label: 'Từ 8.0⭐ trở lên' },
  { id: '7', label: 'Từ 7.0⭐ trở lên' },
  { id: '6', label: 'Từ 6.0⭐ trở lên' },
  { id: '5', label: 'Từ 5.0⭐ trở lên' },
];

export const AnimeRankingRow = ({ onSelect, showFilters = false }: { onSelect: (slug: string) => void; showFilters?: boolean }) => {
  const [activeTab, setActiveTab] = React.useState<'ranking' | 'airing' | 'upcoming'>('ranking');

  // Filter States
  const [searchInput, setSearchInput] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedGenre, setSelectedGenre] = React.useState("");
  const [selectedType, setSelectedType] = React.useState("");
  const [selectedStatus, setSelectedStatus] = React.useState("");
  const [selectedMinScore, setSelectedMinScore] = React.useState("");

  // Active Dropdown state (genre, type, status, score)
  const [activeDropdown, setActiveDropdown] = React.useState<string | null>(null);

  // Debounce search query input (500ms) to prevent Jikan rate limit errors
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const hasSearchFilters = showFilters && (
    searchQuery.trim() !== "" || 
    selectedGenre !== "" || 
    selectedType !== "" || 
    selectedStatus !== "" || 
    selectedMinScore !== ""
  );

  const handleClearFilters = () => {
    setSearchInput("");
    setSearchQuery("");
    setSelectedGenre("");
    setSelectedType("");
    setSelectedStatus("");
    setSelectedMinScore("");
    setActiveDropdown(null);
  };

  const filterPanelRef = React.useRef<HTMLDivElement>(null);

  // Close custom drop-downs when clicking outside
  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const toggleDropdown = (name: string) => {
    setActiveDropdown(prev => prev === name ? null : name);
  };

  // Queries
  const { data: rankingData, isLoading: isRankingLoading } = useAnimeDbRanking(1, 15, activeTab === 'ranking' && !hasSearchFilters);
  const { data: seasonNowData, isLoading: isSeasonNowLoading } = useAnimeDbSeasonNow(1, 15, activeTab === 'airing' && !hasSearchFilters);
  const { data: upcomingData, isLoading: isUpcomingLoading } = useAnimeDbUpcoming(1, 15, activeTab === 'upcoming' && !hasSearchFilters);
  const { data: searchResultsData, isLoading: isSearchLoading } = useAnimeDbSearch(
    {
      q: searchQuery,
      genres: selectedGenre,
      type: selectedType,
      status: selectedStatus,
      min_score: selectedMinScore
    },
    hasSearchFilters
  );

  const scrollRef = React.useRef<HTMLDivElement>(null);

  const isLoading = hasSearchFilters
    ? isSearchLoading
    : (activeTab === 'ranking' ? isRankingLoading :
       activeTab === 'airing' ? isSeasonNowLoading :
       isUpcomingLoading);

  const animeData = hasSearchFilters
    ? searchResultsData
    : (activeTab === 'ranking' ? rankingData :
       activeTab === 'airing' ? seasonNowData :
       upcomingData);

  const handleSelect = async (anime: any) => {
    try {
      const { tmdbSearchTv, tmdbSearchMovie } = await import('../../api/tmdbApi');
      const searchQueryText = anime.title || anime.title_english || anime.title_japanese || "";
      
      const isMovie = anime.type?.toLowerCase() === 'movie';
      
      // Search specific to type
      const res = await (isMovie ? tmdbSearchMovie(searchQueryText) : tmdbSearchTv(searchQueryText));
      
      if (res && res.results && res.results.length > 0) {
        // Find best match: Japanese language and Animation genre (16)
        let tmdbItem = res.results.find((r: any) => {
          const rYear = r.first_air_date ? r.first_air_date.split('-')[0] : (r.release_date ? r.release_date.split('-')[0] : null);
          const aYear = anime.year?.toString() || anime.aired?.prop?.from?.year?.toString();
          return rYear === aYear && r.original_language === 'ja' && r.genre_ids?.includes(16);
        });

        if (!tmdbItem) {
          tmdbItem = res.results.find((r: any) => 
            r.original_language === 'ja' && 
            r.genre_ids?.includes(16)
          );
        }

        // Final fallback to first result
        if (!tmdbItem) {
          tmdbItem = res.results[0];
        }

        const mediaType = isMovie ? 'movie' : 'tv';
        const slug = `tmdb-${tmdbItem.id}-${mediaType}`;
        onSelect(slug);
      } else {
        alert(`Không tìm thấy thông tin chi tiết trên máy chủ cho: ${searchQueryText}`);
      }
    } catch (e) {
      console.error(e);
      alert("Lỗi khi tìm kiếm phim.");
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = window.innerWidth * 0.75;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const animes = animeData?.data || animeData?.results || animeData || [];

  return (
    <div className="py-6 md:py-8 relative group/row min-h-[380px]">
      
      {/* Header & Tabs Toolbar row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4 sm:px-8 md:px-12 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-[3px] h-5 sm:h-6 bg-[#E50914] rounded-full" />
          <h2 className="text-white text-xl sm:text-2xl md:text-[28px] font-bold tracking-tight">
            {hasSearchFilters ? 'Kết Quả Tìm Kiếm Anime' :
             activeTab === 'ranking' ? 'Bảng Xếp Hạng Anime' : 
             activeTab === 'airing' ? 'Anime Đang Phát Sóng' : 
             'Anime Sắp Ra Mắt'}
          </h2>
        </div>
        
        {/* Sleek pill tab group */}
        {!hasSearchFilters && (
          <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.08] p-1 rounded-xl self-start md:self-auto">
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    // Reset scroll when switching tabs
                    if (scrollRef.current) {
                      scrollRef.current.scrollTo({ left: 0, behavior: 'auto' });
                    }
                  }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all select-none cursor-pointer ${
                    isActive 
                      ? 'bg-white text-black shadow-md' 
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Advanced Jikan Filters Row matching user screenshot - only rendered if showFilters is enabled */}
      {showFilters && (
        <div 
          ref={filterPanelRef}
          className="flex flex-wrap items-center gap-3 px-4 sm:px-8 md:px-12 py-3.5 mb-2 bg-[#090909]/95 border border-white/[0.06] rounded-2xl mx-4 sm:mx-8 md:mx-12 z-30 relative shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
        >
          
          {/* Search Field */}
          <div className="relative flex-grow min-w-[160px] sm:max-w-xs z-10">
            <input 
              type="text" 
              placeholder="Tìm kiếm Anime..." 
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full px-4 py-3 bg-[#121212]/90 hover:bg-[#181818] focus:bg-[#1a1a1a] border border-white/10 focus:border-white/20 rounded-2xl text-xs sm:text-sm font-semibold tracking-wide text-white outline-none placeholder:text-neutral-500 transition-all shadow-sm"
            />
          </div>

          {/* Dropdown 1: Thể loại */}
          <div className="relative z-20">
            <button
              type="button"
              onClick={() => toggleDropdown('genre')}
              className={`flex items-center justify-between gap-2 px-4 py-3 bg-[#121212]/90 hover:bg-[#181818] border rounded-2xl text-xs sm:text-sm font-semibold tracking-wide transition-all cursor-pointer text-left ${
                selectedGenre ? "border-white/30 text-white shadow-white/5" : "border-white/10 text-neutral-300"
              }`}
            >
              <span>
                {ANIME_GENRES.find(g => g.id === selectedGenre)?.label || 'Thể loại'}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-neutral-500 transition-transform duration-200 ${activeDropdown === 'genre' && "rotate-180"}`} />
            </button>
            <AnimatePresence>
              {activeDropdown === 'genre' && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-2 min-w-[200px] bg-[#0e0e0e]/98 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 shadow-[0_20px_40px_rgba(0,0,0,0.85)] z-50 max-h-[280px] overflow-y-auto custom-scrollbar flex flex-col gap-0.5"
                >
                  {ANIME_GENRES.map(g => {
                    const isSelected = selectedGenre === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => { setSelectedGenre(g.id); setActiveDropdown(null); }}
                        className={`w-full text-left px-3.5 py-2 text-[13px] font-medium hover:bg-white/10 transition-all flex items-center justify-between rounded-xl cursor-pointer ${
                          isSelected ? "text-white bg-white/5 font-semibold" : "text-gray-400 hover:text-white"
                        }`}
                      >
                        <span>{g.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Dropdown 2: Định dạng (Type) */}
          <div className="relative z-20">
            <button
              type="button"
              onClick={() => toggleDropdown('type')}
              className={`flex items-center justify-between gap-2 px-4 py-3 bg-[#121212]/90 hover:bg-[#181818] border rounded-2xl text-xs sm:text-sm font-semibold tracking-wide transition-all cursor-pointer text-left ${
                selectedType ? "border-white/30 text-white shadow-white/5" : "border-white/10 text-neutral-300"
              }`}
            >
              <span>
                {ANIME_TYPES.find(t => t.id === selectedType)?.label || 'Định dạng'}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-neutral-500 transition-transform duration-200 ${activeDropdown === 'type' && "rotate-180"}`} />
            </button>
            <AnimatePresence>
              {activeDropdown === 'type' && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-2 min-w-[180px] bg-[#0e0e0e]/98 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 shadow-[0_20px_40px_rgba(0,0,0,0.85)] z-50 flex flex-col gap-0.5"
                >
                  {ANIME_TYPES.map(t => {
                    const isSelected = selectedType === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => { setSelectedType(t.id); setActiveDropdown(null); }}
                        className={`w-full text-left px-3.5 py-2 text-[13px] font-medium hover:bg-white/10 transition-all flex items-center justify-between rounded-xl cursor-pointer ${
                          isSelected ? "text-white bg-white/5 font-semibold" : "text-gray-400 hover:text-white"
                        }`}
                      >
                        <span>{t.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Dropdown 3: Trạng thái (Status) */}
          <div className="relative z-20">
            <button
              type="button"
              onClick={() => toggleDropdown('status')}
              className={`flex items-center justify-between gap-2 px-4 py-3 bg-[#121212]/90 hover:bg-[#181818] border rounded-2xl text-xs sm:text-sm font-semibold tracking-wide transition-all cursor-pointer text-left ${
                selectedStatus ? "border-white/30 text-white shadow-white/5" : "border-white/10 text-neutral-300"
              }`}
            >
              <span>
                {ANIME_STATUS.find(s => s.id === selectedStatus)?.label || 'Trạng thái'}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-neutral-500 transition-transform duration-200 ${activeDropdown === 'status' && "rotate-180"}`} />
            </button>
            <AnimatePresence>
              {activeDropdown === 'status' && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-2 min-w-[180px] bg-[#0e0e0e]/98 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 shadow-[0_20px_40px_rgba(0,0,0,0.85)] z-50 flex flex-col gap-0.5"
                >
                  {ANIME_STATUS.map(s => {
                    const isSelected = selectedStatus === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => { setSelectedStatus(s.id); setActiveDropdown(null); }}
                        className={`w-full text-left px-3.5 py-2 text-[13px] font-medium hover:bg-white/10 transition-all flex items-center justify-between rounded-xl cursor-pointer ${
                          isSelected ? "text-white bg-white/5 font-semibold" : "text-gray-400 hover:text-white"
                        }`}
                      >
                        <span>{s.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Dropdown 4: Điểm số (Min Score) */}
          <div className="relative z-20">
            <button
              type="button"
              onClick={() => toggleDropdown('score')}
              className={`flex items-center justify-between gap-2 px-4 py-3 bg-[#121212]/90 hover:bg-[#181818] border rounded-2xl text-xs sm:text-sm font-semibold tracking-wide transition-all cursor-pointer text-left ${
                selectedMinScore ? "border-white/30 text-white shadow-white/5" : "border-white/10 text-neutral-300"
              }`}
            >
              <span>
                {ANIME_SCORES.find(sc => sc.id === selectedMinScore)?.label || 'Điểm số'}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-neutral-500 transition-transform duration-200 ${activeDropdown === 'score' && "rotate-180"}`} />
            </button>
            <AnimatePresence>
              {activeDropdown === 'score' && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-2 min-w-[160px] bg-[#0e0e0e]/98 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 shadow-[0_20px_40px_rgba(0,0,0,0.85)] z-50 flex flex-col gap-0.5"
                >
                  {ANIME_SCORES.map(sc => {
                    const isSelected = selectedMinScore === sc.id;
                    return (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => { setSelectedMinScore(sc.id); setActiveDropdown(null); }}
                        className={`w-full text-left px-3.5 py-2 text-[13px] font-medium hover:bg-white/10 transition-all flex items-center justify-between rounded-xl cursor-pointer ${
                          isSelected ? "text-white bg-white/5 font-semibold" : "text-gray-400 hover:text-white"
                        }`}
                      >
                        <span>{sc.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Reset Trash Bin Button */}
          {hasSearchFilters && (
            <button 
              onClick={handleClearFilters}
              className="p-3 bg-red-650/10 hover:bg-red-650/20 text-red-500 border border-red-500/20 rounded-2xl cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-sm flex items-center justify-center shrink-0 ml-auto z-10"
              title="Đặt lại bộ lọc"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

        </div>
      )}

      {/* Main List Display */}
      <div className="group relative mt-2 min-h-[200px] flex items-center">
        {isLoading ? (
          <div className="flex gap-4 sm:gap-6 overflow-x-hidden pl-[4%] pr-[4%] w-full">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-[140px] sm:w-[180px] h-[200px] sm:h-[260px] bg-neutral-900/50 rounded-2xl animate-pulse border border-white/5 shrink-0" />
            ))}
          </div>
        ) : animes.length === 0 ? (
          <div className="w-full text-center py-16 text-neutral-500 text-sm font-semibold">
            Không tìm thấy bộ Anime nào phù hợp với bộ lọc bạn chọn.
          </div>
        ) : (
          <>
            {/* Left Button */}
            <button 
              onClick={() => scroll('left')}
              className="hidden md:flex absolute left-4 top-[42%] -translate-y-1/2 z-20 w-10 h-10 bg-[#111111]/85 hover:bg-black opacity-0 group-hover:opacity-100 transition-all items-center justify-center hover:scale-105 border border-white/10 rounded-full shadow-2xl active:scale-95 cursor-pointer"
            >
              <ChevronLeft size={20} className="text-white" />
            </button>

            {/* Right Button */}
            <button 
              onClick={() => scroll('right')}
              className="hidden md:flex absolute right-4 top-[42%] -translate-y-1/2 z-20 w-10 h-10 bg-[#111111]/85 hover:bg-black opacity-0 group-hover:opacity-100 transition-all items-center justify-center hover:scale-105 border border-white/10 rounded-full shadow-2xl active:scale-95 cursor-pointer"
            >
              <ChevronRight size={20} className="text-white" />
            </button>

            <div
              ref={scrollRef}
              className="flex gap-4 sm:gap-6 overflow-x-auto py-8 sm:py-12 -my-8 sm:-my-12 pl-[4%] pr-[4%] scrollbar-hide items-center relative z-10 w-full"
              style={{ scrollbarWidth: "none" }}
            >
              {animes.map((anime: any, index: number) => {
                // map anime to Ophim format to reuse RankingCard
                const mappedMovie = {
                  name: anime.title_english || anime.title || anime.title_japanese,
                  origin_name: anime.title || anime.title_japanese,
                  poster_url: anime.images?.webp?.large_image_url || anime.images?.jpg?.large_image_url || null,
                  thumb_url: anime.images?.webp?.large_image_url || anime.images?.jpg?.large_image_url || null,
                  slug: anime.mal_id ? anime.mal_id.toString() : '',
                  year: anime.year?.toString() || anime.aired?.prop?.from?.year?.toString() || "",
                  quality: "HD", // Remove "Finished Airing" status
                  type: anime.type?.toLowerCase() === "movie" ? "single" : "series",
                  category: [],
                  duration: anime.episodes ? `${anime.episodes} tập` : "",
                  tmdb: {
                    vote_average: anime.score
                  }
                };
                
                return (
                  <div key={index} className="flex-none snap-start">
                    <RankingCard movie={mappedMovie} onSelect={() => handleSelect(anime)} idx={index} />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
