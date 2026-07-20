
import { tmdbSearchMulti, tmdbGetTrending } from './tmdbApi';
import { computeMatchScore, getStringSimilarity } from '../utils/movieMatcher';

export const fetchMultiSource = async (type: string, page: number = 1) => {
  const isNew = type === 'phim-moi-cap-nhat';
  const isCategory = type.startsWith('the-loai/') || type.startsWith('quoc-gia/');
  
  let path1 = '', path2 = '';
  if (isNew) {
    path1 = `danh-sach/phim-moi-cap-nhat?page=${page * 2 - 1}`;
    path2 = `danh-sach/phim-moi-cap-nhat?page=${page * 2}`;
  } else if (isCategory) {
    path1 = `v1/api/${type}?limit=24&page=${page * 2 - 1}`;
    path2 = `v1/api/${type}?limit=24&page=${page * 2}`;
  } else {
    // Like phim-bo, phim-le, hoat-hinh
    path1 = `v1/api/danh-sach/${type}?limit=24&page=${page * 2 - 1}`;
    path2 = `v1/api/danh-sach/${type}?limit=24&page=${page * 2}`;
  }
  
  const sources = [
    { name: 'KKPhim1', url: `https://phimapi.com/${path1}` },
    { name: 'KKPhim2', url: `https://phimapi.com/${path2}` },
    { name: 'OPhim', url: `https://ophim1.com/${path1}` }
  ];

  const results = await Promise.allSettled(sources.map(s => fetch(s.url).then(r => r.json()).then(data => ({ sourceName: s.name, data }))));
  const merged: any[] = [];
  
  results.forEach(res => {
    if (res.status === 'fulfilled' && res.value?.data) {
      const v = res.value.data;
      const pathImage = v?.pathImage || v?.data?.APP_DOMAIN_CDN_IMAGE || 'https://phimimg.com/';
      const rawItems = v?.items || v?.data?.items || [];
      
      const items = rawItems.map((item: any) => {
        let poster = typeof item?.poster_url === 'string' ? item.poster_url : '';
        let thumb = typeof item?.thumb_url === 'string' ? item.thumb_url : '';
        
        if (poster && !poster.startsWith('http')) {
          poster = pathImage.endsWith('/') ? `${pathImage}${poster}` : `${pathImage}/${poster}`;
        }
        if (thumb && !thumb.startsWith('http')) {
          thumb = pathImage.endsWith('/') ? `${pathImage}${thumb}` : `${pathImage}/${thumb}`;
        }
        return { ...item, poster_url: poster, thumb_url: thumb };
      });

      merged.push(...items);
    }
  });

  const unique = new Map();
  const seenKeys = new Set<string>();

  merged.forEach(item => {
    const slug = typeof item?.slug === 'string' ? item.slug : '';
    if (!slug) return;

    const normOrigin = typeof item.origin_name === 'string' ? item.origin_name.toLowerCase().replace(/[^a-z0-9]/g, '').trim() : '';
    const normName = typeof item.name === 'string' ? item.name.toLowerCase().replace(/[^a-z0-9]/g, '').trim() : '';
    const year = item.year || '';

    const originKey = normOrigin && normOrigin.length > 2 ? `origin_${normOrigin}_${year}` : '';
    const nameKey = normName && normName.length > 2 ? `name_${normName}_${year}` : '';

    if (unique.has(slug)) return;
    if (originKey && seenKeys.has(originKey)) return;
    if (nameKey && seenKeys.has(nameKey)) return;

    unique.set(slug, item);
    if (originKey) seenKeys.add(originKey);
    if (nameKey) seenKeys.add(nameKey);
  });

  return Array.from(unique.values());
};

const isForeignWord = (word: string): boolean => {
  const cleanWord = word.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
  if (!cleanWord) return false;
  
  if (/[fjwz]/.test(cleanWord)) return true;
  
  const last = cleanWord[cleanWord.length - 1];
  if (/[a-z]/.test(last) && !/[aeiouy]/.test(last)) {
    const lastTwo = cleanWord.slice(-2);
    if (!['c', 'm', 'n', 'p', 't'].includes(last) && lastTwo !== 'ch' && lastTwo !== 'ng' && lastTwo !== 'nh') {
      return true;
    }
  }

  if (/[bcdfghjklmnpqrstvwxyz]{3,}/.test(cleanWord)) return true;
  if (/[aeiou]{3,}/.test(cleanWord)) return true;
  if (/(?<!t)r(?![aeiouyđ])|[blcfgs][rl]|[rtldp]s|st|mp|nk|nd|ld|lt/i.test(cleanWord)) return true;
  
  return false;
};

const STOP_WORDS = new Set([
  'cua', 'va', 'cac', 'nhung', 'phim', 'bo', 'le', 'tap', 'hoat', 'hinh', 
  'anime', 'vietsub', 'thuyet', 'minh', 'long', 'tieng', 'ban', 'dep', 
  'hd', 'full', 'raw', 'viet', 'sub', 'tron', 'bo', 'chieu', 'rap'
]);

const cleanVietnameseTones = (str: string): string => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
};

export const fetchSearch = async (keyword: string) => {
  if (!keyword) return [];
  const encodedKw = encodeURIComponent(keyword);
  const sources = [
    { name: 'KKPhim', url: `https://phimapi.com/v1/api/tim-kiem?keyword=${encodedKw}&limit=30` },
    { name: 'OPhim', url: `https://ophim1.com/v1/api/tim-kiem?keyword=${encodedKw}&limit=30` }
  ];

  const tmdbPromise = tmdbSearchMulti(keyword)
    .then(async (data) => {
      if (data && data.results && data.results.length > 0) {
        return data;
      }

      const words = keyword.split(/\s+/);
      if (words.length <= 1) return data;

      const foreignWords: string[] = [];
      const vietnameseWords: string[] = [];

      words.forEach(word => {
        const cleanWord = word.replace(/[^\p{L}\p{N}]/gu, '');
        if (!cleanWord) return;

        if (isForeignWord(cleanWord)) {
          if (!STOP_WORDS.has(cleanVietnameseTones(cleanWord).toLowerCase())) {
            foreignWords.push(cleanWord);
          }
        } else {
          const normalized = cleanVietnameseTones(cleanWord).toLowerCase();
          if (!STOP_WORDS.has(normalized) && cleanWord.length >= 3) {
            vietnameseWords.push(cleanWord);
          }
        }
      });

      const fallbacks: string[] = [];

      const combined = [...vietnameseWords, ...foreignWords].join(' ');
      if (combined && combined.toLowerCase() !== keyword.toLowerCase()) {
        fallbacks.push(combined);
      }

      if (vietnameseWords.length > 2) {
        const subsetCombined = [...vietnameseWords.slice(0, 2), ...foreignWords].join(' ');
        fallbacks.push(subsetCombined);
      }

      if (foreignWords.length > 0) {
        fallbacks.push(foreignWords.join(' '));
      }

      if (vietnameseWords.length > 0) {
        fallbacks.push(vietnameseWords.slice(0, 2).join(' '));
      }

      for (const q of fallbacks) {
        try {
          const res = await tmdbSearchMulti(q);
          if (res && res.results && res.results.length > 0) {
            console.log(`[TMDB Fallback] Succeeded for "${q}" (original: "${keyword}")`);
            return res;
          }
        } catch (e) {
          // ignore
        }
      }

      return data;
    })
    .catch(err => {
      console.warn("TMDB search in fetchSearch failed:", err);
      return { results: [] };
    });

  const [localResults, tmdbResults] = await Promise.all([
    Promise.allSettled(
      sources.map(s => 
        fetchWithTimeout(s.url, {}, 5000)
          .then(r => r.json())
          .then(data => ({ sourceName: s.name, data }))
      )
    ),
    tmdbPromise
  ]);

  const merged: any[] = [];
  
  localResults.forEach(res => {
    if (res.status === 'fulfilled') {
      const v = res.value.data;
      const pathImage = v?.data?.APP_DOMAIN_CDN_IMAGE || v?.pathImage || 'https://phimimg.com/';
      const rawItems = v?.data?.items || v?.items || [];
      rawItems.forEach((item: any) => {
        let poster = typeof item.poster_url === 'string' ? item.poster_url : '';
        let thumb = typeof item.thumb_url === 'string' ? item.thumb_url : '';
        if (poster && !poster.startsWith('http')) poster = pathImage.endsWith('/') ? `${pathImage}${poster}` : `${pathImage}/${poster}`;
        if (thumb && !thumb.startsWith('http')) thumb = pathImage.endsWith('/') ? `${pathImage}${thumb}` : `${pathImage}/${thumb}`;
        merged.push({ ...item, poster_url: poster, thumb_url: thumb });
      });
    }
  });

  const unique = new Map<string, any>();
  const seenKeys = new Set<string>();

  merged.forEach(item => {
    const rawTmdbId = item.tmdb_id || item.tmdb?.id;
    const tmdbId = (rawTmdbId && rawTmdbId !== 0 && rawTmdbId !== '0' && rawTmdbId !== 'undefined' && rawTmdbId !== 'null') ? String(rawTmdbId).trim() : '';

    if (tmdbId) {
      let isTv = item.type === 'series' || item.type === 'tvshows';
      if (item.tmdb?.type === 'movie' || item.tmdb?.media_type === 'movie') {
        isTv = false;
      } else if (item.tmdb?.type === 'tv' || item.tmdb?.media_type === 'tv') {
        isTv = true;
      } else if (item.type === 'hoathinh') {
        isTv = true;
      }
      const key = `tmdb_${tmdbId}`;
      item.originalSlug = item.slug;
      item.slug = `tmdb-${tmdbId}-${isTv ? 'tv' : 'movie'}`;

      const existing = unique.get(key);
      if (!existing) {
        unique.set(key, item);
      } else {
        const existingYear = parseInt(existing.year) || 0;
        const currentYear = parseInt(item.year) || 0;
        if (currentYear > existingYear) {
          unique.set(key, item);
        }
      }
    } else {
      const slug = typeof item?.slug === 'string' ? item.slug : '';
      if (!slug) return;

      const normOrigin = typeof item.origin_name === 'string' ? item.origin_name.toLowerCase().replace(/[^a-z0-9]/g, '').trim() : '';
      const normName = typeof item.name === 'string' ? item.name.toLowerCase().replace(/[^a-z0-9]/g, '').trim() : '';
      const year = item.year || '';

      const originKey = normOrigin && normOrigin.length > 2 ? `origin_${normOrigin}_${year}` : '';
      const nameKey = normName && normName.length > 2 ? `name_${normName}_${year}` : '';

      if (unique.has(slug)) return;
      if (originKey && seenKeys.has(originKey)) return;
      if (nameKey && seenKeys.has(nameKey)) return;

      unique.set(slug, item);
      if (originKey) seenKeys.add(originKey);
      if (nameKey) seenKeys.add(nameKey);
    }
  });

  const addTmdbItem = (tmdbItem: any, isActorMatch = false) => {
    const tmdbId = String(tmdbItem.id);
    const key = `tmdb_${tmdbId}`;

    // If already added by local database (since we mapped it above)
    if (unique.has(key)) {
      const existing = unique.get(key);
      if (isActorMatch) {
        existing.isActorMatch = true;
      }
      if (tmdbItem.popularity) {
        existing.popularity = tmdbItem.popularity;
      }
      return;
    }

    const title = tmdbItem.title || tmdbItem.name;
    const originalTitle = tmdbItem.original_title || tmdbItem.original_name || '';
    const year = String(parseInt((tmdbItem.release_date || tmdbItem.first_air_date || '').substring(0, 4)) || '');

    const normOrigin = originalTitle.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    const normName = title.toLowerCase().replace(/[^a-z0-9]/g, '').trim();

    const originKey = normOrigin && normOrigin.length > 2 ? `origin_${normOrigin}_${year}` : '';
    const nameKey = normName && normName.length > 2 ? `name_${normName}_${year}` : '';

    // Prevent duplicates by title/original title and year
    if (originKey && seenKeys.has(originKey)) return;
    if (nameKey && seenKeys.has(nameKey)) return;

    const posterUrl = tmdbItem.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbItem.poster_path}` : '';
    const thumbUrl = tmdbItem.backdrop_path ? `https://image.tmdb.org/t/p/w780${tmdbItem.backdrop_path}` : '';

    const item: any = {
      name: title,
      origin_name: originalTitle,
      slug: `tmdb-${tmdbId}-${tmdbItem.media_type || (tmdbItem.release_date ? 'movie' : 'tv')}`,
      type: (tmdbItem.media_type === 'tv' || tmdbItem.first_air_date) ? 'series' : 'single',
      poster_url: posterUrl,
      thumb_url: thumbUrl,
      year: year,
      tmdb_id: tmdbItem.id,
      popularity: tmdbItem.popularity || 0,
      isTmdbOnly: true, // Mark as virtual TMDB-only item
      isActorMatch,
      tmdb: {
        id: tmdbItem.id,
        media_type: tmdbItem.media_type || (tmdbItem.release_date ? 'movie' : 'tv')
      }
    };

    unique.set(key, item);
    if (originKey) seenKeys.add(originKey);
    if (nameKey) seenKeys.add(nameKey);
  };

  // Merge TMDB results
  if (tmdbResults && Array.isArray(tmdbResults.results)) {
    tmdbResults.results.forEach((tmdbItem: any) => {
      if (tmdbItem.media_type === 'person' && Array.isArray(tmdbItem.known_for)) {
        tmdbItem.known_for.forEach((knownItem: any) => {
          if (knownItem.media_type === 'movie' || knownItem.media_type === 'tv') {
            addTmdbItem(knownItem, true);
          }
        });
      } else if (tmdbItem.media_type === 'movie' || tmdbItem.media_type === 'tv') {
        addTmdbItem(tmdbItem, false);
      }
    });
  }

  const keywordCleaned = keyword.toLowerCase().trim();
  const maxPopularity = Math.max(...Array.from(unique.values()).map((item: any) => item.popularity || 0), 1);

  const results = Array.from(unique.values()).map((item: any) => {
    const poster = typeof item.poster_url === 'string' ? item.poster_url : '';
    const thumb = typeof item.thumb_url === 'string' ? item.thumb_url : '';
    
    // Compute similarity score
    const simName = getStringSimilarity(keywordCleaned, item.name || '');
    const simOrigin = getStringSimilarity(keywordCleaned, item.origin_name || '');
    let maxSim = Math.max(simName, simOrigin);
    
    if (item.isActorMatch) {
      maxSim = Math.max(maxSim, 0.8); // Baseline score for direct actor matches
    }

    const normPopularity = (item.popularity || 0) / maxPopularity;
    
    // Combined score: 80% similarity, 20% popularity
    // Reduce popularity impact heavily if there's no name similarity at all to prevent unrelated spam
    const relevanceWeight = maxSim < 0.15 ? 0.05 : 0.2;
    const combinedScore = (maxSim * 0.8) + (normPopularity * relevanceWeight);

    return {
      ...item,
      poster_url: poster.startsWith('http') ? poster : `https://phimimg.com/${poster}`,
      thumb_url: thumb.startsWith('http') ? thumb : `https://phimimg.com/${thumb}`,
      _similarity: maxSim,
      _popularity: item.popularity || 0,
      _combinedScore: combinedScore
    };
  });

  // Sort by combined score descending
  results.sort((a, b) => b._combinedScore - a._combinedScore);

  return results;
};

export const fetchTrendingMovies = async () => {
  try {
    const data = await tmdbGetTrending('all', 'day');
    if (data && Array.isArray(data.results)) {
      return data.results
        .filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv')
        .map((item: any) => {
          const title = item.title || item.name;
          const originalTitle = item.original_title || item.original_name || '';
          const year = String(parseInt((item.release_date || item.first_air_date || '').substring(0, 4)) || '');
          const posterUrl = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '';
          const thumbUrl = item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : '';
          return {
            name: title,
            origin_name: originalTitle,
            slug: `tmdb-${item.id}-${item.media_type}`,
            type: item.media_type === 'tv' ? 'series' : 'single',
            poster_url: posterUrl,
            thumb_url: thumbUrl,
            year: year,
            tmdb_id: item.id,
            isTmdbOnly: true,
            tmdb: {
              id: item.id,
              media_type: item.media_type
            }
          };
        });
    }
  } catch (err) {
    console.error("fetchTrendingMovies failed:", err);
  }
  return [];
};

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 15000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

const findAlternativeSlug = async (
  sourceName: string,
  title: string,
  originTitle: string,
  year: number,
  tmdbId?: string | number,
  imdbId?: string,
  casts?: string[]
) => {
  try {
    let searchUrl = '';
    const keyword = originTitle || title;
    if (!keyword) return null;
    const encodedKw = encodeURIComponent(keyword);

    if (sourceName === 'OPhim') {
      searchUrl = `https://ophim1.com/v1/api/tim-kiem?keyword=${encodedKw}&limit=10`;
    } else if (sourceName === 'NguonC') {
      searchUrl = `https://phim.nguonc.com/api/films/search?keyword=${encodedKw}`;
    } else {
      searchUrl = `https://phimapi.com/v1/api/tim-kiem?keyword=${encodedKw}&limit=10`;
    }

    const res = await fetchWithTimeout(searchUrl, {}, 2500);
    const v = await res.json();
    
    let items: any[] = [];
    items = v?.data?.items || v?.items || [];

    if (!items || items.length === 0) return null;

    // Score the items to find the best match using the unified computeMatchScore
    const scored = items.map((item: any) => {
      const score = computeMatchScore(item, {
        title,
        original_title: originTitle,
        year,
        id: tmdbId,
        imdb_id: imdbId,
        casts
      });
      return { slug: item.slug, score };
    });

    scored.sort((a, b) => b.score - a.score);
    if (scored[0] && scored[0].score >= 40) {
      return scored[0].slug;
    }
  } catch (e) {
    console.warn(`Error searching alternative slug for ${sourceName}:`, e);
  }
  return null;
};

export const fetchDetail = async (slug: string) => {
  const sources = [
    { name: 'OPhim', url: `https://ophim1.com/phim/${slug}` },
    { name: 'KKPhim', url: `https://phimapi.com/phim/${slug}` },
    { name: 'NguonC', url: `https://phim.nguonc.com/api/film/${slug}` }
  ];
  
  const results = await Promise.allSettled(
    sources.map(s => 
      fetchWithTimeout(s.url, {}, 3000)
        .then(r => r.json())
        .then(data => ({ sourceName: s.name, data }))
    )
  );
  
  let baseMovie: any = null;
  const serverResultsMap: Record<string, any> = {};
  
  results.forEach(res => {
    const sourceName = (res as any).value?.sourceName || ['OPhim', 'KKPhim', 'NguonC'][results.indexOf(res)];
    if (res.status === 'fulfilled' && res.value?.data) {
      const v = res.value.data;
      const movieObj = v.movie || v.film || v.data?.item;
      const isMovieValid = movieObj && typeof movieObj === 'object' && !Array.isArray(movieObj) && Object.keys(movieObj).length > 0;
      if (isMovieValid) {
        if (!baseMovie) {
          baseMovie = movieObj;
        }
        serverResultsMap[sourceName] = { success: true, data: v };
        return;
      }
    }
    serverResultsMap[sourceName] = { success: false };
  });

  // If no source succeeded, throw not found
  if (!baseMovie) throw new Error("Not found");

  // Normalize origin_name for NguonC base movies
  baseMovie.origin_name = baseMovie.origin_name || baseMovie.original_name || '';

  // Extract metadata fields to pass for advanced matching
  const tmdbId = baseMovie.tmdb?.id || '';
  const imdbId = baseMovie.imdb?.id || '';
  
  // Cast list
  let casts: string[] = [];
  if (baseMovie.actor) {
    if (Array.isArray(baseMovie.actor)) {
      casts = baseMovie.actor.map(a => typeof a === 'string' ? a : (a.name || ''));
    } else if (typeof baseMovie.actor === 'string') {
      casts = baseMovie.actor.split(',').map(s => s.trim());
    }
  }

  // For failed sources, try searching for alternative slugs in parallel
  const title = baseMovie.name || "";
  const originTitle = baseMovie.origin_name || "";
  const year = parseInt(baseMovie.year) || 0;

  const fallbackFetches = Object.keys(serverResultsMap).map(async (sourceName) => {
    const statusObj = serverResultsMap[sourceName];
    if (statusObj.success) return; // already succeeded

    // Try finding alternative slug with ID and cast matching
    const altSlug = await findAlternativeSlug(sourceName, title, originTitle, year, tmdbId, imdbId, casts);
    if (altSlug) {
      try {
        let altUrl = '';
        if (sourceName === 'OPhim') altUrl = `https://ophim1.com/phim/${altSlug}`;
        else if (sourceName === 'NguonC') altUrl = `https://phim.nguonc.com/api/film/${altSlug}`;
        else if (sourceName === 'KKPhim') altUrl = `https://phimapi.com/phim/${altSlug}`;

        const res = await fetchWithTimeout(altUrl, {}, 2500);
        const data = await res.json();
        const movieObj = data.movie || data.film || data.data?.item;
        if ((data.status === true || data.status === "success" || movieObj) && movieObj) {
          serverResultsMap[sourceName] = { success: true, data };
          console.log(`Successfully resolved alternative slug for ${sourceName}: ${altSlug}`);
        }
      } catch (e) {
        console.warn(`Failed to fetch alternative slug details for ${sourceName}:`, e);
      }
    }
  });

  // Wait for all fallback fetches to complete
  await Promise.all(fallbackFetches);

  // Now, assemble allEpisodes
  const allEpisodes: any[] = [];
  sources.forEach(s => {
    const statusObj = serverResultsMap[s.name];
    if (statusObj.success && statusObj.data) {
      const v = statusObj.data;
      let eps = v.episodes || v.items || v.movie?.episodes || v.data?.item?.episodes;
      if (s.name === 'NguonC') {
        eps = v.movie?.episodes || v.episodes || [];
      }
      if (Array.isArray(eps) && eps.length > 0) {
        eps.forEach((ep: any) => {
          let server_data = ep.server_data;
          if (s.name === 'NguonC' && ep.items) {
            server_data = ep.items.map((item: any) => ({
              name: item.name,
              slug: item.slug,
              filename: item.filename || `Tập ${item.name}`,
              link_embed: item.embed || item.link_embed || '',
              link_m3u8: item.m3u8 || item.link_m3u8 || '',
            }));
          }
          const cleanServerName = (ep.server_name || 'VIP').replace(/\s*#\d+/g, '');
          allEpisodes.push({
            server_name: `${s.name} - ${cleanServerName}`,
            server_data: server_data,
            status: 'ok'
          });
        });
      } else {
        allEpisodes.push({
          server_name: s.name,
          server_data: [],
          status: 'empty'
        });
      }
    } else {
      allEpisodes.push({
        server_name: s.name,
        server_data: [],
        status: 'error'
      });
    }
  });

  return { movie: baseMovie, episodes: allEpisodes };
};
