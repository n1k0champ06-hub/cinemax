/**
 * cineproProvider.ts — CinePro Core HLS stream provider
 *
 * Calls the local CinePro proxy API to retrieve direct video streams.
 * Wraps M3U8 links using our local m3u8-proxy to bypass CORS/403 issues.
 */

import type { StreamItem, StreamProvider, StreamQuery } from './types';
import { computeScore } from './types';
import { fetchCineproStreams, type CineproSource } from '../cineproApi';

export const cineproProvider: StreamProvider = {
  id: 'cinepro',
  label: 'CinePro HLS',
  lang: 'en',
  group: 'hls',
  async fetchStreams(query: StreamQuery): Promise<StreamItem[]> {
    // Temporarily disabled per user request
    return [];
  },
};
