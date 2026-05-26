import { useQuery } from '@tanstack/react-query';
import {
  tmdbSearchMulti,
  tmdbSearchMovie,
  tmdbSearchTv,
  tmdbGetMovieDetails,
  tmdbGetTvDetails,
  tmdbGetPersonDetails,
  tmdbGetTrending,
  tmdbGetTopRated,
  tmdbGetPopular,
  tmdbDiscover,
  tmdbFindByExternalId,
  tmdbGetNowPlaying,
  tmdbGetVideos,
  tmdbGetCredits,
  tmdbGetTvSeasonDetails
} from '../api/tmdbApi';

const TMDB_CACHE_TIME = 24 * 60 * 60 * 1000; // 24 giờ

export const useTmdbRanking = (type: 'top250-movies' | 'top250-tv' | 'popular-movies' | 'popular-tv' | 'now-playing' | 'trending-week') => {
  return useQuery({
    queryKey: ['tmdb', 'ranking', type],
    queryFn: () => {
      if (type === 'top250-movies') return tmdbGetTopRated('movie', 1);
      if (type === 'top250-tv') return tmdbGetTopRated('tv', 1);
      if (type === 'popular-movies') return tmdbGetPopular('movie', 1);
      if (type === 'popular-tv') return tmdbGetPopular('tv', 1);
      if (type === 'now-playing') return tmdbGetNowPlaying('movie', 1);
      if (type === 'trending-week') return tmdbGetTrending('all', 'week');
      return tmdbGetTrending('all');
    },
    staleTime: TMDB_CACHE_TIME,
  });
};

export const useTmdbDiscover = (mediaType: 'movie' | 'tv', params: Record<string, string | number | boolean>) => {
  return useQuery({
    queryKey: ['tmdb', 'discover', mediaType, params],
    queryFn: () => tmdbDiscover(mediaType, params),
    staleTime: TMDB_CACHE_TIME,
  });
};

export const useTmdbSearchAdvanced = (query: string, mediaType: 'movie' | 'tv' | '', genreId: string) => {
  return useQuery({
    queryKey: ['tmdb', 'search_advanced', query, mediaType, genreId],
    queryFn: async () => {
      // If there's a keyword, we must use /search
      if (query.trim()) {
        const typeToSearch = mediaType || 'multi';
        const res = await (
          typeToSearch === 'movie' ? tmdbSearchMovie(query) : 
          typeToSearch === 'tv' ? tmdbSearchTv(query) : 
          tmdbSearchMulti(query)
        );
        // Fallback filter by genre manually if genre selected (not precise but works)
        if (genreId && res.results) {
          return {
            ...res,
            results: res.results.filter((item: any) => item.genre_ids?.includes(Number(genreId)))
          };
        }
        return res;
      } else {
        // If no keyword but genre/type is selected, use /discover
        const typeToSearch = mediaType || 'movie'; // discover requires specific type
        const params: any = {};
        if (genreId) params.with_genres = genreId;
        return tmdbDiscover(typeToSearch, params);
      }
    },
    enabled: !!query || !!mediaType || !!genreId,
    staleTime: TMDB_CACHE_TIME,
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
    staleTime: TMDB_CACHE_TIME,
  });
};

export const useTmdbDetails = (id: string | number, type: 'movie' | 'tv') => {
  return useQuery({
    queryKey: ['tmdb', 'details', type, id],
    queryFn: () => {
      if (type === 'movie') return tmdbGetMovieDetails(id);
      return tmdbGetTvDetails(id);
    },
    enabled: !!id && id !== 0,
    staleTime: TMDB_CACHE_TIME,
  });
};

export const useTmdbPerson = (personId: string | number | null) => {
  return useQuery({
    queryKey: ['tmdb', 'person', personId],
    queryFn: () => tmdbGetPersonDetails(personId!),
    enabled: !!personId,
    staleTime: TMDB_CACHE_TIME,
  });
};

export const useTmdbTrending = (mediaType: 'all' | 'movie' | 'tv' = 'all', timeWindow: 'day' | 'week' = 'day') => {
  return useQuery({
    queryKey: ['tmdb', 'trending', mediaType, timeWindow],
    queryFn: () => tmdbGetTrending(mediaType, timeWindow),
    staleTime: TMDB_CACHE_TIME,
  });
};

// Use this to resolve IMDB ID to TMDB ID if needed
export const useTmdbFindByExternalId = (externalId: string, source: 'imdb_id' | 'tvdb_id' = 'imdb_id') => {
  return useQuery({
    queryKey: ['tmdb', 'find', source, externalId],
    queryFn: () => tmdbFindByExternalId(externalId, source),
    enabled: !!externalId,
    staleTime: TMDB_CACHE_TIME,
  });
};

// Lấy trailer từ TMDB Videos API (ưu tiên hơn KinoCheck)
export const useTmdbVideos = (mediaType: 'movie' | 'tv', id: number | string | null | undefined) => {
  return useQuery({
    queryKey: ['tmdb', 'videos', mediaType, id],
    queryFn: async () => {
      if (!id) return null;
      const data = await tmdbGetVideos(mediaType, id);
      if (!data?.results?.length) return null;
      // Ưu tiên: Official Trailer > Trailer > Teaser
      const official = data.results.find((v: any) => v.type === 'Trailer' && v.official && v.site === 'YouTube');
      const trailer = data.results.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube');
      const teaser = data.results.find((v: any) => v.type === 'Teaser' && v.site === 'YouTube');
      const anyYt = data.results.find((v: any) => v.site === 'YouTube');
      const best = official || trailer || teaser || anyYt;
      return best?.key || null; // YouTube video ID
    },
    enabled: !!id,
    staleTime: TMDB_CACHE_TIME,
  });
};

// Lấy now playing (đang chiếu rạp)
export const useTmdbNowPlaying = (mediaType: 'movie' | 'tv' = 'movie', page = 1) => {
  return useQuery({
    queryKey: ['tmdb', 'now_playing', mediaType, page],
    queryFn: () => tmdbGetNowPlaying(mediaType, page),
    staleTime: TMDB_CACHE_TIME,
  });
};

// Lấy thông tin chi tiết từng tập phim (overview, still_path) từ TMDB TV Seasons API
export const useTmdbSeasonEpisodes = (tvId: number | string | null | undefined, seasonNumber: number) => {
  return useQuery({
    queryKey: ['tmdb', 'season', tvId, seasonNumber],
    queryFn: () => tmdbGetTvSeasonDetails(tvId!, seasonNumber),
    enabled: !!tvId && seasonNumber > 0,
    staleTime: TMDB_CACHE_TIME,
  });
};
