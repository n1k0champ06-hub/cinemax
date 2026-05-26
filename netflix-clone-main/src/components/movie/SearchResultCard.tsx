import React from 'react';
import { motion } from 'motion/react';
import { Play } from 'lucide-react';
import { SafeImage } from '../ui/ImageShimmer';

export const SearchResultCard = ({ movie, onSelect, idx }: { key?: React.Key, movie: any, onSelect: (slug: string) => void, idx: number }) => {
  const rawPoster = movie.poster_url;
  const safePoster = typeof rawPoster === 'string' && !rawPoster.startsWith('http') ? `https://phimimg.com/${rawPoster}` : rawPoster;
  const finalPoster = safePoster;
  const displayName = typeof movie.name === 'string' ? movie.name : '';
  const rating = movie?.tmdb?.vote_average ? parseFloat(movie.tmdb.vote_average).toFixed(1) : null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: idx * 0.03 }}
      whileHover={{ scale: 1.03, y: -4, zIndex: 10 }}
      onClick={() => {
        if (typeof movie.slug === 'string') {
          onSelect(movie.slug);
        }
      }}
      className="cursor-pointer group flex flex-col gap-2 text-left"
    >
      <div className="rounded-xl overflow-hidden bg-[#111] relative shadow-lg ring-1 ring-white/5 group-hover:ring-white/20 transition-all aspect-[2/3] w-full">
        <SafeImage 
          src={finalPoster} 
          alt={movie.name || 'Movie'} 
          className="absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:brightness-[0.8] group-hover:scale-105" 
        />
      </div>

      <div className="flex flex-col gap-1 px-1">
        <h3 className="text-white font-bold text-sm sm:text-base leading-tight line-clamp-1 group-hover:text-red-500 transition-colors">
          {displayName}
        </h3>
        
        <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-semibold text-gray-400 uppercase">
          {rating && <span className="text-yellow-500 font-extrabold">{rating} ★</span>}
          <span>{movie.year || '2024'}</span>
          <span className="border border-white/10 px-1 rounded text-[10px] font-bold text-gray-500 bg-white/5">{movie.quality || 'FHD'}</span>
        </div>
      </div>
    </motion.div>
  );
};
