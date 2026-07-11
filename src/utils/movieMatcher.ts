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

const containsWholePhrase = (container: string, phrase: string): boolean => {
  if (!container || !phrase) return false;
  const cWords = container.split(' ').filter(Boolean);
  const pWords = phrase.split(' ').filter(Boolean);
  if (pWords.length === 0) return false;
  if (pWords.length > cWords.length) return false;

  for (let i = 0; i <= cWords.length - pWords.length; i++) {
    let match = true;
    for (let j = 0; j < pWords.length; j++) {
      if (cWords[i + j] !== pWords[j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
};

export const computeMatchScore = (
  item: any,
  tmdb: { 
    original_title: string; 
    title: string; 
    year: number; 
    type?: 'movie' | 'tv';
    id?: string | number;
    imdb_id?: string;
    casts?: string[];
  }
) => {
  // 0. Strict ID Match
  if (tmdb.id || tmdb.imdb_id) {
    const qTmdb = tmdb.id ? String(tmdb.id) : null;
    const qImdb = tmdb.imdb_id ? String(tmdb.imdb_id) : null;
    
    const itemTmdb = item.tmdb && item.tmdb.id ? String(item.tmdb.id) : null;
    const itemImdb = item.imdb && item.imdb.id ? String(item.imdb.id) : null;

    if (qTmdb && itemTmdb && qTmdb === itemTmdb) {
      return 500; // instant match
    }
    if (qImdb && itemImdb && qImdb === itemImdb) {
      return 500; // instant match
    }
  }

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
    (itemCleanedOrigin && tmdbCleanedOrigin && !isTooShortOrNumericForPartial(itemCleanedOrigin) && !isTooShortOrNumericForPartial(tmdbCleanedOrigin) && (containsWholePhrase(itemCleanedOrigin, tmdbCleanedOrigin) || containsWholePhrase(tmdbCleanedOrigin, itemCleanedOrigin))) ||
    (itemCleanedName && tmdbCleanedName && !isTooShortOrNumericForPartial(itemCleanedName) && !isTooShortOrNumericForPartial(tmdbCleanedName) && (containsWholePhrase(itemCleanedName, tmdbCleanedName) || containsWholePhrase(tmdbCleanedName, itemCleanedName)));

  if (!hasTitleMatch) {
    return 0; // Return 0 immediately if there is absolutely no title resemblance
  }

  let score = 0;
  
  // 1. Original title match (highest weight)
  if (itemCleanedOrigin === tmdbCleanedOrigin && tmdbCleanedOrigin !== '') {
    score += 100;
  } else if (itemCleanedOrigin && tmdbCleanedOrigin && !isTooShortOrNumericForPartial(itemCleanedOrigin) && !isTooShortOrNumericForPartial(tmdbCleanedOrigin)) {
    if (containsWholePhrase(itemCleanedOrigin, tmdbCleanedOrigin) || containsWholePhrase(tmdbCleanedOrigin, itemCleanedOrigin)) {
      score += 30;
    }
  }

  // 2. Localized/Vietnamese title match
  if (itemCleanedName === tmdbCleanedName && tmdbCleanedName !== '') {
    score += 80;
  } else if (itemCleanedName && tmdbCleanedName && !isTooShortOrNumericForPartial(itemCleanedName) && !isTooShortOrNumericForPartial(tmdbCleanedName)) {
    if (containsWholePhrase(itemCleanedName, tmdbCleanedName) || containsWholePhrase(tmdbCleanedName, itemCleanedName)) {
      score += 20;
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

  // 3. Year match / mismatch
  const itemYear = parseInt(item.year);
  if (itemYear && tmdb.year) {
    const diff = Math.abs(itemYear - tmdb.year);
    if (diff === 0) {
      score += 40;
    } else if (diff === 1) {
      score += 25;
    } else if (diff === 2) {
      score -= 50; // Moderate penalty for year difference of 2
    } else {
      score -= 150; // Severe penalty for year difference >= 3
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
      score -= 80; // Penalty for wrong type
    }
  }

  // 5. Cast overlap bonus
  if (tmdb.casts && tmdb.casts.length > 0) {
    const itemCasts = typeof item.casts === 'string' ? item.casts.toLowerCase() : 
                      (Array.isArray(item.casts) ? item.casts.join(',').toLowerCase() : 
                      (typeof item.actor === 'string' ? item.actor.toLowerCase() : 
                      (Array.isArray(item.actor) ? item.actor.join(',').toLowerCase() : '')));
    
    if (itemCasts) {
      let overlap = 0;
      for (const qc of tmdb.casts) {
        if (qc && itemCasts.includes(qc.toLowerCase())) {
          overlap++;
        }
      }
      if (overlap > 0) {
        score += (overlap * 15);
      }
    }
  }

  return score;
};

export const getStringSimilarity = (str1: string, str2: string): number => {
  const s1 = cleanString(str1);
  const s2 = cleanString(str2);
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  if (s1.length < 2 || s2.length < 2) {
    return s1.includes(s2) || s2.includes(s1) ? 0.5 : 0.0;
  }

  const getBigrams = (str: string) => {
    const bigrams: string[] = [];
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.push(str.substring(i, i + 2));
    }
    return bigrams;
  };

  const b1 = getBigrams(s1);
  const b2 = getBigrams(s2);
  
  let matchCount = 0;
  const visited = new Array(b2.length).fill(false);

  for (let i = 0; i < b1.length; i++) {
    for (let j = 0; j < b2.length; j++) {
      if (!visited[j] && b1[i] === b2[j]) {
        matchCount++;
        visited[j] = true;
        break;
      }
    }
  }

  return (2.0 * matchCount) / (b1.length + b2.length);
};


