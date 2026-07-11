import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "motion/react";
import { 
  Heart, 
  X, 
  RotateCcw, 
  Info, 
  SlidersHorizontal, 
  Flame, 
  Users, 
  User, 
  Play, 
  ChevronRight, 
  RefreshCw, 
  Check, 
  Award,
  Film,
  Tv,
  Star,
  Sparkles
} from "lucide-react";
import { cn } from "../../lib/utils";
import { tmdbDiscover, tmdbGetTrending, fetchTmdb } from "../../api/tmdbApi";
import { useMyList } from "../../hooks/useStorage";

interface MovieSwipeItem {
  id: number;
  title: string;
  name: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  genre_ids: number[];
  media_type: "movie" | "tv";
  slug: string;
}

const GENRES_LIST = [
  { id: 28, label: "Hành Động" },
  { id: 10749, label: "Tình Cảm" },
  { id: 35, label: "Hài Hước" },
  { id: 18, label: "Tâm Lý" },
  { id: 80, label: "Hình Sự" },
  { id: 878, label: "Viễn Tưởng" },
  { id: 27, label: "Kinh Dị" },
  { id: 16, label: "Hoạt Hình" },
  { id: 99, label: "Tài Liệu" },
  { id: 10751, label: "Gia Đình" }
];

export const SwipePage = ({
  onSelect,
  setTab
}: {
  onSelect: (slug: string) => void;
  setTab: (t: string) => void;
}) => {
  const { addToList, myList } = useMyList();

  // If desktop, redirect back to home
  useEffect(() => {
    if (window.innerWidth >= 768) {
      setTab("home");
    }
  }, [setTab]);

  // Settings & Modes
  const [mode, setMode] = useState<"solo" | "couple">("solo");
  const [partnerName, setPartnerName] = useState(() => localStorage.getItem("swipe_partner") || "Bạn ấy");
  const [isSettingPartner, setIsSettingPartner] = useState(false);
  const [tempPartnerName, setTempPartnerName] = useState(partnerName);

  // Filters State
  const [mediaTypeFilter, setMediaTypeFilter] = useState<"all" | "movie" | "tv" | "anime" | "recommend">("all");
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [page, setPage] = useState(1);

  // Cards state
  const [swipedIds, setSwipedIds] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem("cinemax_swipe_swiped_ids");
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  const [movies, setMovies] = useState<MovieSwipeItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<number[]>([]); // stores previous indexes
  const [likedSlugs, setLikedSlugs] = useState<string[]>([]);
  const [stats, setStats] = useState(() => {
    try {
      const stored = localStorage.getItem("cinemax_swipe_stats");
      return stored ? JSON.parse(stored) : { likes: 0, passes: 0 };
    } catch (e) {
      return { likes: 0, passes: 0 };
    }
  });

  // Swipe Feedbacks & Overlays
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | "up" | null>(null);
  const [matchedMovie, setMatchedMovie] = useState<MovieSwipeItem | null>(null);

  // Motion setup for the top card
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  
  // Transform values based on drag distance
  const rotate = useTransform(dragX, [-200, 200], [-25, 25]);
  const cardX = useMotionValue(0);
  const cardY = useMotionValue(0);

  // Opacity of overlays on the card
  const likeOpacity = useTransform(dragX, [0, 100], [0, 1]);
  const nopeOpacity = useTransform(dragX, [-100, 0], [1, 0]);
  const detailOpacity = useTransform(dragY, [-100, 0], [1, 0]);

  // Synchronized styles for the edge buttons during drag
  const xButtonScale = useTransform(dragX, [-120, 0, 120], [1.25, 1, 0.9]);
  const xButtonBg = useTransform(dragX, [-120, 0], ["rgba(239, 68, 68, 0.25)", "rgba(255, 255, 255, 0.1)"]);
  const xButtonBorder = useTransform(dragX, [-120, 0], ["rgba(239, 68, 68, 0.45)", "rgba(255, 255, 255, 0.15)"]);
  const xIconColor = useTransform(dragX, [-120, 0], ["#ef4444", "rgba(255, 255, 255, 0.9)"]);

  const heartButtonScale = useTransform(dragX, [-120, 0, 120], [0.9, 1, 1.25]);
  const heartButtonBg = useTransform(dragX, [0, 120], ["rgba(255, 255, 255, 0.1)", "rgba(239, 68, 68, 0.25)"]);
  const heartButtonBorder = useTransform(dragX, [0, 120], ["rgba(255, 255, 255, 0.15)", "rgba(239, 68, 68, 0.45)"]);
  const heartIconColor = useTransform(dragX, [0, 120], ["rgba(255, 255, 255, 0.9)", "#ef4444"]);
  const heartIconFill = useTransform(dragX, [0, 120], ["rgba(255, 255, 255, 0)", "#ef4444"]);

  // Helper to fetch textless or original language poster from TMDB images list
  const fetchBestPoster = async (id: number, mediaType: "movie" | "tv", originalLanguage?: string): Promise<string | null> => {
    try {
      const data = await fetchTmdb(`/${mediaType}/${id}/images`, { language: 'en-US', include_image_language: 'en,null' });
      if (data && data.posters && data.posters.length > 0) {
        // 1. Look for textless poster (iso_639_1 === null)
        const textless = data.posters.find((p: any) => p.iso_639_1 === null);
        if (textless) return textless.file_path;

        // 2. Look for original language poster (e.g. ko, ja) if not English
        if (originalLanguage && originalLanguage !== 'en') {
          const originalData = await fetchTmdb(`/${mediaType}/${id}/images`, { language: 'en-US', include_image_language: originalLanguage });
          if (originalData && originalData.posters && originalData.posters.length > 0) {
            const original = originalData.posters.find((p: any) => p.iso_639_1 === originalLanguage);
            if (original) return original.file_path;
          }
        }

        // 3. Look for English poster
        const english = data.posters.find((p: any) => p.iso_639_1 === 'en');
        if (english) return english.file_path;
      }
    } catch (e) {
      console.warn(`Failed to fetch images for ${mediaType} ${id}:`, e);
    }
    return null;
  };

  // Load movies from TMDB
  const fetchSwipeMovies = async (reset = false) => {
    setLoading(true);
    try {
      const currentPage = reset ? 1 : page;
      let results: any[] = [];

      if (mediaTypeFilter === "recommend") {
        // Collect liked movie names from myList
        const likedNames = myList.map(item => item.name);
        
        // Collect passed movie names from localStorage
        let passedNames: string[] = [];
        try {
          const stored = localStorage.getItem("cinemax_swipe_passed_titles");
          passedNames = stored ? JSON.parse(stored) : [];
        } catch (e) {}
        
        if (likedNames.length === 0) {
          // If no history, fall back to trending
          const movieTrending = await tmdbGetTrending("movie", "week");
          const tvTrending = await tmdbGetTrending("tv", "week");
          const merged = [
            ...(movieTrending.results || []).map((m: any) => ({ ...m, media_type: "movie" })),
            ...(tvTrending.results || []).map((m: any) => ({ ...m, media_type: "tv" }))
          ];
          results = merged.sort(() => Math.random() - 0.5);
        } else {
          // Fetch recommendations from our backend AI endpoint
          try {
            const resp = await fetch("/api/recommendations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ liked: likedNames, passed: passedNames })
            });
            if (resp.ok) {
              const data = await resp.json();
              results = data.results || [];
            } else {
              throw new Error("Failed to fetch recommendations");
            }
          } catch (e) {
            console.error("AI recommendations failed, falling back to trending:", e);
            // Fallback
            const movieTrending = await tmdbGetTrending("movie", "week");
            const tvTrending = await tmdbGetTrending("tv", "week");
            const merged = [
              ...(movieTrending.results || []).map((m: any) => ({ ...m, media_type: "movie" })),
              ...(tvTrending.results || []).map((m: any) => ({ ...m, media_type: "tv" }))
            ];
            results = merged.sort(() => Math.random() - 0.5);
          }
        }
      } else if (mediaTypeFilter === "all" && selectedGenres.length === 0) {
        // Fetch trending
        const movieTrending = await tmdbGetTrending("movie", "week");
        const tvTrending = await tmdbGetTrending("tv", "week");
        
        // Merge and shuffle
        const merged = [
          ...(movieTrending.results || []).map((m: any) => ({ ...m, media_type: "movie" })),
          ...(tvTrending.results || []).map((m: any) => ({ ...m, media_type: "tv" }))
        ];
        results = merged.sort(() => Math.random() - 0.5);
      } else if (mediaTypeFilter === "anime") {
        // Discover Anime (Animation genre 16 + original language ja)
        const movieAnime = await tmdbDiscover("movie", {
          with_genres: "16",
          with_original_language: "ja",
          page: currentPage
        });
        const tvAnime = await tmdbDiscover("tv", {
          with_genres: "16",
          with_original_language: "ja",
          page: currentPage
        });
        const merged = [
          ...(movieAnime.results || []).map((m: any) => ({ ...m, media_type: "movie" })),
          ...(tvAnime.results || []).map((m: any) => ({ ...m, media_type: "tv" }))
        ];
        results = merged.sort(() => Math.random() - 0.5);
      } else {
        const type = mediaTypeFilter === "all" ? "movie" : mediaTypeFilter;
        const genresParam = selectedGenres.length > 0 ? selectedGenres.join(",") : undefined;
        
        const data = await tmdbDiscover(type as "movie" | "tv", {
          with_genres: genresParam || "",
          page: currentPage,
          sort_by: "popularity.desc"
        });
        results = (data.results || []).map((m: any) => ({ ...m, media_type: type }));
      }

      // Read latest swiped IDs directly from localStorage to avoid stale closures
      let currentSwiped: number[] = [];
      try {
        const stored = localStorage.getItem("cinemax_swipe_swiped_ids");
        currentSwiped = stored ? JSON.parse(stored) : [];
      } catch (e) {}

      // Filter invalid items and fetch best poster paths
      const formatted: MovieSwipeItem[] = await Promise.all(
        results
          .filter((item: any) => item.poster_path && (item.title || item.name) && !currentSwiped.includes(item.id))
          .map(async (item: any) => {
            const mediaType = item.media_type || "movie";
            const bestPoster = await fetchBestPoster(item.id, mediaType, item.original_language);
            return {
              id: item.id,
              title: item.title || item.name || "",
              name: item.name || item.title || "",
              overview: item.overview || "Chưa có tóm tắt tiếng Việt cho phim này.",
              poster_path: bestPoster || item.poster_path,
              backdrop_path: item.backdrop_path || item.poster_path,
              release_date: item.release_date,
              first_air_date: item.first_air_date,
              vote_average: item.vote_average || 0,
              genre_ids: item.genre_ids || [],
              media_type: mediaType,
              slug: `tmdb-${item.id}-${mediaType}`
            };
          })
      );

      if (reset) {
        setMovies(formatted);
        setCurrentIndex(0);
        setHistory([]);
      } else {
        setMovies(prev => [...prev, ...formatted]);
      }
      setPage(currentPage + 1);
    } catch (err) {
      console.error("Error fetching swipe cards:", err);
    } finally {
      setLoading(false);
    }
  };

  // Initial Fetch & Filter Changes
  useEffect(() => {
    fetchSwipeMovies(true);
  }, [mediaTypeFilter, selectedGenres]);

  // Handle Reset Swipe
  const handleResetSwipe = () => {
    localStorage.removeItem("cinemax_swipe_swiped_ids");
    localStorage.removeItem("cinemax_swipe_stats");
    localStorage.removeItem("cinemax_swipe_passed_titles");
    setSwipedIds([]);
    setStats({ likes: 0, passes: 0 });
    setPage(1);
    setTimeout(() => fetchSwipeMovies(true), 0);
  };

  // Handle Swipe logic
  const handleSwipe = (direction: "left" | "right" | "up", movie: MovieSwipeItem) => {
    // Add to swiped IDs
    const nextSwipedIds = [...swipedIds, movie.id];
    setSwipedIds(nextSwipedIds);
    localStorage.setItem("cinemax_swipe_swiped_ids", JSON.stringify(nextSwipedIds));

    if (direction === "right") {
      // Like
      addToList({
        slug: movie.slug,
        name: movie.title || movie.name,
        poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : "",
        thumb_url: movie.backdrop_path ? `https://image.tmdb.org/t/p/w780${movie.backdrop_path}` : ""
      });

      // Dispatch event to animate bottom dock Heart icon!
      window.dispatchEvent(new Event('cinemax_favorite_added'));

      setStats(prev => {
        const next = { ...prev, likes: prev.likes + 1 };
        localStorage.setItem("cinemax_swipe_stats", JSON.stringify(next));
        return next;
      });
      setLikedSlugs(prev => [...prev, movie.slug]);
    } else if (direction === "left") {
      // Pass
      try {
        const stored = localStorage.getItem("cinemax_swipe_passed_titles");
        const parsed = stored ? JSON.parse(stored) : [];
        const nextPassed = Array.from(new Set([...parsed, movie.title || movie.name])).slice(-20);
        localStorage.setItem("cinemax_swipe_passed_titles", JSON.stringify(nextPassed));
      } catch (e) {}

      setStats(prev => {
        const next = { ...prev, passes: prev.passes + 1 };
        localStorage.setItem("cinemax_swipe_stats", JSON.stringify(next));
        return next;
      });
    } else if (direction === "up") {
      // Detail
      onSelect(movie.slug);
      return; // Do not advance card yet
    }

    setHistory(prev => [...prev, currentIndex]);
    setCurrentIndex(prev => prev + 1);

    // Pre-fetch more cards if running low
    if (currentIndex >= movies.length - 5 && !loading) {
      fetchSwipeMovies();
    }
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const lastIndex = history[history.length - 1];
    const prevMovie = movies[lastIndex];

    // Adjust stats
    if (likedSlugs.includes(prevMovie.slug)) {
      setStats(prev => ({ ...prev, likes: Math.max(0, prev.likes - 1) }));
      setLikedSlugs(prev => prev.filter(s => s !== prevMovie.slug));
    } else {
      setStats(prev => ({ ...prev, passes: Math.max(0, prev.passes - 1) }));
    }

    setHistory(prev => prev.slice(0, -1));
    setCurrentIndex(lastIndex);
  };

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFilterOpen || isSettingPartner || matchedMovie) return;
      if (currentIndex >= movies.length) return;

      const currentMovie = movies[currentIndex];
      if (e.key === "ArrowLeft") {
        setSwipeDirection("left");
        setTimeout(() => {
          handleSwipe("left", currentMovie);
          setSwipeDirection(null);
        }, 200);
      } else if (e.key === "ArrowRight") {
        setSwipeDirection("right");
        setTimeout(() => {
          handleSwipe("right", currentMovie);
          setSwipeDirection(null);
        }, 200);
      } else if (e.key === "ArrowUp") {
        handleSwipe("up", currentMovie);
      } else if (e.key === "Space" || e.code === "Space") {
        e.preventDefault();
        onSelect(currentMovie.slug);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, movies, isFilterOpen, isSettingPartner, matchedMovie, mode]);

  const savePartnerName = () => {
    const name = tempPartnerName.trim() || "Bạn ấy";
    setPartnerName(name);
    localStorage.setItem("swipe_partner", name);
    setIsSettingPartner(false);
  };

  const toggleGenre = (genreId: number) => {
    setSelectedGenres(prev => 
      prev.includes(genreId) ? prev.filter(id => id !== genreId) : [...prev, genreId]
    );
  };

  const currentMovie = movies[currentIndex];
  const nextMovie = movies[currentIndex + 1];
  const thirdMovie = movies[currentIndex + 2];

  return (
    <div className="relative h-[calc(100vh-85px)] md:h-auto md:min-h-[calc(100vh-140px)] flex flex-col items-center justify-between pt-4 md:pt-10 pb-[76px] md:pb-12 select-none overflow-hidden max-w-[380px] sm:max-w-[400px] md:max-w-[440px] mx-auto px-4">

      {/* User Welcome Header */}
      <div className="w-full flex items-center justify-between mb-1 px-1 shrink-0">
        <div className="flex flex-col text-left">
          <span className="text-neutral-500 text-[10px] font-bold uppercase tracking-wider">Chào bạn, Cinemaxer!</span>
          <h2 className="text-white text-base font-black tracking-tight leading-tight">Khám phá phim mới</h2>
        </div>
      </div>

      {/* Card stack container */}
      <div className="relative w-full flex-1 min-h-[490px] max-h-[580px] sm:max-h-[610px] md:max-h-[680px] flex items-center justify-center mt-3">
        {loading && movies.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-red-600 animate-spin" />
            <p className="text-neutral-400 text-xs font-medium">Đang tìm kiếm kho phim...</p>
          </div>
        ) : currentIndex >= movies.length ? (
          <div className="flex flex-col items-center justify-center text-center p-6 border border-white/10 rounded-3xl bg-neutral-950/45 backdrop-blur-xl w-full max-w-sm h-full shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-red-600/10 border border-red-600/20 flex items-center justify-center mb-4">
              <Flame className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Hết danh sách phim!</h3>
            <p className="text-xs text-neutral-400 max-w-[240px] leading-relaxed mb-6">
              Bạn đã quẹt hết tất cả gợi ý hiện tại. Hãy đổi bộ lọc hoặc tải thêm để quẹt tiếp.
            </p>
            <div className="flex flex-col gap-2 w-full">
              <button
                onClick={handleResetSwipe}
                className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all text-xs cursor-pointer shadow-lg shadow-red-600/20"
              >
                Tải lại phim
              </button>
              <button
                onClick={() => setIsFilterOpen(true)}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl border border-white/10 transition-all text-xs cursor-pointer"
              >
                Thay đổi bộ lọc
              </button>
            </div>
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Card 3 (Background) */}
            {thirdMovie && (
              <div 
                className="absolute w-[calc(100%-16px)] max-w-[332px] sm:max-w-[350px] md:max-w-[390px] h-full rounded-[28px] border border-white/[0.04] bg-[#0c0c0c] shadow-2xl opacity-35 scale-90 translate-y-6 pointer-events-none select-none overflow-hidden filter blur-[1px] transition-all duration-300"
              />
            )}

            {/* Card 2 (Middle) */}
            {nextMovie && (
              <div 
                className="absolute w-[calc(100%-16px)] max-w-[332px] sm:max-w-[350px] md:max-w-[390px] h-full rounded-[28px] border border-white/[0.06] bg-[#0e0e0e] shadow-2xl opacity-75 scale-95 translate-y-3 pointer-events-none select-none overflow-hidden transition-all duration-300"
              >
                <img
                  src={`https://image.tmdb.org/t/p/w500${nextMovie.poster_path}`}
                  alt=""
                  className="w-full h-full object-cover brightness-50 pointer-events-none"
                />
              </div>
            )}

            {/* Card 1 (Top Active Card) */}
            <AnimatePresence mode="popLayout">
              <motion.div
                key={currentMovie.id}
                style={{
                  x: cardX,
                  y: cardY,
                  rotate,
                  touchAction: "none"
                }}
                drag
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                dragElastic={1}
                onDrag={(e, info) => {
                  dragX.set(info.offset.x);
                  dragY.set(info.offset.y);
                }}
                onDragEnd={(e, info) => {
                  const threshold = 130;
                  const offset = info.offset;
                  if (offset.x > threshold) {
                    // Swipe right
                    cardX.set(500);
                    setTimeout(() => handleSwipe("right", currentMovie), 100);
                  } else if (offset.x < -threshold) {
                    // Swipe left
                    cardX.set(-500);
                    setTimeout(() => handleSwipe("left", currentMovie), 100);
                  } else if (offset.y < -threshold) {
                    // Swipe up (Detail)
                    cardY.set(-600);
                    setTimeout(() => handleSwipe("up", currentMovie), 100);
                  } else {
                    // Reset
                    cardX.set(0);
                    cardY.set(0);
                  }
                  dragX.set(0);
                  dragY.set(0);
                }}
                animate={
                  swipeDirection === "left"
                    ? { x: -500, rotate: -25 }
                    : swipeDirection === "right"
                    ? { x: 500, rotate: 25 }
                    : { x: 0, y: 0, rotate: 0 }
                }
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="absolute w-[calc(100%-16px)] max-w-[332px] sm:max-w-[350px] md:max-w-[390px] h-full rounded-[28px] border border-white/10 bg-[#121212] shadow-[0_24px_50px_rgba(0,0,0,0.85)] cursor-grab active:cursor-grabbing select-none"
              >
                {/* Poster Background */}
                <div className="absolute inset-0 bg-[#0f0f0f] rounded-[28px] overflow-hidden">
                  <img
                    src={`https://image.tmdb.org/t/p/w500${currentMovie.poster_path}`}
                    alt={currentMovie.title}
                    className="w-full h-full object-cover transition-transform duration-700 select-none pointer-events-none"
                    loading="eager"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/85 via-45% to-transparent" />
                </div>

                {/* Score badge top-right */}
                <div className="absolute top-4 right-4 flex items-center gap-1 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 z-30">
                  <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                  <span className="text-[11px] font-bold text-white">
                    {currentMovie.vote_average.toFixed(1)}
                  </span>
                </div>

                {/* Drag status indicators overlays */}
                <motion.div 
                  style={{ opacity: likeOpacity }}
                  className="absolute top-12 left-6 border-4 border-green-500 text-green-500 font-black text-3xl tracking-widest px-4 py-1.5 rounded-xl uppercase rotate-[-12deg] pointer-events-none select-none shadow-2xl bg-black/30 z-35"
                >
                  LIKE
                </motion.div>
                <motion.div 
                  style={{ opacity: nopeOpacity }}
                  className="absolute top-12 right-6 border-4 border-red-500 text-red-500 font-black text-3xl tracking-widest px-4 py-1.5 rounded-xl uppercase rotate-[12deg] pointer-events-none select-none shadow-2xl bg-black/30 z-35"
                >
                  NOPE
                </motion.div>
                <motion.div 
                  style={{ opacity: detailOpacity }}
                  className="absolute bottom-32 left-1/2 -translate-x-1/2 border-4 border-blue-500 text-blue-500 font-black text-2xl tracking-widest px-5 py-1.5 rounded-xl uppercase pointer-events-none select-none shadow-2xl bg-black/30 z-35"
                >
                  CHI TIẾT
                </motion.div>

                {/* Float Undo button if history exists */}
                {history.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUndo();
                    }}
                    className="absolute top-4 left-4 z-40 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-yellow-500 flex items-center justify-center cursor-pointer active:scale-90 hover:bg-black/85 transition-all pointer-events-auto"
                    title="Quay lại phim trước"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}

                {/* Integrated Action Buttons on Left/Right edges */}
                <motion.button
                  style={{
                    scale: xButtonScale,
                    backgroundColor: xButtonBg,
                    borderColor: xButtonBorder,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSwipeDirection("left");
                    setTimeout(() => {
                      handleSwipe("left", currentMovie);
                      setSwipeDirection(null);
                    }, 200);
                  }}
                  className="absolute left-[-18px] top-1/2 -translate-y-1/2 z-40 w-11 h-11 rounded-full backdrop-blur-md border shadow-[0_8px_32px_rgba(0,0,0,0.37)] flex items-center justify-center cursor-pointer active:scale-90 hover:scale-105 transition-all duration-300 pointer-events-auto"
                  title="Bỏ qua (Quẹt trái)"
                >
                  <motion.div style={{ color: xIconColor }} className="flex items-center justify-center">
                    <X className="w-5 h-5" color="currentColor" strokeWidth={2.5} />
                  </motion.div>
                </motion.button>

                <motion.button
                  style={{
                    scale: heartButtonScale,
                    backgroundColor: heartButtonBg,
                    borderColor: heartButtonBorder,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSwipeDirection("right");
                    setTimeout(() => {
                      handleSwipe("right", currentMovie);
                      setSwipeDirection(null);
                    }, 200);
                  }}
                  className="absolute right-[-18px] top-1/2 -translate-y-1/2 z-40 w-11 h-11 rounded-full backdrop-blur-md border shadow-[0_8px_32px_rgba(0,0,0,0.37)] flex items-center justify-center cursor-pointer active:scale-90 hover:scale-105 transition-all duration-300 pointer-events-auto"
                  title="Yêu thích (Quẹt phải)"
                >
                  <motion.div 
                    style={{ color: heartIconColor, fill: heartIconFill }} 
                    className="flex items-center justify-center"
                  >
                    <Heart className="w-5 h-5" color="currentColor" fill="currentColor" strokeWidth={2.5} />
                  </motion.div>
                </motion.button>

                {/* Movie Infos at the Bottom */}
                <div className="absolute bottom-0 left-0 w-full p-5 flex flex-col justify-end text-left pointer-events-none z-30">
                  <div className="flex items-center justify-between w-full">
                    {/* Category Type Badge */}
                    <span className="text-[9px] font-black tracking-widest text-[#E50914] uppercase bg-[#E50914]/10 border border-[#E50914]/20 px-2 py-0.5 rounded-full w-max">
                      {currentMovie.media_type === "movie" ? "PHIM LẺ" : "PHIM BỘ"}
                    </span>

                    {/* Detail Info button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(currentMovie.slug);
                      }}
                      className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 flex items-center justify-center text-blue-400 cursor-pointer pointer-events-auto transition-all active:scale-90"
                      title="Xem chi tiết"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Title & Year */}
                  <h2 className="text-white text-lg font-bold tracking-tight drop-shadow leading-tight mt-1.5 truncate">
                    {currentMovie.title || currentMovie.name}
                  </h2>
                  
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-neutral-300">
                    {currentMovie.release_date && (
                      <span className="font-semibold text-neutral-400">
                        {currentMovie.release_date.split("-")[0]}
                      </span>
                    )}
                    {currentMovie.first_air_date && (
                      <span className="font-semibold text-neutral-400">
                        {currentMovie.first_air_date.split("-")[0]}
                      </span>
                    )}
                    <span className="w-1 h-1 bg-white/20 rounded-full" />
                    
                    {/* Render matching genre labels as text */}
                    <span className="truncate">
                      {currentMovie.genre_ids
                        .map(id => GENRES_LIST.find(g => g.id === id)?.label)
                        .filter(Boolean)
                        .slice(0, 2)
                        .join(", ")}
                    </span>
                  </div>

                  {/* Summary / Description */}
                  <p className="text-neutral-400 text-[10px] leading-relaxed line-clamp-2 mt-2 font-normal opacity-90 drop-shadow">
                    {currentMovie.overview}
                  </p>

                  {/* Render matching genre labels as pill tags */}
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {currentMovie.genre_ids
                      .map(id => GENRES_LIST.find(g => g.id === id)?.label)
                      .filter(Boolean)
                      .slice(0, 3)
                      .map((label, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-md text-[9px] font-bold text-white/90 border border-white/5">
                          {label}
                        </span>
                      ))}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Stats bar */}
      {movies.length > 0 && currentIndex < movies.length && (
        <div className="flex items-center gap-4 text-[10px] text-neutral-500 font-bold tracking-wider uppercase mt-1.5 shrink-0">
          <span>Đã thích: {stats.likes}</span>
          <span className="w-1 h-1 bg-neutral-700 rounded-full" />
          <span>Đã qua: {stats.passes}</span>
        </div>
      )}

      {/* Setup Partner Modal */}
      <AnimatePresence>
        {isSettingPartner && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0c0c0c] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative"
            >
              <h3 className="text-base font-bold text-white mb-1.5 flex items-center gap-2">
                <Users className="w-4 h-4 text-red-500" />
                <span>Cấu hình tên cặp đôi</span>
              </h3>
              <p className="text-[11px] text-neutral-400 leading-relaxed mb-4">
                Nhập tên của người quẹt chung với bạn. Hệ thống sẽ mô phỏng quyết định của người ấy để tìm ra phim mà cả hai cùng thích!
              </p>

              <input
                type="text"
                value={tempPartnerName}
                onChange={(e) => setTempPartnerName(e.target.value)}
                placeholder="Ví dụ: Người thương, Gấu, Lan..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 transition-all mb-5"
              />

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsSettingPartner(false)}
                  className="flex-1 py-2 text-neutral-400 hover:text-white font-bold rounded-lg border border-white/5 transition-all text-xs cursor-pointer"
                >
                  Bỏ qua
                </button>
                <button
                  onClick={savePartnerName}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-all text-xs cursor-pointer shadow-lg"
                >
                  Lưu thiết lập
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Filter Modal */}
      <AnimatePresence>
        {isFilterOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0c0c0c] border border-white/10 rounded-2xl p-6 max-w-sm w-full max-h-[85vh] overflow-y-auto custom-scrollbar shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3.5 mb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-red-500" />
                  <span>Bộ lọc phim gợi ý</span>
                </h3>
                <button 
                  onClick={() => setIsFilterOpen(false)}
                  className="p-1 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Section: AI Recommendations */}
              <div className="mb-5">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-2">Gợi ý cá nhân hóa</span>
                <button
                  onClick={() => {
                    const nextMode = mediaTypeFilter === "recommend" ? "all" : "recommend";
                    setMediaTypeFilter(nextMode);
                  }}
                  className={cn(
                    "w-full py-3 px-4 rounded-xl border text-xs font-bold transition-all duration-300 flex items-center justify-between cursor-pointer",
                    mediaTypeFilter === "recommend"
                      ? "bg-gradient-to-r from-red-600/20 to-purple-600/20 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
                      : "bg-white/5 border-white/10 text-neutral-400 hover:text-white hover:border-white/20"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className={cn("w-4 h-4", mediaTypeFilter === "recommend" ? "text-red-400 animate-pulse" : "text-neutral-400")} />
                    <span>Gợi ý thông minh (Gemini AI)</span>
                  </div>
                  {mediaTypeFilter === "recommend" && (
                    <span className="text-[9px] bg-red-600 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                      ĐANG BẬT
                    </span>
                  )}
                </button>
                {mediaTypeFilter === "recommend" && (
                  <p className="text-[10px] text-neutral-500 mt-1.5 px-1 leading-relaxed">
                    * AI sẽ phân tích danh sách phim bạn đã thích và đã qua để gợi ý các phim phù hợp nhất.
                  </p>
                )}
              </div>

              {/* Section: Media Type */}
              <div className="mb-5">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-2">Loại Phim</span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "all", label: "Tất cả", icon: Film },
                    { id: "movie", label: "Phim Lẻ", icon: Film },
                    { id: "tv", label: "Phim Bộ", icon: Tv },
                    { id: "anime", label: "Anime", icon: Flame }
                  ].map(item => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setMediaTypeFilter(item.id as any)}
                        disabled={mediaTypeFilter === "recommend"}
                        className={cn(
                          "py-2 px-3 rounded-xl border text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
                          mediaTypeFilter === item.id 
                            ? "bg-red-600/10 border-red-500 text-red-400" 
                            : "bg-white/5 border-white/10 text-neutral-400 hover:text-white"
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section: Genres */}
              {mediaTypeFilter !== "anime" && mediaTypeFilter !== "recommend" && (
                <div className="mb-6">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-2">Thể Loại</span>
                  <div className="flex flex-wrap gap-1.5">
                    {GENRES_LIST.map(genre => {
                      const isSelected = selectedGenres.includes(genre.id);
                      return (
                        <button
                          key={genre.id}
                          onClick={() => toggleGenre(genre.id)}
                          className={cn(
                            "py-1.5 px-3 rounded-full text-xs font-medium border transition-all cursor-pointer",
                            isSelected 
                              ? "bg-red-600 border-red-500 text-white font-bold" 
                              : "bg-white/5 border-white/10 text-neutral-400 hover:text-white"
                          )}
                        >
                          {genre.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedGenres([]);
                    setMediaTypeFilter("all");
                  }}
                  className="flex-1 py-2.5 text-neutral-400 hover:text-white border border-white/5 hover:bg-white/5 font-bold rounded-xl transition-all text-xs cursor-pointer"
                >
                  Xoá bộ lọc
                </button>
                <button
                  onClick={() => {
                    setIsFilterOpen(false);
                    setPage(1);
                    fetchSwipeMovies(true);
                  }}
                  className="flex-1 py-2.5 bg-[#E50914] hover:bg-red-500 text-white font-bold rounded-xl transition-all text-xs cursor-pointer shadow-lg"
                >
                  Áp dụng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
