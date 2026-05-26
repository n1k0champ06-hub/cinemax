import React from "react";
import { motion } from "motion/react";

export const Hero = ({
  onScrollDown,
  setTab,
  onShowSearch,
}: {
  onSelect?: (slug: string) => void;
  onScrollDown?: () => void;
  setTab?: (t: string) => void;
  onShowSearch?: () => void;
}) => {
  return (
    <div className="w-full h-[85svh] sm:h-screen flex items-center justify-center p-3 md:p-5 bg-[#0a0a0a]">
      <section className="relative w-full max-w-[1536px] h-full rounded-[2rem] md:rounded-[3rem] overflow-hidden flex flex-col items-center justify-center bg-black/40 shadow-2xl">
        {/* VIDEO BACKGROUND */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover object-center z-0 scale-[1.02] filter brightness-75 contrast-125"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4"
        />

        {/* OVERLAY for better text contrast - Vignette + subtle grain */}
        <div className="absolute inset-0 z-[1] bg-gradient-to-t from-black/80 via-black/20 to-black/60 mix-blend-multiply" />
        <div className="absolute inset-0 z-[1] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.25] mix-blend-overlay pointer-events-none" />

        {/* CONTENT LAYER */}
        <div className="relative z-10 w-full h-full flex items-center justify-center text-center px-4 max-w-7xl mx-auto">
          <motion.h1
            className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black text-white tracking-tight leading-none whitespace-nowrap"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-100 to-gray-300">
              Bạn muốn xem gì?
            </span>
          </motion.h1>
        </div>
      </section>
    </div>
  );
};

