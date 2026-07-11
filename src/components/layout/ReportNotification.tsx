import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BellRing, Check, X, Film, Info } from 'lucide-react';

interface SavedReport {
  id: string;
  movieTitle: string;
  movieSlug: string;
  mediaType?: string;
  season?: number;
  episodeName?: string;
  serverName?: string;
  errorType: string;
  timestamp: string;
  status: 'pending' | 'fixed' | 'dismissed';
}

interface FixedQuery {
  movieSlug: string;
  episodeName?: string;
  serverName?: string;
  message: string;
}

interface FixedReportsData {
  fixedReportIds?: string[];
  fixedQueries?: FixedQuery[];
}

const getEpisodeNumber = (name: string | number | undefined | null): number | null => {
  if (name === undefined || name === null) return null;
  const cleaned = name.toString().replace(/\D/g, '');
  if (!cleaned) return null;
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
};

const isSameEpisode = (epAName: string | number | undefined | null, epBName: string | number | undefined | null): boolean => {
  if (!epAName || !epBName) return false;
  const numA = getEpisodeNumber(epAName);
  const numB = getEpisodeNumber(epBName);
  if (numA !== null && numB !== null) return numA === numB;
  return epAName.toString().toLowerCase().trim() === epBName.toString().toLowerCase().trim();
};

const isSameServer = (srvA: string | undefined | null, srvB: string | undefined | null): boolean => {
  if (!srvA || !srvB) return false;
  const a = srvA.toLowerCase().trim();
  const b = srvB.toLowerCase().trim();
  return a === b || a.includes(b) || b.includes(a);
};

export const ReportNotification: React.FC = () => {
  const [activeNotification, setActiveNotification] = useState<{
    reportId?: string;
    index: number; // index in local storage array
    movieTitle: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    const checkReports = async () => {
      try {
        const savedReportsRaw = localStorage.getItem('cinemax_user_reports');
        if (!savedReportsRaw) return;

        const savedReports: SavedReport[] = JSON.parse(savedReportsRaw);
        const pendingReports = savedReports.map((r, i) => ({ ...r, originalIndex: i })).filter(r => r.status === 'pending');
        if (pendingReports.length === 0) return;

        // Fetch fixed reports from public/fixed-reports.json
        const res = await fetch(`/fixed-reports.json?t=${Date.now()}`);
        if (!res.ok) return;

        const fixedData: FixedReportsData = await res.json();
        const fixedIds = new Set(fixedData.fixedReportIds || []);
        const fixedQueries = fixedData.fixedQueries || [];

        // Find the first pending report that matches a fix
        for (const report of pendingReports) {
          let isFixed = false;
          let customMessage = '';

          // 1. Match by reportId
          if (fixedIds.has(report.id)) {
            isFixed = true;
            customMessage = `Sự cố phim "${report.movieTitle}" của bạn báo cáo đã được khắc phục thành công!`;
          }

          // 2. Match by query patterns (for retroactive match, e.g. Đặc Vụ Kim)
          if (!isFixed && fixedQueries.length > 0) {
            const queryMatch = fixedQueries.find(q => {
              const slugMatch = q.movieSlug === report.movieSlug;
              // If query defines episodeName, it must match
              const epMatch = !q.episodeName || isSameEpisode(q.episodeName, report.episodeName);
              // If query defines serverName, it must match
              const serverMatch = !q.serverName || isSameServer(q.serverName, report.serverName);
              return slugMatch && epMatch && serverMatch;
            });

            if (queryMatch) {
              isFixed = true;
              customMessage = queryMatch.message;
            }
          }

          if (isFixed) {
            // Show notification
            setActiveNotification({
              reportId: report.id,
              index: report.originalIndex,
              movieTitle: report.movieTitle,
              message: customMessage || `Sự cố phim "${report.movieTitle}" của bạn đã được khắc phục!`
            });
            break; // Show one notification at a time
          }
        }
      } catch (err) {
        console.warn('Failed to check resolved reports:', err);
      }
    };

    // Check on mount, delay slightly to let app initialize smoothly
    const timer = setTimeout(checkReports, 3000);
    return () => clearTimeout(timer);
  }, [activeNotification === null]); // Re-run check if the active notification is dismissed and goes back to null

  const handleDismiss = () => {
    if (!activeNotification) return;

    try {
      const savedReportsRaw = localStorage.getItem('cinemax_user_reports');
      if (savedReportsRaw) {
        const savedReports: SavedReport[] = JSON.parse(savedReportsRaw);
        if (savedReports[activeNotification.index]) {
          // Update status to dismissed
          savedReports[activeNotification.index].status = 'dismissed';
          localStorage.setItem('cinemax_user_reports', JSON.stringify(savedReports));
        }
      }
    } catch (err) {
      console.warn('Failed to update report status:', err);
    }

    setActiveNotification(null);
  };

  return (
    <AnimatePresence>
      {activeNotification && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9, x: 50 }}
          animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
          exit={{ opacity: 0, y: 20, scale: 0.95, x: 20 }}
          transition={{ type: 'spring', damping: 20, stiffness: 150 }}
          className="fixed bottom-20 md:bottom-6 right-4 z-[9999] max-w-sm w-full bg-[#0d0d10]/95 border border-emerald-500/30 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] backdrop-blur-md overflow-hidden"
        >
          {/* Top colored accent line */}
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400" />
          
          <div className="p-4 sm:p-5 flex gap-3.5 items-start">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <BellRing size={18} className="animate-pulse" />
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  Đã khắc phục
                </span>
                <span className="text-[10px] text-gray-400 font-semibold flex items-center gap-1">
                  <Film size={10} /> {activeNotification.movieTitle}
                </span>
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-white leading-snug">
                Phản hồi báo cáo của bạn
              </h4>
              <p className="text-[11px] text-gray-300 leading-relaxed font-medium">
                {activeNotification.message}
              </p>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  onClick={handleDismiss}
                  className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-black font-extrabold text-[10px] px-3.5 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Check size={12} strokeWidth={3} />
                  <span>Xác nhận</span>
                </button>
                <button
                  onClick={handleDismiss}
                  className="bg-white/5 hover:bg-white/10 active:scale-95 text-gray-300 hover:text-white text-[10px] px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                >
                  Bỏ qua
                </button>
              </div>
            </div>

            {/* Absolute close button */}
            <button
              onClick={handleDismiss}
              className="p-1 rounded-full hover:bg-white/5 text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
