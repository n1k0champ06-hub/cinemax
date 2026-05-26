import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

export const YoutubeTrailerModal = ({
  videoId,
  isOpen,
  onClose
}: {
  videoId?: string | null;
  isOpen: boolean;
  onClose: () => void;
}) => {
  if (!videoId) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 sm:p-8"
        >
          <div className="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-[110] w-10 h-10 rounded-full bg-black/50 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-md transition-colors"
            >
              <X size={20} />
            </button>
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
              className="w-full h-full border-none"
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
