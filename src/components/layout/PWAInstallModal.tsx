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
          className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none"
          onClick={handleDismiss}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 260, damping: 25 }}
            className="relative w-full max-w-md bg-[#0d0d12]/95 border border-white/15 rounded-3xl p-6 sm:p-7 shadow-[0_25px_70px_rgba(0,0,0,0.9)] overflow-hidden text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ambient Background Gradient Glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#E50914]/25 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

            {/* Close Button */}
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            {/* Header / Logo Icon */}
            <div className="flex items-center gap-4 mb-5">
              <div className="relative w-14 h-14 rounded-2xl bg-black border border-white/10 p-1.5 shadow-xl shrink-0 flex items-center justify-center">
                <img
                  src="https://res.cloudinary.com/dwbbs7rho/image/upload/v1779716516/Elegant_Marquee_Style_Logo_with_Deep_Crimson_C_c2sulc.png"
                  alt="Cinemax App"
                  className="w-full h-full object-contain rounded-xl"
                />
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#E50914] text-[9px] font-bold text-white shadow-md">
                  ✓
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white tracking-wide">Cài Đặt App Cinemax</h3>
                  <span className="bg-[#E50914]/20 border border-[#E50914]/40 text-[#E50914] text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
                    PWA App
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5 font-medium">Trải nghiệm ứng dụng chuẩn Netflix</p>
              </div>
            </div>

            {/* Main Feature Highlights */}
            {installSuccess ? (
              <div className="py-8 flex flex-col items-center justify-center text-center">
                <CheckCircle2 size={48} className="text-emerald-400 mb-3 animate-bounce" />
                <h4 className="text-base font-bold text-white">Đã cài đặt ứng dụng thành công!</h4>
                <p className="text-xs text-gray-400 mt-1">Bạn có thể mở ứng dụng Cinemax ngay từ Màn hình chính.</p>
              </div>
            ) : (
              <>
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 mb-6 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-[#E50914]/15 rounded-xl text-[#E50914] shrink-0 mt-0.5">
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Xem Phim Mượt Gấp 2 Lần</h4>
                      <p className="text-[11px] text-gray-400 leading-relaxed mt-0.5">
                        Ứng dụng chạy trực tiếp trên thiết bị, loại bỏ trình duyệt giúp tải phim và chuyển tập nhanh chóng.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 border-t border-white/5 pt-3">
                    <div className="p-2 bg-emerald-500/15 rounded-xl text-emerald-400 shrink-0 mt-0.5">
                      <Monitor size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Toàn Màn Hình 100% Không Viền</h4>
                      <p className="text-[11px] text-gray-400 leading-relaxed mt-0.5">
                        Không bị ẩn vướng thanh địa chỉ hay thanh điều khiển của trình duyệt web.
                      </p>
                    </div>
                  </div>
                </div>

                {/* iOS Special Installation Guide */}
                {isIOS && !deferredPrompt && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 mb-5 text-amber-200">
                    <p className="text-xs font-bold flex items-center gap-1.5 mb-2 text-amber-400">
                      <Share size={14} /> Hướng dẫn cài đặt trên iOS (Safari):
                    </p>
                    <ol className="text-[11px] space-y-1 text-amber-200/90 list-decimal list-inside pl-1">
                      <li>Nhấn nút <strong>Chia sẻ</strong> (biểu tượng hình vuông có mũi tên) ở góc trình duyệt Safari.</li>
                      <li>Cuộn xuống và chọn <strong>"Thêm vào Màn hình chính"</strong> (Add to Home Screen).</li>
                    </ol>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2.5">
                  {deferredPrompt ? (
                    <button
                      onClick={handleInstallClick}
                      className="flex-1 flex items-center justify-center gap-2 bg-[#E50914] hover:bg-[#ff2e35] active:scale-98 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider shadow-[0_4px_20px_rgba(229,9,20,0.4)] transition-all cursor-pointer"
                    >
                      <Download size={16} />
                      <span>Cài Đặt App Ngay</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleDismiss}
                      className="flex-1 flex items-center justify-center gap-2 bg-white text-black hover:bg-white/90 active:scale-98 font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg"
                    >
                      <Smartphone size={16} />
                      <span>Đã Hiểu / Đóng</span>
                    </button>
                  )}

                  <button
                    onClick={handleDismiss}
                    className="px-4 py-3 bg-white/5 hover:bg-white/10 active:scale-98 text-gray-300 font-bold rounded-xl text-xs transition-colors cursor-pointer text-center"
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
