import React, { useState, useEffect, useRef } from 'react';
import { Settings, Play, Square, Loader2, Database, Terminal, ChevronDown, ChevronUp, Activity } from 'lucide-react';

interface ScraperStats {
  connected: boolean;
  moviesCount: number;
  streamsCount: number;
  animeCount: number;
  error?: string;
}

interface ScraperStatus {
  isRunning: boolean;
  currentTask: string;
  processed: number;
  total: number;
  logs: string[];
}

export default function ScraperDashboard() {
  const [stats, setStats] = useState<ScraperStats>({ connected: false, moviesCount: 0, streamsCount: 0, animeCount: 0 });
  const [status, setStatus] = useState<ScraperStatus>({ isRunning: false, currentTask: 'Idle', processed: 0, total: 0, logs: [] });
  const [source, setSource] = useState<'kkphim' | 'ophim' | 'nguonc'>('kkphim');
  const [limitPages, setLimitPages] = useState<number>(2);
  const [customUrl, setCustomUrl] = useState<string>('https://phimapi.com');
  const [syncAll, setSyncAll] = useState<boolean>(false);
  
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [showLogs, setShowLogs] = useState<boolean>(false);
  
  const [customTmdbId, setCustomTmdbId] = useState<string>('');
  const [customTitle, setCustomTitle] = useState<string>('');

  const [animeAnilistId, setAnimeAnilistId] = useState<string>('');
  
  const [loading, setLoading] = useState<boolean>(false);
  const logsContainerRef = useRef<HTMLDivElement | null>(null);
  const [focusMode, setFocusMode] = useState<boolean>(false);
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        const newFocusMode = !focusMode;
        setFocusMode(newFocusMode);
        try {
          if (newFocusMode) {
            if (document.documentElement.requestFullscreen) {
              await document.documentElement.requestFullscreen();
            }
          } else {
            if (document.fullscreenElement) {
              await document.exitFullscreen();
            }
          }
        } catch (err) {}
        try {
          await fetch(`http://localhost:3001/api/admin/resolver/focus?active=${newFocusMode}`, { method: 'POST' });
        } catch (err) {}
      }
      if (e.key === ' ' && focusMode) {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        handleToggleAllMining();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusMode, status.isRunning]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreen = !!document.fullscreenElement;
      if (!isFullscreen && focusMode) {
        setFocusMode(false);
        fetch('http://localhost:3001/api/admin/resolver/focus?active=false', { method: 'POST' }).catch(() => {});
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [focusMode]);


  const fetchStats = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/admin/scraper/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error("Failed to fetch scraper stats:", e);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/admin/scraper/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.error("Failed to fetch scraper status:", e);
    }
  };

  const handleToggleAllMining = async () => {
    setLoading(true);
    try {
      const currentlyActive = status.isRunning;
      if (currentlyActive) {
        await fetch('http://localhost:3001/api/admin/scraper/stop', { method: 'POST' });
      } else {
        const limit = syncAll ? 9999 : limitPages;
        await fetch(`http://localhost:3001/api/admin/scraper/start?source=all&limit=${limit}`, { method: 'POST' });
      }
      await fetchStatus();
      fetchStats();
    } catch (err) {
      console.error("Lỗi điều khiển máy đào:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunPythonScraper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTmdbId) return;
    setLoading(true);
    try {
      let title = customTitle;
      const res = await fetch(`http://localhost:3001/api/admin/scraper/start?source=python&tmdb_id=${customTmdbId}&title=${encodeURIComponent(title || 'Custom Phim')}`, {
        method: 'POST'
      });
      if (res.ok) {
        setCustomTmdbId('');
        setCustomTitle('');
        await fetchStatus();
      }
    } catch (err) {
      console.error("Lỗi gọi kịch bản Python:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunAnimeScraper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!animeAnilistId) return;
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3001/api/admin/scraper/start?source=niniyo&anilist_id=${animeAnilistId}`, {
        method: 'POST'
      });
      if (res.ok) {
        setAnimeAnilistId('');
        fetchStats();
        await fetchStatus();
      }
    } catch (err) {
      console.error("Lỗi kết nối API Server:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchStatus();
    const interval = setInterval(() => {
      fetchStatus();
      fetchStats();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [status.logs, showLogs]);

  const activeAll = status.isRunning;

  
  if (focusMode) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-between p-12 font-sans select-none overflow-hidden">
        <div className="absolute inset-0 bg-radial-gradient flex items-center justify-center pointer-events-none opacity-40">
          <div className={`w-[500px] h-[500px] rounded-full filter blur-[120px] transition-all duration-1000 ${activeAll ? 'bg-emerald-500/10' : 'bg-zinc-800/10'}`} />
        </div>
        <div className="w-full max-w-4xl flex items-center justify-between border-b border-zinc-950 pb-5 z-10">
          <div className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${stats.connected ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500'}`} />
            <h1 className="text-[10px] font-bold tracking-[0.25em] text-zinc-500 uppercase font-mono">CINEMAX CORE</h1>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-emerald-500 font-mono animate-pulse">
            <Activity size={10} />
            <span>FOCUS MODE ACTIVE (100% BOOSTED - 12 THREADS)</span>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center z-10">
          <button
            onClick={handleToggleAllMining}
            disabled={loading || !stats.connected}
            className={`relative h-56 w-56 rounded-full border flex flex-col items-center justify-center gap-4 transition-all duration-1000 cursor-pointer active:scale-95 disabled:opacity-50 ${activeAll ? 'bg-black border-emerald-500 text-emerald-400 shadow-[0_0_80px_rgba(16,185,129,0.25)] scale-105' : 'bg-black border-zinc-900 text-zinc-600 hover:border-zinc-850 hover:text-zinc-400'}`}
          >
            <div className={`absolute inset-3.5 rounded-full border transition-all duration-1000 ${activeAll ? 'border-emerald-500/20 animate-ping' : 'border-zinc-950'}`} />
            {loading ? (
              <Loader2 size={36} className="animate-spin text-zinc-400" />
            ) : activeAll ? (
              <Activity size={42} className="text-emerald-400 animate-pulse" />
            ) : (
              <Play size={42} fill="currentColor" className="text-zinc-700 hover:text-zinc-400 transition-colors" />
            )}
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[11px] font-black tracking-[0.3em] font-mono">{activeAll ? 'BOOST MINING' : 'READY TO MINING'}</span>
              <span className="text-[9px] font-bold text-zinc-650 font-mono tracking-widest uppercase">{activeAll ? 'Luồng bẻ khóa: 12/12' : 'Nhấn SPACE để bắt đầu'}</span>
            </div>
          </button>
          <div className="mt-8 text-center space-y-1">
            <div className="text-[10px] font-bold text-zinc-550 font-mono uppercase tracking-widest">{activeAll ? `Đang xử lý: ${status.currentTask}` : 'Trạng thái: Tạm dừng'}</div>
            <div className="text-[9px] text-zinc-700 font-mono">Nhấn <span className="text-zinc-500 border border-zinc-900 px-1 py-0.5 rounded">Ctrl + Enter</span> để thoát</div>
          </div>
        </div>
        <div className="w-full max-w-4xl grid grid-cols-2 md:grid-cols-3 gap-8 py-5 border-t border-zinc-950 z-10 text-center md:text-left">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold tracking-widest text-zinc-600 uppercase font-mono">Phim Đã Cào</span>
            <span className="text-2xl font-light text-zinc-100 mt-1.5 font-mono tracking-tight">{stats.moviesCount.toLocaleString()}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold tracking-widest text-zinc-600 uppercase font-mono">Tập Phim (Streams)</span>
            <span className="text-2xl font-light text-zinc-100 mt-1.5 font-mono tracking-tight">{stats.streamsCount.toLocaleString()}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold tracking-widest text-zinc-600 uppercase font-mono">Anime Đã Cào</span>
            <span className="text-2xl font-light text-emerald-400 mt-1.5 font-mono tracking-tight">{stats.animeCount?.toLocaleString() || 0}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-400 p-6 sm:p-12 font-sans flex flex-col justify-between select-none">
      
      {/* Top Header & Complications stats */}
      <div className="max-w-4xl mx-auto w-full flex flex-col gap-6">
        <div className="flex items-center justify-between border-b border-zinc-950 pb-5">
          <div className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${stats.connected ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500'}`} />
            <h1 className="text-[10px] font-bold tracking-[0.25em] text-zinc-500 uppercase font-mono">CINEMAX CORE</h1>
          </div>
          <span className="text-[10px] font-bold tracking-[0.2em] text-zinc-600 font-mono">MINER ENGINE v1.2</span>
        </div>

        {/* Apple watch complications design stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 py-2">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold tracking-widest text-zinc-600 uppercase font-mono">Phim Đã Cào</span>
            <span className="text-xl font-light text-zinc-200 mt-1 font-mono tracking-tight">{stats.moviesCount.toLocaleString()}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold tracking-widest text-zinc-600 uppercase font-mono">Tập Phim (Streams)</span>
            <span className="text-xl font-light text-zinc-200 mt-1 font-mono tracking-tight">{stats.streamsCount.toLocaleString()}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold tracking-widest text-zinc-600 uppercase font-mono">Anime Đã Cào</span>
            <span className="text-xl font-light text-emerald-500 mt-1 font-mono tracking-tight">{stats.animeCount?.toLocaleString() || 0}</span>
          </div>
        </div>
      </div>

      {/* Center: Apple-style Power Toggle Button */}
      <div className="max-w-4xl mx-auto w-full flex flex-col items-center justify-center py-8">
        <button
          onClick={handleToggleAllMining}
          disabled={loading || !stats.connected}
          className={`relative h-48 w-48 rounded-full border flex flex-col items-center justify-center gap-3 transition-all duration-700 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
            activeAll 
              ? 'bg-black border-emerald-500 text-emerald-400 shadow-[0_0_55px_rgba(16,185,129,0.18)]' 
              : 'bg-black border-zinc-900 text-zinc-600 hover:border-zinc-800 hover:text-zinc-400'
          }`}
        >
          <div className={`absolute inset-2.5 rounded-full border transition-all duration-700 ${
            activeAll ? 'border-emerald-500/20 animate-pulse' : 'border-zinc-950'
          }`} />

          {loading ? (
            <Loader2 size={24} className="animate-spin text-zinc-400" />
          ) : activeAll ? (
            <div className="relative flex h-8 w-8 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-20"></span>
              <Activity size={24} className="text-emerald-400 animate-pulse" />
            </div>
          ) : (
            <Play size={24} fill="currentColor" className="text-zinc-700 hover:text-zinc-400 transition-colors" />
          )}

          <div className="flex flex-col items-center gap-0.5 mt-1">
            <span className="text-[10px] font-black tracking-[0.25em] font-mono">
              {activeAll ? 'RUNNING' : 'START MINING'}
            </span>
            <span className="text-[8px] font-bold text-zinc-600 font-mono tracking-wider uppercase">
              {activeAll ? 'Đang chạy' : 'Kích hoạt máy đào'}
            </span>
          </div>
        </button>

        {activeAll && (
          <div className="mt-8 flex items-center gap-4 text-[9px] font-mono tracking-wider text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-emerald-500 animate-ping" />
              Đồng bộ nguồn Việt Nam: ON
            </span>
          </div>
        )}
      </div>

      {/* Bottom Collapsible Sections & Controls */}
      <div className="max-w-4xl mx-auto w-full flex flex-col gap-4 border-t border-zinc-950 pt-5">
        <div className="flex items-center justify-center gap-8">
          <button
            onClick={() => { setShowAdvanced(!showAdvanced); if (showLogs) setShowLogs(false); }}
            className="flex items-center gap-1.5 text-[9px] font-bold tracking-widest uppercase text-zinc-500 hover:text-zinc-300 font-mono cursor-pointer transition-colors"
          >
            <Settings size={11} />
            <span>Advanced Settings</span>
            {showAdvanced ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
          </button>
          
          <button
            onClick={() => { setShowLogs(!showLogs); if (showAdvanced) setShowAdvanced(false); }}
            className="flex items-center gap-1.5 text-[9px] font-bold tracking-widest uppercase text-zinc-500 hover:text-zinc-300 font-mono cursor-pointer transition-colors"
          >
            <Terminal size={11} />
            <span>System Logs</span>
            {showLogs ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
          </button>
        </div>

        {showAdvanced && (
          <div className="p-5 rounded-xl border border-zinc-950 bg-black grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
            
            {/* VN Sync Config */}
            <div className="space-y-4">
              <h3 className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono border-b border-zinc-950 pb-2">Đồng Bộ Nguồn Lẻ</h3>
              <div className="grid grid-cols-3 gap-2">
                {(['kkphim', 'ophim', 'nguonc'] as const).map((src) => (
                  <button
                    key={src}
                    onClick={() => {
                      setSource(src);
                      setCustomUrl(src === 'kkphim' ? 'https://phimapi.com' : src === 'nguonc' ? 'https://phim.nguonc.com/api' : 'https://ophim1.com');
                    }}
                    disabled={status.isRunning}
                    className={`py-1.5 rounded-lg border text-[9px] font-bold font-mono tracking-wider transition-all cursor-pointer ${
                      source === src 
                        ? 'bg-zinc-900 border-zinc-800 text-zinc-100' 
                        : 'bg-black border-zinc-950 text-zinc-600 hover:border-zinc-900 hover:text-zinc-400'
                    }`}
                  >
                    {src.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-600 font-bold uppercase tracking-wider text-[9px]">Giới hạn trang</span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setSyncAll(!syncAll)}
                      className={`px-1.5 py-0.5 rounded border text-[8px] font-bold transition-all cursor-pointer ${
                        syncAll ? 'bg-zinc-900 border-zinc-850 text-zinc-200' : 'bg-black border-zinc-950 text-zinc-600'
                      }`}
                    >
                      TẤT CẢ
                    </button>
                    {!syncAll && (
                      <input 
                        type="number" 
                        value={limitPages}
                        onChange={(e) => setLimitPages(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-10 bg-black border border-zinc-950 rounded px-1 py-0.5 text-center text-zinc-300 font-mono focus:outline-none focus:border-zinc-850"
                        min="1"
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[8px] font-bold text-zinc-700 uppercase tracking-wider font-mono">Endpoint API</span>
                  <input
                    type="text"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="URL máy chủ cào phim..."
                    className="w-full bg-black border border-zinc-950 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-300 focus:outline-none focus:border-zinc-900"
                  />
                </div>
              </div>
            </div>

            {/* Niniyo Anime Scraper Manual */}
            <div className="space-y-4">
              <h3 className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono border-b border-zinc-950 pb-2">Đào Anime từ AniList (Niniyo)</h3>
              <form onSubmit={handleRunAnimeScraper} className="space-y-3">
                <div className="space-y-1">
                  <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-wider font-mono">AniList ID</span>
                  <input
                    type="text"
                    placeholder="Nhập AniList ID (ví dụ: 16498)"
                    value={animeAnilistId}
                    onChange={(e) => setAnimeAnilistId(e.target.value)}
                    className="w-full bg-black border border-zinc-950 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-300 focus:outline-none focus:border-zinc-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !animeAnilistId}
                  className="w-full bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 text-zinc-300 font-bold py-1.5 rounded-lg text-xs font-mono tracking-wider transition-all cursor-pointer disabled:opacity-50"
                >
                  BẮT ĐẦU ĐÀO ANIME
                </button>
              </form>

              <div className="pt-2 border-t border-zinc-950">
                <form onSubmit={handleRunPythonScraper} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Python TMDB ID"
                    value={customTmdbId}
                    onChange={(e) => setCustomTmdbId(e.target.value)}
                    className="w-2/3 bg-black border border-zinc-950 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-300 focus:outline-none focus:border-zinc-900"
                  />
                  <button
                    type="submit"
                    disabled={loading || !customTmdbId}
                    className="w-1/3 bg-black hover:bg-zinc-950 border border-zinc-950 text-zinc-500 font-bold rounded-lg text-[9px] font-mono tracking-wider transition-all cursor-pointer"
                  >
                    PY-SCRAP
                  </button>
                </form>
              </div>
            </div>

          </div>
        )}

        {showLogs && (
          <div className="rounded-xl border border-zinc-950 overflow-hidden bg-black mt-2">
            <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-950 bg-black">
              <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest font-mono flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                SYSTEM CONSOLE OUTPUT
              </span>
              <button 
                onClick={() => setStatus({ ...status, logs: [] })}
                className="text-[9px] text-zinc-700 hover:text-zinc-500 font-mono tracking-wide transition-colors cursor-pointer"
              >
                CLEAR
              </button>
            </div>
            
            <div 
              ref={logsContainerRef}
              className="h-48 overflow-y-auto p-4 font-mono text-[9px] leading-relaxed text-zinc-500 space-y-1 bg-[#020202] select-text"
            >
              {status.logs.length === 0 ? (
                <div className="text-zinc-750 italic text-center py-8">Không có logs hệ thống...</div>
              ) : (
                status.logs.map((log, idx) => {
                  let colorClass = 'text-zinc-500';
                  if (log.includes('[ERROR]')) colorClass = 'text-red-400/80';
                  else if (log.includes('[WARN]')) colorClass = 'text-amber-500/80';
                  else if (log.includes('✅') || log.includes('thành công') || log.includes('hoàn tất')) colorClass = 'text-emerald-500/80';
                  else if (log.includes('[RESOLVER]')) colorClass = 'text-zinc-300';
                  else if (log.includes('[24/7 MINER]')) colorClass = 'text-zinc-400';
                  
                  return (
                    <div key={idx} className={`${colorClass} hover:bg-zinc-950/20 px-1 py-0.5 rounded transition-colors`}>
                      {log}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
