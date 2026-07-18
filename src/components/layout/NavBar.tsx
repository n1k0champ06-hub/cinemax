import React, { useState, useEffect } from "react";
import { cn } from "../../lib/utils";
import { 
  Search, 
  Clapperboard, 
  Home,
  Film,
  Tv,
  Cat,
  LayoutGrid,
  Heart,
  ChevronDown,
  Trophy,
  Music,
  HelpCircle,
  Flame
} from "lucide-react";
import { motion } from "motion/react";

export const NavBar = ({
  currentTab,
  setTab,
  onShowSearch,
  onShowGuide,
}: {
  currentTab: string;
  setTab: (t: string) => void;
  onShowSearch: () => void;
  onShowGuide: () => void;
}) => {
  const [scrolled, setScrolled] = useState(false);
  const [pulseHeart, setPulseHeart] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    const handleFavAdded = () => {
      setPulseHeart(true);
      setTimeout(() => setPulseHeart(false), 1000);
    };
    window.addEventListener('cinemax_favorite_added', handleFavAdded);
    return () => window.removeEventListener('cinemax_favorite_added', handleFavAdded);
  }, []);

  const topTabs = [
    { id: "home", label: "Trang chủ" },
    { id: "phim-bo", label: "Phim bộ" },
    { id: "phim-le", label: "Phim lẻ" },
    { id: "hoat-hinh", label: "Anime" },
    { id: "discover", label: "Thể loại" },
    { id: "my-list", label: "Yêu thích" },
  ];

  const mobileDockTabs = [
    { 
      id: "home", 
      label: "Trang chủ", 
      icon: Home, 
      isActive: currentTab === "home", 
      action: () => setTab("home") 
    },
    { 
      id: "discover", 
      label: "Thể loại", 
      icon: LayoutGrid, 
      isActive: currentTab === "discover" || currentTab.startsWith("the-loai/"), 
      action: () => setTab("discover") 
    },
    { 
      id: "swipe", 
      label: "Quẹt phim", 
      icon: Flame, 
      isActive: currentTab === "swipe", 
      action: () => setTab("swipe") 
    },
    { 
      id: "search", 
      label: "Tìm kiếm", 
      icon: Search, 
      isActive: false, 
      action: onShowSearch 
    },
    { 
      id: "my-list", 
      label: "Yêu thích", 
      icon: Heart, 
      isActive: currentTab === "my-list", 
      action: () => setTab("my-list") 
    },
  ];

  return (
    <>
      {/* Desktop Top Navbar */}
      <div className="hidden md:flex fixed top-0 left-0 w-full z-50 justify-center pointer-events-none transition-all duration-300 pt-4">
        <nav
          className={cn(
            "w-[94%] max-w-4xl pointer-events-auto rounded-full border flex items-center justify-between px-6 py-2 transition-all duration-500 shadow-2xl",
            scrolled 
              ? "bg-[#050505]/95 backdrop-blur-sm border-white/[0.08] shadow-[0_16px_50px_rgba(0,0,0,0.98)] translate-y-[-2px]" 
              : "bg-[#050505]/70 backdrop-blur-sm border-white/[0.04] shadow-[0_10px_35px_rgba(0,0,0,0.6)]"
          )}
        >
          {/* Left: Logo */}
          <div 
            className="cursor-pointer flex items-center group select-none pr-3 border-r border-white/10 shrink-0" 
            onClick={() => setTab("home")}
          >
            <div className="p-1.5 bg-[#E50914]/10 rounded-lg group-hover:bg-[#E50914]/20 transition-all duration-300">
              <Clapperboard className="w-4 h-4 text-[#E50914] transition-all duration-300 group-hover:scale-110" />
            </div>
          </div>

          {/* Center: Navigation tabs */}
          <div className="flex items-center justify-center gap-1 md:gap-1.5 flex-1 overflow-x-auto scrollbar-hide px-4">
            {topTabs.map((tab) => {
              const isActive = currentTab === tab.id || (tab.id === "discover" && currentTab.startsWith("the-loai/"));
              const Icon = (() => {
                if (tab.id === "home") return Home;
                if (tab.id === "phim-bo") return Tv;
                if (tab.id === "phim-le") return Film;
                if (tab.id === "hoat-hinh") return Cat;
                if (tab.id === "swipe") return Flame;
                if (tab.id === "football") return Trophy;
                if (tab.id === "music") return Music;
                if (tab.id === "discover") return LayoutGrid;
                return Heart;
              })();

              return (
                <button
                  key={tab.id}
                  onClick={() => setTab(tab.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold tracking-wide transition-all duration-300 cursor-pointer select-none whitespace-nowrap flex items-center gap-1.5 relative group",
                    isActive
                      ? "text-white"
                      : "text-neutral-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTabPill"
                      className="absolute inset-0 bg-white/10 rounded-xl border border-white/10 shadow-sm"
                      transition={{ type: "spring", stiffness: 350, damping: 32 }}
                    />
                  )}
                  <Icon className={cn("w-3.5 h-3.5 relative z-10 transition-transform duration-300", isActive ? "scale-110 text-white" : "text-neutral-400 group-hover:text-white group-hover:scale-105")} />
                  <span className="relative z-10">{tab.label}</span>
                  {tab.id === "discover" && (
                    <ChevronDown className="w-3 h-3 text-neutral-400 relative z-10 ml-0.5 group-hover:text-white transition-colors" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Side: Search & Guide Triggers */}
          <div className="flex items-center gap-1 pl-3.5 shrink-0 border-l border-white/10">
            <button 
              onClick={onShowSearch} 
              className="p-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-xl cursor-pointer transition-all active:scale-95 duration-200"
              title="Tìm kiếm"
            >
              <Search className="w-4 h-4" />
            </button>
            <button 
              onClick={onShowGuide} 
              className="p-2 text-neutral-400 hover:text-white hover:bg-[#E50914]/10 hover:text-[#E50914] rounded-xl cursor-pointer transition-all active:scale-95 duration-200"
              title="Hướng dẫn sử dụng"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </nav>
      </div>

      {/* Mobile Floating Bottom Dock */}
      <div className="md:hidden fixed bottom-5 left-0 w-full z-[100] flex justify-center pointer-events-none px-4">
        <nav className="pointer-events-auto flex items-center justify-around w-full max-w-[420px] h-16 bg-[#050505]/95 backdrop-blur-sm border border-white/[0.08] rounded-[28px] px-2 shadow-[0_24px_48px_rgba(0,0,0,0.95)]">
          {mobileDockTabs.map((tab) => {
             const Icon = tab.icon;
             const isActive = tab.isActive;
             const isHeartTab = tab.id === "my-list";
             return (
               <button
                 key={tab.id}
                 onClick={tab.action}
                 className="flex-1 flex flex-col justify-center items-center h-full relative cursor-pointer"
               >
                 <motion.div
                   animate={isHeartTab && pulseHeart ? {
                     scale: [1, 1.45, 1, 1.45, 1],
                     color: ["#a3a3a3", "#ef4444", "#a3a3a3", "#ef4444", isActive ? "#E50914" : "#a3a3a3"],
                     filter: [
                       "drop-shadow(0 0 0px rgba(239,68,68,0))",
                       "drop-shadow(0 0 12px rgba(239,68,68,0.9))",
                       "drop-shadow(0 0 0px rgba(239,68,68,0))",
                       "drop-shadow(0 0 12px rgba(239,68,68,0.9))",
                       "drop-shadow(0 0 0px rgba(239,68,68,0))"
                     ]
                   } : {}}
                   transition={{ duration: 0.8, ease: "easeInOut" }}
                   className="flex justify-center items-center"
                 >
                   <Icon 
                     className={cn("w-5 h-5 transition-all duration-300", isActive ? "text-[#E50914] scale-110" : "text-neutral-400 active:scale-95")} 
                     style={{ color: isHeartTab && pulseHeart ? 'inherit' : undefined }}
                   />
                 </motion.div>
                 <span className={cn("text-[9px] font-bold mt-1 tracking-wide transition-colors duration-300", isActive ? "text-white" : "text-neutral-500")}>
                   {tab.label}
                 </span>
               </button>
             );
          })}
        </nav>
      </div>
    </>
  );
};


