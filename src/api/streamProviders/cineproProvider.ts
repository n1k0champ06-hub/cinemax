/**
 * cineproProvider.ts — CinePro Core HLS stream provider
 *
 * Calls the local CinePro proxy API to retrieve direct video streams.
 * Wraps M3U8 links using our local m3u8-proxy to bypass CORS/403 issues.
 */

import type { StreamItem, StreamProvider, StreamQuery } from './types';
import { computeScore } from './types';
import { fetchCineproStreams, buildProxiedM3u8Url } from '../cineproApi';

export const cineproProvider: StreamProvider = {
  id: 'cinepro',
  label: 'CinePro HLS',
  lang: 'en',
  group: 'hls',
  async fetchStreams(query: StreamQuery): Promise<StreamItem[]> {
    if (!query.tmdbId) return [];

    try {
      const result = await fetchCineproStreams(
        query.tmdbId,
        query.type,
        query.season,
        query.episode
      );

      return result.sources.map(source => {
        // Build proxied m3u8 url to bypass CORS/403
        const streamUrl = source.isHLS
          ? buildProxiedM3u8Url(source.url, source.headers?.Referer || source.headers?.referer)
          : source.url;

        const partial: Omit<StreamItem, 'score'> = {
          id: `cinepro-${source.provider}-${source.quality}`,
          provider: `cinepro-${source.provider}`,
          providerLabel: `CinePro (${source.provider.toUpperCase()})`,
          type: source.isHLS ? 'hls' : 'embed',
          url: streamUrl,
          quality: source.quality,
          lang: 'en',
          label: `${source.provider.toUpperCase()} · ${source.quality}`,
          category: 'premium',
        };

        return {
          ...partial,
          score: computeScore(partial)
        };
      });
    } catch (err) {
      console.error("CinePro provider failed:", err);
      return [];
    }
  },
};
