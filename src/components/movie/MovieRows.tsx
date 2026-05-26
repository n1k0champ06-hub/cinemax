// Added imports and logic for TmdbMovieRow
import React, { useRef, useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, ListFilter } from "lucide-react";
import { keepPreviousData, useQueries } from "@tanstack/react-query";
import { cn } from "../../lib/utils";
import { MovieCard } from "./MovieCard";
import { RankingCard } from "./RankingCard";
import { HorizontalShimmer } from "../ui/ImageShimmer";
import { useIntersectionObserver } from "../../hooks/useIntersectionObserver";
import { useWatchProgress, useMyList } from "../../hooks/useStorage";
import { fetchDetail } from "../../api/phimApi";
import { useTmdbDiscover } from "../../hooks/useTmdb";

export const CustomMovieRowContainer = ({
  title,
  movies,
  onSelect,
  isTop10,
  progressStore,
}: {
  title: string;
  movies: any[];
  onSelect: (id: string) => void;
  isTop10?: boolean;
  progressStore?: any;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (offset: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  return (
    <div className="py-[1.5vw] md:py-[2vw] relative group/row overflow-visible">
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
                "flex gap-2 lg:gap-3 overflow-x-auto py-8 sm:py-12 -my-8 sm:-my-12 px-[4%] scrollbar-hide items-center relative z-10",
                isTop10 ? "pl-[4%]" : "",
              )}
              style={{ scrollbarWidth: "none" }}
            >
              {movies.map((movie, idx) => (
                <div key={`${movie.slug}-${idx}`} className="shrink-0 pt-4 pb-12">
                  {isTop10 ? (
                    <RankingCard movie={movie} onSelect={onSelect} idx={idx} />
                  ) : (
                    <MovieCard
                      movie={movie}
                      onSelect={onSelect}
                      isTop10={!!isTop10}
                      idx={idx}
                      progressData={progressStore?.[movie.slug as string]}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const MovieRow = ({
  title,
  type,
  onSelect,
  isTop10,
}: {
  title: string;
  type: string;
  onSelect: (slug: string) => void;
  isTop10?: boolean;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isIntersecting = true; // Set to true to bypass buggy iframe scroll intersection behaviors and fetch immediately
  
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

  const movieParams: any = {
    sort_by: type === 'phim-moi-cap-nhat' ? 'primary_release_date.desc' : 'popularity.desc',
    'vote_count.gte': type === 'phim-moi-cap-nhat' ? 0 : minVotesMovie,
    page: 1,
  };
  const movieGenre = GENRE_MAP_MOVIE[type];
  if (movieGenre) movieParams.with_genres = movieGenre;
  
  if (isAnime) {
    movieParams.with_original_language = 'ja';
    if (type === 'anime-action') {
      movieParams.with_genres = '16,28';
    } else if (type === 'anime-fantasy') {
      movieParams.with_genres = '16,12'; // Adventure/Fantasy
    } else if (type === 'anime-romance') {
      movieParams.with_genres = '16,10749';
    } else if (type === 'anime-comedy') {
      movieParams.with_genres = '16,35';
    } else {
      movieParams.with_genres = '16';
    }
  } else if (COUNTRY_MAP[type]) {
    movieParams.with_origin_country = COUNTRY_MAP[type];
  } else if (isCổTrang) {
    movieParams.with_origin_country = 'CN|HK|TW|KR';
  }

  // TV parameters setup
  const tvParams: any = {
    sort_by: type === 'phim-moi-cap-nhat' ? 'first_air_date.desc' : 'popularity.desc',
    'vote_count.gte': type === 'phim-moi-cap-nhat' ? 0 : minVotesTv,
    page: 1,
  };
  const tvGenre = GENRE_MAP_TV[type];
  if (tvGenre) tvParams.with_genres = tvGenre;

  if (isAnime) {
    tvParams.with_original_language = 'ja';
    if (type === 'anime-action') {
      tvParams.with_genres = '16,10759';
    } else if (type === 'anime-fantasy') {
      tvParams.with_genres = '16,10765';
    } else if (type === 'anime-romance') {
      tvParams.with_genres = '16,18';
    } else if (type === 'anime-comedy') {
      tvParams.with_genres = '16,35';
    } else {
      tvParams.with_genres = '16';
    }
  } else if (COUNTRY_MAP[type]) {
    tvParams.with_origin_country = COUNTRY_MAP[type];
  } else if (isCổTrang) {
    tvParams.with_origin_country = 'CN|HK|TW|KR';
  }

  // Dual React Queries
  const { data: movieData, isLoading: movieLoading } = useTmdbDiscover('movie', movieParams, { enabled: isIntersecting && showMovie });
  const { data: tvData, isLoading: tvLoading } = useTmdbDiscover('tv', tvParams, { enabled: isIntersecting && showTv });
  const { progressStore } = useWatchProgress();

  const isLoading = (showMovie && movieLoading) || (showTv && tvLoading);
  const showLoading = isLoading;

  const movieResults = showMovie && movieData?.results ? movieData.results : [];
  const tvResults = showTv && tvData?.results ? tvData.results : [];

  const combinedResults = [
    ...movieResults.map((item: any) => ({ ...item, _mediaType: 'movie' as const })),
    ...tvResults.map((item: any) => ({ ...item, _mediaType: 'tv' as const })),
  ];

  // Sort dynamically by popularity descending across both types
  const sortedResults = combinedResults.sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0));

  const moviesToDisplay = sortedResults
    .filter((m: any) => m.poster_path || m.backdrop_path)
    .map((item: any) => {
      const actualMediaType = item._mediaType;
      return {
        slug: `tmdb-${item.id}-${actualMediaType}`,
        name: item.title || item.name,
        thumb_url: item.backdrop_path 
          ? (item.backdrop_path?.startsWith('http') ? item.backdrop_path : `https://image.tmdb.org/t/p/w780/${item.backdrop_path?.split('/').pop()}`) 
          : (item.poster_path?.startsWith('http') ? item.poster_path : `https://image.tmdb.org/t/p/w500/${item.poster_path?.split('/').pop()}`),
        poster_url: item.poster_path 
          ? (item.poster_path?.startsWith('http') ? item.poster_path : `https://image.tmdb.org/t/p/w500/${item.poster_path?.split('/').pop()}`) 
          : null,
        tmdb: item
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

