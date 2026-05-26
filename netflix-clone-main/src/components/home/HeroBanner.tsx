import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Volume2, VolumeX, ChevronLeft, ChevronRight, Loader2, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '../../lib/utils';
import { fetchMultiSource } from '../../api/phimApi';
import { useTmdbSearch } from '../../hooks/useTmdb';
import { SafeImage, HeroShimmer } from '../ui/ImageShimmer';

export const HeroBanner = ({ onSelect }: { onSelect: (slug: string) => void }) => {
  const { data, isLoading } = useQuery({ queryKey: ["movies", "phim-moi-cap-nhat"], queryFn: () => fetchMultiSource("phim-moi-cap-nhat") });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(true);

  const heroMovie = data?.[currentIndex];
  // Determine if it's a TV show or Movie based on phimAPI category list
  const maybeTv = heroMovie?.type === 'series' || heroMovie?.type === 'hoathinh';
  const { data: tmdbSearch } = useTmdbSearch(heroMovie?.origin_name || heroMovie?.name || '', maybeTv ? 'tv' : 'movie', 1);
  const tmdbMeta = tmdbSearch?.results?.[0];
  
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

  const bgImage = (tmdbMeta?.backdrop_path ? `https://image.tmdb.org/t/p/original${tmdbMeta.backdrop_path}` : null) || heroMovie.thumb_url || heroMovie.poster_url;
  const description = tmdbMeta?.overview || (typeof heroMovie.origin_name === 'string' && heroMovie.origin_name !== heroMovie.name ? heroMovie.origin_name : 'Trải nghiệm những bộ phim mới nhất và hấp dẫn nhất. Xem ngay hôm nay!');

  const dateString = heroMovie?.year || '';

  return (
    <div className="relative h-[100dvh] min-h-[650px] lg:h-[80vh] lg:min-h-0 w-full overflow-hidden bg-[#111315] group">
      <AnimatePresence mode="popLayout">
        <motion.div 
          key={`img-${currentIndex}`}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          className="absolute inset-x-0 top-0 h-[65%] lg:inset-0 lg:h-full cursor-grab active:cursor-grabbing z-0 rounded-b-[40px] lg:rounded-none overflow-hidden bg-black"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(e, { offset }) => {
            if (offset.x < -50) handleNext();
            else if (offset.x > 50) handlePrev();
          }}
        >
          <SafeImage priority={true} src={bgImage || ''} alt={heroMovie.name} className="w-full h-full object-cover opacity-100 lg:opacity-80 pointer-events-none fade-in" />
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {/* Removed Youtube trailer to save quotas on TMDB/Kino, we can add it back if using KinoCheck but for now it's fine without */}
      </AnimatePresence>

      {/* Gradients only on Desktop */}
      <div className="hidden lg:block absolute inset-0 bg-gradient-to-r from-black via-black/50 to-transparent w-full md:w-[70%] z-10 pointer-events-none" />
      <div className="hidden lg:block absolute inset-x-0 bottom-0 h-40 lg:h-[40vh] bg-gradient-to-t from-black via-black/80 to-transparent z-10 pointer-events-none" />
      
      {/* Navigation Arrows (Desktop) */}
      <div className="hidden md:flex absolute inset-y-0 left-0 w-24 z-20 items-center justify-start opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <button onClick={handlePrev} className="ml-4 p-3 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 hover:bg-white hover:text-black text-white transition-all pointer-events-auto shadow-xl">
          <ChevronLeft className="w-8 h-8" />
        </button>
      </div>
      <div className="hidden md:flex absolute inset-y-0 right-0 w-24 z-20 items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <button onClick={handleNext} className="mr-4 p-3 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 hover:bg-white hover:text-black text-white transition-all pointer-events-auto shadow-xl">
          <ChevronRight className="w-8 h-8" />
        </button>
      </div>

      {/* Primary Content Container */}
      <div className="absolute inset-0 z-30 pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div 
            key={currentIndex} 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -20 }} 
            transition={{ duration: 0.5 }}
            className="w-full h-full flex flex-col justify-end lg:pb-32 lg:px-24 pointer-events-none"
          >
            {/* Mobile View */}
            <div className="lg:hidden absolute inset-x-0 bottom-0 h-[35%] flex flex-col items-start justify-center px-6 pointer-events-auto pb-4 cursor-pointer" onClick={() => typeof heroMovie.slug === 'string' && onSelect(heroMovie.slug)}>
               {/* Play Button exactly on the line between image and text */}
               <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
                  <button onClick={() => typeof heroMovie.slug === 'string' && onSelect(heroMovie.slug)} className="w-16 h-16 bg-[#444648] hover:bg-[#555759] active:scale-95 transition-all rounded-full flex items-center justify-center border-[6px] border-[#111315] shadow-xl">
                    <Play className="w-6 h-6 text-white ml-1" fill="currentColor" />
                  </button>
               </div>

               <p className="text-gray-400 text-sm font-medium mb-1 mt-6">{dateString}</p>
               <h1 className="text-[28px] sm:text-3xl font-extrabold text-white tracking-tight leading-tight line-clamp-2 w-full mb-4">
                 {typeof heroMovie.name === 'string' ? heroMovie.name : ''}
               </h1>
               
               <div className="flex gap-2 flex-wrap w-full pointer-events-none">
                 {/* Metadata pills */}
                 {heroMovie.time && (
                   <span className="bg-[#2a2c2e] text-gray-300 font-medium px-3 py-1.5 rounded-full text-xs">{heroMovie.time}</span>
                 )}
                 {heroMovie.category?.slice(0, 2).map((cat: any, i: number) => (
                   <span key={i} className="bg-[#2a2c2e] text-gray-300 font-medium px-3 py-1.5 rounded-full text-xs">
                     {cat.name}
                   </span>
                 ))}
                 <span className="bg-[#2a2c2e] text-gray-300 font-medium px-3 py-1.5 rounded-full text-xs">{heroMovie.type === 'series' ? 'Phim bộ' : 'Phim lẻ'}</span>
               </div>
            </div>

            {/* Desktop View */}
            <div className="hidden lg:flex flex-col space-y-5 w-full max-w-4xl pointer-events-auto">
              <h1 className="text-5xl lg:text-6xl xl:text-7xl font-sans font-black text-white leading-[1.1] drop-shadow-2xl tracking-tighter line-clamp-3 break-words">
                {heroMovie.name}
              </h1>
              
              <p className="text-white/80 text-lg xl:text-xl line-clamp-[6] max-h-[175px] overflow-hidden font-medium drop-shadow-lg w-[85%] leading-relaxed pointer-events-auto">
                {description}
              </p>
              <div className="flex gap-4 pt-4 pointer-events-auto">
                <button onClick={() => typeof heroMovie.slug === 'string' && onSelect(heroMovie.slug)} className="flex items-center justify-center gap-3 bg-white text-black px-10 py-4 rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-2xl active:scale-95">
                  <Play className="w-6 h-6" fill="currentColor" /> Xem ngay
                </button>
                <button onClick={() => typeof heroMovie.slug === 'string' && onSelect(heroMovie.slug)} className="flex items-center justify-center gap-3 bg-white/20 backdrop-blur-3xl text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-white/30 transition-all shadow-2xl active:scale-95 border border-white/20">
                  Chi tiết <ArrowRight className="w-6 h-6" />
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dots positioned at the bottom right */}
      <div className="hidden lg:flex absolute bottom-6 lg:bottom-12 right-6 lg:right-24 z-20 gap-2">
        {data.slice(0, maxItems).map((_: any, idx: number) => (
          <div 
            key={idx} 
            onClick={() => setCurrentIndex(idx)}
            className={cn(
              "h-1.5 cursor-pointer transition-all duration-300 rounded-full",
              idx === currentIndex ? "w-8 bg-white shadow-[0_0_10px_rgba(255,255,255,0.7)]" : "w-1.5 bg-[#444648] hover:bg-white/60"
            )}
          />
        ))}
      </div>
    </div>
  );
};
