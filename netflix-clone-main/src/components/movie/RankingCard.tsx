import React from 'react';
import { Play } from 'lucide-react';
import { SafeImage } from '../ui/ImageShimmer';

export const RankingCard = ({ movie, idx, onSelect }: { movie: any, idx: number, onSelect: (slug: string) => void }) => {
  const posterUrl = movie.primaryImage || movie.poster_url || movie.thumb_url || movie.image || movie.poster || "";
  const name = movie.primaryTitle || movie.name || movie.title || '';
  const originalName = movie.originalTitle || movie.origin_name || movie.original_name || name;
  
  const quality = movie.quality || "FHD";
  const duration = movie.runtimeMinutes ? `${movie.runtimeMinutes} Phút` : (movie.time || movie.duration || "");
  const slug = movie.id || movie.slug || movie._id;
  const ratingRaw = movie.rating || movie.score || movie.vote_average || null;
  const rating = ratingRaw ? parseFloat(ratingRaw.toString()).toFixed(1) : null;

  return (
    <div 
      className="flex flex-col gap-3 group cursor-pointer w-[150px] sm:w-[180px] md:w-[220px] text-left shrink-0" 
      onClick={() => onSelect(slug)}
    >
      <div className="relative aspect-[2/3] w-full rounded-md overflow-hidden bg-[#1a1a1a]">
        <SafeImage src={posterUrl} alt={name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-black/50 border border-white/20 flex items-center justify-center backdrop-blur-md text-white">
                <Play className="w-6 h-6 ml-1" fill="currentColor" />
            </div>
        </div>
      </div>
      
      <div className="flex items-start gap-4">
        <div className="text-[60px] sm:text-[75px] leading-[0.8] font-black text-yellow-400 italic shadow-yellow-500/20 drop-shadow-[0_0_15px_rgba(250,204,21,0.4)] tracking-tighter shrink-0 mt-1">
          {idx + 1}
        </div>
        <div className="flex-1 flex flex-col pt-1">
          <h3 className="font-bold text-white text-sm sm:text-base line-clamp-1">{name}</h3>
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{originalName}</p>
          <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 text-[10px] sm:text-xs font-bold text-gray-500 uppercase">
            <span className="text-gray-300 font-bold">T16</span>
            <span>•</span>
            <span className="text-gray-300">{quality}</span>
            {rating && (
              <>
                <span>•</span>
                <span className="text-yellow-500 font-extrabold">{rating} ★</span>
              </>
            )}
            {duration && (
               <>
                 <span>•</span>
                 <span>{duration}</span>
               </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
