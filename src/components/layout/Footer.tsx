import React from "react";
import { ShieldAlert, Flag, ExternalLink } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="w-full border-t border-white/[0.04] bg-[#050505] mt-16 pb-28 md:pb-12 pt-10 px-4 md:px-12 flex flex-col items-center gap-8 relative z-20">
      {/* Disclaimer Card */}
      <div className="max-w-5xl w-full bg-[#130b05]/50 border border-[#3e1f0e]/40 rounded-2xl p-5 md:p-6 flex flex-col gap-4 shadow-[0_8px_30px_rgba(0,0,0,0.8)] hover:border-[#582f1b]/60 hover:shadow-[0_8px_30px_rgba(247,176,91,0.02)] transition-all duration-300 backdrop-blur-md">
        {/* Header Row: Icon + Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#f7b05b]/10 border border-[#f7b05b]/20 text-[#f7b05b] shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-[#f7b05b] tracking-wide flex items-center gap-1.5">
            Important Disclaimer 
            <span className="font-mono text-sm opacity-85 ml-1">¯\_(ツ)_/¯</span>
          </h3>
        </div>

        {/* Text description */}
        <p className="text-sm text-neutral-400 leading-relaxed font-medium">
          Cinemax hoạt động như một công cụ tổng hợp nội dung và không lưu trữ bất kỳ tệp tin đa phương tiện nào trên máy chủ của mình. 
          Tất cả các liên kết và nguồn phát đều được tích hợp tự động từ bên thứ ba và các dịch vụ nhúng công cộng. 
          Nếu bạn có bất kỳ vấn đề nào liên quan đến bản quyền hoặc yêu cầu gỡ bỏ bản quyền (DMCA), xin vui lòng liên hệ trực tiếp với các bên lưu trữ gốc để được hỗ trợ giải quyết nhanh nhất.
        </p>

        {/* Badges & Actions */}
        <div className="flex flex-wrap items-center gap-2 mt-2 w-full">
          <div className="flex flex-wrap gap-2 mr-auto">
            <span className="bg-[#2f190e]/70 border border-[#582f1b]/50 text-[#f7b05b] px-3 py-1 rounded-full text-xs font-semibold tracking-wide">
              Third-party Content
            </span>
            <span className="bg-[#2f190e]/70 border border-[#582f1b]/50 text-[#f7b05b] px-3 py-1 rounded-full text-xs font-semibold tracking-wide">
              No File Hosting
            </span>
          </div>
          
          <a
            href="https://www.facebook.com/n1k0vac"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 px-4 py-2 sm:py-1 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-300 hover:scale-[1.02] active:scale-95 shadow-[0_2px_8px_rgba(239,68,68,0.05)] w-full sm:w-auto mt-3 sm:mt-0 cursor-pointer"
          >
            <Flag className="w-3.5 h-3.5" />
            <span>Report lỗi hoặc đề xuất</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        </div>
      </div>

      {/* Under Disclaimer: Small Site Copyright/Info */}
      <div className="w-full max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500 border-t border-white/[0.04] pt-6">
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
