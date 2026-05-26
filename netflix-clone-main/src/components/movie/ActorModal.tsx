import React from 'react';
import { motion } from 'motion/react';
import { useImdbActor } from '../../hooks/useImdb236New';
import { useTmdbPerson } from '../../hooks/useTmdb';
import { X } from 'lucide-react';
import { SafeImage, HorizontalShimmer } from '../ui/ImageShimmer';
import { ImdbMovieCard } from './ImdbMovieCard';
import { RankingCard } from './RankingCard';

export const ActorModal = ({ actorId, onClose, onSelectMovie }: { actorId: string, onClose: () => void, onSelectMovie: (slug: string) => void }) => {
  const isTmdb = actorId.startsWith('tmdb-');
  const pureId = isTmdb ? actorId.replace('tmdb-', '') : actorId;
  const { data: imdbData, isLoading: imdbLoading } = useImdbActor(isTmdb ? null : pureId);
  const { data: tmdbData, isLoading: tmdbLoading } = useTmdbPerson(isTmdb ? pureId : null);

  const isLoading = isTmdb ? tmdbLoading : imdbLoading;
  
  // Format unified data
  let data = null;
  if (isTmdb && tmdbData && !tmdbData.success === false) {
    data = {
      fullName: tmdbData.name,
      primaryImage: tmdbData.profile_path ? `https://image.tmdb.org/t/p/w500${tmdbData.profile_path}` : null,
      knownFor: [tmdbData.known_for_department],
      birthDate: tmdbData.birthday,
      birthPlace: tmdbData.place_of_birth,
      miniBios: [{ text: tmdbData.biography }],
      isTmdb: true,
      popularTitles: tmdbData.combined_credits?.cast?.sort((a: any, b: any) => b.popularity - a.popularity).slice(0, 10).map((m: any) => ({
        id: `tmdb-${m.id}-${m.media_type}`,
        title: m.title || m.name,
        primaryTitle: m.original_title || m.original_name,
        poster: m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : null,
        rating: m.vote_average,
      }))
    };
  } else if (!isTmdb && imdbData) {
    data = {
      ...imdbData,
      isTmdb: false,
    };
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-[#111] max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 shadow-2xl relative"
      >
        <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-white/20 text-white rounded-full transition-colors">
          <X size={24} />
        </button>

        {isLoading ? (
          <div className="p-8">
            <HorizontalShimmer />
          </div>
        ) : data ? (
          <div>
            <div className="flex flex-col md:flex-row gap-8 p-8 border-b border-white/5">
              <div className="w-48 h-48 md:w-64 md:h-64 shrink-0 mx-auto md:mx-0">
                <SafeImage src={data.primaryImage} alt={data.fullName} className="w-full h-full object-cover rounded-full shadow-xl border-4 border-white/5" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-3xl md:text-5xl font-black text-white mb-2">{data.fullName}</h2>
                <div className="text-purple-400 font-medium mb-4">{data.knownFor?.join(" • ")}</div>
                {data.birthDate && (
                  <p className="text-gray-400 text-sm mb-4">
                    Sinh ngày: <span className="text-white">{data.birthDate}</span> {data.birthPlace && `tại ${data.birthPlace}`}
                  </p>
                )}
                <p className="text-gray-300 leading-relaxed text-sm md:text-base line-clamp-6">
                   {data.miniBios?.[0]?.text || "Đang cập nhật tiểu sử."}
                </p>
              </div>
            </div>

            {data.popularTitles && data.popularTitles.length > 0 && (
              <div className="p-8">
                <h3 className="text-xl font-bold text-white mb-6">Tác phẩm nổi bật</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {data.popularTitles.slice(0, 8).map((movie: any, idx: number) => (
                    data.isTmdb ? (
                      <RankingCard 
                        key={movie.id} 
                        movie={movie} 
                        idx={idx} 
                        onSelect={(slug) => {
                           onSelectMovie(slug);
                           onClose();
                        }} 
                      />
                    ) : (
                      <ImdbMovieCard 
                        key={movie.id} 
                        movie={movie} 
                        idx={idx} 
                        onSelect={(slug) => {
                           onSelectMovie(slug);
                           onClose();
                        }} 
                      />
                    )
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
           <div className="p-8 text-center text-gray-500">Lỗi không thể tải thông tin.</div>
        )}
      </motion.div>
    </motion.div>
  );
};
