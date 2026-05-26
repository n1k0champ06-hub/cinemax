import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMultiSource } from "../../api/phimApi";
import { MovieCard } from "./MovieCard";

export const SimilarMovies = ({
  categorySlug,
  onSelect,
  currentSlug,
}: {
  categorySlug: string;
  onSelect: (slug: string) => void;
  currentSlug?: string;
}) => {
  const fallbackType = categorySlug
    ? `the-loai/${categorySlug}`
    : "phim-moi-cap-nhat";
    
  const { data: fallbackData, isLoading } = useQuery({
    queryKey: ["movies", fallbackType],
    queryFn: () => fetchMultiSource(fallbackType),
  });

  if (isLoading) return (
    <div className="mt-8 animate-pulse flex gap-4 overflow-hidden px-4 sm:px-0">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="w-[140px] sm:w-[160px] md:w-[200px] aspect-[2/3] bg-white/5 rounded-xl flex-shrink-0"></div>
      ))}
    </div>
  );

  let finalSimilar: any[] = [];
  if (fallbackData?.length) {
    finalSimilar = fallbackData
      .filter((m) => m.slug !== currentSlug)
      .map((m) => ({
        ...m,
        poster_url: m.poster_url || m.thumb_url,
      }));
  }

  if (!finalSimilar?.length) return null;

  return (
    <div className="mt-12 w-full">
      <h3 className="text-xl sm:text-2xl font-black text-white mb-6 tracking-tight px-4 sm:px-0">
        Nội Dung Liên Quan
      </h3>

      <div 
        className="flex gap-4 sm:gap-6 overflow-x-auto pb-8 pt-2 px-4 sm:px-0 scrollbar-hide snap-x will-change-transform transform-gpu"
        style={{ scrollbarWidth: "none" }}
      >
        {finalSimilar.map((movie, idx) => (
          <MovieCard
            key={movie.slug || idx}
            movie={movie}
            onSelect={onSelect}
            idx={idx}
          />
        ))}
      </div>
    </div>
  );
};

