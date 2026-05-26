import React from 'react';
import { motion } from 'motion/react';
import { Bookmark } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SafeImage } from '../ui/ImageShimmer';
import { useMyList } from '../../hooks/useStorage';
import { usePrefetchMovie } from '../../hooks/movie/usePrefetchMovie';
import { useQuery } from '@tanstack/react-query';

const cleanSearchName = (name: string): string => {
  if (!name) return "";
  return name
    .replace(/\s*[\(\[].*?[\)\]]/g, "") // remove brackets/parentheses contents
    .replace(/\s*-\s*Phần\s+\d+/gi, "") // remove " - Phần X"
    .replace(/\s*Phần\s+\d+/gi, "")     // remove "Phần X"
    .replace(/\s*Season\s+\d+/gi, "")   // remove "Season X"
    .replace(/\s*Part\s+\d+/gi, "")     // remove "Part X"
    .replace(/\s*P\d+/gi, "")           // remove "P5"
    .replace(/\s+/g, " ")
    .trim();
};

export const MovieCard = React.memo(({ movie, onSelect, isTop10, idx, progressData, className }: { movie: any, onSelect: (s:string)=>void, isTop10: boolean, idx: number, progressData?: any, className?: string }) => {
  const { myList, toggleListItem } = useMyList();
  const prefetch = usePrefetchMovie();

  const progressPercent = progressData ? (progressData.currentTime / progressData.duration) * 100 : 0;
  const displayName = typeof movie.name === 'string' ? movie.name : (movie.title || '');
  
  const rawPoster = movie?.tmdb?.poster_path ? (movie.tmdb.poster_path?.startsWith('http') ? movie.tmdb.poster_path : `https://image.tmdb.org/t/p/w200/${movie.tmdb.poster_path?.split('/').pop()}`) : movie.poster_url;
  const rawThumb = movie?.tmdb?.backdrop_path ? (movie.tmdb.backdrop_path?.startsWith('http') ? movie.tmdb.backdrop_path : `https://image.tmdb.org/t/p/w500/${movie.tmdb.backdrop_path?.split('/').pop()}`) : (movie.thumb_url || movie.poster_url);
  
  let safePoster = typeof rawPoster === 'string' && !rawPoster.startsWith('http') ? `https://phimimg.com/${rawPoster}` : rawPoster;
  let safeThumb = typeof rawThumb === 'string' && !rawThumb.startsWith('http') ? `https://phimimg.com/${rawThumb}` : rawThumb;

  if (typeof safePoster === 'string' && safePoster.includes('-thumb.')) {
    safePoster = safePoster.replace('-thumb.', '-poster.');
  }
  if (typeof safeThumb === 'string' && safeThumb.includes('-poster.')) {
    safeThumb = safeThumb.replace('-poster.', '-thumb.');
  }
  
  const rating = movie?.tmdb?.vote_average ? parseFloat(movie.tmdb.vote_average).toFixed(1) : (movie.tmdb?.vote_average || "8.0");
  const year = movie?.tmdb?.release_date ? movie.tmdb.release_date.split('-')[0] : (movie?.tmdb?.first_air_date ? movie.tmdb.first_air_date.split('-')[0] : (movie.year || "2024"));

  const isSaved = myList.some((m: any) => m.slug === movie.slug);
  const isOriginallyTvPattern = /phần|season|tập|mùa|part|\b(tv|series)\b/i.test(displayName);
  const isTv = movie?.type === 'series' || movie?.type === 'hoathinh' || movie?.tmdb?.media_type === 'tv' || (typeof movie?.slug === 'string' && movie.slug.endsWith('-tv')) || isOriginallyTvPattern;
  const tmdbId = movie?.tmdb_id || movie?.tmdb?.id;

  // React Query will cache TMDB details queries automatically and efficiently
  const { data: tmdbDetails } = useQuery({
    queryKey: ['tmdb', 'details', isTv ? 'tv' : 'movie', tmdbId || displayName],
    queryFn: async () => {
      const { tmdbGetMovieDetails, tmdbGetTvDetails, tmdbSearchMovie, tmdbSearchTv, tmdbSearchMulti } = await import('../../api/tmdbApi');
      let targetId = tmdbId;

      if (!targetId && displayName) {
        const cleaned = cleanSearchName(displayName);
        // Search by title fallback for My List & Continue Watching
        const searchResults = isTv 
          ? await tmdbSearchTv(cleaned) 
          : await tmdbSearchMovie(cleaned);
        
        let firstResult = searchResults?.results?.[0];
        if (!firstResult && cleaned !== displayName) {
          // Fallback to original displayName search if cleaned name yields nothing
          const retryResults = isTv 
            ? await tmdbSearchTv(displayName) 
            : await tmdbSearchMovie(displayName);
          firstResult = retryResults?.results?.[0];
        }

        if (firstResult) {
          targetId = firstResult.id;
        } else {
          const multiResults = await tmdbSearchMulti(cleaned);
          if (multiResults?.results?.[0]) {
            targetId = multiResults.results[0].id;
          }
        }
      }

      if (!targetId) return null;
      return isTv ? tmdbGetTvDetails(targetId) : tmdbGetMovieDetails(targetId);
    },
    enabled: !!tmdbId || !!displayName,
    staleTime: 1000 * 60 * 30, // 30 minutes cache
  });

  // Favor English promotional banners containing baked-in text/artwork to avoid manual text overlay
  const englishBackdropFile = tmdbDetails?.images?.backdrops?.find((b: any) => b.iso_639_1 === 'en')?.file_path;
  const englishBackdropUrl = englishBackdropFile ? `https://image.tmdb.org/t/p/w500/${englishBackdropFile}` : null;

  const finalThumb = englishBackdropUrl || safeThumb;

  return (
    <motion.div
      whileHover={{ scale: 1.03, zIndex: 30 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      onMouseEnter={() => prefetch(movie)}
      onTouchStart={() => prefetch(movie)}
      onClick={() => onSelect(movie.slug || movie.id)}
      className={cn("flex-shrink-0 cursor-pointer relative transition-shadow duration-300 group rounded-[16px]", className || "w-[240px] sm:w-[280px] md:w-[310px] lg:w-[330px]")}
    >
      <div className="w-full relative bg-[#050505] aspect-[16/9] rounded-[16px] overflow-hidden border border-white/5 group-hover:border-white/15 transition-all shadow-md">
        <SafeImage src={finalThumb} alt={displayName} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        
        {/* Subtle vignette layer */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

        {progressData && (
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-600/50 z-20">
            <div className="h-full bg-[#E50914]" style={{ width: `${progressPercent}%` }} />
          </div>
        )}
      </div>

      {/* Styled Metadata below the card */}
      <div className="mt-2.5 flex flex-col gap-1 pr-1 overflow-hidden pointer-events-none">
        <h3 className="text-white font-bold text-sm sm:text-base leading-snug truncate group-hover:text-[#e50914] transition-colors duration-300">
          {displayName}
        </h3>
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
          <span className="bg-white/10 text-white border border-white/5 px-1.5 py-0.5 rounded text-[9px] tracking-wide font-black uppercase">
            {isTv ? "PHIM BỘ" : "PHIM LẺ"}
          </span>
          <span>{year}</span>
          <span className="flex items-center gap-0.5 text-[#FBC02D]">
            ★ <span className="text-white font-semibold">{rating}</span>
          </span>
        </div>
      </div>
    </motion.div>
  );
}, (prev, next) => prev.movie.slug === next.movie.slug && prev.isTop10 === next.isTop10 && prev.progressData?.currentTime === next.progressData?.currentTime && prev.idx === next.idx);
