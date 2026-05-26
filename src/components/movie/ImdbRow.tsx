import React, { useRef } from 'react';
import { useTmdbRanking } from '../../hooks/useTmdb';
import { RankingCard } from './RankingCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { HorizontalShimmer } from '../ui/ImageShimmer';

export const ImdbRow = ({ type, title, onSelect }: { type: 'top250-movies' | 'top250-tv' | 'popular-movies' | 'popular-tv' | 'now-playing', title: string, onSelect: (id: string) => void }) => {
  const { data: tmdbData, isLoading: tmdbLoading } = useTmdbRanking(type);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = window.innerWidth * 0.75;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const isLoading = tmdbLoading;
  if (isLoading) return <HorizontalShimmer />;

  const hasTmdbData = tmdbData && Array.isArray(tmdbData.results) && tmdbData.results.length > 0;
  
  if (!hasTmdbData) {
    return null;
  }

  const data = tmdbData.results.map((item: any) => ({
    id: `tmdb-${item.id}-${type.includes('tv') ? 'tv' : 'movie'}`,
    imdb_id: item.id ? item.id.toString() : '', // Temp ID mapping for TMDB
    title: item.title || item.name,
    primaryTitle: item.original_title || item.original_name,
    rating: item.vote_average,
    poster: item.poster_path ? (item.poster_path?.startsWith('http') ? item.poster_path : `https://image.tmdb.org/t/p/w342/${item.poster_path?.split('/').pop()}`) : null,
    tmdb_id: item.id,
    tmdb: item, // Pass the full tmdb object
  }));

  return (
    <div className="py-6 md:py-8 relative group/row overflow-visible">
      <div className="flex items-center gap-3 px-4 sm:px-8 md:px-12 mb-3">
        <div className="w-[3px] h-5 sm:h-6 bg-[#E50914] rounded-full" />
        <h2 className="text-white text-xl sm:text-2xl md:text-[28px] font-bold tracking-tight">
          {title}
        </h2>
      </div>

      <div className="group relative mt-6">
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
          className="flex gap-4 sm:gap-6 overflow-x-auto py-8 sm:py-12 -my-8 sm:-my-12 pl-[4%] pr-[4%] scrollbar-hide items-center relative z-10"
          style={{ scrollbarWidth: "none" }}
        >
          {data.slice(0, 10).map((movie: any, index: number) => (
            <div key={index} className="flex-none snap-start pt-4 pb-8">
              <RankingCard movie={movie} onSelect={onSelect} idx={index} type={type} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
