import React from 'react';
import { useAnimeDbRanking, useAnimeDbSeasonNow, useAnimeDbUpcoming, useAnimeDbSearch } from '../../hooks/useAnimeDb';
import { RankingCard } from './RankingCard';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';

const TABS = [
  { id: 'ranking', label: 'Bảng Xếp Hạng' },
  { id: 'airing', label: 'Mùa Hiện Tại' },
  { id: 'upcoming', label: 'Sắp Ra Mắt' }
] as const;

const ANIME_GENRES = [
  { id: '', label: 'Genres (Thể loại)' },
  { id: '1', label: 'Action (Hành động)' },
  { id: '2', label: 'Adventure (Phiêu lưu)' },
  { id: '4', label: 'Comedy (Hài hước)' },
  { id: '8', label: 'Drama (Chính kịch)' },
  { id: '10', label: 'Fantasy (Kỳ ảo)' },
  { id: '22', label: 'Romance (Tình cảm)' },
  { id: '24', label: 'Sci-Fi (Viễn tưởng)' },
  { id: '36', label: 'Slice of Life (Đời thường)' },
  { id: '37', label: 'Supernatural (Siêu nhiên)' },
];

const ANIME_TYPES = [
  { id: '', label: 'Type (Loại)' },
  { id: 'tv', label: 'TV Series' },
  { id: 'movie', label: 'Movie (Phim lẻ)' },
  { id: 'ova', label: 'OVA' },
  { id: 'special', label: 'Special' },
  { id: 'ona', label: 'ONA' },
];

const ANIME_STATUS = [
  { id: '', label: 'Status (Trạng thái)' },
  { id: 'airing', label: 'Airing (Đang chiếu)' },
  { id: 'complete', label: 'Complete (Trọn bộ)' },
  { id: 'upcoming', label: 'Upcoming (Sắp chiếu)' },
];

const ANIME_SCORES = [
  { id: '', label: 'Min Score (Điểm tối thiểu)' },
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
        <div className="flex flex-wrap items-center gap-3 px-4 sm:px-8 md:px-12 py-3.5 mb-2 bg-[#0c0c0c]/40 border border-white/[0.03] rounded-2xl mx-4 sm:mx-8 md:mx-12 z-20">
          
          {/* Search Field */}
          <div className="relative flex-grow min-w-[160px] sm:max-w-xs">
            <input 
              type="text" 
              placeholder="Search an Anime..." 
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full px-4 py-2 bg-white/[0.03] hover:bg-white/[0.05] focus:bg-white/[0.07] border border-white/10 focus:border-white/20 rounded-xl text-xs sm:text-sm font-semibold tracking-wide text-white outline-none placeholder:text-neutral-500 transition-all shadow-sm"
            />
          </div>

          {/* Genres Dropdown */}
          <div className="relative shrink-0">
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="appearance-none pr-8 pl-4 py-2 bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 rounded-xl text-xs font-semibold tracking-wide text-neutral-400 hover:text-white outline-none cursor-pointer transition-all shadow-sm bg-[#090909]"
              style={{
                backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundPosition: 'right 10px center',
                backgroundSize: '12px',
                backgroundRepeat: 'no-repeat'
              }}
            >
              {ANIME_GENRES.map(g => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          {/* Type Dropdown */}
          <div className="relative shrink-0">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="appearance-none pr-8 pl-4 py-2 bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 rounded-xl text-xs font-semibold tracking-wide text-neutral-400 hover:text-white outline-none cursor-pointer transition-all shadow-sm bg-[#090909]"
              style={{
                backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundPosition: 'right 10px center',
                backgroundSize: '12px',
                backgroundRepeat: 'no-repeat'
              }}
            >
              {ANIME_TYPES.map(t => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status Dropdown */}
          <div className="relative shrink-0">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="appearance-none pr-8 pl-4 py-2 bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 rounded-xl text-xs font-semibold tracking-wide text-neutral-400 hover:text-white outline-none cursor-pointer transition-all shadow-sm bg-[#090909]"
              style={{
                backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundPosition: 'right 10px center',
                backgroundSize: '12px',
                backgroundRepeat: 'no-repeat'
              }}
            >
              {ANIME_STATUS.map(s => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Min Score Dropdown */}
          <div className="relative shrink-0">
            <select
              value={selectedMinScore}
              onChange={(e) => setSelectedMinScore(e.target.value)}
              className="appearance-none pr-8 pl-4 py-2 bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 rounded-xl text-xs font-semibold tracking-wide text-neutral-400 hover:text-white outline-none cursor-pointer transition-all shadow-sm bg-[#090909]"
              style={{
                backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundPosition: 'right 10px center',
                backgroundSize: '12px',
                backgroundRepeat: 'no-repeat'
              }}
            >
              {ANIME_SCORES.map(sc => (
                <option key={sc.id} value={sc.id}>
                  {sc.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Trash Bin Button */}
          {hasSearchFilters && (
            <button 
              onClick={handleClearFilters}
              className="p-2.5 bg-red-650/10 hover:bg-red-650/20 text-red-500 border border-red-500/20 rounded-xl cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-sm flex items-center justify-center shrink-0 ml-auto"
              title="Reset Filters"
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
