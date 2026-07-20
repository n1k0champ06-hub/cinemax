import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Smartphone, X, Wifi, Battery, Signal, RefreshCw, ExternalLink, RotateCw } from "lucide-react";
import { cn } from "../../lib/utils";
export const MobileSimulator = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [time, setTime] = useState("");
  const [iframeKey, setIframeKey] = useState(0);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Listen to CustomEvent from God-Mode Console
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("open-mobile-simulator", handleOpen);
    return () => window.removeEventListener("open-mobile-simulator", handleOpen);
  }, []);

  // Listen to secret key sequence "m-o-b-i" or "t-e-s-t"
  useEffect(() => {
    let keyHistory: { key: string; time: number }[] = [];
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.hasAttribute('contenteditable')
      )) {
        return;
      }

      const key = e.key.toLowerCase();
      if (!['m', 'o', 'b', 'i', 't', 'e', 's'].includes(key)) return;
      
      const now = Date.now();
      keyHistory.push({ key, time: now });
      
      // Clean history older than 2s
      keyHistory = keyHistory.filter(item => now - item.time <= 2000);
      
      if (keyHistory.length >= 4) {
        const last4 = keyHistory.slice(-4).map(item => item.key).join('');
        if (last4 === 'mobi' || last4 === 'test') {
          setIsOpen(prev => !prev);
          keyHistory = [];
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleRefresh = () => {
    setIframeKey(prev => prev + 1);
  };

  const handleOpenPopup = () => {
    window.open(
      window.location.origin + window.location.pathname + "?tab=swipe",
      "cinemax_mobile",
      "width=390,height=844,resizable=yes,scrollbars=yes"
    );
  };

  return (
    <>

      {/* Simulator Modal Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Glassmorphic backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
            />

            {/* Content Container */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="relative flex flex-col md:flex-row items-center gap-6 z-10 max-h-[90vh]"
            >
              {/* Phone Device Shell */}
              <div className={cn(
                "relative bg-black border-[10px] border-neutral-800 rounded-[44px] shadow-[0_30px_100px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col ring-1 ring-white/10 transition-all duration-300",
                isLandscape ? "w-[750px] h-[385px]" : "w-[375px] h-[750px]"
              )}>
                
                {/* Custom Notch / Dynamic Island */}
                <div className={cn(
                  "absolute bg-black z-50 flex items-center justify-around px-3 pointer-events-none transition-all duration-300",
                  isLandscape 
                    ? "top-1/2 left-0 -translate-y-1/2 w-6 h-28 rounded-r-2xl flex-col py-3"
                    : "top-0 left-1/2 -translate-x-1/2 w-32 h-6 rounded-b-2xl px-3"
                )}>
                  <div className="w-3.5 h-3.5 bg-neutral-900 rounded-full border border-neutral-800/40" />
                  <div className={isLandscape ? "w-2 h-8 bg-neutral-900 rounded-full" : "w-8 h-2 bg-neutral-900 rounded-full"} />
                </div>

                {/* Status Bar */}
                {!isLandscape && (
                  <div className="h-10 bg-[#050505] text-white flex items-center justify-between px-6 pt-1 text-[10px] font-bold select-none pointer-events-none shrink-0 z-40">
                    <span>{time || "12:00"}</span>
                    <div className="flex items-center gap-1.5 opacity-90">
                      <Signal className="w-3 h-3 text-white" />
                      <Wifi className="w-3 h-3 text-white" />
                      <Battery className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                )}

                {/* Screen Iframe Area */}
                <div className="flex-1 w-full bg-[#050505] relative overflow-hidden">
                  <iframe
                    key={`${iframeKey}-${isLandscape ? 'land' : 'port'}`}
                    src={window.location.href}
                    className="w-full h-full border-0"
                    title="Mobile View Simulator"
                  />
                </div>

                {/* Bottom Home Indicator Bar */}
                {!isLandscape && (
                  <div className="h-5 bg-[#050505] flex items-center justify-center shrink-0 pointer-events-none z-40">
                    <div className="w-28 h-1 bg-white/30 rounded-full" />
                  </div>
                )}
              </div>

              {/* Side Controller Panel */}
              <div className="flex flex-col gap-3 max-w-[280px] text-left bg-neutral-900/90 border border-white/10 rounded-3xl p-5 backdrop-blur-lg shadow-2xl text-white">
                <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
                  <h3 className="font-bold text-sm flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-red-500" />
                    <span>Bộ giả lập di động</span>
                  </h3>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>

                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Thiết bị ảo giúp bạn kiểm thử nhanh giao diện quẹt phim di động hoặc trình phát phim ở cả 2 chế độ xoay dọc và xoay ngang.
                </p>

                <div className="flex flex-col gap-2 mt-2">
                  <button
                    onClick={() => setIsLandscape(prev => !prev)}
                    className="w-full py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-white font-bold rounded-xl transition-all text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-red-950/20"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-red-400" />
                    <span>{isLandscape ? "Xoay dọc (Portrait)" : "Xoay ngang (Landscape)"}</span>
                  </button>

                  <button
                    onClick={handleRefresh}
                    className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Tải lại giả lập</span>
                  </button>
                  <button
                    onClick={handleOpenPopup}
                    className="w-full py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-xl transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Mở cửa sổ di động riêng</span>
                  </button>
                </div>

                <div className="text-[10px] text-neutral-500 mt-2 border-t border-white/5 pt-3">
                  💡 *Mẹo: Bấm phím bí mật "mobi" hoặc "test" trên bàn phím để bật/tắt nhanh Bộ giả lập này bất kỳ lúc nào!*
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
