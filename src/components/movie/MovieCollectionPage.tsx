import React from 'react';
import { motion } from 'framer-motion';
import { X, Play, Calendar, Star } from 'lucide-react';
import { SafeImage } from '../ui/ImageShimmer';
import { useTmdbCollection } from '../../hooks/useTmdb';
import { useQuery } from '@tanstack/react-query';
import { fetchTmdb } from '../../api/tmdbApi';

export const MovieCollectionPage = ({
  collectionId,
  collectionBackdrop,
  onClose,
  onSelectMovie
}: {
  collectionId: number;
  collectionBackdrop: string | null;
  onClose: () => void;
  onSelectMovie: (slug: string) => void;
}) => {
  const { data: collectionData } = useTmdbCollection(collectionId);

  // Fetch the collection in English for language fallbacks (e.g. Japanese/non-Latin titles)
  const { data: collectionDataEn } = useQuery({
    queryKey: ['tmdb', 'collection', collectionId, 'en'],
    queryFn: () => fetchTmdb(`/collection/${collectionId}`, { language: 'en' }),
    enabled: !!collectionId
  });

  const enTitleMap = React.useMemo(() => {
    const map = new Map<number, string>();
    if (collectionDataEn?.parts) {
      collectionDataEn.parts.forEach((p: any) => {
        map.set(p.id, p.title || p.name);
      });
    }
    return map;
  }, [collectionDataEn]);

  const isLatin = (str: string): boolean => {
    if (!str) return false;
    // Standard Latin characters including Vietnamese diacritics
    return /^[a-zA-Z0-9\s\-\:\(\)\[\]\+\&\'\.\,\!\?ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂÂÊÔƠưăâêôơ]*$/.test(str);
  };

  const getMovieTitle = (movie: any) => {
    const defaultTitle = movie.title || movie.name || '';
    if (!isLatin(defaultTitle)) {
      const enTitle = enTitleMap.get(movie.id);
      if (enTitle && isLatin(enTitle)) {
        return enTitle;
      }
    }
    return defaultTitle;
  };

  const getCollectionName = () => {
    const defaultName = collectionData?.name || "Danh Sách Bộ Sưu Tập";
    if (defaultName !== "Danh Sách Bộ Sưu Tập" && !isLatin(defaultName)) {
      const enName = collectionDataEn?.name;
      if (enName && isLatin(enName)) {
        return enName;
      }
    }
    return defaultName;
  };

  const parts = collectionData?.parts ? [...collectionData.parts].sort((a, b) => {
    return new Date(a.release_date || 0).getTime() - new Date(b.release_date || 0).getTime();
  }) : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="fixed inset-0 z-[130] bg-[#090909] overflow-y-auto selection:bg-[#ff2e35]/30 custom-scrollbar"
    >
      {/* Immersive Backdrop Section with rich vignette and color styling */}
      <div className="absolute inset-0 top-0 h-[60vh] z-0 overflow-hidden select-none pointer-events-none">
        {collectionBackdrop && (
          <>
            <img src={collectionBackdrop} alt="" className="w-full h-full object-cover scale-105 blur-sm opacity-15 filter brightness-75 transition-all duration-700" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#090909] via-[#090909]/85 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#090909]/40 via-transparent to-[#090909]/40" />
          </>
        )}
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-10 sm:px-8 sm:py-20 min-h-screen flex flex-col">
        {/* Sleek Minimalist Rounded Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 sm:fixed sm:top-10 sm:right-10 w-11 h-11 bg-black/60 hover:bg-white/10 active:scale-95 text-white backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 transition-all z-50 cursor-pointer shadow-2xl"
          id="btn-close-collection"
        >
          <X size={20} />
        </button>

        {/* Cinematic Header Block */}
        <div className="mb-10 sm:mb-14 relative mt-4">
          <span className="text-[10px] sm:text-[11px] font-black uppercase text-[#ff2e35] tracking-[0.3em] mb-2.5 block select-none">
            Đại Diện Bản Quyền • Loạt Phim Trọn Bộ
          </span>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tighter mb-4 leading-tight uppercase select-none">
            {getCollectionName()}
          </h1>
          <div className="w-16 h-[3px] bg-[#ff2e35] mb-5 rounded-full" />
          <p className="text-gray-400 text-sm sm:text-base leading-relaxed max-w-2xl font-semibold opacity-90">
             {collectionData?.overview || "Tuyển tập các phần phim kinh điển kế thừa vũ trụ điện ảnh đỉnh cao, mang lại trải nghiệm cốt truyện liền mạch."}
          </p>
        </div>

        {/* Compact, Ultra-optimized Row-first List Layout */}
        <div className="flex flex-col gap-4 sm:gap-5 w-full">
           {parts.map((movie: any) => {
             const posterUrl = movie.poster_path ? (movie.poster_path.startsWith('http') ? movie.poster_path : `https://image.tmdb.org/t/p/w342/${movie.poster_path.split('/').pop()}`) : null;
             const year = movie.release_date ? movie.release_date.split('-')[0] : '';
             const movieTitle = getMovieTitle(movie);
             
             return (
               <div 
                 key={movie.id} 
                 className="flex flex-row gap-4 sm:gap-6 bg-[#141414]/95 border border-white/[0.04] p-3.5 sm:p-5 rounded-2xl hover:bg-[#1a1a1a] hover:border-[#ff2e35]/30 transition-all duration-300 group cursor-pointer shadow-[0_8px_30px_rgba(0,0,0,0.5)] active:scale-[0.99] items-center" 
                 onClick={() => { onSelectMovie(`tmdb-${movie.id}-movie`); onClose(); }}
                 id={`collection-item-${movie.id}`}
               >
                 {/* Compact Columnized Poster on Left */}
                 <div className="w-[80px] sm:w-[110px] md:w-[130px] shrink-0 rounded-xl overflow-hidden aspect-[2/3] bg-black/40 relative border border-white/[0.08] group-hover:border-[#ff2e35]/40 transition-all duration-300 shadow-md">
                   {posterUrl ? (
                     <SafeImage src={posterUrl} alt={movieTitle} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                   ) : (
                     <div className="w-full h-full flex items-center justify-center text-gray-600 font-bold p-3 text-center text-xs select-none">{movieTitle}</div>
                   )}
                   <div className="absolute inset-0 bg-[#ff2e35]/15 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                      <div className="bg-[#ff2e35] text-white rounded-full p-2.5 sm:p-3.5 shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-300">
                        <Play size={16} fill="currentColor" className="ml-0.5 sm:ml-1" />
                      </div>
                   </div>
                 </div>

                 {/* Information Column */}
                 <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
                   <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                     <h3 className="text-base sm:text-xl md:text-2xl font-extrabold text-white group-hover:text-[#ff2e35] transition-colors leading-tight truncate pr-2 w-full">
                       {movieTitle}
                     </h3>
                   </div>
                   
                   <div className="flex items-center gap-3.5 text-xs font-semibold text-gray-500 mb-2.5">
                     {year && (
                       <span className="flex items-center gap-1 text-gray-400 font-bold bg-white/5 border border-white/5 px-2 py-0.5 rounded-md">
                         <Calendar size={12} className="text-gray-500" />
                         {year}
                       </span>
                     )}
                     {movie.vote_average > 0 && (
                       <span className="flex items-center gap-1 text-[#ff2e35] font-bold">
                         <Star size={12} className="fill-[#ff2e35]/10" />
                         {movie.vote_average.toFixed(1)}
                       </span>
                     )}
                   </div>
                   
                   {/* Clean truncated descriptions that gracefully fit layout and completely eliminate bloating on mobile */}
                   <p className="text-gray-400 text-xs sm:text-sm leading-relaxed line-clamp-2 sm:line-clamp-3 font-medium opacity-85">
                     {movie.overview || "Đang cập nhật nội dung cho phần phim này."}
                   </p>
                 </div>
               </div>
             );
           })}
        </div>
      </div>
    </motion.div>
  );
};
