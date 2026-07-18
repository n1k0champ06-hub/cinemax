import React from 'react';
import { motion } from 'motion/react';
import { Bookmark, Play } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SafeImage } from '../ui/ImageShimmer';
import { useMyList } from '../../hooks/useStorage';
import { usePrefetchMovie } from '../../hooks/movie/usePrefetchMovie';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const containsNonLatin = (str: string): boolean => {
  if (!str) return false;
  // Match any string that contains only basic Latin, numbers, common symbols, Vietnamese, and European Latin accents
  const allowedPattern = /^[a-zA-Z0-9\s.,'":;\-!?&()\[\]\/+*%#@$_~`|<>•·ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂÂÊÔƠưăâêôơéèàùçâêîôûëïüÿñíóúáäößÉÈÀÙÇÂÊÎÔÛËÏÜŸÑÍÓÚÁÄÖ\u0300-\u036f]*$/;
  return !allowedPattern.test(str);
};

export const MovieCard = React.memo(({ movie, onSelect, isTop10, idx, progressData, className, rowTitle, aspectRatio = 'landscape', enDetails: passedEnDetails, aniListCover: passedAniListCover, isAnime: passedIsAnime }: { movie: any, onSelect: (s:string)=>void, isTop10: boolean, idx: number, progressData?: any, className?: string, rowTitle?: string, aspectRatio?: 'landscape' | 'poster', enDetails?: any, aniListCover?: any, isAnime?: boolean }) => {
  const { myList, toggleListItem } = useMyList();
  const prefetch = usePrefetchMovie();

  const progressPercent = progressData ? (progressData.currentTime / progressData.duration) * 100 : 0;
  const displayName = typeof movie.name === 'string' ? movie.name : (movie.title || '');
  
  const isOriginallyTvPattern = /phần|season|tập|mùa|part|\b(tv|series)\b/i.test(displayName);
  const isTv = movie?.type === 'series' || movie?.type === 'hoathinh' || movie?.tmdb?.media_type === 'tv' || (typeof movie?.slug === 'string' && movie.slug.endsWith('-tv')) || isOriginallyTvPattern;
  const tmdbId = movie?.tmdb_id || movie?.tmdb?.id || (typeof movie.slug === 'string' && movie.slug.startsWith('tmdb-') ? movie.slug.split('-')[1] : null);

  const isTargetNonLatin = containsNonLatin(displayName);

  const [shouldFetch, setShouldFetch] = React.useState(false);
  const hoverTimeoutRef = React.useRef<any>(null);

  React.useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    prefetch(movie);
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setShouldFetch(true);
    }, 250);
  };

  const handleMouseLeave = () => {
    if (typeof (prefetch as any).cancel === 'function') {
      (prefetch as any).cancel();
    }
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const queryClient = useQueryClient();
  const cachedData = tmdbId ? queryClient.getQueryData(['tmdb', 'details_en', isTv ? 'tv' : 'movie', tmdbId]) : null;

  // Fetch details in English (shared individual cache query)
  const { data: fetchedEnDetails } = useQuery({
    queryKey: ['tmdb', 'details_en', isTv ? 'tv' : 'movie', tmdbId],
    queryFn: async () => {
      if (!tmdbId) return null;
      const { fetchTmdb } = await import('../../api/tmdbApi');
      return fetchTmdb(`/${isTv ? 'tv' : 'movie'}/${tmdbId}`, { 
        language: 'en',
        append_to_response: 'images,external_ids',
        include_image_language: 'en,null,vi,ja,ko,zh'
      });
    },
    enabled: !!tmdbId && (shouldFetch || !!cachedData),
    staleTime: 24 * 60 * 60 * 1000,
  });

  const enDetails = passedEnDetails || fetchedEnDetails || (cachedData as any);

  const resolvedDisplayName = enDetails?.title || enDetails?.name || displayName;

  const rawPoster = movie?.tmdb?.poster_path ? (movie.tmdb.poster_path?.startsWith('http') ? movie.tmdb.poster_path : `https://image.tmdb.org/t/p/w500/${movie.tmdb.poster_path?.split('/').pop()}`) : movie.poster_url;
  const rawThumb = movie?.tmdb?.backdrop_path ? (movie.tmdb.backdrop_path?.startsWith('http') ? movie.tmdb.backdrop_path : `https://image.tmdb.org/t/p/w500/${movie.tmdb.backdrop_path?.split('/').pop()}`) : (movie.thumb_url || movie.poster_url);
  
  const enBackdrop = enDetails?.backdrop_path ? `https://image.tmdb.org/t/p/w500/${enDetails.backdrop_path.split('/').pop()}` : null;
  const enPoster = enDetails?.poster_path ? `https://image.tmdb.org/t/p/w500/${enDetails.poster_path.split('/').pop()}` : null;

  let safePoster = enPoster || (typeof rawPoster === 'string' && !rawPoster.startsWith('http' ) ? `https://phimimg.com/${rawPoster}` : rawPoster);
  let safeThumb = enBackdrop || (typeof rawThumb === 'string' && !rawThumb.startsWith('http') ? `https://phimimg.com/${rawThumb}` : rawThumb);


  if (typeof safePoster === 'string' && safePoster.includes('-thumb.')) {
    safePoster = safePoster.replace('-thumb.', '-poster.');
  }
  if (typeof safeThumb === 'string' && safeThumb.includes('-poster.')) {
    safeThumb = safeThumb.replace('-poster.', '-thumb.');
  }
  
  const rating = movie?.tmdb?.vote_average 
    ? parseFloat(movie.tmdb.vote_average).toFixed(1) 
    : (enDetails?.vote_average ? parseFloat(enDetails.vote_average).toFixed(1) : "8.0");

  const year = movie?.tmdb?.release_date 
    ? movie.tmdb.release_date.split('-')[0] 
    : (movie?.tmdb?.first_air_date 
       ? movie.tmdb.first_air_date.split('-')[0] 
       : (enDetails?.release_date 
          ? enDetails.release_date.split('-')[0] 
          : (enDetails?.first_air_date 
             ? enDetails.first_air_date.split('-')[0] 
             : (movie.year || "2024"))));

  const isSaved = myList.some((m: any) => m.slug === movie.slug);

  const finalThumb = aspectRatio === 'poster' ? (safePoster || safeThumb) : safeThumb;

  const logoUrl = (() => {
    if (enDetails?.logo_path) {
      return `https://image.tmdb.org/t/p/w500/${enDetails.logo_path.split('/').pop()}`;
    }
    if (enDetails?.images?.logos && enDetails.images.logos.length > 0) {
      const enLogo = enDetails.images.logos.find((l: any) => l.iso_639_1 === 'en');
      const nullLogo = enDetails.images.logos.find((l: any) => !l.iso_639_1);
      const jaLogo = enDetails.images.logos.find((l: any) => l.iso_639_1 === 'ja');
      const koLogo = enDetails.images.logos.find((l: any) => l.iso_639_1 === 'ko');
      const viLogo = enDetails.images.logos.find((l: any) => l.iso_639_1 === 'vi');
      const logo = enLogo || nullLogo || jaLogo || koLogo || viLogo || enDetails.images.logos[0];
      if (logo) {
        return `https://image.tmdb.org/t/p/w500/${logo.file_path.split('/').pop()}`;
      }
    }
    return null;
  })();

  const imdbId = enDetails?.imdb_id || enDetails?.external_ids?.imdb_id;

  const hasBulkRatings = enDetails && ('imdb_rating' in enDetails || 'metacritic_score' in enDetails);

  const { data: imdbApiData } = useQuery({
    queryKey: ['imdb', imdbId],
    queryFn: async () => {
      if (!imdbId) return null;
      const res = await fetch(`/api/imdb-proxy?imdbId=${imdbId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!imdbId && shouldFetch && !hasBulkRatings,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const imdbRating = hasBulkRatings
    ? (enDetails.imdb_rating ? Number(enDetails.imdb_rating).toFixed(1) : null)
    : (imdbApiData?.rating?.aggregateRating ? imdbApiData.rating.aggregateRating.toFixed(1) : null);

  const metacriticScore = hasBulkRatings
    ? (enDetails.metacritic_score ?? null)
    : (imdbApiData?.metacritic?.score ?? null);

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleMouseEnter}
      onFocus={() => setShouldFetch(true)}
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
      className={cn("flex-shrink-0 cursor-pointer relative transition-shadow duration-300 group rounded-[16px] card-spring-hover", className || (aspectRatio === 'poster' ? "w-[150px] sm:w-[180px] md:w-[200px] lg:w-[220px]" : "w-[240px] sm:w-[280px] md:w-[310px] lg:w-[330px]"))}
    >
      <div className={cn("w-full relative bg-[#050505] rounded-[16px] overflow-hidden border border-white/5 group-hover:border-white/15 transition-all shadow-md", aspectRatio === 'poster' ? "aspect-[2/3]" : "aspect-[16/9]")}>
        <SafeImage src={finalThumb} alt={resolvedDisplayName} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        
        {/* Subtle vignette layer */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

        {progressData && (
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-600/50 z-30">
            <div className="h-full bg-[#FBC02D]" style={{ width: `${progressPercent}%` }} />
          </div>
        )}

        {/* Premium Logo/Text Overlay for Landscape cards (normal state, hides on hover) */}
        {aspectRatio === 'landscape' && (
          <div className="absolute bottom-3.5 left-3.5 right-3.5 z-10 pointer-events-none transition-all duration-300 md:group-hover:opacity-0 md:group-hover:translate-y-2 flex items-end">
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt={resolvedDisplayName} 
                className="max-h-[36px] sm:max-h-[46px] max-w-[80%] object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]"
                loading="lazy"
              />
            ) : (
              <span 
                className="text-white font-bold text-xs sm:text-sm tracking-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] line-clamp-2 leading-snug block"
                style={{ fontFamily: '"Be Vietnam Pro", sans-serif' }}
              >
                {resolvedDisplayName}
              </span>
            )}
          </div>
        )}

        {/* Interactive Overlay on Hover (Desktop only) */}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-transparent opacity-0 md:group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-4 z-20 pointer-events-auto">
          {/* Action Buttons */}
          <div className="flex items-center gap-2 mb-2.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect(movie.slug || movie.id);
              }}
              className="w-8 h-8 rounded-full bg-[#E50914] hover:bg-[#b80710] flex items-center justify-center text-white transition-transform active:scale-90 shadow-lg cursor-pointer"
            >
              <Play size={14} className="fill-current ml-0.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleListItem(movie);
              }}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center border transition-all active:scale-90 shadow-lg cursor-pointer",
                isSaved 
                  ? "bg-white border-white text-black hover:bg-neutral-200" 
                  : "bg-neutral-900/60 border-white/30 text-white hover:border-white hover:bg-neutral-800"
              )}
              title={isSaved ? "Xóa khỏi danh sách" : "Thêm vào danh sách"}
            >
              <Bookmark size={14} className={cn(isSaved && "fill-current")} />
            </button>
          </div>

          {/* Metadata Overlay */}
          {aspectRatio !== 'poster' && (
            <h4 className="text-white font-bold text-xs sm:text-sm leading-snug line-clamp-2 mb-1.5" style={{ fontFamily: '"Be Vietnam Pro", sans-serif' }}>
              {resolvedDisplayName}
            </h4>
          )}
          <div className="flex flex-wrap items-center gap-1.5 text-[9px] sm:text-[10px] font-bold text-gray-300">
            <span className="bg-[#E50914]/90 text-white px-1.5 py-0.5 rounded text-[8px] tracking-wide font-black uppercase shrink-0">
              {isTv ? "BỘ" : "LẺ"}
            </span>
            <span className="shrink-0">{year}</span>
            {imdbRating ? (
              <span className="flex items-center gap-0.5 bg-[#F5C518] text-black px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wide shrink-0">
                IMDb {imdbRating}
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-[#FBC02D] shrink-0">
                ★ <span className="text-white font-bold">{rating}</span>
              </span>
            )}
            {metacriticScore !== null && (
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[8px] font-black text-white shrink-0",
                metacriticScore >= 61 ? "bg-green-600" :
                metacriticScore >= 40 ? "bg-yellow-500 text-black" : "bg-red-600"
              )}>
                MC {metacriticScore}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}, (prev, next) => prev.movie.slug === next.movie.slug && prev.isTop10 === next.isTop10 && prev.progressData?.currentTime === next.progressData?.currentTime && prev.idx === next.idx);
