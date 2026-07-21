import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { fetchDetail, fetchSearch } from "../../api/phimApi";
import { useMyList } from "../useStorage";
import { useTmdbDetails, useTmdbSearch, useTmdbTvSeason } from "../useTmdb";
import { computeMatchScore } from "../../utils/movieMatcher";

const cleanSearchQuery = (str: string): string => {
  if (!str) return "";
  return str
    .replace(/\s*[\(\[].*?[\)\]]/g, "") // remove brackets/parentheses contents
    .replace(/\b(vietsub|thuyet minh|long tieng|longtieng|thuyetminh|vtv\d|htv\d|vtv|htv|subviet|sub|raw|cam|hd|full|fhd|sd|ultrahd|4k|ban dep|ban thuyet minh|longtieng vietsub|full vietsub)\b/gi, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const cleanString = (str: string): string => {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

const cleanTitleForSeasonSearch = (title: string | undefined | null): string => {
  if (!title) return "";
  return String(title)
    .replace(/\s*[\(\[]?(Phần|Season|Mùa|SS|Part|Vol|Tập|Ep)\s*\d+[\)\]]?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
};

export const useMovieDetail = (rawSlug: string) => {
  const queryClient = useQueryClient();

  const slug = rawSlug.replace(/^resolved-/, '');
  const isTmdbSlug = slug.startsWith('tmdb-');
  const isAnilistSlug = slug.startsWith('anilist-');
  const slugParts = (isTmdbSlug || isAnilistSlug) ? slug.split('-') : [];
  const slugTmdbId = isTmdbSlug ? slugParts[1] : null;
  const slugAnilistId = isAnilistSlug ? slugParts[1] : null;
  const slugAnilistMediaType = isAnilistSlug ? (slugParts[2] || 'tv') : undefined;
  const slugMediaType = isTmdbSlug ? (slugParts[2] || 'movie') : undefined;

  // 1. If starts with anilist-slug, load AniList details first to get the title
  const { data: anilistDetailData, isLoading: anilistDetailLoading } = useQuery({
    queryKey: ["anilistDetail", slugAnilistId],
    queryFn: async () => {
      if (!slugAnilistId) return null;
      const { fetchAnimeDetailsClient } = await import('../../api/anilistApi');
      const data = await fetchAnimeDetailsClient(slugAnilistId);
      if (!data) {
        throw new Error(`Failed to fetch anime details`);
      }
      return data;
    },
    enabled: !!isAnilistSlug && !!slugAnilistId,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const englishQuery = useMemo(() => {
    if (isAnilistSlug) {
      return cleanSearchQuery(anilistDetailData?.title || "");
    }
    return "";
  }, [isAnilistSlug, anilistDetailData?.title]);

  // 2. Resolve TMDB ID
  const tmdbRawId = isAnilistSlug ? null : slugTmdbId;
  const tmdbId = (tmdbRawId && tmdbRawId !== '0' && tmdbRawId !== 'undefined' && tmdbRawId !== 'null' && String(tmdbRawId).trim() !== '') ? tmdbRawId : null;

  const mediaType: "movie" | "tv" = (slugMediaType || slugAnilistMediaType || "movie") as "movie" | "tv";

  const { data: tmdbDetails, isLoading: tmdbDetailsLoading } = useTmdbDetails(tmdbId, mediaType);

  // Search TMDB for AniList title to resolve its TMDB ID
  const { data: tmdbSearchEnglish } = useTmdbSearch(!tmdbId && englishQuery ? englishQuery : "", mediaType, 1);
  const tmdbSearchResults = tmdbSearchEnglish?.results || [];

  const bestSearchMatchId = useMemo(() => {
    if (!tmdbSearchResults || tmdbSearchResults.length === 0) return null;
    if (isAnilistSlug) {
      const scored = tmdbSearchResults.map((r: any) => {
        let score = 0;
        const isAnimation = r.genre_ids?.includes(16);
        if (isAnimation) score += 100;
        
        const tmdbYear = parseInt((r.release_date || r.first_air_date || '').substring(0, 4)) || 0;
        const aniYear = anilistDetailData?.year || 0;
        if (aniYear && tmdbYear) {
          const yearDiff = Math.abs(tmdbYear - aniYear);
          if (yearDiff === 0) score += 50;
          else if (yearDiff <= 1) score += 30;
          else if (yearDiff <= 3) score += 10;
        }
        return { result: r, score };
      });
      scored.sort((a, b) => b.score - a.score);
      if (scored[0] && scored[0].score > 0) {
        return scored[0].result.id;
      }
    }
    return tmdbSearchResults[0].id;
  }, [tmdbSearchResults, isAnilistSlug, anilistDetailData?.year]);

  const resolvedTmdbId = tmdbId || bestSearchMatchId;
  const { data: tmdbDetailsFallback, isLoading: tmdbDetailsFallbackLoading } = useTmdbDetails(resolvedTmdbId && !tmdbId ? resolvedTmdbId : 0, mediaType);

  const rawTmdbData = tmdbDetails || tmdbDetailsFallback;

  const finalTmdbData = useMemo(() => {
    if (!rawTmdbData) return null;
    const translations = rawTmdbData.translations?.translations || [];
    const vi = translations.find((t: any) => t.iso_639_1 === 'vi')?.data;
    const en = translations.find((t: any) => t.iso_639_1 === 'en')?.data;

    const hasVi = vi && (vi.title || vi.name);
    const title = hasVi ? (vi.title || vi.name) : (en?.title || en?.name || rawTmdbData.title || rawTmdbData.name);
    const overview = hasVi ? vi.overview : (en?.overview || rawTmdbData.overview);

    return {
      ...rawTmdbData,
      title: title || rawTmdbData.title,
      name: title || rawTmdbData.name,
      overview: overview || rawTmdbData.overview
    };
  }, [rawTmdbData]);

  // 3. Determine if media is an Anime
  const isAnime = useMemo(() => {
    if (isAnilistSlug) return true;
    if (finalTmdbData) {
      const isJa = finalTmdbData.original_language === 'ja';
      const hasAnimGenre = finalTmdbData.genres?.some((g: any) => g.id === 16 || g.name?.toLowerCase() === 'animation' || g.name?.toLowerCase() === 'hoạt hình');
      if (isJa && hasAnimGenre) return true;
    }
    return false;
  }, [isAnilistSlug, finalTmdbData]);

  const filteredSeasons = useMemo(() => {
    return finalTmdbData?.seasons ? finalTmdbData.seasons.filter((s: any) => s.season_number > 0) : [];
  }, [finalTmdbData]);
  const isTv = filteredSeasons.length > 0;

  const [activeSeasonNumber, setActiveSeasonNumber] = useState<number | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSeason = params.get("season");
    if (urlSeason) return Number(urlSeason);
    
    try {
      const stored = localStorage.getItem('cinemax_progress');
      if (stored) {
        const parsed = JSON.parse(stored);
        const saved = parsed[slug];
        if (saved && saved.season) {
          return Number(saved.season);
        }
      }
    } catch (e) {}
    return null;
  });

  const [activeEpSeason, setActiveEpSeason] = useState<number>(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSeason = params.get("season");
    if (urlSeason) return Number(urlSeason);
    
    try {
      const stored = localStorage.getItem('cinemax_progress');
      if (stored) {
        const parsed = JSON.parse(stored);
        const saved = parsed[slug];
        if (saved && saved.season) {
          return Number(saved.season);
        }
      }
    } catch (e) {}
    return 1;
  });

  const isSeasonValid = useMemo(() => {
    if (activeSeasonNumber === null) return true;
    if (!isTv) return false;
    return filteredSeasons.some((s: any) => s.season_number === activeSeasonNumber);
  }, [activeSeasonNumber, isTv, filteredSeasons]);

  const validatedActiveSeasonNumber = isSeasonValid ? activeSeasonNumber : null;

  useEffect(() => {
    if (activeSeasonNumber !== null && !isSeasonValid) {
      setActiveSeasonNumber(null);
    }
  }, [activeSeasonNumber, isSeasonValid]);

  const isEpSeasonValid = useMemo(() => {
    if (!isTv) return true;
    return filteredSeasons.some((s: any) => s.season_number === activeEpSeason);
  }, [activeEpSeason, isTv, filteredSeasons]);

  const validatedActiveEpSeason = isEpSeasonValid ? activeEpSeason : 1;

  useEffect(() => {
    if (!isEpSeasonValid) {
      setActiveEpSeason(1);
    }
  }, [activeEpSeason, isEpSeasonValid]);

  const defaultSeason = isTv ? filteredSeasons[0].season_number : null;
  const urlSeason = isTmdbSlug && slugParts.length > 3 ? parseInt(slugParts[3]) : null;
  const currentSeason = validatedActiveSeasonNumber !== null ? validatedActiveSeasonNumber : (urlSeason || defaultSeason || 1);

  // TV Season Query from TMDB
  const { data: seasonData, isFetching: isFetchingTmdbSeason } = useTmdbTvSeason(isTv ? finalTmdbData?.id : null, currentSeason);

  // TV Season Server Data Query
  const { data: seasonServerData } = useQuery({
    queryKey: ["season-servers", slug, finalTmdbData?.id, currentSeason],
    queryFn: async () => {
        if (!isTv || !finalTmdbData) return null;
        
        const titlesToSearch = [
            cleanTitleForSeasonSearch(finalTmdbData?.name),
            cleanTitleForSeasonSearch(finalTmdbData?.original_name)
        ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i) as string[];

        let results: any[] = [];
        let matchedTitle = titlesToSearch[0] || "";

        // Generate prioritized search terms
        const searchTerms: string[] = [];
        
        // 1. Season-specific terms for all titles
        for (const title of titlesToSearch) {
            searchTerms.push(`${title} (Season ${currentSeason})`);
            searchTerms.push(`${title} (Phần ${currentSeason})`);
            searchTerms.push(`${title} (Mùa ${currentSeason})`);
            searchTerms.push(`${title} Season ${currentSeason}`);
            searchTerms.push(`${title} Phần ${currentSeason}`);
            searchTerms.push(`${title} Mùa ${currentSeason}`);
            searchTerms.push(`${title} ${currentSeason}`);
        }
        
        // 2. Base title terms if currentSeason is 1
        if (currentSeason === 1) {
            for (const title of titlesToSearch) {
                searchTerms.push(title);
            }
        }

        // Fetch search terms sequentially and stop on the first match
        for (const term of searchTerms) {
            try {
                const searchResults = await fetchSearch(term);
                if (searchResults && searchResults.length > 0) {
                    const tvResults = searchResults.filter((item: any) => {
                        const isItemMovie = item.type === 'single' || item.type === 'phimle' || item.type === 'movie';
                        return !isItemMovie;
                    });
                    if (tvResults.length > 0) {
                        results = tvResults;
                        matchedTitle = term;
                        break;
                    }
                }
            } catch (err) {}
        }

        // Fallback: search base titles without season suffix sequentially
        if (results.length === 0) {
            for (const title of titlesToSearch) {
                try {
                    const fallbackResults = await fetchSearch(title);
                    if (fallbackResults && fallbackResults.length > 0) {
                        const tvResults = fallbackResults.filter((item: any) => {
                            const isItemMovie = item.type === 'single' || item.type === 'phimle' || item.type === 'movie';
                            return !isItemMovie;
                        });
                        if (tvResults.length > 0) {
                            results = tvResults;
                            matchedTitle = title;
                            break;
                        }
                    }
                } catch (err) {}
            }
        }

        let seasonSlug = null;
        let originalSlug = null;
        if (results.length > 0) {
            const currentSeasonObj = finalTmdbData?.seasons ? finalTmdbData.seasons.find((s: any) => s.season_number === currentSeason) : null;
            const tmdbYear = currentSeasonObj?.air_date 
                ? parseInt(currentSeasonObj.air_date.substring(0,4))
                : (finalTmdbData?.first_air_date ? parseInt(finalTmdbData.first_air_date.substring(0,4)) : 0);
            
            const scoredMatches = results.map((item: any) => ({
                ...item,
                score: computeMatchScore(item, { title: matchedTitle, original_title: finalTmdbData?.name || "", year: tmdbYear, type: 'tv' }) 
                       + (currentSeason > 1 && (item.slug.includes(currentSeason.toString()) || item.name.includes(currentSeason.toString())) ? 50 : 0)
            })).sort((a: any, b: any) => b.score - a.score);

            if (scoredMatches[0] && scoredMatches[0].score >= 75) {
                seasonSlug = scoredMatches[0].slug;
                originalSlug = scoredMatches[0].slug;
            }
        }

        const targetSlug = originalSlug || seasonSlug;
        if (targetSlug) {
            const detail = await fetchDetail(targetSlug);
            return detail?.episodes || [];
        }
        return [];
    },
    enabled: isTv && !!finalTmdbData?.id && !!currentSeason,
    staleTime: 1000 * 60 * 60 * 24
  });

  // 4. Resolve AniList ID for TMDB Anime
  const { data: resolvedAnilistId } = useQuery({
    queryKey: ["resolvedAnilistId", resolvedTmdbId, finalTmdbData?.title, mediaType === 'tv' ? currentSeason : 1],
    queryFn: async () => {
      if (!finalTmdbData) return null;
      const baseTitle = finalTmdbData.original_name || finalTmdbData.original_title || finalTmdbData.title || finalTmdbData.name;
      if (!baseTitle) return null;
      
      try {
        // Build search queries: season-specific first, then base title
        let searchQueries = [baseTitle];
        if (mediaType === 'tv' && currentSeason > 1) {
          searchQueries = [
            `${baseTitle} Season ${currentSeason}`,
            `${baseTitle} Part ${currentSeason}`,
            `${baseTitle} ${currentSeason}`,
            baseTitle
          ];
        }

        for (const q of searchQueries) {
          const searchUrl = `https://api.animapper.net/api/v1/search?title=${encodeURIComponent(q)}&mediaType=ANIME&limit=5`;
          const res = await fetch(searchUrl);
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.results && data.results.length > 0) {
              return data.results[0].id;
            }
          }
        }
      } catch (err) {
        console.warn(`[useMovieDetail] Failed to search AniList ID for "${baseTitle}":`, err);
      }
      return null;
    },
    enabled: isAnime && !slugAnilistId && !!finalTmdbData,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const activeAnilistId = slugAnilistId || resolvedAnilistId;

  // Fetch AniList details for TMDB Anime (to get HiAnime episodes)
  const { data: tmdbAnimeDetailData, isLoading: tmdbAnimeDetailLoading } = useQuery({
    queryKey: ["anilistDetail", activeAnilistId],
    queryFn: async () => {
      if (!activeAnilistId) return null;
      const { fetchAnimeDetailsClient } = await import('../../api/anilistApi');
      const data = await fetchAnimeDetailsClient(activeAnilistId);
      return data;
    },
    enabled: isAnime && !!activeAnilistId && !isAnilistSlug,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const finalAnilistData = anilistDetailData || tmdbAnimeDetailData;

  // 5. Query matching phimApi item by searching OPhim/KKPhim with the title
  const { data: searchedPhimItem } = useQuery({
    queryKey: ["searchedPhimItem", resolvedTmdbId, finalTmdbData?.title, mediaType === 'tv' ? currentSeason : 1],
    queryFn: async () => {
      if (!finalTmdbData) return null;
      const title = finalTmdbData.title || finalTmdbData.name;
      const originalTitle = finalTmdbData.original_title || finalTmdbData.original_name;
      if (!title && !originalTitle) return null;

      let results: any[] = [];
      const baseKeyword = title || originalTitle;

      if (mediaType === 'tv') {
        // Search specific season titles (e.g. "Dr. STONE Season 1", "Dr. STONE Phần 1")
        const seasonQueries = [
          `${baseKeyword} Phần ${currentSeason}`,
          `${baseKeyword} Season ${currentSeason}`,
          `${baseKeyword} Part ${currentSeason}`,
          baseKeyword
        ];
        for (const q of seasonQueries) {
          const res = await fetchSearch(q).catch(() => []);
          if (res && res.length > 0) {
            results.push(...res);
          }
        }
      } else {
        results = await fetchSearch(baseKeyword).catch(() => []);
      }

      if (!results || results.length === 0) return null;

      // Deduplicate results by slug
      const uniqueMap = new Map();
      results.forEach(item => {
        if (item && item.slug && !uniqueMap.has(item.slug)) {
          uniqueMap.set(item.slug, item);
        }
      });
      const localResults = Array.from(uniqueMap.values()).filter((item: any) => !item.isTmdbOnly);
      if (localResults.length === 0) return null;

      const tmdbInfo = {
        title,
        original_title: originalTitle,
        year: parseInt((finalTmdbData.release_date || finalTmdbData.first_air_date || '').substring(0, 4)) || 0,
        type: mediaType,
        id: resolvedTmdbId,
        imdb_id: resolvedImdbId,
        casts: finalTmdbData?.credits?.cast?.slice(0, 8).map((c: any) => c.name || c.original_name) || []
      };

      const scored = localResults.map((item: any) => {
        let score = computeMatchScore(item, tmdbInfo);
        // Bonus for matching specific TV Season
        if (mediaType === 'tv') {
          const itemText = (cleanString(item.name || '') + ' ' + cleanString(item.slug || '')).toLowerCase();
          const sPattern = new RegExp(`(phan|season|part|ss)\\s*0*${currentSeason}\\b`, 'i');
          if (sPattern.test(itemText)) {
            score += 150;
          } else if (currentSeason === 1 && !/(phan|season|part|ss)\s*\d+/i.test(itemText)) {
             // Base series match for season 1
             score += 100;
          }
        }
        return { item, score };
      });

      scored.sort((a, b) => b.score - a.score);
      if (scored[0] && scored[0].score >= 75) {
        return scored[0].item;
      }
      return null;
    },
    enabled: (isTmdbSlug || isAnilistSlug) && !!finalTmdbData,
    staleTime: 24 * 60 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const phimApiSlug = useMemo(() => {
    if (!isTmdbSlug && !isAnilistSlug) return slug;
    return searchedPhimItem?.originalSlug || searchedPhimItem?.slug || null;
  }, [isTmdbSlug, isAnilistSlug, slug, searchedPhimItem]);

  const { data: detailData, isLoading: detailLoading, isFetching } = useQuery({
    queryKey: ["detail", phimApiSlug],
    queryFn: () => fetchDetail(phimApiSlug!),
    enabled: !!phimApiSlug,
    staleTime: 24 * 60 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  // Fetch external IDs to resolve IMDb ID
  const { data: externalIdsData } = useQuery({
    queryKey: ['tmdb', 'external_ids', mediaType, resolvedTmdbId],
    queryFn: async () => {
      if (!resolvedTmdbId) return null;
      const { tmdbGetExternalIds } = await import('../../api/tmdbApi');
      return tmdbGetExternalIds(mediaType, resolvedTmdbId);
    },
    enabled: !!resolvedTmdbId,
    staleTime: 24 * 60 * 60 * 1000,
  });
  const resolvedImdbId = externalIdsData?.imdb_id || null;

  // Fetch IMDb detailed metadata from proxy
  const { data: imdbApiData } = useQuery({
    queryKey: ['imdb', resolvedImdbId],
    queryFn: async () => {
      if (!resolvedImdbId) return null;
      const res = await fetch(`/api/imdb-proxy?imdbId=${resolvedImdbId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!resolvedImdbId,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const tmdbBackdropUrl = useMemo(() => {
    if (!finalTmdbData) return null;
    const path = finalTmdbData.images?.backdrops?.[0]?.file_path || finalTmdbData.backdrop_path;
    if (!path) return null;
    return path.startsWith('http') ? path : `https://image.tmdb.org/t/p/original/${path.split('/').pop()}`;
  }, [finalTmdbData]);

  const tmdbPosterUrl = useMemo(() => {
    if (!finalTmdbData) return null;
    const path = finalTmdbData.images?.posters?.[0]?.file_path || finalTmdbData.poster_path;
    if (!path) return null;
    return path.startsWith('http') ? path : `https://image.tmdb.org/t/p/w780/${path.split('/').pop()}`;
  }, [finalTmdbData]);

  // 6. Synthesize unified metadata
  const data = useMemo(() => {
    if (!finalTmdbData && !finalAnilistData && !detailData?.movie) return null;

    const name = finalTmdbData?.title || finalTmdbData?.name || finalAnilistData?.title || detailData?.movie?.name || "";
    const origin_name = finalTmdbData?.original_title || finalTmdbData?.original_name || finalAnilistData?.title || detailData?.movie?.origin_name || "";
    const content = finalTmdbData?.overview || finalAnilistData?.description || detailData?.movie?.content || "Chúng tôi đang cập nhật nội dung chi tiết cho bộ phim này.";
    
    const poster_url = tmdbPosterUrl || 
      (finalAnilistData?.coverImage ? (typeof finalAnilistData.coverImage === 'string' ? finalAnilistData.coverImage : (finalAnilistData.coverImage.extraLarge || finalAnilistData.coverImage.large || "")) : "") ||
      detailData?.movie?.poster_url || "";
      
    const thumb_url = tmdbBackdropUrl || 
      finalAnilistData?.bannerImage || 
      (finalAnilistData?.coverImage ? (typeof finalAnilistData.coverImage === 'string' ? finalAnilistData.coverImage : (finalAnilistData.coverImage.large || "")) : "") ||
      detailData?.movie?.thumb_url || "";

    const year = (finalTmdbData?.release_date || finalTmdbData?.first_air_date || '').substring(0, 4) ||
      (finalAnilistData?.year ? String(finalAnilistData.year) : "") ||
      detailData?.movie?.year || "";

    const time = finalTmdbData?.runtime ? `${finalTmdbData.runtime} phút` :
      (finalAnilistData?.episodesCount ? `${finalAnilistData.episodesCount} tập` :
      detailData?.movie?.time || "");

    const quality = detailData?.movie?.quality || "HD";
    
    const episode_current = finalTmdbData?.number_of_episodes ? `${finalTmdbData.number_of_episodes} tập` :
      (finalAnilistData?.status === "FINISHED" ? "Full" : 
      (detailData?.movie?.episode_current || "HD"));

    const category = (finalTmdbData?.genres && finalTmdbData.genres.length > 0 ? finalTmdbData.genres : []) ||
      (finalAnilistData?.genres || []).map((g: string) => ({ name: g })) ||
      detailData?.movie?.category || [];

    const actor = detailData?.movie?.actor || [];
    const director = detailData?.movie?.director || "";
    
    const status = (finalTmdbData?.status === "Ended" || finalTmdbData?.status === "Canceled" ? "completed" :
      (finalTmdbData?.status === "Returning Series" ? "ongoing" : "")) ||
      (finalAnilistData?.status === "FINISHED" ? "completed" : (finalAnilistData?.status ? "ongoing" : "")) ||
      detailData?.movie?.status || "";

    return {
      movie: {
        name,
        origin_name,
        content,
        poster_url,
        thumb_url,
        year,
        time,
        quality,
        episode_current,
        category,
        actor,
        director,
        status,
        slug: phimApiSlug || rawSlug
      },
      episodes: []
    };
  }, [finalTmdbData, finalAnilistData, detailData, tmdbPosterUrl, tmdbBackdropUrl]);

  const isDataValid = useMemo(() => {
    if (isAnilistSlug) return !!finalAnilistData;
    if (isTmdbSlug) return !!finalTmdbData;
    return !!detailData?.movie;
  }, [isAnilistSlug, finalAnilistData, isTmdbSlug, finalTmdbData, detailData]);

  const validatedData = useMemo(() => {
    if (!isDataValid) return null;
    return data;
  }, [isDataValid, data]);

  const tmdbLoading = tmdbDetailsLoading || tmdbDetailsFallbackLoading;
  const isLoading = tmdbLoading || 
    (isAnilistSlug && anilistDetailLoading) || 
    (isAnime && tmdbAnimeDetailLoading) ||
    ((!isTmdbSlug && !isAnilistSlug) && detailLoading && !detailData);

  // Cast
  const actorsData = useMemo(() => {
    if (!isDataValid) return [];
    if (finalTmdbData?.credits?.cast?.length > 0) {
      return finalTmdbData.credits.cast.slice(0, 15).map((c: any) => ({
        id: `tmdb-${c.id}`,
        name: c.name,
        character: c.character || "Diễn viên",
        image: c.profile_path ? (c.profile_path?.startsWith('http') ? c.profile_path : `https://image.tmdb.org/t/p/w185/${c.profile_path?.split('/').pop()}`) : null,
      }));
    }

    if (validatedData?.movie) {
      const rawActor = validatedData.movie.actor;
      let parsedActors: string[] = [];
      if (Array.isArray(rawActor)) {
        if (rawActor.length === 1 && typeof rawActor[0] === 'string' && rawActor[0].includes(',')) {
          parsedActors = rawActor[0].split(',').map((s: string) => s.trim());
        } else {
          parsedActors = rawActor.map((s: any) => typeof s === 'string' ? s.trim() : String(s).trim());
        }
      } else if (typeof rawActor === 'string') {
        parsedActors = rawActor.split(',').map((s: string) => s.trim());
      }

      parsedActors = parsedActors.filter(name => name && name.toLowerCase() !== "đang cập nhật" && name.toLowerCase() !== "n/a" && name.trim() !== "");

      if (parsedActors.length > 0) {
        return parsedActors.slice(0, 15).map((actorName, i) => ({
          id: `fallback-actor-${i}`,
          name: actorName,
          character: 'Diễn viên',
          image: null
        }));
      }
    }

    return [];
  }, [finalTmdbData, validatedData, isDataValid]);

  const tmdbRating = finalTmdbData?.vote_average ? finalTmdbData.vote_average.toFixed(1) : null;
  const imdbRating = imdbApiData?.rating?.aggregateRating
    ? imdbApiData.rating.aggregateRating.toFixed(1)
    : (tmdbRating || (validatedData?.movie?.tmdb?.vote_average ? parseFloat(validatedData.movie.tmdb.vote_average).toFixed(1) : "?"));

  const metacriticScore = imdbApiData?.metacritic?.score || null;

  const tmdbTrailer = finalTmdbData?.videos?.results?.find((v: any) => v.site === "YouTube" && v.type === "Trailer");
  const trailerYoutubeId = tmdbTrailer?.key;

  const [tab, setTab] = useState<"info" | "episodes">("info");
  const [selectedServerId, setSelectedServerId] = useState<number>(0);
  const [activeEp, setActiveEp] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("play") === "true";
  });

  useEffect(() => {
    setActiveEp(null);
    setSelectedServerId(0);
    const params = new URLSearchParams(window.location.search);
    setIsPlaying(params.get("play") === "true");
  }, [slug]);

  const { addToList, removeFromList, isInList } = useMyList();
  const inList = isInList(slug);

  const handleToggleList = useCallback(() => {
    if (validatedData?.movie) {
      if (inList) {
        removeFromList(slug);
      } else {
        const finalPoster = tmdbPosterUrl || validatedData.movie.poster_url || "";
        const finalThumb = tmdbBackdropUrl || validatedData.movie.thumb_url || "";
        addToList({ 
          slug, 
          name: validatedData.movie.name, 
          poster_url: finalPoster, 
          thumb_url: finalThumb,
          tmdb_id: resolvedTmdbId || undefined,
          type: mediaType === 'tv' ? 'series' : 'single'
        });
      }
      queryClient.invalidateQueries({ queryKey: ["movies", "my-list"] });
    }
  }, [validatedData?.movie, inList, slug, addToList, removeFromList, queryClient, tmdbPosterUrl, tmdbBackdropUrl, resolvedTmdbId, mediaType]);

  // 7. Assemble Server List
  const servers = useMemo(() => {
    if (!data?.movie) return [];
    
    let rawServers = [];
    if (mediaType === 'tv') {
      rawServers = seasonServerData || [];
    } else {
      rawServers = (detailData && Array.isArray(detailData.episodes)) ? detailData.episodes : [];
    }
    
    const mainNames = ['OPhim', 'KKPhim', 'NguonC'];
    let processedServers: any[] = mainNames.map(name => {
      const found = rawServers.find((s: any) => s.server_name?.startsWith(name) || s.name === name);
      if (found) {
        let newName = found.server_name || found.name;
        const lowerName = newName.toLowerCase();
        if (lowerName.includes("châu âu")) newName = "VIP (Mượt) - " + newName;
        else if (lowerName.includes("lồng tiếng") || lowerName.includes("thuyết minh")) newName = "Lồng Tiếng - " + newName;
        
        const sortedData = found.server_data ? [...found.server_data].sort((a: any, b: any) => {
          const getVal = (x: any) => {
            if (!x || !x.name) return 0;
            const nameStr = String(x.name).toLowerCase();
            if (nameStr === 'full') return 0;
            const parsed = parseInt(nameStr.replace(/\D/g, ''));
            return isNaN(parsed) ? 999999 : parsed;
          };
          return getVal(a) - getVal(b);
        }) : [];
        
        return {
          server_name: newName,
          server_data: sortedData,
          status: found.status || (sortedData.length > 0 ? 'ok' : 'empty')
        };
      } else {
        return {
          server_name: name,
          server_data: [],
          status: 'empty'
        };
      }
    });

    // Merge HiAnime episodes if it's an Anime
    if (isAnime && finalAnilistData?.episodes && finalAnilistData.episodes.length > 0) {
      processedServers.push({
        server_name: "HiAnime (MegaCloud)",
        server_data: finalAnilistData.episodes.map((ep: any) => ({
          name: ep.name,
          filename: ep.title || `Tập ${ep.name}`,
          link_embed: `/api/anime/stream?id=${ep.id}`,
          link_m3u8: "",
          hianime_episode_id: ep.id
        })),
        status: 'ok'
      });
    }

    // Filter out OPhim/KKPhim servers if they are completely empty, but only if we have at least one other server (like HiAnime)
    const hasAtLeastOneActiveServer = processedServers.some((s: any) => s.status === 'ok');
    if (hasAtLeastOneActiveServer) {
      processedServers = processedServers.filter((s: any) => s.status === 'ok');
    }

    // Add VIP Server (Hollysheesh), Community Server (CinemaOS), and VidNest (Community)
    if (finalTmdbData?.id) {
       let baseEps = [];
       const firstServerWithEps = processedServers.find((s: any) => s.server_data && s.server_data.length > 0);
       if (firstServerWithEps) {
           baseEps = firstServerWithEps.server_data;
       } else {
           if (mediaType === 'movie') {
               baseEps = [{ name: 'Full', filename: 'Full' }];
           } else {
               const epCount = finalTmdbData.number_of_episodes || 1;
               baseEps = Array.from({length: Math.min(epCount, 100)}).map((_, i) => ({
                   name: `${i + 1}`,
                   filename: `Tập ${i + 1}`
               }));
           }
       }

       const cinemaosServerData = baseEps.map((ep: any, index: number) => {
           let cinemaosUrl = `https://cinemaos.tech/player/${finalTmdbData.id}?theme=ffffff`;
           if (mediaType === "tv") {
              const epNum = parseInt(ep.name) || (index + 1);
              cinemaosUrl = `https://cinemaos.tech/player/${finalTmdbData.id}/${currentSeason}/${epNum}?theme=ffffff`;
           }
           return {
               ...ep,
               link_embed: cinemaosUrl,
               link_m3u8: ""
           }
       });

       const hollysheeshServerData = baseEps.map((ep: any) => ({
           ...ep,
           link_embed: "",
           link_m3u8: ""
       }));

       const vidNestServerData = baseEps.map((ep: any, index: number) => ({
           ...ep,
           name: ep.name || `${index + 1}`,
           filename: ep.filename || `Tập ${index + 1}`,
           link_m3u8: '',
           link_embed: '',
       }));

       if (cinemaosServerData.length > 0) {
           processedServers.push({
               server_name: "Community Server (CinemaOS)",
               server_data: cinemaosServerData,
               status: 'ok'
           });
       }

       if (hollysheeshServerData.length > 0) {
           processedServers.push({
               server_name: "VIP Server (Hollysheesh)",
               server_data: hollysheeshServerData,
               status: 'ok',
               _isHollysheesh: true
           });
       }

       if (vidNestServerData.length > 0) {
           processedServers.push({
               server_name: "VidNest (Community) — Sub Việt",
               server_data: vidNestServerData,
               status: 'ok',
               _isVidNest: true,
               _tmdbId: finalTmdbData.id,
               _mediaType: mediaType
           });
       }
    }

    return processedServers;
  }, [detailData, isAnime, finalAnilistData, finalTmdbData?.id, mediaType, data, seasonServerData, currentSeason]);

  const isEpValid = useMemo(() => {
    if (!activeEp) return false;
    return servers.some(srv => 
      srv.server_data?.some((e: any) => e.name === activeEp.name || e.link_embed === activeEp.link_embed || e.link_m3u8 === activeEp.link_m3u8)
    );
  }, [activeEp, servers]);

  const validatedActiveEp = isEpValid ? activeEp : null;

  useEffect(() => {
    if (activeEp && !isEpValid) {
      setActiveEp(null);
    }
  }, [activeEp, isEpValid]);

  const isServerIdValid = selectedServerId >= 0 && (selectedServerId >= servers.length || servers[selectedServerId]?.status !== 'empty');
  const validatedSelectedServerId = isServerIdValid ? selectedServerId : 0;

  const prevSlugRef = useRef<string | null>(null);
  const isSelectingServerRef = useRef(false);

  // Gộp 2 effects về selectedServerId thành 1 để tránh double re-render
  useEffect(() => {
    if (!isDataValid || servers.length === 0) return;
    if (isSelectingServerRef.current) return;

    const isNewSlug = slug !== prevSlugRef.current;
    const isInvalidIndex = selectedServerId < 0 || selectedServerId >= servers.length || servers[selectedServerId]?.status === 'empty';

    if (isNewSlug || isInvalidIndex) {
      isSelectingServerRef.current = true;
      prevSlugRef.current = slug;

      const firstFastIdx = servers.findIndex((s: any) => s.status !== 'empty' && s.status !== 'error' && !s.server_name.includes("CinemaOS") && !s.server_name.includes("Hollysheesh"));
      const firstValidIdx = servers.findIndex((s: any) => s.status !== 'empty' && s.status !== 'error');
      const nextIdx = firstFastIdx !== -1 ? firstFastIdx : (firstValidIdx !== -1 ? firstValidIdx : 0);

      if (nextIdx !== selectedServerId) {
        setSelectedServerId(nextIdx);
      }

      // Reset guard sau 1 frame để không chặn update hợp lệ tiếp theo
      requestAnimationFrame(() => { isSelectingServerRef.current = false; });
    }
  }, [servers, slug, selectedServerId, isDataValid]);


  useEffect(() => {
    if (!isDataValid) return;

    const hasEpisodes = (servers && servers.some((s: any) => s.server_data?.length > 0));
    if (hasEpisodes && !validatedActiveEp) {
      const params = new URLSearchParams(window.location.search);
      const urlEp = params.get("ep");
      if (urlEp) {
        for (const srv of servers) {
          const ep = srv.server_data?.find((e: any) => {
            if (!e?.name) return false;
            const clean = (s: string) => String(s).toLowerCase().replace(/\D/g, '').trim();
            const eName = String(e.name).toLowerCase().trim();
            const uName = String(urlEp).toLowerCase().trim();
            if (eName === uName) return true;
            const eClean = clean(eName);
            const uClean = clean(uName);
            return eClean && uClean && eClean === uClean;
          });
          if (ep) {
            setActiveEp(ep);
            return;
          }
        }
      }

      try {
        const stored = localStorage.getItem('cinemax_progress');
        if (stored) {
          const parsed = JSON.parse(stored);
          const savedProgress = parsed[slug];
          if (savedProgress?.episodeName) {
            for (const server of servers) {
              const ep = server.server_data?.find((e: any) => e.name === savedProgress.episodeName);
              if (ep) {
                setActiveEp(ep);
                return;
              }
            }
          }
        }
      } catch (e) {}
      if (servers[validatedSelectedServerId]?.server_data?.[0]) {
        setActiveEp(servers[validatedSelectedServerId].server_data[0]);
      }
    }
  }, [data, slug, servers, validatedSelectedServerId, validatedActiveEp, isDataValid]);

  return {
    data: validatedData, isLoading, isFetching,
    actorsData, imdbRating, metacriticScore, trailerYoutubeId, finalTmdbData, imdbApiData,
    tmdbBackdropUrl, tmdbPosterUrl,
    tab, setTab,
    selectedServerId: validatedSelectedServerId, setSelectedServerId,
    activeEp: validatedActiveEp, setActiveEp,
    isPlaying, setIsPlaying,
    inList, handleToggleList,
    servers,
    currentSeason,
    activeSeasonNumber,
    setActiveSeasonNumber,
    activeEpSeason,
    setActiveEpSeason,
    seasonData,
    isFetchingTmdbSeason,
    seasonServerData,
    activeAnilistId,
    isAnime,
    isTv,
    filteredSeasons
  };
};
