import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw, 
  Server, Zap, Clock, ChevronDown, ChevronUp, Copy, Check, Film, Tv, Radio,
  Search, ShieldCheck, Image, HardDrive, Filter, Globe, Database, ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type ApiCategory = 'core' | 'streaming' | 'cdn' | 'anime' | 'subtitles';

export interface ApiEndpointItem {
  id: string;
  name: string;
  category: ApiCategory;
  categoryLabel: string;
  description: string;
  url: string;
  method?: 'GET' | 'HEAD';
  expectedContentType?: string;
  validate?: (data: any, res: Response) => boolean;
}

export interface ApiTestResult {
  id: string;
  status: 'idle' | 'testing' | 'online' | 'degraded' | 'offline';
  statusCode?: number;
  latencyMs?: number;
  payloadSizeKB?: number;
  contentType?: string;
  itemCount?: number;
  dataSnippet?: string;
  headersSnippet?: string;
  errorMessage?: string;
  lastChecked?: string;
}

const API_LIST: ApiEndpointItem[] = [
  // 1. Core Phim APIs
  {
    id: 'kkphim_list',
    name: 'KKPhim (Danh sách phim mới)',
    category: 'core',
    categoryLabel: 'Phim & Metadata',
    description: 'Nguồn API danh sách phim mới cập nhật chính của hệ thống',
    url: 'https://phimapi.com/danh-sach/phim-moi-cap-nhat?page=1',
    validate: (data) => Array.isArray(data?.items) && data.items.length > 0
  },
  {
    id: 'kkphim_detail',
    name: 'KKPhim (Chi tiết phim & Tập)',
    category: 'core',
    categoryLabel: 'Phim & Metadata',
    description: 'API truy xuất danh sách tập, m3u8 stream & thông tin chi tiết phim',
    url: 'https://phimapi.com/phim/lay-mang',
    validate: (data) => !!data?.movie?.name || data?.status === true
  },
  {
    id: 'ophim_list',
    name: 'OPhim CDN (Nguồn phim dự phòng)',
    category: 'core',
    categoryLabel: 'Phim & Metadata',
    description: 'Nguồn máy chủ dự phòng phim Vietsub & Thuyết minh',
    url: 'https://ophim1.com/danh-sach/phim-moi-cap-nhat?page=1',
    validate: (data) => (Array.isArray(data?.items) || Array.isArray(data?.data?.items))
  },
  {
    id: 'tmdb_proxy',
    name: 'TMDB Trending & Search Proxy',
    category: 'core',
    categoryLabel: 'Phim & Metadata',
    description: 'Dữ liệu xếp hạng, diễn viên HD & điểm IMDb từ TMDB Router',
    url: 'https://focusflow.id.vn/tmdb/trending/movie/day',
    validate: (data) => Array.isArray(data?.results) || !!data?.page
  },

  // 2. Streaming & Proxy
  {
    id: 'm3u8_proxy',
    name: 'Cloudflare Worker Proxy (HLS Stream)',
    category: 'streaming',
    categoryLabel: 'Streaming & Proxy',
    description: 'Proxy giải mã luồng video HLS m3u8 & chống chặn CORS Cloudflare Worker',
    url: '/api/m3u8-proxy?url=https%3A%2F%2Ftest-streams.mux.dev%2Fx36xhzz%2Fx36xhzz.m3u8',
    validate: (data, res) => res.status === 200 || res.status === 206
  },
  {
    id: 'render_bridge',
    name: 'Render Bridge Backend Server',
    category: 'streaming',
    categoryLabel: 'Streaming & Proxy',
    description: 'Máy chủ Render Bridge xử lý giải mã stream & proxy dữ liệu phụ trợ',
    url: 'https://hollysheesh-bridge.onrender.com/ping',
    validate: (data, res) => res.status === 200 || !!data
  },

  // 3. CDN & Hình Ảnh
  {
    id: 'phimimg_cdn',
    name: 'PhimImg CDN (Máy chủ ảnh Phim Việt)',
    category: 'cdn',
    categoryLabel: 'CDN & Hình ảnh',
    description: 'Máy chủ phân giải Poster & Thumbnail phim tốc độ cao',
    url: 'https://phimimg.com/upload/vod/20240101-1/test.jpg',
    method: 'HEAD',
    validate: (_, res) => res.status === 200 || res.status === 404 || res.status === 304
  },
  {
    id: 'tmdb_img_cdn',
    name: 'TMDB Global Image CDN',
    category: 'cdn',
    categoryLabel: 'CDN & Hình ảnh',
    description: 'Mạng phân phối hình ảnh poster & backdrop phim quốc tế HD',
    url: 'https://image.tmdb.org/t/p/w500/8cdWjvZQUExWVZEWz2vQCnflvUz.jpg',
    method: 'HEAD',
    validate: (_, res) => res.status === 200 || res.status === 304
  },

  // 4. Anime & Hoạt Hình
  {
    id: 'jikan_anime',
    name: 'Jikan Anime API (MyAnimeList)',
    category: 'anime',
    categoryLabel: 'Anime & Hoạt hình',
    description: 'Cơ sở dữ liệu xếp hạng & thông tin Anime Nhật Bản chính chủ',
    url: 'https://api.jikan.moe/v4/top/anime?limit=1',
    validate: (data) => Array.isArray(data?.data) || !!data?.data
  },
  {
    id: 'anilist_proxy',
    name: 'AniList REST Router (Worker Route)',
    category: 'anime',
    categoryLabel: 'Anime & Hoạt hình',
    description: 'Máy chủ trung gian AniMapper REST giải mã Anime HD',
    url: '/api/anilist?action=top-anime',
    validate: (data, res) => res.status === 200 || Array.isArray(data) || Array.isArray(data?.data)
  },

  // 5. Phụ đề & Phụ trợ
  {
    id: 'subtitles_addon',
    name: 'Stremio OpenSubtitles Engine',
    category: 'subtitles',
    categoryLabel: 'Phụ đề & Phụ trợ',
    description: 'Máy chủ tìm kiếm phụ đề đa ngôn ngữ tự động cho trình phát',
    url: 'https://opensubtitles-v3.strem.io/manifest.json',
    validate: (data) => data?.id === 'org.stremio.opensubtitlesv3' || !!data?.name
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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'snippet' | 'headers'>('snippet');
  const [isCopied, setIsCopied] = useState(false);
  const [isGlobalTesting, setIsGlobalTesting] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

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
        method: api.method || 'GET',
        signal: controller.signal,
        headers: { 'Accept': 'application/json, text/plain, image/*, */*' }
      });
      clearTimeout(timeoutId);
      const endTime = performance.now();
      const latencyMs = Math.round(endTime - startTime);

      let data: any = null;
      let itemCount = undefined;
      let snippet = '';
      let payloadSizeKB = 0;

      const contentType = response.headers.get('content-type') || 'Unknown';
      
      // Capture key headers
      const headersObj: Record<string, string> = {};
      response.headers.forEach((val, key) => {
        if (['content-type', 'server', 'cache-control', 'access-control-allow-origin', 'date'].includes(key.toLowerCase())) {
          headersObj[key] = val;
        }
      });
      const headersSnippet = JSON.stringify(headersObj, null, 2);

      if (contentType.includes('application/json')) {
        data = await response.json();
        const jsonStr = JSON.stringify(data);
        payloadSizeKB = Math.round((jsonStr.length / 1024) * 10) / 10;

        if (Array.isArray(data)) itemCount = data.length;
        else if (Array.isArray(data?.items)) itemCount = data.items.length;
        else if (Array.isArray(data?.results)) itemCount = data.results.length;
        else if (Array.isArray(data?.data)) itemCount = data.data.length;
        else if (Array.isArray(data?.response)) itemCount = data.response.length;

        snippet = JSON.stringify(data, null, 2).slice(0, 500);
      } else {
        const text = await response.text();
        payloadSizeKB = Math.round((text.length / 1024) * 10) / 10;
        snippet = text.slice(0, 400);
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
          payloadSizeKB,
          contentType: contentType.split(';')[0],
          itemCount,
          dataSnippet: snippet,
          headersSnippet,
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
          errorMessage: err.name === 'AbortError' ? 'Hết thời gian chờ (Timeout > 8s)' : (err.message || 'Lỗi kết nối mạng / Chặn CORS'),
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

  // Auto refresh timer
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      runAllTests();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, runAllTests]);

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

  const systemGrade = useMemo(() => {
    if (successRate >= 90 && avgLatency < 600) return { grade: 'A+', label: 'Xuất Sắc', color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' };
    if (successRate >= 80) return { grade: 'A', label: 'Tốt', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' };
    if (successRate >= 65) return { grade: 'B', label: 'Khá', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' };
    return { grade: 'C', label: 'Cảnh Báo', color: 'text-[#E50914] border-[#E50914]/30 bg-[#E50914]/10' };
  }, [successRate, avgLatency]);

  const filteredApis = API_LIST.filter(api => {
    const matchesCat = filterCategory === 'all' 
      ? true 
      : filterCategory === 'issues' 
      ? results[api.id]?.status === 'offline' || results[api.id]?.status === 'degraded'
      : api.category === filterCategory;

    const matchesQuery = searchQuery.trim() === ''
      ? true
      : api.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        api.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
        api.description.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCat && matchesQuery;
  });

  const handleCopyReport = () => {
    const timeStr = new Date().toLocaleString('vi-VN');
    let reportText = `=== CINEMAX API SYSTEM MONITOR REPORT (${timeStr}) ===\n`;
    reportText += `Đánh giá hệ thống: ${systemGrade.grade} (${systemGrade.label})\n`;
    reportText += `Trạng thái: ${successRate}% Online (${onlineCount}/${totalApis} APIs operational)\n`;
    reportText += `Độ trễ trung bình: ${avgLatency} ms\n\n`;

    API_LIST.forEach(api => {
      const res = results[api.id];
      const statusText = res?.status === 'online' ? '✅ ONLINE' : res?.status === 'degraded' ? '⚠️ SLOW' : res?.status === 'testing' ? '⏳ TESTING' : '❌ OFFLINE';
      const latencyText = res?.latencyMs ? `${res.latencyMs}ms` : 'N/A';
      const sizeText = res?.payloadSizeKB ? `${res.payloadSizeKB}KB` : 'N/A';
      reportText += `- ${api.name}: ${statusText} (${latencyText}, ${sizeText}) - Status Code: ${res?.statusCode || 'ERR'}\n  URL: ${api.url}\n`;
    });

    navigator.clipboard.writeText(reportText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="space-y-5 text-left select-text font-sans">
      {/* System Health Hero Banner */}
      <div className="bg-gradient-to-r from-[#111116] via-[#191522] to-[#111116] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-[0_12px_30px_rgba(0,0,0,0.5)] relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div className="flex items-start gap-4">
            {/* System Grade Indicator Badge */}
            <div className={`w-14 h-14 rounded-2xl border-2 flex flex-col items-center justify-center shrink-0 shadow-lg ${systemGrade.color}`}>
              <span className="text-xl font-black tracking-tight leading-none">{systemGrade.grade}</span>
              <span className="text-[9px] font-bold uppercase mt-0.5 tracking-wider">{systemGrade.label}</span>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-base sm:text-lg font-black text-white uppercase tracking-wide">
                  Dashboard Giám Sát API System
                </h4>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                  successRate >= 80 ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isGlobalTesting ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
                  {isGlobalTesting ? 'Đang đo đạc...' : `${successRate}% Hoạt động (${onlineCount}/${totalApis})`}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed max-w-xl">
                Kiểm tra thời gian thực tốc độ phản hồi, băng thông payload & độ ổn định của toàn bộ máy chủ Cinemax.
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap self-start md:self-auto shrink-0">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                autoRefresh ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
              }`}
              title="Tự động kiểm tra lại mỗi 30s"
            >
              <Clock size={14} className={autoRefresh ? 'animate-spin' : ''} />
              <span>{autoRefresh ? 'Auto 30s: Bật' : 'Auto-refresh'}</span>
            </button>

            <button
              onClick={handleCopyReport}
              className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-gray-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
              title="Sao chép báo cáo trạng thái JSON/Text"
            >
              {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{isCopied ? 'Đã chép' : 'Báo cáo'}</span>
            </button>

            <button
              onClick={runAllTests}
              disabled={isGlobalTesting}
              className="px-4 py-2 bg-[#E50914] hover:bg-[#ff2e35] disabled:opacity-50 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg flex items-center gap-2 active:scale-95"
            >
              <RefreshCw size={14} className={isGlobalTesting ? 'animate-spin' : ''} />
              <span>{isGlobalTesting ? 'Đang quét...' : 'Kiểm tra tất cả'}</span>
            </button>
          </div>
        </div>

        {/* Dynamic Metric Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/5">
          <div className="bg-black/30 border border-white/5 rounded-xl p-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Tổng số Endpoints</span>
            <div className="text-base font-black text-white mt-0.5 flex items-center gap-1.5">
              <Server size={14} className="text-blue-400" />
              <span>{totalApis} dịch vụ</span>
            </div>
          </div>

          <div className="bg-black/30 border border-white/5 rounded-xl p-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Online Sẵn Sàng</span>
            <div className="text-base font-black text-emerald-400 mt-0.5 flex items-center gap-1.5">
              <CheckCircle2 size={14} />
              <span>{onlineCount} OK {degradedCount > 0 && <span className="text-xs text-amber-400 font-normal">({degradedCount} chậm)</span>}</span>
            </div>
          </div>

          <div className="bg-black/30 border border-white/5 rounded-xl p-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Độ Trễ Trung Bình</span>
            <div className="text-base font-black text-yellow-400 mt-0.5 flex items-center gap-1.5">
              <Zap size={14} />
              <span>{avgLatency > 0 ? `${avgLatency} ms` : '---'}</span>
            </div>
          </div>

          <div className="bg-black/30 border border-white/5 rounded-xl p-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Lỗi / Không Khả Dụng</span>
            <div className={`text-base font-black mt-0.5 flex items-center gap-1.5 ${offlineCount > 0 ? 'text-[#E50914]' : 'text-gray-400'}`}>
              <XCircle size={14} />
              <span>{offlineCount} máy chủ</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar & Realtime Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
          {[
            { id: 'all', label: 'Tất cả API', icon: <Server size={13} /> },
            { id: 'core', label: 'Phim & Metadata', icon: <Film size={13} /> },
            { id: 'streaming', label: 'Streaming & Proxy', icon: <Tv size={13} /> },
            { id: 'cdn', label: 'CDN Hình ảnh', icon: <Image size={13} /> },
            { id: 'anime', label: 'Anime & Hoạt hình', icon: <Radio size={13} /> },
            { id: 'subtitles', label: 'Phụ đề', icon: <Database size={13} /> },
            { id: 'issues', label: `Lỗi (${offlineCount + degradedCount})`, icon: <AlertTriangle size={13} /> },
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

        {/* Search input */}
        <div className="relative shrink-0 sm:w-60">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm tên hoặc URL..."
            className="w-full bg-[#0f0f13] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#E50914]/50 transition-all"
          />
        </div>
      </div>

      {/* API Endpoint Cards List */}
      <div className="space-y-3">
        {filteredApis.length === 0 ? (
          <div className="bg-[#0f0f13] border border-white/5 rounded-2xl p-8 text-center text-gray-400 text-xs">
            Không tìm thấy API nào phù hợp với bộ lọc tìm kiếm.
          </div>
        ) : (
          filteredApis.map(api => {
            const res = results[api.id] || { id: api.id, status: 'idle' };
            const isExpanded = expandedId === api.id;

            return (
              <div 
                key={api.id}
                className="bg-[#0f0f13] border border-white/5 rounded-2xl overflow-hidden hover:border-white/15 transition-all shadow-sm"
              >
                <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {res.status === 'testing' && (
                        <RefreshCw size={20} className="text-blue-400 animate-spin" />
                      )}
                      {res.status === 'online' && (
                        <CheckCircle2 size={20} className="text-emerald-400" />
                      )}
                      {res.status === 'degraded' && (
                        <AlertTriangle size={20} className="text-amber-400" />
                      )}
                      {res.status === 'offline' && (
                        <XCircle size={20} className="text-[#E50914]" />
                      )}
                      {res.status === 'idle' && (
                        <Clock size={20} className="text-gray-500" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h5 className="text-xs sm:text-sm font-bold text-white">{api.name}</h5>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-white/5 border border-white/5 text-gray-300">
                          {api.categoryLabel}
                        </span>
                        {res.contentType && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300">
                            {res.contentType}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{api.description}</p>
                      <a 
                        href={api.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-[10px] font-mono text-gray-500 hover:text-blue-400 truncate max-w-xs sm:max-w-md block mt-1 transition-colors flex items-center gap-1"
                      >
                        <span>{api.url}</span>
                        <ArrowUpRight size={10} />
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 border-white/5 pt-2 sm:pt-0 shrink-0">
                    {/* Status Badge & Latency & Size */}
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {res.status === 'testing' && (
                          <span className="text-xs font-bold text-blue-400 animate-pulse">Đang test...</span>
                        )}
                        {res.status === 'online' && (
                          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20">
                            {res.latencyMs} ms • {res.statusCode} OK {res.payloadSizeKB ? `(${res.payloadSizeKB}KB)` : ''}
                          </span>
                        )}
                        {res.status === 'degraded' && (
                          <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/20">
                            {res.latencyMs} ms (Chậm)
                          </span>
                        )}
                        {res.status === 'offline' && (
                          <span className="text-xs font-bold text-[#E50914] bg-[#E50914]/10 px-2.5 py-0.5 rounded-lg border border-[#E50914]/20">
                            Lỗi / Offline ({res.statusCode || 'ERR'})
                          </span>
                        )}
                      </div>
                      {res.lastChecked && (
                        <span className="text-[10px] text-gray-500 block mt-0.5">
                          Kiểm tra: {res.lastChecked}
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

                {/* Detailed View / Inspector Drawer */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="border-t border-white/5 bg-black/50 p-4 space-y-3 text-xs"
                    >
                      {/* Metric pills */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                        <div className="bg-white/5 rounded-lg p-2">
                          <span className="text-gray-400 block text-[10px]">HTTP Code</span>
                          <span className="font-mono font-bold text-white">{res.statusCode || 'N/A'}</span>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2">
                          <span className="text-gray-400 block text-[10px]">Thời gian phản hồi</span>
                          <span className="font-mono font-bold text-yellow-400">{res.latencyMs ? `${res.latencyMs} ms` : 'N/A'}</span>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2">
                          <span className="text-gray-400 block text-[10px]">Kích thước Payload</span>
                          <span className="font-mono font-bold text-emerald-400">{res.payloadSizeKB ? `${res.payloadSizeKB} KB` : 'N/A'}</span>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2">
                          <span className="text-gray-400 block text-[10px]">Mục dữ liệu (Items)</span>
                          <span className="font-mono font-bold text-blue-400">{res.itemCount !== undefined ? `${res.itemCount} phần tử` : '---'}</span>
                        </div>
                      </div>

                      {res.errorMessage && (
                        <div className="bg-[#E50914]/10 border border-[#E50914]/20 rounded-lg p-3 text-[#E50914] font-mono text-[11px] flex items-center gap-2">
                          <AlertTriangle size={15} className="shrink-0" />
                          <span>Chi tiết lỗi: {res.errorMessage}</span>
                        </div>
                      )}

                      {/* Detail tabs */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 border-b border-white/10 pb-1">
                          <button
                            onClick={() => setActiveDetailTab('snippet')}
                            className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                              activeDetailTab === 'snippet' ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            Trích đoạn Payload (JSON)
                          </button>
                          <button
                            onClick={() => setActiveDetailTab('headers')}
                            className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                              activeDetailTab === 'headers' ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            Response Headers
                          </button>
                        </div>

                        {activeDetailTab === 'snippet' && res.dataSnippet && (
                          <pre className="bg-[#050507] border border-white/10 rounded-xl p-3 text-[11px] font-mono text-emerald-300/90 overflow-x-auto whitespace-pre-wrap break-all max-h-48 custom-scrollbar">
                            {res.dataSnippet}
                          </pre>
                        )}

                        {activeDetailTab === 'headers' && res.headersSnippet && (
                          <pre className="bg-[#050507] border border-white/10 rounded-xl p-3 text-[11px] font-mono text-blue-300/90 overflow-x-auto whitespace-pre-wrap break-all max-h-48 custom-scrollbar">
                            {res.headersSnippet}
                          </pre>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
