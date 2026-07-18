/**
 * types.ts — Core types cho Meta-Streaming Aggregator
 * Đây là "contract" mà mọi provider phải tuân thủ.
 */

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

export interface StreamQuery {
  /** TMDB numeric ID */
  tmdbId?: string | number | null;
  /** IMDb ID (tt-prefixed) */
  imdbId?: string | null;
  /** AniList ID for Anime integration */
  anilistId?: string | number | null;
  /** English / original title — dùng cho international providers */
  title: string;
  /** Tên Việt — dùng cho VI providers (OPhim, KKPhim...) */
  titleVi?: string;
  type: 'movie' | 'tv';
  season?: number | null;
  episode?: number | null;
  viSlug?: string | null;
  /** Danh sách diễn viên từ TMDB/IMDb để fallback string matching chính xác hơn */
  casts?: string[];
  /** Release year */
  year?: number | string | null;
  /** Whether the query is for an Anime */
  isAnime?: boolean;
  /** HiAnime explicit episode id if resolved */
  hianimeEpisodeId?: string;
}

// ---------------------------------------------------------------------------
// Stream Item — kết quả từ một provider
// ---------------------------------------------------------------------------

export type StreamType = 'hls' | 'embed';
export type StreamLang = 'vi' | 'en' | 'multi' | 'unknown';

export interface StreamItem {
  /** Unique ID: `${provider}:${url_hash}` */
  id: string;
  /** Provider identifier */
  provider: ProviderID;
  /** Human-readable provider name */
  providerLabel: string;
  /** Stream delivery method */
  type: StreamType;
  /** URL: m3u8 for hls, iframe URL for embed */
  url: string;
  /** Quality hint: '1080p' | '720p' | 'HD' | 'auto' | 'SD' */
  quality: string;
  /** Audio/subtitle language */
  lang: StreamLang;
  /** Full display label shown in picker: "OPhim · Vietsub · 1080p" */
  label: string;
  /** Auto-ranking score 0–100. Higher = shown first + auto-selected */
  score: number;
  /** HTTP headers required (Referer etc.) — used by HLS proxy */
  headers?: Record<string, string>;
  /** Episode name, for display */
  episodeName?: string;
  /** Server category for integrated select panel */
  category?: 'premium' | 'standard' | 'free' | 'vi';
  /** Latency in milliseconds */
  latency?: number;
  /** Latency description: 'Ultra-fast' | 'Fast' | 'Slow' | 'Offline' */
  latencyLabel?: string;
  /** Subtitles provided by the stream source */
  subtitles?: { lang: string; url: string; label?: string }[];
  /** Intro offset in seconds */
  intro?: { start: number; end: number } | null;
  /** Outro offset in seconds */
  outro?: { start: number; end: number } | null;
}

// ---------------------------------------------------------------------------
// Provider Status
// ---------------------------------------------------------------------------

export type ProviderStatus = 'idle' | 'loading' | 'done' | 'error' | 'disabled';

export interface ProviderState {
  id: ProviderID;
  label: string;
  status: ProviderStatus;
  error?: string;
  streams: StreamItem[];
}

// ---------------------------------------------------------------------------
// Provider Interface — every provider must implement this
// ---------------------------------------------------------------------------

export type ProviderID = string;

export interface StreamProvider {
  id: ProviderID;
  label: string;
  lang: StreamLang;
  /** Provider group for UI grouping */
  group: 'vi' | 'intl' | 'hls';
  /**
   * Fetch available streams for a query.
   * MUST resolve (never reject) — return [] on failure.
   */
  fetchStreams(query: StreamQuery): Promise<StreamItem[]>;
}

// ---------------------------------------------------------------------------
// Aggregator result (returned by useStreamAggregator hook)
// ---------------------------------------------------------------------------

export interface AggregatorState {
  /** All streams collected so far (grows as providers respond) */
  streams: StreamItem[];
  /** Per-provider status */
  providers: ProviderState[];
  /** True while at least one provider is still loading */
  isLoading: boolean;
  /** Best stream selected for auto-play (highest score) */
  autoSelected: StreamItem | null;
}

// ---------------------------------------------------------------------------
// Score constants
// ---------------------------------------------------------------------------

export const SCORE = {
  // Base scores by provider type
  HLS_VIETSUB: 85,    // OPhim/KKPhim with m3u8
  HLS_CINEPRO: 90,    // CinePro HLS (international)
  EMBED_GOOD: 105,    // Reserved for good embeds
  EMBED_OK: 100,       // VidSrc, 2Embed
  EMBED_SLOW: 45,     // CinemaOS

  // Bonuses
  QUALITY_1080: 10,
  QUALITY_720: 5,
  QUALITY_AUTO: 3,
  LANG_VI: 15,        // Vietsub bonus
  TYPE_HLS: 10,       // Direct play bonus
} as const;

export function computeScore(item: Omit<StreamItem, 'score'>): number {
  let score = 0;

  // Base by provider
  if (item.provider === 'animapper') score = 97; // AniMapper (Vietnamese anime streaming provider)
  else if (item.provider === 'hianime') score = 94; // HiAnime MegaCloud Decryptor
  else if (item.provider === 'cinepro') score = SCORE.HLS_CINEPRO;
  else if (item.provider === 'allmanga') score = 92; // Dedicated anime stream provider
  else if (item.provider === 'kkphim' && item.type === 'hls') score = 99; // KKPhim HLS (Preferred over OPhim/NguonC)
  else if (['ophim', 'nguonc'].includes(item.provider) && item.type === 'hls') score = 98; // OPhim/NguonC HLS
  else if (item.provider === 'nguonc' && item.type === 'embed') score = 90;  // NguonC embed (HLS tắt, đây là nguồn chính)
  else if (['ophim', 'kkphim'].includes(item.provider) && item.type === 'embed') score = 75; // Vietnamese embed sources
  else if (['vidnest', 'vidnest_animepahe'].includes(item.provider)) score = 48; // Demoted to Community (Ad Injection)
  else if (['vidsrc_to', '2embed', 'vidsrc_embed_ru', 'vidsrc_embed_su', 'vidsrc_me_ru', 'vidsrc_me_su', 'vidsrc_dash_me_ru', 'vidsrc_dash_me_su', 'vsrc_su'].includes(item.provider)) score = SCORE.EMBED_OK;
  else if (item.provider === 'cinemaos') score = SCORE.EMBED_SLOW;
  else score = 40;

  // Quality bonus
  const q = String(item.quality).toLowerCase();
  if (q.includes('1080')) score += SCORE.QUALITY_1080;
  else if (q.includes('720')) score += SCORE.QUALITY_720;
  else if (q === 'auto' || q === 'hls') score += SCORE.QUALITY_AUTO;

  // Language bonus
  if (item.lang === 'vi') score += SCORE.LANG_VI;

  // Type bonus
  if (item.type === 'hls') score += SCORE.TYPE_HLS;

  return Math.min(score, 130);
}
