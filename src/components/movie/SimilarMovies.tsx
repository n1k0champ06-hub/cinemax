import React, { useRef, useState, useEffect } from "react";
import { SafeImage } from "../ui/ImageShimmer";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

export const SimilarMovies = ({
  categorySlug,
  onSelect,
  currentSlug,
  tmdbRecommendations,
}: {
  categorySlug: string;
  onSelect: (slug: string) => void;
  currentSlug?: string;
  tmdbRecommendations?: any[];
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(true);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftScroll(scrollLeft > 0);
      setShowRightScroll(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    handleScroll();
    window.addEventListener('resize', handleScroll);
    return () => window.removeEventListener('resize', handleScroll);
  }, [tmdbRecommendations]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const clientWidth = scrollRef.current.clientWidth;
      const scrollAmount = direction === 'left' ? -clientWidth * 0.75 : clientWidth * 0.75;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  if (!tmdbRecommendations || tmdbRecommendations.length === 0) return null;

  let finalSimilar: any[] = [];
  
  if (tmdbRecommendations && tmdbRecommendations.length > 0) {
    finalSimilar = tmdbRecommendations.map(m => ({
      name: m.title || m.name,
      origin_name: m.original_title || m.original_name,
      slug: `tmdb-${m.id}-${m.media_type || (m.title ? 'movie' : 'tv')}`,
      poster_url: m.poster_path ? (m.poster_path?.startsWith('http') ? m.poster_path : `https://image.tmdb.org/t/p/w342/${m.poster_path?.split('/').pop()}`) : null,
      year: m.release_date ? m.release_date.split('-')[0] : (m.first_air_date ? m.first_air_date.split('-')[0] : ''),
      rating: m.vote_average ? m.vote_average.toFixed(1) : '',
      isTmdb: true
    })).filter(m => m.poster_url);
  }

  if (!finalSimilar?.length) return null;

  return (
    <div className="mt-12 w-full relative group/similar">
      <h3 className="text-2xl font-black text-white mb-6 tracking-tight flex items-center gap-2">
         <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
         Nội Dung Liên Quan
      </h3>

      <div className="relative group/nav">
        {showLeftScroll && (
          <button
            onClick={(e) => { e.stopPropagation(); scroll('left'); }}
            className="hidden md:flex absolute -left-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center bg-[#1c1c1c]/90 hover:bg-[#2c2c2c] text-white rounded-full opacity-0 group-hover/nav:opacity-100 transition-all shadow-xl shrink-0"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-4 md:gap-5 overflow-x-auto scrollbar-hide snap-x pt-2 pb-4 px-1"
        >
          {finalSimilar.map((movie, idx) => (
            <div
              key={idx}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickDetails = {
                  component: "SimilarMovies",
                  title: movie.name,
                  slug: movie.slug,
                  type: movie.type || 'movie',
                  tmdbId: movie.slug?.split('-')?.[1] || 'none',
                  positionIndex: idx,
                  clickCoordinates: {
                    clientX: e.clientX,
                    clientY: e.clientY,
                    relativeX: Math.round(e.clientX - rect.left),
                    relativeY: Math.round(e.clientY - rect.top),
                    elementWidth: Math.round(rect.width),
                    elementHeight: Math.round(rect.height)
                  },
                  scrollState: {
                    windowScrollX: window.scrollX,
                    windowScrollY: window.scrollY
                  },
                  viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                  },
                  timestamp: new Date().toISOString()
                };
                console.log(
                  `%c[USER ACTION: CLICK]%c Similar Movie Card: "${movie.name}"`,
                  'background: #808080; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
                  'color: #ffffff; font-weight: bold;',
                  clickDetails
                );
                if (typeof movie.slug === "string") {
                  onSelect(movie.slug);
                }
              }}
              className="flex-none w-[160px] sm:w-[200px] md:w-[220px] lg:w-[240px] snap-start relative group cursor-pointer rounded-2xl overflow-hidden shadow-lg border border-white/5 hover:border-white/20 transition-all duration-300 bg-[#111]"
            >
              <div className="w-full aspect-[2/3] relative">
                <SafeImage
                  src={movie.poster_url}
                  alt={movie.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                
                <div className="absolute top-3 left-3 right-3 flex justify-between gap-2 pointer-events-none">
                  {movie.year && (
                    <div className="bg-black/70 backdrop-blur-md px-2.5 py-1 flex items-center justify-center gap-1.5 rounded-md text-[11px] font-bold text-white shrink-0">
                      <Calendar size={12} className="shrink-0 text-gray-300" />
                      <span>{movie.year}</span>
                    </div>
                  )}
                  {movie.rating && (
                    <div className="bg-black/70 backdrop-blur-md px-2.5 py-1 flex items-center justify-center gap-1.5 rounded-md text-[11px] font-bold text-gray-300 shrink-0">
                      <span className="text-yellow-500">★</span> <span className="text-white">{movie.rating}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {showRightScroll && (
          <button
            onClick={(e) => { e.stopPropagation(); scroll('right'); }}
            className="hidden md:flex absolute -right-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center bg-[#1c1c1c]/90 hover:bg-[#2c2c2c] text-white rounded-full opacity-0 group-hover/nav:opacity-100 transition-all shadow-xl shrink-0"
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>
    </div>
  );
};
