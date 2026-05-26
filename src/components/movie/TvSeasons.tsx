import React, { useRef, useState, useEffect } from "react";
import { SafeImage } from "../ui/ImageShimmer";
import { ChevronLeft, ChevronRight, Layers } from "lucide-react";

export const TvSeasons = ({
  seasons,
  onSelectSeason,
  tmdbSeriesId,
  activeSeasonNumber,
  onViewAll
}: {
  seasons: any[];
  onSelectSeason: (seasonNumber: number) => void;
  tmdbSeriesId: number;
  activeSeasonNumber: number | null;
  onViewAll: () => void;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(true);

  if (!seasons || seasons.length === 0) return null;

  // Filter out season 0 (Usually "Specials") if needed, or put it at the end? Let's just filter out for now if there are many seasons, or keep it.
  // Actually, TMDB puts specials as season 0. Let's sort them so season 0 is at the end or just keep original order.
  const validSeasons = [...seasons].sort((a, b) => a.season_number - b.season_number);

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
    <div className="mt-8 w-full relative group/seasons bg-[#0e0e0e] border border-white/5 rounded-2xl p-6 sm:p-8">
      <div className="flex items-center justify-between gap-4 mb-2">
        <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5 min-w-0">
          <Layers className="text-[#ff2e35] shrink-0" size={24} />
          <span className="truncate">Danh Sách Các Phần</span>
        </h3>
        <button 
          onClick={onViewAll} 
          className="px-4 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-xs sm:text-sm font-bold text-gray-300 hover:text-white transition-all cursor-pointer whitespace-nowrap shrink-0 ml-2"
        >
          Xem tất cả
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-6 font-medium leading-relaxed">
        Các mùa của bộ phim này.
      </p>

      <div className="relative group/nav">
        {showLeftScroll && (
          <button
            onClick={(e) => { e.stopPropagation(); scroll('left'); }}
            className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center bg-black/80 hover:bg-black text-white rounded-full opacity-0 group-hover/nav:opacity-100 transition-all border border-white/10 shrink-0"
          >
            <ChevronLeft size={24} />
          </button>
        )}
        
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-4 md:gap-6 overflow-x-auto scrollbar-hide snap-x py-2 px-1"
        >
          {validSeasons.map((season, idx) => {
            const posterUrl = season.poster_path ? (season.poster_path.startsWith('http') ? season.poster_path : `https://image.tmdb.org/t/p/w342/${season.poster_path.split('/').pop()}`) : null;

            const isActive = season.season_number === activeSeasonNumber;

            return (
              <div
                key={idx}
                onClick={() => {
                  onSelectSeason(season.season_number);
                }}
                className={`flex-none w-[130px] sm:w-[150px] md:w-[180px] snap-start flex flex-col bg-[#141414] rounded-xl border cursor-pointer transition-all duration-300 group overflow-hidden ${
                  isActive ? "border-[#ff2e35] bg-[#ff2e35]/10 shadow-[0_4px_20px_rgba(255,46,53,0.25)] scale-[0.98]" : "border-white/[0.04] hover:border-white/20 hover:bg-white/5"
                }`}
              >
                <div className="w-full aspect-[2/3] shrink-0 relative bg-black/40 overflow-hidden">
                  {posterUrl ? (
                    <SafeImage
                      src={posterUrl}
                      alt={season.name}
                      className={`w-full h-full object-cover transition-transform duration-500 ${!isActive && "group-hover:scale-105"}`}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/50 text-xs text-center p-4">
                      {season.name}
                    </div>
                  )}
                  {isActive && (
                    <div className="absolute inset-x-0 bottom-0 top-0 ring-inset ring-2 ring-[#ff2e35] rounded-t-xl" />
                  )}
                  {!isActive && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                       <div className="text-xs font-bold text-white flex items-center gap-1">
                          Xem danh sách
                       </div>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h4 className="text-xs sm:text-sm font-bold text-white mb-1 truncate group-hover:text-[#ff2e35] transition-colors">
                    {season.name}
                  </h4>
                  <p className="text-[10px] sm:text-xs text-gray-500 truncate">
                    {season.episode_count} Tập
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {showRightScroll && (
          <button
            onClick={(e) => { e.stopPropagation(); scroll('right'); }}
            className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center bg-black/80 hover:bg-black text-white rounded-full opacity-0 group-hover/nav:opacity-100 transition-all border border-white/10 shrink-0"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>
    </div>
  );
};
