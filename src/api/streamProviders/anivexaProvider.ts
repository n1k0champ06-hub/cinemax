import type { StreamItem, StreamProvider, StreamQuery } from './types';
import { computeScore } from './types';
import { buildProxiedM3u8Url } from '../m3u8ProxyApi';

const WORKER_BASE = '/api/anivexa';

function normalizeEpisode(nameStr: string | number | undefined | null): number | null {
  if (nameStr == null) return null;
  const s = String(nameStr).toLowerCase().trim();
  if (s === 'full' || s.includes('movie') || s.includes('ova')) return 1;
  const num = parseFloat(s.replace(/[^\d.]/g, ''));
  return isNaN(num) ? null : Math.floor(num);
}

function makeHlsItem(
  stream: { url: string; type: string; server: string; referer?: string; subtitles?: any[] },
  providerId: string,
  providerLabel: string,
  idKey: string,
): StreamItem {
  const isHls = stream.type === 'hls';
  const proxiedUrl = isHls
    ? buildProxiedM3u8Url(stream.url, stream.referer || null)
    : stream.url;

  const partial: Omit<StreamItem, 'score'> = {
    id: `${providerId}:${idKey}`,
    provider: providerId,
    providerLabel,
    type: isHls ? 'hls' : 'embed',
    url: proxiedUrl,
    quality: 'HD',
    lang: 'en',
    label: `${providerLabel} · HD`,
    category: isHls ? 'premium' : 'standard',
    headers: isHls && stream.referer ? { Referer: stream.referer } : undefined,
    subtitles: stream.subtitles?.map((s: any) => ({ lang: s.srclang || 'en', url: s.url, label: s.label })),
  };
  return { ...partial, score: computeScore(partial) };
}

// Fetch titles from AniMapper metadata API if anilistId is available
async function getAnilistTitles(anilistId: string | number): Promise<string[]> {
  try {
    const res = await fetch(`https://api.animapper.net/api/v1/metadata?id=${anilistId}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      const t = data?.result?.titles;
      if (t) {
        const list = [
          t['user-preferred'],
          t['ja-ro'],
          t['alt-anilist-2'],
          t['alt-anilist-0'],
          t['alt-anilist-1'],
        ].filter(Boolean);
        return Array.from(new Set(list));
      }
    }
  } catch { /* ignore */ }
  return [];
}

// --- AniBD (AniList ID direct) ---
async function fetchAnibd(anilistId: string, epNum: number): Promise<StreamItem[]> {
  try {
    for (const audio of ['sub', 'dub'] as const) {
      const res = await fetch(
        `${WORKER_BASE}/anibd/watch/${anilistId}/${audio}/${epNum}`,
        { signal: AbortSignal.timeout(20000) }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const streams: any[] = Array.isArray(data?.streams) ? data.streams : [];
      if (streams.length === 0) continue;
      return streams.filter(s => s?.url).map(s =>
        makeHlsItem(s, 'anibd', `AniBD · ${s.server}`, `${anilistId}:ep${epNum}:${s.server}`)
      );
    }
  } catch { /* network/timeout */ }
  return [];
}

// --- AniZone (title search → HTML scrape → HLS) ---
async function fetchAnizoneForSingleTitle(title: string, epNum: number): Promise<StreamItem[]> {
  if (!title) return [];
  try {
    const params = new URLSearchParams({ title });
    const res = await fetch(
      `${WORKER_BASE}/anizone/watch/${epNum}?${params}`,
      { signal: AbortSignal.timeout(20000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const streams: any[] = Array.isArray(data?.streams) ? data.streams : [];
    return streams.filter(s => s?.url).map(s =>
      makeHlsItem(s, 'anizone', 'AniZone', `${title}:ep${epNum}`)
    );
  } catch { /* network/timeout */ }
  return [];
}

async function fetchAnizone(titles: string[], epNum: number): Promise<StreamItem[]> {
  for (const t of titles) {
    if (!t) continue;
    const items = await fetchAnizoneForSingleTitle(t, epNum);
    if (items.length > 0) return items;
  }
  return [];
}

export const anivexaProvider: StreamProvider = {
  id: 'anivexa',
  label: 'Anivexa',
  lang: 'en',
  group: 'intl',

  async fetchStreams(query: StreamQuery): Promise<StreamItem[]> {
    console.log('%c[ANIVEXA] fetchStreams called', 'background:#7c3aed;color:white;font-weight:bold;padding:2px 5px;border-radius:3px;', {
      anilistId: query.anilistId,
      isAnime: query.isAnime,
      title: query.title,
      episode: query.episode,
    });
    if (!query.isAnime && !query.anilistId) return [];

    const epNum = normalizeEpisode(query.episode) ?? 1;

    // Collect candidate titles for searching
    const titlesToTry: string[] = [];
    if (query.title) titlesToTry.push(query.title);

    if (query.anilistId) {
      const extraTitles = await getAnilistTitles(query.anilistId);
      titlesToTry.push(...extraTitles);
    }

    const uniqueTitles = Array.from(new Set(titlesToTry)).filter(Boolean);

    // Run AniBD (needs anilistId) and AniZone (tries candidate titles) in parallel
    const [anibdItems, anizoneItems] = await Promise.all([
      query.anilistId ? fetchAnibd(String(query.anilistId), epNum) : Promise.resolve([]),
      fetchAnizone(uniqueTitles, epNum),
    ]);

    const all = [...anibdItems, ...anizoneItems];
    if (all.length === 0) {
      console.warn('[ANIVEXA] No streams found from AniBD or AniZone', { anilistId: query.anilistId, titlesToTry: uniqueTitles, epNum });
    }
    return all;
  },
};
