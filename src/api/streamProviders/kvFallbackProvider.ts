/**
 * kvFallbackProvider.ts — KV Cache Fallback stream provider
 *
 * Fetches pre-cached Vietnamese streams from Cloudflare KV via /api/kv-fallback.
 * Only provides HLS streams (m3u8 links) proxied through our m3u8-proxy.
 * Has lowest priority — only wins when all other providers fail.
 */

import type { StreamItem, StreamProvider, StreamQuery } from './types';
import { computeScore } from './types';
import { buildProxiedM3u8Url } from '../cineproApi';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_BASE = typeof window !== 'undefined' ? '' : 'http://localhost:3001';

const fetchWithTimeout = async (url: string, timeout = 8000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const kvFallbackProvider: StreamProvider = {
  id: 'kv_fallback',
  label: 'KV Cache',
  lang: 'vi',
  group: 'vi',
  async fetchStreams(query: StreamQuery): Promise<StreamItem[]> {
    try {
      // KV fallback requires a viSlug
      const slug = query.viSlug;
      if (!slug || slug.startsWith('tmdb-')) return [];

      const isTv = query.type === 'tv';
      const episode = isTv ? String(query.episode || 1) : '1';

      const params = new URLSearchParams({ slug });
      params.set('episode', episode);

      const url = `${API_BASE}/api/kv-fallback?${params.toString()}`;
      const res = await fetchWithTimeout(url, 6000);

      if (!res.ok) return [];

      const data = await res.json();

      if (!data.streams || data.streams.length === 0) return [];

      const streams: StreamItem[] = [];

      data.streams.forEach((stream: any, idx: number) => {
        if (!stream.m3u8 || !String(stream.m3u8).startsWith('http')) return;
        // Only alive streams
        if (stream.alive === false) return;

        const rawUrl = stream.m3u8;
        const referer = stream.referer || '';
        const proxiedUrl = buildProxiedM3u8Url(rawUrl, referer);
        const quality = stream.quality || 'auto';
        const source = stream.source || 'cache';

        const staleTag = data.stale ? ' · Stale' : '';

        const item: Omit<StreamItem, 'score'> = {
          id: `kv_fallback:hls:${source}:${idx}`,
          provider: 'kv_fallback',
          providerLabel: `KV Cache - ${source}${staleTag}`,
          type: 'hls',
          url: proxiedUrl,
          quality,
          lang: 'vi',
          label: `KV Cache · ${source} · ${quality}${staleTag}`,
          episodeName: episode,
          category: 'vi',
        };

        // Apply a score penalty so KV fallback always loses to live providers.
        // computeScore will give ~85 for HLS_VIETSUB, we subtract 30 to push it
        // well below live OPhim/KKPhim (85) and even below embeds (50-60).
        const baseScore = computeScore(item);
        const penalizedScore = Math.max(baseScore - 30, 5);
        streams.push({ ...item, score: penalizedScore });
      });

      return streams;
    } catch (err) {
      console.error('[kvFallbackProvider] Failed to fetch streams:', err);
      return [];
    }
  },
};
