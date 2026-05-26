import React, { useRef, useState } from "react";
import { SafeImage } from "../ui/ImageShimmer";
import { ChevronLeft, ChevronRight, Calendar, Layers } from "lucide-react";
import { useTmdbCollection } from "../../hooks/useTmdb";

export const MovieCollection = ({
  collectionId,
  onSelectMovie,
  onViewAll
}: {
  collectionId: number;
  onSelectMovie: (slug: string) => void;
  onViewAll: () => void;
}) => {
  const { data: collectionData } = useTmdbCollection(collectionId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(true);

  if (!collectionData || !collectionData.parts || collectionData.parts.length === 0) return null;

  const parts = [...collectionData.parts].sort((a, b) => {
    return new Date(a.release_date || 0).getTime() - new Date(b.release_date || 0).getTime();
  });

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftScroll(scrollLeft > 0);
      setShowRightScroll(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const clientWidth = scrollRef.current.clientWidth;
      const scrollAmount = direction === 'left' ? -clientWidth * 0.75 : clientWidth * 0.75;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <div className="mt-8 w-full relative group/collection bg-[#0e0e0e] border border-white/5 rounded-2xl p-5 sm:p-8">
      <div className="flex items-center justify-between gap-4 mb-4 sm:mb-6">
        <h3 className="text-lg sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5 min-w-0">
           <Layers className="text-[#ff2e35] shrink-0" size={22} />
           <span className="truncate">{collectionData.name || "Danh Sách Các Phần"}</span>
         </h3>
        <button 
          onClick={onViewAll} 
          className="hidden md:block px-4 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-xs sm:text-sm font-bold text-gray-300 hover:text-white transition-all cursor-pointer whitespace-nowrap shrink-0 ml-2"
        >
          Xem tất cả
        </button>
      </div>

      {/* On Mobile: Replace full cards carousel with a highly-polished 'View More' style button */}
      <div className="block md:hidden">
        <button
          onClick={onViewAll}
          className="w-full bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] active:scale-[0.98] text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-sm transition-all cursor-pointer shadow-lg"
        >
          <Layers size={14} className="text-gray-400" />
          <span>Xem loạt phim tương tự</span>
        </button>
      </div>

      {/* On Desktop/Tablet: Show styled scaled-down carousel */}
      <div className="hidden md:block relative group/nav">
        {showLeftScroll && (
          <button
            onClick={(e) => { e.stopPropagation(); scroll('left'); }}
            className="hidden md:flex absolute -left-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center bg-[#1c1c1c]/90 hover:bg-[#2c2c2c] text-white rounded-full opacity-0 group-hover/nav:opacity-100 transition-all shadow-xl shrink-0 cursor-pointer"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-4 md:gap-5 overflow-x-auto scrollbar-hide snap-x py-2 px-1"
        >
          {parts.map((movie, idx) => {
            const posterUrl = movie.poster_path ? (movie.poster_path.startsWith('http') ? movie.poster_path : `https://image.tmdb.org/t/p/w342/${movie.poster_path.split('/').pop()}`) : null;
            const year = movie.release_date ? movie.release_date.split('-')[0] : '';
            const rating = movie.vote_average ? movie.vote_average.toFixed(1) : '';

            return (
              <div
                key={idx}
                onClick={() => {
                  onSelectMovie(`tmdb-${movie.id}-movie`);
                }}
                className="flex-none w-[170px] lg:w-[190px] snap-start relative group cursor-pointer rounded-2xl overflow-hidden shadow-lg border border-white/5 hover:border-white/20 transition-all duration-300 bg-[#111]"
              >
                <div className="w-full aspect-[2/3] relative">
                  {posterUrl ? (
                    <SafeImage
                      src={posterUrl}
                      alt={movie.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/50 text-xs text-center p-4">
                      {movie.title}
                    </div>
                  )}
                  
                  <div className="absolute top-3 left-3 right-3 flex justify-between gap-2 pointer-events-none">
                    {year && (
                      <div className="bg-black/70 backdrop-blur-md px-2 py-0.5 flex items-center justify-center gap-1 rounded-md text-[10px] font-bold text-white shrink-0">
                        <Calendar size={10} className="shrink-0 text-gray-300" />
                        <span>{year}</span>
                      </div>
                    )}
                    {rating && (
                      <div className="bg-black/70 backdrop-blur-md px-2 py-0.5 flex items-center justify-center gap-1 rounded-md text-[10px] font-bold text-gray-300 shrink-0">
                        <span className="text-yellow-500 text-[9px]">★</span> <span className="text-white text-[10px]">{rating}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {showRightScroll && (
          <button
            onClick={(e) => { e.stopPropagation(); scroll('right'); }}
            className="hidden md:flex absolute -right-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center bg-[#1c1c1c]/90 hover:bg-[#2c2c2c] text-white rounded-full opacity-0 group-hover/nav:opacity-100 transition-all shadow-xl shrink-0 cursor-pointer"
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>
    </div>
  );
};
