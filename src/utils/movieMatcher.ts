export const cleanString = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove Vietnamese diacritics
    .replace(/[^a-z0-9]/g, ' ') // replace non-alphanumeric with spaces
    .replace(/\s+/g, ' ') // compact multiple spaces
    .trim();
};

export const stripSeasonAndSuffixes = (str: string): string => {
  const cleaned = cleanString(str);
  return cleaned
    .replace(/\b(season|ss|phan|tap|volume|vol|part)\s*\d+\b/g, '')
    .replace(/\b(movie|vietsub|thuyet minh|long tieng|htv|vtv|full|uncut|ban dep)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export const resolvedSlugCache = new Map<string, string>();

export const getResolvedSlug = (originalId: string): string | undefined => {
  if (!originalId) return undefined;
  return resolvedSlugCache.get(originalId);
};

export const setResolvedSlug = (originalId: string, resolvedSlug: string) => {
  if (!originalId || !resolvedSlug) return;
  resolvedSlugCache.set(originalId, resolvedSlug);
};

export const getWordIntersectionRatio = (str1: string, str2: string): number => {
  const words1 = cleanString(str1).split(' ').filter(Boolean);
  const words2 = cleanString(str2).split(' ').filter(Boolean);
  if (words1.length === 0 || words2.length === 0) return 0;
  const set1 = new Set(words1);
  const intersect = words2.filter(w => set1.has(w));
  return intersect.length / Math.min(words1.length, words2.length);
};

export const computeMatchScore = (
  item: any,
  tmdb: { original_title: string; title: string; year: number; type?: 'movie' | 'tv' }
) => {
  let score = 0;
  
  const itemCleanedOrigin = stripSeasonAndSuffixes(item.origin_name || item.original_name || '');
  const tmdbCleanedOrigin = stripSeasonAndSuffixes(tmdb.original_title || '');
  
  const itemCleanedName = stripSeasonAndSuffixes(item.name || '');
  const tmdbCleanedName = stripSeasonAndSuffixes(tmdb.title || '');

  // 1. Original title match (highest weight)
  if (itemCleanedOrigin === tmdbCleanedOrigin && tmdbCleanedOrigin !== '') {
    score += 100;
  } else if (itemCleanedOrigin && tmdbCleanedOrigin && (itemCleanedOrigin.startsWith(tmdbCleanedOrigin) || tmdbCleanedOrigin.startsWith(itemCleanedOrigin))) {
    score += 40;
  } else if (itemCleanedOrigin && tmdbCleanedOrigin && (itemCleanedOrigin.includes(tmdbCleanedOrigin) || tmdbCleanedOrigin.includes(itemCleanedOrigin))) {
    score += 20;
  }

  // 2. Localized/Vietnamese title match
  if (itemCleanedName === tmdbCleanedName && tmdbCleanedName !== '') {
    score += 80;
  } else if (itemCleanedName && tmdbCleanedName && (itemCleanedName.startsWith(tmdbCleanedName) || tmdbCleanedName.startsWith(itemCleanedName))) {
    score += 30;
  } else if (itemCleanedName && tmdbCleanedName && (itemCleanedName.includes(tmdbCleanedName) || tmdbCleanedName.includes(itemCleanedName))) {
    score += 10;
  }

  // Swap check (if fields are swapped in API results)
  if (itemCleanedName === tmdbCleanedOrigin && tmdbCleanedOrigin !== '') {
    score += 70;
  }
  if (itemCleanedOrigin === tmdbCleanedName && tmdbCleanedName !== '') {
    score += 70;
  }

  // Word intersection bonus (handles suffix variations gracefully)
  const nameIntersection = getWordIntersectionRatio(item.name || '', tmdb.title || '');
  if (nameIntersection >= 0.75) {
    score += 50;
  }
  const originIntersection = getWordIntersectionRatio(item.origin_name || item.original_name || '', tmdb.original_title || '');
  if (originIntersection >= 0.75 && tmdb.original_title) {
    score += 50;
  }

  // 3. Year match
  const itemYear = parseInt(item.year);
  if (itemYear && tmdb.year) {
    const diff = Math.abs(itemYear - tmdb.year);
    if (diff === 0) {
      score += 40;
    } else if (diff === 1) {
      score += 25;
    } else if (diff === 2) {
      score += 15;
    } else if (diff === 3) {
      score += 5;
    }
  }

  // 4. Type match
  if (tmdb.type && item.type) {
    const isItemMovie = item.type === 'single' || item.type === 'phimle' || item.type === 'movie';
    const isItemTv = item.type === 'series' || item.type === 'phimbo' || item.type === 'tvshows' || item.type === 'hoathinh';
    
    if (tmdb.type === 'movie' && isItemMovie) {
      score += 60;
    } else if (tmdb.type === 'tv' && isItemTv) {
      score += 60;
    } else {
      score -= 50; // Penalty for wrong type
    }
  }

  return score;
};
