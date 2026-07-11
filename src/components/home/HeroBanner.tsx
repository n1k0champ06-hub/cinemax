import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Volume2, VolumeX, ChevronLeft, ChevronRight, Loader2, ArrowRight, Info } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '../../lib/utils';
import { fetchMultiSource } from '../../api/phimApi';
import { useTmdbSearch } from '../../hooks/useTmdb';
import { SafeImage, HeroShimmer } from '../ui/ImageShimmer';

export const HeroBanner = ({ onSelect }: { onSelect: (slug: string) => void }) => {
  const { data, isLoading } = useQuery({ 
    queryKey: ["movies", "phim-moi-cap-nhat"], 
    queryFn: () => fetchMultiSource("phim-moi-cap-nhat"),
    staleTime: 24 * 60 * 60 * 1000,
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(true);

  const heroMovie = data?.[currentIndex];
  // Determine if it's a TV show or Movie based on phimAPI category list
  const maybeTv = heroMovie?.type === 'series' || heroMovie?.type === 'hoathinh';
  const { data: tmdbSearch } = useTmdbSearch(heroMovie?.origin_name || heroMovie?.name || '', maybeTv ? 'tv' : 'movie', 1);
  const tmdbMeta = tmdbSearch?.results?.[0];
  
  const { data: tmdbDetails } = useQuery({
    queryKey: ['tmdb', 'details', maybeTv ? 'tv' : 'movie', tmdbMeta?.id],
    queryFn: async () => {
      const { tmdbGetMovieDetails, tmdbGetTvDetails } = await import('../../api/tmdbApi');
      return maybeTv ? tmdbGetTvDetails(tmdbMeta?.id) : tmdbGetMovieDetails(tmdbMeta?.id);
    },
    enabled: !!tmdbMeta?.id,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const maxItems = data ? Math.min(data.length, 10) : 0;

  useEffect(() => {
    setShowVideo(false);
    if (!data?.length) return;
    
    // Auto-slide 
    let interval: NodeJS.Timeout | null = null;
    interval = setInterval(() => setCurrentIndex((prev) => (prev + 1) % maxItems), 7000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [data, currentIndex, maxItems]);
  
  if (isLoading || !data?.length || !heroMovie) {
    return <HeroShimmer />;
  }

  const handleNext = () => setCurrentIndex((prev) => (prev + 1) % maxItems);
  const handlePrev = () => setCurrentIndex((prev) => (prev - 1 + maxItems) % maxItems);

  const isDetailsForActiveMovie = tmdbDetails && tmdbMeta && String(tmdbDetails.id) === String(tmdbMeta.id);

  const localizedHero = React.useMemo(() => {
    if (!tmdbDetails || !isDetailsForActiveMovie) return null;
    const translations = tmdbDetails.translations?.translations || [];
    const vi = translations.find((t: any) => t.iso_639_1 === 'vi')?.data;
    const en = translations.find((t: any) => t.iso_639_1 === 'en')?.data;

    const hasVi = vi && (vi.title || vi.name);
    const title = hasVi
      ? (vi.title || vi.name)
      : (en?.title || en?.name || tmdbDetails.title || tmdbDetails.name);

    const overview = hasVi
      ? vi.overview
      : (en?.overview || tmdbDetails.overview);

    return { title, overview, hasVi: !!hasVi };
  }, [tmdbDetails, isDetailsForActiveMovie]);

  const displayName = localizedHero?.title || heroMovie.name;

  // Prioritize English or textless backdrops from images list over the default backdrop_path
  const bestBackdropFile = isDetailsForActiveMovie ? (tmdbDetails?.images?.backdrops?.[0]?.file_path || tmdbDetails?.backdrop_path) : null;
  const bestBackdropUrl = bestBackdropFile 
    ? (bestBackdropFile.startsWith('http') ? bestBackdropFile : `https://image.tmdb.org/t/p/original/${bestBackdropFile.split('/').pop()}`) 
    : null;

  const bgImage = bestBackdropUrl || (tmdbMeta?.backdrop_path ? (tmdbMeta.backdrop_path?.startsWith('http') ? tmdbMeta.backdrop_path : `https://image.tmdb.org/t/p/original/${tmdbMeta.backdrop_path?.split('/').pop()}`) : null) || heroMovie.thumb_url || heroMovie.poster_url;
  // Official transparent logo overlay (prioritize English, fallback to neutral, Japanese, Korean, Vietnamese)
  const logoFile = isDetailsForActiveMovie
    ? (tmdbDetails?.images?.logos?.find((l: any) => l.iso_639_1 === 'en')?.file_path ||
       tmdbDetails?.images?.logos?.find((l: any) => !l.iso_639_1)?.file_path ||
       tmdbDetails?.images?.logos?.find((l: any) => l.iso_639_1 === 'ja')?.file_path ||
       tmdbDetails?.images?.logos?.find((l: any) => l.iso_639_1 === 'ko')?.file_path ||
       tmdbDetails?.images?.logos?.find((l: any) => l.iso_639_1 === 'vi')?.file_path)
    : null;
  const logoUrl = logoFile ? `https://image.tmdb.org/t/p/w500/${logoFile}` : null;

  const description = localizedHero?.overview || (isDetailsForActiveMovie && tmdbDetails?.overview) || tmdbMeta?.overview || (typeof heroMovie.origin_name === 'string' && heroMovie.origin_name !== heroMovie.name ? heroMovie.origin_name : 'Trải nghiệm những bộ phim mới nhất và hấp dẫn nhất. Xem ngay hôm nay!');

  const dateString = heroMovie?.year || '';

  const ratingVal = tmdbMeta?.vote_average || 8.0;
  const roundedRating = ratingVal.toFixed(1);
  const starCount = Math.round(ratingVal / 2);

  return (
    <div className="relative h-[65dvh] min-h-[460px] lg:h-[80vh] lg:min-h-0 w-full overflow-hidden bg-[#050505] group">
      <AnimatePresence mode="popLayout">
        <motion.div 
          key={`img-${currentIndex}`}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing z-0 overflow-hidden bg-black"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(e, { offset }) => {
            if (offset.x < -50) handleNext();
            else if (offset.x > 50) handlePrev();
          }}
        >
          <SafeImage priority={true} src={bgImage || ''} alt={displayName} className="w-full h-full object-cover opacity-100 lg:opacity-90 pointer-events-none fade-in" />
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {/* Removed Youtube trailer */}
      </AnimatePresence>

      {/* Modern, Immersive Cinematic Vignette Overlays for both Mobile & Desktop */}
      <div 
        className="absolute inset-x-0 -bottom-px h-[60%] lg:h-full z-10 pointer-events-none"
        style={{
          background: 'linear-gradient(to top, #050505 0%, rgba(5, 5, 5, 0.9) 15%, rgba(5, 5, 5, 0.4) 50%, transparent 100%)'
        }}
      />
      <div className="absolute inset-y-0 left-0 w-full lg:w-[60%] bg-gradient-to-r from-[#050505]/90 via-[#050505]/50 to-transparent z-10 pointer-events-none" />
      
      {/* Primary Content Container */}
      <div className="absolute inset-0 z-30 pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div 
            key={currentIndex} 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -20 }} 
            transition={{ duration: 0.5 }}
            className="w-full h-full flex flex-col justify-end pb-12 sm:pb-20 lg:pb-32 lg:px-24 pointer-events-none"
          >
            <div className="flex flex-col space-y-4 w-full px-6 lg:px-0 lg:max-w-2xl xl:max-w-4xl pointer-events-auto items-stretch md:items-start text-center md:text-left">
              
              {/* Cinematic Red Tagline Badge (Hidden on mobile) */}
              <div className="hidden md:flex items-center gap-2">
                <span className="text-[10px] sm:text-xs font-black tracking-[0.25em] text-[#e50914] uppercase drop-shadow-md">
                  ★ Phim Mới Cập Nhật Độc Quyền
                </span>
              </div>

              {/* Official Logo or Fallback Plain Text Title */}
              {logoUrl ? (
                <div className="max-w-[75%] sm:max-w-[65%] md:max-w-[420px] aspect-[16/7] relative flex items-center justify-center md:justify-start mx-auto md:mx-0 pointer-events-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.85)] filter brightness-110">
                  <SafeImage src={logoUrl} alt={displayName} className="max-h-full max-w-full object-contain object-center md:object-left scale-95 origin-center md:origin-left" />
                </div>
              ) : (
                <h1 className="text-3xl sm:text-5xl lg:text-3xl xl:text-5xl font-sans font-black text-white leading-tight drop-shadow-2xl tracking-tighter uppercase line-clamp-2 text-center md:text-left mx-auto md:mx-0">
                  {displayName}
                </h1>
              )}

              {/* Styled Stars and Rating Area (Hidden on mobile) */}
              <div className="hidden md:flex items-center gap-2.5 text-xs sm:text-sm font-semibold tracking-wide text-gray-300 drop-shadow-md">
                <div className="flex items-center text-yellow-500 mr-1 gap-0.5">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <span key={idx} className={idx < starCount ? "text-yellow-500 text-sm sm:text-base" : "text-white/20 text-sm sm:text-base"}>★</span>
                  ))}
                </div>
                <span className="text-white font-bold">{roundedRating} / 10</span>
                <span className="text-white/40 font-normal">•</span>
                <span>{dateString || "2026"}</span>
                <span className="text-white/40 font-normal">•</span>
                <span className="px-1.5 py-0.5 text-[9px] bg-white/15 rounded text-white font-black tracking-wider uppercase border border-white/10">HD PRO</span>
              </div>
              
              {/* Synopsis/Overview */}
              <p className="hidden md:block text-white/80 text-lg xl:text-xl line-clamp-[4] max-h-[175px] overflow-hidden font-medium drop-shadow-lg w-[85%] leading-relaxed">
                {description}
              </p>
              
              {/* Red-accented custom buttons */}
              <div className="flex items-center justify-center md:justify-start gap-3 pt-2">
                <button 
                  onClick={() => typeof heroMovie.slug === 'string' && onSelect(heroMovie.slug)} 
                  className="flex items-center justify-center gap-2 bg-[#e50914] hover:bg-[#ff1e24] active:scale-[0.97] text-white px-5 py-2.5 md:px-8 md:py-3.5 rounded-xl font-bold text-base md:text-lg transition-all shadow-lg cursor-pointer hover:shadow-red-900/20"
                >
                  <Play className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" /> Phát Ngay
                </button>
                <button 
                  onClick={() => typeof heroMovie.slug === 'string' && onSelect(heroMovie.slug)} 
                  className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 active:scale-[0.97] text-white px-5 py-2.5 md:px-8 md:py-3.5 rounded-xl font-bold text-base md:text-lg transition-all shadow-md cursor-pointer border border-white/10"
                >
                  <Info className="w-5 h-5 md:w-6 md:h-6" /> Chi Tiết
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
