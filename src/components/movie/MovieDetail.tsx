import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  X,
  Plus,
  Check,
  Search,
  Download,
  Youtube,
  Users,
  Share2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Tv,
  Clock,
  Star,
  Film,
  AlertTriangle
} from "lucide-react";
import { cn } from "../../lib/utils";
import { SafeImage } from "../ui/ImageShimmer";
import { TvSeasons } from "./TvSeasons";
import { MovieCollection } from "./MovieCollection";
import { MovieCollectionPage } from "./MovieCollectionPage";
import { CustomSelect } from "../ui/CustomSelect";
import { useMovieDetail } from "../../hooks/movie/useMovieDetail";
import { useTmdbTvSeason } from "../../hooks/useTmdb";
import { YoutubeTrailerModal } from "./YoutubeTrailerModal";
import { proxyImage } from "../../utils/proxyImage";
import { fetchSearch, fetchDetail } from "../../api/phimApi";
import { computeMatchScore } from "../../utils/movieMatcher";
import { useTmdbExternalIds } from "../../hooks/useTmdb";
import { useStreamAggregator } from "../../hooks/useStreamAggregator";
import { NetflixPlayer } from "../player/NetflixPlayer";
import { ReportModal } from "../ui/ReportModal";
const getEpisodeNumber = (nameStr: string | number | undefined | null): number | null => {
  if (nameStr === undefined || nameStr === null) return null;
  const cleaned = nameStr.toString().replace(/\D/g, '');
  if (!cleaned) return null;
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
};

const isGenericEpisodeName = (name: string | undefined | null, epNum: number | string | undefined | null): boolean => {
  if (!name) return true;
  const rawStr = name.toString().trim();
  if (!rawStr) return true;
  const cleanedName = rawStr.toLowerCase();
  
  const numStr = epNum ? epNum.toString() : '';
  const paddedNum = numStr.padStart(2, '0');
  
  if (cleanedName === numStr || cleanedName === paddedNum) return true;
  if (cleanedName === `episode ${numStr}` || cleanedName === `episode ${paddedNum}`) return true;
  if (cleanedName === `tập ${numStr}` || cleanedName === `tập ${paddedNum}`) return true;
  if (cleanedName === `tap ${numStr}` || cleanedName === `tap ${paddedNum}`) return true;

  // Stripped check for patterns like "3:3", "3.3", "3-3", "3/3", "3x3", "3x03", "s3e3", "s03e03"
  const stripped = cleanedName.replace(/^tập\s*/i, '').replace(/^episode\s*/i, '').trim();
  if (/^\d+[\s\.\:\x\-x/e]\d+$/i.test(stripped)) return true;
  if (/^s?\d+[\s\.\:\x\-x/e]s?\d+$/i.test(stripped)) return true;
  if (/^\d+$/i.test(stripped)) return true;
  
  return false;
};

const isSameEpisode = (epAName: string | number | undefined | null, epBName: string | number | undefined | null): boolean => {
  if (!epAName || !epBName) return false;
  const numA = getEpisodeNumber(epAName);
  const numB = getEpisodeNumber(epBName);
  if (numA !== null && numB !== null) return numA === numB;
  return epAName.toString().toLowerCase().trim() === epBName.toString().toLowerCase().trim();
};

const getCertification = (tmdbData: any, isTv: boolean): string => {
  if (!tmdbData) return "";
  if (isTv) {
    const ratings = tmdbData.content_ratings?.results || [];
    const usRating = ratings.find((r: any) => r.iso_3166_1 === 'US')?.rating;
    if (usRating) return usRating;
    const vnRating = ratings.find((r: any) => r.iso_3166_1 === 'VN')?.rating;
    if (vnRating) return vnRating;
    return ratings[0]?.rating || "";
  } else {
    const results = tmdbData.release_dates?.results || [];
    const usResult = results.find((r: any) => r.iso_3166_1 === 'US');
    if (usResult) {
      const cert = usResult.release_dates?.find((d: any) => d.certification)?.certification;
      if (cert) return cert;
    }
    const vnResult = results.find((r: any) => r.iso_3166_1 === 'VN');
    if (vnResult) {
      const cert = vnResult.release_dates?.find((d: any) => d.certification)?.certification;
      if (cert) return cert;
    }
    for (const res of results) {
      const cert = res.release_dates?.find((d: any) => d.certification)?.certification;
      if (cert) return cert;
    }
    return "";
  }
};

const formatCurrency = (amount: number | null | undefined): string => {
  if (!amount || amount === 0) return "";
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(2)} tỷ USD`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)} triệu USD`;
  return `$${amount.toLocaleString()}`;
};

const EMPTY_SUBTITLES: any[] = [];

export const MovieDetail: React.FC<{
  slug: string;
  onClose: () => void;
  onSelect: (slug: string) => void;
}> = ({
  slug,
  onClose,
  onSelect,
}) => {
  // Extract season early from slug or URL params before calling hook
  const _isTmdbSlugEarly = slug.startsWith('tmdb-');
  const _slugPartsEarly = _isTmdbSlugEarly ? slug.split('-') : [];
  const _urlSeasonFromSlug = _slugPartsEarly.length > 3 ? parseInt(_slugPartsEarly[3]) : null;
  const _urlSeasonFromParams = (() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const s = p.get('season');
      return s ? Number(s) : null;
    } catch { return null; }
  })();
  const initialSeason = _urlSeasonFromSlug || _urlSeasonFromParams || 1;

  const {
    data, isLoading, isFetching,
    actorsData, imdbRating, metacriticScore, trailerYoutubeId, finalTmdbData, imdbApiData,
    tmdbBackdropUrl: cleanBackdrop, tmdbPosterUrl: cleanPoster,
    activeEp, setActiveEp,
    isPlaying, setIsPlaying,
    inList, handleToggleList,
    servers, selectedServerId, setSelectedServerId
  } = useMovieDetail(slug, initialSeason);

  // Determine media type from slug or TMDB data
  const filteredSeasons = finalTmdbData?.seasons ? finalTmdbData.seasons.filter((s: any) => s.season_number > 0) : [];
  const isTv = filteredSeasons.length > 0;

  const isTmdbSlugLocal = slug.startsWith('tmdb-');
  const slugPartsLocal = isTmdbSlugLocal ? slug.split('-') : [];
  const tmdbMediaTypeLocal: 'movie' | 'tv' = isTv
    ? 'tv'
    : (isTmdbSlugLocal ? (slugPartsLocal[2] as 'movie' | 'tv') || 'movie' : 'movie');

  // Fetch external IDs (imdb_id) for VidSrc URL construction
  const { data: externalIdsData, isLoading: isExternalIdsLoading } = useTmdbExternalIds(
    finalTmdbData?.id,
    tmdbMediaTypeLocal
  );
  const resolvedImdbId: string | null = externalIdsData?.imdb_id || null;

  const getEmbedUrl = (ep: any) => {
    if (!ep?.link_embed) return "";
    let url = ep.link_embed;
    // Substitute dynamic placeholders seamlessly
    url = url.replace("{season}", (validatedActiveEpSeason || 1).toString());
    return url;
  };

  const [isShowingTrailer, setIsShowingTrailer] = useState(false);
  const [showCollectionPage, setShowCollectionPage] = useState(false);
  const [searchEp, setSearchEp] = useState("");
  const [showMobileEpDropdown, setShowMobileEpDropdown] = useState(false);
  const [showMobileDetails, setShowMobileDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // Lock body scroll when movie details are open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleShare = async () => {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: finalTmdbData?.name || movie?.name || "Cinemax",
          text: `Xem phim ${finalTmdbData?.name || movie?.name || "Cinemax"} cực hay tại đây!`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch (err) {
      try {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch (clipboardErr) {
        // Fail silently
      }
    }
  };

  // Console logging to help developer check IMDb API Status and details
  useEffect(() => {
    if (isLoading || isFetching) return;
    
    console.log("%c[Cinemax Debugger] Movie Detail Load Information", "background: #111; color: #00ffd0; font-weight: bold; font-size: 13px; padding: 4px 8px; border-radius: 4px;");
    
    // TMDB Info
    if (finalTmdbData) {
      const cert = getCertification(finalTmdbData, isTv);
      console.log(`%cTMDB API Details:`, "color: #ff9900; font-weight: bold;");
      console.log(`  - Title: ${finalTmdbData.title || finalTmdbData.name}`);
      console.log(`  - Original Title: ${finalTmdbData.original_title || finalTmdbData.original_name}`);
      console.log(`  - Media Type: ${tmdbMediaTypeLocal}`);
      console.log(`  - TMDB ID: ${finalTmdbData.id}`);
      if (tmdbMediaTypeLocal === 'movie') {
        console.log(`  - Kinh phí (Budget): ${formatCurrency(finalTmdbData.budget) || 'Không rõ'}`);
        console.log(`  - Doanh thu (Revenue): ${formatCurrency(finalTmdbData.revenue) || 'Không rõ'}`);
      }
      console.log(`  - Giới hạn độ tuổi (Certification): ${cert || 'Chưa phân loại (N/A)'}`);
    } else {
      console.log("%cTMDB API Details: Not Loaded / Unavailable", "color: #ea4335;");
    }

    // IMDb Info
    if (resolvedImdbId) {
      console.log(`%cIMDb API Connection:`, "color: #f5c518; font-weight: bold;");
      console.log(`  - Resolved IMDb ID: ${resolvedImdbId}`);
      if (imdbApiData) {
        console.log("%c  - IMDb API Status: ACTIVE (Successfully fetched)", "color: #34a853;");
        console.log(`  - IMDb Rating: ${imdbApiData.rating?.aggregateRating || 'N/A'} (Lượt đánh giá: ${imdbApiData.rating?.voteCount?.toLocaleString() || 0})`);
        console.log(`  - Metascore: ${imdbApiData.metacritic?.score || 'N/A'} (Lượt đánh giá: ${imdbApiData.metacritic?.reviewCount || 0})`);
        console.log(`  - Genres: ${imdbApiData.genres?.join(', ') || 'N/A'}`);
        console.log(`  - Spoken Languages: ${imdbApiData.spokenLanguages?.map((l: any) => l.name).join(', ') || 'N/A'}`);
        console.log(`  - Plot summary: ${imdbApiData.plot || 'N/A'}`);
        console.log("  - Full IMDb API JSON Response:", imdbApiData);
      } else {
        console.log("%c  - IMDb API Status: LOADING / FAILED / PENDING PROXY RESOLVE", "color: #ea4335;");
      }
    } else {
      console.log("%cIMDb API Connection: Offline (No IMDb ID resolved for this title)", "color: #9e9e9e;");
    }
  }, [finalTmdbData, imdbApiData, resolvedImdbId, isLoading, isFetching, isTv, tmdbMediaTypeLocal]);

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

  const [savedProgress, setSavedProgress] = useState<{
    episodeName: string;
    currentTime: number;
    duration: number;
    season?: number;
  } | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('cinemax_progress');
      if (stored) {
        const parsed = JSON.parse(stored);
        const saved = parsed[slug];
        if (saved && saved.episodeName && saved.currentTime > 0) {
          setSavedProgress(saved);
        } else {
          setSavedProgress(null);
        }
      }
    } catch (e) {}
  }, [slug, isPlaying]);

  // Reset season/episode selections immediately when slug changes to avoid state inheritance
  useEffect(() => {
    setActiveSeasonNumber(null);
    setActiveEpSeason(1);
    setSearchEp("");
  }, [slug]);

  const actorsScrollRef = useRef<HTMLDivElement>(null);
  const episodesScrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = (ref: React.RefObject<HTMLDivElement | null>, direction: "left" | "right") => {
    if (ref.current) {
      const scrollAmount = direction === "left" ? -400 : 400;
      ref.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const isTmdbSlug = slug.startsWith('tmdb-');
  const slugParts = isTmdbSlug ? slug.split('-') : [];
  const urlSeason = slugParts.length > 3 ? parseInt(slugParts[3]) : null;

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
  const currentSeason = validatedActiveSeasonNumber !== null ? validatedActiveSeasonNumber : (urlSeason || defaultSeason);
  
  const cleanTitleForSeasonSearch = (title: string | undefined | null): string => {
    if (!title) return "";
    return String(title)
      .replace(/\s*[\(\[]?(Phần|Season|Mùa|SS|Part|Vol|Tập|Ep)\s*\d+[\)\]]?/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const { data: seasonData, isFetching: isFetchingTmdbSeason } = useTmdbTvSeason(isTv ? finalTmdbData?.id : null, currentSeason);

  const handleSeasonSwitch = (sn: number) => {
    setActiveSeasonNumber(sn);
    setSelectedServerId(0);
    // Do NOT call setIsPlaying(false) here — that would collapse the player.
    // The season list in the drawer updates reactively; user selects an episode manually.
  };

  const { data: seasonServerData } = useQuery({
    queryKey: ["season-servers", slug, finalTmdbData?.id, currentSeason],
    queryFn: async () => {
        if (!isTv || !finalTmdbData) return null;
        
        const titlesToSearch = [
            cleanTitleForSeasonSearch(finalTmdbData?.name),
            cleanTitleForSeasonSearch(finalTmdbData?.original_name),
            cleanTitleForSeasonSearch(data?.movie?.name)
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

        // Fetch search terms sequentially and stop on the first match to avoid flooding requests
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

        // Fallback: search base titles without season suffix sequentially if no results found
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
            const tmdbYear = finalTmdbData?.first_air_date ? parseInt(finalTmdbData.first_air_date.substring(0,4)) : 0;
            const scoredMatches = results.map((item: any) => ({
                ...item,
                score: computeMatchScore(item, { title: matchedTitle, original_title: finalTmdbData?.name || "", year: tmdbYear, type: 'tv' }) 
                       + (currentSeason > 1 && (item.slug.includes(currentSeason.toString()) || item.name.includes(currentSeason.toString())) ? 50 : 0)
            })).sort((a: any, b: any) => b.score - a.score);
            seasonSlug = scoredMatches[0].slug;
            originalSlug = scoredMatches[0].originalSlug;
        }

        const targetSlug = originalSlug || seasonSlug;
        if (targetSlug) {
            const detail = await fetchDetail(targetSlug);
            return detail?.episodes || [];
        }
        return [];
    },
    enabled: isTv && !!finalTmdbData?.id && !!currentSeason && !isLoading && (isTmdbSlug || data?.movie?.slug === slug),
    staleTime: 1000 * 60 * 60 * 24 // 24h
  });

  const isAnime = useMemo(() => {
    return slug.startsWith('anilist-') || !!(
      (finalTmdbData?.original_language === 'ja' &&
        finalTmdbData?.genres?.some((g: any) => g.id === 16 || g.name?.toLowerCase() === 'animation' || g.name?.toLowerCase() === 'hoạt hình')) ||
      data?.movie?.category?.some((c: any) => c.name?.toLowerCase() === 'hoạt hình' || c.name?.toLowerCase() === 'anime')
    );
  }, [slug, finalTmdbData, data?.movie]);

  const currentServers = useMemo(() => {
    if (isTv) {
      let list: any[] = [];
      
      if (seasonServerData && seasonServerData.length > 0) {
        list = seasonServerData.map((s: any) => {
          let newName = s.server_name;
          const lowerName = s.server_name?.toLowerCase() || '';
          if (lowerName.includes("châu âu")) newName = "VIP (Mượt) - " + s.server_name;
          else if (lowerName.includes("lồng tiếng") || lowerName.includes("thuyết minh")) newName = "Lồng Tiếng - " + s.server_name;
          
          return {
             ...s,
             server_name: newName || s.server_name
          };
        });
      } else {
        // While loading or if empty, we populate with placeholders for KKPhim, OPhim
        list = [
          { server_name: 'OPhim', server_data: [], status: isFetchingTmdbSeason ? 'loading' : 'empty' },
          { server_name: 'KKPhim', server_data: [], status: isFetchingTmdbSeason ? 'loading' : 'empty' }
        ];
      }

      // Merge HiAnime from useMovieDetail servers (which contains the resolved anime streams)
      if (isAnime) {
        const hianimeServer = servers.find((s: any) => s.server_name.includes("HiAnime"));
        if (hianimeServer) {
          list.push(hianimeServer);
        }
      }

      // Filter out completely empty/error servers if we have at least one active server
      const hasAtLeastOneActiveServer = list.some((s: any) => s.status === 'ok');
      if (hasAtLeastOneActiveServer) {
        list = list.filter((s: any) => s.status === 'ok');
      }
      
      // Thêm CinemaOS và Hollysheesh vào currentServers cho TV series
      if (finalTmdbData?.id) {
          let baseEps: any[] = [];
          const firstServerWithEps = list.find((s: any) => s.server_data && s.server_data.length > 0);
          if (firstServerWithEps) {
              baseEps = firstServerWithEps.server_data;
          } else {
              const epCount = finalTmdbData.number_of_episodes || 1;
              baseEps = Array.from({length: Math.min(epCount, 50)}).map((_, i) => ({
                  name: `${i + 1}`,
                  filename: `Tập ${i + 1}`
               }));
          }
          const cinemaosServerData = baseEps.map((ep: any, index: number) => {
             const epNum = parseInt(ep.name) || (index + 1);
             return {
                 ...ep,
                 link_embed: `https://cinemaos.tech/player/${finalTmdbData.id}/${currentSeason}/${epNum}?theme=ffffff`,
                 link_m3u8: ""
             }
          });
          if (cinemaosServerData.length > 0) {
              list = [...list, {
                  server_name: "Community Server (CinemaOS)",
                  server_data: cinemaosServerData,
                  status: 'ok'
              }];
          }
          const hollysheeshServerData = baseEps.map((ep: any) => ({
              ...ep,
              link_embed: "",
              link_m3u8: ""
          }));
          if (hollysheeshServerData.length > 0) {
              list = [{
                  server_name: "VIP Server (Hollysheesh)",
                  server_data: hollysheeshServerData,
                  status: 'ok',
                  _isHollysheesh: true
              }, ...list];
          }

          // --- VidNest (VIP Server) + Sub Việt ---
          const vidNestServerData = baseEps.map((ep: any, index: number) => ({
            ...ep,
            name: ep.name || `${index + 1}`,
            filename: ep.filename || `Tập ${index + 1}`,
            link_m3u8: '',
            link_embed: '',
          }));
          if (vidNestServerData.length > 0) {
            list = [...list, {
              server_name: "VidNest (Community) — Sub Việt",
              server_data: vidNestServerData,
              status: 'ok',
              _isVidNest: true,
              _tmdbId: finalTmdbData.id,
              _mediaType: 'tv' as const,
            }];
          }
      }
      return list;
    }

    // For movies: append VidSrc server after existing servers.
    // Note: `movie` is not in scope here (it's defined after the loading guard);
    // use data?.movie?.name instead.
    if (finalTmdbData?.id) {
      const movieEpPlaceholder = [
        {
          name: '1',
          filename: data?.movie?.name || finalTmdbData?.title || finalTmdbData?.name || 'Phim',
          link_m3u8: '',
          link_embed: '',
        },
      ];
      return [
        {
          server_name: "VIP Server (Hollysheesh)",
          server_data: movieEpPlaceholder,
          status: 'ok',
          _isHollysheesh: true
        },
        ...servers,
        {
          server_name: "Community Server (CinemaOS)",
          server_data: movieEpPlaceholder.map(ep => ({
             ...ep,
             link_embed: `https://cinemaos.tech/player/${finalTmdbData.id}?theme=ffffff`,
             link_m3u8: ""
          })),
          status: 'ok'
        },
        {
          server_name: "VidNest (Community) — Sub Việt",
          server_data: movieEpPlaceholder,
          status: 'ok',
          _isVidNest: true,
          _tmdbId: finalTmdbData.id,
          _mediaType: 'movie' as const,
        },
      ];
    }
    
    return servers;
  }, [servers, isTv, isAnime, seasonServerData, finalTmdbData?.id, currentSeason, isFetchingTmdbSeason]);

  const isCinemaOS = useMemo(() => {
    return currentServers?.[selectedServerId]?.server_name?.includes("CinemaOS");
  }, [currentServers, selectedServerId]);

  const isHollysheesh = useMemo(() => {
    return currentServers?.[selectedServerId]?._isHollysheesh || currentServers?.[selectedServerId]?.server_name?.includes("Hollysheesh");
  }, [currentServers, selectedServerId]);


  // Ensure selectedServerId doesn't get out of bounds when list sizes shift dynamically
  useEffect(() => {
    if (currentServers && currentServers.length > 0) {
      if (selectedServerId < 0 || selectedServerId >= currentServers.length) {
        let firstFastIdx = currentServers.findIndex((s: any) => s.status !== 'empty' && s.status !== 'error' && s.server_name.includes("Hollysheesh"));
        if (firstFastIdx === -1) {
          firstFastIdx = currentServers.findIndex((s: any) => s.status !== 'empty' && s.status !== 'error' && !s.server_name.includes("CinemaOS"));
        }
        if (firstFastIdx !== -1) {
          setSelectedServerId(firstFastIdx);
        } else {
          const firstValidIdx = currentServers.findIndex((s: any) => s.status !== 'empty' && s.status !== 'error');
          setSelectedServerId(firstValidIdx !== -1 ? firstValidIdx : 0);
        }
      }
    }
  }, [currentServers, selectedServerId]);

  const streamQuery = useMemo(() => {
    const translations = finalTmdbData?.translations?.translations || [];
    const enData = translations.find((t: any) => t.iso_639_1 === 'en')?.data;
    const enTitle = enData?.name || enData?.title || '';

    return {
      tmdbId: finalTmdbData?.id,
      imdbId: resolvedImdbId,
      year: finalTmdbData?.release_date 
        ? finalTmdbData.release_date.split('-')[0] 
        : (finalTmdbData?.first_air_date 
           ? finalTmdbData.first_air_date.split('-')[0] 
           : (data?.movie?.year || null)),
      title: isAnime 
        ? (enTitle || finalTmdbData?.name || finalTmdbData?.title || finalTmdbData?.original_name || finalTmdbData?.original_title || data?.movie?.origin_name || '')
        : (data?.movie?.origin_name || finalTmdbData?.original_title || finalTmdbData?.original_name || ''),
      titleVi: finalTmdbData?.title || finalTmdbData?.name || data?.movie?.name || '',
      type: isTv ? 'tv' as const : 'movie' as const,
      season: isTv ? (currentSeason || 1) : undefined,
      episode: isTv ? (getEpisodeNumber(activeEp?.name) || 1) : undefined,
      viSlug: data?.movie?.slug || slug,
      casts: finalTmdbData?.credits?.cast?.slice(0, 8).map((c: any) => c.name || c.original_name) || [],
      isAnime,
      hianimeEpisodeId: activeEp?.hianime_episode_id,
    };
  }, [finalTmdbData, resolvedImdbId, data?.movie, isTv, currentSeason, activeEp?.name, activeEp?.hianime_episode_id, slug, isAnime]);

  const {
    streams,
    providers,
    isLoading: isAggregatorLoading,
    activeStream,
    selectedStream,
    selectStream,
    retry: retryAggregate,
  } = useStreamAggregator({
    query: streamQuery,
    servers: currentServers,
    activeEpName: activeEp?.name || '1',
    enabled: !!activeEp && !isLoading,
  });

  const { data: subData } = useQuery({
    queryKey: ["subtitles", finalTmdbData?.id, isTv, currentSeason, activeEp?.name, resolvedImdbId],
    queryFn: async () => {
      if (!finalTmdbData?.id) return null;
      const tmdbId = finalTmdbData.id;
      const mediaType = isTv ? 'tv' : 'movie';
      const season = isTv ? (currentSeason || 1) : undefined;
      const episode = isTv ? (getEpisodeNumber(activeEp?.name) || 1) : undefined;
      
      const { fetchSubtitles } = await import('../../api/subtitleApi');
      
      try {
        const viRes = await fetchSubtitles(tmdbId, mediaType, season, episode, 'vi', resolvedImdbId).catch(() => ({ tracks: [], source: 'none' as const }));
        const viTracks = (viRes?.tracks || []).map(t => ({ ...t, lang: 'vi' }));
        
        return {
          tracks: viTracks,
          source: viRes?.source || 'none'
        };
      } catch (err) {
        console.warn('[MovieDetail] fetchSubtitles failed:', err);
        return { tracks: [], source: 'none' };
      }
    },
    enabled: !!finalTmdbData?.id && isPlaying && !!activeEp && !isExternalIdsLoading,
    staleTime: 1000 * 60 * 60 * 24 // 24h
  });

  const bestSubUrl = useMemo(() => {
    // Prioritize subtitles from the active stream (e.g. CinePro)
    if (activeStream?.subtitles && activeStream.subtitles.length > 0) {
      // Look for Vietnamese first
      const viSub = activeStream.subtitles.find(
        s => s.lang.toLowerCase().includes('viet') || s.lang.toLowerCase() === 'vi'
      );
      if (viSub) return viSub.url;
      return null;
    }

    if (!subData?.tracks || subData.tracks.length === 0) return null;
    
    // Prioritize Vietnamese
    const viTracks = subData.tracks.filter(t => t.lang === 'vi');
    if (viTracks.length > 0) {
      const sortedVi = [...viTracks].sort((a, b) => b.rating - a.rating);
      return sortedVi[0]?.downloadUrl || null;
    }
    
    return null;
  }, [subData, activeStream]);

  const limitedSubtitles = useMemo(() => {
    if (!subData?.tracks) return EMPTY_SUBTITLES;
    return [...subData.tracks]
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 3);
  }, [subData?.tracks]);

  // Sync player states to URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (isPlaying) {
      params.set("play", "true");
    } else {
      params.delete("play");
    }
    if (activeEp?.name) {
      params.set("ep", activeEp.name);
    } else {
      params.delete("ep");
    }
    if (currentSeason) {
      params.set("season", String(currentSeason));
    } else {
      params.delete("season");
    }

    const queryString = params.toString();
    const newUrl = queryString ? `/?${queryString}` : "/";

    if (window.location.search !== (queryString ? `?${queryString}` : "")) {
      window.history.pushState({}, "", newUrl);
    }
  }, [isPlaying, activeEp, currentSeason]);

  // Handle browser back / forward buttons for player state
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const play = params.get("play") === "true";
      const epParam = params.get("ep");
      const seasonParam = params.get("season");

      setIsPlaying(play);
      if (seasonParam) {
        setActiveSeasonNumber(Number(seasonParam));
      }
      if (epParam && currentServers) {
        for (const srv of currentServers) {
          const ep = srv.server_data?.find((e: any) => {
            if (!e?.name) return false;
            const clean = (s: string) => String(s).toLowerCase().replace(/\D/g, '').trim();
            const eName = String(e.name).toLowerCase().trim();
            const uName = String(epParam).toLowerCase().trim();
            if (eName === uName) return true;
            const eClean = clean(eName);
            const uClean = clean(uName);
            return eClean && uClean && eClean === uClean;
          });
          if (ep) {
            setActiveEp(ep);
            if (seasonParam) {
              setActiveEpSeason(Number(seasonParam));
            }
            break;
          }
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [currentServers, setIsPlaying, setActiveEp, setActiveEpSeason]);

  // Auto-select stream to match the selected virtual server
  // Forward sync: only fires when selectedServerId explicitly changes (not when activeStream changes)
  useEffect(() => {
    if (!isPlaying || streams.length === 0) return;
    // Only run when selectedServerId actually changed
    if (selectedServerId === prevSelectedServerIdRef.current) return;
    prevSelectedServerIdRef.current = selectedServerId;

    const currentSrv = currentServers[selectedServerId] || currentServers[0];
    if (!currentSrv) return;

    const srvName = currentSrv.server_name?.toLowerCase() || '';

    let targetStream = null;
    if (currentSrv._isHollysheesh || srvName.includes('hollysheesh')) {
      targetStream = streams.find((s: any) => s.provider === 'hollysheesh');
    } else if (currentSrv._isVidNest) {
      targetStream = streams.find((s: any) => s.provider.startsWith('vidnest') || s.url?.includes('vidnest'));
    } else if (srvName.includes('cinemaos')) {
      targetStream = streams.find((s: any) => s.provider === 'cinemaos' || s.url?.includes('cinemaos.tech'));
    } else if (srvName.includes('ophim')) {
      targetStream = streams.find((s: any) => s.provider === 'ophim' || s.url?.includes('ophim'));
    } else if (srvName.includes('kkphim')) {
      targetStream = streams.find((s: any) => s.provider === 'kkphim' || s.url?.includes('kkphim'));
    } else if (srvName.includes('nguonc')) {
      targetStream = streams.find((s: any) => s.provider === 'nguonc' || s.url?.includes('nguonc'));
    }

    // Read current activeStream from ref — does NOT create a dep-loop
    if (targetStream && activeStreamRef.current?.id !== targetStream.id) {
      console.log(`[MovieDetail] Server changed → switching stream to match (${currentSrv.server_name}):`, targetStream.providerLabel);
      selectStream(targetStream);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, currentServers, selectedServerId, streams, selectStream]);

  // Sync selectedServerId when selectedStream changes (e.g. user selects a source inside the player)
  useEffect(() => {
    if (!selectedStream || !currentServers || currentServers.length === 0) return;

    const provider = selectedStream.provider?.toLowerCase() || '';
    const label = selectedStream.providerLabel?.toLowerCase() || '';
    const url = selectedStream.url?.toLowerCase() || '';

    let targetIdx = -1;

    if (provider.startsWith('vidnest') || url.includes('vidnest')) {
      targetIdx = currentServers.findIndex((s: any) => s._isVidNest);
    } else if (provider === 'ophim' || label.includes('ophim') || url.includes('ophim1.com') || url.includes('opstream')) {
      targetIdx = currentServers.findIndex((s: any) => s.server_name?.toLowerCase().includes('ophim'));
    } else if (provider === 'kkphim' || label.includes('kkphim') || url.includes('phimapi.com') || url.includes('kkphim')) {
      targetIdx = currentServers.findIndex((s: any) => s.server_name?.toLowerCase().includes('kkphim'));
    } else if (provider === 'nguonc' || label.includes('nguonc') || label.includes('xem20') || url.includes('nguonc.com')) {
      targetIdx = currentServers.findIndex((s: any) => s.server_name?.toLowerCase().includes('nguonc'));
    } else if (provider === 'cinemaos' || url.includes('cinemaos.tech')) {
      targetIdx = currentServers.findIndex((s: any) => s.server_name?.toLowerCase().includes('cinemaos'));
    } else if (provider === 'hollysheesh') {
      targetIdx = currentServers.findIndex((s: any) => s._isHollysheesh || s.server_name?.toLowerCase().includes('hollysheesh'));
    }
    // Community sources (vidsrc, 2embed, etc.) do not have a dedicated virtual server — skip backward sync

    if (targetIdx !== -1 && targetIdx !== selectedServerId) {
      console.log("[MovieDetail] Syncing selectedServerId to match selectedStream:", currentServers[targetIdx].server_name);
      setSelectedServerId(targetIdx);
    }
  }, [selectedStream, currentServers, selectedServerId]);

  // Auto-select server & episode when season data loads
  // Server selection always runs (so the drawer shows correct episodes).
  // Episode selection is blocked when the player is actively playing.
  const lastProcessedSeasonDataRef = useRef<any>(null);
  const activeStreamRef = useRef<any>(null);
  const prevSelectedServerIdRef = useRef<number>(-1);

  // Keep activeStreamRef in sync without causing dep loops
  useEffect(() => { activeStreamRef.current = activeStream; }, [activeStream]);
  useEffect(() => {
    if (!isTv || !seasonServerData || seasonServerData.length === 0) return;
    // Avoid re-processing the exact same data object (React Query ref-equality)
    if (seasonServerData === lastProcessedSeasonDataRef.current) return;
    lastProcessedSeasonDataRef.current = seasonServerData;

    // 1. Only find the best server automatically if the player is NOT actively playing
    let targetServerIdx = -1;
    if (!isPlaying) {
      targetServerIdx = seasonServerData.findIndex((s: any) => 
        s.server_data?.length > 0 && 
        s.status !== 'empty' && 
        s.status !== 'error' && 
        s.server_name.toLowerCase().includes("hollysheesh")
      );
      if (targetServerIdx === -1) {
        targetServerIdx = seasonServerData.findIndex((s: any) => 
          s.server_data?.length > 0 && 
          s.status !== 'empty' && 
          s.status !== 'error' && 
          !s.server_name.toLowerCase().includes("cinemaos")
        );
      }
      if (targetServerIdx === -1) {
        targetServerIdx = seasonServerData.findIndex((s: any) => s.server_data?.length > 0);
      }
      if (targetServerIdx !== -1) {
        setSelectedServerId(targetServerIdx);
      }
    } else {
      targetServerIdx = selectedServerId;
    }

    // 2. Only auto-select an episode when the player is NOT actively playing.
    //    When the user browses seasons inside the drawer, isPlaying is true,
    //    so we skip episode selection entirely — the user picks one manually.
    if (isPlaying) return;

    if (targetServerIdx !== -1) {
      const selectedServer = currentServers[targetServerIdx];
      if (!selectedServer) return;
      // Check URL query parameter first
      const params = new URLSearchParams(window.location.search);
      const urlEp = params.get("ep");
      
      // Then check localStorage progress
      let progressEpName = urlEp;
      if (!progressEpName) {
        try {
          const stored = localStorage.getItem('cinemax_progress');
          if (stored) {
            const parsed = JSON.parse(stored);
            const saved = parsed[slug];
            if (saved && saved.episodeName) {
              progressEpName = saved.episodeName;
            }
          }
        } catch (e) {}
      }
      
      let matchedEp = null;
      if (progressEpName) {
        matchedEp = selectedServer.server_data.find((e: any) => {
          if (!e?.name) return false;
          const clean = (s: string) => String(s).toLowerCase().replace(/\D/g, '').trim();
          const eName = String(e.name).toLowerCase().trim();
          const pName = String(progressEpName).toLowerCase().trim();
          if (eName === pName) return true;
          const eClean = clean(eName);
          const pClean = clean(pName);
          return eClean && pClean && eClean === pClean;
        });
      }
      
      setActiveEp(matchedEp || selectedServer.server_data[0]);
      setActiveEpSeason(currentSeason || 1);
    }
  }, [currentSeason, seasonServerData, currentServers, isTv, setActiveEp, setSelectedServerId, slug, isPlaying]);

  const parseEpNum = (epNumberStr: string | undefined | null) => {
    if (!epNumberStr) return NaN;
    const raw = epNumberStr.toString().replace(/\D/g, '');
    return raw ? parseInt(raw) : NaN;
  };

  const getEpOverview = (epNumberStr: string, existingOverview?: string) => {
    if (existingOverview) return existingOverview;
    const num = parseEpNum(epNumberStr);
    if (!isNaN(num) && seasonData?.episodes) {
        const found = seasonData.episodes.find((e: any) => e.episode_number === num);
        if (found?.overview) return found.overview;
    }
    return undefined;
  };

  const getEpStillPath = (epNumberStr: string, existingStillPath?: string) => {
    if (existingStillPath) {
        if (existingStillPath.startsWith('http')) return existingStillPath;
        return `https://image.tmdb.org/t/p/w300/${existingStillPath.split('/').pop()}`;
    }
    const num = parseEpNum(epNumberStr);
    if (!isNaN(num) && seasonData?.episodes) {
        const found = seasonData.episodes.find((e: any) => e.episode_number === num);
        if (found?.still_path) return `https://image.tmdb.org/t/p/w300/${found.still_path.split('/').pop()}`;
    }
    return undefined;
  };

  const getEpRating = (epNumberStr: string) => {
    const num = parseEpNum(epNumberStr);
    if (!isNaN(num) && seasonData?.episodes) {
        const found = seasonData.episodes.find((e: any) => e.episode_number === num);
        if (found?.vote_average && found.vote_average > 0) return found.vote_average.toFixed(1);
    }
    return undefined;
  };

  if (isLoading)
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[150] bg-[#050505] flex flex-col justify-center items-center"
      >
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </motion.div>
    );

  if (!data?.movie) return null;
  const { movie } = data;

  const currentServer = currentServers[selectedServerId] || currentServers[0];
  const fallbackRawEpList = currentServer?.server_data || [];
  
  // Use server episode list if available (actual episodes from provider).
  // If the selected server has no server_data (e.g. Hollysheesh which only provides stream URLs),
  // fall back to TMDB season episodes so the UI episode list stays visible.
  const baseEpList = isTv
    ? (fallbackRawEpList.length > 0 ? fallbackRawEpList : (seasonData?.episodes || []))
    : fallbackRawEpList;

  const epList = searchEp ? baseEpList.filter((ep: any) => {
    const epName = ep.episode_number ? `${ep.episode_number}` : ep.name;
    // Match with TMDB metadata episodes object
    const tmdbEp = isTv && seasonData?.episodes
      ? seasonData.episodes.find((t: any) => isSameEpisode(t.episode_number || t.name, ep.name || ep.episode_number))
      : null;
    const overview = getEpOverview(epName, tmdbEp?.overview || ep.overview);
    return epName.toLowerCase().includes(searchEp.toLowerCase()) || 
           overview?.toLowerCase().includes(searchEp.toLowerCase());
  }) : baseEpList;

  const handleSelectEpisode = (ep: any, autoPlay: boolean = true) => {
    let phimApiEp = ep;
    if (ep.episode_number) {
       if (isCinemaOS) {
          phimApiEp = {
             name: `${ep.episode_number}`,
             filename: `Tập ${ep.episode_number}`,
             link_embed: `https://cinemaos.tech/player/${finalTmdbData?.id}/${currentSeason}/${ep.episode_number}?theme=ffffff&autoPlay=true`,
             link_m3u8: ""
          };
       } else {
          const currentSeasonServer = seasonServerData?.[selectedServerId] || seasonServerData?.[0];
          const serverEps = currentSeasonServer?.server_data || [];
          phimApiEp = serverEps.find((e: any) => isSameEpisode(e.name, ep.episode_number));
          
          if (!phimApiEp) {
             // Wrap it into a CinemaOS fallback if server isn't ready or doesn't have it
             phimApiEp = {
                name: `${ep.episode_number}`,
                filename: `Tập ${ep.episode_number}`,
                link_embed: `https://cinemaos.tech/player/${finalTmdbData?.id}/${currentSeason}/${ep.episode_number}?theme=ffffff`,
                link_m3u8: ""
             };
          }
       }
    }
    
    setActiveEpSeason(currentSeason || 1);
    setActiveEp(phimApiEp);
    if (autoPlay) {
      setIsPlaying(true);
    }
  };

  const getPlayButtonText = () => {
    if (savedProgress) {
      if (isTv) {
        return `Xem tiếp (Tập ${savedProgress.episodeName.replace("Tập ", "")})`;
      } else {
        return "Xem tiếp";
      }
    }
    return isTv ? "Xem ngay / Chọn tập" : "Xem ngay";
  };

  const getDesktopPlayButtonText = () => {
    if (savedProgress) {
      if (isTv) {
        return `Xem tiếp: Tập ${savedProgress.episodeName.replace("Tập ", "")}`;
      } else {
        return "Xem tiếp";
      }
    }
    return isTv ? `Xem Tập ${activeEp?.name?.replace("Tập ", "") || "1"}` : "Xem Phim";
  };

  const handlePlayOrResume = () => {
    if (savedProgress) {
      let targetEp = activeEp;
      if (!targetEp || !isSameEpisode(targetEp.name, savedProgress.episodeName)) {
        for (const srv of currentServers) {
          const found = srv.server_data?.find((e: any) => isSameEpisode(e.name, savedProgress.episodeName));
          if (found) {
            targetEp = found;
            break;
          }
        }
      }
      if (targetEp) {
        handleSelectEpisode(targetEp, true);
      } else if (epList[0]) {
        handleSelectEpisode(epList[0], true);
      }
    } else {
      if (epList[0] && !activeEp) handleSelectEpisode(epList[0]);
      else if (activeEp) setIsPlaying(true);
      else if (epList[0]) handleSelectEpisode(epList[0]);
    }
  };

  const fbUrl = movie.thumb_url || movie.poster_url;
  const tmdbBackdropUrl = cleanBackdrop || (finalTmdbData?.backdrop_path ? (finalTmdbData.backdrop_path?.startsWith('http') ? finalTmdbData.backdrop_path : `https://image.tmdb.org/t/p/original/${finalTmdbData.backdrop_path?.split('/').pop()}`) : null);
  const tmdbPosterUrl = cleanPoster || (finalTmdbData?.poster_path ? (finalTmdbData.poster_path?.startsWith('http') ? finalTmdbData.poster_path : `https://image.tmdb.org/t/p/w780/${finalTmdbData.poster_path?.split('/').pop()}`) : null);
  
  // Official transparent logo overlay (prioritize English, fallback to neutral, Japanese, Korean, Vietnamese, then first logo)
  const logoFile = finalTmdbData?.images?.logos
    ? (finalTmdbData.images.logos.find((l: any) => l.iso_639_1 === 'en')?.file_path ||
       finalTmdbData.images.logos.find((l: any) => !l.iso_639_1)?.file_path ||
       finalTmdbData.images.logos.find((l: any) => l.iso_639_1 === 'ja')?.file_path ||
       finalTmdbData.images.logos.find((l: any) => l.iso_639_1 === 'ko')?.file_path ||
       finalTmdbData.images.logos.find((l: any) => l.iso_639_1 === 'vi')?.file_path ||
       finalTmdbData.images.logos[0]?.file_path)
    : null;
  const logoUrl = logoFile ? `https://image.tmdb.org/t/p/w500${logoFile.startsWith('/') ? '' : '/'}${logoFile}` : null;
  
  const rawBg = tmdbBackdropUrl || (typeof fbUrl === "string" && fbUrl.startsWith("http") ? fbUrl : `https://phimimg.com/${fbUrl}`);
  const bgDetailImg = proxyImage(rawBg);
  const rawPoster = tmdbPosterUrl || (movie.poster_url && typeof movie.poster_url === 'string' ? (movie.poster_url.startsWith("http") ? movie.poster_url : `https://phimimg.com/${movie.poster_url}`) : rawBg);
  const posterUrl = proxyImage(rawPoster);
  const cleanMovieName = isTv ? `${cleanTitleForSeasonSearch(movie.name)} (Phần ${currentSeason})` : movie.name;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[150] bg-[#050505] overflow-y-auto custom-scrollbar"
    >
      {!showCollectionPage && !isPlaying && (
        <button
          onClick={onClose}
          className="fixed top-6 right-6 z-[120] w-12 h-12 rounded-full bg-black/40 backdrop-blur-xl flex items-center justify-center text-white hover:bg-white hover:text-black transition-all shadow-xl border border-white/20 hover:scale-105"
        >
          <X size={24} />
        </button>
      )}

      {!isPlaying && (
        <div className="absolute top-0 left-0 w-full h-[60vh] sm:h-[75vh] 2xl:h-[80vh] pointer-events-none">
            <SafeImage src={bgDetailImg} alt="Hero" className="w-full h-full object-cover object-top opacity-50" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-transparent to-transparent" />
        </div>
      )}

      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-10 pb-20 pt-[20vh] sm:pt-[25vh] md:pt-[35vh] lg:pt-[45vh] relative z-10 flex flex-col gap-6 sm:gap-8 xl:gap-12">
        
        <div className="w-full">
          <AnimatePresence mode="wait">
            {isPlaying && activeEp ? (
              <div className="flex flex-col gap-4 mb-12 -mt-[15vh] sm:-mt-[25vh] lg:-mt-[35vh]">
                <div className="flex justify-between items-center z-[110] relative">
                  <button
                    onClick={() => setIsPlaying(false)}
                    className="flex items-center justify-center gap-2 text-gray-300 hover:text-white bg-black/95 backdrop-blur-md hover:bg-neutral-900 border border-white/15 w-10 h-10 sm:w-auto sm:h-auto sm:px-4 sm:py-2.5 rounded-full transition-all font-bold tracking-wide shadow-lg cursor-pointer hover:scale-105 active:scale-95 shrink-0"
                  >
                    <ChevronLeft size={20} className="sm:hidden" />
                    <ChevronLeft size={16} className="hidden sm:block" /> 
                    <span className="hidden sm:inline text-xs">Quay lại trang thông tin</span>
                  </button>

                  <button
                    onClick={() => setShowReportModal(true)}
                    className="flex items-center justify-center gap-2 text-red-400 hover:text-red-300 bg-red-950/20 hover:bg-red-950/30 border border-red-500/25 hover:border-red-500/40 w-10 h-10 sm:w-auto sm:h-auto sm:px-4 sm:py-2.5 rounded-full transition-all font-bold tracking-wide shadow-lg cursor-pointer hover:scale-105 active:scale-95 shrink-0"
                  >
                    <AlertTriangle size={20} className="sm:hidden" />
                    <AlertTriangle size={16} className="hidden sm:block" />
                    <span className="hidden sm:inline text-xs">Báo lỗi phim</span>
                  </button>
                </div>

                <motion.div 
                  key="player"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className={cn(
                      "w-full rounded-2xl overflow-hidden bg-black shadow-2xl relative z-[110]",
                      activeStream?.type === 'embed' ? "" : "aspect-video"
                    )}
                >
                  <NetflixPlayer
                    key={isTv ? `player-${slug}-${currentSeason}-${activeEp?.name || '1'}` : `player-${slug}-movie`}
                     url={isCinemaOS ? undefined : (activeStream?.type === 'hls' ? activeStream.url : undefined)}
                     embedUrl={
                       activeStream?.type === 'embed'
                         ? activeStream.url
                         : ((!isAggregatorLoading && !activeStream && finalTmdbData?.id)
                             ? (isTv
                                 ? `https://vidsrc.me/embed/tv?tmdb=${finalTmdbData.id}&season=${currentSeason}&episode=${activeEp?.name || 1}`
                                 : `https://vidsrc.me/embed/movie?tmdb=${finalTmdbData.id}`
                               )
                             : undefined)
                     }
                    headers={activeStream?.headers}
                    subtitleUrl={bestSubUrl}
                    externalSubtitles={limitedSubtitles}
                    title={`${cleanMovieName} - ${activeEp?.name || '1'}`}
                    slug={slug}
                    episodeName={activeEp?.name || '1'}
                    posterUrl={posterUrl || ''}
                    thumbUrl={bgDetailImg || ''}
                    movieName={cleanMovieName}
                    onClose={() => setIsPlaying(false)}
                    servers={currentServers}
                    selectedServerId={selectedServerId}
                    tmdbId={finalTmdbData?.id}
                    type={isTv ? 'series' : 'single'}
                    onServerChange={(newId) => {
                      setSelectedServerId(newId);
                      const srvEps = currentServers[newId]?.server_data || [];
                      const matchingEp = srvEps.find((ep: any) => isSameEpisode(ep.name, activeEp?.name));
                      if (matchingEp) {
                        setActiveEp(matchingEp);
                      } else if (srvEps[0]) {
                        setActiveEp(srvEps[0]);
                      }
                    }}
                    episodes={
                      isTv
                        ? (seasonData?.episodes && seasonData.episodes.length > 0
                            ? seasonData.episodes.map((ep: any) => ({
                                ...ep,
                                name: String(ep.episode_number),
                              }))
                            : (currentServers?.[selectedServerId]?.server_data || []))
                        : []
                    }
                    onEpisodeSelect={handleSelectEpisode}
                    isTv={isTv}
                    currentSeason={currentSeason}
                    activeEpSeason={validatedActiveEpSeason}
                    seasons={filteredSeasons}
                    onSeasonChange={handleSeasonSwitch}
                    tmdbEpisodes={seasonData?.episodes || []}
                    streams={streams}
                    activeStream={activeStream}
                    onStreamSelect={selectStream}
                    isAggregatorLoading={isAggregatorLoading}
                  />
                </motion.div>
              </div>
            ) : (
              <motion.div 
                key="info"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col relative z-10 w-full"
              >
                {/* DESKTOP ONLY VIEW (Hidden on Mobile) */}
                <div className="hidden md:flex flex-col md:flex-row gap-8 lg:gap-12 w-full mb-16 items-start">
                  {/* Left Column: Poster & Actions */}
                  <div className="w-[280px] sm:w-[320px] md:w-[340px] shrink-0 flex flex-col gap-4">
                    <SafeImage src={posterUrl} alt="Poster" className="w-full aspect-[2/3] object-cover rounded-xl shadow-[0_20px_40px_rgba(0,0,0,0.8)] border border-white/10" />
                    
                    {isTv && (
                      <div className="flex flex-col sm:flex-row gap-3 w-full">
                        <div className="flex-1">
                          <CustomSelect
                            value={currentSeason || 1}
                            onChange={(val) => handleSeasonSwitch(Number(val))}
                            options={filteredSeasons.map((s: any) => ({
                              label: `Mùa ${s.season_number}`,
                              value: s.season_number
                            }))}
                            className="w-full"
                          />
                        </div>
                        <div className="flex-1">
                          <CustomSelect
                            value={(activeEp?.name && (getEpisodeNumber(activeEp.name)?.toString() || activeEp.name.replace("Tập ", ""))) || ""}
                            onChange={(epName: string) => {
                               const ep = epList.find((e: any) => isSameEpisode(e.episode_number || e.name, epName));
                               if (ep) handleSelectEpisode(ep, false);
                            }}
                            options={epList.map((ep: any) => {
                               const n = ep.episode_number ? `${ep.episode_number}` : ep.name.replace("Tập ", "");
                               return {
                                 label: `Tập ${n}`,
                                 value: n
                               }
                             })}
                            className="w-full"
                          />
                        </div>
                      </div>
                    )}

                    <button 
                      onClick={handlePlayOrResume} 
                      className="w-full bg-[#e50914] hover:bg-[#ff1e24] text-white px-4 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors shadow-lg active:scale-95"
                    >
                      <Play size={18} fill="currentColor" /> {getDesktopPlayButtonText()}
                    </button>

                    {trailerYoutubeId && (
                      <button 
                        onClick={() => setIsShowingTrailer(true)}
                        className="w-full bg-transparent border border-white/20 hover:border-white text-white px-4 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"
                      >
                        <Youtube size={18} /> Xem Trailer
                      </button>
                    )}
                    
                    <div className="flex gap-3">
                      <button onClick={handleToggleList} className="flex-1 bg-transparent border border-white/10 hover:bg-white/10 text-white px-4 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors text-sm">
                         {inList ? <Check size={16} /> : <Plus size={16} />} Lưu Lại
                      </button>
                      <button 
                        onClick={handleShare}
                        className="flex-1 bg-transparent border border-white/10 hover:bg-white/10 text-white px-4 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors text-sm cursor-pointer"
                      >
                         <Share2 size={16} /> Chia Sẻ
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Title, Metadata, Category, Synopsis, Cast */}
                  <div className="flex-1 flex flex-col justify-start text-left w-full">
                    {logoUrl ? (
                      <SafeImage 
                        src={logoUrl} 
                        alt="Logo" 
                        className="w-auto h-24 sm:h-32 object-contain object-left self-start mb-6 drop-shadow-2xl" 
                      />
                    ) : (
                      <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black text-white leading-[1.1] mb-6 drop-shadow-2xl tracking-tighter">
                        {finalTmdbData?.name || finalTmdbData?.title || movie.name}
                      </h1>
                    )}
                    
                    {finalTmdbData?.tagline && (
                      <p className="text-xl text-gray-400 font-medium italic mb-6">"{finalTmdbData.tagline}"</p>
                    )}
                    
                    <div className="flex flex-wrap items-center gap-y-3 gap-x-5 text-sm font-medium text-gray-400 mb-6 border-y border-white/5 py-3.5 w-full">
                      <span className="flex items-center gap-1.5 text-gray-300">
                        <Calendar size={15} className="text-gray-500 shrink-0" /> 
                        {(() => {
                          const startYear = finalTmdbData?.first_air_date ? finalTmdbData.first_air_date.substring(0,4) : (finalTmdbData?.release_date ? finalTmdbData.release_date.substring(0,4) : (movie.year || "2024"));
                          const endYear = finalTmdbData?.last_air_date ? finalTmdbData.last_air_date.substring(0,4) : null;
                          return (isTv && endYear && startYear !== endYear) ? `${startYear} - ${endYear}` : startYear;
                        })()}
                      </span>
                      
                      <span className="flex items-center gap-1.5 text-gray-300">
                        <Film size={15} className="text-gray-500 shrink-0" />
                        {(movie.type === "single" || movie.type === "phimle") ? "Phim Lẻ" : "Phim Bộ"}
                      </span>

                      {movie.quality && (
                        <span className="bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-md text-[10px] font-black tracking-wider text-gray-300 uppercase leading-none">
                          {movie.quality}
                        </span>
                      )}

                      {isTv && finalTmdbData?.number_of_seasons && (
                        <span className="flex items-center gap-1.5 text-gray-300">
                          <Tv size={15} className="text-gray-500 shrink-0" />
                          {finalTmdbData.number_of_seasons} Phần
                        </span>
                      )}
                      
                      {isTv && finalTmdbData?.number_of_episodes && (
                        <span className="flex items-center gap-1.5 text-gray-300">
                          <Users size={15} className="text-gray-500 shrink-0" />
                          {finalTmdbData.number_of_episodes} Tập
                        </span>
                      )}
                      
                      {(!isTv && (finalTmdbData?.runtime || movie.time)) && (
                        <span className="flex items-center gap-1.5 text-gray-300">
                          <Clock size={15} className="text-gray-500 shrink-0" /> 
                          {finalTmdbData?.runtime ? `${finalTmdbData.runtime} phút` : movie.time}
                        </span>
                      )}

                      {(() => {
                        const cert = getCertification(finalTmdbData, isTv);
                        if (!cert) return null;
                        return (
                          <span className="bg-red-600/10 border border-red-500/25 px-2.5 py-0.5 rounded text-[11px] font-black text-red-500 select-none">
                            {cert}
                          </span>
                        );
                      })()}

                      <span className="flex items-center gap-1.5 text-gray-300">
                        <Star size={15} className="text-yellow-500 fill-yellow-500/10 shrink-0" />
                        {imdbRating && imdbRating !== "?" ? imdbRating : "8.0"}
                        {finalTmdbData?.vote_count ? (
                          <span className="text-xs text-gray-500 font-normal">({finalTmdbData.vote_count} bình chọn)</span>
                        ) : null}
                      </span>

                      {metacriticScore && (
                        <span className={cn(
                          "px-2 py-0.5 rounded text-xs font-black select-none tracking-wider",
                          metacriticScore >= 61 ? "bg-green-600 text-white border border-green-500/20" :
                          metacriticScore >= 40 ? "bg-yellow-500 text-black border border-yellow-400/20" :
                          "bg-red-600 text-white border border-red-500/20"
                        )}>
                          {metacriticScore} Metascore
                        </span>
                      )}
                      
                      {(finalTmdbData?.status || movie.status) && (
                        <span className="bg-white/5 border border-white/15 px-3 py-1 rounded-xl text-xs font-bold text-gray-200 select-none ml-auto whitespace-nowrap">
                          {finalTmdbData?.status === "Ended" ? "Đã ra mắt trọn bộ" : 
                           finalTmdbData?.status === "Returning Series" ? "Đang cập nhật" : 
                           (movie.status === "completed" ? "Đã ra mắt trọn bộ" : 
                            movie.status === "ongoing" ? "Đang cập nhật" : 
                            (finalTmdbData?.status || movie.status))}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-8">
                      {(() => {
                        const categories = Array.isArray(finalTmdbData?.genres) ? finalTmdbData.genres : (Array.isArray(movie.category) ? movie.category : []);
                        return categories.slice(0, 4).map((c: any) => (
                        <span key={c.name} className="bg-[#1a1a1a] border border-white/10 px-4 py-1.5 rounded-md text-xs font-bold text-gray-300">
                          {c.name === "Hanh Dong" ? "Hành Động" : 
                           c.name === "Tinh Cam" ? "Tình Cảm" : 
                           c.name === "Hai Huoc" ? "Hài Hước" : 
                           c.name === "Chinh Kich" ? "Chính Kịch" :
                           c.name === "Hinh Su" ? "Hình Sự" : 
                           c.name === "Vien Tuong" ? "Viễn Tưởng" : c.name}
                        </span>
                      ))})() || null}
                    </div>

                    <div className="border border-white/10 rounded-2xl p-6 md:p-8 bg-black/40 backdrop-blur-sm mb-8 w-full max-w-4xl">
                       <h3 className="text-xl font-bold text-white mb-4">Nội Dung</h3>
                       <p className="text-base sm:text-lg text-gray-400 leading-relaxed font-semibold text-justify" dangerouslySetInnerHTML={{ __html: finalTmdbData?.overview || movie.content || "Chúng tôi đang cập nhật nội dung chi tiết cho bộ phim này. Vui lòng quay lại sau." }} />
                    </div>

                    {finalTmdbData && (finalTmdbData.budget > 0 || finalTmdbData.revenue > 0) && (
                      <div className="grid grid-cols-2 gap-4 mb-8 w-full max-w-4xl border border-white/10 rounded-2xl p-6 bg-black/20 backdrop-blur-sm">
                        {finalTmdbData.budget > 0 && (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-neutral-500 font-bold uppercase tracking-wider">Kinh phí</span>
                            <span className="text-base font-bold text-gray-300">{formatCurrency(finalTmdbData.budget)}</span>
                          </div>
                        )}
                        {finalTmdbData.revenue > 0 && (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-neutral-500 font-bold uppercase tracking-wider">Doanh thu</span>
                            <span className="text-base font-bold text-green-400">{formatCurrency(finalTmdbData.revenue)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {actorsData && actorsData.length > 0 && (
                      <div className="flex flex-col gap-6 text-sm font-medium w-full max-w-4xl border-t border-white/10 py-8">
                         <div>
                           <h4 className="text-white mb-4">Diễn Viên</h4>
                           <div className="relative group/scroll w-full">
                             {/* Left Scroll Button */}
                             <button 
                               onClick={() => handleScroll(actorsScrollRef, "left")}
                               className="absolute -left-4 top-1/2 -translate-y-1/2 bg-neutral-900/90 hover:bg-black text-white border border-white/10 w-10 h-10 rounded-full shadow-2xl opacity-0 group-hover/scroll:opacity-100 transition-all duration-300 pointer-events-auto hover:scale-110 active:scale-95 z-20 flex items-center justify-center cursor-pointer"
                               aria-label="Scroll Left"
                             >
                               <ChevronLeft size={18} />
                             </button>

                             <div 
                               ref={actorsScrollRef}
                               className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x w-full scroll-smooth"
                             >
                               {actorsData.slice(0, 15).map((actor: any) => (
                                 <div key={actor.id} className="flex-shrink-0 flex items-center gap-3 bg-[#111] border border-white/10 pr-4 rounded-full snap-start hover:bg-white/5 transition-colors cursor-pointer group">
                                   {actor.image ? (
                                     <img src={actor.image} alt={actor.name} className="w-12 h-12 rounded-full object-cover group-hover:scale-105 transition-transform" />
                                   ) : (
                                     <div className="w-12 h-12 rounded-full bg-[#222] flex items-center justify-center text-gray-500 font-bold uppercase">
                                       {actor.name.charAt(0)}
                                     </div>
                                   )}
                                   <div className="flex flex-col py-1">
                                     <span className="text-gray-200 font-bold max-w-[120px] truncate">{actor.name}</span>
                                     <span className="text-gray-500 text-xs max-w-[120px] truncate">{actor.character}</span>
                                   </div>
                                 </div>
                               ))}
                             </div>

                             {/* Right Scroll Button */}
                             <button 
                               onClick={() => handleScroll(actorsScrollRef, "right")}
                               className="absolute -right-4 top-1/2 -translate-y-1/2 bg-neutral-900/90 hover:bg-black text-white border border-white/10 w-10 h-10 rounded-full shadow-2xl opacity-0 group-hover/scroll:opacity-100 transition-all duration-300 pointer-events-auto hover:scale-110 active:scale-95 z-20 flex items-center justify-center cursor-pointer"
                               aria-label="Scroll Right"
                             >
                               <ChevronRight size={18} />
                             </button>
                           </div>
                         </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* MOBILE ONLY VIEW */}
                <div className="block md:hidden w-full flex flex-col gap-6">
                  {/* Poster - Centered with beautiful border and extreme shadow */}
                  <div className="w-[180px] sm:w-[220px] aspect-[2/3] mx-auto shrink-0 z-10 relative">
                    <SafeImage src={posterUrl} alt="Poster" className="w-full h-full object-cover rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] border border-white/10" />
                  </div>

                  {/* Title & Tagline & Logo */}
                  <div className="flex flex-col items-center text-center px-4 w-full gap-2">
                    {logoUrl ? (
                      <SafeImage 
                        src={logoUrl} 
                        alt="Logo" 
                        className="w-auto h-16 sm:h-20 object-contain mx-auto self-center drop-shadow-2xl mb-1" 
                      />
                    ) : (
                      <h1 className="text-2xl sm:text-3xl font-black text-center text-white leading-tight drop-shadow-2xl tracking-tight">
                        {finalTmdbData?.name || finalTmdbData?.title || movie.name}
                      </h1>
                    )}

                    {finalTmdbData?.tagline && (
                      <p className="text-xs sm:text-sm text-gray-400 font-medium italic mt-1 max-w-md">"{finalTmdbData.tagline}"</p>
                    )}
                  </div>

                  {/* Badges/Metadata Pill layout - Sleek, centered pills */}
                  <div className="flex flex-wrap justify-center items-center gap-y-2 gap-x-3.5 px-4 text-xs font-semibold text-gray-400 w-full">
                    {/* Star */}
                    <span className="flex items-center gap-1">
                      <Star size={13} className="text-yellow-500 fill-yellow-500/10 shrink-0" />
                      {imdbRating && imdbRating !== "?" ? imdbRating : "8.0"}
                    </span>

                    {metacriticScore && (
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-black select-none tracking-wider",
                        metacriticScore >= 61 ? "bg-green-600 text-white border border-green-500/20" :
                        metacriticScore >= 40 ? "bg-yellow-500 text-black border border-yellow-400/20" :
                        "bg-red-600 text-white border border-red-500/20"
                      )}>
                        {metacriticScore} MC
                      </span>
                    )}
                    
                    {/* Year */}
                    <span className="flex items-center gap-1">
                      <Calendar size={13} className="text-gray-500 shrink-0" />
                      {(() => {
                        const startYear = finalTmdbData?.first_air_date ? finalTmdbData.first_air_date.substring(0,4) : (finalTmdbData?.release_date ? finalTmdbData.release_date.substring(0,4) : (movie.year || "2024"));
                        const endYear = finalTmdbData?.last_air_date ? finalTmdbData.last_air_date.substring(0,4) : null;
                        return (isTv && endYear && startYear !== endYear) ? `${startYear} - ${endYear}` : startYear;
                      })()}
                    </span>

                    {/* Movie/Series type */}
                    <span className="flex items-center gap-1">
                      <Film size={13} className="text-gray-500 shrink-0" />
                      {(movie.type === "single" || movie.type === "phimle") ? "Phim Lẻ" : "Phim Bộ"}
                    </span>

                    {(() => {
                      const cert = getCertification(finalTmdbData, isTv);
                      if (!cert) return null;
                      return (
                        <span className="bg-red-600/10 border border-red-500/25 px-1.5 py-0.5 rounded text-[10px] font-black text-red-500 select-none">
                          {cert}
                        </span>
                      );
                    })()}

                    {/* Tv Seasons */}
                    {isTv && finalTmdbData?.number_of_seasons && (
                      <span className="flex items-center gap-1">
                        <Tv size={13} className="text-gray-500 shrink-0" />
                        {finalTmdbData.number_of_seasons} Phần
                      </span>
                    )}

                    {/* Tv Episodes */}
                    {isTv && finalTmdbData?.number_of_episodes && (
                      <span className="flex items-center gap-1">
                        <Users size={13} className="text-gray-500 shrink-0" />
                        {finalTmdbData.number_of_episodes} Tập
                      </span>
                    )}

                    {/* Runtime */}
                    {(!isTv && (finalTmdbData?.runtime || movie.time)) && (
                      <span className="flex items-center gap-1">
                        <Clock size={13} className="text-gray-500 shrink-0" />
                        {finalTmdbData?.runtime ? `${finalTmdbData.runtime} phút` : movie.time}
                      </span>
                    )}

                    {/* Quality */}
                    {movie.quality && (
                      <span className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold text-gray-300 leading-none">
                        {movie.quality}
                      </span>
                    )}

                    {/* Status */}
                    {(finalTmdbData?.status || movie.status) && (
                      <span className="bg-white/5 border border-white/15 px-1.5 py-0.5 rounded text-[10px] font-bold text-gray-300 leading-none whitespace-nowrap">
                        {finalTmdbData?.status === "Ended" ? "Trọn bộ" : 
                         finalTmdbData?.status === "Returning Series" ? "Đang chiếu" : 
                         (movie.status === "completed" ? "Trọn bộ" : 
                          movie.status === "ongoing" ? "Đang chiếu" : 
                          (finalTmdbData?.status || movie.status))}
                      </span>
                    )}
                  </div>

                  {/* Action Buttons: 1. Xem ngay, 2. Xem Trailer, 3. Row of: Lưu Lại & ••• */}
                  <div className="flex flex-col gap-3 px-2 w-full mt-2">
                    {/* Button 1: Xem ngay */}
                    <button 
                      onClick={() => { 
                        if (isTv && !savedProgress) {
                          setShowMobileEpDropdown(!showMobileEpDropdown);
                        } else {
                          handlePlayOrResume();
                        }
                      }} 
                      className="w-full bg-[#e50914] hover:bg-[#ff1e24] text-white px-4 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 text-sm"
                    >
                      <Play size={16} fill="currentColor" /> {getPlayButtonText()}
                    </button>

                    {/* Season / Episode Dropdown for TV Series */}
                    {isTv && showMobileEpDropdown && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex flex-col gap-3 p-4 bg-white/[0.03] rounded-2xl border border-white/10 text-left relative z-[60]"
                        style={{ overflow: "visible" }}
                      >
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Chọn Phần & Tập Phim</span>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <CustomSelect
                              value={currentSeason || 1}
                              onChange={(val) => handleSeasonSwitch(Number(val))}
                              options={filteredSeasons.map((s: any) => ({
                                label: `Mùa ${s.season_number}`,
                                value: s.season_number
                              }))}
                              className="w-full"
                            />
                          </div>
                          <div className="flex-1">
                            <CustomSelect
                              value={(activeEp?.name && (getEpisodeNumber(activeEp.name)?.toString() || activeEp.name.replace("Tập ", ""))) || ""}
                              onChange={(epName: string) => {
                                 const ep = epList.find((e: any) => isSameEpisode(e.episode_number || e.name, epName));
                                 if (ep) handleSelectEpisode(ep, false);
                              }}
                              options={epList.map((ep: any) => {
                                 const n = ep.episode_number ? `${ep.episode_number}` : ep.name.replace("Tập ", "");
                                 return {
                                   label: `Tập ${n}`,
                                   value: n
                                 }
                               })}
                              className="w-full"
                            />
                          </div>
                        </div>
                        
                        <button
                          onClick={() => setIsPlaying(true)}
                          className="w-full bg-white hover:bg-gray-200 text-black py-2.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 mt-1 active:scale-95 transition-transform"
                        >
                          <Play size={14} fill="currentColor" /> Phát {activeEp ? `Tập ${activeEp.name.replace("Tập ", "")}` : "Tập hiện tại"}
                        </button>
                      </motion.div>
                    )}

                    {/* Button 2: Xem Trailer (if available) */}
                    {trailerYoutubeId && (
                      <button 
                        onClick={() => setIsShowingTrailer(true)}
                        className="w-full bg-transparent border border-white/15 text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors text-sm active:scale-95"
                      >
                        <Youtube size={16} /> Xem Trailer
                      </button>
                    )}

                    {/* Button 3: Row of: Lưu Lại & ••• */}
                    <div className="flex gap-3">
                      <button 
                        onClick={handleToggleList} 
                        className={cn(
                          "flex-1 bg-[#131313] border px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all text-sm active:scale-95",
                          inList ? "border-green-500/30 text-green-400" : "border-white/10 text-white"
                        )}
                      >
                         {inList ? <Check size={16} className="text-green-400" /> : <Plus size={16} />} {inList ? "Đã Lưu Phim" : "Lưu Phim"}
                      </button>
                      <button 
                        onClick={() => setShowMobileDetails(!showMobileDetails)}
                        className={cn(
                          "w-14 h-12 rounded-xl flex items-center justify-center transition-all shrink-0 active:scale-95 border",
                          showMobileDetails ? "border-white bg-white/10 text-white" : "border-white/10 bg-[#131313] text-gray-400"
                        )}
                        aria-label="More options"
                      >
                         <span className="text-xl font-bold pb-2 select-none">•••</span>
                      </button>
                    </div>

                    {/* Collapsible Mobile Extras Details block (Share, Synopsis, Cast) */}
                    <AnimatePresence>
                      {showMobileDetails && (
                         <motion.div
                           initial={{ opacity: 0, height: 0 }}
                           animate={{ opacity: 1, height: "auto" }}
                           exit={{ opacity: 0, height: 0 }}
                           className="bg-[#0f0f0f] border border-white/10 rounded-2xl p-5 flex flex-col gap-5 overflow-hidden mt-1 text-left"
                         >
                           {/* Share section */}
                           <div className="flex justify-between items-center pb-3 border-b border-white/10">
                             <span className="text-xs font-bold uppercase text-gray-400 tracking-wider">Tiện ích</span>
                             <button 
                               onClick={handleShare}
                               className="bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                             >
                               <Share2 size={13} /> Chia sẻ liên kết
                             </button>
                           </div>

                           {/* Synopsis */}
                           <div>
                             <h4 className="text-sm font-black text-white mb-2 uppercase tracking-wide">Nội Dung Phim</h4>
                             <p className="text-sm text-gray-300 leading-relaxed font-semibold text-justify" dangerouslySetInnerHTML={{ __html: finalTmdbData?.overview || movie?.content || "Chúng tôi đang cập nhật nội dung chi tiết cho bộ phim này. Vui lòng quay lại sau." }} />
                           </div>

                           {/* Cast */}
                           {actorsData && actorsData.length > 0 && (
                             <div>
                               <h4 className="text-sm font-black text-white mb-2 uppercase tracking-wide">Diễn Viên</h4>
                               <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar snap-x w-full">
                                 {actorsData.slice(0, 10).map((actor: any) => (
                                   <div key={actor.id} className="flex-shrink-0 flex items-center gap-3 bg-[#171717] border border-white/5 pr-4 pl-1.5 py-1.5 rounded-full snap-start">
                                     {actor.image ? (
                                       <img src={actor.image} alt={actor.name} className="w-10 h-10 rounded-full object-cover" />
                                     ) : (
                                       <div className="w-10 h-10 rounded-full bg-[#2a2a2a] flex items-center justify-center text-gray-400 font-bold uppercase text-xs">
                                         {actor.name.charAt(0)}
                                       </div>
                                     )}
                                     <div className="flex flex-col text-xs">
                                       <span className="text-gray-200 font-extrabold max-w-[100px] truncate">{actor.name}</span>
                                       <span className="text-gray-500 max-w-[100px] truncate text-[10px]">{actor.character}</span>
                                     </div>
                                   </div>
                                 ))}
                               </div>
                             </div>
                           )}
                         </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

              </motion.div>
            )}
          </AnimatePresence>

          {/* 3. Episodes List Section */}
          {(isTv || baseEpList.length > 0) && (
                  <div className="w-full mt-8 sm:mt-12 mb-16 pt-8 sm:pt-12 border-t border-white/10 flex flex-col">
                    <h2 className="text-2xl sm:text-3xl font-black text-white mb-6 sm:mb-8">Danh Sách Tập</h2>
                    
                    {/* Season Tabs */}
                    {isTv && filteredSeasons && (
                      <div className="flex gap-2 sm:gap-3 mb-6 sm:mb-8 overflow-x-auto pb-4 custom-scrollbar snap-x w-full">
                        {filteredSeasons.map((s: any) => {
                          const isSelectedSeason = currentSeason === s.season_number;
                          return (
                            <button 
                              key={s.id}
                              onClick={() => {
                                if (!isSelectedSeason) {
                                  handleSeasonSwitch(s.season_number);
                                }
                              }}
                              className={cn(
                                "px-5 sm:px-6 py-2 sm:py-2.5 rounded-full font-bold whitespace-nowrap transition-colors snap-start text-xs sm:text-sm border",
                                isSelectedSeason 
                                  ? "bg-[#e50914] border-[#e50914] text-white" 
                                  : "bg-black border-white/10 text-gray-300 hover:bg-white/20"
                              )}
                            >
                              Mùa {s.season_number}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Mobile: Compact Thumbnail List with images and descriptions */}
                    <div className="block md:hidden w-full">
                      {isFetchingTmdbSeason ? (
                        <div className="flex flex-col gap-3">
                           {Array.from({ length: 4 }).map((_, i) => (
                             <div key={`m-sk-${i}`} className="flex gap-3 p-2 bg-white/5 rounded-lg animate-pulse border border-white/5">
                                <div className="w-[110px] aspect-video rounded bg-black shrink-0" />
                                <div className="flex-1 flex flex-col gap-2 py-1">
                                   <div className="h-4 bg-[#222] rounded w-1/3" />
                                   <div className="h-3 bg-[#1a1a1a] rounded w-full" />
                                   <div className="h-3 bg-[#1a1a1a] rounded w-2/3" />
                                </div>
                             </div>
                           ))}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 w-full">
                          {epList.map((ep: any, i: number) => {
                            const tmdbEp = isTv && seasonData?.episodes
                              ? seasonData.episodes.find((t: any) => isSameEpisode(t.episode_number || t.name, ep.name || ep.episode_number))
                              : null;

                            const epNameStr = ep.episode_number ? `${ep.episode_number}` : ep.name;
                            const stillPath = getEpStillPath(epNameStr, tmdbEp?.still_path || ep.still_path);
                            const isSelected = currentSeason === validatedActiveEpSeason && (activeEp === ep || (activeEp?.name && isSameEpisode(ep.episode_number || ep.name, activeEp.name)));
                            
                            const displayEpName = ep.episode_number ? `Tập ${ep.episode_number}` : (String(ep.name).startsWith("Tập") ? ep.name : `Tập ${ep.name}`);
                            const displayEpTitle = tmdbEp?.name && !isGenericEpisodeName(tmdbEp.name, tmdbEp.episode_number)
                              ? tmdbEp.name
                              : (ep.name && !isGenericEpisodeName(ep.name, ep.episode_number) && !String(ep.name).startsWith("Tập") ? ep.name : '');
                            
                            const overview = tmdbEp?.overview || ep.overview;

                            return (
                              <button
                                key={i}
                                onClick={() => handleSelectEpisode(ep)}
                                className={cn(
                                  "flex gap-3 p-2 rounded-xl text-left transition-all duration-200 border items-center bg-black",
                                  isSelected 
                                    ? "border-red-600/60" 
                                    : "border-white/5 hover:border-white/10"
                                )}
                              >
                                {/* Left Index or Play Icon */}
                                <div className="w-8 shrink-0 flex justify-center items-center text-sm font-black text-gray-400">
                                  {isSelected ? (
                                    <Play size={14} fill="#ff1e1e" className="text-[#ff1e1e]" />
                                  ) : (
                                    ep.episode_number || getEpisodeNumber(ep.name) || i + 1
                                  )}
                                </div>

                                {/* Episode Thumbnail */}
                                 <div className="w-[110px] sm:w-[130px] aspect-video rounded-lg overflow-hidden relative shrink-0 bg-[#222] border border-white/5 flex items-center justify-center">
                                   {stillPath ? (
                                     <SafeImage src={stillPath} alt={ep.name} className="w-full h-full object-cover" />
                                   ) : (
                                     <>
                                       <SafeImage src={bgDetailImg || ""} alt={ep.name} className="w-full h-full object-cover opacity-20 mix-blend-luminosity absolute inset-0" />
                                       <div className="absolute inset-0 flex flex-col justify-center items-center p-2 text-center z-10 pointer-events-none">
                                         <Film size={16} className="text-white/40 mb-0.5" />
                                         <span className="text-[7px] leading-tight text-white/50 font-bold uppercase tracking-wide line-clamp-1 max-w-[90%]">
                                           {movie.name}
                                         </span>
                                       </div>
                                     </>
                                   )}
                                   
                                   {isSelected && (
                                     <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#e50914] z-20" />
                                   )}
                                 </div>

                                {/* Episode Info */}
                                <div className="flex-1 min-w-0 pr-1 flex flex-col gap-0.5 justify-center">
                                  <h4 className={cn(
                                    "font-extrabold text-sm line-clamp-2 text-wrap",
                                    isSelected ? "text-white" : "text-gray-200"
                                  )}>
                                    {displayEpName}
                                    {displayEpTitle && (
                                      <span className="font-semibold text-gray-400 text-xs ml-1.5">— {displayEpTitle}</span>
                                    )}
                                  </h4>
                                  <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mt-0.5">
                                    {getEpOverview(epNameStr, overview) || "Đang cập nhật nội dung cho tập này."}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {(epList.length === 0 && !isFetchingTmdbSeason) && (
                        <div className="w-full text-center py-8 px-4 bg-white/[0.02] border border-white/5 rounded-2xl my-4">
                           <p className="text-sm font-bold text-gray-300">Mùa {currentSeason} hiện chưa được phát hành hoặc chưa có sẵn trên các nguồn phát.</p>
                           <p className="text-xs text-gray-500 mt-1">Hệ thống sẽ tự động cập nhật ngay khi nhà cung cấp phát sóng bản Vietsub / Thuyết minh mới nhất.</p>
                        </div>
                      )}
                    </div>

                    {/* Desktop: Horizontal Episode Cards for larger screens */}
                    <div className="hidden md:block relative group/scroll w-full">
                      {/* Left Scroll Button */}
                      <button 
                        onClick={() => handleScroll(episodesScrollRef, "left")}
                        className="absolute -left-4 top-[35%] -translate-y-1/2 bg-neutral-900/90 hover:bg-black text-white border border-white/10 w-10 h-10 rounded-full shadow-2xl opacity-0 group-hover/scroll:opacity-100 transition-all duration-300 pointer-events-auto hover:scale-110 active:scale-95 z-20 flex items-center justify-center cursor-pointer"
                        aria-label="Scroll Left"
                      >
                        <ChevronLeft size={18} />
                      </button>

                      <div 
                        ref={episodesScrollRef}
                        className="flex gap-4 overflow-x-auto pb-8 custom-scrollbar snap-x w-full scroll-smooth"
                      >
                        {(isFetchingTmdbSeason) ? (
                           Array.from({ length: 4 }).map((_, i) => (
                             <div key={`skeleton-${i}`} className="min-w-[280px] sm:min-w-[320px] max-w-[320px] flex-shrink-0 flex flex-col gap-3 snap-start animate-pulse">
                                <div className="w-full aspect-video rounded-xl bg-black border border-white/5" />
                                <div className="flex flex-col gap-2 px-1 mt-1">
                                  <div className="h-6 bg-[#222] rounded-md w-1/3" />
                                  <div className="h-4 bg-[#1a1a1a] rounded-md w-full mt-1" />
                                  <div className="h-4 bg-[#1a1a1a] rounded-md w-4/5" />
                                </div>
                             </div>
                           ))
                        ) : (
                          epList.map((ep: any, i: number) => {
                            const tmdbEp = isTv && seasonData?.episodes
                              ? seasonData.episodes.find((t: any) => isSameEpisode(t.episode_number || t.name, ep.name || ep.episode_number))
                              : null;

                            const epNameStr = ep.episode_number ? `${ep.episode_number}` : ep.name;
                            const stillPath = getEpStillPath(epNameStr, tmdbEp?.still_path || ep.still_path);
                            const isSelected = activeEp === ep || (activeEp?.name && isSameEpisode(ep.episode_number || ep.name, activeEp.name));
                            
                            const displayEpName = ep.episode_number ? `Tập ${ep.episode_number}` : (String(ep.name).startsWith("Tập") ? ep.name : `Tập ${ep.name}`);
                            const displayEpTitle = tmdbEp?.name && !isGenericEpisodeName(tmdbEp.name, tmdbEp.episode_number)
                              ? tmdbEp.name
                              : (ep.name && !isGenericEpisodeName(ep.name, ep.episode_number) && !String(ep.name).startsWith("Tập") ? ep.name : '');
                            
                            const overview = tmdbEp?.overview || ep.overview;
                          
                          return (
                            <div 
                              key={i} 
                              onClick={() => handleSelectEpisode(ep)}
                              className="min-w-[280px] sm:min-w-[320px] max-w-[320px] flex-shrink-0 flex flex-col gap-3 group cursor-pointer snap-start"
                            >
                              <div className="w-full aspect-video rounded-xl overflow-hidden relative bg-black border border-white/5 flex items-center justify-center">
                                {stillPath ? (
                                  <SafeImage src={stillPath} alt={ep.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" /> 
                                ) : (
                                  <>
                                    <SafeImage src={bgDetailImg || ''} alt={ep.name} className="w-full h-full object-cover opacity-20 group-hover:opacity-40 transition-opacity mix-blend-luminosity absolute inset-0" />
                                    <div className="absolute inset-0 flex flex-col justify-center items-center p-4 text-center z-10 pointer-events-none">
                                      <Film size={26} className="text-white/40 mb-1.5 transition-transform duration-300 group-hover:scale-110" />
                                      <span className="text-[9px] sm:text-xs text-white/50 font-bold uppercase tracking-wider line-clamp-1 max-w-[90%]">
                                        {movie.name}
                                      </span>
                                    </div>
                                  </>
                                )}
                                
                                <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-md px-2 py-1 rounded text-[10px] font-black text-white z-10 border border-white/10">
                                  EP {ep.episode_number || getEpisodeNumber(ep.name) || ep.name}
                                </div>

                                <div className="absolute inset-0 flex justify-center items-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="w-12 h-12 rounded-full border-2 border-white flex justify-center items-center backdrop-blur-md shadow-2xl">
                                     <Play size={20} fill="white" className="ml-1 text-white" />
                                  </div>
                                </div>
                                
                                {isSelected && (
                                  <div className="absolute bottom-0 left-0 w-full h-1 bg-white" />
                                )}
                              </div>
                              
                              <div className="flex flex-col gap-1 px-1">
                                <h4 className="font-bold text-lg text-white line-clamp-1 group-hover:text-gray-300">
                                  {displayEpName}{displayEpTitle ? `: ${displayEpTitle}` : ""}
                                </h4>
                                <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
                                  {getEpOverview(epNameStr, overview) || "Đang cập nhật nội dung cho tập này."}
                                </p>
                              </div>
                            </div>
                          );
                        })
                        )}
                        {(epList.length === 0 && !isFetchingTmdbSeason) && (
                          <div className="w-full text-center py-10 text-gray-500">
                             Không có tập nào cho phim này.
                          </div>
                        )}
                      </div>

                      {/* Right Scroll Button */}
                      <button 
                        onClick={() => handleScroll(episodesScrollRef, "right")}
                        className="absolute -right-4 top-[35%] -translate-y-1/2 bg-neutral-900/90 hover:bg-black text-white border border-white/10 w-10 h-10 rounded-full shadow-2xl opacity-0 group-hover/scroll:opacity-100 transition-all duration-300 pointer-events-auto hover:scale-110 active:scale-95 z-20 flex items-center justify-center cursor-pointer"
                        aria-label="Scroll Right"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
          )}
        </div>

        {/* Movie Collection */}
        {!isTv && finalTmdbData?.belongs_to_collection?.id && (
          <MovieCollection 
            collectionId={finalTmdbData.belongs_to_collection.id} 
            onSelectMovie={onSelect}
            onViewAll={() => setShowCollectionPage(true)}
          />
        )}

      </div>

      <YoutubeTrailerModal 
         videoId={trailerYoutubeId}
         isOpen={isShowingTrailer}
         onClose={() => setIsShowingTrailer(false)}
      />

      <AnimatePresence>
        {showCollectionPage && !isTv && finalTmdbData?.belongs_to_collection?.id && (
          <MovieCollectionPage 
            collectionId={finalTmdbData.belongs_to_collection.id}
            collectionBackdrop={rawBg}
            onClose={() => setShowCollectionPage(false)}
            onSelectMovie={onSelect}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {copied && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[2000] px-6 py-3.5 bg-black/95 backdrop-blur-md border border-white/20 rounded-full flex items-center gap-3 shadow-[0_15px_40px_rgba(0,0,0,0.6)] text-white font-bold text-sm tracking-wide"
          >
            <Check size={16} className="text-white bg-green-500 p-0.5 rounded-full" />
            <span>Đã sao chép liên kết vào bộ nhớ tạm!</span>
          </motion.div>
        )}
      </AnimatePresence>

      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        movieTitle={finalTmdbData?.title || finalTmdbData?.name || data?.movie?.name || "Phim"}
        movieSlug={slug}
        tmdbId={finalTmdbData?.id}
        mediaType={isTv ? "tv" : "movie"}
        season={isTv ? (currentSeason || 1) : undefined}
        episodeName={isTv ? (activeEp?.name || "1") : undefined}
        serverName={activeStream?.providerLabel || currentServers?.[selectedServerId]?.server_name || "Nguồn chưa xác định"}
        streamUrl={activeStream?.url}
        streamType={activeStream?.type}
        quality={activeStream?.quality}
      />
    </motion.div>
  );
};
