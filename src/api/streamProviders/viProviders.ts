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
  queryYear?: number,
  querySlug?: string | null
): string | null {
  if (!items || items.length === 0) return null;

  const qTitle = cleanSearchQuery(queryTitle).toLowerCase();
  const qTitleVi = cleanSearchQuery(queryTitleVi).toLowerCase();
  const qSlug = querySlug ? querySlug.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

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
  providerId: 'ophim' | 'kkphim',
  providerLabel: string,
  query: StreamQuery
): Promise<StreamItem[]> {
  try {
    const isTv = query.type === 'tv';
    const targetEpisode = isTv ? (query.episode || 1) : 1;
    let slug = query.viSlug;
    let detailData: any = null;
    let detailFetched = false;

    // 1. Try direct slug fetch first if it exists and is not tmdb-
    if (slug && !slug.startsWith('tmdb-')) {
      let detailUrl = '';
      if (providerId === 'ophim') {
        detailUrl = `https://ophim1.com/phim/${slug}`;
      } else {
        detailUrl = `https://phimapi.com/phim/${slug}`;
      }
      try {
        const res = await fetchWithTimeout(detailUrl, 6000);
        if (res.ok) {
          detailData = await res.json();
          if (detailData && (detailData.status === true || detailData.status === 'success' || detailData.movie || detailData.film || detailData.data)) {
            detailFetched = true;
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

      const baseTitle = query.titleVi || query.title;
      if (baseTitle) {
        if (isTv && query.season && query.season > 1) {
          searchKeywords.push(`${baseTitle} Phần ${query.season}`);
          searchKeywords.push(`${baseTitle} Season ${query.season}`);
        } else {
          searchKeywords.push(baseTitle);
        }
      }

      let matchedSlug: string | null = null;
      
      for (const kw of searchKeywords) {
        const encodedKw = encodeURIComponent(kw);
        let searchUrl = '';
        if (providerId === 'ophim') {
          searchUrl = `https://ophim1.com/v1/api/tim-kiem?keyword=${encodedKw}&limit=10`;
        } else {
          searchUrl = `https://phimapi.com/v1/api/tim-kiem?keyword=${encodedKw}&limit=10`;
        }

        try {
          const res = await fetchWithTimeout(searchUrl, 5000);
          if (res.ok) {
            const data = await res.json();
            const items = data?.data?.items || data?.items || [];
            matchedSlug = getBestSlugMatch(items, query.title, query.titleVi || '', undefined, query.viSlug);
            if (matchedSlug) {
              console.log(`[${providerLabel}] Found fallback slug "${matchedSlug}" via keyword search "${kw}"`);
              break;
            }
          }
        } catch (e) {
          console.warn(`[${providerLabel}] Search failed for keyword: ${kw}`, e);
        }
      }

      if (matchedSlug) {
        slug = matchedSlug;
        let detailUrl = '';
        if (providerId === 'ophim') {
          detailUrl = `https://ophim1.com/phim/${slug}`;
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
    serversList = detailData?.episodes || [];

    if (!serversList || serversList.length === 0) return [];

    const streams: StreamItem[] = [];

    // 4. Iterate over servers and find matching episode
    serversList.forEach((server: any) => {
      let serverData = server.server_data || [];

      // Find episode
      let activeEp = serverData[0]; // fallback
      if (isTv) {
        const found = serverData.find((ep: any) => matchEpisode(ep.name, targetEpisode));
        if (found) activeEp = found;
        else return; // skip if episode not found on this server
      }

      const serverName = server.server_name || 'Server';
      let subType = 'Vietsub';
      const normServerName = serverName.toLowerCase();
      if (normServerName.includes('thuyết minh') || normServerName.includes('thuyet minh')) {
        subType = 'Thuyết minh';
      } else if (normServerName.includes('lồng tiếng') || normServerName.includes('long tieng')) {
        subType = 'Lồng tiếng';
      }

      const labelPrefix = `${providerLabel} · ${serverName}`;

      // Add HLS stream if available
      if (activeEp.link_m3u8 && String(activeEp.link_m3u8).startsWith('http')) {
        const rawUrl = activeEp.link_m3u8;
        let referer = '';
        if (providerId === 'ophim') referer = 'https://ophim1.com/';
        else if (providerId === 'kkphim') referer = 'https://phimapi.com/';

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

export const VI_PROVIDERS: StreamProvider[] = [
  ophimProvider,
  kkphimProvider,
];
