/**
 * resolverProvider.ts — On-Demand VidSrc HLS Resolver Provider
 *
 * Gọi backend /api/resolver/stream, tự động poll lại nếu đang giải mã.
 * Khi thành công → trả về link .m3u8 sạch 100% không quảng cáo.
 */

import type { StreamItem, StreamProvider, StreamQuery } from './types';
import { computeScore } from './types';
import { buildProxiedM3u8Url } from '../cineproApi';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
const POLL_INTERVAL_MS = 4000;  // Poll lại sau 4 giây
const MAX_POLLS        = 10;    // Tối đa 40 giây chờ (10 x 4s)

interface ResolverResponse {
  ok: boolean;
  status: 'ready' | 'processing' | 'error' | 'unavailable';
  streamUrl?: string;
  provider?: string;
  message?: string;
  error?: string;
}

async function fetchResolverStream(
  tmdbId: string | number,
  type: 'movie' | 'tv',
  season?: number | null,
  episode?: number | null
): Promise<ResolverResponse | null> {
  const params = new URLSearchParams({
    tmdbId: String(tmdbId),
    type,
    season: String(season ?? 1),
    episode: String(episode ?? 1),
  });

  try {
    const url = `${BACKEND_URL}/api/resolver/stream?${params}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

    // 202 = đang giải mã (processing), cũng cần parse body
    const data: ResolverResponse = await res.json();
    return data;
  } catch {
    return null;
  }
}

/**
 * Poll cho đến khi nhận được link sạch hoặc timeout.
 * Cập nhật onProgress callback mỗi khi có tin tức mới.
 */
async function pollUntilReady(
  tmdbId: string | number,
  type: 'movie' | 'tv',
  season?: number | null,
  episode?: number | null,
  onProgress?: (msg: string) => void
): Promise<ResolverResponse | null> {
  onProgress?.('🔓 Đang giải mã link phim sạch...');

  for (let i = 0; i < MAX_POLLS; i++) {
    const data = await fetchResolverStream(tmdbId, type, season, episode);

    if (!data) {
      onProgress?.('⚠️ Lỗi kết nối đến server giải mã.');
      return null;
    }

    if (data.status === 'unavailable') {
      return null; // Tính năng chưa được cấu hình
    }

    if (data.status === 'ready' && data.streamUrl) {
      onProgress?.('✅ Giải mã thành công!');
      return data;
    }

    if (data.status === 'error') {
      onProgress?.(`❌ Giải mã thất bại: ${data.error || 'Unknown error'}`);
      return null;
    }

    // status === 'processing' — đợi và thử lại
    const secondsLeft = ((MAX_POLLS - i - 1) * POLL_INTERVAL_MS) / 1000;
    onProgress?.(`⏳ Đang bẻ khóa link phim... (còn tối đa ${secondsLeft.toFixed(0)}s)`);
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }

  onProgress?.('⏰ Hết thời gian chờ giải mã.');
  return null;
}

// ---------------------------------------------------------------------------
// Provider export
// ---------------------------------------------------------------------------

export const resolverProvider: StreamProvider = {
  id: 'vidsrc-resolver',
  label: 'VidSrc Resolver (Clean HLS)',
  lang: 'en',
  group: 'hls',

  async fetchStreams(query: StreamQuery): Promise<StreamItem[]> {
    if (!query.tmdbId) return [];

    const data = await pollUntilReady(
      query.tmdbId,
      query.type,
      query.season,
      query.episode
    );

    if (!data?.streamUrl) return [];

    // Bọc link m3u8 qua proxy Cloudflare Worker để bypass CORS
    const proxiedUrl = buildProxiedM3u8Url(data.streamUrl, 'https://vidsrc.to/');

    const partial: Omit<StreamItem, 'score'> = {
      id: `vidsrc-resolver:${data.streamUrl}`,
      provider: 'vidsrc-resolver',
      providerLabel: `VidSrc Clean · ${data.provider || 'Auto'} · HLS`,
      type: 'hls',
      url: proxiedUrl,
      quality: '1080p',
      lang: 'en',
      label: `🔓 VidSrc Sạch · ${data.provider || 'Auto'} · 1080p`,
      category: 'premium',
    };

    return [{ ...partial, score: computeScore(partial) + 50 }]; // +50 điểm ưu tiên cao nhất
  },
};
