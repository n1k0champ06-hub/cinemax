import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchDetail, fetchSearch } from "../../api/phimApi";
import { useMyList } from "../useStorage";
import { useTmdbDetails, useTmdbSearch, useTmdbVideos, useTmdbSeasonEpisodes } from "../useTmdb";
import { fetchOmdb } from "../useOmdb";

/**
 * useMovieDetail - Hook chính cho trang chi tiết phim.
 *
 * Luồng dữ liệu (Metadata):
 *   1. PhimAPI/Ophim -> Dữ liệu cơ bản + episodes/stream links
 *   2. TMDB API (miễn phí) -> Backdrop 4K, poster HD, cast, rating, trailer, overview tiếng Việt
 *   3. OMDb (dự phòng) -> IMDB rating khi TMDB không có
 *
 * Luồng Streaming (Video):
 *   Luôn từ PhimAPI/Ophim (fetchDetail). Nếu phim từ TMDB, dùng ExternalResolverModal để đối chiếu.
 *
 * RapidAPI (imdb236, rottentomato, moviesdatabase) đã được LOẠI BỎ khỏi luồng mặc định
 * để tiết kiệm quota. Chỉ giữ lại OMDb (miễn phí, quota thấp) làm dự phòng.
 */
export const useMovieDetail = (slug: string) => {
  const queryClient = useQueryClient();

  // === Bước 1: Lấy dữ liệu cơ bản từ PhimAPI ===
  const { data, isLoading } = useQuery({
    queryKey: ["detail", slug],
    queryFn: () => fetchDetail(slug),
  });

  const originName = data?.movie?.origin_name || data?.movie?.name;
  const year = data?.movie?.year;

  // === Bước 2: TMDB Integration (Nguồn chính cho metadata chất lượng cao) ===
  const tmdbId = data?.movie?.tmdb?.id || data?.movie?.tmdb_id;
  const mediaType = data?.movie?.type === "single" || data?.movie?.type === "phimle" ? "movie" : "tv";
  
  // Thử lấy chi tiết từ TMDB bằng ID trực tiếp
  const { data: tmdbDetails } = useTmdbDetails(tmdbId, mediaType);
  
  // Fallback: Nếu không có TMDB ID, tìm kiếm bằng tên gốc (lược bỏ chữ Season/Phần để TMDB dễ tìm)
  const cleanOriginName = originName ? originName.replace(/\s*\(?(Season|Phần)\s*\d+\)?/i, '').trim() : '';
  const { data: tmdbSearch } = useTmdbSearch(
    (!tmdbId && cleanOriginName) ? cleanOriginName : '', 
    mediaType, 
    1
  );
  const resolvedTmdbId = tmdbId || tmdbSearch?.results?.[0]?.id;
  const { data: tmdbDetailsFallback } = useTmdbDetails(
    resolvedTmdbId && !tmdbId ? resolvedTmdbId : 0, 
    mediaType
  );

  const finalTmdbData = tmdbDetails || tmdbDetailsFallback;

  // === Bước 3: TMDB Cast (thay thế RapidAPI useMainActors) ===
  const actorsData = useMemo(() => {
    if (!finalTmdbData?.credits?.cast?.length) return [];
    return finalTmdbData.credits.cast.slice(0, 10).map((c: any) => ({
      id: `tmdb-${c.id}`,
      name: c.name,
      character: c.character,
      image: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null,
    }));
  }, [finalTmdbData]);

  // === Bước 4: TMDB Trailer (thay thế KinoCheck) ===
  const resolvedMediaType = finalTmdbData 
    ? (finalTmdbData.title ? 'movie' : 'tv') 
    : mediaType;
  const tmdbVideoId = finalTmdbData?.id || resolvedTmdbId;
  const { data: tmdbTrailerId } = useTmdbVideos(resolvedMediaType, tmdbVideoId);
  
  // Trailer: Ưu tiên TMDB, không dùng KinoCheck nữa
  const trailerYoutubeId = tmdbTrailerId || null;

  // === Bước 5: Rating (TMDB ưu tiên, OMDb dự phòng) ===
  const tmdbRating = finalTmdbData?.vote_average 
    ? finalTmdbData.vote_average.toFixed(1) 
    : null;

  // OMDb chỉ gọi khi TMDB không có rating (dự phòng cuối cùng, miễn phí)
  const { data: omdbData } = useQuery({
    queryKey: ["omdb", originName, year],
    queryFn: () => fetchOmdb(originName, year?.toString()),
    enabled: !!originName && !tmdbRating,
  });

  const imdbRating = tmdbRating 
    || (omdbData?.imdbRating && omdbData.imdbRating !== "N/A" 
        ? parseFloat(omdbData.imdbRating).toFixed(1) 
        : null)
    || (data?.movie?.tmdb?.vote_average 
        ? parseFloat(data.movie.tmdb.vote_average).toFixed(1) 
        : null);

  // === Bước 6: TMDB Episode Details (overview, still_path) ===
  // Xác định season number từ TMDB data hoặc từ tên phim
  const tmdbSeasonNumber = useMemo(() => {
    if (mediaType !== 'tv') return 0;
    // Nếu TMDB data có seasons, lấy season cuối cùng có episode_count > 0
    if (finalTmdbData?.seasons?.length) {
      // Ưu tiên lấy season number từ tên phim (vd: "Season 2" -> 2)
      const nameMatch = (data?.movie?.origin_name || data?.movie?.name || '')
        .match(/(?:Season|Phần|Mùa)\s*(\d+)/i);
      if (nameMatch) {
        const sn = parseInt(nameMatch[1]);
        if (finalTmdbData.seasons.some((s: any) => s.season_number === sn)) return sn;
      }
      // Nếu chỉ có 1 season thì lấy luôn
      if (finalTmdbData.number_of_seasons === 1) return 1;
      // Fallback: lấy season cuối cùng có episode
      const validSeasons = finalTmdbData.seasons.filter((s: any) => s.season_number > 0 && s.episode_count > 0);
      if (validSeasons.length) return validSeasons[validSeasons.length - 1].season_number;
    }
    return 1; // Default season 1
  }, [finalTmdbData, mediaType, data?.movie]);

  const resolvedTmdbIdForSeason = finalTmdbData?.id || resolvedTmdbId;
  const { data: tmdbSeasonData } = useTmdbSeasonEpisodes(
    mediaType === 'tv' ? resolvedTmdbIdForSeason : null,
    tmdbSeasonNumber
  );

  // Tạo map ánh xạ episode number -> TMDB episode data (overview, still_path)
  const tmdbEpisodeMap = useMemo(() => {
    if (!tmdbSeasonData?.episodes?.length) return new Map();
    const map = new Map<number, { overview: string; still_path: string | null; name: string }>();
    tmdbSeasonData.episodes.forEach((ep: any) => {
      map.set(ep.episode_number, {
        overview: ep.overview || '',
        still_path: ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : null,
        name: ep.name || '',
      });
    });
    return map;
  }, [tmdbSeasonData]);

  // === State management ===
  const [tab, setTab] = useState<"info" | "episodes">("info");
  const [selectedServerId, setSelectedServerId] = useState<number>(0);
  const [activeEp, setActiveEp] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const { addToList, removeFromList, isInList } = useMyList();
  const inList = isInList(slug);

  const handleToggleList = useCallback(() => {
    if (data?.movie) {
      if (inList) removeFromList(slug);
      else addToList({ slug, name: data.movie.name, poster_url: data.movie.poster_url, thumb_url: data.movie.thumb_url });
      queryClient.invalidateQueries({ queryKey: ["movies", "my-list"] });
    }
  }, [data?.movie, inList, slug, addToList, removeFromList, queryClient]);

  const servers = useMemo(() => {
    if (!data?.movie) return [];
    let rawServers = Array.isArray(data.episodes) ? data.episodes : [];
    
    const appMode = localStorage.getItem("cinemax_server") || "asia";
    let processedServers = [];
    if (appMode === "eu") {
      processedServers = rawServers.filter((s: any) => s.server_name.includes("Châu Âu"));
      if (processedServers.length === 0) processedServers = rawServers;
    } else {
      let vietsubCount = 1;
      processedServers = rawServers.map((s: any) => {
        let newName = s.server_name;
        const lowerName = s.server_name.toLowerCase();
        if (lowerName.includes("châu âu")) newName = "Vietsub VIP (Mượt)";
        else if (lowerName.includes("lồng tiếng") || lowerName.includes("thuyết minh")) newName = "Lồng Tiếng";
        else { newName = `Vietsub ${vietsubCount}`; vietsubCount++; }
        return { ...s, server_name: newName };
      });
    }
    return processedServers;
  }, [data]);

  useEffect(() => {
    if (data?.episodes?.length > 0 && !activeEp) {
      try {
        const stored = localStorage.getItem('cinemax_progress');
        if (stored) {
          const parsed = JSON.parse(stored);
          const savedProgress = parsed[slug];
          if (savedProgress?.episodeName) {
            for (const server of data.episodes as any[]) {
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
  }, [data, slug, servers, selectedServerId]);

  // === Phát hiện phần phim (Season) thông minh nhất từ PhimAPI ===
  const isSeries = data?.movie?.type === 'series';
  const baseName = useMemo(() => {
    const rawName = data?.movie?.origin_name || data?.movie?.name || '';
    return rawName.replace(/\s*\(?(Season|Phần|Mùa)\s*\d+\)?/gi, '').trim();
  }, [data?.movie]);

  const { data: seasonSearchResults } = useQuery({
    queryKey: ['phimapi_seasons_smart', baseName],
    queryFn: () => fetchSearch(baseName),
    enabled: isSeries && !!baseName,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const { seasonMap, currentSeasonNumber } = useMemo(() => {
    if (!seasonSearchResults || !isSeries) return { seasonMap: [], currentSeasonNumber: 0 };
    
    const baseNameLower = baseName.toLowerCase();
    const extractSeasonNumber = (name: string) => {
      const match = name.match(/(?:Season|Phần|Mùa)\s*(\d+)/i);
      return match ? parseInt(match[1]) : 0;
    };

    const uniqueSeasons = new Map<number, { seasonNumber: number; slug: string; name: string }>();
    
    seasonSearchResults.forEach((item: any) => {
      if (item.type !== 'series') return;
      
      const itemOriginName = (item.origin_name || item.name || '').toLowerCase();
      if (itemOriginName.includes(baseNameLower)) {
        const sn = extractSeasonNumber(item.origin_name) || extractSeasonNumber(item.name);
        if (sn > 0 && !uniqueSeasons.has(sn)) {
          uniqueSeasons.set(sn, {
            seasonNumber: sn,
            slug: item.slug,
            name: `Phần ${sn}`
          });
        }
      }
    });

    const currentSn = extractSeasonNumber(data?.movie?.origin_name || '') || extractSeasonNumber(data?.movie?.name || '');
    
    return {
      seasonMap: Array.from(uniqueSeasons.values()).sort((a, b) => a.seasonNumber - b.seasonNumber),
      currentSeasonNumber: currentSn
    };
  }, [seasonSearchResults, baseName, isSeries, data?.movie]);

  return {
    data, isLoading,
    actorsData, imdbRating, trailerYoutubeId, finalTmdbData,
    tab, setTab,
    selectedServerId, setSelectedServerId,
    activeEp, setActiveEp,
    isPlaying, setIsPlaying,
    inList, handleToggleList,
    servers,
    seasonMap, currentSeasonNumber,
    tmdbEpisodeMap
  };
};
