import type { StreamItem, StreamProvider, StreamQuery } from './types';
import { computeScore } from './types';

export const hianimeProvider: StreamProvider = {
  id: 'hianime',
  label: 'HiAnime (MegaCloud)',
  lang: 'vi', // prioritize for Vietnamese users by returning HLS with Vietnamese subtitles mapped
  group: 'hls',
  async fetchStreams(query: StreamQuery): Promise<StreamItem[]> {
    try {
      // Only query HiAnime if the media is identified as an Anime
      if (!query.isAnime) return [];

      const params = new URLSearchParams();
      const hasValidHianimeId = query.hianimeEpisodeId && !/^\d+$/.test(query.hianimeEpisodeId);
      
      if (hasValidHianimeId) {
        params.set('id', query.hianimeEpisodeId!);
      } else if (query.title) {
        // Fall back to title search when hianimeEpisodeId is purely numeric (AniMapper index)
        params.set('title', query.title);
      } else {
        // No valid ID or title — skip to avoid sending a useless request
        console.warn('[hianimeProvider] No valid HiAnime episode ID or title in query — skipping.');
        return [];
      }

      if (query.episode) {
        params.set('episode', String(query.episode));
      }
      if (query.season) {
        params.set('season', String(query.season));
      }
      if (query.tmdbId) {
        params.set('tmdb_id', String(query.tmdbId));
      }

      const geminiKey = typeof window !== 'undefined' ? localStorage.getItem('cinemax_gemini_key') || '' : '';
      if (geminiKey) {
        params.set('gemini_key', geminiKey);
      }

      const url = `/api/anime/stream?${params.toString()}`;
      console.log(`[hianimeProvider] Fetching streams from: ${url}`);
      
      const res = await fetch(url);
      if (!res.ok) {
        // 500 with HTML body = Cloudflare bot challenge blocking the backend scraper
        console.warn(`[hianimeProvider] API returned status ${res.status} (likely Cloudflare block on HiAnime AJAX)`);
        return [];
      }

      const data = await res.json();
      if (!data.ok || !data.hls) {
        console.warn(`[hianimeProvider] API did not return a valid HLS stream`);
        return [];
      }

      const qualityLabel = data.quality === 'auto' ? 'auto' : (data.quality || 'auto');
      const displayLabel = `HiAnime · MegaCloud · ${qualityLabel}`;
      
      // Parse subtitles tracks
      const subtitles = (data.tracks || [])
        .filter((t: any) => t.kind === 'captions' || t.kind === 'subtitles')
        .map((t: any) => ({
          lang: t.label || t.lang || 'unknown',
          url: t.file,
          label: t.label || t.lang
        }));

      const partial: Omit<StreamItem, 'score'> = {
        id: `hianime:megacloud:${data.hls}`,
        provider: 'hianime',
        providerLabel: 'HiAnime (MegaCloud)',
        type: 'hls',
        url: data.hls,
        quality: qualityLabel,
        lang: 'vi', // Vietnamese subtitles are included/translated in tracks
        label: displayLabel,
        category: 'vi',
        subtitles,
        episodeName: query.type === 'tv' ? String(query.episode || '1') : 'Full',
        intro: data.intro || null,
        outro: data.outro || null,
      };

      return [{
        ...partial,
        score: computeScore(partial),
      }];
    } catch (err) {
      console.error('[hianimeProvider] Failed to fetch streams:', err);
      return [];
    }
  },
};
