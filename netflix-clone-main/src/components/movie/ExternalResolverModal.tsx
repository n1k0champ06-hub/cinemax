import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { X, Search, ExternalLink } from 'lucide-react';
import { useTmdbDetails, useTmdbFindByExternalId } from '../../hooks/useTmdb';
import { fetchSearch } from '../../api/phimApi';
import { SafeImage } from '../ui/ImageShimmer';

export const ExternalResolverModal = ({
  id,
  onClose,
  onSelect,
}: {
  id: string; // e.g. "tt123456" for IMDB or "tmdb-123-movie" or "tmdb-123-tv" for TMDB
  onClose: () => void;
  onSelect: (slug: string) => void;
}) => {
  const isImdb = id.startsWith('tt');
  const isTmdb = id.startsWith('tmdb-');
  
  const tmdbParts = isTmdb ? id.split('-') : []; // ["tmdb", "123", "movie"]
  const tmdbId = isTmdb ? tmdbParts[1] : null;
  const tmdbType = isTmdb ? tmdbParts[2] as 'movie'|'tv' : 'movie';

  // Nếu là IMDB ID, dùng TMDB find API để resolve sang TMDB
  const { data: imdbToTmdb, isLoading: isLoadingImdbResolve } = useTmdbFindByExternalId(isImdb ? id : '');
  const resolvedFromImdb = imdbToTmdb?.movie_results?.[0] || imdbToTmdb?.tv_results?.[0];
  const resolvedTmdbId = tmdbId || resolvedFromImdb?.id?.toString();
  const resolvedType = tmdbType || (imdbToTmdb?.tv_results?.[0] ? 'tv' : 'movie');

  const { data: tmdbDetail, isLoading: isLoadingTmdb } = useTmdbDetails(resolvedTmdbId || 0, resolvedType);

  const originalTitle = tmdbDetail?.original_title || tmdbDetail?.original_name;
  const localTitle = tmdbDetail?.title || tmdbDetail?.name;
  const displayTitle = localTitle || originalTitle;
  const backdrop = tmdbDetail?.backdrop_path ? `https://image.tmdb.org/t/p/w780${tmdbDetail.backdrop_path}` : null;
  const poster = tmdbDetail?.poster_path ? `https://image.tmdb.org/t/p/w342${tmdbDetail.poster_path}` : null;
  const rating = tmdbDetail?.vote_average ? tmdbDetail.vote_average.toFixed(1) : null;
  const releaseYear = (tmdbDetail?.release_date || tmdbDetail?.first_air_date || '').substring(0, 4);

  // Bước 1: Tìm bằng tên gốc (original_title) trước
  const [searchAttempt, setSearchAttempt] = useState<'original' | 'local' | 'done'>('original');
  
  const searchQuery = searchAttempt === 'original' ? originalTitle : 
                      searchAttempt === 'local' ? localTitle : '';

  const { data: searchResults, isLoading: isLoadingSearch } = useQuery({
    queryKey: ['phimapi_resolve', searchQuery],
    queryFn: () => fetchSearch(searchQuery || ''),
    enabled: !!searchQuery && searchAttempt !== 'done',
  });

  useEffect(() => {
    if (!searchResults) return;
    
    if (searchResults.length > 0) {
      // Tìm thấy, chuyển sang MovieDetail
      onSelect(searchResults[0].slug);
      setSearchAttempt('done');
    } else if (searchAttempt === 'original' && localTitle && localTitle !== originalTitle) {
      // Tên gốc không tìm thấy, thử bằng tên dịch
      setSearchAttempt('local');
    } else {
      // Cả hai tên đều không tìm thấy
      setSearchAttempt('done');
    }
  }, [searchResults, searchAttempt, originalTitle, localTitle, onSelect]);

  const isLoading = isLoadingImdbResolve || isLoadingTmdb || (searchAttempt !== 'done' && (!!searchQuery && isLoadingSearch));
  const notFound = !isLoading && searchAttempt === 'done' && (!searchResults || searchResults.length === 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex flex-col justify-center items-center"
    >
      {isLoading && (
        <div className="flex flex-col items-center justify-center">
          {backdrop && (
            <div className="w-64 h-36 rounded-xl overflow-hidden mb-6 shadow-2xl opacity-60">
              <SafeImage src={backdrop} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-4" />
          <h2 className="text-white text-xl font-bold animate-pulse">Đang tìm dữ liệu phim...</h2>
          {displayTitle && (
            <p className="text-gray-400 text-sm mt-2">"{displayTitle}"</p>
          )}
        </div>
      )}

      {notFound && (
        <div className="bg-[#111] border border-white/10 rounded-2xl max-w-md w-full mx-4 text-center relative shadow-2xl overflow-hidden">
          {/* Backdrop preview */}
          {backdrop && (
            <div className="w-full h-40 relative">
              <SafeImage src={backdrop} alt="" className="w-full h-full object-cover opacity-40" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#111] to-transparent" />
            </div>
          )}
          
          <div className={`p-8 ${backdrop ? '-mt-10 relative z-10' : ''}`}>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors z-20"
            >
              <X size={24} />
            </button>

            {poster && !backdrop && (
              <div className="w-24 h-36 mx-auto mb-4 rounded-lg overflow-hidden shadow-xl">
                <SafeImage src={poster} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            
            {!poster && !backdrop && (
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                <Search size={32} className="text-gray-400" />
              </div>
            )}

            <h2 className="text-xl font-bold text-white mb-2">Không có trong máy chủ!</h2>
            
            {displayTitle && (
              <p className="text-white/80 font-semibold text-lg mb-1">"{displayTitle}"</p>
            )}
            
            <div className="flex items-center justify-center gap-3 text-sm text-gray-400 mb-4">
              {releaseYear && <span>{releaseYear}</span>}
              {rating && <span>⭐ {rating}/10</span>}
            </div>

            <p className="text-gray-400 text-sm mb-6">
              Rất tiếc bộ phim này chưa có sẵn trên hệ thống của chúng tôi. Bạn có thể sử dụng thanh tìm kiếm để tìm bộ phim khác nhé.
            </p>
            <button 
              onClick={onClose}
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold w-full py-3 rounded-xl transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
};
