/**
 * embedProviders.ts — Requested VidSrc Live embed providers
 * vidsrcme.ru, vidsrcme.su, vidsrc-me.ru, vidsrc-me.su, vidsrc-embed.ru, vidsrc-embed.su, vsrc.su
 * Generates embed URLs from TMDB/IMDB ID dynamically.
 */

import type { StreamItem, StreamProvider, StreamQuery } from './types';
import { computeScore } from './types';

// Helper function to build standard VidSrc URL structure shared across all requested domains
function buildVidSrcUrl(domain: string, q: StreamQuery): string | null {
  const id = q.imdbId || (q.tmdbId ? String(q.tmdbId) : null);
  if (!id) return null;
  if (q.type === 'movie') return `https://${domain}/embed/movie/${id}?autoplay=1`;
  return `https://${domain}/embed/tv/${id}/${q.season ?? 1}-${q.episode ?? 1}?autoplay=1`;
}

function buildVidSrcToUrl(q: StreamQuery): string | null {
  const id = q.imdbId || (q.tmdbId ? String(q.tmdbId) : null);
  if (!id) return null;
  if (q.type === 'movie') return `https://vidsrc.to/embed/movie/${id}?autoplay=1`;
  return `https://vidsrc.to/embed/tv/${id}/${q.season ?? 1}/${q.episode ?? 1}?autoplay=1`;
}

function buildVidNestUrl(q: StreamQuery): string | null {
  if (q.isAnime && q.viSlug && q.viSlug.startsWith('anilist-')) {
    const parts = q.viSlug.split('-');
    const anilistId = parts[1];
    if (anilistId) {
      const ep = q.episode ?? 1;
      return `https://vidnest.fun/anime/${anilistId}/${ep}/sub?autoplay=1`;
    }
  }

  const id = q.tmdbId;
  if (!id) return null;
  if (q.type === 'movie') return `https://vidnest.fun/movie/${id}?autoplay=1`;
  return `https://vidnest.fun/tv/${id}/${q.season ?? 1}/${q.episode ?? 1}?autoplay=1`;
}

function buildVidNestAnimePaheUrl(q: StreamQuery): string | null {
  if (q.isAnime && q.viSlug && q.viSlug.startsWith('anilist-')) {
    const parts = q.viSlug.split('-');
    const anilistId = parts[1];
    if (anilistId) {
      const ep = q.episode ?? 1;
      return `https://vidnest.fun/animepahe/${anilistId}/${ep}/sub?autoplay=1`;
    }
  }
  return null;
}

export interface ServerDef {
  id: string;
  label: string;
  category: 'premium' | 'standard' | 'free';
  pingHost: string;
  urlBuilder: (q: StreamQuery) => string | null;
  quality?: string;
}

export const SERVERS_REGISTRY: ServerDef[] = [
  { id: 'vidnest', label: 'VidNest (Community)', category: 'free', pingHost: 'vidnest.fun', urlBuilder: buildVidNestUrl, quality: '1080p' },
  { id: 'vidnest_animepahe', label: 'VidNest AnimePahe (Community)', category: 'free', pingHost: 'vidnest.fun', urlBuilder: buildVidNestAnimePaheUrl, quality: '1080p' },
  { id: 'vidsrc_to', label: 'VidSrc.to', category: 'free', pingHost: 'vidsrc.to', urlBuilder: buildVidSrcToUrl, quality: '1080p' },
  { id: 'vidsrc_embed_ru', label: 'VidSrc Embed RU', category: 'standard', pingHost: 'vidsrc-embed.ru', urlBuilder: (q) => buildVidSrcUrl('vidsrc-embed.ru', q), quality: '1080p' },
  { id: 'vidsrc_embed_su', label: 'VidSrc Embed SU', category: 'standard', pingHost: 'vidsrc-embed.su', urlBuilder: (q) => buildVidSrcUrl('vidsrc-embed.su', q), quality: '1080p' },
  { id: 'vidsrc_me_ru', label: 'VidSrc Me RU', category: 'standard', pingHost: 'vidsrcme.ru', urlBuilder: (q) => buildVidSrcUrl('vidsrcme.ru', q), quality: '1080p' },
  { id: 'vidsrc_me_su', label: 'VidSrc Me SU', category: 'standard', pingHost: 'vidsrcme.su', urlBuilder: (q) => buildVidSrcUrl('vidsrcme.su', q), quality: '1080p' },
  { id: 'vidsrc_dash_me_ru', label: 'VidSrc Me-RU', category: 'standard', pingHost: 'vidsrc-me.ru', urlBuilder: (q) => buildVidSrcUrl('vidsrc-me.ru', q), quality: '1080p' },
  { id: 'vidsrc_dash_me_su', label: 'VidSrc Me-SU', category: 'standard', pingHost: 'vidsrc-me.su', urlBuilder: (q) => buildVidSrcUrl('vidsrc-me.su', q), quality: '1080p' },
  { id: 'vsrc_su', label: 'VSRC SU', category: 'standard', pingHost: 'vsrc.su', urlBuilder: (q) => buildVidSrcUrl('vsrc.su', q), quality: '1080p' },
];

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
