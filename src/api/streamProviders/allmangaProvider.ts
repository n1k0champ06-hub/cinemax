import type { StreamItem, StreamProvider, StreamQuery } from './types';
import { computeScore } from './types';

export const allmangaProvider: StreamProvider = {
  id: 'allmanga',
  label: 'AllManga Anime',
  lang: 'en',
  group: 'intl',
  async fetchStreams(query: StreamQuery): Promise<StreamItem[]> {
    try {
      // Only query AllManga if the media is identified as an Anime to avoid generic movie name pollution
      if (!query.isAnime) return [];

      const params = new URLSearchParams({
        title: query.title,
        season: String(query.season ?? 1),
        episode: String(query.episode ?? 1),
        isMovie: String(query.type === 'movie'),
        translationType: 'sub', // Default to Vietsub/Subbed
      });

      const url = `/api/allmanga-proxy?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`[allmangaProvider] API returned status ${res.status}`);
        return [];
      }

      const data = await res.json();
      if (!data.ok || !data.streams || data.streams.length === 0) {
        return [];
      }

      const items: StreamItem[] = data.streams.map((stream: any, idx: number) => {
        const qualityLabel = stream.quality === 'auto' ? 'auto' : (stream.quality || 'auto');
        const displayLabel = `AllManga · ${stream.sourceName} · ${qualityLabel}`;
        
        const partial: Omit<StreamItem, 'score'> = {
          id: `allmanga:${stream.sourceName}:${idx}`,
          provider: 'allmanga',
          providerLabel: `AllManga (${stream.sourceName})`,
          type: stream.isHLS ? 'hls' : 'embed',
          url: stream.url,
          quality: qualityLabel,
          lang: 'en', // Mapped as standard subbed source
          label: displayLabel,
          category: stream.isHLS ? 'premium' : 'standard',
          headers: stream.headers,
          episodeName: query.type === 'tv' ? String(query.episode || '1') : 'Full',
        };

        return {
          ...partial,
          score: computeScore(partial),
        };
      });

      return items;
    } catch (err) {
      console.error('[allmangaProvider] Failed to fetch streams:', err);
      return [];
    }
  },
};
