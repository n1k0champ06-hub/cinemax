/**
 * Cloudflare Worker Unified Proxy Server
 * 
 * Triển khai file này lên Cloudflare Workers để làm proxy cho:
 * 1. TMDB API (Vượt chặn nhà mạng) -> /tmdb/*
 * 2. Hình ảnh poster (Bypass nhà mạng chặn) -> /img/[url]
 * 3. Tìm phụ đề (Subdl & Stremio Addons) -> /api/sub-proxy
 * 4. Nguồn phát CinePro Core -> /api/cinepro-proxy
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Api-Key",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Xử lý CORS Options
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
      });
    }

    // 1. Proxy cho TMDB API - Sử dụng: https://[worker-url]/tmdb/movie/popular?language=vi
    if (url.pathname.startsWith("/tmdb/")) {
      const tmdbPath = url.pathname.replace("/tmdb", "");
      const tmdbUrl = new URL(`https://api.themoviedb.org/3${tmdbPath}${url.search}`);
      const token = env.TMDB_ACCESS_TOKEN || env.VITE_TMDB_ACCESS_TOKEN || "";
      
      const response = await fetch(tmdbUrl, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json"
        }
      });

      const data = await response.text();
      return new Response(data, {
        status: response.status,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600"
        }
      });
    }

    // 2. Proxy cho hình ảnh (Bypass nhà mạng chặn) - Sử dụng: https://[worker-url]/img/https://phimimg.com/...
    if (url.pathname.startsWith("/img/")) {
      const imageUrl = url.pathname.replace("/img/", "") + url.search;
      if (!imageUrl || !imageUrl.startsWith('http')) {
        return new Response("Invalid URL", { status: 400, headers: CORS_HEADERS });
      }

      const response = await fetch(imageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });

      return new Response(response.body, {
        status: response.status,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": response.headers.get("Content-Type") || "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable"
        }
      });
    }

    // 3. Proxy tìm phụ đề (Subdl & Stremio Addons) - /api/sub-proxy
    if (url.pathname.startsWith("/api/sub-proxy")) {
      const provider = url.searchParams.get('provider') || 'subdl';
      const lang = url.searchParams.get('lang') || 'vi';

      // --- Download proxy (fetch raw subtitle file to avoid CORS) ---
      if (provider === 'download') {
        const targetUrl = url.searchParams.get('url');
        if (!targetUrl) {
          return json({ error: 'Missing url' }, 400);
        }

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
          return json({ error: 'Domain not allowed', hostname: target.hostname }, 403);
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
          return json({ error: err.message }, 500);
        }
      }

      // --- Subdl API (primary) ---
      if (provider === 'subdl') {
        const tmdbId = url.searchParams.get('tmdb_id');
        const imdbId = url.searchParams.get('imdb_id');
        const type = url.searchParams.get('type') || 'movie';
        const season = url.searchParams.get('season');
        const episode = url.searchParams.get('episode');
        const subdlApiKey = env.SUBDL_API_KEY || env.VITE_SUBDL_API_KEY || '';

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

        // Fetch from Stremio Subtitle Addons (OpenSubtitles v3, SubHero v2, SubMaker, v.v.)
        const stremioPromise = (async () => {
          if (!imdbId) return [];
          const DEFAULT_ADDONS = [
            'https://opensubtitles-v3.strem.io',
            'https://subhero.chromeknight.dev'
          ];
          const userAddons = (env.SUBTITLE_ADDONS || env.VITE_SUBTITLE_ADDONS || '')
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

          return json({ subtitles, source: 'merged' }, 200, {
            'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400'
          });
        } catch (err) {
          return json({ error: err.message, subtitles: [], source: 'merged' }, 500);
        }
      }

      // --- OpenSubtitles REST v2 (optional fallback) ---
      if (provider === 'opensubtitles') {
        const imdbId = url.searchParams.get('imdb_id');
        const tmdbId = url.searchParams.get('tmdb_id');
        const type = url.searchParams.get('type') || 'movie';
        const season = url.searchParams.get('season');
        const episode = url.searchParams.get('episode');
        const apiKey = env.OPENSUBTITLES_API_KEY || env.VITE_OPENSUBTITLES_API_KEY || '';

        if (!apiKey) {
          return json({ error: 'OpenSubtitles API key not configured', subtitles: [] });
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
              ? `https://api.opensubtitles.com/api/v1/download`
              : '',
            format: 'srt',
            fileId: item.attributes?.files?.[0]?.file_id,
            hi: item.attributes?.hearing_impaired || false,
            rating: item.attributes?.ratings || 0,
          }))
          .filter(s => s.fileId);

          return json({ subtitles, source: 'opensubtitles' }, 200, {
            'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400'
          });
        } catch (err) {
          return json({ error: err.message, subtitles: [], source: 'opensubtitles' }, 500);
        }
      }

      return json({ error: 'Unknown provider' }, 400);
    }

    // 4. Proxy cho nguồn phát CinePro Core -> /api/cinepro-proxy
    if (url.pathname.startsWith("/api/cinepro-proxy")) {
      const type = url.searchParams.get('type');
      const tmdbId = url.searchParams.get('tmdbId');

      if (!type || !tmdbId) {
        return json({ error: 'Missing type or tmdbId' }, 400);
      }

      const CINEPRO_BASE = (
        env.CINEPRO_URL ||
        env.VITE_CINEPRO_URL ||
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
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

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

    return new Response("Cinemax CF Worker Proxy is running!", {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "text/plain; charset=utf-8" }
    });
  }
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      ...extraHeaders
    },
  });
}

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
