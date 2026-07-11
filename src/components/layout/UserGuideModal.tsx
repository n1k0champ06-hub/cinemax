import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, HelpCircle, Film, Play, Subtitles, Keyboard, Search, 
  Heart, RotateCcw, Clock, Download, ChevronRight, Minimize2, Check
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface UserGuideModalProps {
  onClose: () => void;
}

type TabId = 'general' | 'player' | 'subtitle' | 'shortcuts';

export const UserGuideModal: React.FC<UserGuideModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<TabId>('general');

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'Hướng dẫn Xem phim', icon: <Film size={15} /> },
    { id: 'player', label: 'Trình phát Video', icon: <Play size={15} /> },
    { id: 'subtitle', label: 'Bật Phụ đề (Sub)', icon: <Subtitles size={15} /> },
    { id: 'shortcuts', label: 'Phím tắt nhanh', icon: <Keyboard size={15} /> },
  ];

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md pointer-events-auto" onClick={onClose}>
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
            <div className="w-9 h-9 rounded-xl bg-red-600/10 border border-red-600/20 flex items-center justify-center text-red-500">
              <HelpCircle size={20} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wide">
                Hướng dẫn Xem phim
              </h3>
              <p className="text-[11px] text-gray-400">Xem hướng dẫn đơn giản dưới đây để có trải nghiệm xem phim tốt nhất</p>
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
                  isActive ? "text-red-500" : "text-gray-400 hover:text-white"
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {isActive && (
                  <motion.div 
                    layoutId="activeGuideTabLine" 
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" 
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
                  <div className="bg-red-600/[0.02] border border-red-600/10 rounded-2xl p-4 flex gap-4">
                    <Film className="text-red-500 shrink-0 mt-1" size={20} />
                    <div>
                      <h4 className="text-sm font-bold text-white mb-1">Cách tìm và thưởng thức phim</h4>
                      <p className="text-xs text-gray-300 leading-relaxed font-medium">
                        Bạn có thể dễ dàng chuyển đổi qua lại giữa các mục: Phim bộ, Phim lẻ, Hoạt hình, Bóng đá và Âm nhạc bằng thanh menu trên đầu trang (hoặc dưới cùng nếu dùng điện thoại).
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex gap-3.5 hover:bg-white/[0.04] transition-all">
                      <Search className="text-blue-400 shrink-0 mt-0.5" size={18} />
                      <div>
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block mb-1">Tìm phim & Lọc thể loại</span>
                        <p className="text-xs text-gray-400 leading-relaxed font-medium">
                          Bấm vào biểu tượng kính lúp để tìm kiếm tên phim nhanh chóng. Khi ở trang "Thể loại", bạn sẽ tìm thấy bộ lọc phim theo năm ra mắt, quốc gia hoặc thể loại mong muốn.
                        </p>
                      </div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex gap-3.5 hover:bg-white/[0.04] transition-all">
                      <Heart className="text-red-400 shrink-0 mt-0.5" size={18} />
                      <div>
                        <span className="text-xs font-bold text-red-400 uppercase tracking-wider block mb-1">Yêu thích & Lưu lại</span>
                        <p className="text-xs text-gray-400 leading-relaxed font-medium">
                          Bấm nút "Yêu thích" ở trang thông tin phim để lưu phim vào danh sách xem sau của bạn, giúp bạn dễ dàng xem lại bất cứ lúc nào.
                        </p>
                      </div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex gap-3.5 hover:bg-white/[0.04] transition-all sm:col-span-2">
                      <Clock className="text-emerald-400 shrink-0 mt-0.5" size={18} />
                      <div>
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-1">Tự động lưu lịch sử xem phim</span>
                        <p className="text-xs text-gray-400 leading-relaxed font-medium">
                          Hệ thống sẽ tự động ghi nhớ phút bạn đang xem dở. Lần sau quay lại phim đó, bạn chỉ cần bấm nút "Xem tiếp" để tiếp tục theo dõi bộ phim mà không cần tua tìm lại từ đầu.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: VIDEO PLAYER */}
              {activeTab === 'player' && (
                <div className="space-y-5">
                  <div className="bg-blue-600/[0.02] border border-blue-600/10 rounded-2xl p-4 flex gap-4">
                    <Play className="text-blue-400 shrink-0 mt-1" size={20} />
                    <div>
                      <h4 className="text-sm font-bold text-white mb-1">Điều khiển trình phát phim tiện lợi</h4>
                      <p className="text-xs text-gray-300 leading-relaxed font-medium">
                        Hỗ trợ đầy đủ các tính năng thông minh giúp bạn xem phim mượt mà và tiện lợi nhất.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex gap-3 items-center">
                      <span className="w-5 h-5 rounded-full bg-red-600/10 border border-red-600/20 text-red-400 flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                      <p className="text-xs text-gray-400 font-medium">
                        <strong className="text-white">Nếu phim bị đứng hình hoặc lag:</strong> Bấm vào nút <strong className="text-emerald-400 font-bold">Chọn nguồn</strong> ở góc dưới trình phát để đổi sang một máy chủ (server) dự phòng chạy nhanh hơn.
                      </p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex gap-3 items-center">
                      <span className="w-5 h-5 rounded-full bg-blue-600/10 border border-blue-600/20 text-blue-400 flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                      <p className="text-xs text-gray-400 font-medium">
                        <strong className="text-white">Khi xem trên Điện thoại:</strong> Vuốt ngón tay lên/xuống ở bên phải màn hình để tăng giảm âm lượng, vuốt bên trái để tăng giảm độ sáng. Chạm nhanh hai lần vào màn hình để tua nhanh hoặc tua lùi 10 giây.
                      </p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex gap-3 items-center">
                      <span className="w-5 h-5 rounded-full bg-purple-600/10 border border-purple-600/20 text-purple-400 flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                      <p className="text-xs text-gray-400 font-medium">
                        <strong className="text-white">Phóng to toàn màn hình:</strong> Bấm vào nút có biểu tượng bốn góc vuông (ở góc dưới bên phải trình phát) để mở chế độ xem phim rộng toàn màn hình.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: SUBTITLE SYNC */}
              {activeTab === 'subtitle' && (
                <div className="space-y-4">
                  <div className="bg-emerald-600/[0.02] border border-emerald-600/10 rounded-2xl p-4 flex gap-4">
                    <Subtitles className="text-emerald-400 shrink-0 mt-1" size={20} />
                    <div>
                      <h4 className="text-sm font-bold text-white mb-1">Cách bật và căn khớp phụ đề</h4>
                      <p className="text-xs text-gray-300 leading-relaxed font-medium">
                        Dễ dàng đồng bộ và căn chỉnh phụ đề trực tiếp trên trình phát của Cinemax.
                      </p>
                    </div>
                  </div>

                  <div className="bg-[#0f0f13] border border-white/5 rounded-2xl p-4 space-y-3">
                    <div className="flex gap-3 items-start">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                      <div>
                        <h5 className="text-xs font-bold text-white">Chọn ngôn ngữ phụ đề</h5>
                        <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                          Bấm nút biểu tượng phụ đề ở thanh điều khiển (góc dưới bên phải trình phát) để lựa chọn ngôn ngữ phụ đề mong muốn (Vietsub, Engsub...).
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 items-start border-t border-white/5 pt-3">
                      <span className="w-5 h-5 rounded-full bg-violet-500/10 text-violet-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                      <div>
                        <h5 className="text-xs font-bold text-white">Căn chỉnh nhanh/chậm thủ công</h5>
                        <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                          Nếu phụ đề chạy trước hoặc sau tiếng nhân vật, hãy dùng nút <strong className="text-white">-0.5 giây</strong> (làm sub hiện nhanh hơn) hoặc <strong className="text-white">+0.5 giây</strong> (làm sub hiện chậm hơn) ở góc dưới màn hình trình phát để căn lại cho khớp lời nói.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: KEYBOARD SHORTCUTS */}
              {activeTab === 'shortcuts' && (
                <div className="space-y-4">
                  <div className="bg-purple-600/[0.02] border border-purple-600/10 rounded-2xl p-4 flex gap-4">
                    <Keyboard className="text-purple-400 shrink-0 mt-1" size={20} />
                    <div>
                      <h4 className="text-sm font-bold text-white mb-1">Thao tác nhanh bằng bàn phím</h4>
                      <p className="text-xs text-gray-300 leading-relaxed font-medium">
                        Sử dụng các nút tắt trên bàn phím khi xem phim trên máy tính giúp bạn thao tác nhanh chóng và mượt mà hơn.
                      </p>
                    </div>
                  </div>

                  <div className="bg-[#0f0f13] border border-white/5 rounded-2xl divide-y divide-white/[0.05]">
                    <div className="grid grid-cols-2 p-3 text-xs">
                      <span className="text-gray-400 font-bold">Phím tắt</span>
                      <span className="text-white font-bold">Chức năng điều khiển</span>
                    </div>

                    <div className="grid grid-cols-2 p-3 text-xs items-center hover:bg-white/[0.02] transition-colors">
                      <div className="flex gap-1.5">
                        <kbd className="px-2 py-0.5 bg-white/10 border border-white/20 rounded text-[10px] font-bold font-mono">Phím Cách (Space)</kbd>
                        <span>hoặc</span>
                        <kbd className="px-2 py-0.5 bg-white/10 border border-white/20 rounded text-[10px] font-bold font-mono">K</kbd>
                      </div>
                      <span className="text-gray-300 font-medium">Phát / Tạm dừng phim</span>
                    </div>

                    <div className="grid grid-cols-2 p-3 text-xs items-center hover:bg-white/[0.02] transition-colors">
                      <div className="flex gap-1.5">
                        <kbd className="px-2 py-0.5 bg-white/10 border border-white/20 rounded text-[10px] font-bold font-mono">F</kbd>
                      </div>
                      <span className="text-gray-300 font-medium">Bật / Tắt Toàn màn hình</span>
                    </div>

                    <div className="grid grid-cols-2 p-3 text-xs items-center hover:bg-white/[0.02] transition-colors">
                      <div className="flex gap-1.5">
                        <kbd className="px-2 py-0.5 bg-white/10 border border-white/20 rounded text-[10px] font-bold font-mono">M</kbd>
                      </div>
                      <span className="text-gray-300 font-medium">Bật / Tắt Âm thanh</span>
                    </div>

                    <div className="grid grid-cols-2 p-3 text-xs items-center hover:bg-white/[0.02] transition-colors">
                      <div className="flex gap-1.5">
                        <kbd className="px-2 py-0.5 bg-white/10 border border-white/20 rounded text-[10px] font-bold font-mono">←</kbd>
                        <span>/</span>
                        <kbd className="px-2 py-0.5 bg-white/10 border border-white/20 rounded text-[10px] font-bold font-mono">→</kbd>
                      </div>
                      <span className="text-gray-300 font-medium">Tua lùi / Tua tiến 10 giây</span>
                    </div>

                    <div className="grid grid-cols-2 p-3 text-xs items-center hover:bg-white/[0.02] transition-colors">
                      <div className="flex gap-1.5">
                        <kbd className="px-2 py-0.5 bg-white/10 border border-white/20 rounded text-[10px] font-bold font-mono">C</kbd>
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
          <span className="text-[10px] text-gray-500 font-medium">Hỗ trợ Xem phim v2.0 • Được tối ưu hóa cho trải nghiệm của bạn</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
          >
            <Check size={12} />
            <span>Tôi đã hiểu</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
