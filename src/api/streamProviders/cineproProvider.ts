/**
 * cineproProvider.ts — CinePro Core HLS stream provider
 *
 * Calls the local CinePro proxy API to retrieve direct video streams.
 * Wraps M3U8 links using our local m3u8-proxy to bypass CORS/403 issues.
 */

import type { StreamItem, StreamProvider, StreamQuery } from './types';
import { computeScore } from './types';
import { fetchCineproStreams, type CineproSource, buildProxiedM3u8Url } from '../cineproApi';

export const cineproProvider: StreamProvider = {
  id: 'cinepro',
  label: 'CinePro HLS',
  lang: 'en',
  group: 'hls',
  async fetchStreams(query: StreamQuery): Promise<StreamItem[]> {
    try {
      // CinePro requires a TMDB ID
      if (!query.tmdbId) return [];

      // Check if CinePro is configured
      const cineproConfigured = !!(
        (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CINEPRO_URL) ||
        true // Always try — the proxy will handle it
      );
      if (!cineproConfigured) return [];

      const result = await fetchCineproStreams(
        query.tmdbId,
        query.type,
        query.season,
        query.episode
      );

      if (!result || !result.sources || result.sources.length === 0) {
        return [];
      }

      const seenUrls = new Set<string>();
      const providerCounts: Record<string, number> = {};
      const items: StreamItem[] = [];

      result.sources.forEach((source: CineproSource, idx: number) => {
        const streamUrl = source.url;
        if (!streamUrl) return;

        // Normalize URL to deduplicate
        const normalizedUrl = streamUrl.trim().toLowerCase();
        if (seenUrls.has(normalizedUrl)) return;
        seenUrls.add(normalizedUrl);

        const isHls = source.isHLS || streamUrl.includes('.m3u8');
        const referer = source.headers?.['Referer'] || source.headers?.['referer'] || '';

        // Capitalize provider name nicely
        const rawProvider = source.provider || 'CinePro';
        const displayProvider = rawProvider.charAt(0).toUpperCase() + rawProvider.slice(1);
        
        providerCounts[displayProvider] = (providerCounts[displayProvider] || 0) + 1;
        const currentCount = providerCounts[displayProvider];
        const qualityLabel = source.quality === 'auto' ? 'auto' : (source.quality || 'auto');

        const item: Omit<StreamItem, 'score'> = {
          id: `cinepro:${source.provider}:${qualityLabel}:${idx}`,
          provider: 'cinepro',
          providerLabel: `${displayProvider} #${currentCount}`,
          type: isHls ? 'hls' : 'embed',
          url: isHls ? buildProxiedM3u8Url(streamUrl, referer) : streamUrl,
          quality: qualityLabel,
          lang: 'en',
          label: `${displayProvider} · ${qualityLabel}`,
          headers: referer ? { 'Referer': referer } : undefined,
          episodeName: query.type === 'tv' ? String(query.episode || '1') : 'Full',
          category: isHls ? 'premium' : 'standard',
          subtitles: source.subtitles,
        };

        items.push({
          ...item,
          score: computeScore(item),
        });
      });

      return items;
    } catch (err) {
      console.error('[cineproProvider] Failed to fetch streams:', err);
      return [];
    }
  },
};
