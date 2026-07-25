/**
 * m3u8ProxyApi.ts
 * Helper utility for building proxied M3U8 URLs.
 */

const VI_CDN_PATTERNS = [
  'kkphim', 'kkphimplayer', 'phimapi',
  'ophim', 'opstream', 'phimimg',
  'nguonc', 'phim.nguonc',
  'xem20', 'xemphim',
  'sing.phimmoi', 's3.phimmoi', 'stream.ophim',
];

/**
 * Build stream URL for a given raw m3u8.
 * VI CDN sources (KKPhim, OPhim, NguonC) are served directly from the browser —
 * they have CORS Allow-Origin:* and do NOT need the proxy.
 */
export function buildProxiedM3u8Url(streamUrl: string, referer?: string | null): string {
  if (!streamUrl) return '';

  const isViCdn = VI_CDN_PATTERNS.some(p => streamUrl.includes(p) || (referer || '').includes(p));
  if (isViCdn) {
    return streamUrl;
  }

  const params = new URLSearchParams({ url: streamUrl });
  if (referer) params.set('referer', referer);

  if (typeof window !== 'undefined') {
    return `/api/m3u8-proxy?${params.toString()}`;
  }

  const backendUrl =
    import.meta.env.VITE_BACKEND_URL && import.meta.env.VITE_BACKEND_URL.startsWith('http')
      ? import.meta.env.VITE_BACKEND_URL
      : 'https://focusflow.id.vn';

  const base = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
  return `${base}/api/m3u8-proxy?${params.toString()}`;
}
