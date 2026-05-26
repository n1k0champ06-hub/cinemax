import React from 'react';
import { motion } from 'motion/react';
import { Play } from 'lucide-react';
import { SafeImage } from '../ui/ImageShimmer';

export const ImdbMovieCard = ({ movie, onSelect, idx }: { key?: React.Key, movie: any, onSelect: (slug: string) => void, idx: number }) => {
  const finalPoster = movie.primaryImage || movie.poster_url || "";
  const displayName = typeof movie.primaryTitle === 'string' ? movie.primaryTitle : typeof movie.name === 'string' ? movie.name : '';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: idx * 0.03 }}
      whileHover={{ scale: 1.05, y: -8, zIndex: 10 }}
      onClick={() => onSelect(movie.id || movie.slug)}
      className="cursor-pointer group relative"
    >
      <div className="rounded-xl overflow-hidden bg-[#111] relative shadow-lg ring-1 ring-white/5 group-hover:ring-white/20 transition-all group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)]" style={{ aspectRatio: '2/3' }}>
        <SafeImage src={finalPoster} alt={displayName} className="absolute inset-0 w-full h-full object-cover group-hover:brightness-[0.3] transition-all duration-300" />
        
        {/* Top Badges */}
        <div className="absolute top-2 left-2 right-2 flex justify-between items-start z-20">
           {movie.averageRating && (
             <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-md border border-white/10 flex items-center gap-1 text-[10px] sm:text-xs font-bold text-yellow-500 shadow-sm">
               ⭐ {movie.averageRating}
             </div>
           )}
        </div>

        {/* Hover Content */}
        <div className="absolute inset-0 flex flex-col justify-end p-3 sm:p-5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 bg-gradient-to-t from-black via-black/80 to-transparent">
          <div className="translate-y-4 group-hover:translate-y-0 transition-transform duration-300 flex flex-col gap-2 relative">
            <h3 className="text-white font-bold text-sm sm:text-base leading-tight drop-shadow-md line-clamp-2">{displayName}</h3>
            
            <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-medium text-gray-300">
              <span>{movie.startYear || movie.year}</span>
              {(movie.runtimeMinutes) && <span className="border border-white/30 px-1 rounded text-gray-400">{movie.runtimeMinutes}m</span>}
            </div>

            <div className="flex items-center mt-2">
              <button className="w-full bg-gradient-to-r from-red-600 to-red-500 text-white py-1.5 sm:py-2 rounded-full font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 hover:shadow-[0_0_15px_rgba(220,38,38,0.5)] hover:scale-105 transition-all active:scale-95 border border-red-400/20">
                <Play className="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" /> Watch
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
