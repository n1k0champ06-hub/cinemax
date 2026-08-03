import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw, 
  Server, Zap, Clock, ChevronDown, ChevronUp, Copy, Check, Film, Tv, Radio
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface ApiEndpointItem {
  id: string;
  name: string;
  category: 'core' | 'streaming' | 'anime' | 'sports';
  categoryLabel: string;
  description: string;
  url: string;
  method?: 'GET' | 'POST' | 'HEAD';
  validate?: (data: any, res: Response) => boolean;
}

export interface ApiTestResult {
  id: string;
  status: 'idle' | 'testing' | 'online' | 'degraded' | 'offline';
  statusCode?: number;
  latencyMs?: number;
  itemCount?: number;
  dataSnippet?: string;
  errorMessage?: string;
  lastChecked?: string;
}

const API_LIST: ApiEndpointItem[] = [
  {
    id: 'kkphim',
    name: 'KKPhim API (Nguồn chính)',
    category: 'core',
    categoryLabel: 'Phim & Metadata',
    description: 'API danh sách phim mới, phim lẻ, phim bộ & hoạt hình Việt Nam',
    url: 'https://phimapi.com/danh-sach/phim-moi-cap-nhat?page=1',
    validate: (data) => Array.isArray(data?.items) && data.items.length > 0
  },
  {
    id: 'ophim',
    name: 'OPhim CDN (Nguồn dự phòng)',
    category: 'core',
    categoryLabel: 'Phim & Metadata',
    description: 'API máy chủ dự phòng Vietsub & Thuyết minh',
    url: 'https://ophim1.com/danh-sach/phim-moi-cap-nhat?page=1',
    validate: (data) => (Array.isArray(data?.items) || Array.isArray(data?.data?.items))
  },
  {
    id: 'tmdb',
    name: 'TMDB Metadata Proxy',
    category: 'core',
    categoryLabel: 'Phim & Metadata',
    description: 'Dữ liệu poster HD, diễn viên & thông tin phim quốc tế',
    url: 'https://focusflow.id.vn/tmdb/trending/movie/day',
    validate: (data) => Array.isArray(data?.results) || !!data?.page
  },
  {
    id: 'm3u8_proxy',
    name: 'Cloudflare Worker Proxy (HLS)',
    category: 'streaming',
    categoryLabel: 'Streaming & Proxy',
    description: 'Proxy giải mã HLS m3u8 & bypass CORS trên Cloudflare Worker',
    url: '/api/m3u8-proxy?url=https%3A%2F%2Ftest-streams.mux.dev%2Fx36xhzz%2Fx36xhzz.m3u8',
    validate: (data, res) => res.status === 200 || res.status === 206
  },
  {
    id: 'jikan',
    name: 'Jikan Anime API (MyAnimeList)',
    category: 'anime',
    categoryLabel: 'Anime & Hoạt hình',
    description: 'Cơ sở dữ liệu Hoạt hình & Anime Nhật Bản',
    url: 'https://api.jikan.moe/v4/top/anime?limit=1',
    validate: (data) => Array.isArray(data?.data) || !!data?.data
  },
  {
    id: 'anilist_proxy',
    name: 'AniList REST Router',
    category: 'anime',
    categoryLabel: 'Anime & Hoạt hình',
    description: 'Máy chủ trung gian AniMapper REST qua Worker Route',
    url: '/api/anilist?action=top-anime',
    validate: (data, res) => res.status === 200 || Array.isArray(data) || Array.isArray(data?.data)
  },
  {
    id: 'football',
    name: 'ScoreBat Football Highlights API',
    category: 'sports',
    categoryLabel: 'Thể thao & Live',
    description: 'Dữ liệu video highlight & lịch thi đấu bóng đá',
    url: 'https://www.scorebat.com/video-api/v3/feed/',
    validate: (data) => Array.isArray(data?.response) || Array.isArray(data) || !!data
  }
];

export const ApiStatusDashboard: React.FC = () => {
  const [results, setResults] = useState<Record<string, ApiTestResult>>(() => {
    const initial: Record<string, ApiTestResult> = {};
    API_LIST.forEach(api => {
      initial[api.id] = { id: api.id, status: 'idle' };
    });
    return initial;
  });

  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isGlobalTesting, setIsGlobalTesting] = useState(false);

  const testSingleApi = useCallback(async (api: ApiEndpointItem) => {
    setResults(prev => ({
      ...prev,
      [api.id]: { id: api.id, status: 'testing' }
    }));

    const startTime = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(api.url, { 
        signal: controller.signal,
        headers: { 'Accept': 'application/json, text/plain, */*' }
      });
      clearTimeout(timeoutId);
      const endTime = performance.now();
      const latencyMs = Math.round(endTime - startTime);

      let data: any = null;
      let itemCount = undefined;
      let snippet = '';

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
        if (Array.isArray(data)) itemCount = data.length;
        else if (Array.isArray(data?.items)) itemCount = data.items.length;
        else if (Array.isArray(data?.results)) itemCount = data.results.length;
        else if (Array.isArray(data?.data)) itemCount = data.data.length;
        else if (Array.isArray(data?.response)) itemCount = data.response.length;

        snippet = JSON.stringify(data).slice(0, 300);
      } else {
        const text = await response.text();
        snippet = text.slice(0, 300);
      }

      let isValid = true;
      if (api.validate) {
        isValid = api.validate(data, response);
      } else {
        isValid = response.ok;
      }

      let status: ApiTestResult['status'] = 'online';
      if (!response.ok || !isValid) {
        status = 'offline';
      } else if (latencyMs > 2000) {
        status = 'degraded';
      }

      const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      setResults(prev => ({
        ...prev,
        [api.id]: {
          id: api.id,
          status,
          statusCode: response.status,
          latencyMs,
          itemCount,
          dataSnippet: snippet,
          lastChecked: nowStr
        }
      }));
    } catch (err: any) {
      clearTimeout(timeoutId);
      const endTime = performance.now();
      const latencyMs = Math.round(endTime - startTime);
      const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      setResults(prev => ({
        ...prev,
        [api.id]: {
          id: api.id,
          status: 'offline',
          statusCode: 0,
          latencyMs,
          errorMessage: err.name === 'AbortError' ? 'Hết thời gian chờ (Timeout > 8s)' : (err.message || 'Lỗi kết nối mạng / CORS'),
          lastChecked: nowStr
        }
      }));
    }
  }, []);

  const runAllTests = useCallback(async () => {
    setIsGlobalTesting(true);
    await Promise.all(API_LIST.map(api => testSingleApi(api)));
    setIsGlobalTesting(false);
  }, [testSingleApi]);

  useEffect(() => {
    runAllTests();
  }, [runAllTests]);

  const totalApis = API_LIST.length;
  const allResults = Object.values(results) as ApiTestResult[];
  const onlineCount = allResults.filter(r => r.status === 'online').length;
  const degradedCount = allResults.filter(r => r.status === 'degraded').length;
  const offlineCount = allResults.filter(r => r.status === 'offline').length;

  const validLatencies = allResults
    .filter(r => (r.status === 'online' || r.status === 'degraded') && typeof r.latencyMs === 'number')
    .map(r => r.latencyMs as number);

  const avgLatency = validLatencies.length > 0 
    ? Math.round(validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length) 
    : 0;

  const successRate = totalApis > 0 ? Math.round(((onlineCount + degradedCount) / totalApis) * 100) : 0;

  const filteredApis = API_LIST.filter(api => {
    if (filterCategory === 'all') return true;
    return api.category === filterCategory;
  });

  const handleCopyReport = () => {
    const timeStr = new Date().toLocaleString('vi-VN');
    let reportText = `=== CINEMAX API STATUS REPORT (${timeStr}) ===\n`;
    reportText += `Trạng thái: ${successRate}% Online (${onlineCount}/${totalApis} APIs)\n`;
    reportText += `Độ trễ trung bình: ${avgLatency}ms\n\n`;

    API_LIST.forEach(api => {
      const res = results[api.id];
      const statusText = res?.status === 'online' ? '✅ ONLINE' : res?.status === 'degraded' ? '⚠️ DEGRADED' : res?.status === 'testing' ? '⏳ TESTING' : '❌ OFFLINE';
      const latencyText = res?.latencyMs ? `${res.latencyMs}ms` : 'N/A';
      reportText += `- ${api.name}: ${statusText} (${latencyText}) - Status Code: ${res?.statusCode || 'ERR'}\n`;
    });

    navigator.clipboard.writeText(reportText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="space-y-5 text-left select-text">
      {/* Overview Banner */}
      <div className="bg-gradient-to-r from-[#14141a] via-[#1a131d] to-[#14141a] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-2xl border ${
              successRate >= 80 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                : successRate >= 50 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                : 'bg-[#E50914]/10 border-[#E50914]/30 text-[#E50914]'
            }`}>
              <Activity size={24} className={isGlobalTesting ? 'animate-spin' : ''} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm sm:text-base font-black text-white uppercase tracking-wide">
                  Dashboard Trạng Thái API System
                </h4>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  successRate >= 80 ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isGlobalTesting ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
                  {isGlobalTesting ? 'Đang kiểm tra...' : `${successRate}% Hoạt động`}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                Kiểm tra thời gian thực tốc độ phản hồi và tính sẵn sàng của các máy chủ nội dung
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              onClick={handleCopyReport}
              className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-gray-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
              title="Sao chép báo cáo trạng thái"
            >
              {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{isCopied ? 'Đã chép' : 'Báo cáo'}</span>
            </button>

            <button
              onClick={runAllTests}
              disabled={isGlobalTesting}
              className="px-4 py-2 bg-[#E50914] hover:bg-[#ff2e35] disabled:opacity-50 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center gap-2 active:scale-95"
            >
              <RefreshCw size={14} className={isGlobalTesting ? 'animate-spin' : ''} />
              <span>{isGlobalTesting ? 'Đang test...' : 'Kiểm tra lại'}</span>
            </button>
          </div>
        </div>

        {/* Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/5">
          <div className="bg-black/30 border border-white/5 rounded-xl p-2.5">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Tổng số API</span>
            <div className="text-base font-black text-white mt-0.5 flex items-center gap-1.5">
              <Server size={14} className="text-blue-400" />
              <span>{totalApis} máy chủ</span>
            </div>
          </div>

          <div className="bg-black/30 border border-white/5 rounded-xl p-2.5">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Sẵn sàng / Online</span>
            <div className="text-base font-black text-emerald-400 mt-0.5 flex items-center gap-1.5">
              <CheckCircle2 size={14} />
              <span>{onlineCount} {degradedCount > 0 && <span className="text-xs text-amber-400 font-normal">(+{degradedCount} chậm)</span>}</span>
            </div>
          </div>

          <div className="bg-black/30 border border-white/5 rounded-xl p-2.5">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Độ trễ trung bình</span>
            <div className="text-base font-black text-yellow-400 mt-0.5 flex items-center gap-1.5">
              <Zap size={14} />
              <span>{avgLatency > 0 ? `${avgLatency} ms` : '---'}</span>
            </div>
          </div>

          <div className="bg-black/30 border border-white/5 rounded-xl p-2.5">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Không khả dụng</span>
            <div className={`text-base font-black mt-0.5 flex items-center gap-1.5 ${offlineCount > 0 ? 'text-[#E50914]' : 'text-gray-400'}`}>
              <XCircle size={14} />
              <span>{offlineCount} máy chủ</span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
        {[
          { id: 'all', label: 'Tất cả API', icon: <Server size={13} /> },
          { id: 'core', label: 'Phim & Metadata', icon: <Film size={13} /> },
          { id: 'streaming', label: 'Streaming & Proxy', icon: <Tv size={13} /> },
          { id: 'anime', label: 'Anime', icon: <Radio size={13} /> },
          { id: 'sports', label: 'Thể thao Live', icon: <Activity size={13} /> },
        ].map(cat => (
          <button
            key={cat.id}
            onClick={() => setFilterCategory(cat.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 border ${
              filterCategory === cat.id 
                ? 'bg-[#E50914]/15 border-[#E50914]/40 text-white' 
                : 'bg-white/[0.03] border-white/5 text-gray-400 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            {cat.icon}
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* API Endpoint Cards List */}
      <div className="space-y-3">
        {filteredApis.map(api => {
          const res = results[api.id] || { id: api.id, status: 'idle' };
          const isExpanded = expandedId === api.id;

          return (
            <div 
              key={api.id}
              className="bg-[#0f0f13] border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-all"
            >
              <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {res.status === 'testing' && (
                      <RefreshCw size={18} className="text-blue-400 animate-spin" />
                    )}
                    {res.status === 'online' && (
                      <CheckCircle2 size={18} className="text-emerald-400" />
                    )}
                    {res.status === 'degraded' && (
                      <AlertTriangle size={18} className="text-amber-400" />
                    )}
                    {res.status === 'offline' && (
                      <XCircle size={18} className="text-[#E50914]" />
                    )}
                    {res.status === 'idle' && (
                      <Clock size={18} className="text-gray-500" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h5 className="text-xs sm:text-sm font-bold text-white">{api.name}</h5>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-white/5 border border-white/5 text-gray-400">
                        {api.categoryLabel}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{api.description}</p>
                    <span className="text-[10px] font-mono text-gray-500 truncate max-w-xs sm:max-w-md block mt-1">
                      {api.url}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 border-white/5 pt-2 sm:pt-0 shrink-0">
                  {/* Status Badge & Latency */}
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {res.status === 'testing' && (
                        <span className="text-xs font-bold text-blue-400">Đang test...</span>
                      )}
                      {res.status === 'online' && (
                        <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {res.latencyMs} ms • 200 OK
                        </span>
                      )}
                      {res.status === 'degraded' && (
                        <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          {res.latencyMs} ms (Phản hồi chậm)
                        </span>
                      )}
                      {res.status === 'offline' && (
                        <span className="text-xs font-bold text-[#E50914] bg-[#E50914]/10 px-2 py-0.5 rounded border border-[#E50914]/20">
                          Lỗi / Offline
                        </span>
                      )}
                    </div>
                    {res.lastChecked && (
                      <span className="text-[10px] text-gray-500 block mt-0.5">
                        Kiểm tra lúc: {res.lastChecked}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => testSingleApi(api)}
                      disabled={res.status === 'testing'}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
                      title="Kiểm tra lại API này"
                    >
                      <RefreshCw size={14} className={res.status === 'testing' ? 'animate-spin' : ''} />
                    </button>

                    <button
                      onClick={() => setExpandedId(isExpanded ? null : api.id)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all cursor-pointer flex items-center gap-1 text-[11px] font-medium"
                    >
                      <span>Chi tiết</span>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Detailed View / JSON Payload Drawer */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="border-t border-white/5 bg-black/40 p-4 space-y-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between text-gray-400 font-mono text-[11px]">
                      <span>HTTP Status: <strong className="text-white">{res.statusCode || 'N/A'}</strong></span>
                      {res.itemCount !== undefined && (
                        <span>Dữ liệu trả về: <strong className="text-emerald-400">{res.itemCount} mục</strong></span>
                      )}
                    </div>

                    {res.errorMessage && (
                      <div className="bg-[#E50914]/10 border border-[#E50914]/20 rounded-lg p-2.5 text-[#E50914] font-mono text-[11px]">
                        Lỗi: {res.errorMessage}
                      </div>
                    )}

                    {res.dataSnippet && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Trích đoạn JSON Response</span>
                        <pre className="bg-[#050507] border border-white/5 rounded-lg p-3 text-[11px] font-mono text-emerald-300/90 overflow-x-auto whitespace-pre-wrap break-all max-h-40 custom-scrollbar">
                          {res.dataSnippet}
                        </pre>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};
