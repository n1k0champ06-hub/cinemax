import React from 'react';
import { motion } from 'motion/react';
import { Bookmark } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SafeImage } from '../ui/ImageShimmer';
import { useMyList } from '../../hooks/useStorage';
import { usePrefetchMovie } from '../../hooks/movie/usePrefetchMovie';
import { useQuery } from '@tanstack/react-query';

const containsNonLatin = (str: string): boolean => {
  if (!str) return false;
  // Match any string that contains only basic Latin, numbers, common symbols, Vietnamese, and European Latin accents
  const allowedPattern = /^[a-zA-Z0-9\s.,'":;\-!?&()\[\]\/+*%#@$_~`|<>•·ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂÂÊÔƠưăâêôơéèàùçâêîôûëïüÿñíóúáäößÉÈÀÙÇÂÊÎÔÛËÏÜŸÑÍÓÚÁÄÖ\u0300-\u036f]*$/;
  return !allowedPattern.test(str);
};

export const MovieCard = React.memo(({ movie, onSelect, isTop10, idx, progressData, className, rowTitle, aspectRatio = 'landscape' }: { movie: any, onSelect: (s:string)=>void, isTop10: boolean, idx: number, progressData?: any, className?: string, rowTitle?: string, aspectRatio?: 'landscape' | 'poster' }) => {
  const { myList, toggleListItem } = useMyList();
  const prefetch = usePrefetchMovie();

  const progressPercent = progressData ? (progressData.currentTime / progressData.duration) * 100 : 0;
  const displayName = typeof movie.name === 'string' ? movie.name : (movie.title || '');
  
  const isOriginallyTvPattern = /phần|season|tập|mùa|part|\b(tv|series)\b/i.test(displayName);
  const isTv = movie?.type === 'series' || movie?.type === 'hoathinh' || movie?.tmdb?.media_type === 'tv' || (typeof movie?.slug === 'string' && movie.slug.endsWith('-tv')) || isOriginallyTvPattern;
  const tmdbId = movie?.tmdb_id || movie?.tmdb?.id || (typeof movie.slug === 'string' && movie.slug.startsWith('tmdb-') ? movie.slug.split('-')[1] : null);

  const isTargetNonLatin = containsNonLatin(displayName);

  // Fetch details in English if title contains non-Latin characters to prioritize English fallback
  const { data: enDetails } = useQuery({
    queryKey: ['tmdb', 'details_en', isTv ? 'tv' : 'movie', tmdbId],
    queryFn: async () => {
      if (!tmdbId) return null;
      const { fetchTmdb } = await import('../../api/tmdbApi');
      return fetchTmdb(`/${isTv ? 'tv' : 'movie'}/${tmdbId}`, { language: 'en' });
    },
    enabled: !!tmdbId,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const resolvedDisplayName = enDetails?.title || enDetails?.name || displayName;
  
  const isAnime = movie?.isJikan || 
    (typeof movie?.slug === 'string' && (movie.slug.startsWith('mal-') || movie.slug.startsWith('jikan-') || /^\d+$/.test(movie.slug))) || 
    movie?.media_type === 'anime' || 
    (rowTitle && /anime|hoạt hình/i.test(rowTitle));

  const { data: aniListCover } = useQuery({
    queryKey: ['anilist', 'cover', resolvedDisplayName],
    queryFn: async () => {
      const { fetchAniListCover } = await import('../../api/anilistApi');
      return fetchAniListCover(resolvedDisplayName);
    },
    enabled: !!isAnime && !!resolvedDisplayName,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const aniPoster = aniListCover?.extraLarge || aniListCover?.large;
  const aniThumb = aniListCover?.banner || aniListCover?.extraLarge || aniListCover?.large;
  
  const rawPoster = movie?.tmdb?.poster_path ? (movie.tmdb.poster_path?.startsWith('http') ? movie.tmdb.poster_path : `https://image.tmdb.org/t/p/w200/${movie.tmdb.poster_path?.split('/').pop()}`) : movie.poster_url;
  const rawThumb = movie?.tmdb?.backdrop_path ? (movie.tmdb.backdrop_path?.startsWith('http') ? movie.tmdb.backdrop_path : `https://image.tmdb.org/t/p/w500/${movie.tmdb.backdrop_path?.split('/').pop()}`) : (movie.thumb_url || movie.poster_url);
  
  const enBackdrop = enDetails?.backdrop_path ? `https://image.tmdb.org/t/p/w500/${enDetails.backdrop_path.split('/').pop()}` : null;
  const enPoster = enDetails?.poster_path ? `https://image.tmdb.org/t/p/w200/${enDetails.poster_path.split('/').pop()}` : null;

  let safePoster = aniPoster || enPoster || (typeof rawPoster === 'string' && !rawPoster.startsWith('http') ? `https://phimimg.com/${rawPoster}` : rawPoster);
  let safeThumb = aniThumb || enBackdrop || (typeof rawThumb === 'string' && !rawThumb.startsWith('http') ? `https://phimimg.com/${rawThumb}` : rawThumb);

  if (typeof safePoster === 'string' && safePoster.includes('-thumb.')) {
    safePoster = safePoster.replace('-thumb.', '-poster.');
  }
  if (typeof safeThumb === 'string' && safeThumb.includes('-poster.')) {
    safeThumb = safeThumb.replace('-poster.', '-thumb.');
  }
  
  const rating = movie?.tmdb?.vote_average ? parseFloat(movie.tmdb.vote_average).toFixed(1) : (movie.tmdb?.vote_average || "8.0");
  const year = movie?.tmdb?.release_date ? movie.tmdb.release_date.split('-')[0] : (movie?.tmdb?.first_air_date ? movie.tmdb.first_air_date.split('-')[0] : (movie.year || "2024"));

  const isSaved = myList.some((m: any) => m.slug === movie.slug);

  const finalThumb = aspectRatio === 'poster' ? (safePoster || safeThumb) : safeThumb;

  return (
    <motion.div
      whileHover={{ scale: 1.03, zIndex: 30 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      onMouseEnter={() => prefetch(movie)}
      onTouchStart={() => prefetch(movie)}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const clickDetails = {
          component: "MovieCard",
          title: resolvedDisplayName,
          slug: movie.slug || movie.id,
          type: isTv ? "tv" : "movie",
          tmdbId: tmdbId || 'none',
          positionIndex: idx,
          isTop10: isTop10,
          rowTitle: rowTitle || 'unknown',
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
          `%c[USER ACTION: CLICK]%c Movie Card: "${resolvedDisplayName}" inside row "${rowTitle || 'unknown'}"`,
          'background: #E50914; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
          'color: #ffffff; font-weight: bold;',
          clickDetails
        );
        onSelect(movie.slug || movie.id);
      }}
      className={cn("flex-shrink-0 cursor-pointer relative transition-shadow duration-300 group rounded-[16px]", className || (aspectRatio === 'poster' ? "w-[150px] sm:w-[180px] md:w-[200px] lg:w-[220px]" : "w-[240px] sm:w-[280px] md:w-[310px] lg:w-[330px]"))}
    >
      <div className={cn("w-full relative bg-[#050505] rounded-[16px] overflow-hidden border border-white/5 group-hover:border-white/15 transition-all shadow-md", aspectRatio === 'poster' ? "aspect-[2/3]" : "aspect-[16/9]")}>
        <SafeImage src={finalThumb} alt={resolvedDisplayName} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        
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
          {resolvedDisplayName}
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
