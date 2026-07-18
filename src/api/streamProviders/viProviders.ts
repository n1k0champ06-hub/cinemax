/**
 * viProviders.ts — Vietnamese source providers
 * Directly fetches and searches from OPhim, KKPhim, and NguonC public APIs.
 * Supports direct slug matching and title-based search fallback.
 */

import type { StreamItem, StreamProvider, StreamQuery } from './types';
import { computeScore } from './types';
import { buildProxiedM3u8Url } from '../cineproApi';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fetchWithTimeout = async (url: string, timeout = 8000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
};


function cleanSearchQuery(str: string): string {
  if (!str) return '';
  return str
    .replace(/\s*[\(\[].*?[\)\]]/g, '')
    .replace(/\b(vietsub|thuyet minh|long tieng|longtieng|thuyetminh|subviet|sub|raw|hd|full|fhd)\b/gi, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getEpisodeNumber(nameStr: string | number | undefined | null): number | null {
  if (nameStr === undefined || nameStr === null) return null;
  const cleaned = nameStr.toString().replace(/\D/g, '');
  if (!cleaned) return null;
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

function matchEpisode(epName: string | number, targetEp: number): boolean {
  const num = getEpisodeNumber(epName);
  return num !== null ? num === targetEp : false;
}

function getBestSlugMatch(
  items: any[],
  queryTitle: string,
  queryTitleVi: string,
  queryYear?: number | string | null,
  querySlug?: string | null,
  queryTmdbId?: string | number,
  queryImdbId?: string,
  queryCasts?: string[]
): string | null {
  if (!items || items.length === 0) return null;

  // 1. Strict TMDB or IMDb matching if IDs are provided
  if (queryTmdbId || queryImdbId) {
    const qTmdb = queryTmdbId ? String(queryTmdbId) : null;
    const qImdb = queryImdbId ? String(queryImdbId) : null;

    for (const item of items) {
      if (qTmdb && item.tmdb && item.tmdb.id && String(item.tmdb.id) === qTmdb) {
        return item.slug;
      }
      if (qImdb && item.imdb && item.imdb.id && String(item.imdb.id) === qImdb) {
        return item.slug;
      }
    }
  }

  // 2. Fallback to string matching
  const qTitle = cleanSearchQuery(queryTitle).toLowerCase();
  const qTitleVi = cleanSearchQuery(queryTitleVi).toLowerCase();
  const qSlug = querySlug ? querySlug.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

  const parsedQueryYear = queryYear ? (typeof queryYear === 'string' ? parseInt(queryYear) : queryYear) : 0;

  const scored = items.map((item: any) => {
    const title = cleanSearchQuery(item.name || '').toLowerCase();
    const origin = cleanSearchQuery(item.origin_name || item.original_name || '').toLowerCase();
    const year = parseInt(item.year) || 0;
    const itemSlug = item.slug ? item.slug.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

    let score = 0;
    
    // Title match
    if (title === qTitleVi || origin === qTitle || title === qTitle) {
      score += 80;
    } else if (title.includes(qTitleVi) || origin.includes(qTitle) || title.includes(qTitle)) {
      score += 50;
    }

    // Slug substring match
    if (qSlug && itemSlug) {
      if (itemSlug === qSlug) {
        score += 90;
      } else if (qSlug.includes(itemSlug) || itemSlug.includes(qSlug)) {
        score += 70;
      }
    }

    if (parsedQueryYear && year) {
      if (Math.abs(year - parsedQueryYear) <= 1) score += 20;
      else score -= 30;
    }

    // Cast overlap match (highly accurate fallback)
    if (queryCasts && queryCasts.length > 0) {
      const itemCasts = typeof item.casts === 'string' ? item.casts.toLowerCase() : 
                        (Array.isArray(item.casts) ? item.casts.join(',').toLowerCase() : 
                        (typeof item.actor === 'string' ? item.actor.toLowerCase() : 
                        (Array.isArray(item.actor) ? item.actor.join(',').toLowerCase() : '')));
      
      if (itemCasts) {
        let overlap = 0;
        for (const qc of queryCasts) {
          if (qc && itemCasts.includes(qc.toLowerCase())) {
            overlap++;
          }
        }
        if (overlap > 0) {
          // Boost significantly if we match actors
          score += (overlap * 15);
        }
      }
    }

    return { slug: item.slug, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score >= 40 ? scored[0].slug : null;
}

// ---------------------------------------------------------------------------
// Main Provider Runner
// ---------------------------------------------------------------------------

async function fetchFromVietnameseApi(
  providerId: 'ophim' | 'kkphim' | 'nguonc',
  providerLabel: string,
  query: StreamQuery
): Promise<StreamItem[]> {
  try {
    const isTv = query.type === 'tv';
    const targetEpisode = isTv ? (query.episode || 1) : 1;
    let slug = query.viSlug;
    let detailData: any = null;
    let detailFetched = false;

    // 1. Try direct slug fetch first if it exists and is not tmdb- (unless we are using KKPhim which natively supports tmdb- slugs)
    if (slug && (providerId === 'kkphim' || !slug.startsWith('tmdb-'))) {
      let detailUrl = '';
      if (providerId === 'ophim') {
        detailUrl = `https://ophim1.com/phim/${slug}`;
      } else if (providerId === 'nguonc') {
        detailUrl = `https://phim.nguonc.com/api/film/${slug}`;
      } else {
        detailUrl = `https://phimapi.com/phim/${slug}`;
      }
      try {
        const res = await fetchWithTimeout(detailUrl, 6000);
        if (res.ok) {
          detailData = await res.json();
          if (detailData && (detailData.status === true || detailData.status === 'success' || detailData.movie || detailData.film || detailData.data)) {
            const movieInfo = detailData.movie || detailData.film || detailData.data || detailData;
            const fetchedYear = movieInfo?.year ? parseInt(movieInfo.year) : 0;
            const queryYear = query.year ? (typeof query.year === 'string' ? parseInt(query.year) : query.year) : 0;
            
            // Reject direct match on year mismatch > 1 (e.g. 2016 vs 2026 for Obsession)
            if (queryYear && fetchedYear && Math.abs(fetchedYear - queryYear) > 1) {
              console.log(`[${providerLabel}] Direct slug fetch returned year ${fetchedYear} but query year is ${queryYear}. Year mismatch, falling back to search.`);
              detailData = null;
            } else {
              detailFetched = true;
            }
          }
        }
      } catch (e) {
        console.warn(`[${providerLabel}] Direct slug fetch failed for ${slug}, will search fallback:`, e);
      }
    }

    // 2. If direct slug fetch failed or was skipped, search by title or slug to resolve slug
    if (!detailFetched) {
      const searchKeywords: string[] = [];

      // Extract high-probability search keywords from the viSlug if available
      if (slug && !slug.startsWith('tmdb-')) {
        const slugCleaned = slug.replace(/-/g, ' ').trim();
        const slugWords = slugCleaned.split(' ').filter(w => w.length > 1);
        if (slugWords.length > 0) {
          if (slugWords.length > 4) {
            searchKeywords.push(slugWords.slice(0, 4).join(' '));
          }
          if (slugWords.length > 3) {
            searchKeywords.push(slugWords.slice(0, 3).join(' '));
          }
          searchKeywords.push(slugCleaned);
        }
      }

      // Add Vietnamese title
      if (query.titleVi) {
        if (isTv && query.season && query.season > 1) {
          searchKeywords.push(`${query.titleVi} Phần ${query.season}`);
        } else {
          searchKeywords.push(query.titleVi);
        }
      }

      // Add English title if different
      if (query.title && query.title !== query.titleVi) {
        if (isTv && query.season && query.season > 1) {
          searchKeywords.push(`${query.title} Season ${query.season}`);
        } else {
          searchKeywords.push(query.title);
        }
      }

      let pooledItems: any[] = [];
      
      // Deduplicate keywords to avoid redundant requests
      const uniqueKeywords = Array.from(new Set(searchKeywords));

      const searchPromises = uniqueKeywords.map(async (kw) => {
        const encodedKw = encodeURIComponent(kw);
        let searchUrl = '';
        if (providerId === 'ophim') {
          searchUrl = `https://ophim1.com/v1/api/tim-kiem?keyword=${encodedKw}&limit=10`;
        } else if (providerId === 'nguonc') {
          searchUrl = `https://phim.nguonc.com/api/films/search?keyword=${encodedKw}`;
        } else {
          searchUrl = `https://phimapi.com/v1/api/tim-kiem?keyword=${encodedKw}&limit=10`;
        }

        try {
          const res = await fetchWithTimeout(searchUrl, 5000);
          if (res.ok) {
            const data = await res.json();
            return data?.data?.items || data?.items || [];
          }
        } catch (e) {
          console.warn(`[${providerLabel}] Search failed for keyword: ${kw}`, e);
        }
        return [];
      });

      const results = await Promise.allSettled(searchPromises);
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          pooledItems = pooledItems.concat(result.value);
        }
      });

      // Deduplicate pooled items by slug
      const seenSlugs = new Set<string>();
      const uniqueItems = pooledItems.filter(item => {
        if (!item || !item.slug) return false;
        if (seenSlugs.has(item.slug)) return false;
        seenSlugs.add(item.slug);
        return true;
      });

      const matchedSlug = getBestSlugMatch(
        uniqueItems,
        query.title,
        query.titleVi || '',
        query.year,
        slug,
        query.tmdbId,
        query.imdbId,
        query.casts
      );

      if (matchedSlug) {
        slug = matchedSlug;
        let detailUrl = '';
        if (providerId === 'ophim') {
          detailUrl = `https://ophim1.com/phim/${slug}`;
        } else if (providerId === 'nguonc') {
          detailUrl = `https://phim.nguonc.com/api/film/${slug}`;
        } else {
          detailUrl = `https://phimapi.com/phim/${slug}`;
        }
        
        try {
          const res = await fetchWithTimeout(detailUrl, 6000);
          if (res.ok) {
            detailData = await res.json();
            detailFetched = true;
          }
        } catch (e) {
          console.error(`[${providerLabel}] Failed to fetch details for resolved fallback slug ${slug}:`, e);
        }
      }
    }

    if (!detailFetched || !detailData) return [];

    // 3. Extract episodes list
    let serversList: any[] = [];
    serversList = detailData?.movie?.episodes || detailData?.episodes || [];

    if (!serversList || serversList.length === 0) return [];

    const streams: StreamItem[] = [];

    // 4. Iterate over servers and find matching episode
    serversList.forEach((server: any) => {
      let serverData = server.server_data || [];
      if (providerId === 'nguonc' && server.items) {
        serverData = server.items.map((item: any) => ({
          name: item.name,
          slug: item.slug,
          filename: item.filename || `Tập ${item.name}`,
          link_embed: item.embed || item.link_embed || '',
          link_m3u8: item.m3u8 || item.link_m3u8 || '',
        }));
      }

      // Find episode
      let activeEp = serverData[0]; // fallback
      if (isTv) {
        const found = serverData.find((ep: any) => matchEpisode(ep.name, targetEpisode));
        if (found) activeEp = found;
        else return; // skip if episode not found on this server
      }

      const serverName = (server.server_name || 'Server').replace(/\s*#\d+/g, '');
      let subType = 'Vietsub';
      const normServerName = serverName.toLowerCase();
      if (normServerName.includes('thuyết minh') || normServerName.includes('thuyet minh')) {
        subType = 'Thuyết minh';
      } else if (normServerName.includes('lồng tiếng') || normServerName.includes('long tieng')) {
        subType = 'Lồng tiếng';
      }

      const labelPrefix = `${providerLabel} · ${serverName}`;

      // Add HLS stream if available (skip NguonC HLS — không ổn định, chỉ giữ embed)
      if (providerId !== 'nguonc' && activeEp.link_m3u8 && String(activeEp.link_m3u8).startsWith('http')) {
        const rawUrl = activeEp.link_m3u8;
        let referer = '';
        if (providerId === 'ophim') referer = 'https://ophim1.com/';
        else if (providerId === 'kkphim') referer = 'https://phimapi.com/';
        else if (providerId === 'nguonc') referer = 'https://phim.nguonc.com/';

        const url = buildProxiedM3u8Url(rawUrl, referer);

        const item: Omit<StreamItem, 'score'> = {
          id: `${providerId}:hls:${serverName}:${rawUrl}`,
          provider: providerId,
          providerLabel: `${providerLabel.toUpperCase()} - ${subType}`,
          type: 'hls',
          url,
          quality: rawUrl.toLowerCase().includes('1080') ? '1080p' : 'auto',
          lang: 'vi',
          label: `${labelPrefix} · HLS`,
          episodeName: activeEp.name || String(targetEpisode),
          category: 'vi',
        };
        streams.push({ ...item, score: computeScore(item) });
      }

      // Add EMBED stream as backup/fallback (only keep NguonC, delete OPhim/KKPhim embed backups)
      if (providerId === 'nguonc' && activeEp.link_embed && String(activeEp.link_embed).startsWith('http')) {
        const embedUrl = activeEp.link_embed;
        const isNguonC = true;
        const labelSuffix = '(Embed)';
        const item: Omit<StreamItem, 'score'> = {
          id: `${providerId}:embed:${serverName}:${embedUrl}`,
          provider: providerId,
          providerLabel: `${providerLabel.toUpperCase()} - ${subType} ${labelSuffix}`,
          type: 'embed',
          url: embedUrl,
          quality: 'auto',
          lang: 'vi',
          label: `${labelPrefix} · Embed${isNguonC ? '' : ' Backup'}`,
          episodeName: activeEp.name || String(targetEpisode),
          category: 'vi',
        };
        streams.push({ ...item, score: computeScore(item) });
      }
    });

    return streams;
  } catch (err) {
    console.error(`[${providerLabel}] Direct API query failed:`, err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export const ophimProvider: StreamProvider = {
  id: 'ophim',
  label: 'OPhim',
  lang: 'vi',
  group: 'vi',
  async fetchStreams(query: StreamQuery) {
    return fetchFromVietnameseApi('ophim', 'OPhim', query);
  },
};

export const kkphimProvider: StreamProvider = {
  id: 'kkphim',
  label: 'KKPhim',
  lang: 'vi',
  group: 'vi',
  async fetchStreams(query: StreamQuery) {
    return fetchFromVietnameseApi('kkphim', 'KKPhim', query);
  },
};

export const nguoncProvider: StreamProvider = {
  id: 'nguonc',
  label: 'NguonC',
  lang: 'vi',
  group: 'vi',
  async fetchStreams(query: StreamQuery) {
    return fetchFromVietnameseApi('nguonc', 'NguonC', query);
  },
};

async function fetchFromXem20Api(query: StreamQuery): Promise<StreamItem[]> {
  try {
    const backendUrl =
      import.meta.env.VITE_BACKEND_URL && import.meta.env.VITE_BACKEND_URL.startsWith('http')
        ? import.meta.env.VITE_BACKEND_URL
        : '';
    const proxyBase = backendUrl ? `${backendUrl}/api/xem20-proxy` : '/api/xem20-proxy';

    const targetEpisode = query.type === 'movie' ? 1 : query.episode || 1;
    
    // 1. Search
    const searchUrl = `${proxyBase}?action=search&keyword=${encodeURIComponent(query.titleVi || query.title)}`;
    const searchRes = await fetchWithTimeout(searchUrl, 3000).catch(() => null);
    if (!searchRes || !searchRes.ok) return [];
    const searchData = await searchRes.json().catch(() => ({}));
    if (!searchData || !searchData.items || searchData.items.length === 0) return [];

    const bestSlug = getBestSlugMatch(
      searchData.items, 
      query.title, 
      query.titleVi || '', 
      query.year, 
      null, 
      query.tmdbId, 
      query.imdbId,
      query.casts
    );
    if (!bestSlug) return [];

    // 2. Get episodes
    const epUrl = `${proxyBase}?action=episodes&slug=${encodeURIComponent(bestSlug)}`;
    const epRes = await fetchWithTimeout(epUrl, 3000).catch(() => null);
    if (!epRes || !epRes.ok) return [];
    const epData = await epRes.json().catch(() => ({}));
    if (!epData || !epData.episodes || epData.episodes.length === 0) return [];

    let targetEpSlug = null;
    let targetEpName = String(targetEpisode);
    
    if (query.type === 'movie') {
       targetEpSlug = epData.episodes[0].epSlug;
       targetEpName = epData.episodes[0].name;
    } else {
       const matchedEp = epData.episodes.find((ep: any) => matchEpisode(ep.name, targetEpisode));
       if (matchedEp) {
         targetEpSlug = matchedEp.epSlug;
         targetEpName = matchedEp.name;
       }
    }

    if (!targetEpSlug) return [];

    // 3. Get stream
    const streamUrl = `${proxyBase}?action=stream&epSlug=${encodeURIComponent(targetEpSlug)}`;
    const streamRes = await fetchWithTimeout(streamUrl, 4000).catch(() => null);
    if (!streamRes || !streamRes.ok) return [];
    const streamData = await streamRes.json().catch(() => ({}));
    
    if (!streamData || !streamData.m3u8Url) return [];

    const rawM3u8Url = streamData.m3u8Url;
    const url = buildProxiedM3u8Url(rawM3u8Url, 'https://xem20.net/');

    const streams: StreamItem[] = [];
    const item: Omit<StreamItem, 'score'> = {
      id: `xem20:hls:${bestSlug}:${rawM3u8Url}`,
      provider: 'xem20',
      providerLabel: `XEM20.NET - Vietsub`,
      type: 'hls',
      url,
      quality: rawM3u8Url.toLowerCase().includes('1080') ? '1080p' : 'auto',
      lang: 'vi',
      label: `XEM20.NET · HLS`,
      episodeName: targetEpName,
      category: 'vi',
    };
    streams.push({ ...item, score: computeScore(item) });

    return streams;
  } catch (_) {
    return [];
  }
}
async function fetchFromHollysheeshApi(query: StreamQuery): Promise<StreamItem[]> {
  try {
    const backendUrl =
      import.meta.env.VITE_BACKEND_URL && import.meta.env.VITE_BACKEND_URL.startsWith('http')
        ? import.meta.env.VITE_BACKEND_URL
        : '';
    const proxyBase = backendUrl ? `${backendUrl}/api/admin/scraper/streams` : '/api/admin/scraper/streams';

    const targetEpisode = query.type === 'movie' ? 1 : query.episode || 1;
    const title = query.title || '';
    const titleVi = query.titleVi || '';
    const year = query.year || 0;
    const slug = query.viSlug || '';

    const streamsUrl = `${proxyBase}?title=${encodeURIComponent(title)}&titleVi=${encodeURIComponent(titleVi)}&year=${year}&episode=${targetEpisode}&slug=${encodeURIComponent(slug)}`;
    const res = await fetchWithTimeout(streamsUrl, 4000).catch(() => null);
    if (!res || !res.ok) return [];

    const data = await res.json().catch(() => ({}));
    if (!data || !data.streams || data.streams.length === 0) return [];

    const streams: StreamItem[] = data.streams.map((s: any) => {
      const isEmbed = s.streamUrl.includes('embed') || s.streamUrl.includes('iframe') || s.streamUrl.includes('streamc.xyz');
      const type = isEmbed ? 'embed' : 'hls';
      
      let url = s.streamUrl;
      if (type === 'hls') {
        let referer = '';
        if (s.streamUrl.includes('phimapi.com')) referer = 'https://phimapi.com/';
        else if (s.streamUrl.includes('ophim')) referer = 'https://ophim1.com/';
        else if (s.streamUrl.includes('nguonc')) referer = 'https://phim.nguonc.com/';
        url = buildProxiedM3u8Url(s.streamUrl, referer);
      }

      const normServer = String(s.server).replace(/\s*#\d+/g, '');
      let subType = 'Vietsub';
      if (normServer.toLowerCase().includes('thuyết minh') || normServer.toLowerCase().includes('thuyet minh')) {
        subType = 'Thuyết minh';
      } else if (normServer.toLowerCase().includes('lồng tiếng') || normServer.toLowerCase().includes('long tieng')) {
        subType = 'Lồng tiếng';
      }

      const item: Omit<StreamItem, 'score'> = {
        id: `hollysheesh:${type}:${s.server}:${s.streamUrl}`,
        provider: 'hollysheesh',
        providerLabel: `HOLLYSHEESH - ${subType}`,
        type,
        url,
        quality: s.streamUrl.toLowerCase().includes('1080') ? '1080p' : 'auto',
        lang: 'vi',
        label: `HOLLYSHEESH · ${s.server} · ${type.toUpperCase()}`,
        episodeName: s.episode,
        category: 'vi',
      };
      return { ...item, score: 999 };
    });

    return streams;
  } catch (_) {
    return [];
  }
}

export const hollysheeshProvider: StreamProvider = {
  id: 'hollysheesh',
  label: 'Hollysheesh',
  lang: 'vi',
  group: 'vi',
  async fetchStreams(query: StreamQuery) {
    return fetchFromHollysheeshApi(query);
  },
};

export const xem20Provider: StreamProvider = {
  id: 'xem20',
  label: 'Xem20.Net',
  lang: 'vi',
  group: 'vi',
  async fetchStreams(query: StreamQuery) {
    return fetchFromXem20Api(query);
  },
};

export const VI_PROVIDERS: StreamProvider[] = [
  hollysheeshProvider,
  kkphimProvider,
  ophimProvider,
  nguoncProvider,
  xem20Provider,
];
