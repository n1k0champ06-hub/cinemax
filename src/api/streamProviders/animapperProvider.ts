import type { StreamItem, StreamProvider, StreamQuery } from './types';
import { computeScore } from './types';
import { buildProxiedM3u8Url } from '../cineproApi';
import { godModeStore } from '../../lib/godmode';

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
  const s = nameStr.toString().toLowerCase().trim();
  if (s === 'full' || s.includes('full') || s === 'movie' || s.includes('movie') || s.includes('ova')) return 1;
  const cleaned = s.replace(/[^\d.]/g, '');
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
      return [];
    }

    const epData = await epRes.json();
    const episodes = epData.episodes || [];
    if (episodes.length === 0) {
      return [];
    }

    // 2. Find matching episodes
    let matchingEps = episodes.filter((ep: any) => {
      const epNum = getEpisodeNumber(ep.episodeNumber);
      return epNum !== null && epNum === targetEpisode;
    });

    if (matchingEps.length === 0 && episodes.length > 0) {
      if (targetEpisode === 1 || episodes.length === 1) {
        matchingEps = [episodes[0]];
      }
    }

    if (matchingEps.length === 0) {
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
    return [];
  }
}

export const animapperProvider: StreamProvider = {
  id: 'animapper',
  label: 'AniMapper',
  lang: 'vi',
  group: 'vi',
  async fetchStreams(query: StreamQuery): Promise<StreamItem[]> {
    const isAnimeTarget = query.isAnime || !!query.anilistId || query.viSlug?.startsWith('anilist-') || query.viSlug?.includes('hoat-hinh') || query.viSlug?.includes('anime');
    if (!isAnimeTarget) {
      return [];
    }

    const candidateIds: (string | number)[] = [];

    if (query.anilistId) {
      candidateIds.push(query.anilistId);
    }
    if (query.viSlug?.startsWith('anilist-')) {
      const slugId = query.viSlug.split('-')[1];
      if (!candidateIds.includes(slugId)) candidateIds.push(slugId);
    }

    // Also perform search by title to gather candidate IDs
    const isCJK = (str: string) => /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u4e00-\u9faf]/.test(str);
    const searchTitles = [query.title, query.titleVi]
      .filter((t): t is string => Boolean(t) && !isCJK(t as string));

    for (const t of searchTitles) {
      try {
        const searchUrl = `https://api.animapper.net/api/v1/search?title=${encodeURIComponent(t)}&mediaType=ANIME&limit=5`;
        const searchRes = await fetchWithTimeout(searchUrl);
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData.success && searchData.results) {
            for (const r of searchData.results) {
              if (r.id && !candidateIds.includes(r.id)) {
                candidateIds.push(r.id);
              }
            }
          }
        }
      } catch (err: any) {
        /* ignore */
      }
    }

    if (candidateIds.length === 0) {
      console.warn('%c[AniMapper] No AniList ID or candidates found.', 'color: #F59E0B; font-weight: bold;');
      godModeStore.addLog('SYSTEM', 'WARN', '[AniMapper] Could not resolve AniList ID for title');
      return [];
    }

    const targetEpisode = query.episode || 1;

    console.log(
      `%c[AniMapper] Checking ${candidateIds.length} candidate ID(s) [${candidateIds.join(', ')}] for Ep ${targetEpisode}...`,
      'background: #EC4899; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;'
    );

    // Try candidate IDs in sequence with Metadata discovery
    for (const id of candidateIds) {
      try {
        // Step 1: Check Metadata API first to find active streamingProviders
        const metaUrl = `https://api.animapper.net/api/v1/metadata?id=${id}`;
        const metaRes = await fetchWithTimeout(metaUrl, {}, 4000);
        if (!metaRes.ok) continue;

        const metaData = await metaRes.json();
        const activeProviders = Object.keys(metaData.result?.streamingProviders || {}) as ('ANIMEVIETSUB' | 'NINIYO')[];
        
        if (activeProviders.length === 0) {
          // No mapped providers for this media ID, skip to avoid 404 errors
          continue;
        }

        // Step 2: Fetch streams only for active providers returned by metadata
        const providerPromises = activeProviders.map(p => fetchProviderStreams(id, p, targetEpisode));
        const streamResults = await Promise.all(providerPromises);
        const allStreams = streamResults.flat();

        if (allStreams.length > 0) {
          console.log(
            `%c[AniMapper] Successfully resolved ${allStreams.length} stream(s) using AniList ID: ${id} via [${activeProviders.join(', ')}] (Score: 998)`,
            'color: #10B981; font-weight: bold;',
            allStreams.map(s => s.label)
          );
          godModeStore.addLog('SYSTEM', 'INFO', `[AniMapper] Found ${allStreams.length} streams for AniList ID ${id} (Ep ${targetEpisode})`);
          return allStreams;
        }
      } catch (err) {
        /* try next candidate */
      }
    }

    console.log(`%c[AniMapper] 0 streams returned across candidate IDs`, 'color: #F59E0B;');
    return [];
  }
};
