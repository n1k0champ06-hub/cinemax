import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Smartphone, Download, X, Sparkles, Monitor, Share, CheckCircle2 } from 'lucide-react';

export const PWAInstallModal: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  useEffect(() => {
    // Check if app is already running in standalone mode (installed as PWA)
    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    // Detect iOS
    const ua = window.navigator.userAgent;
    const ios = /iPhone|iPad|iPod/i.test(ua);
    setIsIOS(ios);

    // Listen for browser beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);

      // Show popup ONCE for first-time visitors / users who haven't seen it yet
      const hasPrompted = localStorage.getItem('cinemax_pwa_has_prompted');
      if (!hasPrompted) {
        const timer = setTimeout(() => {
          setIsOpen(true);
          localStorage.setItem('cinemax_pwa_has_prompted', 'true');
        }, 3000);
        return () => clearTimeout(timer);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Also trigger for iOS Safari if not prompted yet and not standalone
    if (ios && !window.matchMedia('(display-mode: standalone)').matches) {
      const hasPrompted = localStorage.getItem('cinemax_pwa_has_prompted');
      if (!hasPrompted) {
        const timer = setTimeout(() => {
          setIsOpen(true);
          localStorage.setItem('cinemax_pwa_has_prompted', 'true');
        }, 4000);
        return () => clearTimeout(timer);
      }
    }

    // Register global trigger so any button (Footer, UserGuideModal) can open this modal
    (window as any).triggerPWAInstall = () => setIsOpen(true);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      delete (window as any).triggerPWAInstall;
    };
  }, []);

  const handleInstallClick = async () => {
    localStorage.setItem('cinemax_pwa_has_prompted', 'true');
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstallSuccess(true);
        setTimeout(() => setIsOpen(false), 2000);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('cinemax_pwa_has_prompted', 'true');
    setIsOpen(false);
  };

  // If app is already installed & running as standalone PWA, don't show
  if (isStandalone) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md pointer-events-auto select-none"
          onClick={handleDismiss}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 260, damping: 25 }}
            className="relative w-full max-w-sm bg-[#0d0d12]/95 border border-white/15 rounded-3xl p-5 sm:p-6 shadow-[0_25px_70px_rgba(0,0,0,0.9)] overflow-hidden text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ambient Background Gradient Glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#E50914]/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Close Button */}
            <button
              onClick={handleDismiss}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDismiss();
              }}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>

            {/* Header / Logo Icon */}
            <div className="flex items-center gap-3 mb-4 pr-6">
              <div className="relative w-12 h-12 rounded-xl bg-black border border-white/10 p-1 shadow-xl shrink-0 flex items-center justify-center">
                <img
                  src="https://res.cloudinary.com/dwbbs7rho/image/upload/v1779716516/Elegant_Marquee_Style_Logo_with_Deep_Crimson_C_c2sulc.png"
                  alt="Cinemax App"
                  className="w-full h-full object-contain rounded-lg"
                />
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#E50914] text-[8px] font-bold text-white shadow-md">
                  ✓
                </span>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-white tracking-wide truncate">Cài Đặt App Cinemax</h3>
                  <span className="bg-[#E50914]/20 border border-[#E50914]/40 text-[#E50914] text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full tracking-wider shrink-0">
                    PWA
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 font-medium truncate">Trải nghiệm ứng dụng chuẩn Netflix</p>
              </div>
            </div>

            {/* Main Feature Highlights */}
            {installSuccess ? (
              <div className="py-6 flex flex-col items-center justify-center text-center">
                <CheckCircle2 size={40} className="text-emerald-400 mb-2.5 animate-bounce" />
                <h4 className="text-xs font-bold text-white">Đã cài đặt ứng dụng thành công!</h4>
                <p className="text-[10px] text-gray-400 mt-1">Bạn có thể mở ứng dụng Cinemax ngay từ Màn hình chính.</p>
              </div>
            ) : (
              <>
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3.5 mb-4 space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 bg-[#E50914]/15 rounded-lg text-[#E50914] shrink-0 mt-0.5">
                      <Sparkles size={14} />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-bold text-white">Xem Phim Mượt Gấp 2 Lần</h4>
                      <p className="text-[10px] text-gray-400 leading-relaxed mt-0.5">
                        Tốc độ tải phim và chuyển tập nhanh hơn, mượt mà hơn.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 border-t border-white/5 pt-2.5">
                    <div className="p-1.5 bg-emerald-500/15 rounded-lg text-emerald-400 shrink-0 mt-0.5">
                      <Monitor size={14} />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-bold text-white">Toàn Màn Hình Không Viền</h4>
                      <p className="text-[10px] text-gray-400 leading-relaxed mt-0.5">
                        Không bị ẩn vướng thanh địa chỉ hay điều khiển của trình duyệt.
                      </p>
                    </div>
                  </div>
                </div>

                {/* iOS Special Installation Guide */}
                {isIOS && !deferredPrompt && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4 text-amber-200">
                    <p className="text-[10px] font-bold flex items-center gap-1.5 mb-1 text-amber-400">
                      <Share size={12} /> Hướng dẫn cài đặt Safari iOS:
                    </p>
                    <ol className="text-[9px] sm:text-[10px] space-y-0.5 text-amber-200/90 list-decimal list-inside pl-0.5">
                      <li>Nhấn nút <strong>Chia sẻ</strong> (biểu tượng hình vuông mũi tên lên).</li>
                      <li>Chọn <strong>"Thêm vào Màn hình chính"</strong> (Add to Home Screen).</li>
                    </ol>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col gap-2">
                  {deferredPrompt ? (
                    <button
                      onClick={handleInstallClick}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleInstallClick();
                      }}
                      className="w-full flex items-center justify-center gap-1.5 bg-[#E50914] hover:bg-[#ff2e35] active:scale-98 text-white font-bold py-2.5 px-4 rounded-xl text-[10px] sm:text-xs uppercase tracking-wider shadow-[0_4px_15px_rgba(229,9,20,0.3)] transition-all cursor-pointer"
                    >
                      <Download size={14} />
                      <span>Cài Đặt App Ngay</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleDismiss}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDismiss();
                      }}
                      className="w-full flex items-center justify-center gap-1.5 bg-white text-black hover:bg-white/90 active:scale-98 font-bold py-2.5 px-4 rounded-xl text-[10px] sm:text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
                    >
                      <Smartphone size={14} />
                      <span>Đã Hiểu / Đóng</span>
                    </button>
                  )}

                  <button
                    onClick={handleDismiss}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDismiss();
                    }}
                    className="w-full py-2 bg-white/5 hover:bg-white/10 active:scale-98 text-neutral-400 hover:text-white font-bold rounded-xl text-[10px] sm:text-xs transition-colors cursor-pointer text-center"
                  >
                    Để sau
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
