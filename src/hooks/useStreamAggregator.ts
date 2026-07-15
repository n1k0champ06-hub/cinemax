/**
 * useStreamAggregator.ts — React hook wrapping the stream aggregator engine.
 *
 * Usage:
 *   const { streams, providers, isLoading, autoSelected } = useStreamAggregator({
 *     query: { tmdbId, imdbId, title, type, season, episode },
 *     servers,       // from useMovieDetail — for VI providers
 *     activeEpName,  // current episode name
 *   });
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { aggregateStreams } from '../api/streamAggregator';
import type { AggregatorState, StreamQuery, StreamItem } from '../api/streamAggregator';
import { VI_PROVIDERS } from '../api/streamProviders/viProviders';
import { animapperProvider } from '../api/streamProviders/animapperProvider';
import { cineproProvider } from '../api/streamProviders/cineproProvider';
import { EMBED_PROVIDERS } from '../api/streamProviders/embedProviders';
import { allmangaProvider } from '../api/streamProviders/allmangaProvider';
import { hianimeProvider } from '../api/streamProviders/hianimeProvider';
import type { StreamProvider } from '../api/streamProviders/types';
import { computeScore } from '../api/streamProviders/types';
import { buildProxiedM3u8Url } from '../api/cineproApi';

// CinemaOS VIP Embed Provider (Backup Embed Source)
const cinemaosProvider: StreamProvider = {
  id: 'cinemaos',
  label: 'CinemaOS (VIP Embed)',
  lang: 'en',
  group: 'intl',
  async fetchStreams(query: StreamQuery): Promise<StreamItem[]> {
    if (!query.tmdbId) return [];

    const url = (query.type === 'movie')
      ? `https://cinemaos.tech/player/${query.tmdbId}?theme=ffffff`
      : `https://cinemaos.tech/player/${query.tmdbId}/${query.season ?? 1}/${query.episode ?? 1}?theme=ffffff`;

    const partial: Omit<StreamItem, 'score'> = {
      id: `cinemaos:${url}`,
      provider: 'cinemaos',
      providerLabel: 'CinemaOS (VIP Embed)',
      type: 'embed',
      url,
      quality: '1080p',
      lang: 'en',
      label: 'CinemaOS · 1080p',
      category: 'premium',
    };

    return [{ ...partial, score: computeScore(partial) }];
  }
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseStreamAggregatorOptions {
  query: StreamQuery;
  /** servers array from useMovieDetail */
  servers: any[];
  /** Name of active episode (e.g. "1", "Full") */
  activeEpName?: string;
  /** Whether to run — pass false to defer until ready */
  enabled?: boolean;
}

export interface UseStreamAggregatorResult extends AggregatorState {
  /** Manually set the selected stream (overrides autoSelected) */
  selectStream: (stream: StreamItem) => void;
  /** Currently user-selected stream (null = use autoSelected) */
  selectedStream: StreamItem | null;
  /** The stream that should actually play = selectedStream ?? autoSelected */
  activeStream: StreamItem | null;
  /** Retry — re-run all providers */
  retry: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const STREAM_CACHE = new Map<string, { state: AggregatorState; timestamp: number }>();
const CACHE_MAX_AGE_MS = 15 * 60 * 1000; // Cache stream lists for 15 minutes

export function useStreamAggregator({
  query,
  servers,
  activeEpName = '',
  enabled = true,
}: UseStreamAggregatorOptions): UseStreamAggregatorResult {
  const [state, setState] = useState<AggregatorState>({
    streams: [],
    providers: [],
    isLoading: false,
    autoSelected: null,
  });
  const [selectedStream, setSelectedStream] = useState<StreamItem | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  const activeEpisodeObj = useMemo(() => {
    if (!servers || servers.length === 0 || !activeEpName) return null;
    for (const server of servers) {
      if (server && Array.isArray(server.server_data)) {
        const found = server.server_data.find((ep: any) => ep.name === activeEpName);
        if (found) return { ...found, server_name: server.server_name };
      }
    }
    return null;
  }, [servers, activeEpName]);

  // Stable query key — only re-run when media identity or episode changes
  const queryKey = useMemo(() => JSON.stringify({
    tmdbId: query.tmdbId,
    imdbId: query.imdbId,
    type: query.type,
    season: query.season,
    episode: query.episode,
    viSlug: query.viSlug,
    title: query.title,
    titleVi: query.titleVi,
    year: query.year,
    ep: activeEpName,
    retry: retryCount,
    hianimeEpisodeId: query.hianimeEpisodeId || activeEpisodeObj?.hianime_episode_id
    // NOTE: serversLength đã bỏ — tránh re-fetch toàn bộ khi servers VI load xong
  }), [query.tmdbId, query.imdbId, query.type, query.season, query.episode, query.viSlug, query.title, query.titleVi, query.year, activeEpName, retryCount, query.hianimeEpisodeId, activeEpisodeObj?.hianime_episode_id]);

  const prevRef = useRef<{ queryKey: string; enabled: boolean }>({ queryKey: '', enabled: false });

  useEffect(() => {
    prevRef.current = { queryKey, enabled };

    if (!enabled) return;

    // 1. Check local memory cache
    const cached = STREAM_CACHE.get(queryKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_MAX_AGE_MS)) {
      console.log(
        `%c[STREAM AGGREGATOR] Cache Hit! Serving ${cached.state.streams.length} streams instantly.`,
        'background: #10B981; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
        { title: query.titleVi || query.title, queryKey }
      );
      setState(cached.state);
      return;
    }

    console.log(
      `%c[STREAM AGGREGATOR] Searching stream sources for "${query.titleVi || query.title}"`,
      'background: #3B82F6; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
      { query, activeEp: activeEpName || '1' }
    );

    // Reset selection when query changes
    setSelectedStream(null);

    // Cancel previous run
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Build provider list
    const allProviders: StreamProvider[] = [];

    // 1. Vietnamese providers (OPhim, KKPhim direct API calls)
    allProviders.push(...VI_PROVIDERS);

    // 1.1. AniMapper Provider (Vietnamese Anime streams)
    allProviders.push(animapperProvider);

    // 2. CinePro HLS (provides all international HLS and embeds dynamically)
    allProviders.push(cineproProvider);

    // 3. CinemaOS VIP Embed (Backup embed source)
    allProviders.push(cinemaosProvider);

    // 3.5. AllManga Anime Provider (only queries for Anime)
    allProviders.push(allmangaProvider);

    // 3.6. HiAnime Provider (queries Cloudflare Worker MegaCloud Decryptor)
    allProviders.push(hianimeProvider);

    // 4. International Embed providers (VidSrc, VidSrc Embed, etc.)
    allProviders.push(...EMBED_PROVIDERS);

    // Set initial loading state
    setState({
      streams: [],
      providers: allProviders.map(p => ({
        id: p.id,
        label: p.label,
        status: 'loading',
        streams: [],
      })),
      isLoading: true,
      autoSelected: null,
    });

    const queryWithEpId = {
      ...query,
      hianimeEpisodeId: query.hianimeEpisodeId || activeEpisodeObj?.hianime_episode_id
    };

    aggregateStreams(allProviders, queryWithEpId, {
      onUpdate: (newState) => {
        if (controller.signal.aborted) return;
        setState(newState);

        // Cache the latest resolved state
        STREAM_CACHE.set(queryKey, {
          state: newState,
          timestamp: Date.now(),
        });
      },
      signal: controller.signal,
    });

    return () => {
      controller.abort();
    };
  }, [queryKey, enabled, activeEpisodeObj, query]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dynamically inject direct streams from loaded servers
  const finalStreams = useMemo(() => {
    let updatedList = [...state.streams];
    if (servers && servers.length > 0 && activeEpName) {
      // Iterate in reverse order to prepend in the original order of servers
      for (let i = servers.length - 1; i >= 0; i--) {
        const server = servers[i];
        if (server && Array.isArray(server.server_data)) {
          const epObj = server.server_data.find((ep: any) => ep.name === activeEpName);
          if (epObj) {
            const serverLabel = server.server_name || 'Nguồn Việt Nam';

            if (epObj.link_m3u8) {
              const directUrl = epObj.link_m3u8;
              
              let providerId = 'direct';
              let referer = '';
              if (serverLabel.toLowerCase().includes('ophim')) {
                providerId = 'ophim';
                referer = 'https://ophim1.com/';
              } else if (serverLabel.toLowerCase().includes('kkphim')) {
                providerId = 'kkphim';
                referer = 'https://phimapi.com/';
              } else if (serverLabel.toLowerCase().includes('nguonc')) {
                providerId = 'nguonc';
                referer = 'https://phim.nguonc.com/';
              }

              const proxiedUrl = buildProxiedM3u8Url(directUrl, referer);
              const normDirectUrl = directUrl.trim().toLowerCase();
              const normProxiedUrl = proxiedUrl.trim().toLowerCase();

              const exists = updatedList.some(s => {
                const u = s.url.trim().toLowerCase();
                return u === normDirectUrl || u === normProxiedUrl;
              });

              if (!exists) {
                const directStream: StreamItem = {
                  id: `direct:${serverLabel}:${directUrl}`,
                  provider: providerId,
                  providerLabel: serverLabel,
                  type: 'hls',
                  url: proxiedUrl, // Use proxied URL to filter ads and bypass CORS/403
                  quality: 'auto',
                  lang: 'vi',
                  label: `${serverLabel} · auto (Direct)`,
                  score: 98, // fallback, computed below
                  category: 'vi',
                  episodeName: activeEpName,
                  subtitles: epObj.subtitles || []
                };
                directStream.score = computeScore(directStream);
                updatedList = [directStream, ...updatedList];
              }
            }

            // Inject NguonC direct embed stream
            if (serverLabel.toLowerCase().includes('nguonc') && epObj.link_embed) {
              const embedUrl = epObj.link_embed;
              const existsEmbed = updatedList.some(s => s.url === embedUrl);
              if (!existsEmbed) {
                const directEmbedStream: StreamItem = {
                  id: `direct:${serverLabel}:embed:${embedUrl}`,
                  provider: 'nguonc',
                  providerLabel: `${serverLabel} (Embed)`,
                  type: 'embed',
                  url: embedUrl,
                  quality: 'auto',
                  lang: 'vi',
                  label: `${serverLabel} · Embed (Direct)`,
                  score: 95, // fallback, computed below
                  category: 'vi',
                  episodeName: activeEpName,
                  subtitles: []
                };
                directEmbedStream.score = computeScore(directEmbedStream);
                updatedList = [directEmbedStream, ...updatedList];
              }
            }
          }
        }
      }
    }
    return updatedList;
  }, [state.streams, servers, activeEpName]);

  const autoSelected = useMemo(() => {
    return finalStreams.length > 0
      ? (finalStreams.find(s => s.latencyLabel !== 'Offline') ?? finalStreams[0])
      : null;
  }, [finalStreams]);

  const activeStream = selectedStream ?? autoSelected;

  // Log active stream selection only when it changes
  useEffect(() => {
    if (activeStream) {
      console.log(
        `%c[STREAM PLAYBACK] Active Stream: "${activeStream.providerLabel}" (%c${activeStream.type}%c)`,
        'color: #10B981; font-weight: bold;',
        'color: #FBBF24; font-weight: bold;',
        'color: #10B981; font-weight: bold;',
        {
          label: activeStream.label,
          url: activeStream.url,
          quality: activeStream.quality,
          timestamp: new Date().toISOString()
        }
      );
    }
  }, [activeStream?.id]);

  // Log complete aggregation results summary when loading completes
  useEffect(() => {
    if (!state.isLoading && finalStreams.length > 0) {
      console.log(
        `%c[STREAM AGGREGATOR] Completed! Resolved ${finalStreams.length} streams.`,
        'background: #10B981; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
        {
          title: query.titleVi || query.title,
          streamsFound: finalStreams.map(s => ({
            label: s.label,
            provider: s.provider,
            type: s.type,
            score: s.score
          })),
          autoSelected: autoSelected?.providerLabel || 'none',
          timestamp: new Date().toISOString()
        }
      );
    }
  }, [state.isLoading, finalStreams.length, autoSelected?.providerLabel]);

  return {
    ...state,
    streams: finalStreams,
    autoSelected,
    selectedStream,
    selectStream: setSelectedStream,
    activeStream,
    retry: () => setRetryCount(c => c + 1),
  };
}
