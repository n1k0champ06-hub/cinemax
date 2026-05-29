export const config = {
  runtime: 'edge',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * CinePro proxy — Edge Function
 *
 * Forwards requests to a self-hosted CinePro Core instance.
 *
 * Query params:
 *   type    = 'movie' | 'tv'
 *   tmdbId  = TMDB numeric ID
 *   season  = season number (for TV)
 *   episode = episode number (for TV)
 */
export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get('type');
  const tmdbId = url.searchParams.get('tmdbId');

  if (!type || !tmdbId) {
    return json({ error: 'Missing type or tmdbId' }, 400);
  }

  const CINEPRO_BASE = (
    process.env.CINEPRO_URL ||
    process.env.VITE_CINEPRO_URL ||
    'http://localhost:3232'
  ).replace(/\/$/, '');

  try {
    let apiPath;

    if (type === 'movie') {
      apiPath = `/v1/movies/${tmdbId}`;
    } else if (type === 'tv') {
      const season = url.searchParams.get('season') || '1';
      const episode = url.searchParams.get('episode') || '1';
      apiPath = `/v1/tv/${tmdbId}/seasons/${season}/episodes/${episode}`;
    } else {
      return json({ error: `Unknown type: ${type}` }, 400);
    }

    const targetUrl = `${CINEPRO_BASE}${apiPath}`;
    console.log(`[cinepro-proxy] Forwarding to: ${targetUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout — CinePro scrapes can be slow

    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CinemaxApp/1.0)',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');
      console.error(`[cinepro-proxy] CinePro returned ${res.status}: ${errorText.slice(0, 200)}`);
      return json({ error: `CinePro returned ${res.status}`, detail: errorText.slice(0, 500) }, res.status);
    }

    const data = await res.json();

    // Pass through the CinePro response as-is
    return json(data);

  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('[cinepro-proxy] Request timed out');
      return json({ error: 'CinePro request timed out (30s)' }, 504);
    }
    console.error('[cinepro-proxy] Error:', err.message);
    return json({ error: err.message }, 500);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS,
      'Content-Type': 'application/json',
      'Cache-Control': status === 200 ? 's-maxage=300, stale-while-revalidate=600' : 'no-store',
    },
  });
}
