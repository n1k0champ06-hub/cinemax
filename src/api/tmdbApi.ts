/// <reference types="vite/client" />

// Có thể dùng Cloudflare Proxy để giấu API
const USE_PROXY = true;
export const TMDB_BASE_URL = 'https://focusflow.id.vn/tmdb';

// Nếu dùng PROXY thì client sẽ KHÔNG truyền token nữa (để ẩn token)
// Hãy cấu hình biến môi trường VITE_TMDB_ACCESS_TOKEN (hoặc TMDB_ACCESS_TOKEN) trên Cloudflare Dashboard hoặc wrangler.json

// Helper to resolve TMDB token safely
const getTmdbToken = () => {
  let token = '';
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      token = import.meta.env.VITE_TMDB_ACCESS_TOKEN || '';
    }
  } catch (e) {}

  if (!token && typeof process !== 'undefined' && process.env) {
    token = process.env.VITE_TMDB_ACCESS_TOKEN || process.env.TMDB_ACCESS_TOKEN || '';
  }

  token = token.replace(/^"(.*)"$/, '$1').trim(); // Strip quotes if any

  if (!token || token === 'https://api.example.com' || token.includes('example.com')) {
    // Obfuscated token per user request
    const parts = [
      "eyJhbGciOiJIUzI1NiJ9",
      "eyJhdWQiOiJlODBkOGQxMDIyNDFlZTllNGY3MmU0YmIxMjA5YWI2YSIsIm5iZiI6MTc3Nzg2NDcyOS4wNiwic3ViIjoiNjlmODEwMTk4MWQwYmZlNTcwYzYwMDMzIiwic2NvcGVzIjpbImFwaV9yZWFkIl0sInZlcnNpb24iOjF9",
      "JH8fusjlUu3Ed8HAJRmY-A-aOio1VRoKW-_Aiot17Og"
    ];
    token = parts.join(".");
  }
  return token;
};

const isV3ApiKey = (token: string) => {
  // v3 keys are 32-char hex strings; v4 tokens are long JWTs (eyJ...)
  return token.length <= 40 && !token.startsWith('eyJ');
};

export const fetchTmdb = async (endpoint: string, params: Record<string, string | number | boolean> = {}) => {
  const defaultParams: Record<string, string> = { language: 'vi' };
  
  // If proxy is enabled, we let the backend attach authorization headers to hide the token
  if (!USE_PROXY) {
    const token = getTmdbToken();
    let finalApiKey = 'e80d8d102241ee9e4f72e4bb1209ab6a'; // Standard fallback
    if (token) {
      if (isV3ApiKey(token)) {
        finalApiKey = token;
      } else {
        // Decode JWT token "aud" claim (it contains the v3 api_key) to bypass CORS preflight checks in the browser!
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            while (base64.length % 4) {
              base64 += '=';
            }
            const decodedPayload = typeof window !== 'undefined' 
              ? window.atob(base64) 
              : Buffer.from(base64, 'base64').toString('utf-8');
            const payload = JSON.parse(decodedPayload);
            if (payload.aud && payload.aud.length === 32) {
              finalApiKey = payload.aud;
            }
          }
        } catch (e) {
          console.warn('Failed to parse TMDB JWT aud claim. Will fallback to default API key.', e);
        }
      }
    }
    defaultParams['api_key'] = finalApiKey;
  }
  
  const queryParamsObj: Record<string, string> = {
    ...defaultParams,
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
  };

  const queryParams = new URLSearchParams(queryParamsObj);
  const finalUrl = `${TMDB_BASE_URL}${endpoint}?${queryParams.toString()}`;

  const response = await fetch(finalUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`TMDB error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
};

// Endpoints
export const tmdbSearchMulti = (query: string, page = 1) => 
  fetchTmdb('/search/multi', { query, page, include_adult: false });

export const tmdbSearchMovie = (query: string, page = 1) => 
  fetchTmdb('/search/movie', { query, page, include_adult: false });

export const tmdbSearchTv = (query: string, page = 1) => 
  fetchTmdb('/search/tv', { query, page, include_adult: false });

export const tmdbGetMovieDetails = (movieId: number | string) => 
  fetchTmdb(`/movie/${movieId}`, { 
    append_to_response: 'credits,videos,recommendations,similar,images,release_dates,translations',
    include_image_language: 'en,null,vi,ja,ko,zh'
  });

export const tmdbGetTvDetails = (tvId: number | string) => 
  fetchTmdb(`/tv/${tvId}`, { 
    append_to_response: 'credits,videos,recommendations,similar,images,content_ratings,translations',
    include_image_language: 'en,null,vi,ja,ko,zh'
  });

export const tmdbGetTvSeason = (tvId: number | string, seasonNumber: number | string) => 
  fetchTmdb(`/tv/${tvId}/season/${seasonNumber}`);

export const tmdbGetCollection = (collectionId: number | string) =>
  fetchTmdb(`/collection/${collectionId}`);

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

/** Fetch external IDs (imdb_id, tvdb_id, etc.) for a movie or TV show */
export const tmdbGetExternalIds = (mediaType: 'movie' | 'tv', id: number | string) =>
  fetchTmdb(`/${mediaType}/${id}/external_ids`);

// ─── Responsive Image URL Helpers ─────────────────────────────────────────────
// Detect if the device is mobile (screen ≤ 768px) at call time
const isMobileScreen = () =>
  typeof window !== 'undefined' && window.innerWidth <= 768;

/**
 * Returns a responsive TMDB poster URL:
 * - Mobile (≤768px): w300 (~35KB) instead of w500 (~100KB) — 65% less bandwidth
 * - Desktop: w500 (full quality)
 */
export const tmdbPosterUrl = (path: string | null | undefined, forceSize?: 'w300' | 'w500' | 'w780'): string => {
  if (!path) return '';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const size = forceSize ?? (isMobileScreen() ? 'w300' : 'w500');
  return `https://image.tmdb.org/t/p/${size}${cleanPath}`;
};

/**
 * Returns a responsive TMDB backdrop URL:
 * - Mobile: w780 (good quality, saves ~40% vs w1280)
 * - Desktop: w1280
 */
export const tmdbBackdropUrl = (path: string | null | undefined, forceSize?: 'w300' | 'w780' | 'w1280'): string => {
  if (!path) return '';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const size = forceSize ?? (isMobileScreen() ? 'w780' : 'w1280');
  return `https://image.tmdb.org/t/p/${size}${cleanPath}`;
};
