import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { fetchDetail } from "../../api/phimApi";
import { useMyList } from "../useStorage";
import { useTmdbDetails, useTmdbSearch } from "../useTmdb";
import { computeMatchScore } from "../../utils/movieMatcher";

const cleanSearchQuery = (str: string): string => {
  if (!str) return "";
  return str
    .replace(/\s*[\(\[].*?[\)\]]/g, "") // remove brackets/parentheses contents
    .replace(/\b(vietsub|thuyet minh|long tieng|longtieng|thuyetminh|vtv\d|htv\d|vtv|htv|subviet|sub|raw|cam|hd|full|fhd|sd|ultrahd|4k|ban dep|ban thuyet minh|longtieng vietsub|full vietsub)\b/gi, "")
    .replace(/[^a-zA-Z0-9\sÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂÂÊÔƠưăâêôơ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const useMovieDetail = (rawSlug: string) => {
  const queryClient = useQueryClient();

  const slug = rawSlug.replace(/^resolved-/, '');
  const isTmdbSlug = slug.startsWith('tmdb-');
  const slugParts = isTmdbSlug ? slug.split('-') : [];
  const slugTmdbId = isTmdbSlug ? slugParts[1] : null;
  const slugMediaType = isTmdbSlug ? (slugParts[2] || 'movie') : undefined;

  const { data: detailData, isLoading: detailLoading, isFetching } = useQuery({
    queryKey: ["detail", slug],
    queryFn: () => fetchDetail(slug),
    enabled: !isTmdbSlug, // Don't fetch from phimApi if it's explicitly a tmdb slug we know we don't have
    placeholderData: keepPreviousData
  });

  const originName = detailData?.movie?.origin_name || detailData?.movie?.name;

  const englishQuery = useMemo(() => {
    if (!detailData?.movie) return "";
    return cleanSearchQuery(detailData.movie.origin_name || "");
  }, [detailData?.movie]);

  const vietQuery = useMemo(() => {
    if (!detailData?.movie) return "";
    return cleanSearchQuery(detailData.movie.name || "");
  }, [detailData?.movie]);

  // TMDB Integration
  const tmdbRawId = detailData?.movie?.tmdb?.id || detailData?.movie?.tmdb_id || slugTmdbId;
  const tmdbId = (tmdbRawId && tmdbRawId !== 0 && tmdbRawId !== '0' && tmdbRawId !== 'undefined' && tmdbRawId !== 'null' && String(tmdbRawId).trim() !== '') ? tmdbRawId : null;

  const isSingleMovie = useMemo(() => {
    if (!detailData?.movie) {
      return slugMediaType === 'movie';
    }
    const type = detailData.movie.type;
    if (type === "single" || type === "phimle") return true;
    if (type === "series" || type === "tvshows") return false;
    
    // Evaluate animation ("hoathinh") or other custom types
    const episodes = detailData.episodes || [];
    let maxServerEpisodes = 0;
    if (Array.isArray(episodes)) {
      episodes.forEach((srv: any) => {
        if (srv && Array.isArray(srv.server_data)) {
          maxServerEpisodes = Math.max(maxServerEpisodes, srv.server_data.length);
        }
      });
    }
    if (maxServerEpisodes === 1) {
      return true;
    }
    
    const timeStr = String(detailData.movie.time || "").toLowerCase();
    if (timeStr.includes("phút") || timeStr.includes("m") || timeStr.match(/^\d+$/)) {
      if (!timeStr.includes("tập") && !timeStr.includes("mùa")) {
        return true;
      }
    }
    
    return false;
  }, [detailData, slugMediaType]);

  const mediaType: "movie" | "tv" = (slugMediaType || (isSingleMovie ? "movie" : "tv")) as "movie" | "tv";
  
  const { data: tmdbDetails, isLoading: tmdbLoading } = useTmdbDetails(tmdbId, mediaType);
  
  // Try search by English/Original name first
  const { data: tmdbSearchEnglish } = useTmdbSearch(!tmdbId && englishQuery ? englishQuery : "", mediaType, 1);
  // If search for English/Original name fails/returns nothing AND we have a Vietnamese name, try searching with Vietnamese name
  const { data: tmdbSearchViet } = useTmdbSearch(!tmdbId && (!tmdbSearchEnglish?.results || tmdbSearchEnglish.results.length === 0) && vietQuery ? vietQuery : "", mediaType, 1);

  const tmdbSearchResults = tmdbSearchEnglish?.results?.length ? tmdbSearchEnglish.results : (tmdbSearchViet?.results || []);

  const bestSearchMatchId = useMemo(() => {
    if (!tmdbSearchResults || tmdbSearchResults.length === 0) return null;
    const movieInfo = detailData?.movie;
    if (!movieInfo) return tmdbSearchResults[0].id;

    const scored = tmdbSearchResults.map((res: any) => {
      const score = computeMatchScore(movieInfo, {
        title: res.title || res.name,
        original_title: res.original_title || res.original_name,
        year: parseInt((res.release_date || res.first_air_date || '').substring(0, 4)) || 0,
        type: mediaType
      });
      return { id: res.id, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0].id;
  }, [tmdbSearchResults, detailData?.movie, mediaType]);

  const resolvedTmdbId = tmdbId || bestSearchMatchId;
  const { data: tmdbDetailsFallback } = useTmdbDetails(resolvedTmdbId && !tmdbId ? resolvedTmdbId : 0, mediaType);

  const finalTmdbData = tmdbDetails || tmdbDetailsFallback;

  const tmdbBackdropUrl = useMemo(() => {
    if (!finalTmdbData) return null;
    const path = finalTmdbData.backdrop_path || finalTmdbData.images?.backdrops?.[0]?.file_path;
    if (!path) return null;
    return path.startsWith('http') ? path : `https://image.tmdb.org/t/p/original/${path.split('/').pop()}`;
  }, [finalTmdbData]);

  const tmdbPosterUrl = useMemo(() => {
    if (!finalTmdbData) return null;
    const path = finalTmdbData.poster_path || finalTmdbData.images?.posters?.[0]?.file_path;
    if (!path) return null;
    return path.startsWith('http') ? path : `https://image.tmdb.org/t/p/w780/${path.split('/').pop()}`;
  }, [finalTmdbData]);

  // Synthesize common data structure if we only have TMDB data
  const data = detailData || (finalTmdbData ? {
    movie: {
      name: finalTmdbData.title || finalTmdbData.name,
      origin_name: finalTmdbData.original_title || finalTmdbData.original_name,
      content: finalTmdbData.overview,
      poster_url: tmdbPosterUrl || '',
      thumb_url: tmdbBackdropUrl || '',
      year: (finalTmdbData.release_date || finalTmdbData.first_air_date || '').substring(0, 4),
      time: finalTmdbData.runtime ? `${finalTmdbData.runtime} phút` : '',
      quality: "HD",
      episode_current: "Full",
      category: finalTmdbData.genres || [],
    },
    episodes: []
  } : null);

  const isLoading = detailLoading || (isTmdbSlug && tmdbLoading);

  // Cast using TMDB with fallback to movie.actor
  const actorsData = useMemo(() => {
    if (finalTmdbData?.credits?.cast?.length > 0) {
      return finalTmdbData.credits.cast.slice(0, 15).map((c: any) => ({
        id: `tmdb-${c.id}`,
        name: c.name,
        character: c.character || "Diễn viên",
        image: c.profile_path ? (c.profile_path?.startsWith('http') ? c.profile_path : `https://image.tmdb.org/t/p/w185/${c.profile_path?.split('/').pop()}`) : null,
      }));
    }

    if (detailData?.movie) {
      const rawActor = detailData.movie.actor;
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
  }, [finalTmdbData, detailData?.movie]);

  const tmdbRating = finalTmdbData?.vote_average ? finalTmdbData.vote_average.toFixed(1) : null;
  const imdbRating = tmdbRating || (data?.movie?.tmdb?.vote_average ? parseFloat(data.movie.tmdb.vote_average).toFixed(1) : "?");

  const tmdbTrailer = finalTmdbData?.videos?.results?.find((v: any) => v.site === "YouTube" && v.type === "Trailer");
  const trailerYoutubeId = tmdbTrailer?.key;

  const [tab, setTab] = useState<"info" | "episodes">("info");
  const [selectedServerId, setSelectedServerId] = useState<number>(0);
  const [activeEp, setActiveEp] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("play") === "true";
  });

  // Reset all movie-specific state immediately when slug changes to prevent leakage/mismatches
  useEffect(() => {
    setActiveEp(null);
    setSelectedServerId(0);
    const params = new URLSearchParams(window.location.search);
    setIsPlaying(params.get("play") === "true");
  }, [slug]);

  const { addToList, removeFromList, isInList } = useMyList();
  const inList = isInList(slug);

  const handleToggleList = useCallback(() => {
    if (data?.movie) {
      if (inList) {
        removeFromList(slug);
      } else {
        const finalPoster = tmdbPosterUrl || data.movie.poster_url || "";
        const finalThumb = tmdbBackdropUrl || data.movie.thumb_url || "";
        addToList({ 
          slug, 
          name: data.movie.name, 
          poster_url: finalPoster, 
          thumb_url: finalThumb,
          tmdb_id: resolvedTmdbId || undefined,
          type: mediaType === 'tv' ? 'series' : 'single'
        });
      }
      queryClient.invalidateQueries({ queryKey: ["movies", "my-list"] });
    }
  }, [data?.movie, inList, slug, addToList, removeFromList, queryClient, tmdbPosterUrl, tmdbBackdropUrl, resolvedTmdbId, mediaType]);

  const servers = useMemo(() => {
    if (!data?.movie) return [];
    let rawServers = Array.isArray(data.episodes) ? data.episodes : [];
    
    const mainNames = ['OPhim', 'KKPhim'];
    let processedServers = mainNames.map(name => {
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
          ...found,
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

    if (finalTmdbData?.id) {
       let baseEps = [];
       const firstServerWithEps = processedServers.find((s: any) => s.server_data && s.server_data.length > 0);
       if (firstServerWithEps) {
           baseEps = firstServerWithEps.server_data;
       } else {
           if (mediaType === 'movie') {
               baseEps = [{ name: 'Full', filename: 'Full' }];
           } else {
               // Synthesize somewhat up to number_of_episodes or at least 1
               const epCount = finalTmdbData.number_of_episodes || 1;
               baseEps = Array.from({length: Math.min(epCount, 50)}).map((_, i) => ({
                   name: `${i + 1}`,
                   filename: `Tập ${i + 1}`
               }));
           }
       }

       const cinemaosServerData = baseEps.map((ep: any, index: number) => {
           let cinemaosUrl = `https://cinemaos.tech/player/${finalTmdbData.id}?theme=ffffff&autoPlay=true`;
           if (mediaType === "tv") {
              const epNum = parseInt(ep.name) || (index + 1);
              cinemaosUrl = `https://cinemaos.tech/player/${finalTmdbData.id}/1/${epNum}?theme=ffffff&autoPlay=true`;
           }
           return {
               ...ep,
               link_embed: cinemaosUrl,
               link_m3u8: ""
           }
       });

        if (cinemaosServerData.length > 0) {
            processedServers.push({
                server_name: "VIP Server (CinemaOS)",
                server_data: cinemaosServerData,
                status: 'ok'
            });
        }
    }

    return processedServers;
  }, [data, finalTmdbData?.id, mediaType]);

  const prevSlugRef = useRef<string | null>(null);
  useEffect(() => {
    const expectedTmdbId = isTmdbSlug ? slugParts[1] : null;
    const isDataMatching = isTmdbSlug 
      ? (finalTmdbData && String(finalTmdbData.id) === String(expectedTmdbId))
      : (detailData?.movie && detailData.movie.slug === slug);

    if (!isDataMatching) return;

    if (servers && servers.length > 0) {
      const isNewSlug = slug !== prevSlugRef.current;
      const isInvalidIndex = selectedServerId < 0 || selectedServerId >= servers.length;
      
      if (isNewSlug || isInvalidIndex) {
        prevSlugRef.current = slug;
        
        const firstFastIdx = servers.findIndex((s: any) => s.status !== 'empty' && s.status !== 'error' && !s.server_name.includes("CinemaOS"));
        if (firstFastIdx !== -1) {
          setSelectedServerId(firstFastIdx);
        } else {
          const firstValidIdx = servers.findIndex((s: any) => s.status !== 'empty' && s.status !== 'error');
          if (firstValidIdx !== -1) {
            setSelectedServerId(firstValidIdx);
          } else {
            setSelectedServerId(0);
          }
        }
      }
    }
  }, [servers, slug, selectedServerId, finalTmdbData, detailData, isTmdbSlug, slugParts]);

  useEffect(() => {
    const expectedTmdbId = isTmdbSlug ? slugParts[1] : null;
    const isDataMatching = isTmdbSlug 
      ? (finalTmdbData && String(finalTmdbData.id) === String(expectedTmdbId))
      : (detailData?.movie && detailData.movie.slug === slug);

    if (!isDataMatching) return;

    const hasEpisodes = (data?.episodes?.length > 0) || (servers && servers.some((s: any) => s.server_data?.length > 0));
    if (hasEpisodes && !activeEp) {
      // First try to restore from URL parameter 'ep'
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

      // Next try to restore from localStorage progress
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
      if (servers[selectedServerId]?.server_data?.[0]) {
        setActiveEp(servers[selectedServerId].server_data[0]);
      }
    }
  }, [data, slug, servers, selectedServerId, activeEp, finalTmdbData, detailData, isTmdbSlug, slugParts]);

  return {
    data, isLoading, isFetching,
    actorsData, imdbRating, trailerYoutubeId, finalTmdbData,
    tmdbBackdropUrl, tmdbPosterUrl,
    tab, setTab,
    selectedServerId, setSelectedServerId,
    activeEp, setActiveEp,
    isPlaying, setIsPlaying,
    inList, handleToggleList,
    servers
  };
};
