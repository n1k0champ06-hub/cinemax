import React from 'react';
import { motion } from 'motion/react';
import { Bookmark, Play } from 'lucide-react';
import { SafeImage } from '../ui/ImageShimmer';
import { usePrefetchMovie } from '../../hooks/movie/usePrefetchMovie';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '../../lib/utils';
import { useMyList } from '../../hooks/useStorage';

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

const containsNonLatin = (nameStr: string): boolean => {
  if (!nameStr) return false;
  // Match any string that contains only basic Latin, numbers, common symbols, Vietnamese, and European Latin accents
  const allowedPattern = /^[a-zA-Z0-9\s.,'":;\-!?&()\[\]\/+*%#@$_~`|<>•·ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂÂÊÔƠưăâêôơéèàùçâêîôûëïüÿñíóúáäößÉÈÀÙÇÂÊÎÔÛËÏÜŸÑÍÓÚÁÄÖ\u0300-\u036f]*$/;
  return !allowedPattern.test(nameStr);
};

export const RankingCard = React.memo(({ movie, idx, onSelect, type, rowTitle, enDetails: passedEnDetails, aniListCover: passedAniListCover, aspectRatio = 'landscape', isAnime: passedIsAnime }: { key?: React.Key, movie: any, idx: number, onSelect: (slug: string) => void, type?: string, rowTitle?: string, enDetails?: any, aniListCover?: any, aspectRatio?: 'landscape' | 'poster', isAnime?: boolean }) => {
  const prefetch = usePrefetchMovie();
  const slug = movie.slug || movie.id;
  const name = movie.name || movie.title || '';
  const { myList, toggleListItem } = useMyList();
  const isSaved = myList.some((m: any) => m.slug === slug);

  const isOriginallyTvPattern = /phần|season|tập|mùa|part|\b(tv|series)\b/i.test(name);
  const isTv = type?.includes('tv') || movie?.type === 'series' || movie?.type === 'hoathinh' || movie?.tmdb?.media_type === 'tv' || (typeof movie?.slug === 'string' && movie.slug.endsWith('-tv')) || isOriginallyTvPattern;
  const tmdbId = movie?.tmdb_id || movie?.tmdb?.id || (typeof slug === 'string' && slug.startsWith('tmdb-') ? slug.split('-')[1] : null);

  const isTargetNonLatin = containsNonLatin(name);
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

  const isAnime = passedIsAnime || movie?.isJikan || 
    (typeof slug === 'string' && (slug.startsWith('anilist-') || slug.startsWith('mal-') || slug.startsWith('jikan-') || /^\d+$/.test(slug))) || 
    movie?.media_type === 'anime' || 
    (rowTitle && /anime|hoạt hình/i.test(rowTitle));

  const resolvedDisplayName = isAnime ? name : (enDetails?.title || enDetails?.name || name);

  const { data: fetchedAniListCover } = useQuery({
    queryKey: ['anilist', 'cover', resolvedDisplayName],
    queryFn: async () => {
      const { fetchAniListCover } = await import('../../api/anilistApi');
      return fetchAniListCover(resolvedDisplayName);
    },
    enabled: !passedAniListCover && !!isAnime && !!resolvedDisplayName && shouldFetch,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const aniListCover = passedAniListCover || fetchedAniListCover;

  const aniPoster = aniListCover?.extraLarge || aniListCover?.large;
  const aniThumb = aniListCover?.banner || aniListCover?.extraLarge || aniListCover?.large;

  const enBackdrop = enDetails?.backdrop_path ? `https://image.tmdb.org/t/p/w500/${enDetails.backdrop_path.split('/').pop()}` : null;
  const enPoster = enDetails?.poster_path ? `https://image.tmdb.org/t/p/w500/${enDetails.poster_path.split('/').pop()}` : null;
  const rawPoster = movie?.tmdb?.poster_path 
    ? (movie.tmdb.poster_path.startsWith('http') ? movie.tmdb.poster_path : `https://image.tmdb.org/t/p/w500/${movie.tmdb.poster_path.split('/').pop()}`) 
    : movie.poster_url;
  const rawThumb = movie?.tmdb?.backdrop_path 
    ? (movie.tmdb.backdrop_path.startsWith('http') ? movie.tmdb.backdrop_path : `https://image.tmdb.org/t/p/w500/${movie.tmdb.backdrop_path.split('/').pop()}`) 
    : (movie.thumb_url || movie.poster_url || "");

  const safePoster = enPoster || aniPoster || rawPoster;
  const safeThumb = enBackdrop || aniThumb || rawThumb;

  const finalThumb = aspectRatio === 'poster' ? (safePoster || safeThumb) : safeThumb;

  const rating = movie?.tmdb?.vote_average ? Number(movie.tmdb.vote_average).toFixed(1) : "?";
  const year = movie?.tmdb?.release_date ? movie.tmdb.release_date.split('-')[0] : (movie?.tmdb?.first_air_date ? movie.tmdb.first_air_date.split('-')[0] : (movie.year || ""));

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
      className={cn(
        "relative flex flex-col group cursor-pointer shrink-0 card-spring-hover", 
        aspectRatio === 'poster' ? "w-[150px] sm:w-[180px] md:w-[200px] lg:w-[220px]" : "w-[240px] sm:w-[280px] md:w-[310px]"
      )} 
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleMouseEnter}
      onFocus={() => setShouldFetch(true)}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const clickDetails = {
          component: "RankingCard",
          title: resolvedDisplayName,
          slug: slug,
          type: isTv ? "tv" : "movie",
          tmdbId: tmdbId || 'none',
          positionIndex: idx,
          rank: idx + 1,
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
          `%c[USER ACTION: CLICK]%c Ranking Card (Top ${idx + 1}): "${resolvedDisplayName}" inside row "${rowTitle || 'unknown'}"`,
          'background: #E50914; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
          'color: #ffffff; font-weight: bold;',
          clickDetails
        );
        onSelect(slug);
      }}
    >
      {/* Container with the big number and card */}
      <div className={cn("relative w-full flex items-end", aspectRatio === 'poster' ? "aspect-[2/3]" : "aspect-[16/9]")}>
        {/* Image Card */}
        <div className="w-full h-full relative rounded-2xl overflow-hidden bg-[#050505] border border-white/5 group-hover:border-white/15 transition-all shadow-xl">
          <SafeImage src={finalThumb} alt={resolvedDisplayName} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
          
          {/* Subtle vignette overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

          {/* Premium Logo/Text Overlay for Landscape ranking cards (normal state, hides on hover) */}
          {aspectRatio === 'landscape' && (
            <div 
              className={cn(
                "absolute bottom-3.5 z-10 pointer-events-none transition-all duration-300 md:group-hover:opacity-0 md:group-hover:translate-y-2 flex items-end",
                idx >= 9 ? "left-[80px] sm:left-[96px] md:left-[112px]" : "left-[56px] sm:left-[72px] md:left-[80px]"
              )}
            >
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
                  onSelect(slug);
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
              {year && <span className="shrink-0">{year}</span>}
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

          {/* Giant Number solid and semi-transparent inside the corner */}
          <div 
            className={cn(
              "absolute font-black leading-none select-none z-30 pointer-events-none text-white/20 md:group-hover:opacity-0 transition-all duration-300 md:group-hover:scale-90",
              aspectRatio === 'poster' 
                ? "text-[42px] sm:text-[50px] md:text-[56px] left-2.5 bottom-0.5" 
                : "text-[52px] sm:text-[62px] md:text-[72px] left-3 bottom-1"
            )}
            style={{
              fontFamily: '"Space Grotesk", sans-serif',
              textShadow: '0 4px 14px rgba(0,0,0,0.6)'
            }}
          >
            {idx + 1}
          </div>
        </div>
      </div>
    </div>
  );
});
