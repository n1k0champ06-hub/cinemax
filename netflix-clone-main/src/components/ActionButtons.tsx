import React from 'react';
import { motion } from 'motion/react';
import { Play, ArrowRight } from 'lucide-react';

export const ActionButtons = ({ onSelect }: { onSelect?: () => void }) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
      className="flex items-center gap-3"
    >
      <motion.button 
        onClick={onSelect}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="flex items-center gap-2 bg-white text-black rounded-full px-7 py-3 text-sm font-bold hover:bg-white/90 transition-colors"
      >
        <Play className="w-4 h-4 fill-black" />
        <span>Xem ngay</span>
      </motion.button>
      
      <motion.button 
        onClick={onSelect}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-full px-6 py-3 text-sm font-medium hover:bg-white/20 transition-colors"
      >
        <span>Chi tiết</span>
        <ArrowRight className="w-4 h-4" />
      </motion.button>
    </motion.div>
  );
};
