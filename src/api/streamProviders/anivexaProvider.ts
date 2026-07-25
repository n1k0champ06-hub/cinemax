import type { StreamItem, StreamProvider, StreamQuery } from './types';
import { computeScore } from './types';
import { buildProxiedM3u8Url } from '../m3u8ProxyApi';

const WORKER_BASE = '/api/anivexa';

async function fetchAnibdWatch(
  anilistId: string | number,
  epNum: number,
  audio: 'sub' | 'dub' = 'sub'
): Promise<{ url: string; type: 'hls' | 'embed'; server: string; referer: string }[]> {
  const res = await fetch(
    `${WORKER_BASE}/anibd/watch/${anilistId}/${audio}/${epNum}`,
    { signal: AbortSignal.timeout(20000) }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data?.streams) ? data.streams : [];
}

function normalizeEpisode(nameStr: string | number | undefined | null): number | null {
  if (nameStr == null) return null;
  const s = String(nameStr).toLowerCase().trim();
  if (s === 'full' || s.includes('movie') || s.includes('ova')) return 1;
  const num = parseFloat(s.replace(/[^\d.]/g, ''));
  return isNaN(num) ? null : Math.floor(num);
}

// AniBD sub-provider
const anibdProvider: StreamProvider = {
  id: 'anibd',
  label: 'AniBD',
  lang: 'en',
  group: 'intl',

  async fetchStreams(query: StreamQuery): Promise<StreamItem[]> {
    if (!query.anilistId || !query.isAnime) return [];

    const epNum = normalizeEpisode(query.episode) ?? 1;
    const anilistId = String(query.anilistId);

    // Try sub first, fallback to dub if empty
    let rawStreams = await fetchAnibdWatch(anilistId, epNum, 'sub');
    if (rawStreams.length === 0) {
      rawStreams = await fetchAnibdWatch(anilistId, epNum, 'dub');
    }
    if (rawStreams.length === 0) return [];

    const items: StreamItem[] = [];
    for (const s of rawStreams) {
      if (!s?.url) continue;

      const isHls = s.type === 'hls';
      const quality = 'HD';

      // HLS streams need CORS proxy because HLS server validates Referer
      const streamUrl = isHls
        ? buildProxiedM3u8Url(s.url, s.referer || null)
        : s.url;

      const partial: Omit<StreamItem, 'score'> = {
        id: `anibd:${anilistId}:ep${epNum}:${s.server}`,
        provider: 'anibd',
        providerLabel: `AniBD · ${s.server}`,
        type: isHls ? 'hls' : 'embed',
        url: streamUrl,
        quality,
        lang: 'en',
        label: `AniBD · ${s.server} · ${quality}`,
        category: 'standard',
        headers: isHls && s.referer ? { Referer: s.referer } : undefined,
      };
      items.push({ ...partial, score: computeScore(partial) });
    }
    return items;
  },
};

export const anivexaProvider: StreamProvider = {
  id: 'anivexa',
  label: 'Anivexa',
  lang: 'en',
  group: 'intl',

  async fetchStreams(query: StreamQuery): Promise<StreamItem[]> {
    if (!query.anilistId || !query.isAnime) return [];
    return anibdProvider.fetchStreams(query);
  },
};
