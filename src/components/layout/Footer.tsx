import React from "react";
import { ShieldAlert, Flag, ExternalLink } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="w-full border-t border-white/[0.04] bg-[#050505] mt-16 pb-28 md:pb-12 pt-8 px-4 md:px-12 flex flex-col items-center gap-6 relative z-20">
      {/* Disclaimer Card */}
      <div className="max-w-5xl w-full bg-[#130b05]/40 border border-[#3e1f0e]/30 rounded-2xl p-4 md:p-6 flex flex-col gap-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.8)] hover:border-[#582f1b]/50 transition-all duration-300 backdrop-blur-md">
        {/* Header Row: Icon + Title */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#f7b05b]/10 border border-[#f7b05b]/25 text-[#f7b05b] shrink-0">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <h3 className="text-sm md:text-base font-bold text-[#f7b05b] tracking-wide flex items-center gap-1.5">
            Important Disclaimer 
            <span className="font-mono text-xs opacity-80 ml-0.5">¯\_(ツ)_/¯</span>
          </h3>
        </div>

        {/* Text description */}
        <p className="text-[11px] md:text-xs text-neutral-400 leading-relaxed font-medium">
          Cinemax hoạt động như một công cụ tổng hợp nội dung và không lưu trữ bất kỳ tệp tin đa phương tiện nào trên máy chủ của mình. 
          Tất cả các liên kết và nguồn phát đều được tích hợp tự động từ bên thứ ba và các dịch vụ nhúng công cộng. 
          Nếu bạn có bất kỳ vấn đề nào liên quan đến bản quyền hoặc yêu cầu gỡ bỏ bản quyền (DMCA), xin vui lòng liên hệ trực tiếp với các bên lưu trữ gốc để được hỗ trợ giải quyết nhanh nhất.
        </p>

        {/* Badges & Actions */}
        <div className="flex flex-col items-center gap-3 mt-1.5 w-full">
          {/* Badges Row */}
          <div className="flex items-center justify-center flex-wrap gap-1.5">
            <span className="bg-[#2f190e]/60 border border-[#582f1b]/40 text-[#f7b05b] px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide">
              Third-party Content
            </span>
            <span className="bg-[#2f190e]/60 border border-[#582f1b]/40 text-[#f7b05b] px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide">
              No File Hosting
            </span>
          </div>

          {/* Action Buttons Row */}
          <div className="flex items-center justify-center gap-2 w-full">
            <button
              onClick={() => (window as any).triggerPWAInstall?.()}
              className="flex-1 max-w-[180px] bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 hover:border-emerald-500/50 text-emerald-400 px-3 py-2 rounded-full text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all duration-300 active:scale-95 cursor-pointer touch-manipulation"
            >
              <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="3" />
                <path d="M12 7v7" />
                <path d="m9 11 3 3 3-3" />
              </svg>
              <span>Tải App Cinemax</span>
            </button>

            <a
              href="https://www.facebook.com/n1k0vac"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 max-w-[180px] bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 px-3 py-2 rounded-full text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all duration-300 active:scale-95 cursor-pointer touch-manipulation"
            >
              <Flag className="w-3 h-3 shrink-0" />
              <span>Report / Góp ý</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </a>
          </div>
        </div>
      </div>

      {/* Under Disclaimer: Small Site Copyright/Info */}
      <div className="w-full max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] md:text-xs text-neutral-500 border-t border-white/[0.04] pt-4">
        <div>
          <span>© {new Date().getFullYear()} Cinemax. Trải nghiệm phim trực tuyến chất lượng cao.</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span>Phát triển & Vận hành bởi</span>
          <a 
            href="https://www.facebook.com/n1k0vac" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-neutral-400 hover:text-white transition-colors duration-200 hover:underline font-semibold"
          >
            n1k0vac
          </a>
        </div>
      </div>
    </footer>
  );
};
