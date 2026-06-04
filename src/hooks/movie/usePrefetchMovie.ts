import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { fetchSearch, fetchDetail } from '../../api/phimApi';
import { tmdbGetMovieDetails, tmdbGetTvDetails } from '../../api/tmdbApi';
import { computeMatchScore, setResolvedSlug } from '../../utils/movieMatcher';

export const usePrefetchMovie = () => {
  const queryClient = useQueryClient();

  const prefetch = useCallback(async (movie: any) => {
    if (!movie) return;

    const rawSlug = movie.slug || movie.id || '';
    const isTmdbSlug = typeof rawSlug === 'string' && rawSlug.startsWith('tmdb-');

    if (isTmdbSlug) {
      const parts = rawSlug.split('-');
      const tmdbId = parts[1];
      const type = parts[2] as 'movie' | 'tv';

      if (tmdbId) {
        // 1. Prefetch TMDB details (cast, tags, backdrop, crew)
        queryClient.prefetchQuery({
          queryKey: ['tmdb', 'details', type, tmdbId],
          queryFn: () => type === 'movie' ? tmdbGetMovieDetails(tmdbId) : tmdbGetTvDetails(tmdbId),
          staleTime: 60 * 60 * 1000,
        });

        // 2. Prefetch phim api search query
        const primaryTitle = movie.tmdb?.original_title || movie.tmdb?.original_name || movie.origin_name || movie.original_name || movie.original_title;
        if (primaryTitle) {
          try {
            // First run fetchQuery so we get the search results promise we can examine
            const searchResults = await queryClient.fetchQuery({
              queryKey: ['phimapi_search', primaryTitle],
              queryFn: () => fetchSearch(primaryTitle),
              staleTime: 60 * 60 * 1000,
            });

            // 3. Compute best match score and prefetch actual detail metadata in background!
            if (searchResults && searchResults.length > 0) {
              const tmdbInfo = {
                original_title: movie.tmdb?.original_title || movie.tmdb?.original_name || movie.origin_name || movie.original_name || '',
                title: movie.tmdb?.title || movie.tmdb?.name || movie.name || movie.title || '',
                year: parseInt((movie.tmdb?.release_date || movie.tmdb?.first_air_date || '').substring(0, 4)) || parseInt(movie.year) || 0
              };

              const scoredMatches = searchResults.map((item: any) => ({
                item,
                score: computeMatchScore(item, tmdbInfo)
              })).sort((a: any, b: any) => b.score - a.score);

              const bestMatch = scoredMatches[0];
              if (bestMatch && bestMatch.score >= 80) {
                const bestSlug = bestMatch.item.slug;
                setResolvedSlug(rawSlug, bestSlug);

                // Prefetch the detail data of matching slug on streaming server!
                queryClient.prefetchQuery({
                  queryKey: ["detail", bestSlug],
                  queryFn: () => fetchDetail(bestSlug),
                  staleTime: 60 * 60 * 1000,
                });
              } else {
                setResolvedSlug(rawSlug, "resolved-" + rawSlug);
              }
            } else {
              setResolvedSlug(rawSlug, "resolved-" + rawSlug);
            }
          } catch (err) {
            // Silence background prefetch errors to prevent UI impact
            console.warn("Background prefetch warning:", err);
          }
        }
      }
    } else if (rawSlug && typeof rawSlug === 'string' && !rawSlug.startsWith('tmdb-') && !rawSlug.startsWith('mal-')) {
      // If it is already a direct slug, just prefetch the phim api detail!
      queryClient.prefetchQuery({
        queryKey: ["detail", rawSlug],
        queryFn: () => fetchDetail(rawSlug),
        staleTime: 60 * 60 * 1000,
      });
    }
  }, [queryClient]);

  return prefetch;
};
