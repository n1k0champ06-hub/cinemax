import React from 'react';
import { SafeImage } from '../ui/ImageShimmer';
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

const containsNonLatin = (nameStr: string): boolean => {
  if (!nameStr) return false;
  // Match any string that contains only basic Latin, numbers, common symbols, Vietnamese, and European Latin accents
  const allowedPattern = /^[a-zA-Z0-9\s.,'":;\-!?&()\[\]\/+*%#@$_~`|<>•·ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂÂÊÔƠưăâêôơéèàùçâêîôûëïüÿñíóúáäößÉÈÀÙÇÂÊÎÔÛËÏÜŸÑÍÓÚÁÄÖ\u0300-\u036f]*$/;
  return !allowedPattern.test(nameStr);
};

export const RankingCard = ({ movie, idx, onSelect, type, rowTitle }: { key?: React.Key, movie: any, idx: number, onSelect: (slug: string) => void, type?: string, rowTitle?: string }) => {
  const prefetch = usePrefetchMovie();
  const slug = movie.slug || movie.id;
  const name = movie.name || movie.title || '';

  const isOriginallyTvPattern = /phần|season|tập|mùa|part|\b(tv|series)\b/i.test(name);
  const isTv = type?.includes('tv') || movie?.type === 'series' || movie?.type === 'hoathinh' || movie?.tmdb?.media_type === 'tv' || (typeof movie?.slug === 'string' && movie.slug.endsWith('-tv')) || isOriginallyTvPattern;
  const tmdbId = movie?.tmdb_id || movie?.tmdb?.id || (typeof slug === 'string' && slug.startsWith('tmdb-') ? slug.split('-')[1] : null);

  const isTargetNonLatin = containsNonLatin(name);

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

  const resolvedDisplayName = enDetails?.title || enDetails?.name || name;

  const isAnime = movie?.isJikan || 
    (typeof slug === 'string' && (slug.startsWith('mal-') || slug.startsWith('jikan-') || /^\d+$/.test(slug))) || 
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

  const aniThumb = aniListCover?.banner || aniListCover?.extraLarge || aniListCover?.large;

  const enBackdrop = enDetails?.backdrop_path ? `https://image.tmdb.org/t/p/w500/${enDetails.backdrop_path.split('/').pop()}` : null;
  const rawThumb = movie?.tmdb?.backdrop_path 
    ? (movie.tmdb.backdrop_path.startsWith('http') ? movie.tmdb.backdrop_path : `https://image.tmdb.org/t/p/w500/${movie.tmdb.backdrop_path.split('/').pop()}`) 
    : (movie.thumb_url || movie.poster_url || "");

  const finalThumb = aniThumb || enBackdrop || rawThumb;

  const rating = movie?.tmdb?.vote_average ? Number(movie.tmdb.vote_average).toFixed(1) : "?";
  const year = movie?.tmdb?.release_date ? movie.tmdb.release_date.split('-')[0] : (movie?.tmdb?.first_air_date ? movie.tmdb.first_air_date.split('-')[0] : (movie.year || ""));

  return (
    <div 
      className="relative flex flex-col group cursor-pointer w-[240px] sm:w-[280px] md:w-[310px] shrink-0" 
      onMouseEnter={() => prefetch(movie)}
      onTouchStart={() => prefetch(movie)}
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
      {/* Container with the big number and horizontal card */}
      <div className="relative w-full aspect-[16/9] flex items-end">
        {/* Horizontal 16:9 Image Card */}
        <div className="w-full h-full relative rounded-2xl overflow-hidden bg-[#050505] border border-white/5 group-hover:border-white/15 transition-all shadow-xl">
          <SafeImage src={finalThumb} alt={resolvedDisplayName} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
          
          {/* Subtle vignette overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

          {/* Giant Number solid and semi-transparent inside the corner */}
          <div 
            className="absolute left-3 bottom-1 text-[52px] sm:text-[62px] md:text-[72px] font-black leading-none select-none z-20 pointer-events-none text-white/20 group-hover:text-white/90 transition-all duration-300 group-hover:scale-105 group-hover:translate-x-1"
            style={{
              fontFamily: '"Space Grotesk", sans-serif',
              textShadow: '0 4px 14px rgba(0,0,0,0.6)'
            }}
          >
            {idx + 1}
          </div>
        </div>
      </div>

      {/* Styled Metadata underneath */}
      <div className="mt-3 flex flex-col gap-1 pr-1 overflow-hidden pointer-events-none w-full">
        <h3 className="text-white font-bold text-sm sm:text-base leading-snug truncate group-hover:text-[#e50914] transition-colors duration-300">
          {resolvedDisplayName}
        </h3>
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
          <span className="bg-white/10 text-white border border-white/5 px-1.5 py-0.5 rounded text-[9px] tracking-wide font-black uppercase">
            {isTv ? "PHIM BỘ" : "PHIM LẺ"}
          </span>
          {year && <span>{year}</span>}
          <span className="flex items-center gap-0.5 text-[#FBC02D]">
            ★ <span className="text-white font-semibold">{rating}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
