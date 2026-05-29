import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  tmdbSearchMulti,
  tmdbSearchMovie,
  tmdbSearchTv,
  tmdbGetMovieDetails,
  tmdbGetTvDetails,
  tmdbGetTvSeason,
  tmdbGetPersonDetails,
  tmdbGetTrending,
  tmdbGetTopRated,
  tmdbGetPopular,
  tmdbDiscover,
  tmdbFindByExternalId,
  tmdbGetExternalIds,
} from '../api/tmdbApi';

export const useTmdbRanking = (type: 'top250-movies' | 'top250-tv' | 'popular-movies' | 'popular-tv' | 'now-playing') => {
  return useQuery({
    queryKey: ['tmdb', 'ranking', type],
    queryFn: () => {
      if (type === 'top250-movies') return tmdbGetTopRated('movie', 1);
      if (type === 'top250-tv') return tmdbGetTopRated('tv', 1);
      if (type === 'popular-movies') return tmdbGetPopular('movie', 1);
      if (type === 'popular-tv') return tmdbGetPopular('tv', 1);
      if (type === 'now-playing') return tmdbGetTrending('movie', 'week');
      return tmdbGetTrending('all');
    },
    staleTime: 60 * 60 * 1000,
    placeholderData: keepPreviousData
  });
};

export const useTmdbDiscover = (mediaType: 'movie' | 'tv', params: Record<string, string | number | boolean>, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['tmdb', 'discover', mediaType, params],
    queryFn: () => tmdbDiscover(mediaType, params),
    staleTime: 60 * 60 * 1000,
    enabled: options?.enabled,
  });
};

export const useTmdbSearchAdvanced = (query: string, mediaType: 'movie' | 'tv' | '' = '', genreId: string = '', originalLanguage?: string) => {
  return useQuery({
    queryKey: ['tmdb', 'search_advanced', query, mediaType, genreId, originalLanguage],
    queryFn: async () => {
      const q = query.trim();
      if (!q) return { results: [] };

      // Helper to strip diacritics
      const removeVietnameseTones = (str: string) => {
        return str
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd')
          .replace(/Đ/g, 'D');
      };

      const typeToSearch = mediaType || 'multi';

      // 1. Try normal search with language: 'vi' (default)
      let res: any = null;
      try {
        if (typeToSearch === 'movie') {
          res = await tmdbSearchMovie(q);
        } else if (typeToSearch === 'tv') {
          res = await tmdbSearchTv(q);
        } else {
          res = await tmdbSearchMulti(q);
        }
      } catch (err) {
        console.error("Normal search failed:", err);
      }

      // If we got results, return them
      if (res && res.results && res.results.length > 0) {
        return res;
      }

      // 2. Try English / Language-free search (highly effective for matching original/English names in TMDB)
      try {
        const { fetchTmdb } = await import('../api/tmdbApi');
        let endpoint = '/search/multi';
        if (typeToSearch === 'movie') endpoint = '/search/movie';
        else if (typeToSearch === 'tv') endpoint = '/search/tv';

        const enRes = await fetchTmdb(endpoint, { query: q, language: 'en', include_adult: false });
        if (enRes && enRes.results && enRes.results.length > 0) {
          return enRes;
        }
      } catch (err) {
        console.error("English search fallback failed:", err);
      }

      // 3. Try searching with unaccented (no diacritics) Vietnamese version
      const cleanQ = removeVietnameseTones(q);
      if (cleanQ !== q) {
        try {
          if (typeToSearch === 'movie') {
            res = await tmdbSearchMovie(cleanQ);
          } else if (typeToSearch === 'tv') {
            res = await tmdbSearchTv(cleanQ);
          } else {
            res = await tmdbSearchMulti(cleanQ);
          }
          if (res && res.results && res.results.length > 0) {
            return res;
          }
        } catch (err) {
          console.error("Unaccented search failed:", err);
        }
      }

      // 4. Try word-by-word/reduced-phrase fallback for typos:
      // If the query has multiple words, sometimes they write long titles with parts they got wrong.
      const words = q.split(/\s+/).filter(w => w.length > 1);
      if (words.length > 2) {
        // Try looking up using just the first 2 or 3 words (often the core title name)
        const subQuery = words.slice(0, Math.min(3, words.length - 1)).join(" ");
        try {
          const subRes = await (
            typeToSearch === 'movie' ? tmdbSearchMovie(subQuery) :
            typeToSearch === 'tv' ? tmdbSearchTv(subQuery) :
            tmdbSearchMulti(subQuery)
          );
          if (subRes && subRes.results && subRes.results.length > 0) {
            return subRes;
          }
        } catch (err) {
          console.error("Subquery fallback search failed:", err);
        }
      }

      return { results: [] };
    },
    enabled: !!query,
    staleTime: 5 * 60 * 1000,
  });
};

export const useTmdbSearch = (query: string, type: 'multi' | 'movie' | 'tv' = 'multi', page = 1) => {
  return useQuery({
    queryKey: ['tmdb', 'search', type, query, page],
    queryFn: () => {
      if (type === 'movie') return tmdbSearchMovie(query, page);
      if (type === 'tv') return tmdbSearchTv(query, page);
      return tmdbSearchMulti(query, page);
    },
    enabled: !!query,
  });
};

export const useTmdbDetails = (id: string | number | null | undefined, type: 'movie' | 'tv') => {
  const isIdValid = !!id && id !== 0 && id !== '0' && id !== 'undefined' && id !== 'null' && String(id).trim() !== '';
  return useQuery({
    queryKey: ['tmdb', 'details', type, id],
    queryFn: () => {
      if (type === 'movie') return tmdbGetMovieDetails(id!);
      return tmdbGetTvDetails(id!);
    },
    enabled: isIdValid,
    staleTime: 60 * 60 * 1000,
    placeholderData: keepPreviousData
  });
};

export const useTmdbTvSeason = (tvId: string | number | null | undefined, seasonNumber: number | string | null | undefined) => {
  const isIdValid = !!tvId && tvId !== 0 && tvId !== '0' && tvId !== 'undefined' && tvId !== 'null' && String(tvId).trim() !== '';
  const isSeasonValid = seasonNumber !== null && seasonNumber !== undefined && String(seasonNumber).trim() !== '';
  return useQuery({
    queryKey: ['tmdb', 'season', tvId, seasonNumber],
    queryFn: () => tmdbGetTvSeason(tvId!, seasonNumber!),
    enabled: isIdValid && isSeasonValid,
    staleTime: 60 * 60 * 1000,
  });
};

export const useTmdbCollection = (collectionId: string | number | null | undefined) => {
  const isIdValid = !!collectionId && collectionId !== 0 && collectionId !== '0' && collectionId !== 'undefined' && collectionId !== 'null' && String(collectionId).trim() !== '';
  return useQuery({
    queryKey: ['tmdb', 'collection', collectionId],
    queryFn: async () => {
      const { tmdbGetCollection } = await import('../api/tmdbApi');
      return tmdbGetCollection(collectionId!);
    },
    enabled: isIdValid,
    staleTime: 60 * 60 * 1000,
  });
};

export const useTmdbPerson = (personId: string | number | null | undefined) => {
  const isIdValid = !!personId && personId !== 0 && personId !== '0' && personId !== 'undefined' && personId !== 'null' && String(personId).trim() !== '';
  return useQuery({
    queryKey: ['tmdb', 'person', personId],
    queryFn: () => tmdbGetPersonDetails(personId!),
    enabled: isIdValid,
    staleTime: 60 * 60 * 1000,
  });
};

export const useTmdbTrending = (mediaType: 'all' | 'movie' | 'tv' = 'all', timeWindow: 'day' | 'week' = 'day') => {
  return useQuery({
    queryKey: ['tmdb', 'trending', mediaType, timeWindow],
    queryFn: () => tmdbGetTrending(mediaType, timeWindow),
    staleTime: 60 * 60 * 1000,
  });
};

// Use this to resolve IMDB ID to TMDB ID if needed
export const useTmdbFindByExternalId = (externalId: string, source: 'imdb_id' | 'tvdb_id' = 'imdb_id') => {
  return useQuery({
    queryKey: ['tmdb', 'find', source, externalId],
    queryFn: () => tmdbFindByExternalId(externalId, source),
    enabled: !!externalId,
    staleTime: 24 * 60 * 60 * 1000,
  });
};

/** Fetch external IDs (imdb_id, tvdb_id, etc.) for a movie or TV show from TMDB. */
export const useTmdbExternalIds = (
  id: number | string | null | undefined,
  mediaType: 'movie' | 'tv'
) => {
  const isIdValid =
    !!id &&
    id !== 0 &&
    id !== '0' &&
    id !== 'undefined' &&
    id !== 'null' &&
    String(id).trim() !== '';

  return useQuery({
    queryKey: ['tmdb', 'external_ids', mediaType, id],
    queryFn: () => tmdbGetExternalIds(mediaType, id!),
    enabled: isIdValid,
    staleTime: 24 * 60 * 60 * 1000, // external IDs rarely change
  });
};
