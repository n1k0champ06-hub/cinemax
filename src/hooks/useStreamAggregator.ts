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
import { cineproProvider } from '../api/streamProviders/cineproProvider';
import type { StreamProvider } from '../api/streamProviders/types';
import { computeScore } from '../api/streamProviders/types';

// CinemaOS VIP Embed Provider (Backup Embed Source)
const cinemaosProvider: StreamProvider = {
  id: 'cinemaos',
  label: 'CinemaOS (VIP Embed)',
  lang: 'en',
  group: 'intl',
  async fetchStreams(query: StreamQuery): Promise<StreamItem[]> {
    if (!query.tmdbId) return [];

    const url = (query.type === 'movie')
      ? `https://cinemaos.tech/player/${query.tmdbId}?theme=ffffff&autoPlay=true`
      : `https://cinemaos.tech/player/${query.tmdbId}/${query.season ?? 1}/${query.episode ?? 1}?theme=ffffff&autoPlay=true`;

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

  // Stable query key — only re-run when media identity or episode changes
  const queryKey = useMemo(() => JSON.stringify({
    tmdbId: query.tmdbId,
    imdbId: query.imdbId,
    type: query.type,
    season: query.season,
    episode: query.episode,
    viSlug: query.viSlug,
    ep: activeEpName,
    retry: retryCount,
  }), [query.tmdbId, query.imdbId, query.type, query.season, query.episode, query.viSlug, activeEpName, retryCount]);

  useEffect(() => {
    if (!enabled) {
      console.log("[useStreamAggregator] Aggregator disabled (waiting for activeEp or play state)");
      return;
    }

    console.log("[useStreamAggregator] Running aggregation with query:", query);

    // Reset selection when query changes
    setSelectedStream(null);

    // Cancel previous run
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Build provider list
    const allProviders: StreamProvider[] = [];

    // 1. Vietnamese providers (OPhim, KKPhim, NguonC direct API calls)
    allProviders.push(...VI_PROVIDERS);

    // 2. CinePro HLS (provides all international HLS and embeds dynamically)
    allProviders.push(cineproProvider);

    // 3. CinemaOS VIP Embed (Backup embed source)
    allProviders.push(cinemaosProvider);

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

    aggregateStreams(allProviders, query, {
      onUpdate: (newState) => {
        if (controller.signal.aborted) return;
        console.log("[useStreamAggregator] Updated state. Total streams:", newState.streams.length);
        setState(newState);
      },
      signal: controller.signal,
    });

    return () => {
      controller.abort();
    };
  }, [queryKey, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeStream = selectedStream ?? state.autoSelected;
  console.log("[useStreamAggregator] activeStream evaluated:", activeStream?.providerLabel, activeStream?.type, activeStream?.url);

  return {
    ...state,
    selectedStream,
    selectStream: setSelectedStream,
    activeStream,
    retry: () => setRetryCount(c => c + 1),
  };
}
