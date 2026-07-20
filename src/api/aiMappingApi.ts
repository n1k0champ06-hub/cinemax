/**
 * aiMappingApi.ts
 * Queries Cloudflare Worker KV mapping endpoint for pre-computed TMDB-to-slug mappings.
 */

export interface AiMappingResult {
  slug: string;
  provider?: string;
  confidence?: number;
}

export async function fetchAiMapping(
  tmdbId: string | number,
  mediaType: string = 'movie',
  season: number = 1
): Promise<AiMappingResult | null> {
  if (!tmdbId) return null;

  try {
    const backendUrl =
      import.meta.env.VITE_BACKEND_URL && import.meta.env.VITE_BACKEND_URL.startsWith('http')
        ? import.meta.env.VITE_BACKEND_URL
        : '';
    
    const sTag = mediaType === 'tv' ? `:s${season || 1}` : '';
    const cacheKey = `tmdb_map:${mediaType}:${tmdbId}${sTag}`;
    const endpoint = backendUrl
      ? `${backendUrl}/api/ai-mapping?key=${encodeURIComponent(cacheKey)}`
      : `/api/ai-mapping?key=${encodeURIComponent(cacheKey)}`;

    const res = await fetch(endpoint, {
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.slug) {
      return {
        slug: data.slug,
        provider: data.provider || 'ophim',
        confidence: data.confidence || 1.0,
      };
    }
    return null;
  } catch (err) {
    console.warn('[aiMappingApi] Failed to fetch KV AI mapping:', err);
    return null;
  }
}
