import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, AlertTriangle, Play, Wifi, Subtitles, Volume2, HelpCircle, Loader2, CheckCircle2 
} from 'lucide-react';
import { sendReportToDiscord, ReportPayload } from '../../api/reportApi';
import { getRecentLogs } from '../../lib/loggerBuffer';
import { cn } from '../../lib/utils';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  movieTitle: string;
  movieSlug: string;
  tmdbId?: string | number;
  mediaType?: string;
  season?: number;
  episodeName?: string;
  serverName?: string;
  streamUrl?: string;
  streamType?: string;
  quality?: string;
  currentTime?: number;
  duration?: number;
  isFullscreen?: boolean;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  movieTitle,
  movieSlug,
  tmdbId,
  mediaType,
  season,
  episodeName,
  serverName,
  streamUrl,
  streamType,
  quality,
  currentTime,
  duration,
  isFullscreen = false,
}) => {
  const [errorType, setErrorType] = useState<string>('');
  const [errorDetails, setErrorDetails] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  const options = [
    { id: 'play', label: 'Lỗi không phát được', icon: Play, desc: 'Video lỗi, màn hình đen hoặc không tải được' },
    { id: 'lag', label: 'Tải chậm / Giật lag', icon: Wifi, desc: 'Video bị đứng hình, xoay vòng tròn liên tục' },
    { id: 'sub', label: 'Lỗi phụ đề', icon: Subtitles, desc: 'Thiếu phụ đề, lệch thời gian hoặc sai dịch' },
    { id: 'audio', label: 'Lỗi âm thanh', icon: Volume2, desc: 'Mất tiếng, rè, hoặc lệch tiếng so với hình' },
    { id: 'other', label: 'Ý kiến khác / Góp ý', icon: HelpCircle, desc: 'Đóng góp ý kiến hoặc phản hồi lỗi khác' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!errorType) return;

    setStatus('submitting');

    const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
    const connectionType = nav?.connection?.effectiveType || nav?.mozConnection?.effectiveType || nav?.webkitConnection?.effectiveType;

    const payload: ReportPayload = {
      reportId,
      movieTitle,
      movieSlug,
      tmdbId,
      mediaType,
      season,
      episodeName,
      serverName,
      streamUrl,
      streamType,
      quality,
      currentTime,
      duration,
      errorType,
      errorDetails,
      userAgent: nav?.userAgent || 'Unknown',
      screenResolution: typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : 'Unknown',
      timestamp: new Date().toISOString(),
      consoleLogs: getRecentLogs(30),
      networkState: {
        online: nav?.onLine ?? true,
        effectiveType: connectionType,
      },
    };

    const success = await sendReportToDiscord(payload);
    if (success) {
      try {
        const savedReportsRaw = localStorage.getItem('cinemax_user_reports');
        const savedReports = savedReportsRaw ? JSON.parse(savedReportsRaw) : [];
        savedReports.push({
          id: reportId,
          movieTitle,
          movieSlug,
          mediaType,
          season,
          episodeName,
          serverName,
          errorType,
          timestamp: payload.timestamp,
          status: 'pending'
        });
        localStorage.setItem('cinemax_user_reports', JSON.stringify(savedReports));
      } catch (err) {
        console.warn('Failed to save report to localStorage:', err);
      }

      setStatus('success');
      // Reset form after success
      setTimeout(() => {
        setStatus('idle');
        setErrorType('');
        setErrorDetails('');
        onClose();
      }, 2000);
    } else {
      setStatus('error');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={cn(
            "flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm pointer-events-auto z-[99999]",
            isFullscreen ? "absolute inset-0" : "fixed inset-0"
          )}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-full max-w-lg bg-[#0d0d10]/95 backdrop-blur-md border border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col shadow-[0_24px_60px_rgba(0,0,0,0.85)] text-left select-none relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-white tracking-wide uppercase">
                    Báo cáo sự cố phát video
                  </h3>
                  <p className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[280px] sm:max-w-sm">
                    Phim: <span className="text-white font-semibold">{movieTitle}</span> {episodeName && `(${episodeName})`}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <X size={15} />
              </button>
            </div>

            {/* Content states */}
            {status === 'success' ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-10 text-center space-y-4"
              >
                <CheckCircle2 size={56} className="text-emerald-500 animate-bounce" />
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-white">Gửi báo cáo thành công!</h4>
                  <p className="text-xs text-gray-400 max-w-xs">
                    Chúng tôi đã ghi nhận sự cố của bạn. Admin sẽ kiểm tra và khắc phục trong thời gian sớm nhất.
                  </p>
                </div>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Error selection */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Vui lòng chọn loại sự cố:
                  </label>
                  <div className="grid gap-2">
                    {options.map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = errorType === opt.id;
                      return (
                        <div
                          key={opt.id}
                          onClick={() => {
                            setErrorType(opt.id);
                            if (status === 'error') setStatus('idle');
                          }}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-xl border cursor-pointer select-none transition-all duration-150",
                            isSelected
                              ? "bg-red-500/10 border-red-500/50 text-white shadow-[0_0_12px_rgba(239,68,68,0.1)]"
                              : "bg-white/[0.01] border-white/5 text-gray-400 hover:bg-white/[0.03] hover:border-white/10 hover:text-gray-200"
                          )}
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0",
                            isSelected ? "bg-red-500/10 text-red-500" : "bg-white/5 text-gray-400"
                          )}>
                            <Icon size={16} />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold">{opt.label}</span>
                            <span className="text-[10px] opacity-60 truncate">{opt.desc}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Additional Details */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Mô tả chi tiết (không bắt buộc):
                  </label>
                  <textarea
                    value={errorDetails}
                    onChange={(e) => setErrorDetails(e.target.value)}
                    placeholder="Mô tả cụ thể sự cố (VD: Lệch sub từ phút thứ 15, video bị mờ...)"
                    className="w-full h-20 bg-white/[0.02] hover:bg-white/[0.04] focus:bg-black/50 border border-white/5 focus:border-white/15 rounded-xl p-3 text-xs text-white placeholder-gray-500 outline-none resize-none transition-all duration-200"
                    maxLength={500}
                  />
                  <div className="flex items-center gap-2 text-[10px] text-gray-400 bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <span>Tự động đính kèm 30 console log &amp; thông số mạng gần nhất để hỗ trợ sửa lỗi nhanh.</span>
                  </div>
                </div>

                {status === 'error' && (
                  <p className="text-[11px] font-semibold text-red-400 text-center animate-pulse">
                    ⚠️ Gửi lỗi thất bại. Vui lòng kiểm tra kết nối mạng và thử lại!
                  </p>
                )}

                {/* Action buttons */}
                <div className="flex gap-2.5 pt-2 border-t border-white/5">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={status === 'submitting'}
                    className="flex-1 h-9 rounded-xl border border-white/10 hover:bg-white/5 text-xs font-bold text-gray-300 transition-colors cursor-pointer flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={!errorType || status === 'submitting'}
                    className={cn(
                      "flex-1 h-9 rounded-xl text-xs font-bold text-white transition-all cursor-pointer flex items-center justify-center gap-1.5",
                      errorType 
                        ? "bg-[#E50914] hover:bg-red-700 active:scale-95 shadow-lg shadow-red-950/20" 
                        : "bg-neutral-800 text-neutral-500 cursor-not-allowed",
                      status === 'submitting' && "opacity-80"
                    )}
                  >
                    {status === 'submitting' ? (
                      <>
                        <Loader2 size={14} className="animate-spin text-white" />
                        <span>Đang gửi...</span>
                      </>
                    ) : (
                      <span>Gửi báo cáo</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
