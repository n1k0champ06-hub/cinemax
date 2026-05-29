/**
 * streamApi.ts
 * Builds embed URLs for international streaming providers.
 *
 * Used as the iframe fallback in CustomVideoPlayer when Consumet HLS is unavailable.
 * Providers: VidSrc, VidLink, AutoEmbed, 2Embed, SuperEmbed.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StreamSource {
  key: string;
  label: string;
  provider: 'vidsrc' | 'vidsrc_me' | 'vidsrc_pro' | 'vidlink' | 'autoembed' | '2embed' | 'superembed';
  embedUrl: string;
  quality?: '4K' | '1080p' | '720p' | 'HD';
}

export interface StreamBuildParams {
  imdbId?: string | null;
  tmdbId?: number | string | null;
  mediaType: 'movie' | 'tv';
  season?: number | null;
  episode?: number | null;
}

// ---------------------------------------------------------------------------
// URL builders
// ---------------------------------------------------------------------------

function buildVidSrcXyz(p: StreamBuildParams): string | null {
  const id = p.imdbId || (p.tmdbId ? String(p.tmdbId) : null);
  if (!id) return null;
  if (p.mediaType === 'movie') return `https://vidsrc.xyz/embed/movie/${id}`;
  return `https://vidsrc.xyz/embed/tv/${id}/${p.season ?? 1}/${p.episode ?? 1}`;
}

function buildVidSrcMe(p: StreamBuildParams): string | null {
  const id = p.imdbId || (p.tmdbId ? String(p.tmdbId) : null);
  if (!id) return null;
  if (p.mediaType === 'movie') return `https://vidsrc.me/embed/movie?imdb=${id}`;
  return `https://vidsrc.me/embed/tv?imdb=${id}&season=${p.season ?? 1}&episode=${p.episode ?? 1}`;
}

function buildVidSrcPro(p: StreamBuildParams): string | null {
  const id = p.imdbId || (p.tmdbId ? `tmdb:${p.tmdbId}` : null);
  if (!id) return null;
  if (p.mediaType === 'movie') return `https://vidsrc.pro/embed/movie/${id}`;
  return `https://vidsrc.pro/embed/tv/${id}/${p.season ?? 1}/${p.episode ?? 1}`;
}

/**
 * VidLink — works well with TMDB IDs, no IMDB required.
 * https://vidlink.pro
 */
function buildVidLink(p: StreamBuildParams): string | null {
  if (!p.tmdbId) return null;
  if (p.mediaType === 'movie') {
    return `https://vidlink.pro/movie/${p.tmdbId}`;
  }
  return `https://vidlink.pro/tv/${p.tmdbId}/${p.season ?? 1}/${p.episode ?? 1}`;
}

/**
 * AutoEmbed — TMDB-based, reliable.
 * https://autoembed.cc
 */
function buildAutoEmbed(p: StreamBuildParams): string | null {
  if (!p.tmdbId) return null;
  if (p.mediaType === 'movie') {
    return `https://autoembed.cc/movie/tmdb-${p.tmdbId}`;
  }
  return `https://autoembed.cc/tv/tmdb-${p.tmdbId}-${p.season ?? 1}-${p.episode ?? 1}`;
}

/**
 * 2Embed — widely used, TMDB-based.
 * https://www.2embed.cc
 */
function build2Embed(p: StreamBuildParams): string | null {
  if (!p.tmdbId) return null;
  if (p.mediaType === 'movie') {
    return `https://www.2embed.cc/embed/${p.tmdbId}`;
  }
  return `https://www.2embed.cc/embedtv/${p.tmdbId}&s=${p.season ?? 1}&e=${p.episode ?? 1}`;
}

function buildSuperEmbed(p: StreamBuildParams): string | null {
  if (!p.tmdbId) return null;
  if (p.mediaType === 'movie') {
    return `https://multiembed.mov/directstream.php?video_id=${p.tmdbId}&tmdb=1`;
  }
  return `https://multiembed.mov/directstream.php?video_id=${p.tmdbId}&tmdb=1&s=${p.season ?? 1}&e=${p.episode ?? 1}`;
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildStreamSources(params: StreamBuildParams): StreamSource[] {
  const sources: StreamSource[] = [];

  const add = (
    key: StreamSource['key'],
    label: string,
    provider: StreamSource['provider'],
    url: string | null,
    quality: StreamSource['quality'] = '1080p'
  ) => {
    if (url) sources.push({ key, label, provider, embedUrl: url, quality });
  };

  add('vidsrc',     'VidSrc HD',    'vidsrc',     buildVidSrcXyz(params), '1080p');
  add('vidlink',    'VidLink',      'vidlink',    buildVidLink(params),   '1080p');
  add('autoembed',  'AutoEmbed',    'autoembed',  buildAutoEmbed(params), '1080p');
  add('2embed',     '2Embed',       '2embed',     build2Embed(params),    '720p');
  add('vidsrc_me',  'VidSrc.me',    'vidsrc_me',  buildVidSrcMe(params),  '1080p');
  add('vidsrc_pro', 'VidSrc Pro',   'vidsrc_pro', buildVidSrcPro(params), '1080p');
  add('superembed', 'SuperEmbed',   'superembed', buildSuperEmbed(params), '720p');

  return sources;
}
