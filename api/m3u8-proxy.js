export const config = {
  runtime: 'edge',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range',
};

/**
 * M3U8 + HLS segment proxy — Edge Function
 *
 * This is the key piece that bypasses CDN 403 errors.
 * It fetches HLS manifests and TS segments server-side (with correct Referer/Origin headers),
 * rewrites m3u8 manifest URLs to go back through this proxy, and passes binary segments through.
 *
 * Query params:
 *   url      = encoded target URL (m3u8 or .ts segment)
 *   referer  = encoded Referer header to send (e.g. https://vidcloud.to/)
 *   origin   = encoded Origin header (optional)
 *   ua       = encoded User-Agent override (optional)
 */
export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  const reqUrl = new URL(req.url);
  const targetUrl = reqUrl.searchParams.get('url');
  const referer = reqUrl.searchParams.get('referer') || '';
  const origin = reqUrl.searchParams.get('origin') || (referer ? new URL(referer).origin : '');
  const userAgent = reqUrl.searchParams.get('ua') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing url param' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Security: only allow http/https
  let parsedTarget;
  try {
    parsedTarget = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsedTarget.protocol)) throw new Error('Invalid protocol');
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid url' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Build request headers to send to the CDN
  const fetchHeaders = {
    'User-Agent': userAgent,
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
  };
  if (referer) fetchHeaders['Referer'] = referer;
  if (origin) fetchHeaders['Origin'] = origin;

  // Forward Range header if present (for partial content / seeking)
  const rangeHeader = req.headers.get('Range');
  if (rangeHeader) fetchHeaders['Range'] = rangeHeader;

  let res;
  try {
    res = await fetch(targetUrl, {
      headers: fetchHeaders,
      redirect: 'follow',
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: `Fetch failed: ${err.message}` }), {
      status: 502,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  if (!res.ok && res.status !== 206) {
    return new Response(JSON.stringify({ error: `Upstream returned ${res.status}` }), {
      status: res.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const contentType = res.headers.get('Content-Type') || '';
  const isM3U8 = contentType.includes('mpegurl') || contentType.includes('x-mpegURL') || targetUrl.includes('.m3u8');
  const isTS = contentType.includes('video/') || contentType.includes('application/octet') || targetUrl.match(/\.(ts|aac|mp4|m4s|fmp4)(\?|$)/);

  // For M3U8 manifests: rewrite URLs to point back through this proxy
  if (isM3U8 || (!isTS && !contentType.includes('video/'))) {
    const text = await res.text();
    const rewritten = rewriteM3U8(text, targetUrl, referer, reqUrl);

    return new Response(rewritten, {
      status: res.status,
      headers: {
        ...CORS,
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-cache',
        'X-Proxy-Source': parsedTarget.hostname,
      },
    });
  }

  // For TS segments and other binary: pass through as-is
  const body = await res.arrayBuffer();
  const responseHeaders = {
    ...CORS,
    'Content-Type': contentType || 'video/MP2T',
    'Cache-Control': 'public, max-age=3600',
  };

  // Pass through partial content headers
  if (res.status === 206) {
    const contentRange = res.headers.get('Content-Range');
    if (contentRange) responseHeaders['Content-Range'] = contentRange;
    responseHeaders['Accept-Ranges'] = 'bytes';
  }

  return new Response(body, {
    status: res.status,
    headers: responseHeaders,
  });
}

// ---------------------------------------------------------------------------
// M3U8 URL rewriting
// ---------------------------------------------------------------------------

/**
 * Rewrite all URLs in an M3U8 manifest to go through this proxy.
 * Handles:
 *   - Absolute URLs (http://...)
 *   - Protocol-relative URLs (//...)
 *   - Relative URLs (path/to/file.ts or ../other/file.ts)
 */
function rewriteM3U8(content, baseUrl, referer, proxyReqUrl) {
  const baseUrlObj = new URL(baseUrl);
  const proxyBase = `${proxyReqUrl.origin}/api/m3u8-proxy`;

  const buildProxyUrl = (absoluteUrl) => {
    const params = new URLSearchParams({
      url: absoluteUrl,
    });
    if (referer) params.set('referer', referer);
    return `${proxyBase}?${params.toString()}`;
  };

  const resolveUrl = (url) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('//')) {
      return `${baseUrlObj.protocol}${url}`;
    }
    if (url.startsWith('/')) {
      return `${baseUrlObj.protocol}//${baseUrlObj.host}${url}`;
    }
    // Relative URL — resolve against base
    const base = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
    return `${base}${url}`;
  };

  const lines = content.split('\n');
  const result = lines.map(line => {
    const trimmed = line.trim();

    // Skip empty lines and comments (except URI= in tags)
    if (!trimmed || (trimmed.startsWith('#') && !trimmed.includes('URI="'))) {
      // Rewrite URI="..." inside EXT tags (e.g. #EXT-X-KEY, #EXT-X-MAP)
      if (trimmed.includes('URI="')) {
        return trimmed.replace(/URI="([^"]+)"/g, (_, uri) => {
          const absolute = resolveUrl(uri);
          return `URI="${buildProxyUrl(absolute)}"`;
        });
      }
      return line;
    }

    // Non-comment, non-empty lines are segment URLs
    if (!trimmed.startsWith('#')) {
      const absolute = resolveUrl(trimmed);
      return buildProxyUrl(absolute);
    }

    return line;
  });

  return result.join('\n');
}
