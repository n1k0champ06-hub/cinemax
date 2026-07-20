/**
 * cineproApi.ts
 * Client-side wrapper for the CinePro Core OMSS REST API.
 * Calls our local proxy at /api/cinepro-proxy, which forwards to the self-hosted CinePro instance.
 *
 * CinePro uses TMDB IDs directly — no search-then-match required.
 */

// ---------------------------------------------------------------------------
// Types (mirrors CinePro OMSS response)
// ---------------------------------------------------------------------------

export interface CineproSource {
  /** Provider/scraper name (e.g. "vidplay", "filemoon", "vidcloud") */
  provider: string;
  /** Direct stream URL (usually m3u8 or mp4) */
  url: string;
  /** Quality label: "1080p" | "720p" | "480p" | "auto" | "unknown" */
  quality: string;
  /** Whether the URL is an HLS manifest */
  isHLS: boolean;
  /** Optional headers (Referer, Origin, etc.) */
  headers?: Record<string, string>;
  /** Optional subtitles array from CinePro */
  subtitles?: CineproSubtitle[];
}

export interface CineproSubtitle {
  lang: string;
  url: string;
  label?: string;
}

export interface CineproStreamResult {
  /** TMDB ID used for the query */
  tmdbId: string | number;
  /** Media type */
  type: 'movie' | 'tv';
  /** Array of resolved sources */
  sources: CineproSource[];
  /** Total number of providers queried */
  providersQueried?: number;
  /** Time taken (ms) */
  duration?: number;
}

// ---------------------------------------------------------------------------
// API base — always route through the local dev-api proxy to avoid CORS
// ---------------------------------------------------------------------------

const API_BASE = typeof window !== 'undefined' ? '' : 'http://localhost:3001';

function apiUrl(path: string): string {
  // Always go through local proxy — never call external URLs directly from browser
  return `${API_BASE}${path}`;
}

// ---------------------------------------------------------------------------
// Fetch movie streams
// ---------------------------------------------------------------------------

export async function fetchMovieStreams(
  tmdbId: string | number
): Promise<CineproStreamResult> {
  const params = new URLSearchParams({
    type: 'movie',
    tmdbId: String(tmdbId),
  });

  try {
    const res = await fetch(apiUrl(`/api/cinepro-proxy?${params}`));
    if (!res.ok) {
      return { tmdbId, type: 'movie', sources: [] };
    }
    const data = await res.json();
    if (data.error) {
      return { tmdbId, type: 'movie', sources: [] };
    }
    return normalizeResponse(data, tmdbId, 'movie');
  } catch (e) {
    return { tmdbId, type: 'movie', sources: [] };
  }
}

// ---------------------------------------------------------------------------
// Fetch TV episode streams
// ---------------------------------------------------------------------------

export async function fetchTvStreams(
  tmdbId: string | number,
  season: number,
  episode: number
): Promise<CineproStreamResult> {
  const params = new URLSearchParams({
    type: 'tv',
    tmdbId: String(tmdbId),
    season: String(season),
    episode: String(episode),
  });

  try {
    const res = await fetch(apiUrl(`/api/cinepro-proxy?${params}`));
    if (!res.ok) {
      return { tmdbId, type: 'tv', sources: [] };
    }
    const data = await res.json();
    if (data.error) {
      return { tmdbId, type: 'tv', sources: [] };
    }
    return normalizeResponse(data, tmdbId, 'tv');
  } catch (e) {
    return { tmdbId, type: 'tv', sources: [] };
  }
}

// ---------------------------------------------------------------------------
// High-level: fetch streams for any media type
// ---------------------------------------------------------------------------

export async function fetchCineproStreams(
  tmdbId: string | number,
  mediaType: 'movie' | 'tv',
  season?: number | null,
  episode?: number | null
): Promise<CineproStreamResult> {
  if (mediaType === 'movie') {
    return fetchMovieStreams(tmdbId);
  }
  return fetchTvStreams(tmdbId, season ?? 1, episode ?? 1);
}

// ---------------------------------------------------------------------------
// Response normalization
// ---------------------------------------------------------------------------

function normalizeResponse(
  data: any,
  tmdbId: string | number,
  type: 'movie' | 'tv'
): CineproStreamResult {
  // CinePro OMSS response format:
  // { sources: [...], providers_queried: N, duration_ms: N }
  // or sometimes { streams: [...] }
  const rawSources = data.sources || data.streams || [];

  const sources: CineproSource[] = rawSources.map((s: any) => {
    const providerName = (typeof s.provider === 'object' && s.provider)
      ? (s.provider.name || s.provider.id)
      : s.provider;

    return {
      provider: providerName || s.source || 'unknown',
      url: s.url || s.stream || '',
      quality: normalizeQuality(s.quality || s.resolution || 'auto'),
      isHLS: s.isHLS ?? s.is_hls ?? s.type === 'hls' ?? (s.url || '').includes('.m3u8'),
      headers: s.headers || undefined,
      subtitles: s.subtitles || s.captions || undefined,
    };
  }).filter((s: CineproSource) => s.url);

  return {
    tmdbId,
    type,
    sources,
    providersQueried: data.providers_queried || data.providersQueried,
    duration: data.duration_ms || data.duration,
  };
}

function normalizeQuality(q: string): string {
  const s = String(q).toLowerCase().trim();
  if (s.includes('1080')) return '1080p';
  if (s.includes('720')) return '720p';
  if (s.includes('480')) return '480p';
  if (s.includes('360')) return '360p';
  if (s.includes('4k') || s.includes('2160')) return '4K';
  if (s === 'auto' || s === 'default' || s === 'unknown') return 'auto';
  return q || 'auto';
}

// ---------------------------------------------------------------------------
// Quality selection helper
// ---------------------------------------------------------------------------

export function selectBestCineproSource(sources: CineproSource[]): CineproSource | null {
  if (!sources || sources.length === 0) return null;

  // Prefer HLS sources
  const hlsSources = sources.filter(s => s.isHLS);
  const pool = hlsSources.length > 0 ? hlsSources : sources;

  const qualityScore = (q: string): number => {
    const s = q.toLowerCase();
    if (s.includes('4k') || s.includes('2160')) return 120;
    if (s.includes('1080')) return 100;
    if (s.includes('720')) return 70;
    if (s.includes('480')) return 40;
    if (s.includes('360')) return 20;
    if (s === 'auto') return 65;
    return 50;
  };

  return pool.reduce((best, curr) =>
    qualityScore(curr.quality) > qualityScore(best.quality) ? curr : best
  );
}

// ---------------------------------------------------------------------------
// Proxied M3U8 URL builder
// ---------------------------------------------------------------------------

/**
 * Cloudflare Worker URL — route m3u8 qua Worker để filter quảng cáo (ad-filter).
 * KKPhim/OPhim CDN block Cloudflare IPs → dùng Render bridge thay thế.
 */
const WORKER_URL = 'https://cinemax-backend-proxy.cykablyatt1505.workers.dev';
const BRIDGE_URL = 'https://hollysheesh-bridge.onrender.com';

// VI CDN domains: CORS Allow-Origin:* — browser plays directly, no proxy needed
const VI_CDN_PATTERNS = [
  'kkphim', 'kkphimplayer', 'phimapi',
  'ophim', 'opstream', 'phimimg',
  'nguonc', 'phim.nguonc',
  'xem20', 'xemphim',
  // CDN worker endpoints used by VI providers
  'sing.phimmoi', 's3.phimmoi', 'stream.ophim',
];

/**
 * Build stream URL for a given raw m3u8.
 * VI CDN sources (KKPhim, OPhim, NguonC) are served directly from the browser —
 * they have CORS Allow-Origin:* and do NOT need the Render proxy.
 * Only non-VI sources are routed through the proxy bridge for ad-filtering.
 */
export function buildProxiedM3u8Url(streamUrl: string, referer?: string | null): string {
  if (!streamUrl) return '';

  // Check if stream originates from a VI CDN
  const isViCdn = VI_CDN_PATTERNS.some(p => streamUrl.includes(p) || (referer || '').includes(p));
  if (isViCdn) {
    // Play directly — no proxy, no cold-start delay
    return streamUrl;
  }

  // Non-VI sources: route through Render bridge for ad-filtering
  const params = new URLSearchParams({ url: streamUrl });
  if (referer) params.set('referer', referer);

  const backendUrl =
    import.meta.env.VITE_BACKEND_URL && import.meta.env.VITE_BACKEND_URL.startsWith('http')
      ? import.meta.env.VITE_BACKEND_URL
      : 'https://hollysheesh-bridge.onrender.com';

  const base = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
  return `${base}/proxy/m3u8?${params.toString()}`;
}
