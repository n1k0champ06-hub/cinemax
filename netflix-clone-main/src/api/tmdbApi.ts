const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Hỗ trợ cả v3 API key (32 ký tự hex) và v4 Access Token (JWT dài)
const getTmdbToken = () => import.meta.env.VITE_TMDB_ACCESS_TOKEN || '';

const isV3ApiKey = (token: string) => {
  // v3 keys are 32-char hex strings; v4 tokens are long JWTs (eyJ...)
  return token.length <= 40 && !token.startsWith('eyJ');
};

export const fetchTmdb = async (endpoint: string, params: Record<string, string | number | boolean> = {}) => {
  try {
    const token = getTmdbToken();
    const defaultParams: Record<string, string> = { language: 'vi' };
    
    // Nếu là v3 API key, gửi qua query param
    if (token && isV3ApiKey(token)) {
      defaultParams['api_key'] = token;
    }

    const queryParams = new URLSearchParams({
      ...defaultParams,
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
    });

    // Nếu là v4 token (JWT), gửi qua Bearer header
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    if (token && !isV3ApiKey(token)) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${TMDB_BASE_URL}${endpoint}?${queryParams.toString()}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`TMDB error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('fetchTmdb error:', error);
    throw error;
  }
};

// Endpoints
export const tmdbSearchMulti = (query: string, page = 1) => 
  fetchTmdb('/search/multi', { query, page, include_adult: false });

export const tmdbSearchMovie = (query: string, page = 1) => 
  fetchTmdb('/search/movie', { query, page, include_adult: false });

export const tmdbSearchTv = (query: string, page = 1) => 
  fetchTmdb('/search/tv', { query, page, include_adult: false });

export const tmdbGetMovieDetails = (movieId: number | string) => 
  fetchTmdb(`/movie/${movieId}`, { append_to_response: 'credits,videos,recommendations,similar' });

export const tmdbGetTvDetails = (tvId: number | string) => 
  fetchTmdb(`/tv/${tvId}`, { append_to_response: 'credits,videos,recommendations,similar' });

export const tmdbGetPersonDetails = (personId: number | string) => 
  fetchTmdb(`/person/${personId}`, { append_to_response: 'combined_credits' });

export const tmdbGetTrending = (mediaType: 'all' | 'movie' | 'tv' = 'all', timeWindow: 'day' | 'week' = 'day') => 
  fetchTmdb(`/trending/${mediaType}/${timeWindow}`);

export const tmdbGetTopRated = (mediaType: 'movie' | 'tv' = 'movie', page = 1) => 
  fetchTmdb(`/${mediaType}/top_rated`, { page });

export const tmdbGetPopular = (mediaType: 'movie' | 'tv' = 'movie', page = 1) => 
  fetchTmdb(`/${mediaType}/popular`, { page });

export const tmdbDiscover = (mediaType: 'movie' | 'tv' = 'movie', params: Record<string, string | number | boolean> = {}) => 
  fetchTmdb(`/discover/${mediaType}`, params);

export const tmdbFindByExternalId = (externalId: string, source: 'imdb_id' | 'tvdb_id' = 'imdb_id') => 
  fetchTmdb(`/find/${externalId}`, { external_source: source });

export const tmdbGetNowPlaying = (mediaType: 'movie' | 'tv' = 'movie', page = 1) =>
  fetchTmdb(`/${mediaType}/${mediaType === 'movie' ? 'now_playing' : 'on_the_air'}`, { page });

export const tmdbGetVideos = (mediaType: 'movie' | 'tv', id: number | string) =>
  fetchTmdb(`/${mediaType}/${id}/videos`, { language: 'en' });

export const tmdbGetCredits = (mediaType: 'movie' | 'tv', id: number | string) =>
  fetchTmdb(`/${mediaType}/${id}/credits`);

export const tmdbGetTvSeasonDetails = (tvId: number | string, seasonNumber: number) =>
  fetchTmdb(`/tv/${tvId}/season/${seasonNumber}`);
