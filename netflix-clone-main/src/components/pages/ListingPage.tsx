import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Loader2, ListFilter } from 'lucide-react';
import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import { cn } from '../../lib/utils';
import { fetchMultiSource } from '../../api/phimApi';
import { fetchTmdb } from '../../api/tmdbApi';
import { SearchResultCard } from '../movie/SearchResultCard';
import { GridShimmer } from '../ui/ImageShimmer';

export const ListingPage = ({ currentTab, onSelect, setTab }: { currentTab: string, onSelect: (slug: string) => void, setTab: (t: string) => void }) => {
  const isMyList = currentTab === 'my-list';
  const [filterType, setFilterType] = useState<'recent' | 'popular' | 'rating'>('recent');
  
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['movies', currentTab, filterType],
    queryFn: async ({ pageParam = 1 }) => {
      if (isMyList) {
        if (pageParam === 1) {
          const saved = localStorage.getItem('cinemax_mylist');
          if (saved) {
            return JSON.parse(saved);
          }
          return [];
        }
        return [];
      }
      
      // Gần đây: Lấy phim mới cập nhật/tải lên từ máy chủ Ophim/PhimAPI
      if (filterType === 'recent') {
        let typeSlug = '';
        if (currentTab === 'phim-bo') typeSlug = 'phim-bo';
        else if (currentTab === 'phim-le') typeSlug = 'phim-le';
        else if (currentTab === 'hoat-hinh') typeSlug = 'hoat-hinh';
        else if (currentTab.startsWith('the-loai/')) {
          typeSlug = currentTab;
        } else {
          typeSlug = 'phim-moi-cap-nhat';
        }

        const rawList = await fetchMultiSource(typeSlug, pageParam);
        return rawList.map((item: any) => ({
          id: item.slug,
          slug: item.slug,
          name: item.name,
          origin_name: item.origin_name,
          poster_url: item.poster_url,
          year: item.year || '2024',
          quality: item.quality || 'FHD',
          tmdb: item.tmdb || null,
        }));
      }
      
      // Phổ biến & Đánh giá cao: Lấy dữ liệu chất lượng cao từ TMDB
      let tmdbType: 'movie' | 'tv' | 'multi' = 'movie';
      let genreId = '';
      
      if (currentTab === 'phim-bo') tmdbType = 'tv';
      else if (currentTab === 'phim-le') tmdbType = 'movie';
      else if (currentTab === 'hoat-hinh') { tmdbType = 'multi'; genreId = '16'; }
      else if (currentTab.startsWith('the-loai/')) {
        tmdbType = 'movie';
        const genreSlug = currentTab.replace('the-loai/', '');
        const genreMap: Record<string, string> = {
          'hanh-dong': '28', 'tinh-cam': '10749', 'hai-huoc': '35',
          'co-trang': '36', 'tam-ly': '18', 'hinh-su': '80',
          'chien-tranh': '10752', 'vo-thuat': '28', 'vien-tuong': '878',
          'kinh-di': '27', 'tai-lieu': '99', 'am-nhac': '10402',
          'gia-dinh': '10751', 'hoc-duong': '35',
        };
        genreId = genreMap[genreSlug] || '';
      }

      const params: any = { page: pageParam };
      if (genreId) params.with_genres = genreId;
      
      let endpoint = `/discover/${tmdbType === 'multi' ? 'movie' : tmdbType}`;
      
      if (filterType === 'popular') {
        params.sort_by = 'popularity.desc';
      } else if (filterType === 'rating') {
        params.sort_by = 'vote_average.desc';
        params['vote_count.gte'] = 200; 
      }
      
      if (currentTab === 'phim-moi-cap-nhat' || currentTab === 'danh-sach/phim-moi-cap-nhat') {
         if (filterType === 'popular') endpoint = '/movie/popular';
         else if (filterType === 'rating') endpoint = '/movie/top_rated';
      }
      
      const res = await fetchTmdb(endpoint, params);
      
      return (res?.results || []).map((item: any) => ({
        id: `tmdb-${item.id}-${tmdbType === 'multi' ? item.media_type || 'movie' : tmdbType}`,
        slug: `tmdb-${item.id}-${tmdbType === 'multi' ? item.media_type || 'movie' : tmdbType}`,
        name: item.title || item.name,
        origin_name: item.original_title || item.original_name,
        poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        tmdb: { vote_average: item.vote_average },
        year: (item.release_date || item.first_air_date || '').substring(0, 4),
      }));
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (isMyList || !lastPage || lastPage.length === 0) return undefined;
      return allPages.length + 1;
    },
  });

  const popularGenres = [
    { id: 'the-loai/hanh-dong', label: 'Hành Động' },
    { id: 'the-loai/tinh-cam', label: 'Tình Cảm' },
    { id: 'the-loai/hai-huoc', label: 'Hài Hước' },
    { id: 'the-loai/co-trang', label: 'Cổ Trang' },
    { id: 'the-loai/tam-ly', label: 'Tâm Lý' },
    { id: 'the-loai/hinh-su', label: 'Hình Sự' },
    { id: 'the-loai/chien-tranh', label: 'Chiến Tranh' },
    { id: 'the-loai/the-thao', label: 'Thể Thao' },
    { id: 'the-loai/vo-thuat', label: 'Võ Thuật' },
    { id: 'the-loai/vien-tuong', label: 'Viễn Tưởng' },
    { id: 'the-loai/kinh-di', label: 'Kinh Dị' },
    { id: 'the-loai/tai-lieu', label: 'Tài Liệu' },
    { id: 'the-loai/am-nhac', label: 'Âm Nhạc' },
    { id: 'the-loai/gia-dinh', label: 'Gia Đình' },
    { id: 'the-loai/hoc-duong', label: 'Học Đường' },
    { id: 'hoat-hinh', label: 'Hoạt Hình' },
  ];

  let title = 'PHIM';
  if (currentTab === 'phim-bo') title = 'Phim Bộ';
  else if (currentTab === 'phim-le') title = 'Phim Lẻ';
  else if (currentTab === 'phim-moi-cap-nhat') title = 'Mới & Phổ biến';
  else if (currentTab === 'danh-sach/phim-moi-cap-nhat') title = 'Đang Thịnh Hành';
  else if (currentTab === 'my-list') title = 'Danh sách của tôi';
  else if (currentTab === 'hoat-hinh') title = 'Thể loại: Hoạt Hình';
  else if (currentTab.startsWith('the-loai/')) {
    const genre = popularGenres.find(g => g.id === currentTab);
    title = genre ? `Thể loại: ${genre.label}` : currentTab.replace('the-loai/', 'Thể loại: ').replace(/-/g, ' ').toUpperCase();
  }

  const movies = data?.pages.flatMap(page => page) || [];
  
  const sortedMovies = movies;

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-12 w-full pt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h2 className="text-2xl md:text-3xl font-black text-white flex items-center gap-2 drop-shadow-md tracking-tight">
          {title}
        </h2>
        
        {!isMyList && movies.length > 0 && (
          <div className="flex bg-white/5 border border-white/10 p-1 rounded-xl w-max">
            <button 
              onClick={() => setFilterType('recent')}
              className={cn("px-4 py-2 text-sm font-semibold rounded-lg transition-colors", filterType === 'recent' ? "bg-white text-black" : "text-gray-400 hover:text-white")}
            >
              Gần đây
            </button>
            <button 
              onClick={() => setFilterType('popular')}
              className={cn("px-4 py-2 text-sm font-semibold rounded-lg transition-colors", filterType === 'popular' ? "bg-white text-black" : "text-gray-400 hover:text-white")}
            >
              Phổ biến
            </button>
            <button 
              onClick={() => setFilterType('rating')}
              className={cn("px-4 py-2 text-sm font-semibold rounded-lg transition-colors", filterType === 'rating' ? "bg-white text-black" : "text-gray-400 hover:text-white")}
            >
              Đánh giá cao
            </button>
          </div>
        )}
      </div>
      
      {isLoading && (
        <div className="mt-8">
          <GridShimmer />
        </div>
      )}
      
      {!isLoading && sortedMovies.length === 0 && (
        <div className="text-center mt-32 text-[#808080] text-xl">
          {isMyList ? "Bạn chưa lưu phim nào vào danh sách." : "Không tìm thấy phim nào."}
        </div>
      )}

      {!isLoading && sortedMovies.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 lg:gap-5">
            {sortedMovies.map((movie: any, idx: number) => (
              <SearchResultCard key={`${movie.slug || idx}-${idx}`} movie={movie} idx={idx} onSelect={(slug) => { onSelect(slug); }} />
            ))}
          </div>

          {hasNextPage && !isMyList && (
            <div className="flex justify-center mt-12 mb-8">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="px-8 py-4 bg-white text-black font-bold rounded-full transition-all flex items-center gap-2 disabled:opacity-50 hover:scale-105 active:scale-95 shadow-xl"
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
