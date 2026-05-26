import React from 'react';
import { motion } from 'motion/react';
import { useTmdbPerson } from '../../hooks/useTmdb';
import { X } from 'lucide-react';
import { SafeImage, HorizontalShimmer } from '../ui/ImageShimmer';
import { RankingCard } from './RankingCard';

export const ActorModal = ({ actorId, onClose, onSelectMovie }: { actorId: string, onClose: () => void, onSelectMovie: (slug: string) => void }) => {
  const isTmdb = actorId.startsWith('tmdb-');
  const pureId = isTmdb ? actorId.replace('tmdb-', '') : actorId;
  const { data: tmdbData, isLoading: tmdbLoading } = useTmdbPerson(pureId);

  const isLoading = tmdbLoading;
  
  // Format unified data
  let data: any = null;
  if (tmdbData && tmdbData.success !== false) {
    data = {
      fullName: tmdbData.name,
      primaryImage: tmdbData.profile_path ? (tmdbData.profile_path?.startsWith('http') ? tmdbData.profile_path : `https://image.tmdb.org/t/p/w500/${tmdbData.profile_path?.split('/').pop()}`) : null,
      knownFor: [tmdbData.known_for_department],
      birthDate: tmdbData.birthday,
      birthPlace: tmdbData.place_of_birth,
      miniBios: [{ text: tmdbData.biography }],
      isTmdb: true,
      popularTitles: tmdbData.combined_credits?.cast?.sort((a: any, b: any) => b.popularity - a.popularity).slice(0, 10).map((m: any) => ({
        id: `tmdb-${m.id}-${m.media_type}`,
        title: m.title || m.name,
        primaryTitle: m.original_title || m.original_name,
        poster: m.poster_path ? (m.poster_path?.startsWith('http') ? m.poster_path : `https://image.tmdb.org/t/p/w342/${m.poster_path?.split('/').pop()}`) : null,
        rating: m.vote_average,
      }))
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
        className="bg-[#111] max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 shadow-2xl relative custom-scrollbar"
      >
        <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-white/20 text-white rounded-full transition-colors">
          <X size={24} />
        </button>

        {isLoading ? (
          <div className="p-8"><HorizontalShimmer /></div>
        ) : data ? (
          <>
            <div className="p-8 md:p-10 border-b border-white/5 flex flex-col md:flex-row gap-8 items-center md:items-start relative">
              <div className="w-48 h-72 md:w-56 md:h-80 flex-shrink-0 rounded-2xl overflow-hidden shadow-2xl relative z-10">
                <SafeImage src={data.primaryImage} alt={data.fullName} className="w-full h-full object-cover" />
                <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl"></div>
              </div>
              
              <div className="flex-1 text-center md:text-left z-10">
                <h2 className="text-4xl md:text-5xl font-black text-white mb-3 tracking-tight">{data.fullName}</h2>
                <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-6">
                  {data.knownFor?.filter(Boolean).map((k: string) => (
                    <span key={k} className="px-4 py-1.5 bg-white/10 text-white/90 text-sm font-semibold rounded-full uppercase tracking-wider">{k}</span>
                  ))}
                </div>
                
                <div className="space-y-2 mb-6 text-sm md:text-base text-gray-400 font-medium">
                  {data.birthDate && <p><strong className="text-white">Sinh ngày:</strong> {data.birthDate}</p>}
                  {data.birthPlace && <p><strong className="text-white">Nơi sinh:</strong> {data.birthPlace}</p>}
                </div>
                
                {data.miniBios?.[0]?.text && (
                  <div className="text-gray-300 leading-relaxed text-sm md:text-base bg-white/5 p-4 rounded-xl">
                    <p className="line-clamp-6">{data.miniBios[0].text}</p>
                  </div>
                )}
              </div>
              
              {data.primaryImage && (
                <div className="absolute top-0 right-0 w-2/3 h-full opacity-10 pointer-events-none" style={{ background: `radial-gradient(circle at top right, rgba(255,255,255,1) 0%, rgba(0,0,0,0) 70%)` }}>
                  <img src={data.primaryImage} className="w-full h-full object-cover blur-3xl mix-blend-screen mask-image-gradient-to-l" alt="" />
                </div>
              )}
            </div>

            {data.popularTitles?.length > 0 && (
              <div className="p-8 md:p-10 bg-[#0a0a0a]">
                <h3 className="text-2xl font-black text-white mb-6 tracking-tight flex items-center gap-3">
                  <span className="w-2 h-8 rounded-full bg-purple-500"></span>
                  Tác phẩm nổi bật
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {data.popularTitles.slice(0, 8).map((movie: any, idx: number) => (
                    <RankingCard 
                      key={movie.id} 
                      movie={movie} 
                      idx={idx} 
                      onSelect={(slug) => {
                          onSelectMovie(slug);
                          onClose();
                      }} 
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="p-10 text-center text-gray-400">Không tìm thấy thông tin diễn viên.</div>
        )}
      </motion.div>
    </motion.div>
  );
};
