import React, { useRef, useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, ListFilter } from "lucide-react";
import { useQuery, keepPreviousData, useQueries } from "@tanstack/react-query";
import { cn } from "../../lib/utils";
import { MovieCard } from "./MovieCard";
import { HorizontalShimmer } from "../ui/ImageShimmer";
import { useIntersectionObserver } from "../../hooks/useIntersectionObserver";
import { useWatchProgress, useMyList } from "../../hooks/useStorage";
import { fetchMultiSource, fetchDetail } from "../../api/phimApi";

export const CustomMovieRowContainer = ({
  title,
  movies,
  onSelect,
  isTop10,
  progressStore,
  variant,
}: {
  title: string;
  movies: any[];
  onSelect: (id: string) => void;
  isTop10?: boolean;
  progressStore?: any;
  variant?: 'default' | 'landscape';
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const scroll = (offset: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const newPage = Math.round(scrollLeft / clientWidth) + 1;
      setCurrentPage(newPage);
    }
  };

  const [itemsPerPage, setItemsPerPage] = useState(5);

  useEffect(() => {
    const updateItems = () => {
      if (window.innerWidth < 640) setItemsPerPage(2);
      else if (window.innerWidth < 768) setItemsPerPage(3);
      else if (window.innerWidth < 1024) setItemsPerPage(4);
      else setItemsPerPage(5);
    };
    updateItems();
    window.addEventListener("resize", updateItems);
    return () => window.removeEventListener("resize", updateItems);
  }, []);

  const totalPages = Math.ceil(movies.length / itemsPerPage);

  return (
    <div className="py-8 md:py-10 relative group/row">
      <div className="flex flex-col md:flex-row md:items-end justify-between px-4 md:px-12 mb-6 gap-4">
        <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
          {title}
        </h2>
        
        {movies.length > 0 && (
          <div className="hidden sm:flex items-center gap-4 justify-between md:justify-end">
            <div className="flex gap-2">
              <button 
                onClick={() => scroll(-window.innerWidth * 0.7)}
                className="p-2.5 border border-white/10 rounded-lg bg-transparent hover:bg-white/10 transition-colors text-white/80 hover:text-white"
              >
                <ArrowLeft size={18} />
              </button>
              <button 
                onClick={() => scroll(window.innerWidth * 0.7)}
                className="p-2.5 border border-white/10 rounded-lg bg-transparent hover:bg-white/10 transition-colors text-white/80 hover:text-white"
              >
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="group relative">
        {movies.length === 0 ? (
          <div className="px-4 md:px-12 py-10 text-white/50 text-center">
            Không tìm thấy phim phù hợp với bộ lọc.
          </div>
        ) : (
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className={cn(
              "flex gap-4 sm:gap-6 md:gap-8 overflow-x-auto pb-8 px-4 md:px-12 scrollbar-hide snap-x snap-mandatory items-start will-change-transform transform-gpu",
              isTop10 ? "pl-2 md:pl-8 gap-6 sm:gap-8 md:gap-10" : "",
            )}
            style={{ scrollbarWidth: "none" }}
          >
            {movies.map((movie, idx) => (
              <div key={`${movie.slug}-${idx}`} className="snap-start shrink-0">
                <MovieCard
                  movie={movie}
                  onSelect={onSelect}
                  isTop10={!!isTop10}
                  idx={idx}
                  progressData={progressStore?.[movie.slug as string]}
                  variant={variant}
                />
              </div>
            ))}
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
  variant,
}: {
  title: string;
  type: string;
  onSelect: (slug: string) => void;
  isTop10?: boolean;
  variant?: 'default' | 'landscape';
}) => {
  const { ref, isIntersecting } = useIntersectionObserver({
    rootMargin: "200px",
  });
  const { data, isLoading } = useQuery({
    queryKey: ["movies", type],
    queryFn: () => fetchMultiSource(type),
    placeholderData: keepPreviousData,
    enabled: isIntersecting,
  });
  const { progressStore } = useWatchProgress();

  const showLoading = isLoading || (!isIntersecting && !data);

  if (!showLoading && (!data || data.length === 0)) return <div ref={ref} />;

  return (
    <div
      ref={ref}
      className={showLoading ? "min-h-[200px] md:min-h-[250px]" : ""}
    >
      {showLoading && (
        <div className="py-4 md:py-6 relative">
          <div className="flex items-center gap-3 px-4 md:px-12 mb-4">
            <div className="w-1.5 h-6 md:h-8 bg-white/10 rounded-full animate-pulse" />
            <h2 className="text-xl sm:text-2xl md:text-[28px] font-black text-white tracking-tight text-white/50 animate-pulse">
              {title}
            </h2>
          </div>
          <HorizontalShimmer />
        </div>
      )}
      {!showLoading && data && data.length > 0 && (
        <CustomMovieRowContainer
          title={title}
          movies={isTop10 ? data.slice(0, 10) : data}
          isTop10={isTop10}
          onSelect={onSelect}
          progressStore={progressStore}
          variant={variant}
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
      thumb_url: data.posterUrl,
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
