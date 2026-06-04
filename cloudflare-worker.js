/**
 * Cloudflare Worker Unified Proxy Server
 * 
 * Triển khai file này lên Cloudflare Workers để làm proxy cho:
 * 1. TMDB API (Vượt chặn nhà mạng) -> /tmdb/*
 * 2. Hình ảnh poster (Bypass nhà mạng chặn) -> /img/[url]
 * 3. Tìm phụ đề (Subdl & Stremio Addons) -> /api/sub-proxy
 * 4. Nguồn phát CinePro Core -> /api/cinepro-proxy
 */

import crypto from 'node:crypto';

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

    // 5. Proxy AllAnime / AllManga -> /api/allmanga-proxy
    if (url.pathname.startsWith("/api/allmanga-proxy")) {
      const title = url.searchParams.get('title');
      const seasonNumber = parseInt(url.searchParams.get('season') || '1', 10);
      const episodeNumber = parseInt(url.searchParams.get('episode') || '1', 10);
      const isMovie = url.searchParams.get('isMovie') === 'true';
      const translationType = url.searchParams.get('translationType') === 'dub' ? 'dub' : 'sub';

      if (!title) {
        return json({ error: 'Missing title' }, 400);
      }

      try {
        const season = seasonNumber || 1;
        const dubSub = translationType;

        // 1. Check split season map
        if (!isMovie) {
          const splitParts = SPLIT_SEASONS[title.toLowerCase()]?.[season];
          if (splitParts) {
            let activePart = splitParts[0];
            for (const part of splitParts) {
              if (episodeNumber >= part.from) activePart = part;
            }
            const partEp = episodeNumber - activePart.offset;
            if (activePart.showId) {
              const result = await resolveEpisodeFromId(
                activePart.showId,
                String(partEp),
                dubSub
              );
              if (result && result.length > 0) return json({ ok: true, streams: result });
            }
          }
        }

        // 2. Check hardcoded show IDs
        if (!isMovie) {
          const hardcodedIds = HARDCODED_SHOW_IDS[title.toLowerCase()];
          if (hardcodedIds) {
            const showId = hardcodedIds[season - 1] ?? hardcodedIds[hardcodedIds.length - 1];
            const result = await resolveEpisodeFromId(
              showId,
              String(episodeNumber),
              dubSub
            );
            if (result && result.length > 0) return json({ ok: true, streams: result });
          }
        }

        // 3. AniList season title lookup
        const anilistResult = isMovie
          ? { title, romaji: null, episodes: null, nextTitle: null, nextRomaji: null }
          : await anilistSeasonTitle(title, season);

        let searchTitle = anilistResult.title;
        let adjustedEpisodeNumber = episodeNumber;

        if (
          !isMovie &&
          anilistResult.episodes &&
          episodeNumber > anilistResult.episodes &&
          anilistResult.nextTitle
        ) {
          adjustedEpisodeNumber = episodeNumber - anilistResult.episodes;
          searchTitle = anilistResult.nextTitle;
        }

        const epStr = isMovie ? "1" : String(adjustedEpisodeNumber);

        // 4. Build search candidate list
        const candidateSet = new Set([
          searchTitle,
          sanitizeTitle(searchTitle),
          ...(anilistResult.romaji && searchTitle === anilistResult.title ? [anilistResult.romaji] : []),
          ...(anilistResult.nextRomaji && searchTitle === anilistResult.nextTitle ? [anilistResult.nextRomaji] : []),
          title,
          sanitizeTitle(title),
        ]);
        const candidates = [...candidateSet].filter(Boolean);

        // 5. Search AllManga
        async function searchAllmanga(query) {
          const vars = {
            search: {
              allowAdult: true,
              allowUnknown: false,
              query: query.toLowerCase(),
            },
            limit: 40,
            page: 1,
            translationType: dubSub,
            countryOrigin: "ALL",
          };
          const res = await allanimeGQL(vars, SEARCH_GQL);
          if (!res.body) return null;
          try {
            const edges = JSON.parse(res.body)?.data?.shows?.edges;
            return edges?.length ? edges : null;
          } catch {
            return null;
          }
        }

        let edges = null, matchedTitle = searchTitle;
        for (const candidate of candidates) {
          edges = await searchAllmanga(candidate);
          if (edges) {
            matchedTitle = candidate;
            break;
          }
        }
        if (!edges) {
          return json({ error: "No results for: " + searchTitle, streams: [] }, 404);
        }

        const titleLower = matchedTitle.toLowerCase();
        const anime = edges.find((e) => (e.name || "").toLowerCase() === titleLower) || edges[0];

        // 6. Get episode sourceUrls
        const epCandidates = [epStr];
        if (!epStr.includes(".")) epCandidates.push(epStr + ".0");

        let sourceUrls = null;
        for (const attempt of epCandidates) {
          const epRes = await allanimeGQLEpisode({
            showId: anime._id,
            translationType: dubSub,
            episodeString: attempt,
          });
          if (!epRes.body) continue;
          const urls = parseEpisodeSourceUrls(epRes.body);
          if (urls?.length) {
            sourceUrls = urls;
            break;
          }
        }

        if (!sourceUrls?.length) {
          return json({ error: "No sourceUrls for ep " + epStr, streams: [] }, 404);
        }

        // 7. Decode and try each source
        const streams = await trySourceUrls(sourceUrls);
        return json({ ok: true, streams });

      } catch (e) {
        return json({ error: e.message, streams: [] }, 500);
      }
    }

    // 5.5 Proxy IMDb API -> /api/imdb-proxy
    if (url.pathname.startsWith("/api/imdb-proxy")) {
      const imdbId = url.searchParams.get('imdbId');
      if (!imdbId) {
        return json({ error: 'Missing imdbId' }, 400);
      }
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
          console.error(`[imdb-proxy CF] IMDb API returned ${res.status}: ${errorText.slice(0, 200)}`);
          return json({ error: `IMDb API returned ${res.status}` }, res.status);
        }

        const data = await res.json();
        return json(data, 200, {
          'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=172800'
        });

      } catch (err) {
        if (err.name === 'AbortError') {
          return json({ error: 'IMDb API request timed out (12s)' }, 504);
        }
        return json({ error: err.message }, 500);
      }
    }


    // 6. Proxy cho img-proxy -> /api/img-proxy
    if (url.pathname.startsWith("/api/img-proxy")) {
      const imageUrl = url.searchParams.get('url');
      if (!imageUrl) {
        return new Response('Missing url', { status: 400, headers: CORS_HEADERS });
      }
      try {
        const response = await fetch(imageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        const body = await response.arrayBuffer();
        return new Response(body, {
          status: response.status,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
            'Cache-Control': 'public, max-age=31536000, immutable'
          }
        });
      } catch (err) {
        return new Response('Error fetching image', { status: 500, headers: CORS_HEADERS });
      }
    }

    // 7. Proxy cho m3u8-proxy -> /api/m3u8-proxy
    if (url.pathname.startsWith("/api/m3u8-proxy")) {
      const targetUrl = url.searchParams.get('url');
      const referer = url.searchParams.get('referer') || '';
      const origin = url.searchParams.get('origin') || (referer ? new URL(referer).origin : '');
      const userAgent = url.searchParams.get('ua') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';

      if (!targetUrl) {
        return json({ error: 'Missing url param' }, 400);
      }

      let parsedTarget;
      try {
        parsedTarget = new URL(targetUrl);
        if (!['http:', 'https:'].includes(parsedTarget.protocol)) throw new Error('Invalid protocol');
      } catch {
        return json({ error: 'Invalid url' }, 400);
      }

      const fetchHeaders = {
        'User-Agent': userAgent,
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
      };
      if (referer) fetchHeaders['Referer'] = referer;
      if (origin) fetchHeaders['Origin'] = origin;

      const rangeHeader = request.headers.get('Range');
      if (rangeHeader) fetchHeaders['Range'] = rangeHeader;

      let res;
      const referersToTry = [referer];
      const isOPhimTarget = targetUrl.includes('opstream') || targetUrl.includes('ophim') || targetUrl.includes('phimimg') || referer.includes('ophim') || referer.includes('opstream');
      const isKKPhimTarget = targetUrl.includes('kkphim') || targetUrl.includes('phimapi') || referer.includes('kkphim') || referer.includes('phimapi');
      
      if (isOPhimTarget) {
        const candidates = [
          'https://ophim1.com/',
          'https://ophim.tv/',
          'https://ophim.cc/',
          'https://ophim.live/',
          'https://opstream.tv/'
        ];
        for (const c of candidates) {
          if (c && c !== referer) referersToTry.push(c);
        }
      } else if (isKKPhimTarget) {
        const candidates = [
          'https://phimapi.com/',
          'https://kkphim.com/',
          'https://kkphim.link/',
        ];
        for (const c of candidates) {
          if (c && c !== referer) referersToTry.push(c);
        }
      }

      for (let i = 0; i < referersToTry.length; i++) {
        const currentReferer = referersToTry[i];
        const headers = { ...fetchHeaders };
        if (currentReferer) {
          headers['Referer'] = currentReferer;
          try {
            headers['Origin'] = new URL(currentReferer).origin;
          } catch (e) {}
        } else {
          delete headers['Referer'];
          delete headers['Origin'];
        }

        try {
          res = await fetch(targetUrl, {
            headers,
            redirect: 'follow',
          });
          if (res.ok || res.status === 206 || res.status !== 403) {
            break;
          }
          console.warn(`[m3u8-proxy CF] 403 Forbidden with referer ${currentReferer}, retrying next...`);
        } catch (err) {
          if (i === referersToTry.length - 1) {
            return json({ error: `Fetch failed: ${err.message}` }, 502);
          }
        }
      }

      if (!res.ok && res.status !== 206) {
        return json({ error: `Upstream returned ${res.status}` }, res.status);
      }

        const contentType = res.headers.get('Content-Type') || '';
        const isM3U8 = contentType.includes('mpegurl') || contentType.includes('x-mpegURL') || targetUrl.includes('.m3u8');
        const isTS = contentType.includes('video/') || contentType.includes('application/octet') || targetUrl.match(/\.(ts|aac|mp4|m4s|fmp4)(\?|$)/);

        if (isM3U8 || (!isTS && !contentType.includes('video/'))) {
          const text = await res.text();
          const rewritten = rewriteM3U8(text, targetUrl, referer, url);

          return new Response(rewritten, {
            status: res.status,
            headers: {
              ...CORS_HEADERS,
              'Content-Type': 'application/vnd.apple.mpegurl',
              'Cache-Control': 'no-cache',
              'X-Proxy-Source': parsedTarget.hostname,
            },
          });
        }

        const body = await res.arrayBuffer();
        const responseHeaders = {
          ...CORS_HEADERS,
          'Content-Type': contentType || 'video/MP2T',
          'Cache-Control': 'public, max-age=3600',
        };

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

    // 8. KV Fallback — cached Vietnamese streams ->/api/kv-fallback
    if (url.pathname.startsWith("/api/kv-fallback")) {
      const slug = url.searchParams.get('slug');
      if (!slug) {
        return json({ error: 'Missing slug param' }, 400);
      }

      try {
        const kvKey = `movie:${slug}`;
        const raw = await env.MOVIE_CACHE.get(kvKey);
        if (!raw) {
          return json({ error: 'Not found in cache', slug }, 404, {
            'Cache-Control': 'public, max-age=60',
          });
        }

        const data = JSON.parse(raw);
        const episode = url.searchParams.get('episode') || '1';

        // Check staleness (48 hours)
        let stale = false;
        if (data.sources_updated) {
          const updatedAt = new Date(data.sources_updated).getTime();
          const now = Date.now();
          stale = (now - updatedAt) > 48 * 60 * 60 * 1000;
        }

        // Build response
        if (url.searchParams.has('episode') || data.type !== 'series') {
          // Return streams for a specific episode (or the single movie entry)
          const epData = data.episodes?.[episode];
          if (!epData) {
            return json({
              error: `Episode ${episode} not found`,
              slug,
              available_episodes: data.episodes ? Object.keys(data.episodes) : [],
            }, 404, {
              'Cache-Control': 'public, max-age=60',
            });
          }

          return json({
            title: data.title,
            title_en: data.title_en,
            year: data.year,
            type: data.type,
            episode,
            streams: epData.streams || [],
            sources_updated: data.sources_updated,
            ...(stale ? { stale: true } : {}),
          }, 200, {
            'Cache-Control': stale
              ? 'public, max-age=60, stale-while-revalidate=300'
              : 'public, max-age=900, s-maxage=1800, stale-while-revalidate=3600',
          });
        }

        // Return all episodes data
        return json({
          title: data.title,
          title_en: data.title_en,
          year: data.year,
          type: data.type,
          episodes: data.episodes,
          sources_updated: data.sources_updated,
          ...(stale ? { stale: true } : {}),
        }, 200, {
          'Cache-Control': stale
            ? 'public, max-age=60, stale-while-revalidate=300'
            : 'public, max-age=900, s-maxage=1800, stale-while-revalidate=3600',
        });

      } catch (err) {
        console.error('[kv-fallback] Error:', err.message);
        return json({ error: err.message }, 500);
      }
    }
    // 9. AniList cover search proxy -> /api/anilist
    if (url.pathname.startsWith("/api/anilist")) {
      const search = url.searchParams.get('search');
      if (!search) {
        return json({ error: 'Missing search param' }, 400);
      }

      const cleanTitle = search
        .replace(/\s*[\(\[].*?[\)\]]/g, "") // remove brackets contents
        .replace(/\s*-\s*Phần\s+\d+/gi, "") // remove " - Phần X"
        .replace(/\s*Phần\s+\d+/gi, "")     // remove "Phần X"
        .replace(/\s*Season\s+\d+/gi, "")   // remove "Season X"
        .replace(/\s*Part\s+\d+/gi, "")     // remove "Part X"
        .replace(/\s*P\d+/gi, "")           // remove "P5"
        .trim();

      const RAPIDAPI_HOST = 'Anilistmikilior1V1.p.rapidapi.com';
      const RAPIDAPI_KEY = '1349644f56mshbd1a582f9f80113p171564jsneb07bf153208';
      const RAPIDAPI_URL = 'https://anilistmikilior1v1.p.rapidapi.com/searchSeries';

      // Try RapidAPI first with a strict 2s timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      try {
        const response = await fetch(RAPIDAPI_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-host': RAPIDAPI_HOST,
            'x-rapidapi-key': RAPIDAPI_KEY,
          },
          body: JSON.stringify({ search: cleanTitle }),
          signal: controller.signal,
        });

        if (response.ok) {
          const data = await response.json();
          const media = data?.data?.Media || data?.Media || (Array.isArray(data) ? data[0] : data);
          if (media) {
            clearTimeout(timeoutId);
            return json({
              extraLarge: media.coverImage?.extraLarge || media.coverImage?.large || null,
              large: media.coverImage?.large || media.coverImage?.medium || null,
              medium: media.coverImage?.medium || null,
              banner: media.bannerImage || null,
              color: media.coverImage?.color || null,
            }, 200, {
              'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=43200',
            });
          }
        }
      } catch (err) {
        // Fail silently
      } finally {
        clearTimeout(timeoutId);
      }

      // Fallback to official GraphQL endpoint
      try {
        const gqlQuery = `
          query ($search: String) {
            Media (search: $search, type: ANIME) {
              id
              title {
                english
                romaji
                native
              }
              coverImage {
                extraLarge
                large
                medium
                color
              }
              bannerImage
            }
          }
        `;

        const fallbackRes = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            query: gqlQuery,
            variables: { search: cleanTitle }
          })
        });

        if (fallbackRes.ok) {
          const result = await fallbackRes.json();
          const media = result?.data?.Media;
          if (media) {
            return json({
              extraLarge: media.coverImage?.extraLarge || null,
              large: media.coverImage?.large || null,
              medium: media.coverImage?.medium || null,
              banner: media.bannerImage || null,
              color: media.coverImage?.color || null,
            }, 200, {
              'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=43200',
            });
          }
        }
      } catch (err) {
        // Fail silently
      }

      return json(null);
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

// ---------------------------------------------------------------------------
// rewriteM3U8 Parser & Rewriter
// ---------------------------------------------------------------------------

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

    // Non-comment, non-empty lines are segment or sub-playlist URLs
    if (!trimmed.startsWith('#')) {
      const absolute = resolveUrl(trimmed);
      // Only proxy sub-playlists (.m3u8) to keep browser playing and rewrite nested playlists.
      // Video segments (.ts, .mp4, etc.) are fetched directly to avoid bandwidth limits and CDN blocks.
      const isPlaylist = absolute.toLowerCase().includes('.m3u8');
      if (isPlaylist) {
        return buildProxyUrl(absolute);
      }
      return absolute;
    }

    return line;
  });

  return result.join('\n');
}

// ---------------------------------------------------------------------------
// AllManga/AllAnime Scraper Helpers
// ---------------------------------------------------------------------------

const ALLANIME_HEX_MAP = {
  79: "A",
  "7a": "B",
  "7b": "C",
  "7c": "D",
  "7d": "E",
  "7e": "F",
  "7f": "G",
  70: "H",
  71: "I",
  72: "J",
  73: "K",
  74: "L",
  75: "M",
  76: "N",
  77: "O",
  68: "P",
  69: "Q",
  "6a": "R",
  "6b": "S",
  "6c": "T",
  "6d": "U",
  "6e": "V",
  "6f": "W",
  60: "X",
  61: "Y",
  62: "Z",
  59: "a",
  "5a": "b",
  "5b": "c",
  "5c": "d",
  "5d": "e",
  "5e": "f",
  "5f": "g",
  50: "h",
  51: "i",
  52: "j",
  53: "k",
  54: "l",
  55: "m",
  56: "n",
  57: "o",
  48: "p",
  49: "q",
  "4a": "r",
  "4b": "s",
  "4c": "t",
  "4d": "u",
  "4e": "v",
  "4f": "w",
  40: "x",
  41: "y",
  42: "z",
  "08": "0",
  "09": "1",
  "0a": "2",
  "0b": "3",
  "0c": "4",
  "0d": "5",
  "0e": "6",
  "0f": "7",
  "00": "8",
  "01": "9",
  15: "-",
  16: ".",
  67: "_",
  46: "~",
  "02": ":",
  17: "/",
  "07": "?",
  "1b": "#",
  63: "[",
  65: "]",
  78: "@",
  19: "!",
  "1c": "$",
  "1e": "&",
  10: "(",
  11: ")",
  12: "*",
  13: "+",
  14: ",",
  "03": ";",
  "05": "=",
  "1d": "%",
};

function decodeAllanimeUrl(encoded) {
  if (encoded.startsWith("--")) encoded = encoded.slice(2);
  let result = "";
  for (let i = 0; i < encoded.length; i += 2) {
    const pair = encoded.slice(i, i + 2);
    result += ALLANIME_HEX_MAP[pair] !== undefined ? ALLANIME_HEX_MAP[pair] : pair;
  }
  return result.replace(/\\u002F/gi, "/").replace(/\\\|/g, "");
}

const ALLANIME_KEY = crypto
  .createHash("sha256")
  .update("Xot36i3lK3:v1")
  .digest();

function decodeTobeparsed(blob) {
  try {
    const buf = Buffer.from(blob, "base64");
    const iv12 = buf.slice(1, 13);
    const iv16 = Buffer.concat([iv12, Buffer.from([0, 0, 0, 2])]);
    const ct = buf.slice(13, buf.length - 16);
    const decipher = crypto.createDecipheriv("aes-256-ctr", ALLANIME_KEY, iv16);
    decipher.setAutoPadding(false);
    const plain = Buffer.concat([
      decipher.update(ct),
      decipher.final(),
    ]).toString("utf8");

    const sources = [];
    for (const chunk of plain.split(/[{}]/)) {
      const urlMatch = chunk.match(/"sourceUrl"\s*:\s*"(--[^"]+)"/);
      const nameMatch = chunk.match(/"sourceName"\s*:\s*"([^"]+)"/);
      const prioMatch = chunk.match(/"priority"\s*:\s*([0-9.]+)/);
      if (urlMatch) {
        sources.push({
          sourceUrl: urlMatch[1],
          sourceName: nameMatch ? nameMatch[1] : "",
          priority: prioMatch ? parseFloat(prioMatch[1]) : 0,
        });
      }
    }
    return sources;
  } catch {
    return [];
  }
}

function parseEpisodeSourceUrls(body) {
  const tbMatch = body.match(/"tobeparsed"\s*:\s*"([^"]+)"/);
  if (tbMatch) {
    const sources = decodeTobeparsed(tbMatch[1]);
    if (sources.length) return sources;
  }
  try {
    const sourceUrls = JSON.parse(body)?.data?.episode?.sourceUrls;
    return sourceUrls?.length ? sourceUrls : null;
  } catch {
    return null;
  }
}

function sanitizeTitle(t) {
  return t
    .replace(/[''`´]/g, "")
    .replace(/[:!.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function anilistSeasonTitle(baseTitle, seasonNumber) {
  return new Promise((resolve) => {
    const resolveS1 = seasonNumber <= 1;
    const query = `query($search:String){Media(search:$search,type:ANIME,sort:SEARCH_MATCH){title{english romaji}episodes relations{edges{relationType node{type format title{english romaji}episodes startDate{year}seasonYear}}}}}`;
    const body = JSON.stringify({ query, variables: { search: baseTitle } });

    const fallback = {
      title: baseTitle,
      romaji: null,
      episodes: null,
      nextTitle: null,
      nextRomaji: null,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    fetch("https://graphql.anilist.co/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body,
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((json) => {
        clearTimeout(timeoutId);
        const media = json?.data?.Media;
        if (!media) return resolve(fallback);

        const s1Romaji = media?.title?.romaji || null;
        const s1Episodes = media?.episodes || null;
        const sequels = (media.relations?.edges || [])
          .filter(
            (e) =>
              e.relationType === "SEQUEL" &&
              e.node.type === "ANIME" &&
              (e.node.format === "TV" || e.node.format === "TV_SHORT")
          )
          .sort((a, b) => {
            const ya = a.node.startDate?.year || a.node.seasonYear || 9999;
            const yb = b.node.startDate?.year || b.node.seasonYear || 9999;
            return ya - yb;
          });

        const getTitle = (node) => node.title?.english || node.title?.romaji || null;
        const getRomaji = (node) => node.title?.romaji || null;

        if (resolveS1) {
          const next = sequels[0]?.node ?? null;
          return resolve({
            title: media.title?.english || baseTitle,
            romaji: s1Romaji,
            episodes: s1Episodes,
            nextTitle: next ? getTitle(next) : null,
            nextRomaji: next ? getRomaji(next) : null,
          });
        }

        const target = sequels[seasonNumber - 2];
        if (!target) return resolve({ ...fallback, romaji: s1Romaji });

        const nextNode = sequels[seasonNumber - 1]?.node ?? null;
        resolve({
          title: getTitle(target.node) || baseTitle,
          romaji: getRomaji(target.node) || s1Romaji,
          episodes: target.node.episodes || null,
          nextTitle: nextNode ? getTitle(nextNode) : null,
          nextRomaji: nextNode ? getRomaji(nextNode) : null,
        });
      })
      .catch(() => {
        clearTimeout(timeoutId);
        resolve(fallback);
      });
  });
}

const SEARCH_GQL = `query($search:SearchInput $limit:Int $page:Int $translationType:VaildTranslationTypeEnumType $countryOrigin:VaildCountryOriginEnumType){shows(search:$search limit:$limit page:$page translationType:$translationType countryOrigin:$countryOrigin){edges{_id name availableEpisodes __typename}}}`;
const EPISODE_GQL = `query($showId:String! $translationType:VaildTranslationTypeEnumType! $episodeString:String!){episode(showId:$showId translationType:$translationType episodeString:$episodeString){episodeString sourceUrls}}`;
const EPISODE_GQL_HASH = "d405d0edd690624b66baba3068e0edc3ac90f1597d898a1ec8db4e5c43c00fec";

async function allanimeGQL(variables, query) {
  const body = JSON.stringify({ variables, query });
  const res = await fetch("https://api.allanime.day/api", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
      Referer: "https://allmanga.to",
      Origin: "https://allmanga.to",
    },
    body,
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

async function allanimeGQLEpisode(variables) {
  try {
    const encodedVars = encodeURIComponent(JSON.stringify(variables));
    const extensions = JSON.stringify({
      persistedQuery: { version: 1, sha256Hash: EPISODE_GQL_HASH },
    });
    const encodedExt = encodeURIComponent(extensions);
    const getUrl = `https://api.allanime.day/api?variables=${encodedVars}&extensions=${encodedExt}`;

    const res = await fetch(getUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
        Referer: "https://allmanga.to",
        Origin: "https://youtu-chan.com",
        Accept: "*/*",
      },
    });
    const text = await res.text();
    if (text && text.includes("tobeparsed")) {
      return { status: res.status, body: text };
    }
  } catch (e) {
    // Ignore
  }
  return allanimeGQL(variables, EPISODE_GQL);
}

async function followRedirects(urlStr, maxHops = 10) {
  let url = urlStr;
  let hops = 0;
  while (hops < maxHops) {
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        redirect: 'manual',
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
          Referer: "https://allmanga.to",
          Accept: "*/*",
        }
      });
      
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (loc) {
          url = loc.startsWith('http') ? loc : new URL(loc, url).href;
          hops++;
          continue;
        }
      }
      return url;
    } catch {
      return url;
    }
  }
  return url;
}

const PROVIDER_PRIORITY = ["S-mp4", "Luf-Mp4", "Yt-mp4", "Default", "Sl-Hls"];

async function trySourceUrls(sourceUrls) {
  const decodedSources = sourceUrls
    .filter((s) => s.sourceUrl?.startsWith("--"))
    .map((s) => ({
      sourceName: s.sourceName || "",
      priority: s.priority || 0,
      path: decodeAllanimeUrl(s.sourceUrl).replace("/clock", "/clock.json"),
    }))
    .sort((a, b) => {
      const ai = PROVIDER_PRIORITY.indexOf(a.sourceName);
      const bi = PROVIDER_PRIORITY.indexOf(b.sourceName);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  const resolved = [];

  for (const src of decodedSources) {
    let fetchUrl = src.path;
    if (fetchUrl.startsWith("//")) fetchUrl = "https:" + fetchUrl;
    else if (fetchUrl.startsWith("/")) fetchUrl = "https://allanime.day" + fetchUrl;
    else if (!fetchUrl.startsWith("http")) fetchUrl = "https://allanime.day/" + fetchUrl;

    try {
      if (fetchUrl.includes("fast4speed.rsvp") || src.sourceName === "Yt-mp4") {
        const finalUrl = await followRedirects(fetchUrl).catch(() => null);
        if (!finalUrl) continue;

        if (finalUrl.includes("youtube.com/watch") || finalUrl.includes("youtu.be/")) {
          continue;
        }

        resolved.push({
          url: finalUrl,
          quality: "auto",
          sourceName: src.sourceName,
          isHLS: finalUrl.includes(".m3u8"),
          headers: { Referer: "https://allmanga.to" },
        });
        continue;
      }

      const res = await fetch(fetchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
          Referer: "https://allmanga.to",
          Accept: "*/*",
        }
      });
      if (!res.ok) continue;
      const data = await res.json();
      const links = data?.links;
      if (!links?.length) continue;

      for (const l of links) {
        if (!l.link) continue;
        resolved.push({
          url: l.link,
          quality: l.resolutionStr || "auto",
          sourceName: src.sourceName,
          isHLS: l.link.includes(".m3u8"),
          headers: { Referer: "https://allmanga.to" },
        });
      }
    } catch {
      // Continue
    }
  }

  return resolved;
}

const HARDCODED_SHOW_IDS = {
  "jojo's bizarre adventure": [
    "MeX4czvkwKGo3zdDp",
    "zyqDjR8te4z6taKyk",
    "GTAQH8Z9K6WbAdXsS",
    "JS9PzKiPanesGRvs5",
    "b6xFsr7MDSMcJArB9",
    "pwduJkjBLytqiWCvM",
  ],
};

const SPLIT_SEASONS = {
  "spy x family": {
    1: [
      { from: 1, showId: null, offset: 0 },
      { from: 13, showId: "H8Aey6QXE7HSqwvW3", offset: 12 },
    ],
  },
};

async function resolveEpisodeFromId(showId, epStr, dubSub) {
  const candidates = [epStr];
  if (!epStr.includes(".")) candidates.push(epStr + ".0");

  let sourceUrls = null;
  for (const attempt of candidates) {
    const epRes = await allanimeGQLEpisode({
      showId,
      translationType: dubSub,
      episodeString: attempt,
    });
    if (!epRes.body) continue;
    const urls = parseEpisodeSourceUrls(epRes.body);
    if (urls?.length) {
      sourceUrls = urls;
      break;
    }
  }
  if (!sourceUrls) return null;
  return trySourceUrls(sourceUrls);
}
