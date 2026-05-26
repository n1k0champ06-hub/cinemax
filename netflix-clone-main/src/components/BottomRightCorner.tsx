import React from "react";
import { motion } from "motion/react";
import { ArrowDown, ChevronRight } from "lucide-react";

export const BottomRightCorner = ({ onClick }: { onClick?: () => void }) => {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.4 }}
      className="absolute bottom-0 right-0"
    >
      {/* Top mask */}
      <div className="absolute -top-[1.5rem] sm:-top-[2rem] md:-top-[3.5rem] right-0 w-[1.5rem] sm:w-[2rem] md:w-[3.5rem] h-[1.5rem] sm:h-[2rem] md:h-[3.5rem] pointer-events-none z-10">
        <svg width="100%" height="100%" viewBox="0 0 56 56" fill="none">
          <path d="M56 56V0C56 30.9279 30.9279 56 0 56H56Z" fill="#111" />
        </svg>
      </div>

      {/* Left mask */}
      <div className="absolute bottom-0 -left-[1.5rem] sm:-left-[2rem] md:-left-[3.5rem] w-[1.5rem] sm:w-[2rem] md:w-[3.5rem] h-[1.5rem] sm:h-[2rem] md:h-[3.5rem] pointer-events-none z-10">
        <svg width="100%" height="100%" viewBox="0 0 56 56" fill="none">
          <path d="M56 56H0C30.9279 56 56 30.9279 56 0V56Z" fill="#111" />
        </svg>
      </div>

      {/* Background Container for Cutout */}
      <div className="bg-[#111] rounded-tl-[1.5rem] sm:rounded-tl-[2rem] md:rounded-tl-[3.5rem] p-3 pt-5 pl-8 sm:p-4 sm:pt-6 sm:pl-10 md:p-6 md:pt-8 md:pl-14">
        {/* Clickable Button Area */}
        <motion.button
          onClick={onClick}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-3 sm:gap-4 md:gap-6 group text-left outline-none"
        >
          <div className="bg-red-600 w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(220,38,38,0.4)] group-hover:bg-red-500 group-hover:scale-105 transition-all">
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{
                repeat: Infinity,
                duration: 2.2,
                ease: "easeInOut",
              }}
            >
              <ArrowDown className="w-4 h-4 md:w-5 md:h-5 text-white stroke-[3px]" />
            </motion.div>
          </div>

          <div className="flex flex-col">
            <span className="text-[16px] md:text-[20px] font-semibold text-white">
              Khám phá
            </span>
            <div className="flex items-center gap-1 text-white/50 group-hover:text-white/80 transition-colors">
              <span className="text-[12px] md:text-[15px] font-normal tracking-wide">
                Thư viện phim
              </span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </motion.button>
      </div>
    </motion.div>
  );
};
