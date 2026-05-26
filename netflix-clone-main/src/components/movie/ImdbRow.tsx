import React, { useRef } from 'react';
import { useTmdbRanking } from '../../hooks/useTmdb';
import { RankingCard } from './RankingCard';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { HorizontalShimmer } from '../ui/ImageShimmer';
import { useQuery } from '@tanstack/react-query';
import { fetchMultiSource } from '../../api/phimApi';
import { CustomMovieRowContainer } from './MovieRows';

export const TmdbRow = ({ type, title, onSelect }: { type: 'top250-movies' | 'top250-tv' | 'popular-movies' | 'popular-tv' | 'now-playing' | 'trending-week', title: string, onSelect: (id: string) => void }) => {
  const { data: tmdbData, isLoading: tmdbLoading } = useTmdbRanking(type);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fallback to phim-le or phim-bo if TMDB fails due to quota or network
  const isMovie = type === 'top250-movies' || type === 'popular-movies' || type === 'now-playing';
  const { data: fallbackData, isLoading: fallbackLoading } = useQuery({
    queryKey: ['movies', isMovie ? 'phim-le' : 'phim-bo', 'fallback'],
    queryFn: () => fetchMultiSource(isMovie ? 'phim-le' : 'phim-bo', 2),
    enabled: !tmdbLoading && (!tmdbData || !Array.isArray(tmdbData?.results) || tmdbData.results.length === 0),
  });

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = window.innerWidth * 0.75;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const isLoading = tmdbLoading || fallbackLoading;
  if (isLoading) return <HorizontalShimmer />;

  const hasTmdbData = tmdbData && Array.isArray(tmdbData.results) && tmdbData.results.length > 0;
  
  if (!hasTmdbData) {
    if (fallbackData && fallbackData.length > 0) {
      return (
        <CustomMovieRowContainer
          title={`${title} (Dữ liệu dự phòng)`}
          movies={fallbackData.slice(0, 10)}
          onSelect={onSelect}
          isTop10={true}
        />
      );
    }
    return null;
  }

  // Determine media type for ID generation
  const getMediaType = (item: any) => {
    if (type.includes('tv')) return 'tv';
    if (item.media_type) return item.media_type;
    return 'movie';
  };

  const data = tmdbData.results.map((item: any) => ({
    id: `tmdb-${item.id}-${getMediaType(item)}`,
    imdb_id: item.id.toString(),
    title: item.title || item.name,
    primaryTitle: item.original_title || item.original_name,
    rating: item.vote_average,
    poster: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null,
    tmdb_id: item.id,
  }));

  // Chọn màu accent theo loại row
  const accentColor = type === 'now-playing' ? 'from-green-400 to-green-600' 
    : type === 'trending-week' ? 'from-red-400 to-red-600'
    : 'from-yellow-400 to-yellow-600';
  const accentShadow = type === 'now-playing' ? 'shadow-[0_0_10px_rgba(74,222,128,0.5)]'
    : type === 'trending-week' ? 'shadow-[0_0_10px_rgba(248,113,113,0.5)]'
    : 'shadow-[0_0_10px_rgba(234,179,8,0.5)]';

  return (
    <div className="py-4 md:py-6 relative group/row">
      <div className="flex items-center justify-between px-4 md:px-12 mb-4 gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-1.5 h-6 md:h-8 bg-gradient-to-b ${accentColor} rounded-full ${accentShadow}`} />
          <h2 className="text-xl sm:text-2xl md:text-[28px] font-black text-white tracking-tight">
            {title}
          </h2>
        </div>

        {data.length > 0 && (
          <div className="hidden sm:flex gap-2">
            <button 
              onClick={() => scroll('left')}
              className="p-2.5 border border-white/10 rounded-lg bg-transparent hover:bg-white/10 transition-colors text-white/80 hover:text-white"
            >
              <ArrowLeft size={18} />
            </button>
            <button 
              onClick={() => scroll('right')}
              className="p-2.5 border border-white/10 rounded-lg bg-transparent hover:bg-white/10 transition-colors text-white/80 hover:text-white"
            >
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>

      <div className="group relative">
        <div
          ref={scrollRef}
          className="flex gap-4 sm:gap-6 overflow-x-auto pb-8 pt-2 px-4 md:px-12 scrollbar-hide snap-x will-change-transform transform-gpu"
          style={{ scrollbarWidth: "none" }}
        >
          {data.slice(0, 20).map((movie: any, index: number) => (
            <div key={index} className="flex-none snap-start">
              <RankingCard movie={movie} onSelect={onSelect} idx={index} />
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

// Keep backward-compatible alias
export const ImdbRow = TmdbRow;
