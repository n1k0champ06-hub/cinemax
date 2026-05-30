import { proxyFetch } from './proxy-helper.js';

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
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const provider = req.query.provider || 'subdl';
  const lang = req.query.lang || 'vi';

  // --- Download proxy (fetch raw subtitle file to avoid CORS) ---
  if (provider === 'download') {
    const targetUrl = req.query.url;
    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing url' });
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
    
    try {
      const target = new URL(targetUrl);
      const isAllowed = allowed.some(d => target.hostname === d || target.hostname.endsWith('.' + d));
      if (!isAllowed) {
        return res.status(403).json({ error: 'Domain not allowed', hostname: target.hostname });
      }

      const resp = await proxyFetch(targetUrl, {
        headers: { 'User-Agent': 'CinemaxApp/1.0' },
      });
      const body = await resp.text();
      
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.status(resp.status).send(body);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // --- Subdl API (primary, no key required for basic search) ---
  if (provider === 'subdl') {
    const tmdbId = req.query.tmdb_id;
    const imdbId = req.query.imdb_id;
    const type = req.query.type || 'movie';
    const season = req.query.season;
    const episode = req.query.episode;
    const subdlApiKey = process.env.VITE_SUBDL_API_KEY || process.env.SUBDL_API_KEY || '';

    // Promise 1: Fetch from Subdl API
    const subdlPromise = (async () => {
      const params = new URLSearchParams();
      params.set('languages', mapLangToSubdl(lang));

      if (imdbId) {
        params.set('imdb_id', imdbId);
      } else if (tmdbId) {
        params.set('tmdb_id', String(tmdbId));
      } else {
        return [];
      }

      if (type === 'episode' || type === 'tv') {
        if (season) params.set('season_number', String(season));
        if (episode) params.set('episode_number', String(episode));
      }

      if (subdlApiKey) params.set('api_key', subdlApiKey);

      const subdlUrl = `https://api.subdl.com/api/v1/subtitles?${params.toString()}`;

      try {
        const resp = await proxyFetch(subdlUrl, {
          headers: {
            'User-Agent': 'CinemaxApp/1.0',
            'Accept': 'application/json',
          },
        });
        if (!resp.ok) return [];
        const data = await resp.json();

        return (data.subtitles || [])
          .filter(s => {
            const sLang = (s.lang || '').toLowerCase();
            const target = lang.toLowerCase();
            if (target === 'vi') return sLang === 'vietnamese' || sLang === 'vi';
            if (target === 'en') return sLang === 'english' || sLang === 'en';
            return sLang.startsWith(target) || sLang === target;
          })
          .map(s => ({
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

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
      return res.status(200).json({ subtitles, source: 'merged' });
    } catch (err) {
      return res.status(500).json({ error: err.message, subtitles: [], source: 'merged' });
    }
  }

  // --- OpenSubtitles REST v2 (optional fallback) ---
  if (provider === 'opensubtitles') {
    const imdbId = req.query.imdb_id;
    const tmdbId = req.query.tmdb_id;
    const type = req.query.type || 'movie';
    const season = req.query.season;
    const episode = req.query.episode;
    const apiKey = process.env.VITE_OPENSUBTITLES_API_KEY || process.env.OPENSUBTITLES_API_KEY || '';

    if (!apiKey) {
      return res.status(200).json({ error: 'OpenSubtitles API key not configured', subtitles: [] });
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
      const resp = await proxyFetch(osUrl, {
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

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
      return res.status(200).json({ subtitles, source: 'opensubtitles' });
    } catch (err) {
      return res.status(500).json({ error: err.message, subtitles: [], source: 'opensubtitles' });
    }
  }

  return res.status(400).json({ error: 'Unknown provider' });
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
    const res = await proxyFetch(url, {
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
