export const config = {
  runtime: 'edge',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Subtitle proxy — supports Subdl (primary, free) and OpenSubtitles REST v2 (optional fallback).
 *
 * Query params:
 *   provider   = 'subdl' | 'opensubtitles'       (default: 'subdl')
 *   tmdb_id    = TMDB numeric ID
 *   imdb_id    = IMDb ID (e.g. tt1234567) — used by OpenSubtitles
 *   type       = 'movie' | 'episode'              (default: 'movie')
 *   season     = season number (TV only)
 *   episode    = episode number (TV only)
 *   lang       = BCP-47 language code              (default: 'vi')
 *
 * Download endpoint:
 *   provider   = 'download'
 *   url        = encoded subtitle download URL
 */
export default async function handler(req) {
  const url = new URL(req.url);

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const provider = url.searchParams.get('provider') || 'subdl';
  const lang = url.searchParams.get('lang') || 'vi';

  // --- Download proxy (fetch raw subtitle file to avoid CORS) ---
  if (provider === 'download') {
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'Missing url' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Only allow known subtitle CDNs
    const allowed = [
      'dl.subdl.com',
      'sub.subdl.com',
      'api.subdl.com',
      'dl.opensubtitles.com',
      'opensubtitles.com',
      'api.opensubtitles.com',
      'opensubtitles.org',
      'strem.io',
      'subs5.strem.io',
      'elfhosted.com',
    ];
    const target = new URL(targetUrl);
    const isAllowed = allowed.some(d => target.hostname === d || target.hostname.endsWith('.' + d));
    if (!isAllowed) {
      return new Response(JSON.stringify({ error: 'Domain not allowed', hostname: target.hostname }), {
        status: 403,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    try {
      const resp = await fetch(targetUrl, {
        headers: { 'User-Agent': 'CinemaxApp/1.0' },
      });
      const body = await resp.text();
      return new Response(body, {
        status: resp.status,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  }

  // --- Subdl API (primary, no key required for basic search) ---
  if (provider === 'subdl') {
    const tmdbId = url.searchParams.get('tmdb_id');
    const imdbId = url.searchParams.get('imdb_id');
    const type = url.searchParams.get('type') || 'movie';
    const season = url.searchParams.get('season');
    const episode = url.searchParams.get('episode');
    const subdlApiKey = process.env.VITE_SUBDL_API_KEY || process.env.SUBDL_API_KEY || '';

    // Promise 1: Fetch from Subdl API
    const subdlPromise = (async () => {
      const params = new URLSearchParams();
      if (tmdbId) params.set('tmdb_id', tmdbId);
      else if (imdbId) params.set('imdb_id', imdbId);
      else return [];

      params.set('languages', mapLangToSubdl(lang));
      params.set('type', type === 'movie' ? 'movie' : 'tv');

      if (type !== 'movie' && season) params.set('season_number', season);
      if (type !== 'movie' && episode) params.set('episode_number', episode);

      if (subdlApiKey) params.set('api_key', subdlApiKey);

      const subdlUrl = `https://api.subdl.com/api/v1/subtitles?${params.toString()}`;

      try {
        const resp = await fetch(subdlUrl, {
          headers: {
            'User-Agent': 'CinemaxApp/1.0',
            'Accept': 'application/json',
          },
        });
        if (!resp.ok) return [];
        const data = await resp.json();

        return (data.subtitles || []).map(s => ({
          id: s.sd_id || String(Math.random()),
          language: lang,
          name: s.release_name || s.full_name || 'Subdl Subtitle',
          downloadUrl: s.url ? `https://dl.subdl.com${s.url}` : s.download_link || '',
          format: 'srt',
          hi: s.hi || false,
          rating: s.ratings || 0,
        }));
      } catch (err) {
        console.warn('[sub-proxy] subdl fetch failed:', err.message);
        return [];
      }
    })();

    // Promise 2: Fetch from Stremio Subtitle Addons (OpenSubtitles v3, SubMaker, etc.)
    const stremioPromise = (async () => {
      if (!imdbId) return [];
      const DEFAULT_ADDONS = [
        'https://opensubtitles-v3.strem.io',
        'https://subhero.chromeknight.dev'
      ];
      const userAddons = (process.env.SUBTITLE_ADDONS || process.env.VITE_SUBTITLE_ADDONS || '')
        .split(',')
        .map(u => u.trim())
        .filter(Boolean);
      const addons = [...DEFAULT_ADDONS, ...userAddons];

      const results = await Promise.all(
        addons.map(addon => fetchStremioSubtitles(addon, type, imdbId, season, episode, lang))
      );
      return results.flat();
    })();

    try {
      const [subdlSubs, stremioSubs] = await Promise.all([subdlPromise, stremioPromise]);
      const subtitles = [...subdlSubs, ...stremioSubs];

      return new Response(JSON.stringify({ subtitles, source: 'merged' }), {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
          'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message, subtitles: [], source: 'merged' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  }

  // --- OpenSubtitles REST v2 (optional fallback) ---
  if (provider === 'opensubtitles') {
    const imdbId = url.searchParams.get('imdb_id');
    const tmdbId = url.searchParams.get('tmdb_id');
    const type = url.searchParams.get('type') || 'movie';
    const season = url.searchParams.get('season');
    const episode = url.searchParams.get('episode');
    const apiKey = process.env.VITE_OPENSUBTITLES_API_KEY || process.env.OPENSUBTITLES_API_KEY || '';

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OpenSubtitles API key not configured', subtitles: [] }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const params = new URLSearchParams();
    params.set('languages', lang);
    if (imdbId) params.set('imdb_id', imdbId.replace('tt', ''));
    if (tmdbId) params.set('tmdb_id', tmdbId);
    if (type === 'episode' || type === 'tv') {
      if (season) params.set('season_number', season);
      if (episode) params.set('episode_number', episode);
    }
    params.set('type', type === 'movie' ? 'movie' : 'episode');
    params.set('per_page', '5');

    const osUrl = `https://api.opensubtitles.com/api/v1/subtitles?${params.toString()}`;

    try {
      const resp = await fetch(osUrl, {
        headers: {
          'Api-Key': apiKey,
          'Content-Type': 'application/json',
          'User-Agent': 'CinemaxApp v1.0',
        },
      });
      const data = await resp.json();

      const subtitles = (data.data || []).map(item => ({
        id: item.id,
        language: lang,
        name: item.attributes?.release || item.attributes?.feature_details?.title || 'Tiếng Việt',
        downloadUrl: item.attributes?.files?.[0]
          ? `https://api.opensubtitles.com/api/v1/download` // needs POST, handled differently
          : '',
        format: 'srt',
        fileId: item.attributes?.files?.[0]?.file_id,
        hi: item.attributes?.hearing_impaired || false,
        rating: item.attributes?.ratings || 0,
      }))
      .filter(s => s.fileId);

      return new Response(JSON.stringify({ subtitles, source: 'opensubtitles' }), {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
          'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message, subtitles: [], source: 'opensubtitles' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Unknown provider' }), {
    status: 400,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/** Map language codes to Subdl's expected format */
function mapLangToSubdl(lang) {
  const map = {
    'vi': 'VI',
    'en': 'EN',
    'zh': 'ZH',
    'ja': 'JA',
    'ko': 'KO',
    'fr': 'FR',
    'de': 'DE',
    'es': 'ES',
    'pt': 'PT',
    'ru': 'RU',
    'ar': 'AR',
    'th': 'TH',
    'id': 'ID',
  };
  return map[lang.toLowerCase()] || lang.toUpperCase();
}

async function fetchStremioSubtitles(addonUrl, type, imdbId, season, episode, lang) {
  const httpUrl = addonUrl.replace(/^stremio:\/\//i, 'https://');
  const cleanBase = httpUrl.replace(/\/manifest\.json$/i, '').replace(/\/$/, '');
  const url = type === 'movie'
    ? `${cleanBase}/subtitles/movie/${imdbId}.json`
    : `${cleanBase}/subtitles/series/${imdbId}:${season}:${episode}.json`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'CinemaxApp/1.0' },
    });
    if (!res.ok) return [];
    const data = await res.json();

    const map3To2 = {
      'vie': 'vi', 'eng': 'en', 'ind': 'id', 'zho': 'zh', 'chi': 'zh',
      'fra': 'fr', 'deu': 'de', 'ger': 'de', 'spa': 'es', 'por': 'pt',
      'rus': 'ru', 'ara': 'ar', 'tha': 'th',
    };

    return (data.subtitles || [])
      .filter(s => {
        const sLang = (s.lang || '').toLowerCase();
        const mapped = map3To2[sLang] || sLang;
        return mapped === lang.toLowerCase() || sLang === lang.toLowerCase();
      })
      .map(s => ({
        id: s.id || String(Math.random()),
        language: lang,
        name: s.name || s.g || `${lang.toUpperCase()} Subtitle (${s.id || 'Stremio'})`,
        downloadUrl: s.url,
        format: s.url.endsWith('.vtt') ? 'vtt' : 'srt',
        hi: s.hi || false,
        rating: 0,
      }));
  } catch (err) {
    console.warn(`[sub-proxy] Stremio addon ${addonUrl} failed:`, err.message);
    return [];
  }
}
