import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Square, 
  Database, 
  Server, 
  Terminal, 
  ArrowLeft, 
  Activity, 
  AlertCircle, 
  Loader2, 
  Layers, 
  FileText,
  Cpu,
  Hash,
  Type
} from 'lucide-react';

interface ScraperStats {
  connected: boolean;
  moviesCount: number;
  streamsCount: number;
  cineproConnected?: boolean;
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
  const [stats, setStats] = useState<ScraperStats>({ connected: false, moviesCount: 0, streamsCount: 0 });
  const [status, setStatus] = useState<ScraperStatus>({ isRunning: false, currentTask: 'Idle', processed: 0, total: 0, logs: [] });
  const [source, setSource] = useState<'kkphim' | 'ophim' | 'nguonc'>('kkphim');
  const [limitPages, setLimitPages] = useState<number>(2);
  const [customUrl, setCustomUrl] = useState<string>('https://phimapi.com');
  const [syncAll, setSyncAll] = useState<boolean>(false);
  
  // Custom manual python job form
  const [customTmdbId, setCustomTmdbId] = useState<string>('');
  const [customTitle, setCustomTitle] = useState<string>('');
  
  const [loading, setLoading] = useState<boolean>(false);
  const logsContainerRef = useRef<HTMLDivElement | null>(null);

  // Poll database statistics and scraper status
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

  useEffect(() => {
    fetchStats();
    fetchStatus();

    // Poll status frequently when running, less frequently when idle
    const interval = setInterval(() => {
      fetchStatus();
      fetchStats();
    }, status.isRunning ? 1000 : 3000);

    return () => clearInterval(interval);
  }, [status.isRunning]);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [status.logs]);

  const handleStartMining = async () => {
    setLoading(true);
    try {
      const limit = syncAll ? 9999 : limitPages;
      const res = await fetch(`http://localhost:3001/api/admin/scraper/start?source=${source}&limit=${limit}&customUrl=${encodeURIComponent(customUrl)}`, {
        method: 'POST'
      });
      if (res.ok) {
        await fetchStatus();
      } else {
        const errData = await res.json();
        alert(errData.error || "Không thể khởi động máy đào");
      }
    } catch (e) {
      alert("Lỗi kết nối API Server");
    } finally {
      setLoading(false);
    }
  };

  const handleStartAllMining = async () => {
    setLoading(true);
    try {
      const limit = syncAll ? 9999 : limitPages;
      const res = await fetch(`http://localhost:3001/api/admin/scraper/start?source=all&limit=${limit}`, {
        method: 'POST'
      });
      if (res.ok) {
        await fetchStatus();
      } else {
        const errData = await res.json();
        alert(errData.error || "Không thể khởi động cào 3 nguồn");
      }
    } catch (e) {
      alert("Lỗi kết nối API Server");
    } finally {
      setLoading(false);
    }
  };

  const handleStopMining = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/admin/scraper/stop', {
        method: 'POST'
      });
      if (res.ok) {
        await fetchStatus();
      }
    } catch (e) {
      alert("Lỗi kết nối API Server");
    } finally {
      setLoading(false);
    }
  };

  const handleRunPythonScraper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTmdbId) {
      alert("Vui lòng nhập TMDB ID!");
      return;
    }
    
    setLoading(true);
    let title = customTitle.trim();

    try {
      if (!title) {
        // Automatically fetch title from TMDB API via local proxy
        try {
          // Try movie details first
          let resTmdb = await fetch(`/tmdb/movie/${customTmdbId}?language=vi`);
          if (resTmdb.ok) {
            let dataTmdb = await resTmdb.json();
            if (dataTmdb && (dataTmdb.title || dataTmdb.name)) {
              title = dataTmdb.title || dataTmdb.name;
            }
          }
          
          // Try tv show details if movie failed/returned no title
          if (!title) {
            let resTmdbTv = await fetch(`/tmdb/tv/${customTmdbId}?language=vi`);
            if (resTmdbTv.ok) {
              let dataTmdbTv = await resTmdbTv.json();
              if (dataTmdbTv && (dataTmdbTv.title || dataTmdbTv.name)) {
                title = dataTmdbTv.title || dataTmdbTv.name;
              }
            }
          }
        } catch (tmdbErr) {
          console.error("Failed to auto-fetch TMDB details:", tmdbErr);
        }

        if (!title) {
          alert("Không thể tìm thấy tiêu đề phim tự động từ TMDB ID này. Vui lòng điền tiêu đề thủ công!");
          setLoading(false);
          return;
        }
      }

      const res = await fetch(`http://localhost:3001/api/admin/scraper/start?source=python&tmdb_id=${customTmdbId}&title=${encodeURIComponent(title)}`, {
        method: 'POST'
      });
      if (res.ok) {
        alert(`Đã gửi yêu cầu chạy kịch bản Python Scrapling cho phim: ${title}`);
        setCustomTmdbId('');
        setCustomTitle('');
        await fetchStatus();
      }
    } catch (err) {
      alert("Lỗi gọi kịch bản Python.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] text-zinc-100 p-4 sm:p-8 font-sans selection:bg-zinc-800 selection:text-white">
      {/* Header */}
      <div className="max-w-6xl mx-auto flex items-center justify-between mb-8 pb-5 border-b border-zinc-900">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-widest text-white flex items-center gap-2 font-mono">
              <Server className="text-zinc-500" size={18} />
              CINEMAX MINER
            </h1>
          </div>
        </div>
        
        {/* Status indicators */}
        <div className="flex items-center gap-2.5">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold font-mono transition-all duration-300 ${
            stats.cineproConnected 
              ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-400' 
              : 'bg-zinc-950 border-zinc-900 text-zinc-500'
          }`}>
            <Cpu size={12} className={stats.cineproConnected ? 'animate-pulse' : ''} />
            <span>CINEPRO: {stats.cineproConnected ? 'CONNECTED' : 'OFFLINE'}</span>
          </div>

          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold font-mono transition-all duration-300 ${
            stats.connected 
              ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-400' 
              : 'bg-red-950/20 border-red-900/50 text-red-400'
          }`}>
            <Database size={12} className={stats.connected ? 'animate-pulse' : ''} />
            <span>DB: {stats.connected ? 'CONNECTED' : 'DISCONNECTED'}</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column Controls */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Card: Stats */}
          <div className="bg-black border border-zinc-900 rounded-xl p-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#030303] border border-zinc-900 rounded-lg p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-950 flex items-center justify-center border border-zinc-900">
                  <Layers size={14} className="text-violet-400" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Movies</span>
                  <span className="text-lg font-black text-white font-mono">{stats.moviesCount}</span>
                </div>
              </div>
              <div className="bg-[#030303] border border-zinc-900 rounded-lg p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-950 flex items-center justify-center border border-zinc-900">
                  <FileText size={14} className="text-emerald-400" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Streams</span>
                  <span className="text-lg font-black text-white font-mono">{stats.streamsCount}</span>
                </div>
              </div>
            </div>
            
            {stats.error && (
              <div className="mt-4 p-3 rounded-lg bg-amber-950/20 border border-amber-900/50 text-xs font-mono text-amber-400 flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{stats.error}</span>
              </div>
            )}
          </div>

          {/* Card: Config Sync */}
          <div className="bg-black border border-zinc-900 rounded-xl p-5 space-y-4">
            {/* Source */}
            <div className="flex flex-col gap-1.5">
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    setSource('kkphim');
                    setCustomUrl('https://phimapi.com');
                  }}
                  disabled={status.isRunning}
                  className={`py-2 rounded-lg border text-xs font-bold font-mono tracking-wide transition-all ${
                    source === 'kkphim' 
                      ? 'bg-zinc-900 border-zinc-800 text-white' 
                      : 'bg-black border-zinc-950 text-zinc-600 hover:text-zinc-400 hover:border-zinc-900 disabled:opacity-50'
                  }`}
                >
                  KKPHIM
                </button>
                <button
                  onClick={() => {
                    setSource('ophim');
                    setCustomUrl('https://ophim1.com');
                  }}
                  disabled={status.isRunning}
                  className={`py-2 rounded-lg border text-xs font-bold font-mono tracking-wide transition-all ${
                    source === 'ophim' 
                      ? 'bg-zinc-900 border-zinc-800 text-white' 
                      : 'bg-black border-zinc-950 text-zinc-600 hover:text-zinc-400 hover:border-zinc-900 disabled:opacity-50'
                  }`}
                >
                  OPHIM
                </button>
                <button
                  onClick={() => {
                    setSource('nguonc');
                    setCustomUrl('https://phim.nguonc.com/api');
                  }}
                  disabled={status.isRunning}
                  className={`py-2 rounded-lg border text-xs font-bold font-mono tracking-wide transition-all ${
                    source === 'nguonc' 
                      ? 'bg-zinc-900 border-zinc-800 text-white' 
                      : 'bg-black border-zinc-950 text-zinc-600 hover:text-zinc-400 hover:border-zinc-900 disabled:opacity-50'
                  }`}
                >
                  NGUONC
                </button>
              </div>
            </div>

            {/* Custom URL */}
            <div className="flex flex-col gap-1 bg-[#030303] border border-zinc-900 rounded-lg px-3.5 py-2">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-mono">API URL</span>
              <input
                type="text"
                value={customUrl}
                disabled={status.isRunning}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none w-full font-mono mt-0.5"
              />
              <div className="flex flex-wrap gap-1 mt-1.5 pt-1 border-t border-zinc-950">
                {(source === 'kkphim' 
                  ? ['https://phimapi.com', 'https://phimapi.cc'] 
                  : source === 'nguonc'
                  ? ['https://phim.nguonc.com/api', 'https://nguonc.com/api']
                  : ['https://ophim1.com', 'https://ophim1.cc', 'https://ophim10.cc', 'https://ophim17.cc', 'https://ophim.tv']
                ).map((qUrl) => (
                  <button
                    key={qUrl}
                    type="button"
                    disabled={status.isRunning}
                    onClick={() => setCustomUrl(qUrl)}
                    className="text-[9px] bg-black border border-zinc-900 hover:border-zinc-800 hover:text-white px-2 py-0.5 rounded text-zinc-500 font-mono transition-all disabled:opacity-50"
                  >
                    {qUrl.replace('https://', '')}
                  </button>
                ))}
              </div>
            </div>

            {/* Pages input */}
            <div className="flex flex-col gap-2 bg-[#030303] border border-zinc-900 rounded-lg px-3.5 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider font-mono">Pages</span>
                <input
                  type={syncAll ? "text" : "number"}
                  min={1}
                  max={20}
                  value={syncAll ? 'ALL' : limitPages}
                  disabled={status.isRunning || syncAll}
                  onChange={(e) => setLimitPages(Math.max(1, parseInt(e.target.value) || 1))}
                  className="bg-transparent text-right text-sm text-white font-bold font-mono focus:outline-none w-16 disabled:text-zinc-600"
                />
              </div>
              <div className="flex items-center justify-between border-t border-zinc-950 pt-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Sync All</span>
                <input
                  type="checkbox"
                  checked={syncAll}
                  disabled={status.isRunning}
                  onChange={(e) => setSyncAll(e.target.checked)}
                  className="w-3.5 h-3.5 accent-emerald-500 bg-black border-zinc-900 rounded cursor-pointer disabled:opacity-50"
                />
              </div>
            </div>

            {/* Sync control button */}
            <div>
              {status.isRunning ? (
                <button
                  onClick={handleStopMining}
                  disabled={loading}
                  className="w-full bg-red-950/20 hover:bg-red-900/30 text-red-400 font-extrabold py-2.5 rounded-lg border border-red-900/50 transition-all flex items-center justify-center gap-2 cursor-pointer text-xs tracking-widest uppercase font-mono"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />}
                  <span>STOP</span>
                </button>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={handleStartMining}
                    disabled={loading || !stats.connected}
                    className="w-full bg-white hover:bg-zinc-200 text-black font-extrabold py-2.5 rounded-lg border border-white transition-all flex items-center justify-center gap-2 cursor-pointer text-xs tracking-widest uppercase font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
                    <span>START SYNC ({source.toUpperCase()})</span>
                  </button>

                  <button
                    onClick={handleStartAllMining}
                    disabled={loading || !stats.connected}
                    className="w-full bg-emerald-950/20 hover:bg-emerald-900/30 text-emerald-400 font-extrabold py-2.5 rounded-lg border border-emerald-900/50 transition-all flex items-center justify-center gap-2 cursor-pointer text-xs tracking-widest uppercase font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14} />}
                    <span>CÀO CẢ 3 NGUỒN CÙNG LÚC</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Card: Custom Target python */}
          <div className="bg-black border border-zinc-900 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-zinc-500 font-bold uppercase tracking-wider text-xs font-mono">
              <Cpu size={14} />
              <span>Target Miner</span>
            </div>
            
            <form onSubmit={handleRunPythonScraper} className="space-y-3">
              <div className="flex items-center gap-2 bg-[#030303] border border-zinc-900 rounded-lg px-3 py-2">
                <Hash size={14} className="text-zinc-600" />
                <input
                  type="text"
                  placeholder="TMDB ID"
                  value={customTmdbId}
                  disabled={status.isRunning}
                  onChange={(e) => setCustomTmdbId(e.target.value)}
                  className="bg-transparent text-sm text-white font-mono focus:outline-none w-full placeholder-zinc-700"
                />
              </div>

              <div className="flex items-center gap-2 bg-[#030303] border border-zinc-900 rounded-lg px-3 py-2">
                <Type size={14} className="text-zinc-600" />
                <input
                  type="text"
                  placeholder="Tiêu đề (Không bắt buộc - tự lấy từ TMDB)"
                  value={customTitle}
                  disabled={status.isRunning}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="bg-transparent text-sm text-white focus:outline-none w-full placeholder-zinc-700"
                />
              </div>

              <button
                type="submit"
                disabled={loading || status.isRunning || !stats.connected}
                className="w-full bg-[#030303] border border-zinc-900 hover:border-zinc-800 text-zinc-400 hover:text-white font-extrabold py-2.5 rounded-lg text-xs tracking-widest uppercase active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer font-mono disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : <Terminal size={12} />}
                <span>EXECUTE PY</span>
              </button>
            </form>
          </div>

        </div>

        {/* Right Column: Console Terminal Box */}
        <div className="lg:col-span-2 flex flex-col h-[600px] bg-black border border-zinc-900 rounded-xl overflow-hidden">
          
          {/* Terminal Header */}
          <div className="px-5 py-3.5 border-b border-zinc-900 flex items-center justify-between bg-[#030303]">
            <div className="flex items-center gap-2">
              <Terminal className="text-zinc-500" size={14} />
              <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest">Logs</span>
            </div>
            
            {status.isRunning && (
              <div className="flex items-center gap-1.5 text-[10px] font-black font-mono tracking-widest text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                RUNNING
              </div>
            )}
          </div>

          {/* Active Job Progress */}
          {status.isRunning && (
            <div className="px-5 py-3 border-b border-zinc-900 bg-zinc-950/20">
              <div className="flex items-center justify-between mb-1.5 text-[10px] font-mono font-bold uppercase tracking-wider">
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <Activity size={10} className="animate-spin" />
                  {status.currentTask}
                </span>
                <span className="text-zinc-500">
                  Page {status.processed} / {status.total} ({Math.round((status.processed / status.total) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden border border-zinc-900">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300" 
                  style={{ width: `${(status.processed / status.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Console Logs Output */}
          <div 
            ref={logsContainerRef}
            className="flex-1 p-5 bg-[#030303] overflow-y-auto font-mono text-[11px] leading-relaxed space-y-1.5 selection:bg-zinc-800 selection:text-white"
          >
            {status.logs.length === 0 ? (
              <div className="text-zinc-600 italic text-center py-8">No logs available.</div>
            ) : (
              status.logs.map((log, idx) => {
                let colorClass = 'text-zinc-500';
                if (log.includes('[Error]') || log.includes('Lỗi')) colorClass = 'text-red-400 font-bold';
                else if (log.includes('[Success]') || log.includes('thành công') || log.includes('hoàn tất')) colorClass = 'text-emerald-400 font-bold';
                else if (log.includes('[Scraper]') || log.includes('Đồng bộ')) colorClass = 'text-blue-400';
                else if (log.includes('Đang tải')) colorClass = 'text-amber-500';
                
                return (
                  <div key={idx} className={`whitespace-pre-wrap ${colorClass}`}>
                    {log}
                  </div>
                );
              })
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
