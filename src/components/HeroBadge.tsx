import React from 'react';
import { motion } from 'motion/react';
import { Tv } from 'lucide-react';

export const HeroBadge = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-4 w-fit"
    >
      <Tv className="w-4 h-4 text-white" />
      <span className="text-[14px] font-normal text-white">Streaming chất lượng cao</span>
    </motion.div>
  );
};
