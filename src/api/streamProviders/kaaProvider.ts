import type { StreamItem, StreamProvider, StreamQuery } from './types';
import { computeScore } from './types';
import { buildProxiedM3u8Url } from '../m3u8ProxyApi';

// Fetch romaji + english titles from AniMapper for kaa.lt search
async function getKaaTitles(anilistId: string | number): Promise<string[]> {
  try {
    const res = await fetch(`https://api.animapper.net/api/v1/metadata?id=${anilistId}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const t = data?.result?.titles;
    if (!t) return [];
    // kaa.lt needs romaji/english, skip CJK
    return [
      t['en'],
      t['user-preferred'],
      t['ja-ro'],
      t['alt-anilist-0'],
      t['alt-anilist-1'],
    ].filter((s): s is string => !!s && !/[\u3000-\u9fff\u4e00-\u9faf]/.test(s));
  } catch {
    return [];
  }
}

export const kaaProvider: StreamProvider = {
  id: 'kaa',
  label: 'KickAssAnime',
  lang: 'en',
  group: 'intl',

  async fetchStreams(query: StreamQuery): Promise<StreamItem[]> {
    if (!query.isAnime) return [];
    if (!query.anilistId) return [];

    const epNum = (() => {
      const s = String(query.episode ?? '1').trim();
      const n = parseFloat(s.replace(/[^\d.]/g, ''));
      return isNaN(n) ? 1 : Math.max(1, Math.floor(n));
    })();

    // Collect candidate titles (romaji/english only — kaa.lt doesn't support CJK search)
    const titles: string[] = [];
    if (query.title && !/[\u3000-\u9fff\u4e00-\u9faf]/.test(query.title)) {
      titles.push(query.title);
    }
    const extra = await getKaaTitles(query.anilistId);
    titles.push(...extra);

    const uniqueTitles = Array.from(new Set(titles)).filter(Boolean);
    if (!uniqueTitles.length) return [];

    try {
      const params = new URLSearchParams({
        titles: uniqueTitles.slice(0, 5).join('|'),
        mediaType: query.type === 'movie' ? 'movie' : 'tv',
      });
      if (query.year) params.set('year', String(query.year));
      const res = await fetch(
        `/api/kaa/watch/${query.anilistId}/sub/${epNum}?${params}`,
        { signal: AbortSignal.timeout(20000) }
      );
      if (!res.ok) return [];
      const data = await res.json();
      const streams: any[] = Array.isArray(data?.streams) ? data.streams : [];
      if (!streams.length) return [];

      return streams.map((s) => {
        const proxiedUrl = buildProxiedM3u8Url(s.url, s.referer || 'https://krussdomi.com/');
        const partial: Omit<StreamItem, 'score'> = {
          id: `kaa:${query.anilistId}:ep${epNum}:${s.server}`,
          provider: 'kaa',
          providerLabel: `KAA · ${s.server}`,
          type: 'hls',
          url: proxiedUrl,
          quality: 'HD',
          lang: 'en',
          label: `KAA · ${s.server} · HD`,
          category: 'premium',
          episodeName: String(epNum),
        };
        return { ...partial, score: computeScore(partial) };
      });
    } catch {
      return [];
    }
  },
};
