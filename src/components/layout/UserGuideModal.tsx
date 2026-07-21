import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, HelpCircle, Film, Play, Subtitles, Keyboard, Search, 
  Heart, Clock, Smartphone, Download, Check, Sparkles, Monitor, Lock, ShieldCheck
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface UserGuideModalProps {
  onClose: () => void;
}

type TabId = 'general' | 'player' | 'subtitle' | 'pwa' | 'shortcuts';

export const UserGuideModal: React.FC<UserGuideModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<TabId>('general');

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'Hướng dẫn Xem phim', icon: <Film size={15} /> },
    { id: 'player', label: 'Trình phát Video', icon: <Play size={15} /> },
    { id: 'subtitle', label: 'Bật Phụ đề (Sub)', icon: <Subtitles size={15} /> },
    { id: 'pwa', label: 'Tải App Cinemax (PWA)', icon: <Smartphone size={15} /> },
    { id: 'shortcuts', label: 'Phím tắt nhanh', icon: <Keyboard size={15} /> },
  ];

  const handleOpenPWAPrompt = () => {
    onClose();
    setTimeout(() => {
      if ((window as any).triggerPWAInstall) {
        (window as any).triggerPWAInstall();
      }
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md pointer-events-auto select-none" onClick={onClose}>
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 190 }}
        className="w-full max-w-3xl h-[85vh] max-h-[680px] bg-[#0d0d10]/95 backdrop-blur-md border border-white/10 rounded-2xl flex flex-col shadow-[0_24px_60px_rgba(0,0,0,0.9)] overflow-hidden text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0 bg-[#0d0d10]/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E50914]/10 border border-[#E50914]/20 flex items-center justify-center text-[#E50914]">
              <HelpCircle size={20} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wide">
                Hướng dẫn & Mẹo Xem Phim
              </h3>
              <p className="text-[11px] text-gray-400">Xem hướng dẫn đơn giản dưới đây để có trải nghiệm xem phim tốt nhất trên Cinemax</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-white/60 hover:text-white transition-all cursor-pointer"
            title="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/5 bg-[#0f0f13] overflow-x-auto scrollbar-hide shrink-0 px-4">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-4 py-3.5 text-xs font-bold transition-all relative flex items-center gap-2 shrink-0 cursor-pointer",
                  isActive ? "text-[#E50914]" : "text-gray-400 hover:text-white"
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {isActive && (
                  <motion.div 
                    layoutId="activeGuideTabLine" 
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E50914]" 
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Content Box */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[#0a0a0d]/40">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="space-y-6"
            >
              {/* TAB 1: GENERAL USAGE */}
              {activeTab === 'general' && (
                <div className="space-y-5">
                  <div className="bg-[#E50914]/[0.03] border border-[#E50914]/15 rounded-2xl p-4 flex gap-4">
                    <Film className="text-[#E50914] shrink-0 mt-1" size={20} />
                    <div>
                      <h4 className="text-sm font-bold text-white mb-1">Cách tìm kiếm và trải nghiệm kho phim</h4>
                      <p className="text-xs text-gray-300 leading-relaxed font-medium">
                        Dễ dàng chuyển đổi linh hoạt giữa các chuyên mục: <strong className="text-white">Phim lẻ, Phim bộ, Hoạt hình, Bóng đá trực tiếp</strong> và <strong className="text-white">Âm nhạc</strong> bằng thanh điều hướng trên cùng (hoặc dưới màn hình trên điện thoại).
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex gap-3.5 hover:bg-white/[0.04] transition-all">
                      <Search className="text-blue-400 shrink-0 mt-0.5" size={18} />
                      <div>
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block mb-1">Tìm phim & Bộ lọc thông minh</span>
                        <p className="text-xs text-gray-400 leading-relaxed font-medium">
                          Bấm vào biểu tượng kính lúp để tìm kiếm phim theo tên. Tại mục "Thể loại", bạn có thể lọc phim chính xác theo năm ra mắt, quốc gia hoặc thể loại yêu thích.
                        </p>
                      </div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex gap-3.5 hover:bg-white/[0.04] transition-all">
                      <Heart className="text-[#E50914] shrink-0 mt-0.5" size={18} />
                      <div>
                        <span className="text-xs font-bold text-[#E50914] uppercase tracking-wider block mb-1">Yêu thích & Danh sách cá nhân</span>
                        <p className="text-xs text-gray-400 leading-relaxed font-medium">
                          Nhấn nút "Thêm vào danh sách" ở trang chi tiết phim để lưu bộ phim vào bộ sưu tập cá nhân, giúp bạn xem lại dễ dàng bất cứ khi nào.
                        </p>
                      </div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex gap-3.5 hover:bg-white/[0.04] transition-all sm:col-span-2">
                      <Clock className="text-emerald-400 shrink-0 mt-0.5" size={18} />
                      <div>
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-1">Tự động nhớ phút phim & Tập đang xem</span>
                        <p className="text-xs text-gray-400 leading-relaxed font-medium">
                          Hệ thống sẽ tự động lưu lại chính xác thời gian và tập phim bạn đang xem dở. Khi mở lại phim, bạn chỉ cần bấm "Xem tiếp" để tiếp tục câu chuyện mà không lo bị mất dấu.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: VIDEO PLAYER */}
              {activeTab === 'player' && (
                <div className="space-y-5">
                  <div className="bg-blue-600/[0.03] border border-blue-600/15 rounded-2xl p-4 flex gap-4">
                    <Play className="text-blue-400 shrink-0 mt-1" size={20} />
                    <div>
                      <h4 className="text-sm font-bold text-white mb-1">Trình phát Netflix Player thông minh</h4>
                      <p className="text-xs text-gray-300 leading-relaxed font-medium">
                        Tích hợp công nghệ phát lại HLS tốc độ cao với các tính năng điều khiển mượt mà.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 flex gap-3 items-center">
                      <span className="w-6 h-6 rounded-full bg-[#E50914]/15 border border-[#E50914]/30 text-[#E50914] flex items-center justify-center text-xs font-bold shrink-0">1</span>
                      <p className="text-xs text-gray-300 font-medium">
                        <strong className="text-white">Đổi nguồn phát khi gặp sự cố:</strong> Bấm vào nút <strong className="text-emerald-400 font-bold">Nguồn phát</strong> ở góc dưới trình phát để chuyển đổi qua lại giữa các máy chủ <span className="text-white font-bold">Việt Nam</span>, <span className="text-yellow-400 font-bold">VIP</span> hoặc <span className="text-white font-bold">Cộng Đồng</span>.
                      </p>
                    </div>

                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 flex gap-3 items-center">
                      <span className="w-6 h-6 rounded-full bg-blue-600/15 border border-blue-600/30 text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">2</span>
                      <p className="text-xs text-gray-300 font-medium">
                        <strong className="text-white">Thao tác tua phim trên Điện thoại:</strong> Chạm nhanh hai lần ở bên trái/phải màn hình để tua nhanh hoặc tua lùi 10 giây. Chạm 1 lần vào khoảng trống bất kỳ để hiện bộ nút điều khiển đầy đủ trong 6 giây.
                      </p>
                    </div>

                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 flex gap-3 items-center">
                      <span className="w-6 h-6 rounded-full bg-purple-600/15 border border-purple-600/30 text-purple-400 flex items-center justify-center text-xs font-bold shrink-0">3</span>
                      <p className="text-xs text-gray-300 font-medium">
                        <strong className="text-white">Tính năng Khóa màn hình (Lock):</strong> Khi xem ở chế độ Toàn màn hình trên điện thoại, bấm nút <Lock size={12} className="inline mx-1 text-[#E50914]" /> ở góc trên bên phải để khóa giao diện, giúp bạn xem phim thoải mái mà không sợ vô tình chạm nhầm nút.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: SUBTITLE SYNC */}
              {activeTab === 'subtitle' && (
                <div className="space-y-4">
                  <div className="bg-emerald-600/[0.03] border border-emerald-600/15 rounded-2xl p-4 flex gap-4">
                    <Subtitles className="text-emerald-400 shrink-0 mt-1" size={20} />
                    <div>
                      <h4 className="text-sm font-bold text-white mb-1">Cách bật Phụ đề và Khớp câu thoại (Sub Delay)</h4>
                      <p className="text-xs text-gray-300 leading-relaxed font-medium">
                        Dễ dàng bật phụ đề tiếng Việt / tiếng Anh và căn chỉnh độ lệch thời gian trực tiếp trong trình phát.
                      </p>
                    </div>
                  </div>

                  <div className="bg-[#0f0f13] border border-white/5 rounded-2xl p-4 space-y-3.5">
                    <div className="flex gap-3 items-start">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                      <div>
                        <h5 className="text-xs font-bold text-white">Bật Phụ đề (CC)</h5>
                        <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                          Bấm nút <strong className="text-white border border-white/20 px-1 py-0.5 rounded text-[10px] font-mono">CC Phụ đề</strong> ở thanh công cụ phía dưới trình phát để lựa chọn danh sách phụ đề Vietsub hoặc Engsub.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3 items-start border-t border-white/5 pt-3.5">
                      <span className="w-5 h-5 rounded-full bg-violet-500/10 text-violet-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                      <div>
                        <h5 className="text-xs font-bold text-white">Công cụ Bù trừ Phụ đề (-0.25s / +0.25s)</h5>
                        <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                          Nếu phụ đề xuất hiện sớm hoặc trễ hơn giọng nói nhân vật, bạn mở menu <strong className="text-white">Phụ đề</strong> và dùng 2 nút <strong className="text-emerald-400">−0.25s</strong> hoặc <strong className="text-emerald-400">+0.25s</strong> để điều chỉnh lại cho khớp hoàn toàn.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: PWA APP INSTALLATION */}
              {activeTab === 'pwa' && (
                <div className="space-y-4">
                  <div className="bg-[#E50914]/[0.04] border border-[#E50914]/20 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="p-3 bg-[#E50914]/15 rounded-2xl text-[#E50914] shrink-0">
                        <Smartphone size={24} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Cài Đặt App Cinemax Trực Tiếp (PWA)</h4>
                        <p className="text-xs text-gray-300 leading-relaxed mt-0.5">
                          Trải nghiệm ứng dụng chuẩn Netflix, tải phim mượt gấp 2 lần và không bị vướng viền trình duyệt web.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleOpenPWAPrompt}
                      className="w-full sm:w-auto shrink-0 bg-[#E50914] hover:bg-[#ff2e35] text-white font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Download size={15} />
                      <span>Cài Đặt App Ngay</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="bg-[#0f0f13] border border-white/5 rounded-2xl p-4">
                      <h5 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 mb-2">
                        <ShieldCheck size={14} /> Dành cho Android / PC Chrome / Edge:
                      </h5>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        Nhấn nút <strong className="text-white">"Cài Đặt App Ngay"</strong> ở trên hoặc ở chân trang web (Footer), sau đó xác nhận cài đặt để tạo biểu tượng App Cinemax trực tiếp trên Màn hình chính.
                      </p>
                    </div>

                    <div className="bg-[#0f0f13] border border-white/5 rounded-2xl p-4">
                      <h5 className="text-xs font-bold text-amber-400 flex items-center gap-1.5 mb-2">
                        <Monitor size={14} /> Dành cho iPhone / iPad (Safari iOS):
                      </h5>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        1. Bấm biểu tượng <strong className="text-white">Chia sẻ</strong> (hình vuông có mũi tên) trên thanh trình duyệt Safari.<br />
                        2. Cuộn xuống chọn <strong className="text-white">"Thêm vào Màn hình chính"</strong> (Add to Home Screen).
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: KEYBOARD SHORTCUTS */}
              {activeTab === 'shortcuts' && (
                <div className="space-y-4">
                  <div className="bg-purple-600/[0.03] border border-purple-600/15 rounded-2xl p-4 flex gap-4">
                    <Keyboard className="text-purple-400 shrink-0 mt-1" size={20} />
                    <div>
                      <h4 className="text-sm font-bold text-white mb-1">Thao tác nhanh bằng bàn phím (Khi xem trên Máy tính)</h4>
                      <p className="text-xs text-gray-300 leading-relaxed font-medium">
                        Sử dụng các phím tắt tiện lợi giúp bạn làm chủ trình phát phim nhanh chóng mà không cần di chuột.
                      </p>
                    </div>
                  </div>

                  <div className="bg-[#0f0f13] border border-white/5 rounded-2xl divide-y divide-white/[0.05]">
                    <div className="grid grid-cols-2 p-3 text-xs">
                      <span className="text-gray-400 font-bold">Phím tắt</span>
                      <span className="text-white font-bold">Chức năng điều khiển</span>
                    </div>

                    <div className="grid grid-cols-2 p-3 text-xs items-center hover:bg-white/[0.02] transition-colors">
                      <div className="flex gap-1.5 items-center">
                        <kbd className="px-2 py-0.5 bg-white/10 border border-white/20 rounded text-[10px] font-bold font-mono text-white">Space</kbd>
                        <span>hoặc</span>
                        <kbd className="px-2 py-0.5 bg-white/10 border border-white/20 rounded text-[10px] font-bold font-mono text-white">K</kbd>
                      </div>
                      <span className="text-gray-300 font-medium">Phát / Tạm dừng video</span>
                    </div>

                    <div className="grid grid-cols-2 p-3 text-xs items-center hover:bg-white/[0.02] transition-colors">
                      <div className="flex gap-1.5 items-center">
                        <kbd className="px-2 py-0.5 bg-white/10 border border-white/20 rounded text-[10px] font-bold font-mono text-white">F</kbd>
                      </div>
                      <span className="text-gray-300 font-medium">Bật / Tắt Toàn màn hình</span>
                    </div>

                    <div className="grid grid-cols-2 p-3 text-xs items-center hover:bg-white/[0.02] transition-colors">
                      <div className="flex gap-1.5 items-center">
                        <kbd className="px-2 py-0.5 bg-white/10 border border-white/20 rounded text-[10px] font-bold font-mono text-white">M</kbd>
                      </div>
                      <span className="text-gray-300 font-medium">Bật / Tắt Âm thanh</span>
                    </div>

                    <div className="grid grid-cols-2 p-3 text-xs items-center hover:bg-white/[0.02] transition-colors">
                      <div className="flex gap-1.5 items-center">
                        <kbd className="px-2 py-0.5 bg-white/10 border border-white/20 rounded text-[10px] font-bold font-mono text-white">←</kbd>
                        <span>/</span>
                        <kbd className="px-2 py-0.5 bg-white/10 border border-white/20 rounded text-[10px] font-bold font-mono text-white">→</kbd>
                      </div>
                      <span className="text-gray-300 font-medium">Tua lùi / Tua tiến 10 giây</span>
                    </div>

                    <div className="grid grid-cols-2 p-3 text-xs items-center hover:bg-white/[0.02] transition-colors">
                      <div className="flex gap-1.5 items-center">
                        <kbd className="px-2 py-0.5 bg-white/10 border border-white/20 rounded text-[10px] font-bold font-mono text-white">C</kbd>
                      </div>
                      <span className="text-gray-300 font-medium">Bật / Tắt hiển thị phụ đề</span>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 bg-[#0f0f13] text-center flex items-center justify-between shrink-0">
          <span className="text-[10px] text-gray-500 font-medium">Hỗ trợ Cinemax v2.5 • Tối ưu trải nghiệm phim của bạn</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#E50914] hover:bg-[#ff2e35] text-white font-bold text-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
          >
            <Check size={12} />
            <span>Tôi đã hiểu</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
