import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAnimeRanking } from '../../hooks/useAnimeDb';
import { RankingCard } from './RankingCard';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export const AnimeRankingRow = ({ onSelect }: { onSelect: (slug: string) => void }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['anime', 'ranking'],
    queryFn: getAnimeRanking,
  });

  const scrollRef = React.useRef<HTMLDivElement>(null);

  const [isSearching, setIsSearching] = React.useState(false);

  const handleSelect = async (anime: any) => {
    setIsSearching(true);
    try {
      const { fetchSearch } = await import('../../api/phimApi');
      const results = await fetchSearch(anime.title || anime.name);
      if (results && results.length > 0) {
        onSelect(results[0].slug);
      } else {
        alert("Chưa có phim này trong hệ thống server.");
      }
    } catch (e) {
      console.error(e);
      alert("Search failed.");
    } finally {
      setIsSearching(false);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = window.innerWidth * 0.75;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const animes = data?.data || data?.results || data?.items || [];

  if (isLoading || animes.length === 0) return null;

  return (
    <div className="py-4 md:py-6 relative group/row">
      <div className="flex items-center justify-between px-4 md:px-12 mb-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 md:h-8 bg-gradient-to-b from-purple-400 to-purple-600 rounded-full" />
          <h2 className="text-xl sm:text-2xl md:text-[28px] font-black text-white tracking-tight">
            Bảng Xếp Hạng Anime
          </h2>
        </div>

        {animes.length > 0 && (
          <div className="hidden sm:flex gap-2">
            <button 
              onClick={() => scroll('left')}
              className="p-2.5 border border-white/10 rounded-lg bg-transparent hover:bg-white/10 transition-colors text-white/80 hover:text-white"
            >
              <ArrowLeft size={18} />
            </button>
            <button 
              onClick={() => scroll('right')}
              className="p-2.5 border border-white/10 rounded-lg bg-transparent hover:bg-white/10 transition-colors text-white/80 hover:text-white"
            >
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
      <div className="group relative">
        <div
          ref={scrollRef}
          className="flex gap-4 sm:gap-6 overflow-x-auto pb-8 pt-2 px-4 md:px-12 scrollbar-hide snap-x will-change-transform transform-gpu"
          style={{ scrollbarWidth: "none" }}
        >
          {animes.map((anime: any, index: number) => {
            // map anime to Ophim format to reuse RankingCard
            const mappedMovie = {
              name: anime.title || anime.name,
              origin_name: anime.title || anime.name,
              poster_url: anime.image || anime.thumb || anime.picture_url,
              thumb_url: anime.image || anime.thumb || anime.picture_url,
              slug: anime.slug || anime._id || anime.id,
              year: anime.year || "",
              quality: "HD",
              type: "series",
              category: anime.genres?.map((g: string) => ({ name: g })) || [],
              duration: anime.duration || "24 Phút",
              rating: anime.rating || anime.score || null
            };
            
            return (
              <div key={index} className="flex-none snap-start">
                <RankingCard movie={mappedMovie} onSelect={() => handleSelect(anime)} idx={index} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
