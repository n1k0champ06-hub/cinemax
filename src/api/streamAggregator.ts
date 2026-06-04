/**
 * streamAggregator.ts — Core Meta-Streaming Aggregator Engine
 *
 * Fires all registered providers in parallel.
 * Results arrive progressively via callbacks as each provider responds.
 * Pings hosts in the background to measure connection latency.
 */

import type { StreamItem, StreamProvider, StreamQuery, AggregatorState, ProviderState } from './streamProviders/types';

export type { StreamItem, StreamQuery, AggregatorState, ProviderState };
export type { StreamProvider } from './streamProviders/types';

// ---------------------------------------------------------------------------
// Background Ping Latency Measurement
// ---------------------------------------------------------------------------

/**
 * Measures the TCP connect + response latency to a given stream's domain.
 * Uses no-cors fetch to avoid security preflights.
 */
async function pingStreamDomain(urlStr: string): Promise<{ latency: number; label: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1500);
  const start = Date.now();
  try {
    const url = new URL(urlStr);
    const origin = url.origin;

    // Fetch the root of the CDN/embed domain with a cache buster parameter
    await fetch(`${origin}/?_ping=${start}`, {
      method: 'GET',
      mode: 'no-cors',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latency = Date.now() - start;

    let label = 'Slow';
    if (latency < 450) label = 'Ultra-fast';
    else if (latency < 1200) label = 'Fast';

    return { latency, label };
  } catch (err) {
    clearTimeout(timeoutId);
    if (controller.signal.aborted) {
      // Really timed out / unreachable
      return { latency: 9999, label: 'Offline' };
    }
    // Connection refused/CORS error but did not timeout -> host is reached/online!
    const latency = Date.now() - start;
    let label = 'Slow';
    if (latency < 450) label = 'Ultra-fast';
    else if (latency < 1200) label = 'Fast';

    return { latency, label };
  }
}

// ---------------------------------------------------------------------------
// Aggregate streams from all providers
// ---------------------------------------------------------------------------

export interface AggregateOptions {
  /** Called each time a provider finishes (with updated full state) */
  onUpdate: (state: AggregatorState) => void;
  /** AbortSignal to cancel all pending providers */
  signal?: AbortSignal;
}

/**
 * Run all providers in parallel.
 * Each provider's results are merged into the shared state as they arrive.
 * onUpdate fires after each provider completes or a background ping resolves.
 */
export async function aggregateStreams(
  providers: StreamProvider[],
  query: StreamQuery,
  options: AggregateOptions
): Promise<AggregatorState> {
  const { onUpdate, signal } = options;

  // Initial state
  const providerStates: Map<string, ProviderState> = new Map(
    providers.map(p => [p.id, { id: p.id, label: p.label, status: 'loading', streams: [] }])
  );

  const allStreams: StreamItem[] = [];

  function buildState(): AggregatorState {
    const providerArr = Array.from(providerStates.values());
    const isLoading = providerArr.some(p => p.status === 'loading');
    const sorted = [...allStreams].sort((a, b) => b.score - a.score);
    return {
      streams: sorted,
      providers: providerArr,
      isLoading,
      autoSelected: sorted.find(s => s.latencyLabel !== 'Offline') ?? sorted[0] ?? null,
    };
  }

  // Fire all providers concurrently
  const promises = providers.map(async provider => {
    if (signal?.aborted) return;
    try {
      const timeoutMs = provider.id === 'cinepro' ? 8000 : 5000;
      const streams = await Promise.race([
        provider.fetchStreams(query),
        new Promise<StreamItem[]>((_, reject) =>
          setTimeout(() => reject(new Error('Provider timeout')), timeoutMs)
        ),
      ]);

      if (signal?.aborted) return;

      // Deduplicate by URL
      for (const s of streams) {
        if (!allStreams.some(existing => existing.url === s.url)) {
          // Initialize with testing state
          s.latencyLabel = 'Testing...';
          allStreams.push(s);

          // Trigger background domain latency ping
          pingStreamDomain(s.url).then(({ latency, label }) => {
            if (signal?.aborted) return;
            s.latency = latency;
            s.latencyLabel = label;
            onUpdate(buildState());
          });
        }
      }

      providerStates.set(provider.id, {
        id: provider.id,
        label: provider.label,
        status: 'done',
        streams,
      });
    } catch (err) {
      if (signal?.aborted) return;
      providerStates.set(provider.id, {
        id: provider.id,
        label: provider.label,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
        streams: [],
      });
    }

    onUpdate(buildState());
  });

  await Promise.allSettled(promises);
  return buildState();
}
