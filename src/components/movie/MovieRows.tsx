// Added imports and logic for TmdbMovieRow
import React, { useRef, useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, ListFilter } from "lucide-react";
import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import { cn } from "../../lib/utils";
import { MovieCard } from "./MovieCard";
import { RankingCard } from "./RankingCard";
import { HorizontalShimmer } from "../ui/ImageShimmer";
import { useIntersectionObserver } from "../../hooks/useIntersectionObserver";
import { useWatchProgress, useMyList } from "../../hooks/useStorage";
import { fetchDetail } from "../../api/phimApi";
import { useTmdbDiscover, useTmdbBulkDetails } from "../../hooks/useTmdb";
import { fetchAnimeSfw } from "../../api/tmdbApi";

// Genre map từ row type sang fetchAnimeSfw genre param
const ANIME_SFW_GENRE_MAP: Record<string, 'action' | 'fantasy' | 'romance' | 'comedy' | 'kids' | ''> = {
  'anime-action':  'action',
  'anime-fantasy': 'fantasy',
  'anime-romance': 'romance',
  'anime-comedy':  'comedy',
  'anime-kids':    'kids',
  'anime-popular': '',
  'hoat-hinh-nhat': '',
};

/**
 * Hook: Lấy SFW anime từ MongoDB catalog trước, fallback về TMDB discover nếu DB chưa có dữ liệu.
 * Chỉ áp dụng cho anime rows (type in ANIME_SFW_GENRE_MAP).
 * Non-anime rows: không dùng hook này, dùng thẳng useTmdbDiscover với showMovie/showTv.
 */
function useAnimeSfwRows(
  type: string,
  tmdbMovieParams: any,
  tmdbTvParams: any,
  enabled: boolean
) {
  const sfwGenre = ANIME_SFW_GENRE_MAP[type];

  // Primary: MongoDB SFW catalog
  const { data: sfwData, isLoading: sfwLoading } = useQuery({
    queryKey: ['anime-sfw', type, sfwGenre],
    queryFn: () => fetchAnimeSfw({ genre: sfwGenre }),
    enabled,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });

  // Fallback: TMDB discover khi MongoDB chưa có data hoặc API lỗi
  const sfwHasData = !sfwLoading && (sfwData?.results?.length ?? 0) > 0;
  const { data: movieData, isLoading: movieLoading } = useTmdbDiscover(
    'movie', tmdbMovieParams,
    { enabled: enabled && !sfwHasData }
  );
  const { data: tvData, isLoading: tvLoading } = useTmdbDiscover(
    'tv', tmdbTvParams,
    { enabled: enabled && !sfwHasData }
  );

  if (sfwHasData && sfwData?.results?.length) {
    // Transform SFW items: tmdb_id + tmdb_type để xây dựng URL image trực tiếp
    const results = sfwData.results
      .filter(item => item.tmdb_id)
      .map(item => {
        const mediaType = item.type === 'Movie' ? 'movie' : 'tv';
        return {
          id:            Number(item.tmdb_id),
          _mediaType:    mediaType as 'movie' | 'tv',
          name:          item.title || item.title_ja,
          title:         item.title || item.title_ja,
          // Placeholder path — MovieCard sẽ gọi TMDB bulk details để resolve
          poster_path:   `__sfw_${item.tmdb_id}_${mediaType}`,
          backdrop_path: null,
          popularity:    item.score || 0,
          vote_average:  item.score || 0,
          _isSfw:        true,
        };
      });
    return { results, isLoading: sfwLoading };
  }

  // TMDB fallback
  const movieResults = movieData?.results?.map((m: any) => ({ ...m, _mediaType: 'movie' as const })) || [];
  const tvResults    = tvData?.results?.map((m: any) => ({ ...m, _mediaType: 'tv' as const })) || [];
  return {
    results:   [...movieResults, ...tvResults],
    isLoading: sfwLoading || movieLoading || tvLoading,
  };
}

export const CustomMovieRowContainer = React.memo(({
  title,
  movies,
  onSelect,
  isTop10,
  progressStore,
  aspectRatio = 'landscape',
  isAnime,
}: {
  title: string;
  movies: any[];
  onSelect: (id: string) => void;
  isTop10?: boolean;
  progressStore?: any;
  aspectRatio?: 'landscape' | 'poster';
  isAnime?: boolean;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (offset: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  // Collect TMDB requests in bulk
  const bulkRequests = useMemo(() => {
    return movies.map(movie => {
      const displayName = typeof movie.name === 'string' ? movie.name : (movie.title || '');
      const isOriginallyTvPattern = /phần|season|tập|mùa|part|\b(tv|series)\b/i.test(displayName);
      const isTv = movie?.type === 'series' || movie?.type === 'hoathinh' || movie?.tmdb?.media_type === 'tv' || (typeof movie?.slug === 'string' && movie.slug.endsWith('-tv')) || isOriginallyTvPattern;
      const tmdbId = movie?.tmdb_id || movie?.tmdb?.id || (typeof movie.slug === 'string' && movie.slug.startsWith('tmdb-') ? movie.slug.split('-')[1] : null);
      
      return tmdbId ? { id: tmdbId, type: isTv ? 'tv' as const : 'movie' as const } : null;
    }).filter(Boolean) as Array<{ id: string | number; type: 'movie' | 'tv' }>;
  }, [movies]);

  const { data: bulkTmdbData } = useTmdbBulkDetails(bulkRequests);

  return (
    <div className="py-[0.6vw] md:py-[0.8vw] relative group/row overflow-visible">
      <div className="flex items-center gap-3 px-4 sm:px-8 md:px-12 mb-3">
        <div className="w-[3px] h-5 sm:h-6 bg-[#E50914] rounded-full" />
        <h2 className="text-white text-xl sm:text-2xl md:text-[28px] font-bold tracking-tight">
          {title}
        </h2>
      </div>

      <div className="group relative">
        {movies.length === 0 ? (
          <div className="px-[4%] py-10 text-white/50 text-center">
            Không tìm thấy phim phù hợp với bộ lọc.
          </div>
        ) : (
          <div className="relative">
            {/* Left Button */}
            <button 
              onClick={() => scroll(-window.innerWidth * 0.7)}
              className="hidden md:flex absolute left-4 top-[42%] -translate-y-1/2 z-20 w-10 h-10 bg-[#111111]/85 hover:bg-black opacity-0 group-hover:opacity-100 transition-all items-center justify-center hover:scale-105 border border-white/10 rounded-full shadow-2xl active:scale-95 cursor-pointer"
            >
              <ChevronLeft size={20} className="text-white" />
            </button>

            {/* Right Button */}
            <button 
              onClick={() => scroll(window.innerWidth * 0.7)}
              className="hidden md:flex absolute right-4 top-[42%] -translate-y-1/2 z-20 w-10 h-10 bg-[#111111]/85 hover:bg-black opacity-0 group-hover:opacity-100 transition-all items-center justify-center hover:scale-105 border border-white/10 rounded-full shadow-2xl active:scale-95 cursor-pointer"
            >
              <ChevronRight size={20} className="text-white" />
            </button>

            <div
              ref={scrollRef}
              className={cn(
                "scroll-row-container flex gap-4 sm:gap-6 overflow-x-auto py-8 sm:py-12 -my-8 sm:-my-12 px-[4%] scrollbar-hide items-center relative z-10",
                isTop10 ? "pl-[4%]" : "",
              )}
              style={{ scrollbarWidth: "none" }}
            >
              {movies.map((movie, idx) => {
                const displayName = typeof movie.name === 'string' ? movie.name : (movie.title || '');
                const isOriginallyTvPattern = /phần|season|tập|mùa|part|\b(tv|series)\b/i.test(displayName);
                const isTv = movie?.type === 'series' || movie?.type === 'hoathinh' || movie?.tmdb?.media_type === 'tv' || (typeof movie?.slug === 'string' && movie.slug.endsWith('-tv')) || isOriginallyTvPattern;
                const tmdbId = movie?.tmdb_id || movie?.tmdb?.id || (typeof movie.slug === 'string' && movie.slug.startsWith('tmdb-') ? movie.slug.split('-')[1] : null);
                
                const enDetails = tmdbId ? bulkTmdbData?.[`${isTv ? 'tv' : 'movie'}:${tmdbId}`] : undefined;
                const resolvedDisplayName = enDetails?.title || enDetails?.name || displayName;

                return (
                  <div key={`${movie.slug}-${idx}`} className="shrink-0 pt-2.5 pb-5">
                    {isTop10 ? (
                      <RankingCard 
                        movie={movie} 
                        onSelect={onSelect} 
                        idx={idx} 
                        rowTitle={`Bảng xếp hạng: ${title}`}
                        enDetails={enDetails}
                        isAnime={isAnime}
                      />
                    ) : (
                      <MovieCard
                        movie={movie}
                        onSelect={onSelect}
                        isTop10={!!isTop10}
                        idx={idx}
                        progressData={progressStore?.[movie.slug as string]}
                        rowTitle={title}
                        enDetails={enDetails}
                        aspectRatio={aspectRatio}
                        isAnime={isAnime}
                      />
                    )}
                  </div>
                );

              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export const MovieRow = ({
  title,
  type,
  onSelect,
  isTop10,
  aspectRatio = 'landscape',
}: {
  title: string;
  type: string;
  onSelect: (slug: string) => void;
  isTop10?: boolean;
  aspectRatio?: 'landscape' | 'poster';
  isAnime?: boolean;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  // Stage 1: trigger API fetch khi còn cách viewport 1200px
  const [shouldFetch, setShouldFetch] = useState(false);
  // Stage 2: render nội dung khi còn cách viewport 200px
  const [hasIntersected, setHasIntersected] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Preload observer — kích hoạt fetch sớm
    const preloadObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setShouldFetch(true);
        preloadObserver.disconnect();
      }
    }, { rootMargin: '1200px' });

    // Render observer — quyết định khi nào show content
    const renderObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setHasIntersected(true);
        renderObserver.disconnect();
      }
    }, { rootMargin: '200px' });

    preloadObserver.observe(el);
    renderObserver.observe(el);

    return () => {
      preloadObserver.disconnect();
      renderObserver.disconnect();
    };
  }, []);
  
  const showMovie = type !== 'phim-bo';
  const showTv = type !== 'phim-le';

  const isCổTrang = type === 'the-loai/co-trang';
  const isAsian = type.includes('han-quoc') || type.includes('trung-quoc') || isCổTrang;
  
  const GENRE_MAP_MOVIE: Record<string, string> = {
    "the-loai/hanh-dong": "28",
    "the-loai/vien-tuong": "878",
    "the-loai/kinh-di": "27",
    "the-loai/hai-huoc": "35",
    "the-loai/tinh-cam": "10749",
    "the-loai/co-trang": "36",
    "the-loai/vo-thuat": "28,36",
    "the-loai/tam-ly": "18",
    "the-loai/hoc-duong": "35,18",
    "the-loai/gia-dinh": "10751",
    "the-loai/hinh-su": "80",
    "the-loai/tai-lieu": "99",
    "the-loai/chien-tranh": "10752",
    "hoat-hinh": "16"
  };

  const GENRE_MAP_TV: Record<string, string> = {
    "the-loai/hanh-dong": "10759", // Action & Adventure
    "the-loai/vien-tuong": "10765", // Sci-Fi & Fantasy
    "the-loai/kinh-di": "9648", // Mystery
    "the-loai/hai-huoc": "35", // Comedy
    "the-loai/tinh-cam": "18", // Drama is closest for romance series
    "the-loai/co-trang": "18", // Drama
    "the-loai/vo-thuat": "10759,18", // Action & Adventure + Drama
    "the-loai/tam-ly": "18", // Drama
    "the-loai/hoc-duong": "18,35",
    "the-loai/gia-dinh": "10751", // Family
    "the-loai/hinh-su": "80", // Crime
    "the-loai/tai-lieu": "99", // Documentary
    "the-loai/chien-tranh": "10768", // War & Politics
    "hoat-hinh": "16" // Animation
  };

  const COUNTRY_MAP: Record<string, string> = {
    "quoc-gia/au-my": "US|GB",
    "quoc-gia/han-quoc": "KR",
    "quoc-gia/trung-quoc": "CN|HK",
  };

  // Movie parameters setup
  const isAnime = type.startsWith('anime') || type === 'hoat-hinh-nhat';
  const minVotesMovie = isAnime ? 5 : (isAsian ? 5 : 20);
  const minVotesTv = isAnime ? 5 : (isAsian ? 5 : 10);

  // Dynamic date floor for Anime to prioritize new & popular releases
  const getAnimeDateFloor = (rowType: string) => {
    if (rowType === 'hoat-hinh-nhat') return '2025-01-01'; // New anime (from 2025-2026)
    if (rowType === 'anime-popular') return '2022-01-01'; // Popular anime (from 2022-2026)
    if (rowType === 'anime-kids') return '2010-01-01';    // Kids anime (can go back further for classics)
    return '2022-01-01';                                 // Default for genre rows (Action, Fantasy, Romance, Comedy)
  };
  const animeDateFloor = isAnime ? getAnimeDateFloor(type) : '2024-01-01';

  const movieParams: any = {
    sort_by: type === 'phim-moi-cap-nhat' ? 'primary_release_date.desc' : 'popularity.desc',
    'vote_count.gte': type === 'phim-moi-cap-nhat' ? 0 : minVotesMovie,
    'primary_release_date.gte': isAnime ? animeDateFloor : '2024-01-01', // Fetch only movies from specified floor onwards
    page: 1,
  };
  const movieGenre = GENRE_MAP_MOVIE[type];
  if (movieGenre) movieParams.with_genres = movieGenre;
  
  if (isAnime) {
    movieParams.with_original_language = 'ja';
    movieParams.without_keywords = '190370,198385,155477,256466,325693'; // hentai/softcore/erotic keyword IDs trên TMDB
    if (type === 'anime-action') {
      movieParams.with_genres = '16,28';
      movieParams.without_genres = '10751,10762'; // Exclude Family, Kids to prevent family anime from bloating action rows
    } else if (type === 'anime-fantasy') {
      movieParams.with_genres = '16,12|14'; // Adventure/Fantasy (12 is Adventure, 14 is Fantasy)
      movieParams.without_genres = '10751,10762'; // Exclude Family, Kids
    } else if (type === 'anime-romance') {
      movieParams.with_genres = '16,10749';
      movieParams.without_genres = '28,12,10751,10762'; // Exclude Action, Adventure, Family, Kids
    } else if (type === 'anime-comedy') {
      movieParams.with_genres = '16,35';
      movieParams.without_genres = '28,12,14,10751,10762'; // Pure comedy/slice of life, excluding Action/Adventure/Fantasy/Family/Kids
    } else if (type === 'anime-kids') {
      movieParams.with_genres = '16,10751'; // Animation + Family
    } else {
      movieParams.with_genres = '16';
    }
  } else if (COUNTRY_MAP[type]) {
    movieParams.with_origin_country = COUNTRY_MAP[type];
  } else if (isCổTrang) {
    movieParams.with_origin_country = 'CN|HK|TW';
  }

  // TV parameters setup
  const tvParams: any = {
    sort_by: type === 'phim-moi-cap-nhat' ? 'first_air_date.desc' : 'popularity.desc',
    'vote_count.gte': type === 'phim-moi-cap-nhat' ? 0 : minVotesTv,
    'first_air_date.gte': isAnime ? animeDateFloor : '2024-01-01', // Fetch only series from specified floor onwards
    page: 1,
  };
  const tvGenre = GENRE_MAP_TV[type];
  if (tvGenre) tvParams.with_genres = tvGenre;

  if (isAnime) {
    tvParams.with_original_language = 'ja';
    tvParams.without_keywords = '190370,198385,155477,256466,325693'; // hentai/softcore/erotic keyword IDs trên TMDB
    if (type === 'anime-action') {
      tvParams.with_genres = '16,10759';
      tvParams.without_genres = '10751,10762'; // Exclude Family, Kids to prevent family anime from bloating action rows
    } else if (type === 'anime-fantasy') {
      tvParams.with_genres = '16,10765';
      tvParams.without_genres = '10751,10762'; // Exclude Family, Kids
    } else if (type === 'anime-romance') {
      tvParams.with_genres = '16,18';
      tvParams.without_genres = '10759,10762'; // Exclude Action/Adventure, Kids
    } else if (type === 'anime-comedy') {
      tvParams.with_genres = '16,35';
      tvParams.without_genres = '10759,10765,10751,10762'; // Exclude Action/Adventure, Sci-Fi/Fantasy, Family, Kids
    } else if (type === 'anime-kids') {
      tvParams.with_genres = '16,10751|10762'; // Animation + Family/Kids
    } else {
      tvParams.with_genres = '16';
    }
  } else if (COUNTRY_MAP[type]) {
    tvParams.with_origin_country = COUNTRY_MAP[type];
  } else if (isCổTrang) {
    tvParams.with_origin_country = 'CN|HK|TW';
  }

  // Anime rows: dùng MongoDB SFW catalog (primary) + TMDB discover (fallback)
  // Non-anime rows: dùng TMDB discover trực tiếp với showMovie/showTv flags
  const isAnimeRow = type in ANIME_SFW_GENRE_MAP;

  const { results: sfwResults, isLoading: sfwRowLoading } = useAnimeSfwRows(
    type, movieParams, tvParams, shouldFetch && isAnimeRow
  );

  const { data: movieData, isLoading: movieLoading } = useTmdbDiscover(
    'movie', movieParams, { enabled: shouldFetch && showMovie && !isAnimeRow }
  );
  const { data: tvData, isLoading: tvLoading } = useTmdbDiscover(
    'tv', tvParams, { enabled: shouldFetch && showTv && !isAnimeRow }
  );

  const { progressStore } = useWatchProgress();



  if (!hasIntersected) {
    return (
      <div
        ref={ref}
        className="py-[0.6vw] md:py-[0.8vw] relative min-h-[200px] md:min-h-[250px]"
      >
        <div className="flex items-center gap-3 px-4 sm:px-8 md:px-12 mb-3">
          <div className="w-[3px] h-5 sm:h-6 bg-[#E50914] rounded-full" />
          <h2 className="text-white text-xl sm:text-2xl md:text-[28px] font-bold tracking-tight">
            {title}
          </h2>
        </div>
        <HorizontalShimmer />
      </div>
    );
  }

  const isLoading = isAnimeRow
    ? sfwRowLoading
    : (showMovie && movieLoading) || (showTv && tvLoading);
  const showLoading = isLoading;

  // Build combinedRaw theo đúng nguồn
  let combinedRaw: any[];
  if (isAnimeRow) {
    combinedRaw = sfwResults;
  } else {
    const movieResults = showMovie && movieData?.results ? movieData.results : [];
    const tvResults    = showTv && tvData?.results ? tvData.results : [];
    combinedRaw = [
      ...movieResults.map((m: any) => ({ ...m, _mediaType: 'movie' as const })),
      ...tvResults.map((m: any) => ({ ...m, _mediaType: 'tv' as const })),
    ];
  }

  const sortedResults = [...combinedRaw].sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0));



  const seenTmdbIds = new Set();
  const moviesToDisplay = sortedResults
    // SFW items: poster_path là placeholder __sfw_*, luôn pass qua
    // TMDB items: cần có poster_path hoặc backdrop_path thực
    .filter((m: any) => m._isSfw || m.poster_path || m.backdrop_path)
    .filter((item: any) => {

      if (!item.id || seenTmdbIds.has(item.id)) return false;
      seenTmdbIds.add(item.id);
      return true;
    })
    .map((item: any) => {
      const actualMediaType = item._mediaType;

      // SFW items: poster_path là placeholder '__sfw_{id}_{type}'
      // thumb_url/poster_url sẽ được resolve qua useTmdbBulkDetails trong CustomMovieRowContainer
      const isSfw = item._isSfw;
      const tmdbPosterBase = 'https://image.tmdb.org/t/p/w500';
      const tmdbBackdropBase = 'https://image.tmdb.org/t/p/w780';

      let thumb_url: string;
      let poster_url: string | null;

      if (isSfw) {
        // Ảnh sẽ được resolve bởi useTmdbBulkDetails qua enDetails trong CustomMovieRowContainer
        thumb_url  = '';
        poster_url = null;

      } else {
        thumb_url = item.backdrop_path
          ? (item.backdrop_path.startsWith('http') ? item.backdrop_path : `${tmdbBackdropBase}/${item.backdrop_path.split('/').pop()}`)
          : (item.poster_path?.startsWith('http') ? item.poster_path : `${tmdbPosterBase}/${item.poster_path?.split('/').pop()}`);
        poster_url = item.poster_path
          ? (item.poster_path.startsWith('http') ? item.poster_path : `${tmdbPosterBase}/${item.poster_path.split('/').pop()}`)
          : null;
      }

      return {
        slug:      `tmdb-${item.id}-${actualMediaType}`,
        name:      item.title || item.name,
        thumb_url,
        poster_url,
        tmdb:      item,
        _isSfw:    isSfw,
      };
    });


  if (!showLoading && moviesToDisplay.length === 0) return null;

  return (
    <div
      ref={ref}
      className={showLoading ? "min-h-[200px] md:min-h-[250px]" : ""}
    >
      {showLoading && (
        <div className="py-4 md:py-6 relative">
          <div className="flex items-center gap-3 px-4 sm:px-8 md:px-12 mb-3">
            <div className="w-[3px] h-5 sm:h-6 bg-[#E50914] rounded-full" />
            <h2 className="text-white text-xl sm:text-2xl md:text-[28px] font-bold tracking-tight animate-pulse">
              {title}
            </h2>
          </div>
          <HorizontalShimmer />
        </div>
      )}
      {!showLoading && (
        <CustomMovieRowContainer
          title={title}
          movies={moviesToDisplay}
          isTop10={isTop10}
          onSelect={onSelect}
          progressStore={progressStore}
          aspectRatio={aspectRatio}
          isAnime={isAnime}
        />
      )}
    </div>
  );
};

export const ContinueWatchingRow = ({
  onSelect,
}: {
  onSelect: (slug: string) => void;
}) => {
  const { progressStore } = useWatchProgress();
  const items = Object.entries(progressStore)
    .sort(([, a]: [string, any], [, b]: [string, any]) => b.savedAt - a.savedAt)
    .map(([slug, data]: [string, any]) => ({
      slug,
      name: data.movieName,
      poster_url: data.posterUrl,
      thumb_url: data.thumbUrl || data.posterUrl,
      tmdb_id: data.tmdbId,
      type: data.type || (slug.endsWith('-tv') ? 'series' : 'single'),
    }));

  if (items.length === 0) return null;

  return (
    <CustomMovieRowContainer
      title="Tiếp tục xem"
      movies={items}
      onSelect={onSelect}
      progressStore={progressStore}
    />
  );
};

export const MyListRow = ({
  onSelect,
}: {
  onSelect: (slug: string) => void;
}) => {
  const { myList } = useMyList();

  if (myList.length === 0) return null;

  return (
    <CustomMovieRowContainer
      title="Danh sách của tôi"
      movies={myList}
      onSelect={onSelect}
    />
  );
};

