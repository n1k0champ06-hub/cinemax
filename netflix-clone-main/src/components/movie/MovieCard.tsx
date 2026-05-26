import React from 'react';
import { motion } from 'motion/react';
import { Bookmark } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SafeImage } from '../ui/ImageShimmer';
import { useMyList } from '../../hooks/useStorage';

export const MovieCard = React.memo(({ 
  movie, 
  onSelect, 
  isTop10, 
  idx, 
  progressData,
  variant = 'default'
}: { 
  movie: any, 
  onSelect: (s:string)=>void, 
  isTop10?: boolean, 
  idx: number, 
  progressData?: any,
  variant?: 'default' | 'landscape'
}) => {
  const { myList, toggleListItem } = useMyList();

  const progressPercent = progressData ? (progressData.currentTime / progressData.duration) * 100 : 0;
  const displayName = typeof movie.name === 'string' ? movie.name : '';
  
  const rawPoster = movie.poster_url;
  const safePoster = typeof rawPoster === 'string' && !rawPoster.startsWith('http') ? `https://phimimg.com/${rawPoster}` : rawPoster;
  
  const rawThumb = movie.thumb_url || movie.poster_url;
  const safeThumb = typeof rawThumb === 'string' && !rawThumb.startsWith('http') ? `https://phimimg.com/${rawThumb}` : rawThumb;

  const rating = movie?.tmdb?.vote_average ? parseFloat(movie.tmdb.vote_average).toFixed(1) : null;
  const isSaved = myList.some((m: any) => m.slug === movie.slug);

  if (variant === 'landscape') {
    return (
      <div
        onClick={() => onSelect(movie.slug)}
        className="flex-shrink-0 cursor-pointer snap-start relative transition-all duration-300 group rounded-xl overflow-hidden shadow-lg hover:shadow-2xl hover:ring-1 hover:ring-white/20 w-[280px] sm:w-[320px] md:w-[380px]"
      >
        <div className="w-full relative bg-[#111] aspect-video overflow-hidden">
          <SafeImage src={safeThumb} alt={displayName} className="absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:brightness-[0.8] group-hover:scale-105 opacity-90" />
          
          <button 
            onClick={(e) => {
              e.stopPropagation();
              toggleListItem(movie);
            }}
            className="absolute top-2 right-2 sm:top-3 sm:right-3 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 hidden sm:flex items-center justify-center hover:bg-black/90 transition-colors z-20 opacity-0 group-hover:opacity-100"
          >
            <Bookmark size={16} className={isSaved ? "text-white fill-white" : "text-white"} />
          </button>

          {/* Bottom Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-black/40 to-transparent z-10" />

          {/* Content Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 flex items-end gap-3 sm:gap-4 z-20">
            {/* Small Vertical Poster */}
            <div className="w-12 sm:w-16 rounded-md overflow-hidden shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.5)] border border-white/10 aspect-[2/3]">
              <SafeImage src={safePoster} alt={displayName} className="w-full h-full object-cover" />
            </div>
            
            {/* Text Content */}
            <div className="flex flex-col gap-1 pb-1">
              <h3 className="text-white font-bold text-sm sm:text-base leading-tight line-clamp-2 drop-shadow-md">
                {displayName}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-white/60 font-medium text-[11px] sm:text-xs">
                  {movie.year || '2024'}
                </span>
                {rating && (
                  <span className="bg-white/20 backdrop-blur-md text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm">
                    {rating}
                  </span>
                )}
              </div>
            </div>
          </div>

          {progressData && (
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-600/50 z-20">
              <div className="h-full bg-red-600" style={{ width: `${progressPercent}%` }} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default Variant
  return (
    <div
      onClick={() => onSelect(movie.slug)}
      className={cn(
        "flex-shrink-0 cursor-pointer snap-start relative transition-all duration-300 group rounded-xl overflow-hidden shadow-lg hover:shadow-2xl hover:ring-1 hover:ring-white/20",
        isTop10 ? "w-[150px] sm:w-[180px] md:w-[220px]" : "w-[140px] sm:w-[160px] md:w-[200px]"
      )}
    >
      <div className="w-full relative bg-[#111] overflow-hidden" style={{ aspectRatio: '2/3' }}>
        <SafeImage src={safePoster} alt={displayName} className="absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:brightness-[0.8] group-hover:scale-110" />
        
        <button 
          onClick={(e) => {
            e.stopPropagation();
            toggleListItem(movie);
          }}
          className="absolute top-2 right-2 sm:top-3 sm:right-3 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 hidden sm:flex items-center justify-center hover:bg-black/90 transition-colors z-20"
        >
          <Bookmark size={16} className={isSaved ? "text-white fill-white" : "text-white"} />
        </button>

        <div className="absolute inset-0 flex flex-col justify-end p-3 sm:p-4 bg-gradient-to-t from-black/95 via-black/40 to-transparent z-10">
          <div className="flex flex-col gap-1.5 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
            {rating && (
              <div className="bg-white text-black text-xs font-bold px-2 py-0.5 rounded-full w-max mt-auto">
                {rating}
              </div>
            )}
            <h3 className="text-white font-bold text-sm sm:text-base leading-tight line-clamp-2 drop-shadow-md">
              {displayName}
            </h3>
            <span className="text-white/60 font-medium text-xs sm:text-sm">
              {movie.year || '2024'}
            </span>
          </div>
        </div>

        {progressData && (
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-600/50 z-20">
            <div className="h-full bg-red-600" style={{ width: `${progressPercent}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}, (prev, next) => prev.movie.slug === next.movie.slug && prev.isTop10 === next.isTop10 && prev.variant === next.variant && prev.progressData?.currentTime === next.progressData?.currentTime && prev.idx === next.idx);
