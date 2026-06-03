export const config = {
  runtime: 'edge',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * IMDb API Proxy — Edge Function
 *
 * Forwards requests to api.imdbapi.dev to fetch detailed movie/TV ratings and plots.
 *
 * Query params:
 *   imdbId = IMDb ID (e.g. tt0111161)
 */
export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url = new URL(req.url);
  const imdbId = url.searchParams.get('imdbId');

  if (!imdbId) {
    return json({ error: 'Missing imdbId' }, 400);
  }

  // Validate format (imdb ID starts with tt and followed by digits)
  if (!/^tt\d+$/.test(imdbId)) {
    return json({ error: 'Invalid imdbId format' }, 400);
  }

  try {
    const targetUrl = `https://api.imdbapi.dev/titles/${imdbId}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');
      console.error(`[imdb-proxy] IMDb API returned ${res.status}: ${errorText.slice(0, 200)}`);
      return json({ error: `IMDb API returned ${res.status}` }, res.status);
    }

    const data = await res.json();
    return json(data);

  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('[imdb-proxy] Request timed out');
      return json({ error: 'IMDb API request timed out (12s)' }, 504);
    }
    console.error('[imdb-proxy] Error:', err.message);
    return json({ error: err.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS,
      'Content-Type': 'application/json',
      'Cache-Control': status === 200 ? 's-maxage=86400, stale-while-revalidate=172800' : 'no-store',
    },
  });
}
