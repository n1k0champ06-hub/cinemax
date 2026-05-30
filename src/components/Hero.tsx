import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { Play, Info, Plus, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useTmdbTrending } from "../hooks/useTmdb";
import { SafeImage } from "./ui/ImageShimmer";
import { tmdbGetTrending, tmdbDiscover } from "../api/tmdbApi";

export const Hero = ({
  type = "home",
  onSelect,
  setTab,
  onShowSearch,
  onScrollDown,
}: {
  type?: string;
  onSelect?: (slug: string) => void;
  onScrollDown?: () => void;
  setTab?: (t: string) => void;
  onShowSearch?: () => void;
}) => {
  const { data: trendingData, isLoading: isTrendingLoading } = useQuery({
    queryKey: ['tmdb', 'hero-trending', type],
    queryFn: async () => {
      if (type === 'phim-bo') {
        const res = await tmdbGetTrending('tv', 'week');
        return {
          results: (res?.results || []).map((v: any) => ({ ...v, media_type: 'tv' }))
        };
      } else if (type === 'phim-le') {
        const res = await tmdbGetTrending('movie', 'week');
        return {
          results: (res?.results || []).map((v: any) => ({ ...v, media_type: 'movie' }))
        };
      } else if (type === 'hoat-hinh' || type === 'anime') {
        const tvUrl = await tmdbDiscover('tv', {
          with_genres: '16',
          with_original_language: 'ja',
          sort_by: 'popularity.desc',
          'vote_count.gte': 8
        });
        const movieUrl = await tmdbDiscover('movie', {
          with_genres: '16',
          with_original_language: 'ja',
          sort_by: 'popularity.desc',
          'vote_count.gte': 8
        });
        
        const combined = [
          ...(tvUrl?.results || []).map((v: any) => ({ ...v, media_type: 'tv' })),
          ...(movieUrl?.results || []).map((v: any) => ({ ...v, media_type: 'movie' }))
        ].sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0));

        return {
          results: combined
        };
      } else {
        return tmdbGetTrending('all', 'week');
      }
    },
    staleTime: 15 * 60 * 1000,
  });
  const [currentIndex, setCurrentIndex] = useState(0);

  const maxItems = trendingData?.results ? Math.min(trendingData.results.length, 10) : 0;
  const activeMovie = trendingData?.results?.[currentIndex];

  // Fetch full details of active trending slide to pull English logo backdrops
  const { data: tmdbDetails } = useQuery({
    queryKey: ['tmdb', 'details', activeMovie?.media_type || 'movie', activeMovie?.id],
    queryFn: async () => {
      const { tmdbGetMovieDetails, tmdbGetTvDetails } = await import('../api/tmdbApi');
      return (activeMovie?.media_type === 'tv') ? tmdbGetTvDetails(activeMovie.id) : tmdbGetMovieDetails(activeMovie.id);
    },
    enabled: !!activeMovie?.id,
    staleTime: 1000 * 60 * 15, // 15 minutes cache
  });

  // Slider Auto rotation
  useEffect(() => {
    if (!maxItems) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % maxItems);
    }, 9000);
    return () => clearInterval(interval);
  }, [maxItems, currentIndex]);

  if (isTrendingLoading || !activeMovie) {
    return (
      <div className="relative h-screen h-[100dvh] min-h-[550px] w-full overflow-hidden bg-[#050505] flex items-center justify-center">
        {/* Top Slim Crimson Loading Progress Bar */}
        <div className="absolute top-0 left-0 h-[2.5px] bg-[#E50914] shadow-[0_0_8px_#E50914] animate-[shimmer_2s_infinite_linear]" style={{ width: "65%" }} />
        
        <span className="text-[10px] sm:text-xs font-mono tracking-[0.3em] text-gray-400 font-semibold uppercase animate-pulse select-none">
          Đang tải dữ liệu...
        </span>
      </div>
    );
  }

  const isDetailsForActiveMovie = tmdbDetails && String(tmdbDetails.id) === String(activeMovie.id);

  // 1. Check if we have an English backdrop (this was used before, but now we prefer textless backdrop + logo overlay)
  const englishBackdropFile = isDetailsForActiveMovie ? tmdbDetails?.images?.backdrops?.find((b: any) => b.iso_639_1 === 'en')?.file_path : null;
  const englishBackdropUrl = englishBackdropFile ? `https://image.tmdb.org/t/p/original/${englishBackdropFile}` : null;

  // 2. Main backdrop image choice (Standard textless backdrop is preferred since we are overlaying the logo)
  const bgImage = activeMovie.backdrop_path ? (activeMovie.backdrop_path.startsWith('http') ? activeMovie.backdrop_path : `https://image.tmdb.org/t/p/original/${activeMovie.backdrop_path.split('/').pop()}`) : englishBackdropUrl || activeMovie.poster_path;
  
  // 3. Official transparent logo overlay
  const logoFile = isDetailsForActiveMovie ? tmdbDetails?.images?.logos?.find((l: any) => l.iso_639_1 === 'en' || l.iso_639_1 === 'vi' || !l.iso_639_1)?.file_path : null;
  const logoUrl = logoFile ? `https://image.tmdb.org/t/p/w500/${logoFile}` : null;

  const handleNext = () => setCurrentIndex((prev) => (prev + 1) % maxItems);
  const handlePrev = () => setCurrentIndex((prev) => (prev - 1 + maxItems) % maxItems);

  const titleString = activeMovie.title || activeMovie.name || activeMovie.original_name || activeMovie.original_title || '';
  const description = (isDetailsForActiveMovie && tmdbDetails?.overview) || activeMovie.overview || 'Trải nghiệm siêu phẩm điện ảnh đỉnh cao, tích hợp server truyền tải tốc độ nhanh mượt hôm nay.';
  const dateString = activeMovie.release_date?.split('-')[0] || activeMovie.first_air_date?.split('-')[0] || activeMovie.year || '2026';
  
  const ratingVal = activeMovie.vote_average || 8.0;
  const roundedRating = ratingVal.toFixed(1);
  const starCount = Math.round(ratingVal / 2);

  const activeSlug = `tmdb-${activeMovie.id}-${activeMovie.media_type || 'movie'}`;

  return (
    <div className="relative h-screen h-[100dvh] min-h-[550px] w-full overflow-hidden bg-[#050505]">
      {/* 1. Backdrop Background Crossfade */}
      <AnimatePresence mode="popLayout">
        <motion.div 
          key={`slide-${currentIndex}`}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.0, ease: "easeInOut" }}
          className="absolute inset-0 h-full w-full z-0 overflow-hidden bg-black"
        >
          <SafeImage src={bgImage || ''} alt={titleString} className="w-full h-full object-cover opacity-100 lg:opacity-90 pointer-events-none select-none" />
        </motion.div>
      </AnimatePresence>

      {/* 2. Elite Ambient Dark Gradients (Netflix layout overlays to protect typography readability) */}
      <div 
        className="absolute inset-x-0 -bottom-px h-[65%] lg:h-full z-10 pointer-events-none"
        style={{
          background: 'linear-gradient(to top, #050505 0%, rgba(5, 5, 5, 0.9) 15%, rgba(5, 5, 5, 0.4) 50%, transparent 100%)'
        }}
      />
      <div className="absolute inset-y-0 left-0 w-full lg:w-[65%] bg-gradient-to-r from-[#050505]/90 via-[#050505]/35 to-transparent z-10 pointer-events-none" />

      {/* 4. Left-Aligned Premium Information Block */}
      <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-end pb-12 sm:pb-16 lg:pb-24 px-6 sm:px-12 lg:px-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -15 }} 
            transition={{ duration: 0.4 }}
            className="flex flex-col space-y-4 max-w-full sm:max-w-xl lg:max-w-3xl pointer-events-auto text-left items-start"
          >
            {/* Official English Title Artwork Logo or Large Text-Fallback */}
            {logoUrl ? (
              <div className="max-w-[80%] sm:max-w-[70%] lg:max-w-[420px] aspect-[16/7] relative flex items-end justify-start pointer-events-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.85)] filter brightness-115">
                <SafeImage src={logoUrl} alt={titleString} className="max-h-full max-w-full object-contain object-left origin-left scale-95" />
              </div>
            ) : (
              <h1 
                className="text-2xl sm:text-4xl lg:text-5xl font-black text-white leading-tight drop-shadow-2xl tracking-tighter uppercase select-none line-clamp-2 max-w-[95%] text-left"
                style={{ fontFamily: '"Space Grotesk", sans-serif' }}
              >
                {titleString}
              </h1>
            )}

            {/* Movie Badges: Stars, Rating, Year */}
            <div className="flex items-center gap-2.5 text-[11px] sm:text-xs md:text-sm font-semibold text-gray-300 drop-shadow-md select-none flex-wrap">
              <div className="flex items-center text-yellow-500 gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className={i < starCount ? "text-yellow-500 text-xs sm:text-sm md:text-base" : "text-white/20 text-xs sm:text-sm md:text-base"}>★</span>
                ))}
              </div>
              <span className="text-white font-bold">{roundedRating} IMDb</span>
              <span className="text-white/40">•</span>
              <span>{dateString}</span>
              <span className="text-white/40">•</span>
              <span className="px-1.5 py-0.5 text-[9px] bg-white/15 rounded text-white font-black tracking-wider uppercase border border-white/10 shadow-sm leading-none">HD PRO</span>
            </div>

            {/* Synopsis Overview: Hidden on mobile to fulfill "no description on phone" requirement */}
            <p className="hidden sm:block text-white/80 text-xs sm:text-sm md:text-base lg:text-lg font-medium drop-shadow-lg w-[95%] md:w-[90%] leading-relaxed max-h-[120px] overflow-hidden line-clamp-3">
              {description}
            </p>

            {/* Functional Buttons: Styled elegantly, neat and compact */}
            <div className="flex items-center justify-start gap-3 pt-1 md:pt-2 w-full">
              {/* Play Button */}
              <button 
                onClick={() => onSelect && onSelect(activeSlug)} 
                className="flex items-center justify-center gap-2 bg-white hover:bg-neutral-200 active:scale-[0.97] text-black px-6 py-2.5 md:px-8 md:py-3 rounded-full font-bold text-sm md:text-base transition-all shadow-xl cursor-pointer hover:shadow-black/20"
              >
                <Play className="w-4 h-4 md:w-5 md:h-5 fill-current text-black" />
                <span>Xem Ngay</span>
              </button>

              {/* Detail Info Button */}
              <button 
                onClick={() => onSelect && onSelect(activeSlug)}
                className="flex items-center justify-center gap-2 bg-black/40 hover:bg-black/60 active:scale-[0.97] border border-white/10 hover:border-white/20 text-white px-6 py-2.5 md:px-8 md:py-3 rounded-full font-bold text-sm md:text-base transition-all cursor-pointer shadow-lg"
              >
                <Info className="w-4 h-4 md:w-5 md:h-5" />
                <span>Chi Tiết</span>
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
};
