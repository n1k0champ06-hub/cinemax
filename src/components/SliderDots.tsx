import React from 'react';
import { motion } from 'motion/react';

export const SliderDots = () => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.6 }}
      className="absolute bottom-10 right-16 flex items-center gap-2"
    >
      {[...Array(10)].map((_, i) => (
        <div 
          key={i}
          className={`transition-all cursor-pointer ${
            i === 8 ? 'bg-white w-8 h-2 rounded-full' : 'bg-white/30 w-2 h-2 rounded-full hover:bg-white/60'
          }`}
        />
      ))}
    </motion.div>
  );
};
