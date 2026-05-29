/**
 * viProviders.ts — Vietnamese source providers
 * Directly fetches and searches from OPhim, KKPhim, and NguonC public APIs.
 * Supports direct slug matching and title-based search fallback.
 */

import type { StreamItem, StreamProvider, StreamQuery } from './types';
import { computeScore } from './types';

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

const getNguonCUrl = (url: string) => {
  if (typeof window !== 'undefined') {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return `/api/nguonc-proxy?url=${encodeURIComponent(url)}`;
    }
    return `https://focusflow.id.vn/api/nguonc-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
};

function cleanSearchQuery(str: string): string {
  if (!str) return '';
  return str
    .replace(/\s*[\(\[].*?[\)\]]/g, '')
    .replace(/\b(vietsub|thuyet minh|long tieng|longtieng|thuyetminh|subviet|sub|raw|hd|full|fhd)\b/gi, '')
    .replace(/[^a-zA-Z0-9\sÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂÂÊÔƠưăâêôơ]/g, ' ')
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
  queryYear?: number
): string | null {
  if (!items || items.length === 0) return null;

  const qTitle = cleanSearchQuery(queryTitle).toLowerCase();
  const qTitleVi = cleanSearchQuery(queryTitleVi).toLowerCase();

  const scored = items.map((item: any) => {
    const title = cleanSearchQuery(item.name || '').toLowerCase();
    const origin = cleanSearchQuery(item.origin_name || item.original_name || '').toLowerCase();
    const year = parseInt(item.year) || 0;

    let score = 0;
    if (title === qTitleVi || origin === qTitle || title === qTitle) {
      score += 80;
    } else if (title.includes(qTitleVi) || origin.includes(qTitle) || title.includes(qTitle)) {
      score += 50;
    }

    if (queryYear && year) {
      if (Math.abs(year - queryYear) <= 1) score += 20;
      else score -= 30;
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

    // 1. If viSlug starts with tmdb- or is null, search by title to find the slug
    if (!slug || slug.startsWith('tmdb-')) {
      const year = query.season && query.season > 1 ? undefined : undefined; // we match title first
      
      // Build search keywords
      const searchKeywords: string[] = [];
      const baseTitle = query.titleVi || query.title;
      
      if (isTv && query.season && query.season > 1) {
        searchKeywords.push(`${baseTitle} Phần ${query.season}`);
        searchKeywords.push(`${baseTitle} Season ${query.season}`);
      } else {
        searchKeywords.push(baseTitle);
      }

      let matchedSlug: string | null = null;
      
      for (const kw of searchKeywords) {
        const encodedKw = encodeURIComponent(kw);
        let searchUrl = '';
        if (providerId === 'nguonc') {
          searchUrl = getNguonCUrl(`https://phim.nguonc.com/api/films/search?keyword=${encodedKw}`);
        } else if (providerId === 'ophim') {
          searchUrl = `https://ophim1.com/v1/api/tim-kiem?keyword=${encodedKw}&limit=10`;
        } else {
          // kkphim
          searchUrl = `https://phimapi.com/v1/api/tim-kiem?keyword=${encodedKw}&limit=10`;
        }

        try {
          const res = await fetchWithTimeout(searchUrl, 5000);
          const data = await res.json();
          let items: any[] = [];
          
          if (providerId === 'nguonc') {
            items = data?.items || [];
          } else {
            items = data?.data?.items || data?.items || [];
          }

          matchedSlug = getBestSlugMatch(items, query.title, query.titleVi || '');
          if (matchedSlug) break;
        } catch (e) {
          console.warn(`[${providerLabel}] Search failed for keyword: ${kw}`, e);
        }
      }

      if (!matchedSlug) return [];
      slug = matchedSlug;
    }

    // 2. Fetch movie details
    let detailUrl = '';
    if (providerId === 'nguonc') {
      detailUrl = getNguonCUrl(`https://phim.nguonc.com/api/film/${slug}`);
    } else if (providerId === 'ophim') {
      detailUrl = `https://ophim1.com/phim/${slug}`;
    } else {
      detailUrl = `https://phimapi.com/phim/${slug}`;
    }

    const res = await fetchWithTimeout(detailUrl, 6000);
    const detailData = await res.json();

    // 3. Extract episodes list
    let serversList: any[] = [];
    if (providerId === 'nguonc') {
      serversList = detailData?.data?.item?.episodes || detailData?.episodes || [];
    } else {
      serversList = detailData?.episodes || [];
    }

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

      const labelPrefix = `${providerLabel} · ${server.server_name || 'Server'}`;

      // Add HLS stream if available
      if (activeEp.link_m3u8 && String(activeEp.link_m3u8).startsWith('http')) {
        const url = activeEp.link_m3u8;
        const item: Omit<StreamItem, 'score'> = {
          id: `${providerId}:hls:${server.server_name || 'vip'}:${url}`,
          provider: providerId,
          providerLabel: `${providerLabel} (${server.server_name || 'VIP'}) - HLS`,
          type: 'hls',
          url,
          quality: url.toLowerCase().includes('1080') ? '1080p' : 'auto',
          lang: 'vi',
          label: `${labelPrefix} · Vietsub · HLS`,
          episodeName: activeEp.name || String(targetEpisode),
          category: 'vi',
        };
        streams.push({ ...item, score: computeScore(item) });
      }

      // Only HLS streams are kept for Vietnamese sources as requested
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

export const VI_PROVIDERS: StreamProvider[] = [
  ophimProvider,
  kkphimProvider,
  nguoncProvider,
];
