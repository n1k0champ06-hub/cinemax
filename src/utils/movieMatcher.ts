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

const getNonNumericWords = (str: string): string[] => {
  return cleanString(str)
    .split(' ')
    .filter(Boolean)
    .filter(w => !/^\d+$/.test(w));
};

export const getWordIntersectionRatio = (str1: string, str2: string): number => {
  const words1 = getNonNumericWords(str1);
  const words2 = getNonNumericWords(str2);
  if (words1.length === 0 || words2.length === 0) return 0;
  const set1 = new Set(words1);
  const intersect = words2.filter(w => set1.has(w));
  return intersect.length / Math.min(words1.length, words2.length);
};

const isTooShortOrNumericForPartial = (s: string) => {
  return s.length < 3 || /^\d+$/.test(s);
};

export const computeMatchScore = (
  item: any,
  tmdb: { original_title: string; title: string; year: number; type?: 'movie' | 'tv' }
) => {
  const itemCleanedOrigin = stripSeasonAndSuffixes(item.origin_name || item.original_name || '');
  const tmdbCleanedOrigin = stripSeasonAndSuffixes(tmdb.original_title || '');
  
  const itemCleanedName = stripSeasonAndSuffixes(item.name || '');
  const tmdbCleanedName = stripSeasonAndSuffixes(tmdb.title || '');

  const ratio = getWordIntersectionRatio(item.name || '', tmdb.title || '');
  const ratioOrigin = getWordIntersectionRatio(item.origin_name || item.original_name || '', tmdb.original_title || '');

  // Strict title matching requirement: must share at least one basic title similarity indicator
  const hasTitleMatch = 
    (itemCleanedOrigin === tmdbCleanedOrigin && tmdbCleanedOrigin !== '') ||
    (itemCleanedName === tmdbCleanedName && tmdbCleanedName !== '') ||
    (itemCleanedName === tmdbCleanedOrigin && tmdbCleanedOrigin !== '') ||
    (itemCleanedOrigin === tmdbCleanedName && tmdbCleanedName !== '') ||
    (ratio >= 0.75) ||
    (ratioOrigin >= 0.75 && tmdb.original_title) ||
    (itemCleanedOrigin && tmdbCleanedOrigin && !isTooShortOrNumericForPartial(itemCleanedOrigin) && !isTooShortOrNumericForPartial(tmdbCleanedOrigin) && (itemCleanedOrigin.includes(tmdbCleanedOrigin) || tmdbCleanedOrigin.includes(itemCleanedOrigin))) ||
    (itemCleanedName && tmdbCleanedName && !isTooShortOrNumericForPartial(itemCleanedName) && !isTooShortOrNumericForPartial(tmdbCleanedName) && (itemCleanedName.includes(tmdbCleanedName) || tmdbCleanedName.includes(itemCleanedName)));

  if (!hasTitleMatch) {
    return 0; // Return 0 immediately if there is absolutely no title resemblance
  }

  let score = 0;
  
  // 1. Original title match (highest weight)
  if (itemCleanedOrigin === tmdbCleanedOrigin && tmdbCleanedOrigin !== '') {
    score += 100;
  } else if (itemCleanedOrigin && tmdbCleanedOrigin && !isTooShortOrNumericForPartial(itemCleanedOrigin) && !isTooShortOrNumericForPartial(tmdbCleanedOrigin)) {
    if (itemCleanedOrigin.startsWith(tmdbCleanedOrigin) || tmdbCleanedOrigin.startsWith(itemCleanedOrigin)) {
      score += 40;
    } else if (itemCleanedOrigin.includes(tmdbCleanedOrigin) || tmdbCleanedOrigin.includes(itemCleanedOrigin)) {
      score += 20;
    }
  }

  // 2. Localized/Vietnamese title match
  if (itemCleanedName === tmdbCleanedName && tmdbCleanedName !== '') {
    score += 80;
  } else if (itemCleanedName && tmdbCleanedName && !isTooShortOrNumericForPartial(itemCleanedName) && !isTooShortOrNumericForPartial(tmdbCleanedName)) {
    if (itemCleanedName.startsWith(tmdbCleanedName) || tmdbCleanedName.startsWith(itemCleanedName)) {
      score += 30;
    } else if (itemCleanedName.includes(tmdbCleanedName) || tmdbCleanedName.includes(itemCleanedName)) {
      score += 10;
    }
  }

  // Swap check (if fields are swapped in API results)
  if (itemCleanedName === tmdbCleanedOrigin && tmdbCleanedOrigin !== '') {
    score += 70;
  }
  if (itemCleanedOrigin === tmdbCleanedName && tmdbCleanedName !== '') {
    score += 70;
  }

  // Word intersection bonus
  if (ratio >= 0.75) {
    score += 50;
  }
  if (ratioOrigin >= 0.75 && tmdb.original_title) {
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
