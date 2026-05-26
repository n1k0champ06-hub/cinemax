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
  ChevronDown
} from "lucide-react";
import { motion } from "motion/react";

export const NavBar = ({
  currentTab,
  setTab,
  onShowSearch,
}: {
  currentTab: string;
  setTab: (t: string) => void;
  onShowSearch: () => void;
}) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const topTabs = [
    { id: "home", label: "Trang chủ" },
    { id: "phim-bo", label: "Phim bộ" },
    { id: "phim-le", label: "Phim lẻ" },
    { id: "hoat-hinh", label: "Anime" },
    { id: "discover", label: "Thể loại" },
    { id: "my-list", label: "Danh sách của tôi" },
  ];

  const bottomDockTabs = [
    { id: "home", icon: Home },
    { id: "phim-le", icon: Film },
    { id: "phim-bo", icon: Tv },
    { id: "hoat-hinh", icon: Cat },
    { id: "my-list", icon: Heart },
  ];

  return (
    <>
      {/* Desktop Top Navbar */}
      <div className="hidden md:flex fixed top-0 left-0 w-full z-50 justify-center pointer-events-none transition-all duration-300 pt-4">
        <nav
          className={cn(
            "w-[94%] max-w-5xl pointer-events-auto rounded-full border flex items-center justify-between px-6 py-2 transition-all duration-500 shadow-2xl",
            scrolled 
              ? "bg-[#050505]/92 backdrop-blur-2xl border-white/[0.08] shadow-[0_16px_50px_rgba(0,0,0,0.98)] translate-y-[-2px]" 
              : "bg-[#050505]/45 backdrop-blur-lg border-white/[0.04] shadow-[0_10px_35px_rgba(0,0,0,0.6)]"
          )}
        >
          {/* Left/Center: Logo and Navigation tabs */}
          <div className="flex items-center gap-6 flex-1 overflow-x-auto scrollbar-hide">
            <div 
              className="cursor-pointer flex items-center gap-2 group select-none pr-1 shrink-0" 
              onClick={() => setTab("home")}
            >
              <Clapperboard className="w-5 h-5 text-white/95 group-hover:text-[#E50914] transition-all duration-300 group-hover:scale-110" />
            </div>

            <div className="flex items-center gap-1 md:gap-1.5">
              {topTabs.map((tab) => {
                const isActive = currentTab === tab.id || (tab.id === "discover" && currentTab.startsWith("the-loai/"));
                const Icon = (() => {
                  if (tab.id === "home") return Home;
                  if (tab.id === "phim-bo") return Tv;
                  if (tab.id === "phim-le") return Film;
                  if (tab.id === "hoat-hinh") return Cat;
                  if (tab.id === "discover") return LayoutGrid;
                  return Heart;
                })();

                return (
                  <button
                    key={tab.id}
                    onClick={() => setTab(tab.id)}
                    className={cn(
                      "px-3.5 py-1.5 rounded-xl text-xs font-bold tracking-wide transition-all duration-300 cursor-pointer select-none whitespace-nowrap flex items-center gap-1.5 relative group",
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
          </div>

          {/* Right Side: Search Trigger */}
          <div className="flex items-center pl-4 shrink-0">
            <button 
              onClick={onShowSearch} 
              className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full cursor-pointer transition-all active:scale-95 duration-200"
              title="Tìm kiếm"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
        </nav>
      </div>

      {/* Mobile Floating Bottom Dock */}
      <div className="md:hidden fixed bottom-4 left-0 w-full z-[100] flex justify-center pointer-events-none px-4">
        <nav className="pointer-events-auto flex items-center justify-between w-full max-w-[400px] h-14 bg-[#050505]/92 backdrop-blur-2xl border border-white/[0.08] rounded-[24px] px-2 shadow-[0_24px_48px_rgba(0,0,0,0.95)]">
          {/* Main Tabs */}
          {bottomDockTabs.map((tab) => {
             const Icon = tab.icon;
             const isActive = currentTab === tab.id;
             return (
               <button
                 key={tab.id}
                 onClick={() => setTab(tab.id)}
                 className="flex-1 flex justify-center items-center h-full relative"
               >
                 <Icon className={cn("w-5 h-5 transition-all duration-300", isActive ? "text-white scale-110" : "text-neutral-400 hover:text-neutral-300")} />
               </button>
             );
          })}
          
          {/* Search Button */}
          <button
            onClick={onShowSearch}
            className="flex-1 flex justify-center items-center h-full relative"
          >
            <Search className="w-5 h-5 text-neutral-400 hover:text-neutral-300 transition-all duration-300" />
          </button>
          
          {/* Discover Category Grid */}
          <button
            onClick={() => setTab("discover")}
            className="flex-1 flex justify-center items-center h-full relative"
          >
            <LayoutGrid className={cn("w-5 h-5 transition-all duration-300", currentTab === "discover" ? "text-white scale-110" : "text-neutral-400 hover:text-neutral-300")} />
          </button>
        </nav>
      </div>
    </>
  );
};


