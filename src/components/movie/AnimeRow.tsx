import React, { useRef } from 'react';
import { useAnimeDbSeasonNow, useAnimeDbUpcoming } from '../../hooks/useAnimeDb';
import { MovieCard } from './MovieCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AnimeRowProps {
  title: string;
  type: 'season-now' | 'upcoming';
  onSelect: (slug: string) => void;
}

export const AnimeRow = ({ title, type, onSelect }: AnimeRowProps) => {
  const isNow = type === 'season-now';
  const { data: seasonNowData, isLoading: loadingNow } = useAnimeDbSeasonNow(1, 20);
  const { data: upcomingData, isLoading: loadingUpcoming } = useAnimeDbUpcoming(1, 20);

  const animeData = isNow ? seasonNowData : upcomingData;
  const isLoading = isNow ? loadingNow : loadingUpcoming;

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

  const handleSelect = async (anime: any) => {
    try {
      const { tmdbSearchTv, tmdbSearchMovie } = await import('../../api/tmdbApi');
      const searchQuery = anime.title || anime.title_english || anime.title_japanese || "";
      const isMovie = anime.type?.toLowerCase() === 'movie';
      
      console.log(
        `%c[ANIME MATCHING] Starting TMDB search for MAL Anime: "${searchQuery}"`,
        'background: #E50914; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
        {
          malId: anime.mal_id,
          title: anime.title,
          titleEnglish: anime.title_english,
          titleJapanese: anime.title_japanese,
          type: anime.type,
          year: anime.year || anime.aired?.prop?.from?.year
        }
      );

      // Search specific to type
      const res = await (isMovie ? tmdbSearchMovie(searchQuery) : tmdbSearchTv(searchQuery));
      
      if (res && res.results && res.results.length > 0) {
        console.log(
          `%c[ANIME MATCHING] TMDB Search Results:`,
          'color: #10B981; font-weight: bold;',
          res.results.map((r: any) => ({
            id: r.id,
            title: r.title || r.name,
            original_language: r.original_language,
            genre_ids: r.genre_ids,
            release_date: r.first_air_date || r.release_date
          }))
        );

        // Find best match: Japanese language and Animation genre (16)
        let matchCriteria = "Year + Japanese + Animation";
        let tmdbItem = res.results.find((r: any) => {
          const rYear = r.first_air_date ? r.first_air_date.split('-')[0] : (r.release_date ? r.release_date.split('-')[0] : null);
          const aYear = anime.year?.toString() || anime.aired?.prop?.from?.year?.toString();
          return rYear === aYear && r.original_language === 'ja' && r.genre_ids?.includes(16);
        });

        if (!tmdbItem) {
          matchCriteria = "Japanese + Animation Only";
          tmdbItem = res.results.find((r: any) => 
            r.original_language === 'ja' && 
            r.genre_ids?.includes(16)
          );
        }

        // Final fallback to first result
        if (!tmdbItem) {
          matchCriteria = "First Available Result Fallback";
          tmdbItem = res.results[0];
        }

        const mediaType = isMovie ? 'movie' : 'tv';
        const slug = `tmdb-${tmdbItem.id}-${mediaType}`;

        console.log(
          `%c[ANIME MATCHING] Match Resolved! Criteria: "${matchCriteria}"`,
          'background: #3B82F6; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
          {
            matchedTitle: tmdbItem.title || tmdbItem.name,
            matchedTmdbId: tmdbItem.id,
            mediaType,
            slug
          }
        );
        onSelect(slug);
      } else {
        console.warn(`%c[ANIME MATCHING] No TMDB results found for keyword: "${searchQuery}"`, 'color: #EF4444; font-weight: bold;');
        const showAlert = (window as any).showCinemaxAlert || alert;
        showAlert("Nội dung phim này đang được cập nhật lên hệ thống. Vui lòng quay lại sau nhé!");
      }
    } catch (e) {
      console.error(e);
      const showAlert = (window as any).showCinemaxAlert || alert;
      showAlert("Có lỗi xảy ra khi tải thông tin phim. Vui lòng thử lại sau.");
    }
  };

  const seenMalIds = new Set();
  const animes = (animeData?.data || []).filter((anime: any) => {
    if (!anime.mal_id || seenMalIds.has(anime.mal_id)) return false;
    seenMalIds.add(anime.mal_id);
    return true;
  });

  if (isLoading || animes.length === 0) return null;

  return (
    <div className="py-[1.5vw] md:py-[2vw] relative group/row overflow-visible">
      <div className="flex items-center gap-3 px-4 sm:px-8 md:px-12 mb-3">
        <div className="w-[3px] h-5 sm:h-6 bg-[#E50914] rounded-full" />
        <h2 className="text-white text-xl sm:text-2xl md:text-[28px] font-bold tracking-tight">
          {title}
        </h2>
      </div>

      <div className="group relative">
        {/* Left Button */}
        <button 
          onClick={() => scroll('left')}
          className="hidden md:flex absolute left-4 top-[42%] -translate-y-1/2 z-20 w-10 h-10 bg-[#111111]/85 hover:bg-black opacity-0 group-hover:opacity-100 transition-all items-center justify-center hover:scale-105 border border-white/10 rounded-full shadow-2xl active:scale-95 cursor-pointer"
        >
          <ChevronLeft size={20} className="text-white" />
        </button>

        {/* Right Button */}
        <button 
          onClick={() => scroll('right')}
          className="hidden md:flex absolute right-4 top-[42%] -translate-y-1/2 z-20 w-10 h-10 bg-[#111111]/85 hover:bg-black opacity-0 group-hover:opacity-100 transition-all items-center justify-center hover:scale-105 border border-white/10 rounded-full shadow-2xl active:scale-95 cursor-pointer"
        >
          <ChevronRight size={20} className="text-white" />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-2 lg:gap-3 overflow-x-auto py-8 sm:py-12 -my-8 sm:-my-12 px-[4%] scrollbar-hide items-center relative z-10"
          style={{ scrollbarWidth: "none" }}
        >
          {animes.map((anime: any, idx: number) => {
            // Map anime to the format expected by MovieCard
            const mappedMovie = {
              name: anime.title_english || anime.title || anime.title_japanese,
              origin_name: anime.title || anime.title_japanese,
              poster_url: anime.images?.webp?.large_image_url || anime.images?.jpg?.large_image_url || null,
              thumb_url: anime.images?.webp?.large_image_url || anime.images?.jpg?.large_image_url || null,
              slug: anime.mal_id ? `mal-${anime.mal_id}` : '',
              year: anime.year?.toString() || anime.aired?.prop?.from?.year?.toString() || "",
              type: anime.type?.toLowerCase() === "movie" ? "single" : "series",
              tmdb: {
                vote_average: anime.score || "7.5"
              }
            };

            return (
              <div key={`${anime.mal_id}-${idx}`} className="shrink-0 pt-4 pb-12">
                <MovieCard
                  movie={mappedMovie}
                  onSelect={() => handleSelect(anime)}
                  isTop10={false}
                  idx={idx}
                  rowTitle={title}
                  aspectRatio="poster"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
