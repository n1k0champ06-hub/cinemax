/**
 * viProviders.ts — Vietnamese source providers
 * Directly fetches and searches from OPhim, KKPhim, and NguonC public APIs.
 * Supports direct slug matching and title-based search fallback.
 */

import type { StreamItem, StreamProvider, StreamQuery } from './types';
import { computeScore } from './types';
import { buildProxiedM3u8Url } from '../cineproApi';
import { fetchAiMapping } from '../aiMappingApi';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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


function normalizeViText(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd');
}

function cleanSearchQuery(str: string): string {
  if (!str) return '';
  return str
    .replace(/[\(\)\[\]]/g, ' ')
    .replace(/\b(vietsub|thuyet minh|long tieng|longtieng|thuyetminh|subviet|sub|raw|hd|full|fhd)\b/gi, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getEpisodeNumber(nameStr: string | number | undefined | null): number | null {
  if (nameStr === undefined || nameStr === null) return null;
  const cleaned = nameStr.toString().replace(/\D/g, '');
  if (!cleaned) return null;
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

function matchEpisode(epName: string | number, targetEp: number): boolean {
  const num = getEpisodeNumber(epName);
  return num !== null ? num === targetEp : false;
}

function getBestSlugMatch(
  items: any[],
  queryTitle: string,
  queryTitleVi: string,
  queryYear?: number | string | null,
  querySlug?: string | null,
  queryTmdbId?: string | number,
  queryImdbId?: string,
  queryCasts?: string[],
  querySeason?: number | null,
  queryDirectors?: string[],
  queryCountries?: string[]
): string | null {
  if (!items || items.length === 0) return null;

  // 1. Strict TMDB or IMDb matching if IDs are provided
  if (queryTmdbId || queryImdbId) {
    const qTmdb = queryTmdbId ? String(queryTmdbId) : null;
    const qImdb = queryImdbId ? String(queryImdbId) : null;

    for (const item of items) {
      if (qTmdb && item.tmdb && item.tmdb.id && String(item.tmdb.id) === qTmdb) {
        if (querySeason && querySeason > 1 && item.tmdb.season && Number(item.tmdb.season) !== querySeason) {
          continue; // Season mismatch, skip this item
        }
        return item.slug;
      }
      if (qImdb && item.imdb && item.imdb.id && String(item.imdb.id) === qImdb) {
        if (querySeason && querySeason > 1 && item.imdb.season && Number(item.imdb.season) !== querySeason) {
          continue; // Season mismatch, skip this item
        }
        return item.slug;
      }
    }
  }

  // 2. Fallback to string matching
  const qTitleNorm = normalizeViText(cleanSearchQuery(queryTitle));
  const qTitleViNorm = normalizeViText(cleanSearchQuery(queryTitleVi));
  const qSlug = querySlug ? querySlug.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

  const parsedQueryYear = queryYear ? (typeof queryYear === 'string' ? parseInt(queryYear) : queryYear) : 0;

  const scored = items.map((item: any) => {
    const rawName = item.name || '';
    const rawOrigin = item.origin_name || item.original_name || '';
    const titleNorm = normalizeViText(cleanSearchQuery(rawName));
    const originNorm = normalizeViText(cleanSearchQuery(rawOrigin));
    const year = parseInt(item.year) || 0;
    const itemSlug = item.slug ? item.slug.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

    let score = 0;
    
    // Title match
    if (
      (qTitleViNorm && (titleNorm === qTitleViNorm || originNorm === qTitleViNorm)) ||
      (qTitleNorm && (titleNorm === qTitleNorm || originNorm === qTitleNorm))
    ) {
      score += 80;
    } else if (
      (qTitleViNorm && (titleNorm.includes(qTitleViNorm) || originNorm.includes(qTitleViNorm) || qTitleViNorm.includes(titleNorm))) ||
      (qTitleNorm && (titleNorm.includes(qTitleNorm) || originNorm.includes(qTitleNorm) || qTitleNorm.includes(titleNorm)))
    ) {
      score += 50;
    }

    // Season match verification
    if (querySeason && querySeason > 0) {
      const fullItemTextNorm = normalizeViText(`${rawName} ${rawOrigin} ${item.slug || ''}`);
      const seasonMatch = fullItemTextNorm.match(/(?:phan|season|part|ss|mua)\s*0*(\d+)/i);
      if (seasonMatch) {
        const itemSeason = parseInt(seasonMatch[1], 10);
        if (itemSeason === querySeason) {
          score += 150; // Big bonus for matching exact season
        } else {
          score -= 200; // Big penalty for wrong season
        }
      } else {
        if (querySeason === 1) {
          score += 30; // Base title matching season 1
        } else {
          score -= 50; // Base title without season tag when searching Season 2+
        }
      }
    }

    // Slug substring match
    if (qSlug && itemSlug) {
      if (itemSlug === qSlug) {
        score += 90;
      } else if (qSlug.includes(itemSlug) || itemSlug.includes(qSlug)) {
        score += 70;
      }
    }

    // Year match scoring
    if (parsedQueryYear && year) {
      if (year === parsedQueryYear) {
        score += 40;
      } else if (Math.abs(year - parsedQueryYear) <= 1) {
        score += 20;
      } else {
        score -= 50; // Penalty for year mismatch
      }
    }

    // Country match scoring
    if (queryCountries && queryCountries.length > 0) {
      const itemCountries = typeof item.country === 'string' ? item.country.toLowerCase() : 
                            (Array.isArray(item.country) ? item.country.map((c: any) => (c.name || c.slug || c).toLowerCase()).join(',') : '');
      if (itemCountries) {
        let matched = false;
        for (const qc of queryCountries) {
          if (!qc) continue;
          const qcNorm = normalizeViText(qc);
          if (normalizeViText(itemCountries).includes(qcNorm)) {
            matched = true;
            break;
          }
        }
        if (matched) {
          score += 30;
        } else {
          score -= 15;
        }
      }
    }

    // Cast overlap match (highly accurate fallback)
    if (queryCasts && queryCasts.length > 0) {
      const itemCasts = typeof item.casts === 'string' ? item.casts.toLowerCase() : 
                        (Array.isArray(item.casts) ? item.casts.join(',').toLowerCase() : 
                        (typeof item.actor === 'string' ? item.actor.toLowerCase() : 
                        (Array.isArray(item.actor) ? item.actor.join(',').toLowerCase() : '')));
      
      if (itemCasts) {
        let overlap = 0;
        for (const qc of queryCasts) {
          if (qc && itemCasts.includes(qc.toLowerCase())) {
            overlap++;
          }
        }
        if (overlap > 0) {
          score += (overlap * 20); // 20 points per cast match
        }
      }
    }

    // Director overlap match
    if (queryDirectors && queryDirectors.length > 0) {
      const itemDirectors = typeof item.director === 'string' ? item.director.toLowerCase() : 
                            (Array.isArray(item.director) ? item.director.join(',').toLowerCase() : 
                            (typeof item.directors === 'string' ? item.directors.toLowerCase() : 
                            (Array.isArray(item.directors) ? item.directors.join(',').toLowerCase() : '')));
      if (itemDirectors) {
        let overlap = 0;
        for (const qd of queryDirectors) {
          if (qd && itemDirectors.includes(qd.toLowerCase())) {
            overlap++;
          }
        }
        if (overlap > 0) {
          score += (overlap * 30); // 30 points per director match
        }
      }
    }

    return { slug: item.slug, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score >= 75 ? scored[0].slug : null;
}

// ---------------------------------------------------------------------------
// Main Provider Runner
// ---------------------------------------------------------------------------

async function fetchFromVietnameseApi(
  providerId: 'ophim' | 'kkphim' | 'nguonc',
  providerLabel: string,
  query: StreamQuery
): Promise<StreamItem[]> {
  try {
    const isTv = query.type === 'tv';
    const targetEpisode = isTv ? (query.episode || 1) : 1;
    let slug = query.viSlug;
    let detailData: any = null;
    let detailFetched = false;

    // 0. Try direct TMDB/IMDb endpoint lookup first if supported (KKPhim & OPhim)
    if (!detailFetched && (providerId === 'kkphim' || providerId === 'ophim')) {
      const baseDomain = providerId === 'kkphim' ? 'https://phimapi.com' : 'https://ophim1.com';
      if (query.tmdbId) {
        const type = query.type === 'tv' ? 'tv' : 'movie';
        const tmdbUrl = `${baseDomain}/tmdb/${type}/${query.tmdbId}`;
        try {
          const res = await fetchWithTimeout(tmdbUrl, 3500);
          if (res.ok) {
            const data = await res.json();
            if (data && (data.status === true || data.status === 'success' || data.movie || data.film || data.data)) {
              const movieInfo = data.movie || data.film || data.data || data;
              if (movieInfo && movieInfo.slug) {
                detailData = data;
                detailFetched = true;
                slug = movieInfo.slug;
                console.log(`[${providerLabel}] Direct TMDB ID lookup hit! Slug: ${slug}`);
              }
            }
          }
        } catch (e) {
          console.warn(`[${providerLabel}] Direct TMDB ID lookup failed for URL ${tmdbUrl}:`, e);
        }
      }
      if (!detailFetched && query.imdbId) {
        const imdbUrl = `${baseDomain}/imdb/${query.imdbId}`;
        try {
          const res = await fetchWithTimeout(imdbUrl, 3500);
          if (res.ok) {
            const data = await res.json();
            if (data && (data.status === true || data.status === 'success' || data.movie || data.film || data.data)) {
              const movieInfo = data.movie || data.film || data.data || data;
              if (movieInfo && movieInfo.slug) {
                detailData = data;
                detailFetched = true;
                slug = movieInfo.slug;
                console.log(`[${providerLabel}] Direct IMDb ID lookup hit! Slug: ${slug}`);
              }
            }
          }
        } catch (e) {
          console.warn(`[${providerLabel}] Direct IMDb ID lookup failed for URL ${imdbUrl}:`, e);
        }
      }
    }

    // 1. Try direct slug fetch first if it exists and is not tmdb-
    // If season > 1, do NOT use direct slug unless the slug explicitly specifies the season (e.g. diem-lanh-phan-2)
    let canDirectFetch = !!slug && (providerId === 'kkphim' || !slug.startsWith('tmdb-'));
    if (canDirectFetch && query.season && query.season > 1 && slug) {
      const sNum = String(query.season);
      const hasSeasonInSlug = slug.includes(`season-${sNum}`) || slug.includes(`phan-${sNum}`) || slug.includes(`mua-${sNum}`) || slug.includes(`ss${sNum}`);
      if (!hasSeasonInSlug) {
        canDirectFetch = false;
      }
    }

    if (canDirectFetch && slug) {
      let detailUrl = '';
      if (providerId === 'ophim') {
        detailUrl = `https://ophim1.com/phim/${slug}`;
      } else if (providerId === 'nguonc') {
        detailUrl = `https://phim.nguonc.com/api/film/${slug}`;
      } else {
        detailUrl = `https://phimapi.com/phim/${slug}`;
      }
      try {
        const res = await fetchWithTimeout(detailUrl, 6000);
        if (res.ok) {
          detailData = await res.json();
          if (detailData && (detailData.status === true || detailData.status === 'success' || detailData.movie || detailData.film || detailData.data)) {
            const movieInfo = detailData.movie || detailData.film || detailData.data || detailData;
            const fetchedYear = movieInfo?.year ? parseInt(movieInfo.year) : 0;
            const queryYear = query.year ? (typeof query.year === 'string' ? parseInt(query.year) : query.year) : 0;
            
            // Reject direct match on year mismatch > 1 (e.g. 2016 vs 2026 for Obsession)
            if (queryYear && fetchedYear && Math.abs(fetchedYear - queryYear) > 1) {
              console.log(`[${providerLabel}] Direct slug fetch returned year ${fetchedYear} but query year is ${queryYear}. Year mismatch, falling back to search.`);
              detailData = null;
            } else {
              detailFetched = true;
            }
          }
        }
      } catch (e) {
        console.warn(`[${providerLabel}] Direct slug fetch failed for ${slug}, will search fallback:`, e);
      }
    }

    // 1b. Check AI Mapping from Cloudflare KV
    if (!detailFetched && query.tmdbId) {
      try {
        const aiMapping = await fetchAiMapping(query.tmdbId, query.type || 'movie', query.season || 1);
        if (aiMapping && aiMapping.slug) {
          const aiSlug = aiMapping.slug;
          let aiDetailUrl = '';
          if (providerId === 'ophim') {
            aiDetailUrl = `https://ophim1.com/phim/${aiSlug}`;
          } else if (providerId === 'nguonc') {
            aiDetailUrl = `https://phim.nguonc.com/api/film/${aiSlug}`;
          } else {
            aiDetailUrl = `https://phimapi.com/phim/${aiSlug}`;
          }

          const res = await fetchWithTimeout(aiDetailUrl, 5000);
          if (res.ok) {
            const data = await res.json();
            if (data && (data.status === true || data.status === 'success' || data.movie || data.film || data.data)) {
              detailData = data;
              detailFetched = true;
              slug = aiSlug;
              console.log(`[${providerLabel}] AI KV Mapping hit! Matched slug: ${aiSlug}`);
            }
          }
        }
      } catch (err) {
        console.warn(`[${providerLabel}] AI KV Mapping lookup error:`, err);
      }
    }

    // 2. If direct slug fetch and AI mapping failed or were skipped, search by title or slug to resolve slug
    if (!detailFetched) {
      const searchKeywords: string[] = [];

      // Priority 1: Search directly by TMDB & IMDb ID (Fastest & most accurate if provider search engine indexed it)
      if (query.tmdbId) {
        searchKeywords.push(String(query.tmdbId));
      }
      if (query.imdbId) {
        searchKeywords.push(String(query.imdbId));
      }

      // Priority 2: Extract high-probability search keywords from viSlug if available
      if (slug && !slug.startsWith('tmdb-')) {
        const slugCleaned = slug.replace(/-/g, ' ').trim();
        const slugWords = slugCleaned.split(' ').filter(w => w.length > 1);
        if (slugWords.length > 0) {
          if (slugWords.length > 4) {
            searchKeywords.push(slugWords.slice(0, 4).join(' '));
          }
          if (slugWords.length > 3) {
            searchKeywords.push(slugWords.slice(0, 3).join(' '));
          }
          searchKeywords.push(slugCleaned);
        }
      }

      // Add Vietnamese title
      if (query.titleVi) {
        searchKeywords.push(query.titleVi);
        const cleanVi = query.titleVi.replace(/\s*[\(\[].*?[\)\]]/g, '').trim();
        if (cleanVi && cleanVi !== query.titleVi) {
          searchKeywords.push(cleanVi);
        }
        if (isTv && query.season && query.season > 1) {
          searchKeywords.push(`${cleanVi} Phần ${query.season}`);
          searchKeywords.push(`${query.titleVi} Phần ${query.season}`);
        }
      }

      // Add English title if different
      if (query.title && query.title !== query.titleVi) {
        searchKeywords.push(query.title);
        const cleanEn = query.title.replace(/\s*[\(\[].*?[\)\]]/g, '').trim();
        if (cleanEn && cleanEn !== query.title) {
          searchKeywords.push(cleanEn);
        }
        if (isTv && query.season && query.season > 1) {
          searchKeywords.push(`${cleanEn} Season ${query.season}`);
          searchKeywords.push(`${query.title} Season ${query.season}`);
        }
      }

      let pooledItems: any[] = [];
      
      // Deduplicate keywords to avoid redundant requests
      const uniqueKeywords = Array.from(new Set(searchKeywords));

      const searchPromises = uniqueKeywords.map(async (kw) => {
        const encodedKw = encodeURIComponent(kw);
        let searchUrl = '';
        if (providerId === 'ophim') {
          searchUrl = `https://ophim1.com/v1/api/tim-kiem?keyword=${encodedKw}&limit=10`;
        } else if (providerId === 'nguonc') {
          searchUrl = `https://phim.nguonc.com/api/films/search?keyword=${encodedKw}`;
        } else {
          searchUrl = `https://phimapi.com/v1/api/tim-kiem?keyword=${encodedKw}&limit=10`;
        }

        try {
          const res = await fetchWithTimeout(searchUrl, 5000);
          if (res.ok) {
            const data = await res.json();
            return data?.data?.items || data?.items || [];
          }
        } catch (e) {
          console.warn(`[${providerLabel}] Search failed for keyword: ${kw}`, e);
        }
        return [];
      });

      const results = await Promise.allSettled(searchPromises);
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          pooledItems = pooledItems.concat(result.value);
        }
      });

      // Deduplicate pooled items by slug
      const seenSlugs = new Set<string>();
      const uniqueItems = pooledItems.filter(item => {
        if (!item || !item.slug) return false;
        if (seenSlugs.has(item.slug)) return false;
        seenSlugs.add(item.slug);
        return true;
      });

      // 2a. 100% Exact TMDB/IMDb ID Verification on Top Candidates
      // Search list endpoint (/v1/api/tim-kiem) doesn't include tmdb/imdb IDs in items array.
      // We check detail endpoint (/phim/{slug}) for top candidates to match TMDB/IMDb IDs with 100% precision.
      if (query.tmdbId || query.imdbId) {
        const topCandidates = uniqueItems.slice(0, 5);
        const idMatches = await Promise.allSettled(
          topCandidates.map(async (item) => {
            let candidateUrl = '';
            if (providerId === 'ophim') {
              candidateUrl = `https://ophim1.com/phim/${item.slug}`;
            } else if (providerId === 'nguonc') {
              candidateUrl = `https://phim.nguonc.com/api/film/${item.slug}`;
            } else {
              candidateUrl = `https://phimapi.com/phim/${item.slug}`;
            }
            try {
              const res = await fetchWithTimeout(candidateUrl, 3500);
              if (res.ok) {
                const data = await res.json();
                const movie = data?.movie || data?.film || data?.data;
                const mTmdb = movie?.tmdb?.id || movie?.tmdb_id || movie?.tmdbId;
                const mImdb = movie?.imdb?.id || movie?.imdb_id || movie?.imdbId;
                
                const targetTmdb = query.tmdbId ? String(query.tmdbId) : null;
                const targetImdb = query.imdbId ? String(query.imdbId) : null;

                const tmdbMatched = targetTmdb && mTmdb && String(mTmdb) === targetTmdb;
                const imdbMatched = targetImdb && mImdb && String(mImdb) === targetImdb;

                if (tmdbMatched || imdbMatched) {
                  if (isTv && query.season && movie?.tmdb?.season) {
                    if (Number(movie.tmdb.season) === query.season) {
                      return { slug: item.slug, data };
                    }
                  } else {
                    return { slug: item.slug, data };
                  }
                }
              }
            } catch (_) {}
            return null;
          })
        );

        for (const res of idMatches) {
          if (res.status === 'fulfilled' && res.value) {
            slug = res.value.slug;
            detailData = res.value.data;
            detailFetched = true;
            console.log(`[${providerLabel}] 100% TMDB/IMDb ID Match confirmed for slug: ${slug}`);
            break;
          }
        }
      }

      if (!detailFetched) {
        const matchedSlug = getBestSlugMatch(
          uniqueItems,
          query.title,
          query.titleVi || '',
          query.year,
          slug,
          query.tmdbId,
          query.imdbId,
          query.casts,
          query.season,
          query.directors,
          query.countries
        );

        if (matchedSlug) {
          slug = matchedSlug;
          let detailUrl = '';
          if (providerId === 'ophim') {
            detailUrl = `https://ophim1.com/phim/${slug}`;
          } else if (providerId === 'nguonc') {
            detailUrl = `https://phim.nguonc.com/api/film/${slug}`;
          } else {
            detailUrl = `https://phimapi.com/phim/${slug}`;
          }
          
          try {
            const res = await fetchWithTimeout(detailUrl, 6000);
            if (res.ok) {
              detailData = await res.json();
              detailFetched = true;
            }
          } catch (e) {
            console.error(`[${providerLabel}] Failed to fetch details for resolved fallback slug ${slug}:`, e);
          }
        }
      }
    }

    if (!detailFetched || !detailData) return [];

    // 3. Extract episodes list
    let serversList: any[] = [];
    serversList = detailData?.movie?.episodes || detailData?.episodes || [];

    if (!serversList || serversList.length === 0) return [];

    const streams: StreamItem[] = [];

    // 4. Iterate over servers and find matching episode
    serversList.forEach((server: any) => {
      let serverData = server.server_data || [];
      if (providerId === 'nguonc' && server.items) {
        serverData = server.items.map((item: any) => ({
          name: item.name,
          slug: item.slug,
          filename: item.filename || `Tập ${item.name}`,
          link_embed: item.embed || item.link_embed || '',
          link_m3u8: item.m3u8 || item.link_m3u8 || '',
        }));
      }

      // Find episode
      let activeEp = serverData[0]; // fallback
      if (isTv) {
        const found = serverData.find((ep: any) => matchEpisode(ep.name, targetEpisode));
        if (found) activeEp = found;
        else return; // skip if episode not found on this server
      }

      const serverName = (server.server_name || 'Server').replace(/\s*#\d+/g, '');
      let subType = 'Vietsub';
      const normServerName = serverName.toLowerCase();
      if (normServerName.includes('thuyết minh') || normServerName.includes('thuyet minh')) {
        subType = 'Thuyết minh';
      } else if (normServerName.includes('lồng tiếng') || normServerName.includes('long tieng')) {
        subType = 'Lồng tiếng';
      }

      const labelPrefix = `${providerLabel} · ${serverName}`;

      // Add HLS stream if available (skip NguonC HLS — không ổn định, chỉ giữ embed)
      if (providerId !== 'nguonc' && activeEp.link_m3u8 && String(activeEp.link_m3u8).startsWith('http')) {
        const rawUrl = activeEp.link_m3u8;
        let referer = '';
        if (providerId === 'ophim') referer = 'https://ophim1.com/';
        else if (providerId === 'kkphim') referer = 'https://phimapi.com/';
        else if (providerId === 'nguonc') referer = 'https://phim.nguonc.com/';

        const url = buildProxiedM3u8Url(rawUrl, referer);

        const item: Omit<StreamItem, 'score'> = {
          id: `${providerId}:hls:${serverName}:${rawUrl}`,
          provider: providerId,
          providerLabel: `${providerLabel.toUpperCase()} - ${subType}`,
          type: 'hls',
          url,
          quality: rawUrl.toLowerCase().includes('1080') ? '1080p' : 'auto',
          lang: 'vi',
          label: `${labelPrefix} · HLS`,
          episodeName: activeEp.name || String(targetEpisode),
          category: 'vi',
        };
        streams.push({ ...item, score: computeScore(item) });
      }

      // Add EMBED stream as backup/fallback (only keep NguonC, delete OPhim/KKPhim embed backups)
      if (providerId === 'nguonc' && activeEp.link_embed && String(activeEp.link_embed).startsWith('http')) {
        const embedUrl = activeEp.link_embed;
        const isNguonC = true;
        const labelSuffix = '(Embed)';
        const item: Omit<StreamItem, 'score'> = {
          id: `${providerId}:embed:${serverName}:${embedUrl}`,
          provider: providerId,
          providerLabel: `${providerLabel.toUpperCase()} - ${subType} ${labelSuffix}`,
          type: 'embed',
          url: embedUrl,
          quality: 'auto',
          lang: 'vi',
          label: `${labelPrefix} · Embed${isNguonC ? '' : ' Backup'}`,
          episodeName: activeEp.name || String(targetEpisode),
          category: 'vi',
        };
        streams.push({ ...item, score: computeScore(item) });
      }
    });

    return streams;
  } catch (err) {
    console.error(`[${providerLabel}] Direct API query failed:`, err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export const ophimProvider: StreamProvider = {
  id: 'ophim',
  label: 'OPhim',
  lang: 'vi',
  group: 'vi',
  async fetchStreams(query: StreamQuery) {
    return fetchFromVietnameseApi('ophim', 'OPhim', query);
  },
};

export const kkphimProvider: StreamProvider = {
  id: 'kkphim',
  label: 'KKPhim',
  lang: 'vi',
  group: 'vi',
  async fetchStreams(query: StreamQuery) {
    return fetchFromVietnameseApi('kkphim', 'KKPhim', query);
  },
};

export const nguoncProvider: StreamProvider = {
  id: 'nguonc',
  label: 'NguonC',
  lang: 'vi',
  group: 'vi',
  async fetchStreams(query: StreamQuery) {
    return fetchFromVietnameseApi('nguonc', 'NguonC', query);
  },
};

async function fetchFromXem20Api(query: StreamQuery): Promise<StreamItem[]> {
  try {
    const backendUrl =
      import.meta.env.VITE_BACKEND_URL && import.meta.env.VITE_BACKEND_URL.startsWith('http')
        ? import.meta.env.VITE_BACKEND_URL
        : '';
    const proxyBase = backendUrl ? `${backendUrl}/api/xem20-proxy` : '/api/xem20-proxy';

    const targetEpisode = query.type === 'movie' ? 1 : query.episode || 1;
    
    // 1. Search
    const searchUrl = `${proxyBase}?action=search&keyword=${encodeURIComponent(query.titleVi || query.title)}`;
    const searchRes = await fetchWithTimeout(searchUrl, 3000).catch(() => null);
    if (!searchRes || !searchRes.ok) return [];
    const searchData = await searchRes.json().catch(() => ({}));
    if (!searchData || !searchData.items || searchData.items.length === 0) return [];

    const bestSlug = getBestSlugMatch(
      searchData.items, 
      query.title, 
      query.titleVi || '', 
      query.year, 
      null, 
      query.tmdbId, 
      query.imdbId,
      query.casts,
      query.season,
      query.directors,
      query.countries
    );
    if (!bestSlug) return [];

    // 2. Get episodes
    const epUrl = `${proxyBase}?action=episodes&slug=${encodeURIComponent(bestSlug)}`;
    const epRes = await fetchWithTimeout(epUrl, 3000).catch(() => null);
    if (!epRes || !epRes.ok) return [];
    const epData = await epRes.json().catch(() => ({}));
    if (!epData || !epData.episodes || epData.episodes.length === 0) return [];

    let targetEpSlug = null;
    let targetEpName = String(targetEpisode);
    
    if (query.type === 'movie') {
       targetEpSlug = epData.episodes[0].epSlug;
       targetEpName = epData.episodes[0].name;
    } else {
       const matchedEp = epData.episodes.find((ep: any) => matchEpisode(ep.name, targetEpisode));
       if (matchedEp) {
         targetEpSlug = matchedEp.epSlug;
         targetEpName = matchedEp.name;
       }
    }

    if (!targetEpSlug) return [];

    // 3. Get stream
    const streamUrl = `${proxyBase}?action=stream&epSlug=${encodeURIComponent(targetEpSlug)}`;
    const streamRes = await fetchWithTimeout(streamUrl, 4000).catch(() => null);
    if (!streamRes || !streamRes.ok) return [];
    const streamData = await streamRes.json().catch(() => ({}));
    
    if (!streamData || !streamData.m3u8Url) return [];

    const rawM3u8Url = streamData.m3u8Url;
    const url = buildProxiedM3u8Url(rawM3u8Url, 'https://xem20.net/');

    const streams: StreamItem[] = [];
    const item: Omit<StreamItem, 'score'> = {
      id: `xem20:hls:${bestSlug}:${rawM3u8Url}`,
      provider: 'xem20',
      providerLabel: `XEM20.NET - Vietsub`,
      type: 'hls',
      url,
      quality: rawM3u8Url.toLowerCase().includes('1080') ? '1080p' : 'auto',
      lang: 'vi',
      label: `XEM20.NET · HLS`,
      episodeName: targetEpName,
      category: 'vi',
    };
    streams.push({ ...item, score: computeScore(item) });

    return streams;
  } catch (_) {
    return [];
  }
}
async function fetchFromHollysheeshApi(query: StreamQuery): Promise<StreamItem[]> {
  try {
    const backendUrl =
      import.meta.env.VITE_BACKEND_URL && import.meta.env.VITE_BACKEND_URL.startsWith('http')
        ? import.meta.env.VITE_BACKEND_URL
        : '';
    const proxyBase = backendUrl ? `${backendUrl}/api/admin/scraper/streams` : '/api/admin/scraper/streams';

    const targetEpisode = query.type === 'movie' ? 1 : query.episode || 1;
    const title = query.title || '';
    const titleVi = query.titleVi || '';
    const year = query.year || 0;
    const slug = query.viSlug || '';

    const targetSeason = query.type === 'movie' ? 1 : query.season || 1;
    const tmdbId = query.tmdbId || '';
    const streamsUrl = `${proxyBase}?title=${encodeURIComponent(title)}&titleVi=${encodeURIComponent(titleVi)}&year=${year}&episode=${targetEpisode}&season=${targetSeason}&tmdbId=${encodeURIComponent(tmdbId)}&slug=${encodeURIComponent(slug)}`;
    const res = await fetchWithTimeout(streamsUrl, 4000).catch(() => null);
    if (!res || !res.ok) return [];

    const data = await res.json().catch(() => ({}));
    if (!data || !data.streams || data.streams.length === 0) return [];

    const streams: StreamItem[] = data.streams.map((s: any) => {
      const isEmbed = s.streamUrl.includes('embed') || s.streamUrl.includes('iframe') || s.streamUrl.includes('streamc.xyz');
      const type = isEmbed ? 'embed' : 'hls';
      
      let url = s.streamUrl;
      if (type === 'hls') {
        const VI_CDN_PATTERNS = ['kkphim', 'phimapi', 'phimimg', 'ophim', 'opstream', 'nguonc', 'phim.nguonc', 'xem20', 'xemphim', 'sing.phimmoi', 's3.phimmoi', 'stream.ophim'];
        const isViCDN = VI_CDN_PATTERNS.some(p => s.streamUrl.includes(p));
        if (!isViCDN && s.referer) {
          url = buildProxiedM3u8Url(s.streamUrl, s.referer);
        } else {
          url = s.streamUrl;
        }
      }

      const normServer = String(s.server).replace(/\s*#\d+/g, '');
      let subType = 'Vietsub';
      if (normServer.toLowerCase().includes('thuyết minh') || normServer.toLowerCase().includes('thuyet minh')) {
        subType = 'Thuyết minh';
      } else if (normServer.toLowerCase().includes('lồng tiếng') || normServer.toLowerCase().includes('long tieng')) {
        subType = 'Lồng tiếng';
      }

      const item: Omit<StreamItem, 'score'> = {
        id: `hollysheesh:${type}:${s.server}:${s.streamUrl}`,
        provider: 'hollysheesh',
        providerLabel: `HOLLYSHEESH - ${subType}`,
        type,
        url,
        quality: s.streamUrl.toLowerCase().includes('1080') ? '1080p' : 'auto',
        lang: 'vi',
        label: `HOLLYSHEESH · ${s.server} · ${type.toUpperCase()}`,
        episodeName: s.episode,
        category: 'vi',
        headers: s.referer ? { Referer: s.referer } : undefined,
      };
      return { ...item, score: computeScore(item) };
    });

    return streams;
  } catch (_) {
    return [];
  }
}

export const hollysheeshProvider: StreamProvider = {
  id: 'hollysheesh',
  label: 'Hollysheesh',
  lang: 'vi',
  group: 'vi',
  async fetchStreams(query: StreamQuery) {
    return fetchFromHollysheeshApi(query);
  },
};

export const xem20Provider: StreamProvider = {
  id: 'xem20',
  label: 'Xem20.Net',
  lang: 'vi',
  group: 'vi',
  async fetchStreams(query: StreamQuery) {
    return fetchFromXem20Api(query);
  },
};

export const VI_PROVIDERS: StreamProvider[] = [
  hollysheeshProvider,
  kkphimProvider,
  ophimProvider,
  nguoncProvider,
  xem20Provider,
];
