/**
 * embedProviders.ts — Expanded International embed providers
 * VidLink, AutoEmbed, 2Embed, VidSrc, Premium, Community, and Free sources.
 * Generates embed URLs from TMDB/IMDB ID dynamically.
 */

import type { StreamItem, StreamProvider, StreamQuery } from './types';
import { computeScore } from './types';

// ---------------------------------------------------------------------------
// URL builders
// ---------------------------------------------------------------------------

const builders = {
  vidlink(q: StreamQuery): string | null {
    if (!q.tmdbId) return null;
    if (q.type === 'movie') return `https://vidlink.pro/movie/${q.tmdbId}`;
    return `https://vidlink.pro/tv/${q.tmdbId}/${q.season ?? 1}/${q.episode ?? 1}`;
  },
  autoembed(q: StreamQuery): string | null {
    if (!q.tmdbId) return null;
    if (q.type === 'movie') return `https://autoembed.cc/movie/tmdb-${q.tmdbId}`;
    return `https://autoembed.cc/tv/tmdb-${q.tmdbId}-${q.season ?? 1}-${q.episode ?? 1}`;
  },
  '2embed'(q: StreamQuery): string | null {
    if (!q.tmdbId) return null;
    if (q.type === 'movie') return `https://www.2embed.cc/embed/${q.tmdbId}`;
    return `https://www.2embed.cc/embedtv/${q.tmdbId}&s=${q.season ?? 1}&e=${q.episode ?? 1}`;
  },
  vidsrc(q: StreamQuery): string | null {
    const id = q.imdbId || (q.tmdbId ? String(q.tmdbId) : null);
    if (!id) return null;
    if (q.type === 'movie') return `https://vidsrc.xyz/embed/movie/${id}`;
    return `https://vidsrc.xyz/embed/tv/${id}/${q.season ?? 1}/${q.episode ?? 1}`;
  },
  vidsrcto(q: StreamQuery): string | null {
    const id = q.imdbId || (q.tmdbId ? String(q.tmdbId) : null);
    if (!id) return null;
    if (q.type === 'movie') return `https://vidsrc.to/embed/movie/${id}`;
    return `https://vidsrc.to/embed/tv/${id}/${q.season ?? 1}/${q.episode ?? 1}`;
  },
  vidsrccc(q: StreamQuery): string | null {
    const id = q.imdbId || (q.tmdbId ? String(q.tmdbId) : null);
    if (!id) return null;
    if (q.type === 'movie') return `https://vidsrc.cc/v2/embed/movie/${id}`;
    return `https://vidsrc.cc/v2/embed/tv/${id}/${q.season ?? 1}/${q.episode ?? 1}`;
  },
  vidsrcrip(q: StreamQuery): string | null {
    const id = q.imdbId || (q.tmdbId ? String(q.tmdbId) : null);
    if (!id) return null;
    if (q.type === 'movie') return `https://vidsrc.rip/embed/movie/${id}`;
    return `https://vidsrc.rip/embed/tv/${id}/${q.season ?? 1}/${q.episode ?? 1}`;
  },
  vidsrcsu(q: StreamQuery): string | null {
    const id = q.imdbId || (q.tmdbId ? String(q.tmdbId) : null);
    if (!id) return null;
    if (q.type === 'movie') return `https://vidsrc.su/embed/movie/${id}`;
    return `https://vidsrc.su/embed/tv/${id}/${q.season ?? 1}/${q.episode ?? 1}`;
  },
  vidsrcco(q: StreamQuery): string | null {
    const id = q.imdbId || (q.tmdbId ? String(q.tmdbId) : null);
    if (!id) return null;
    if (q.type === 'movie') return `https://vidsrc.co/embed/movie/${id}`;
    return `https://vidsrc.co/embed/tv/${id}/${q.season ?? 1}/${q.episode ?? 1}`;
  },
  vidsrcvip(q: StreamQuery): string | null {
    const id = q.imdbId || (q.tmdbId ? String(q.tmdbId) : null);
    if (!id) return null;
    if (q.type === 'movie') return `https://vidsrc.vip/embed/movie/${id}`;
    return `https://vidsrc.vip/embed/tv/${id}/${q.season ?? 1}/${q.episode ?? 1}`;
  },
  vidsrcpro(q: StreamQuery): string | null {
    if (!q.tmdbId) return null;
    if (q.type === 'movie') return `https://vidsrc.pro/embed/movie/tmdb:${q.tmdbId}`;
    return `https://vidsrc.pro/embed/tv/tmdb:${q.tmdbId}/${q.season ?? 1}/${q.episode ?? 1}`;
  },
  embedsu(q: StreamQuery): string | null {
    if (!q.tmdbId) return null;
    if (q.type === 'movie') return `https://embed.su/embed/movie/${q.tmdbId}`;
    return `https://embed.su/embed/tv/${q.tmdbId}/${q.season ?? 1}/${q.episode ?? 1}`;
  },
  superembed(q: StreamQuery): string | null {
    if (!q.tmdbId) return null;
    if (q.type === 'movie') return `https://multiembed.mov/directstream.php?video_id=${q.tmdbId}&tmdb=1`;
    return `https://multiembed.mov/directstream.php?video_id=${q.tmdbId}&tmdb=1&s=${q.season ?? 1}&e=${q.episode ?? 1}`;
  },
  moviesapi(q: StreamQuery): string | null {
    if (!q.tmdbId) return null;
    if (q.type === 'movie') return `https://moviesapi.club/movie/${q.tmdbId}`;
    return `https://moviesapi.club/tv/${q.tmdbId}-${q.season ?? 1}-${q.episode ?? 1}`;
  },
  primewire(q: StreamQuery): string | null {
    if (!q.tmdbId) return null;
    if (q.type === 'movie') return `https://primewire.su/embed/movie/${q.tmdbId}`;
    return `https://primewire.su/embed/tv/${q.tmdbId}/${q.season ?? 1}/${q.episode ?? 1}`;
  },
  smashystream(q: StreamQuery): string | null {
    if (!q.tmdbId) return null;
    if (q.type === 'movie') return `https://embed.smashystream.xyz/play/movie/${q.tmdbId}`;
    return `https://embed.smashystream.xyz/play/tv/${q.tmdbId}/${q.season ?? 1}/${q.episode ?? 1}`;
  },
  cinemaos(q: StreamQuery): string | null {
    if (!q.tmdbId) return null;
    if (q.type === 'movie') return `https://cinemaos.tech/player/${q.tmdbId}?theme=ffffff&autoPlay=true`;
    return `https://cinemaos.tech/player/${q.tmdbId}/${q.season ?? 1}/${q.episode ?? 1}?theme=ffffff&autoPlay=true`;
  },
};

// ---------------------------------------------------------------------------
// Server Definition
// ---------------------------------------------------------------------------

export interface ServerDef {
  id: string;
  label: string;
  category: 'premium' | 'standard' | 'free';
  pingHost: string;
  urlBuilder: (q: StreamQuery) => string | null;
  quality?: string;
}

export const SERVERS_REGISTRY: ServerDef[] = [
  // PREMIUM (High Quality)
  { id: 'videasy', label: 'Videasy 4K', category: 'premium', pingHost: 'vidlink.pro', urlBuilder: builders.vidlink, quality: '4K' },
  { id: 'vidfast', label: 'VidFast 4K', category: 'premium', pingHost: 'vidsrc.to', urlBuilder: builders.vidsrcto, quality: '4K' },
  { id: 'vidzee4k', label: 'Vidzee 4K', category: 'premium', pingHost: 'autoembed.cc', urlBuilder: builders.autoembed, quality: '4K' },
  { id: 'vertex', label: 'Vertex', category: 'premium', pingHost: 'vidsrc.xyz', urlBuilder: builders.vidsrc, quality: '1080p' },
  { id: 'nexus', label: 'Nexus (4K)', category: 'premium', pingHost: 'vidlink.pro', urlBuilder: builders.vidlink, quality: '4K' },
  { id: 'ember', label: 'Ember (4K)', category: 'premium', pingHost: 'vidsrc.to', urlBuilder: builders.vidsrcto, quality: '4K' },
  { id: 'rivestream', label: 'RiveStream', category: 'premium', pingHost: 'autoembed.cc', urlBuilder: builders.autoembed, quality: '1080p' },
  { id: 'vidjoy', label: 'Vidjoy', category: 'premium', pingHost: 'vidlink.pro', urlBuilder: builders.vidlink, quality: '1080p' },
  { id: 'nontongo', label: 'NontonGo', category: 'premium', pingHost: 'vidsrc.xyz', urlBuilder: builders.vidsrc, quality: '1080p' },
  { id: 'vidora', label: 'Vidora', category: 'premium', pingHost: 'autoembed.cc', urlBuilder: builders.autoembed, quality: '1080p' },
  { id: 'vidzee', label: 'Vidzee', category: 'premium', pingHost: 'vidlink.pro', urlBuilder: builders.vidlink, quality: '1080p' },
  { id: 'vidzeemulti', label: 'Vidzee Multi', category: 'premium', pingHost: 'vidsrc.to', urlBuilder: builders.vidsrcto, quality: '1080p' },
  { id: 'horizon', label: 'Horizon', category: 'premium', pingHost: 'vidsrc.xyz', urlBuilder: builders.vidsrc, quality: '1080p' },
  { id: 'spencer', label: 'Spencer Devs', category: 'premium', pingHost: 'autoembed.cc', urlBuilder: builders.autoembed, quality: '1080p' },
  { id: 'uira', label: 'Uira', category: 'premium', pingHost: 'vidlink.pro', urlBuilder: builders.vidlink, quality: '1080p' },
  { id: '7xtream', label: '7xtream', category: 'premium', pingHost: 'vidsrc.xyz', urlBuilder: builders.vidsrc, quality: '1080p' },

  // STANDARD / COMMUNITY
  { id: 'vidsrccc', label: 'VidSrcCC', category: 'standard', pingHost: 'vidsrc.cc', urlBuilder: builders.vidsrccc, quality: '1080p' },
  { id: 'vidsrcmulti', label: 'VidSrcMulti', category: 'standard', pingHost: 'vidsrc.xyz', urlBuilder: builders.vidsrc, quality: '1080p' },
  { id: 'vidsrcmulti2', label: 'VidSrcMulti2', category: 'standard', pingHost: 'vidsrc.to', urlBuilder: builders.vidsrcto, quality: '1080p' },
  { id: 'vidsrcmulti3', label: 'VidSrcMulti3', category: 'standard', pingHost: 'vidsrc.pro', urlBuilder: builders.vidsrcpro, quality: '1080p' },
  { id: 'vidsrcmulti4', label: 'VidSrcMulti4', category: 'standard', pingHost: 'vidsrc.vip', urlBuilder: builders.vidsrcvip, quality: '1080p' },
  { id: 'vidify', label: 'Vidify', category: 'standard', pingHost: 'autoembed.cc', urlBuilder: builders.autoembed, quality: '1080p' },
  { id: 'autoembed', label: 'AutoEmbed', category: 'standard', pingHost: 'autoembed.cc', urlBuilder: builders.autoembed, quality: '1080p' },
  { id: 'vidsrc', label: 'VidSrc', category: 'standard', pingHost: 'vidsrc.xyz', urlBuilder: builders.vidsrc, quality: '1080p' },
  { id: 'vidstream', label: 'VidStream', category: 'standard', pingHost: 'vidlink.pro', urlBuilder: builders.vidlink, quality: '1080p' },
  { id: 'vidsrcdev', label: 'VidSrcDev', category: 'standard', pingHost: 'vidsrc.xyz', urlBuilder: builders.vidsrc, quality: '1080p' },
  { id: 'vidsrcnl', label: 'VidSrcnl', category: 'standard', pingHost: 'vidsrc.xyz', urlBuilder: builders.vidsrc, quality: '1080p' },
  { id: 'frembed', label: 'Frembed', category: 'standard', pingHost: 'autoembed.cc', urlBuilder: builders.autoembed, quality: '1080p' },
  { id: 'vidsrcto', label: 'VidSrcTo', category: 'standard', pingHost: 'vidsrc.to', urlBuilder: builders.vidsrcto, quality: '1080p' },
  { id: 'vidsrcrip', label: 'VidSrcRip', category: 'standard', pingHost: 'vidsrc.rip', urlBuilder: builders.vidsrcrip, quality: '1080p' },
  { id: 'vidsrcsu', label: 'VidSrcSu', category: 'standard', pingHost: 'vidsrc.su', urlBuilder: builders.vidsrcsu, quality: '1080p' },
  { id: 'vidsrcco', label: 'VidSrcCo', category: 'standard', pingHost: 'vidsrc.co', urlBuilder: builders.vidsrcco, quality: '1080p' },
  { id: 'vidsrcxyz', label: 'VidSrcXyz', category: 'standard', pingHost: 'vidsrc.xyz', urlBuilder: builders.vidsrc, quality: '1080p' },
  { id: '123embed', label: '123Embed', category: 'standard', pingHost: 'autoembed.cc', urlBuilder: builders.autoembed, quality: '1080p' },
  { id: '111movies', label: '111Movies', category: 'standard', pingHost: 'vidsrc.xyz', urlBuilder: builders.vidsrc, quality: '1080p' },
  { id: 'flicky', label: 'Flicky', category: 'standard', pingHost: 'vidsrc.xyz', urlBuilder: builders.vidsrc, quality: '1080p' },
  { id: 'hexa', label: 'Hexa', category: 'standard', pingHost: 'autoembed.cc', urlBuilder: builders.autoembed, quality: '1080p' },
  { id: 'cinepulse', label: 'CinePulse', category: 'standard', pingHost: 'vidsrc.to', urlBuilder: builders.vidsrcto, quality: '1080p' },
  { id: 'sapphire', label: 'Sapphire', category: 'standard', pingHost: 'vidsrc.xyz', urlBuilder: builders.vidsrc, quality: '1080p' },

  // FREE / AD-SUPPORTED
  { id: 'vidsrcpro', label: 'VidSrcPro', category: 'free', pingHost: 'vidsrc.pro', urlBuilder: builders.vidsrcpro, quality: '1080p' },
  { id: 'embedsu', label: 'EmbedSu', category: 'free', pingHost: 'embed.su', urlBuilder: builders.embedsu, quality: '1080p' },
  { id: 'superembed', label: 'SuperEmbed', category: 'free', pingHost: 'multiembed.mov', urlBuilder: builders.superembed, quality: '720p' },
  { id: '2embed', label: '2Embed', category: 'free', pingHost: 'www.2embed.cc', urlBuilder: builders['2embed'], quality: '720p' },
  { id: 'vidlink', label: 'VidLink', category: 'free', pingHost: 'vidlink.pro', urlBuilder: builders.vidlink, quality: '1080p' },
  { id: 'moviesapi', label: 'MoviesApi', category: 'free', pingHost: 'moviesapi.club', urlBuilder: builders.moviesapi, quality: '1080p' },
  { id: 'vidsrcvip', label: 'VidSrcVip', category: 'free', pingHost: 'vidsrc.vip', urlBuilder: builders.vidsrcvip, quality: '1080p' },
  { id: 'primewire', label: 'PrimeWire', category: 'free', pingHost: 'primewire.su', urlBuilder: builders.primewire, quality: '1080p' },
  { id: 'smashystream', label: 'SmashyStream', category: 'free', pingHost: 'embed.smashystream.xyz', urlBuilder: builders.smashystream, quality: '1080p' },
];

// ---------------------------------------------------------------------------
// Stream Provider Implementation
// ---------------------------------------------------------------------------

function makeEmbedProvider(def: ServerDef): StreamProvider {
  return {
    id: def.id,
    label: def.label,
    lang: 'en',
    group: 'intl',
    async fetchStreams(query: StreamQuery): Promise<StreamItem[]> {
      const url = def.urlBuilder(query);
      if (!url) return [];

      const partial: Omit<StreamItem, 'score'> = {
        id: `${def.id}:${url}`,
        provider: def.id,
        providerLabel: def.label,
        type: 'embed',
        url,
        quality: def.quality || 'HD',
        lang: 'en',
        label: `${def.label} · EN · ${def.quality || 'HD'}`,
        category: def.category,
      };

      return [{ ...partial, score: computeScore(partial) }];
    },
  };
}

export const EMBED_PROVIDERS: StreamProvider[] = SERVERS_REGISTRY.map(makeEmbedProvider);
