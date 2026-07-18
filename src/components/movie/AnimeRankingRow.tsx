import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useAnimeDbRanking } from '../../hooks/useAnimeDb';
import { jikanItemToMovie } from '../../api/jikanApi';
import { RankingCard } from './RankingCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { HorizontalShimmer } from '../ui/ImageShimmer';

export const AnimeRankingRow = ({ title = "Top 10 Anime Thịnh Hành (MAL)", onSelect }: { title?: string, onSelect: (id: string) => void }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasIntersected, setHasIntersected] = useState(false);

  useEffect(() => {
    if (hasIntersected) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setHasIntersected(true);
        observer.disconnect();
      }
    }, { rootMargin: '400px' });
    const el = containerRef.current;
    if (el) observer.observe(el);
    return () => {
      if (el) observer.unobserve(el);
      observer.disconnect();
    };
  }, [hasIntersected]);

  const { data: jikanData, isLoading } = useAnimeDbRanking(1, 10, hasIntersected);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = window.innerWidth * 0.75;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const animeList = useMemo(() => {
    const rawList = jikanData?.data || [];
    return rawList.map((item: any) => jikanItemToMovie(item));
  }, [jikanData]);

  return (
    <div ref={containerRef} className="py-[0.6vw] md:py-[0.8vw] relative group/row overflow-visible">
      <div className="flex items-center justify-between mb-4 md:mb-6 px-[4%]">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
          <span className="w-1.5 h-6 md:h-8 bg-gradient-to-b from-red-500 to-rose-600 rounded-full inline-block shadow-lg shadow-red-500/30" />
          <span>{title}</span>
        </h2>
      </div>

      <div className="relative">
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-0 bottom-0 z-30 w-[4%] bg-gradient-to-r from-[#050505] via-[#050505]/80 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 flex items-center justify-center cursor-pointer disabled:hidden"
        >
          <ChevronLeft className="w-8 h-8 text-white hover:scale-125 transition-transform" />
        </button>

        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 bottom-0 z-30 w-[4%] bg-gradient-to-l from-[#050505] via-[#050505]/80 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 flex items-center justify-center cursor-pointer disabled:hidden"
        >
          <ChevronRight className="w-8 h-8 text-white hover:scale-125 transition-transform" />
        </button>

        {!hasIntersected || isLoading ? (
          <div className="px-[4%]">
            <HorizontalShimmer />
          </div>
        ) : (
          <div
            ref={scrollRef}
            className="scroll-row-container flex gap-4 sm:gap-6 overflow-x-auto py-8 sm:py-12 -my-8 sm:-my-12 px-[4%] scrollbar-hide items-center relative z-10 pl-[4%]"
            style={{ scrollbarWidth: "none" }}
          >
            {animeList.map((movie: any, idx: number) => (
              <div key={movie.id} className="shrink-0 pt-2.5 pb-5">
                <RankingCard
                  movie={movie}
                  onSelect={onSelect}
                  idx={idx}
                  rowTitle={title}
                  isAnime={true}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
