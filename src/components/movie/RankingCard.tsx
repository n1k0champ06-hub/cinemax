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

export const RankingCard = ({ movie, idx, onSelect, type }: { key?: React.Key, movie: any, idx: number, onSelect: (slug: string) => void, type?: string }) => {
  const prefetch = usePrefetchMovie();
  const slug = movie.slug || movie.id;
  const name = movie.name || movie.title || '';

  const isOriginallyTvPattern = /phần|season|tập|mùa|part|\b(tv|series)\b/i.test(name);
  const isTv = type?.includes('tv') || movie?.type === 'series' || movie?.type === 'hoathinh' || movie?.tmdb?.media_type === 'tv' || (typeof movie?.slug === 'string' && movie.slug.endsWith('-tv')) || isOriginallyTvPattern;
  const tmdbId = movie?.tmdb_id || movie?.tmdb?.id;

  // React Query will cache TMDB details queries automatically and efficiently
  const { data: tmdbDetails } = useQuery({
    queryKey: ['tmdb', 'details', isTv ? 'tv' : 'movie', tmdbId || name],
    queryFn: async () => {
      const { tmdbGetMovieDetails, tmdbGetTvDetails, tmdbSearchMovie, tmdbSearchTv, tmdbSearchMulti } = await import('../../api/tmdbApi');
      let targetId = tmdbId;

      if (!targetId && name) {
        const cleaned = cleanSearchName(name);
        const searchResults = isTv 
          ? await tmdbSearchTv(cleaned) 
          : await tmdbSearchMovie(cleaned);
        
        let firstResult = searchResults?.results?.[0];
        if (!firstResult && cleaned !== name) {
          const retryResults = isTv 
            ? await tmdbSearchTv(name) 
            : await tmdbSearchMovie(name);
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
    enabled: !!tmdbId || !!name,
    staleTime: 1000 * 60 * 30, // 30 minutes cache
  });

  // Favor English promotional banners containing baked-in text/artwork to avoid manual text overlay
  const englishBackdropFile = tmdbDetails?.images?.backdrops?.find((b: any) => b.iso_639_1 === 'en')?.file_path;
  const englishBackdropUrl = englishBackdropFile ? `https://image.tmdb.org/t/p/w500/${englishBackdropFile}` : null;

  const safeThumb = movie?.tmdb?.backdrop_path 
    ? (movie.tmdb.backdrop_path.startsWith('http') ? movie.tmdb.backdrop_path : `https://image.tmdb.org/t/p/w500/${movie.tmdb.backdrop_path.split('/').pop()}`) 
    : (movie.thumb_url || movie.poster_url || "");

  const finalThumb = englishBackdropUrl || safeThumb;

  const rating = movie?.tmdb?.vote_average ? Number(movie.tmdb.vote_average).toFixed(1) : "?";
  const year = movie?.tmdb?.release_date ? movie.tmdb.release_date.split('-')[0] : (movie?.tmdb?.first_air_date ? movie.tmdb.first_air_date.split('-')[0] : (movie.year || ""));

  return (
    <div 
      className="relative flex flex-col group cursor-pointer w-[240px] sm:w-[280px] md:w-[310px] shrink-0" 
      onMouseEnter={() => prefetch(movie)}
      onTouchStart={() => prefetch(movie)}
      onClick={() => onSelect(slug)}
    >
      {/* Container with the big number and horizontal card */}
      <div className="relative w-full aspect-[16/9] flex items-end">
        {/* Horizontal 16:9 Image Card */}
        <div className="w-full h-full relative rounded-2xl overflow-hidden bg-[#050505] border border-white/5 group-hover:border-white/15 transition-all shadow-xl">
          <SafeImage src={finalThumb} alt={name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
          
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
          {name}
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
