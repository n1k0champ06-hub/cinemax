import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '../../lib/utils';
import { fetchSearch } from '../../api/phimApi';
import { proxyImage } from '../../utils/proxyImage';

export const NavSearchBox = ({ onSelect }: { onSelect: (slug: string) => void }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword), 500);
    return () => clearTimeout(timer);
  }, [keyword]);

  const { data, isLoading } = useQuery({
    queryKey: ['search', debouncedKeyword],
    queryFn: () => fetchSearch(debouncedKeyword),
    enabled: debouncedKeyword.length > 0,
  });

  return (
    <div className="relative flex items-center">
      <div 
        className={cn(
          "flex items-center bg-[#111]/80 backdrop-blur-md border border-white/10 rounded-full transition-all duration-300",
          isExpanded ? "w-48 sm:w-64 px-3 py-1.5" : "w-8 h-8 sm:w-10 sm:h-10 justify-center bg-transparent border-transparent cursor-pointer hover:bg-white/10"
        )}
        onClick={() => {
          if (!isExpanded) {
            setIsExpanded(true);
            setTimeout(() => inputRef.current?.focus(), 100);
          }
        }}
      >
        <Search className="w-5 h-5 sm:w-5 sm:h-5 text-white/70 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Tìm kiếm phim..."
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onBlur={() => {
            // Delay collapse to allow clicking suggestions
            setTimeout(() => {
              if (!keyword) setIsExpanded(false);
            }, 200);
          }}
          className={cn(
            "bg-transparent border-none outline-none text-sm text-white placeholder:text-white/40 ml-2 transition-all duration-300",
            isExpanded ? "w-full opacity-100 block" : "w-0 opacity-0 hidden"
          )}
        />
        {isExpanded && keyword && (
          <button 
            onClick={(e) => { e.stopPropagation(); setKeyword(''); inputRef.current?.focus(); }}
            className="text-white/50 hover:text-white shrink-0 ml-1"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isExpanded && debouncedKeyword.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-full right-0 mt-3 w-[85vw] sm:w-[400px] md:w-[450px] bg-[#111] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 flex flex-col max-h-[60vh]"
          >
            {isLoading ? (
              <div className="p-4 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-red-600" /></div>
            ) : data && data.length > 0 ? (
              <div className="overflow-y-auto">
                {data.map((movie: any, idx: number) => (
                  <div 
                    key={`${movie.slug || idx}-${idx}`}
                    onClick={() => {
                      onSelect(movie.slug);
                      setIsExpanded(false);
                      setKeyword('');
                    }}
                    className="flex items-center gap-3 p-3 hover:bg-white/10 cursor-pointer transition-colors border-b border-white/5 last:border-0"
                  >
                    <img 
                      src={proxyImage(movie.poster_url || movie.thumb_url) || undefined} 
                      alt={movie.name} 
                      className="w-12 h-16 object-cover rounded bg-white/5"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white text-sm font-medium truncate">{movie.name}</h4>
                      <p className="text-gray-400 text-xs truncate">{movie.origin_name}</p>
                      <p className="text-red-500 text-xs mt-1">{movie.year}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-gray-400">Không tìm thấy phim nào.</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
