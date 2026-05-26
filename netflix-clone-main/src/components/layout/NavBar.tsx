import React, { useState, useEffect } from "react";
import { cn } from "../../lib/utils";
import { Search } from "lucide-react";

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isGenreMenuOpen, setIsGenreMenuOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const tabs = [
    { id: "home", label: "Trang chủ" },
    { id: "phim-bo", label: "Phim bộ" },
    { id: "phim-le", label: "Phim lẻ" },
    { id: "my-list", label: "Danh sách của tôi" },
  ];

  const popularGenres = [
    { id: "the-loai/hanh-dong", label: "Hành Động" },
    { id: "the-loai/tinh-cam", label: "Tình Cảm" },
    { id: "the-loai/hai-huoc", label: "Hài Hước" },
    { id: "the-loai/co-trang", label: "Cổ Trang" },
    { id: "the-loai/tam-ly", label: "Tâm Lý" },
    { id: "the-loai/hinh-su", label: "Hình Sự" },
    { id: "the-loai/chien-tranh", label: "Chiến Tranh" },
    { id: "the-loai/the-thao", label: "Thể Thao" },
    { id: "the-loai/vo-thuat", label: "Võ Thuật" },
    { id: "the-loai/vien-tuong", label: "Viễn Tưởng" },
    { id: "the-loai/kinh-di", label: "Kinh Dị" },
    { id: "the-loai/tai-lieu", label: "Tài Liệu" },
    { id: "the-loai/am-nhac", label: "Âm Nhạc" },
    { id: "the-loai/gia-dinh", label: "Gia Đình" },
    { id: "the-loai/hoc-duong", label: "Học Đường" },
    { id: "hoat-hinh", label: "Hoạt Hình" },
  ];

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 w-full z-50 transition-all duration-300",
        scrolled
          ? "bg-black/40 backdrop-blur-xl border-b border-white/5 shadow-2xl"
          : "bg-gradient-to-b from-black/80 via-black/20 to-transparent",
      )}
    >
      <div className="w-full max-w-[1536px] mx-auto px-4 sm:px-8 md:px-12 py-3 sm:py-5 flex items-center justify-between">
      <div className="flex items-center gap-8 md:gap-12">
        <h1
          onClick={() => setTab("home")}
          className="text-red-600 text-2xl sm:text-3xl font-black tracking-tighter cursor-pointer drop-shadow-lg transition-transform hover:scale-105"
        >
          CINEMAX
        </h1>

        {/* Desktop Tabs */}
        <div className="hidden lg:flex items-center gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={cn(
                "text-[15px] transition-all duration-300",
                currentTab === tab.id
                  ? "text-white font-bold drop-shadow-md"
                  : "text-gray-300 hover:text-white hover:drop-shadow-md",
              )}
            >
              {tab.label}
            </button>
          ))}

          <div
            className="relative"
            onMouseEnter={() => setIsGenreMenuOpen(true)}
            onMouseLeave={() => setIsGenreMenuOpen(false)}
          >
            <button
              className={cn(
                "text-[15px] transition-all duration-300 flex items-center gap-1",
                currentTab.startsWith("the-loai/")
                  ? "text-white font-bold drop-shadow-md"
                  : "text-gray-300 hover:text-white hover:drop-shadow-md",
              )}
            >
              Thể loại{" "}
              <span
                className={cn(
                  "text-[10px] transition-transform",
                  isGenreMenuOpen && "rotate-180",
                )}
              >
                ▼
              </span>
            </button>

            {isGenreMenuOpen && (
              <div className="absolute top-full left-0 pt-6 cursor-default">
                <div className="bg-black/90 backdrop-blur-3xl border border-white/10 w-[450px] shadow-2xl rounded-2xl p-6 text-white text-[15px] grid grid-cols-3 gap-y-4 gap-x-2">
                  <div className="absolute -top-2 left-8 w-4 h-4 rotate-45 bg-black/90 backdrop-blur-3xl border-l border-t border-white/10" />
                  {popularGenres.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => {
                        setTab(g.id);
                        setIsGenreMenuOpen(false);
                      }}
                      className={cn(
                        "text-left hover:text-white transition-colors duration-200",
                        currentTab === g.id
                          ? "font-bold text-white drop-shadow-md"
                          : "text-white/60",
                      )}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        <div className="lg:hidden relative">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex items-center gap-2 text-white text-sm font-medium"
          >
            Duyệt qua{" "}
            <span
              className={cn(
                "text-[10px] transition-transform",
                isMobileMenuOpen && "rotate-180",
              )}
            >
              ▼
            </span>
          </button>
          {isMobileMenuOpen && (
            <div className="absolute top-10 left-0 bg-black/95 backdrop-blur-3xl border border-white/10 flex flex-col items-center py-4 w-56 shadow-2xl rounded-2xl max-h-[70vh] overflow-y-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setTab(tab.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    "py-3 text-sm transition-colors w-full text-center hover:bg-white/10",
                    currentTab === tab.id
                      ? "text-white font-bold"
                      : "text-white/70 font-medium",
                  )}
                >
                  {tab.label}
                </button>
              ))}
              <div className="w-full h-px bg-white/10 my-2" />
              <div className="text-white/50 text-xs font-bold mb-2 uppercase tracking-wider">
                Thể loại
              </div>
              {popularGenres.map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    setTab(g.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    "py-2 text-sm transition-colors w-full text-center hover:bg-white/10",
                    currentTab === g.id
                      ? "text-white font-bold"
                      : "text-white/70 font-medium",
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-5 sm:gap-7 text-white">
        <button
          onClick={onShowSearch}
          className="hover:scale-110 transition-transform duration-200"
        >
          <Search className="w-5 h-5" strokeWidth={2.5} />
        </button>
      </div>
      </div>
    </nav>
  );
};
