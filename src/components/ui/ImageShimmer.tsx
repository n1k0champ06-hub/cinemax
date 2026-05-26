import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { proxyImage } from '../../utils/proxyImage';
import { Film } from 'lucide-react';
import { cn } from '../../lib/utils';

export const SafeImage = ({ src, alt, className, priority }: { src: string | null | undefined, alt: string, className?: string, priority?: boolean }) => {
  const [hasError, setHasError] = useState(false);
  const finalSrc = src ? proxyImage(src) : null;

  // Reset error state if src changes
  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (hasError || !finalSrc) {
    return (
      <div className={cn("flex flex-col items-center justify-center bg-gradient-to-br from-neutral-900 via-[#161616] to-[#0d0d0d] border border-white/5 text-neutral-500 gap-2 w-full h-full select-none absolute inset-0", className)}>
        <div className="p-3 bg-white/5 rounded-full border border-white/10 shadow-lg text-neutral-400">
          <Film className="w-6 h-6 sm:w-8 sm:h-8 opacity-75" />
        </div>
        <span className="text-[10px] sm:text-xs text-neutral-400 font-semibold px-4 text-center line-clamp-1 max-w-[90%] opacity-80 mt-1 select-text">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img 
      src={finalSrc} 
      alt={alt} 
      className={className} 
      loading={priority ? undefined : "lazy"} 
      fetchPriority={priority ? "high" : undefined}
      onError={() => {
        setHasError(true);
      }}
    />
  );
};

export const HorizontalShimmer = () => (
  <div className="flex gap-4 sm:gap-6 md:gap-8 overflow-x-auto pb-8 pt-4 px-4 md:px-12 scrollbar-hide snap-x items-end" style={{ scrollbarWidth: 'none' }}>
    {[...Array(8)].map((_, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.05, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="flex-shrink-0 w-36 sm:w-40 md:w-48 lg:w-56 rounded-[20px] bg-[#0a0a0a] relative overflow-hidden shadow-2xl"
        style={{ aspectRatio: '2/3' }}
      >
        <div className="absolute inset-0 bg-white/[0.02] mix-blend-overlay pointer-events-none" />
        
        {/* Soft glowing line */}
        <motion.div 
          className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.08] to-transparent skew-x-12"
          animate={{ translateX: ["-150%", "250%"] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: i * 0.1 }}
        />

        <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-2 z-10">
          <div className="h-4 bg-white/10 rounded-md w-3/4 animate-pulse relative overflow-hidden" />
          <div className="h-3 bg-white/[0.05] rounded-md w-1/2 animate-pulse" />
        </div>
      </motion.div>
    ))}
  </div>
);

export const GridShimmer = () => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 pt-4 w-full">
    {[...Array(12)].map((_, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: (i % 6) * 0.05, duration: 0.5, ease: "easeOut" }}
        className="aspect-[2/3] rounded-[20px] bg-[#0a0a0a] relative overflow-hidden shadow-2xl w-full"
      >
        <div className="absolute inset-0 bg-white/[0.02] mix-blend-overlay pointer-events-none" />
        
        <motion.div 
          className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.08] to-transparent skew-x-12"
          animate={{ translateX: ["-150%", "250%"] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: (i % 6) * 0.1 }}
        />

        <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-2 z-10">
          <div className="h-4 bg-white/10 rounded-md w-3/4 animate-pulse relative overflow-hidden" />
          <div className="h-3 bg-white/[0.05] rounded-md w-1/2 animate-pulse" />
        </div>
      </motion.div>
    ))}
  </div>
);

export const HeroShimmer = () => (
  <div className="relative h-[65dvh] min-h-[460px] lg:h-[80vh] w-full bg-[#030303] overflow-hidden flex items-center justify-center">
    {/* Dynamic 2026 Fluid Glow */}
    <motion.div 
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none"
      animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3], rotate: [0, 90, 0] }}
      transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
    />
    <motion.div 
      className="absolute top-1/3 right-1/4 w-[40vw] h-[40vw] rounded-full bg-purple-500/10 blur-[100px] pointer-events-none"
      animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.5, 0.2] }}
      transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
    />
    
    {/* Micro-texture grid overlay */}
    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none" />
    
    {/* Vignette & Fade */}
    <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent z-10" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#050505_100%)] opacity-80 z-10 pointer-events-none" />

    <div className="absolute z-20 bottom-[10%] lg:bottom-24 left-4 lg:left-24 max-w-3xl flex flex-col gap-5 w-full">
      <div className="h-16 md:h-24 bg-gradient-to-r from-white/10 to-transparent rounded-[2rem] w-3/4 backdrop-blur-3xl animate-pulse ring-1 ring-white/5" />
      <div className="h-6 bg-gradient-to-r from-white/5 to-transparent rounded-full w-1/2 backdrop-blur-md animate-pulse mt-4" />
      <div className="h-6 bg-gradient-to-r from-white/5 to-transparent rounded-full w-2/3 backdrop-blur-md animate-pulse" />
      
      <div className="flex gap-4 mt-10">
        <div className="h-14 w-44 bg-white/20 rounded-full animate-pulse backdrop-blur-xl shadow-[0_0_30px_rgba(255,255,255,0.1)] ring-1 ring-white/30" />
        <div className="h-14 w-44 bg-white/5 rounded-full animate-pulse backdrop-blur-md border border-white/10 shadow-2xl" />
      </div>
    </div>
  </div>
);
