import React from 'react';
import { useAnimeDbRanking, useAnimeDbSearch } from '../../hooks/useAnimeDb';
import { RankingCard } from './RankingCard';
import { ChevronLeft, ChevronRight, Trash2, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const ANIME_GENRES = [
  { id: '', label: 'Tất cả thể loại' },
  { id: '1', label: 'Hành động' },
  { id: '2', label: 'Phiêu lưu' },
  { id: '5', label: 'Phá cách' },
  { id: '46', label: 'Đạt giải' },
  { id: '28', label: 'Đam mỹ' },
  { id: '4', label: 'Hài hước' },
  { id: '8', label: 'Kịch tính' },
  { id: '10', label: 'Kỳ ảo' },
  { id: '26', label: 'Bách hợp' },
  { id: '47', label: 'Ẩm thực' },
  { id: '14', label: 'Kinh dị' },
  { id: '7', label: 'Bí ẩn' },
  { id: '22', label: 'Lãng mạn' },
  { id: '24', label: 'Viễn tưởng' },
  { id: '36', label: 'Đời thường' },
  { id: '30', label: 'Thể thao' },
  { id: '37', label: 'Siêu nhiên' },
  { id: '41', label: 'Ly kỳ' },
  { id: '9', label: 'Gợi cảm' },
  { id: '50', label: 'Nhân vật trưởng thành' },
  { id: '51', label: 'Nhân hóa' },
  { id: '52', label: 'Gái dễ thương' },
  { id: '53', label: 'Chăm trẻ' },
  { id: '54', label: 'Võ đối kháng' },
  { id: '81', label: 'Giả trang' },
  { id: '55', label: 'Bất lương' },
  { id: '39', label: 'Thám tử' },
  { id: '56', label: 'Giáo dục' },
  { id: '57', label: 'Hài bựa' },
  { id: '58', label: 'Máu me' },
  { id: '35', label: 'Harem' },
  { id: '59', label: 'Trò chơi sinh tử' },
  { id: '13', label: 'Lịch sử' },
  { id: '60', label: 'Thần tượng nữ' },
  { id: '61', label: 'Thần tượng nam' },
  { id: '62', label: 'Xuyên không' },
  { id: '63', label: 'Chữa lành' },
  { id: '64', label: 'Tình yêu đa giác' },
  { id: '65', label: 'Biến đổi giới tính' },
  { id: '66', label: 'Ma pháp thiếu nữ' },
  { id: '17', label: 'Võ thuật' },
  { id: '18', label: 'Robot' },
  { id: '67', label: 'Y học' },
  { id: '38', label: 'Quân sự' },
  { id: '19', label: 'Âm nhạc' },
  { id: '6', label: 'Thần thoại' },
  { id: '68', label: 'Tội phạm Mafia' },
  { id: '69', label: 'Văn hóa Otaku' },
  { id: '23', label: 'Học đường' },
  { id: '75', label: 'Giải trí' },
  { id: '29', label: 'Vũ trụ' },
  { id: '11', label: 'Game chiến thuật' },
  { id: '31', label: 'Siêu năng lực' },
  { id: '76', label: 'Sinh tồn' },
  { id: '77', label: 'Thể thao đồng đội' },
  { id: '78', label: 'Du hành thời gian' },
  { id: '32', label: 'Ma cà rồng' },
  { id: '79', label: 'Trò chơi điện tử' },
  { id: '80', label: 'Nghệ thuật thị giác' },
  { id: '48', label: 'Công sở' },
  { id: '82', label: 'Kỳ ảo đô thị' },
  { id: '83', label: 'Ác nữ' },
  { id: '43', label: 'Josei' },
  { id: '15', label: 'Trẻ em' },
  { id: '42', label: 'Seinen' },
  { id: '25', label: 'Shoujo' },
  { id: '27', label: 'Shounen' }
];

const ANIME_TYPES = [
  { id: '', label: 'Tất cả định dạng' },
  { id: 'tv', label: 'Phim bộ' },
  { id: 'movie', label: 'Phim lẻ' },
  { id: 'ova', label: 'OVA' },
  { id: 'special', label: 'Đặc biệt' },
  { id: 'ona', label: 'ONA' },
];

const ANIME_STATUS = [
  { id: '', label: 'Tất cả trạng thái' },
  { id: 'airing', label: 'Đang chiếu' },
  { id: 'complete', label: 'Trọn bộ' },
  { id: 'upcoming', label: 'Sắp chiếu' },
];

const ANIME_SCORES = [
  { id: '', label: 'Tất cả điểm số' },
  { id: '9', label: 'Từ 9.0⭐ trở lên' },
  { id: '8', label: 'Từ 8.0⭐ trở lên' },
  { id: '7', label: 'Từ 7.0⭐ trở lên' },
  { id: '6', label: 'Từ 6.0⭐ trở lên' },
  { id: '5', label: 'Từ 5.0⭐ trở lên' },
];

export const AnimeRankingRow = ({ onSelect, showFilters = false }: { onSelect: (slug: string) => void; showFilters?: boolean }) => {

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
  const { data: rankingData, isLoading: isRankingLoading } = useAnimeDbRanking(1, 15, !hasSearchFilters);
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

  const isLoading = hasSearchFilters ? isSearchLoading : isRankingLoading;
  const animeData = hasSearchFilters ? searchResultsData : rankingData;

  const handleSelect = async (anime: any) => {
    try {
      const { tmdbSearchTv, tmdbSearchMovie } = await import('../../api/tmdbApi');
      const searchQueryText = anime.title || anime.title_english || anime.title_japanese || "";
      const isMovie = anime.type?.toLowerCase() === 'movie';
      
      console.log(
        `%c[ANIME MATCHING] Starting TMDB search for MAL Anime: "${searchQueryText}"`,
        'background: #E50914; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
        {
          malId: anime.mal_id,
          title: anime.title,
          titleEnglish: anime.title_english,
          titleJapanese: anime.title_japanese,
          type: anime.type,
          year: anime.year || anime.aired?.prop?.from?.year
        }
      );

      // Search specific to type
      const res = await (isMovie ? tmdbSearchMovie(searchQueryText) : tmdbSearchTv(searchQueryText));
      
      if (res && res.results && res.results.length > 0) {
        console.log(
          `%c[ANIME MATCHING] TMDB Search Results:`,
          'color: #10B981; font-weight: bold;',
          res.results.map((r: any) => ({
            id: r.id,
            title: r.title || r.name,
            original_language: r.original_language,
            genre_ids: r.genre_ids,
            release_date: r.first_air_date || r.release_date
          }))
        );

        // Find best match: Japanese language and Animation genre (16)
        let matchCriteria = "Year + Japanese + Animation";
        let tmdbItem = res.results.find((r: any) => {
          const rYear = r.first_air_date ? r.first_air_date.split('-')[0] : (r.release_date ? r.release_date.split('-')[0] : null);
          const aYear = anime.year?.toString() || anime.aired?.prop?.from?.year?.toString();
          return rYear === aYear && r.original_language === 'ja' && r.genre_ids?.includes(16);
        });

        if (!tmdbItem) {
          matchCriteria = "Japanese + Animation Only";
          tmdbItem = res.results.find((r: any) => 
            r.original_language === 'ja' && 
            r.genre_ids?.includes(16)
          );
        }

        // Final fallback to first result
        if (!tmdbItem) {
          matchCriteria = "First Available Result Fallback";
          tmdbItem = res.results[0];
        }

        const mediaType = isMovie ? 'movie' : 'tv';
        const slug = `tmdb-${tmdbItem.id}-${mediaType}`;

        console.log(
          `%c[ANIME MATCHING] Match Resolved! Criteria: "${matchCriteria}"`,
          'background: #3B82F6; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
          {
            matchedTitle: tmdbItem.title || tmdbItem.name,
            matchedTmdbId: tmdbItem.id,
            mediaType,
            slug
          }
        );
        onSelect(slug);
      } else {
        console.warn(`%c[ANIME MATCHING] No TMDB results found for keyword: "${searchQueryText}"`, 'color: #EF4444; font-weight: bold;');
        const showAlert = (window as any).showCinemaxAlert || alert;
        showAlert("Nội dung phim này đang được cập nhật lên hệ thống. Vui lòng quay lại sau nhé!");
      }
    } catch (e) {
      console.error(e);
      const showAlert = (window as any).showCinemaxAlert || alert;
      showAlert("Có lỗi xảy ra khi tải thông tin phim. Vui lòng thử lại sau.");
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

  const seenMalIds = new Set();
  const animes = (animeData?.data || animeData?.results || animeData || []).filter((anime: any) => {
    if (!anime.mal_id || seenMalIds.has(anime.mal_id)) return false;
    seenMalIds.add(anime.mal_id);
    return true;
  });

  return (
    <div className="py-6 md:py-8 relative group/row min-h-[380px]">

      {showFilters && (
        <div 
          ref={filterPanelRef}
          className="flex flex-wrap items-center gap-3 px-4 sm:px-8 md:px-12 py-3 mb-5 bg-[#050505] border border-white/5 rounded-xl mx-4 sm:mx-8 md:mx-12 z-30 relative"
        >
          
          {/* Search Field */}
          <div className="relative flex-grow min-w-[160px] sm:max-w-xs z-10">
            <input 
              type="text" 
              placeholder="Tìm kiếm Anime..." 
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#0c0c0c] hover:bg-[#101010] focus:bg-[#121212] border border-white/10 focus:border-white/25 rounded-lg text-xs sm:text-sm font-medium text-white outline-none placeholder:text-neutral-600 transition-all"
            />
          </div>

          {/* Dropdown 1: Thể loại */}
          <div className="relative z-20">
            <button
              type="button"
              onClick={() => toggleDropdown('genre')}
              className={`flex items-center justify-between gap-2 px-3.5 py-2 bg-[#0c0c0c] hover:bg-[#101010] border text-xs sm:text-sm font-medium transition-all cursor-pointer text-left rounded-lg ${
                selectedGenre ? "border-white/30 text-white" : "border-white/10 text-neutral-400 hover:text-white"
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
                  className="absolute top-full left-0 mt-1.5 min-w-[200px] bg-[#080808] border border-white/10 rounded-lg p-1 z-50 max-h-[280px] overflow-y-auto custom-scrollbar flex flex-col gap-0.5"
                >
                  {ANIME_GENRES.map(g => {
                    const isSelected = selectedGenre === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => { setSelectedGenre(g.id); setActiveDropdown(null); }}
                        className={`w-full text-left px-3 py-1.5 text-[13px] font-medium hover:bg-white/5 transition-all flex items-center justify-between rounded-md cursor-pointer ${
                          isSelected ? "text-white bg-white/5 font-medium" : "text-neutral-400 hover:text-white"
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
              className={`flex items-center justify-between gap-2 px-3.5 py-2 bg-[#0c0c0c] hover:bg-[#101010] border text-xs sm:text-sm font-medium transition-all cursor-pointer text-left rounded-lg ${
                selectedType ? "border-white/30 text-white" : "border-white/10 text-neutral-400 hover:text-white"
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
                  className="absolute top-full left-0 mt-1.5 min-w-[180px] bg-[#080808] border border-white/10 rounded-lg p-1 z-50 flex flex-col gap-0.5"
                >
                  {ANIME_TYPES.map(t => {
                    const isSelected = selectedType === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => { setSelectedType(t.id); setActiveDropdown(null); }}
                        className={`w-full text-left px-3 py-1.5 text-[13px] font-medium hover:bg-white/5 transition-all flex items-center justify-between rounded-md cursor-pointer ${
                          isSelected ? "text-white bg-white/5 font-medium" : "text-neutral-400 hover:text-white"
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
              className={`flex items-center justify-between gap-2 px-3.5 py-2 bg-[#0c0c0c] hover:bg-[#101010] border text-xs sm:text-sm font-medium transition-all cursor-pointer text-left rounded-lg ${
                selectedStatus ? "border-white/30 text-white" : "border-white/10 text-neutral-400 hover:text-white"
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
                  className="absolute top-full left-0 mt-1.5 min-w-[180px] bg-[#080808] border border-white/10 rounded-lg p-1 z-50 flex flex-col gap-0.5"
                >
                  {ANIME_STATUS.map(s => {
                    const isSelected = selectedStatus === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => { setSelectedStatus(s.id); setActiveDropdown(null); }}
                        className={`w-full text-left px-3 py-1.5 text-[13px] font-medium hover:bg-white/5 transition-all flex items-center justify-between rounded-md cursor-pointer ${
                          isSelected ? "text-white bg-white/5 font-medium" : "text-neutral-400 hover:text-white"
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
              className={`flex items-center justify-between gap-2 px-3.5 py-2 bg-[#0c0c0c] hover:bg-[#101010] border text-xs sm:text-sm font-medium transition-all cursor-pointer text-left rounded-lg ${
                selectedMinScore ? "border-white/30 text-white" : "border-white/10 text-neutral-400 hover:text-white"
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
                  className="absolute top-full left-0 mt-1.5 min-w-[160px] bg-[#080808] border border-white/10 rounded-lg p-1 z-50 flex flex-col gap-0.5"
                >
                  {ANIME_SCORES.map(sc => {
                    const isSelected = selectedMinScore === sc.id;
                    return (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => { setSelectedMinScore(sc.id); setActiveDropdown(null); }}
                        className={`w-full text-left px-3 py-1.5 text-[13px] font-medium hover:bg-white/5 transition-all flex items-center justify-between rounded-md cursor-pointer ${
                          isSelected ? "text-white bg-white/5 font-medium" : "text-neutral-400 hover:text-white"
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
              className="px-3 py-2 bg-transparent hover:bg-white/5 text-neutral-400 hover:text-red-500 border border-white/10 rounded-lg cursor-pointer transition-all flex items-center justify-center shrink-0 ml-auto z-10 gap-1.5 text-xs font-medium"
              title="Đặt lại bộ lọc"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Đặt lại</span>
            </button>
          )}

        </div>
      )}

      {/* Header & Tabs Toolbar row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4 sm:px-8 md:px-12 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-[3px] h-5 sm:h-6 bg-[#E50914] rounded-full" />
          <h2 className="text-white text-xl sm:text-2xl md:text-[28px] font-bold tracking-tight">
            {hasSearchFilters ? 'Kết Quả Tìm Kiếm Anime' : 'Bảng Xếp Hạng Anime'}
          </h2>
        </div>
      </div>

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
                    <RankingCard movie={mappedMovie} onSelect={() => handleSelect(anime)} idx={index} rowTitle="Bảng xếp hạng Anime" />
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
