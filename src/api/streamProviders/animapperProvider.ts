import type { StreamItem, StreamProvider, StreamQuery } from './types';
import { computeScore } from './types';
import { buildProxiedM3u8Url } from '../cineproApi';

// Timeout fetch wrapper helper
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 6000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
};

function getEpisodeNumber(nameStr: string | number | undefined | null): number | null {
  if (nameStr === undefined || nameStr === null) return null;
  // Clean all non-numeric characters except maybe decimal (e.g. 11.5)
  const cleaned = nameStr.toString().replace(/[^\d.]/g, '');
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.floor(num);
}

async function fetchProviderStreams(
  anilistId: string | number,
  provider: 'ANIMEVIETSUB' | 'NINIYO',
  targetEpisode: number
): Promise<StreamItem[]> {
  try {
    // 1. Fetch episode list
    const epUrl = `https://api.animapper.net/api/v1/stream/episodes?id=${anilistId}&provider=${provider}`;
    const epRes = await fetchWithTimeout(epUrl);
    if (!epRes.ok) {
      console.warn(`[AniMapper:${provider}] Failed to fetch episode list for id ${anilistId}: ${epRes.status}`);
      return [];
    }

    const epData = await epRes.json();
    const episodes = epData.episodes || [];
    if (episodes.length === 0) {
      return [];
    }

    // 2. Find matching episodes
    const matchingEps = episodes.filter((ep: any) => {
      const epNum = getEpisodeNumber(ep.episodeNumber);
      return epNum !== null && epNum === targetEpisode;
    });

    if (matchingEps.length === 0) {
      console.log(`[AniMapper:${provider}] No episode matching number ${targetEpisode} found.`);
      return [];
    }

    // 3. For each matching episode, query GET /api/v1/stream/source
    const streams: StreamItem[] = [];
    const sourcePromises = matchingEps.map(async (ep: any) => {
      try {
        const sourceParams = new URLSearchParams({
          episodeData: ep.episodeId,
          provider: provider,
        });
        if (ep.server) {
          sourceParams.set('server', ep.server);
        }

        const sourceUrl = `https://api.animapper.net/api/v1/stream/source?${sourceParams.toString()}`;
        const sourceRes = await fetchWithTimeout(sourceUrl);
        if (!sourceRes.ok) {
          return null;
        }

        const sourceData = await sourceRes.json();
        return { ep, source: sourceData };
      } catch (err) {
        console.warn(`[AniMapper:${provider}] Failed to fetch stream source for ${ep.episodeId}:`, err);
        return null;
      }
    });

    const results = await Promise.all(sourcePromises);

    for (const res of results) {
      if (!res || !res.source || !res.source.url) continue;
      const { ep, source } = res;
      
      const serverName = source.server || ep.server || 'DU';
      const streamType = source.type?.toLowerCase() === 'embed' ? 'embed' : 'hls';
      
      // Get referer and format proxy url if needed
      const rawUrl = source.url;
      const referer = source.proxyHeaders?.Referer || source.proxyHeaders?.referer || (provider === 'ANIMEVIETSUB' ? 'https://animevietsub.page' : '');
      const url = streamType === 'hls' ? buildProxiedM3u8Url(rawUrl, referer) : rawUrl;
      const headers = referer ? { Referer: referer } : undefined;

      const subType = provider === 'ANIMEVIETSUB' ? 'AnimeVietSub' : 'Niniyo';
      const displayLabel = `${subType} · ${serverName} · ${streamType === 'hls' ? 'HLS' : 'Embed'}`;

      const partial: Omit<StreamItem, 'score'> = {
        id: `animapper:${provider.toLowerCase()}:${serverName}:${rawUrl}`,
        provider: 'animapper',
        providerLabel: `${subType} - ${serverName}`,
        type: streamType,
        url,
        quality: rawUrl.toLowerCase().includes('1080') ? '1080p' : 'auto',
        lang: 'vi',
        label: displayLabel,
        category: 'vi',
        headers,
        episodeName: String(targetEpisode)
      };

      streams.push({
        ...partial,
        score: computeScore(partial)
      });
    }

    return streams;
  } catch (err) {
    console.error(`[AniMapper:${provider}] Error during fetching streams:`, err);
    return [];
  }
}

export const animapperProvider: StreamProvider = {
  id: 'animapper',
  label: 'AniMapper',
  lang: 'vi',
  group: 'vi',
  async fetchStreams(query: StreamQuery): Promise<StreamItem[]> {
    if (!query.isAnime) return [];

    let anilistId = query.anilistId;
    if (!anilistId && query.viSlug?.startsWith('anilist-')) {
      anilistId = query.viSlug.split('-')[1];
    }

    if (!anilistId && query.title) {
      try {
        const searchUrl = `https://api.animapper.net/api/v1/search?title=${encodeURIComponent(query.title)}&mediaType=ANIME&limit=5`;
        const searchRes = await fetchWithTimeout(searchUrl);
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData.success && searchData.results && searchData.results.length > 0) {
            anilistId = searchData.results[0].id;
            console.log(`[animapperProvider] Resolved AniList ID ${anilistId} for title "${query.title}" via search`);
          }
        }
      } catch (err: any) {
        console.warn(`[animapperProvider] Failed to search AniMapper for title "${query.title}":`, err.message);
      }
    }

    if (!anilistId && query.titleVi) {
      try {
        const searchUrl = `https://api.animapper.net/api/v1/search?title=${encodeURIComponent(query.titleVi)}&mediaType=ANIME&limit=5`;
        const searchRes = await fetchWithTimeout(searchUrl);
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData.success && searchData.results && searchData.results.length > 0) {
            anilistId = searchData.results[0].id;
            console.log(`[animapperProvider] Resolved AniList ID ${anilistId} for Vietnamese title "${query.titleVi}" via search`);
          }
        }
      } catch (err: any) {
        console.warn(`[animapperProvider] Failed to search AniMapper for titleVi "${query.titleVi}":`, err.message);
      }
    }

    if (!anilistId) {
      console.warn('[animapperProvider] No AniList ID provided in query and could not resolve via search.');
      return [];
    }

    const targetEpisode = query.episode || 1;

    try {
      // Fetch both ANIMEVIETSUB and NINIYO in parallel
      const [animevietsubStreams, niniyoStreams] = await Promise.all([
        fetchProviderStreams(anilistId, 'ANIMEVIETSUB', targetEpisode),
        fetchProviderStreams(anilistId, 'NINIYO', targetEpisode)
      ]);

      return [...animevietsubStreams, ...niniyoStreams];
    } catch (err) {
      console.error('[animapperProvider] Failed fetching AniMapper streams:', err);
      return [];
    }
  }
};
