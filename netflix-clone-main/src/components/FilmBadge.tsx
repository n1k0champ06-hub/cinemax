import React from 'react';
import { motion } from 'motion/react';

export const FilmBadge = () => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="flex items-center gap-2 mb-4 w-fit"
    >
      <span className="px-3 py-1 rounded-sm bg-white text-black text-[11px] font-bold tracking-wider uppercase">Phim bộ</span>
      <span className="text-white/60 text-[13px]">Tình cảm · Hài hước · 2025</span>
    </motion.div>
  );
};
