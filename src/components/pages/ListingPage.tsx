import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Loader2, ListFilter } from 'lucide-react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { cn } from '../../lib/utils';
import { tmdbDiscover } from '../../api/tmdbApi';
import { MovieCard } from '../movie/MovieCard';
import { GridShimmer } from '../ui/ImageShimmer';
import { useTmdbBulkDetails } from '../../hooks/useTmdb';
import { useAnilistBulkCovers } from '../../hooks/useAnimeDb';

export const ListingPage = ({ currentTab, onSelect, setTab }: { currentTab: string, onSelect: (slug: string) => void, setTab: (t: string) => void }) => {
  const isMyList = currentTab === 'my-list';
  const [filterType, setFilterType] = useState<'popular' | 'rating'>(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get("filterType") as 'popular' | 'rating') || 'popular';
  });
  const [selectedGenre, setSelectedGenre] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("subgenre") || null;
  });
  const [isGenreOpen, setIsGenreOpen] = useState(false);

  // Sync ListingPage filters to URL query parameters
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (filterType !== 'popular') params.set("filterType", filterType);
    else params.delete("filterType");
    if (selectedGenre) params.set("subgenre", selectedGenre);
    else params.delete("subgenre");

    const queryString = params.toString();
    const newUrl = queryString ? `/?${queryString}` : "/";
    if (window.location.search !== (queryString ? `?${queryString}` : "")) {
      window.history.replaceState({}, "", newUrl);
    }
  }, [filterType, selectedGenre]);

  // Handle popstate for filters
  React.useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setFilterType((params.get("filterType") as 'popular' | 'rating') || 'popular');
      setSelectedGenre(params.get("subgenre") || null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  
  const popularGenres = [
    { id: 'the-loai/hanh-dong', label: 'Hành Động', tmdbId: '28' },
    { id: 'the-loai/tinh-cam', label: 'Tình Cảm', tmdbId: '10749' },
    { id: 'the-loai/hai-huoc', label: 'Hài Hước', tmdbId: '35' },
    { id: 'the-loai/co-trang', label: 'Cổ Trang', tmdbId: '36' },
    { id: 'the-loai/tam-ly', label: 'Tâm Lý', tmdbId: '18' },
    { id: 'the-loai/hinh-su', label: 'Hình Sự', tmdbId: '80' },
    { id: 'the-loai/chien-tranh', label: 'Chiến Tranh', tmdbId: '10752' },
    { id: 'the-loai/the-thao', label: 'Thể Thao', tmdbId: '99' }, // just mapping approximately
    { id: 'the-loai/vo-thuat', label: 'Võ Thuật', tmdbId: '28' },
    { id: 'the-loai/vien-tuong', label: 'Viễn Tưởng', tmdbId: '878' },
    { id: 'the-loai/kinh-di', label: 'Kinh Dị', tmdbId: '27' },
    { id: 'the-loai/tai-lieu', label: 'Tài Liệu', tmdbId: '99' },
    { id: 'the-loai/am-nhac', label: 'Âm Nhạc', tmdbId: '10402' },
    { id: 'the-loai/gia-dinh', label: 'Gia Đình', tmdbId: '10751' },
    { id: 'the-loai/hoc-duong', label: 'Học Đường', tmdbId: '35,18' },
    { id: 'hoat-hinh', label: 'Hoạt Hình', tmdbId: '16' },
  ];

  const getMediaParams = (tab: string) => {
     let mediaType: 'movie'|'tv' = 'movie';
     let params: any = {};
     if (tab === 'phim-bo') {
       mediaType = 'tv';
     } else if (tab === 'phim-moi-cap-nhat') {
       params.sort_by = 'primary_release_date.desc';
       params['vote_count.gte'] = 0;
     } else if (tab === 'music') {
       params.with_genres = '10402';
     } else if (tab.startsWith('the-loai/') || tab === 'hoat-hinh') {
       const genre = popularGenres.find(g => g.id === tab);
       if (genre) params.with_genres = genre.tmdbId;
     }

     if (selectedGenre) {
       params.with_genres = params.with_genres ? `${params.with_genres},${selectedGenre}` : selectedGenre;
     }

     if (filterType === 'rating') {
       params.sort_by = 'vote_average.desc';
       params['vote_count.gte'] = 100;
     } else if (!params.sort_by) {
       params.sort_by = 'popularity.desc';
     }

     return { mediaType, params };
  };

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['movies', currentTab, filterType, selectedGenre],
    queryFn: async ({ pageParam = 1 }) => {
      if (isMyList) {
        if (pageParam === 1) {
          const saved = localStorage.getItem('cinemax_mylist');
          if (saved) {
            return { results: JSON.parse(saved) };
          }
          return { results: [] };
        }
        return { results: [] };
      }
      const { mediaType, params } = getMediaParams(currentTab);
      const res = await tmdbDiscover(mediaType, { ...params, page: pageParam });
      if (res?.results && res.results.length > 0) {
        return {
           ...res,
           results: res.results.map((item: any) => ({
               id: `tmdb-${item.id}-${mediaType}`,
               slug: `tmdb-${item.id}-${mediaType}`,
               name: item.title || item.name,
               origin_name: item.original_title || item.original_name,
               poster_url: item.poster_path ? (item.poster_path?.startsWith('http') ? item.poster_path : `https://image.tmdb.org/t/p/w342/${item.poster_path?.split('/').pop()}`) : null,
               tmdb: { vote_average: item.vote_average },
               year: (item.release_date || item.first_air_date || '').substring(0, 4),
           }))
        };
      } else {
         throw new Error("TMDB empty");
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (isMyList || !lastPage || lastPage.results?.length === 0) return undefined;
      return allPages.length + 1;
    },
  });

  let title = 'PHIM';
  if (currentTab === 'phim-bo') title = 'Phim Bộ';
  else if (currentTab === 'phim-le') title = 'Phim Lẻ';
  else if (currentTab === 'phim-moi-cap-nhat') title = 'Mới & Phổ biến';
  else if (currentTab === 'danh-sach/phim-moi-cap-nhat') title = 'Đang Thịnh Hành';
  else if (currentTab === 'my-list') title = 'Danh sách của tôi';
  else if (currentTab === 'hoat-hinh') title = 'Anime';
  else if (currentTab === 'music') title = 'Âm Nhạc';
  else if (currentTab.startsWith('the-loai/')) {
    const genre = popularGenres.find(g => g.id === currentTab);
    title = genre ? `Thể loại: ${genre.label}` : currentTab.replace('the-loai/', 'Thể loại: ').replace(/-/g, ' ').toUpperCase();
  }

  // extract properly, handling my list too
  const movies = isMyList ? (data?.pages[0]?.results || []) : (data?.pages.flatMap(page => page.results || []) || []);

  const bulkRequests = useMemo(() => {
    return movies.map(movie => {
      const displayName = typeof movie.name === 'string' ? movie.name : (movie.title || '');
      const isOriginallyTvPattern = /phần|season|tập|mùa|part|\b(tv|series)\b/i.test(displayName);
      const isTv = movie?.type === 'series' || movie?.type === 'hoathinh' || movie?.tmdb?.media_type === 'tv' || (typeof movie?.slug === 'string' && movie.slug.endsWith('-tv')) || isOriginallyTvPattern;
      const tmdbId = movie?.tmdb_id || movie?.tmdb?.id || (typeof movie.slug === 'string' && movie.slug.startsWith('tmdb-') ? movie.slug.split('-')[1] : null);
      
      return tmdbId ? { id: tmdbId, type: isTv ? 'tv' as const : 'movie' as const } : null;
    }).filter(Boolean) as Array<{ id: string | number; type: 'movie' | 'tv' }>;
  }, [movies]);

  const bulkAnimeTitles = useMemo(() => {
    return movies.map(movie => {
      const displayName = typeof movie.name === 'string' ? movie.name : (movie.title || '');
      
      const isAnime = movie?.isJikan || 
        (typeof movie?.slug === 'string' && (movie.slug.startsWith('anilist-') || movie.slug.startsWith('mal-') || movie.slug.startsWith('jikan-') || /^\d+$/.test(movie.slug))) || 
        movie?.media_type === 'anime' || 
        (currentTab === 'hoat-hinh');
        
      return isAnime ? displayName : null;
    }).filter(Boolean) as string[];
  }, [movies, currentTab]);

  const { data: bulkTmdbData } = useTmdbBulkDetails(bulkRequests);
  const { data: bulkAnilistData } = useAnilistBulkCovers(bulkAnimeTitles);
  
  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-12 w-full pt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h2 className="text-2xl md:text-3xl font-black text-white flex items-center gap-2 drop-shadow-md tracking-tight">
          {title}
        </h2>
        
        {!isMyList && (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex bg-[#333] border border-transparent p-1 rounded-sm w-max shrink-0">
              <button 
                onClick={() => setFilterType('popular')}
                className={cn("px-4 py-2 text-sm font-semibold rounded-sm transition-colors", filterType === 'popular' ? "bg-white text-black" : "text-gray-300 hover:text-white")}
              >
                Phổ biến
              </button>
              <button 
                onClick={() => setFilterType('rating')}
                className={cn("px-4 py-2 text-sm font-semibold rounded-sm transition-colors", filterType === 'rating' ? "bg-white text-black" : "text-gray-300 hover:text-white")}
              >
                Phim hay nhất (TMDB)
              </button>
            </div>

            <div className="relative">
              <button 
                onClick={() => setIsGenreOpen(!isGenreOpen)}
                className="flex items-center gap-2 bg-[#333] hover:bg-[#444] px-4 py-2 rounded-sm text-sm font-semibold transition-colors text-white h-[36px]"
              >
                <ListFilter className="w-4 h-4" />
                {selectedGenre ? popularGenres.find(g => g.tmdbId === selectedGenre)?.label || 'Thể loại' : 'Thể loại'}
                <ChevronDown className={cn("w-4 h-4 transition-transform", isGenreOpen && "rotate-180")} />
              </button>
              {isGenreOpen && (
                <>
                  <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsGenreOpen(false)} />
                  <div className="absolute top-full right-0 sm:left-0 sm:right-auto mt-2 w-48 bg-[#1f1f1f] border border-[#333] rounded-sm py-2 shadow-2xl z-50 max-h-[60vh] overflow-y-auto">
                    <button 
                      className={cn("w-full text-left px-4 py-2 text-sm hover:bg-[#333] transition-colors", !selectedGenre ? 'text-[#E50914] font-bold' : 'text-gray-300')}
                      onClick={() => { setSelectedGenre(null); setIsGenreOpen(false); }}
                    >
                      Tất cả thể loại
                    </button>
                    {popularGenres.map(g => (
                      <button 
                        key={g.id}
                        className={cn("w-full text-left px-4 py-2 text-sm hover:bg-[#333] transition-colors", selectedGenre === g.tmdbId ? 'text-[#E50914] font-bold' : 'text-gray-300')}
                        onClick={() => { setSelectedGenre(g.tmdbId); setIsGenreOpen(false); }}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      
      {isLoading && (
        <div className="mt-8">
          <GridShimmer />
        </div>
      )}
      
      {!isLoading && movies.length === 0 && (
        <div className="text-center mt-32 text-gray-500 text-xl font-medium">
          {isMyList ? "Bạn chưa lưu phim nào vào danh sách." : "Không tìm thấy phim nào."}
        </div>
      )}

      {!isLoading && movies.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-10">
            {movies.map((movie: any, idx: number) => {
              const displayName = typeof movie.name === 'string' ? movie.name : (movie.title || '');
              const isOriginallyTvPattern = /phần|season|tập|mùa|part|\b(tv|series)\b/i.test(displayName);
              const isTv = movie?.type === 'series' || movie?.type === 'hoathinh' || movie?.tmdb?.media_type === 'tv' || (typeof movie?.slug === 'string' && movie.slug.endsWith('-tv')) || isOriginallyTvPattern;
              const tmdbId = movie?.tmdb_id || movie?.tmdb?.id || (typeof movie.slug === 'string' && movie.slug.startsWith('tmdb-') ? movie.slug.split('-')[1] : null);
              
              const enDetails = tmdbId ? bulkTmdbData?.[`${isTv ? 'tv' : 'movie'}:${tmdbId}`] : undefined;
              const resolvedDisplayName = enDetails?.title || enDetails?.name || displayName;
              const aniListCover = bulkAnilistData?.[resolvedDisplayName] || bulkAnilistData?.[displayName];

              return (
                <MovieCard 
                  key={`${movie.slug || idx}-${idx}`} 
                  movie={movie} 
                  idx={idx} 
                  isTop10={false} 
                  className="w-full"
                  onSelect={(slug) => { onSelect(slug); }} 
                  rowTitle={title}
                  enDetails={enDetails}
                  aniListCover={aniListCover}
                />
              );
            })}
          </div>

          {hasNextPage && !isMyList && (
            <div className="flex justify-center mt-12 mb-8">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="px-8 py-4 bg-[#333] text-white hover:bg-white hover:text-black font-bold rounded transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Đang tải...
                  </>
                ) : (
                  'Tải Thêm'
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
