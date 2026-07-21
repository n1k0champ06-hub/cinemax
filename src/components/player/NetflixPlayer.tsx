import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Play, Pause, RotateCcw, RotateCw, Maximize, Minimize,
  VolumeX, Volume1, Volume2, Settings, ArrowLeft,
  Loader2, Check, ChevronRight, X, List, Flag,
  Gauge, MessageSquare, SkipForward, Layers, Lock, Unlock, Server,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Hls from 'hls.js';
import { useWatchProgress } from '../../hooks/useStorage';
import { cn } from '../../lib/utils';
import { SubtitleOverlay } from './SubtitleOverlay';
import { StreamItem } from '../../api/streamProviders/types';
import { ReportModal } from '../ui/ReportModal';

// ---------------------------------------------------------------------------
// Client-side HLS Ad Blocker
// ---------------------------------------------------------------------------
function extractHostname(url) {
  try { return new URL(url).hostname; } catch { return null; }
}

function clientFilterPlaylistAds(text: string, playlistUrl: string) {
  if (!text || !text.includes('#EXTM3U')) return text;

  const AD_PATTERNS = [
    /\/v\d+\/[a-f0-9]{16,}\/segment_\d+\.ts/i,
    /\/v\d+\/.*\/segment_\d+\.ts/i,
    /\/segment_\d+\.ts/i,
    /\/v\d+\//i,
    /convertv\d*/i,
    /convert\d*/i,
    /9922/i,
    /nhacai/i,
    /cacuoc/i,
    /kubet/i,
    /shbet/i,
    /okvip/i,
    /789bet/i,
    /new88/i,
    /hi88/i,
    /jun88/i,
    /f8bet/i,
    /bk8/i,
    /w88/i,
    /fun88/i,
    /fb88/i,
    /v9bet/i,
    /ae888/i,
    /mb66/i,
    /rovideo/i,
    /rostream/i,
    /phimimg\.com\/ads/i,
    /doubleclick/i,
    /googleads/i,
    /googlesyndication/i,
    /adnxs/i,
    /adsrvr/i,
    /smartadserver/i,
    /quangcao/i,
    /banner/i,
  ];

  const lines = text.split(/\r?\n/);
  const blocks: { start: number; uriIndex: number; end: number; uri: string }[] = [];
  let blockStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line && !line.startsWith('#')) {
      blocks.push({ start: blockStart, uriIndex: i, end: i, uri: line });
      blockStart = i + 1;
    }
  }

  const removalRanges: { start: number; end: number }[] = [];

  // Pass 1: Pattern-based ad segment detection
  for (const block of blocks) {
    const norm = block.uri.toLowerCase();
    const isAd = AD_PATTERNS.some((p) => p.test(norm));
    if (isAd) {
      let start = block.uriIndex;
      for (let i = block.uriIndex - 1; i >= block.start; i--) {
        const l = lines[i].trim().toUpperCase();
        if (
          l.startsWith('#EXTINF') ||
          l.startsWith('#EXT-X-DISCONTINUITY') ||
          l.startsWith('#EXT-X-KEY') ||
          l.startsWith('#EXT-X-BYTERANGE') ||
          l === ''
        ) {
          start = i;
          continue;
        }
        break;
      }
      removalRanges.push({ start, end: block.end });
    }
  }

  // Pass 2: Foreign CDN / Discontinuity-flanked ad block detection
  if (blocks.length > 1) {
    const hostCounts = new Map<string, number>();
    for (const b of blocks) {
      const h = extractHostname(b.uri);
      if (h) hostCounts.set(h, (hostCounts.get(h) || 0) + 1);
    }
    let mainHost: string | null = null;
    let maxCount = 0;
    for (const [h, c] of hostCounts.entries()) {
      if (c > maxCount) { mainHost = h; maxCount = c; }
    }

    if (mainHost) {
      for (let bi = 0; bi < blocks.length; bi++) {
        const block = blocks[bi];
        const segHost = extractHostname(block.uri);
        if (removalRanges.some((r) => block.uriIndex >= r.start && block.uriIndex <= r.end)) continue;

        if (segHost && segHost !== mainHost) {
          let hasDiscBefore = false;
          for (let i = block.start; i < block.uriIndex; i++) {
            if (lines[i].trim().toUpperCase() === '#EXT-X-DISCONTINUITY') {
              hasDiscBefore = true;
              break;
            }
          }
          const nb = blocks[bi + 1];
          let hasDiscAfter = false;
          if (nb) {
            for (let i = block.end + 1; i < nb.uriIndex; i++) {
              if (lines[i].trim().toUpperCase() === '#EXT-X-DISCONTINUITY') {
                hasDiscAfter = true;
                break;
              }
            }
          }
          if (hasDiscBefore && hasDiscAfter) {
            let start = block.uriIndex;
            for (let i = block.uriIndex - 1; i >= block.start; i--) {
              const l = lines[i].trim().toUpperCase();
              if (l.startsWith('#EXTINF') || l === '#EXT-X-DISCONTINUITY' || l.startsWith('#EXT-X-KEY') || l === '') {
                start = i;
                continue;
              }
              break;
            }
            removalRanges.push({ start, end: block.end });
          }
        }
      }
    }
  }

  // Filter out marked lines
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!removalRanges.some((r) => i >= r.start && i <= r.end)) {
      kept.push(lines[i]);
    }
  }

  // Compact consecutive DISCONTINUITY tags
  const compacted: string[] = [];
  let prevWasDisc = false;
  for (const line of kept) {
    const isDisc = line.trim().toUpperCase() === '#EXT-X-DISCONTINUITY';
    if (isDisc && prevWasDisc) continue;
    compacted.push(line);
    prevWasDisc = isDisc;
  }

  return compacted.join('\n');
}

class AdFilteringHlsLoader extends (Hls.DefaultConfig.loader as any) {
  constructor(config: any) {
    super(config);
    const load = this.load.bind(this);
    this.load = (context: any, cfg: any, callbacks: any) => {
      const onSuccess = callbacks.onSuccess;
      callbacks.onSuccess = (response: any, stats: any, ctx: any, networkDetails: any) => {
        if ((ctx.type === 'manifest' || ctx.type === 'level') && typeof response.data === 'string') {
          try { response.data = clientFilterPlaylistAds(response.data, ctx.url); } catch {}
        }
        onSuccess(response, stats, ctx, networkDetails);
      };
      load(context, cfg, callbacks);
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
interface NetflixPlayerProps {
  url?: string;
  embedUrl?: string;
  headers?: Record<string, string>;
  subtitleUrl?: string | null;
  externalSubtitles?: any[];
  title?: string;
  slug?: string;
  episodeName?: string;
  posterUrl?: string;
  thumbUrl?: string;
  movieName?: string;
  onClose?: () => void;
  servers?: any[];
  selectedServerId?: number;
  onServerChange?: (id: number) => void;
  episodes?: any[];
  onEpisodeSelect?: (ep: any) => void;
  isTv?: boolean;
  currentSeason?: number;
  activeEpSeason?: number;
  seasons?: any[];
  onSeasonChange?: (seasonNumber: number) => void;
  tmdbEpisodes?: any[];
  streams?: StreamItem[];
  activeStream?: StreamItem | null;
  onStreamSelect?: (stream: StreamItem) => void;
  isAggregatorLoading?: boolean;
  tmdbId?: string | number;
  type?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const formatTime = (s: number) => {
  if (!isFinite(s) || isNaN(s)) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
};

const isSameEp = (a: any, b: any) => {
  if (!a || !b) return false;
  const numA = parseInt(String(a).replace(/\D/g,''));
  const numB = parseInt(String(b).replace(/\D/g,''));
  if (!isNaN(numA) && !isNaN(numB)) return numA === numB;
  return String(a).toLowerCase().trim() === String(b).toLowerCase().trim();
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const NetflixPlayer: React.FC<NetflixPlayerProps> = ({
  url, embedUrl, headers, subtitleUrl, externalSubtitles = [],
  title, slug, episodeName, posterUrl, thumbUrl, movieName, onClose,
  servers, selectedServerId, onServerChange,
  episodes = [], onEpisodeSelect,
  isTv = false, currentSeason = 1, activeEpSeason = 1,
  seasons = [], onSeasonChange, tmdbEpisodes = [],
  streams = [], activeStream = null, onStreamSelect, isAggregatorLoading = false,
  tmdbId, type,
}) => {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const containerRef= useRef<HTMLDivElement>(null);
  const hlsRef      = useRef<Hls | null>(null);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekFxRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { saveProgress } = useWatchProgress();

  const [isPlaying,    setIsPlaying]    = useState(true);
  const [currentTime,  setCurrentTime]  = useState(0);
  const [duration,     setDuration]     = useState(0);
  const [isBuffering,  setIsBuffering]  = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [isMuted,      setIsMuted]      = useState(false);
  const [volume,       setVolume]       = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [simulatedFullscreen, setSimulatedFullscreen] = useState(false);
  const [isLocked,     setIsLocked]     = useState(false);
  const [isMobile,     setIsMobile]     = useState(false);
  const [isLandscape,  setIsLandscape]  = useState(false);

  const effectiveFullscreen = isFullscreen || simulatedFullscreen;
  const isMobileFullscreenMode = isMobile && (effectiveFullscreen || isLandscape);
  const [seekFx,       setSeekFx]       = useState<{ type: 'fwd' | 'rev'; amount: number } | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [qualities,    setQualities]    = useState<{ id: number; name: string }[]>([]);
  const [activeQuality,setActiveQuality]= useState(-1);
  const [subTracks,    setSubTracks]    = useState<{ id: number; name: string }[]>([]);
  const [panelOpen,    setPanelOpen]    = useState<'none' | 'episodes' | 'settings' | 'quality' | 'speed' | 'sub'>('none');
  const [showReport,   setShowReport]   = useState(false);
  const [selectedSub,  setSelectedSub]  = useState<string | number>('off');
  const [subEnabled,   setSubEnabled]   = useState(false);
  const [subOffset,    setSubOffset]    = useState(0);
  const [failedSubs,   setFailedSubs]   = useState<Set<string>>(new Set());
  const [progressMap,  setProgressMap]  = useState<Record<string, any>>({});
  const [episodeProgressMap, setEpisodeProgressMap] = useState<Record<string, any>>({});
  const [activeSourceTab, setActiveSourceTab] = useState<'vi' | 'vip' | 'comm'>('vi');

  const resolvedUrl = useMemo(() =>
    activeStream?.type === 'hls' ? activeStream.url : url,
  [activeStream, url]);

  const resolvedEmbedUrl = useMemo(() =>
    activeStream?.type === 'embed' ? activeStream.url : embedUrl,
  [activeStream, embedUrl]);

  const isEmbed = !!resolvedEmbedUrl;

  const resolvedHeaders = useMemo(() =>
    activeStream?.headers || headers,
  [activeStream, headers]);

  const serializedHeaders = useMemo(() =>
    JSON.stringify(resolvedHeaders || {}),
  [resolvedHeaders]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const combinedSubs = useMemo(() => {
    const list = [{ id:'off', name:'Tắt phụ đề' }];
    const seen = new Set();
    if (subtitleUrl) { seen.add(subtitleUrl); list.push({ id:'v3', name:'Tiếng Việt #1' }); }
    if (externalSubtitles?.length) {
      const counts = subtitleUrl ? { vi:1 } : {};
      externalSubtitles.forEach((t,i) => {
        if (t.downloadUrl && !seen.has(t.downloadUrl) && (t.lang||'vi') === 'vi') {
          seen.add(t.downloadUrl);
          counts['vi'] = (counts['vi']||0) + 1;
          list.push({ id:`ext-${t.id||i}`, name:`Tiếng Việt #${counts['vi']}` });
        }
      });
    }
    subTracks.forEach(t => list.push({ id:t.id, name:t.name }));
    return list;
  }, [subtitleUrl, externalSubtitles, subTracks]);

  const activeSubUrl = useMemo(() => {
    if (selectedSub === 'off') return null;
    const isFailed = (u) => u ? failedSubs.has(u) : false;
    if (selectedSub === 'v3') return (!isFailed(subtitleUrl) ? subtitleUrl : null) || null;
    if (typeof selectedSub === 'string' && selectedSub.startsWith('ext-')) {
      const id = selectedSub.slice(4);
      const match = externalSubtitles?.find(t => `ext-${t.id}` === selectedSub || String(t.id) === id);
      return match && !isFailed(match.downloadUrl) ? match.downloadUrl : null;
    }
    return null;
  }, [selectedSub, subtitleUrl, externalSubtitles, failedSubs]);

  const lastSubKeyRef = useRef(null);
  useEffect(() => {
    const key = `${subtitleUrl||''}-${externalSubtitles?.length||0}`;
    if (lastSubKeyRef.current === key) return;
    lastSubKeyRef.current = key;
    setFailedSubs(new Set());
    const saved = localStorage.getItem('cinemax_sub_enabled');
    const shouldOn = saved === 'true';
    if (shouldOn && subtitleUrl) { setSelectedSub('v3'); setSubEnabled(true); }
    else if (shouldOn && externalSubtitles?.length) {
      setSelectedSub(`ext-${externalSubtitles[0].id||0}`); setSubEnabled(true);
    } else { setSelectedSub('off'); setSubEnabled(false); }
  }, [subtitleUrl, externalSubtitles, activeStream]);

  useEffect(() => {
    setCurrentTime(0); setDuration(0); setIsBuffering(true);
    if (hlsRef.current) {
      try { hlsRef.current.detachMedia(); hlsRef.current.destroy(); } catch {}
      hlsRef.current = null;
    }
    const v = videoRef.current;
    if (v) { try { v.pause(); v.currentTime = 0; v.removeAttribute('src'); v.load(); } catch {} }
  }, [episodeName]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setIsBuffering(true);

    let initialTime = 0;
    try {
      if (slug && episodeName) {
        const stored = localStorage.getItem('cinemax_progress');
        if (stored) {
          const parsed = JSON.parse(stored);
          const saved = parsed[slug];
          if (saved && saved.episodeName === episodeName && saved.currentTime > 0) {
            initialTime = Math.max(0, saved.currentTime - 2);
          }
        }
      }
    } catch {}

    const handleReady = () => {
      try { video.currentTime = initialTime; } catch {
        video.addEventListener('loadedmetadata', () => { try { video.currentTime = initialTime; } catch {} }, { once: true });
      }
      const play = video.play();
      if (play) play.catch(err => { if (err.name !== 'AbortError') setIsPlaying(false); });
      setIsBuffering(false);
    };

    let mediaRetries = 0, netRetries = 0;
    let hls = null;

    if (Hls.isSupported() && resolvedUrl) {
      const headersObj = JSON.parse(serializedHeaders);
      const isVi = activeStream?.category === 'vi';
      hls = new Hls({
        loader: AdFilteringHlsLoader as any,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 60 * 1024 * 1024,
        enableWorker: true,
        lowLatencyMode: false,
        capLevelToPlayerSize: true,
        backBufferLength: 90,
        startFragPrefetch: true,
        nudgeMaxRetry: 5,
        nudgeOffset: 0.1,
        xhrSetup: (xhr) => {
          if (headersObj) Object.entries(headersObj).forEach(([k,v]) => xhr.setRequestHeader(k, String(v)));
        },
      });
      hlsRef.current = hls;
      hls.loadSource(resolvedUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        handleReady();
        if (!hls) return;
        const lvls = hls.levels.map((lvl,i) => {
          const h = lvl.height || 0, w = lvl.width || 0;
          const name = h >= 2160 || w >= 3840 ? '4K'
            : h >= 1440 || w >= 2560 ? '2K'
            : h >= 1080 || w >= 1920 || h === 1088 || h === 608 || h === 640 ? '1080p'
            : h >= 720 || w >= 1280 || h === 540 ? '720p'
            : h >= 480 || w >= 854 ? '480p'
            : h >= 360 || w >= 640 ? '360p'
            : h ? `${h}p` : `Hộp ${i+1}`;
          return { id:i, name };
        });
        setQualities([{ id:-1, name:'Tự động' }, ...lvls]);
        setActiveQuality(hls.currentLevel);
        const subs = hls.subtitleTracks
          .map((s, i) => {
            const lang = (s.lang || s.name || '').toLowerCase();
            let name = s.name || s.lang || `Phụ đề ${i + 1}`;
            if (lang.includes('vi') || lang.includes('viet')) name = `Tiếng Việt (HLS #${i + 1})`;
            else if (lang.includes('en') || lang.includes('eng')) name = `Tiếng Anh (HLS #${i + 1})`;
            return { id: i, name, lang };
          })
          .filter(s => {
            const l = s.lang.toLowerCase();
            return l.includes('vi') || l.includes('viet') || l.includes('en') || l.includes('eng') || !s.lang;
          })
          .map(s => ({ id: s.id, name: s.name }));
        setSubTracks(subs);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
          try {
            if (video && !video.paused) {
              video.currentTime += 0.1;
            }
          } catch (_) {}
        }
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRetries < 5) { mediaRetries++; hls.recoverMediaError(); }
        else if (data.type === Hls.ErrorTypes.NETWORK_ERROR && netRetries < 5) { netRetries++; hls.startLoad(); }
      });

    } else if (video.canPlayType('application/vnd.apple.mpegurl') && resolvedUrl) {
      video.src = resolvedUrl;
      video.addEventListener('loadedmetadata', handleReady, { once: true });
    }

    return () => {
      if (video.currentTime > 0 && video.duration > 0 && slug && episodeName) {
        try {
          const stored = localStorage.getItem('cinemax_progress');
          const parsed = stored ? JSON.parse(stored) : {};
          parsed[slug] = { episodeName, currentTime: video.currentTime, duration: video.duration, savedAt: Date.now(), posterUrl: posterUrl||'', thumbUrl: thumbUrl||'', movieName: movieName||'', season: isTv ? currentSeason : undefined, tmdbId, type: type||(isTv?'series':'single') };
          localStorage.setItem('cinemax_progress', JSON.stringify(parsed));
        } catch {}
      }
      if (hls) { try { hls.detachMedia(); hls.destroy(); } catch {} hlsRef.current = null; }
      try { video.pause(); video.currentTime = 0; video.removeAttribute('src'); video.load(); } catch {}
    };
  }, [resolvedUrl, slug, episodeName, serializedHeaders, activeStream?.category]);

  useEffect(() => {
    if (!slug || !episodeName || !movieName) return;
    const save = () => {
      if (isEmbed) {
        saveProgress(slug, { episodeName, currentTime: 0, duration: 100, savedAt: Date.now(), posterUrl: posterUrl||'', thumbUrl, movieName, season: isTv ? currentSeason : undefined, tmdbId, type: type||(isTv?'series':'single') });
      } else {
        const v = videoRef.current;
        if (v && v.duration > 0) saveProgress(slug, { episodeName, currentTime: v.currentTime, duration: v.duration, savedAt: Date.now(), posterUrl: posterUrl||'', thumbUrl, movieName, season: isTv ? currentSeason : undefined, tmdbId, type: type||(isTv?'series':'single') });
      }
    };
    const id = setInterval(save, 10000);
    return () => { clearInterval(id); save(); };
  }, [slug, episodeName, posterUrl, thumbUrl, movieName, saveProgress, isTv, currentSeason, tmdbId, type, isEmbed]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrentTime(v.currentTime);
    const onDur  = () => setDuration(v.duration);
    const onPlay = () => setIsPlaying(true);
    const onPause= () => setIsPlaying(false);
    const onBuf  = () => setIsBuffering(true);
    const onCan  = () => setIsBuffering(false);
    const onVol  = () => {
      setVolume(v.volume);
      setIsMuted(v.muted);
      try {
        localStorage.setItem('cinemax_player_volume', String(v.volume));
        localStorage.setItem('cinemax_player_muted', String(v.muted));
      } catch {}
    };
    const onEnd  = () => {
      const idx = episodes.findIndex((ep) => isSameEp(ep.name, episodeName));
      if (idx !== -1 && idx < episodes.length - 1 && onEpisodeSelect) onEpisodeSelect(episodes[idx+1]);
    };
    v.addEventListener('timeupdate',     onTime);
    v.addEventListener('durationchange', onDur);
    v.addEventListener('play',           onPlay);
    v.addEventListener('pause',          onPause);
    v.addEventListener('waiting',        onBuf);
    v.addEventListener('canplay',        onCan);
    v.addEventListener('volumechange',   onVol);
    v.addEventListener('ended',          onEnd);
    return () => {
      v.removeEventListener('timeupdate',     onTime);
      v.removeEventListener('durationchange', onDur);
      v.removeEventListener('play',           onPlay);
      v.removeEventListener('pause',          onPause);
      v.removeEventListener('waiting',        onBuf);
      v.removeEventListener('canplay',        onCan);
      v.removeEventListener('volumechange',   onVol);
      v.removeEventListener('ended',          onEnd);
    };
  }, [episodes, episodeName, onEpisodeSelect]);

  useEffect(() => {
    const onChange = () => {
      const d = document as any;
      setIsFullscreen(!!(d.fullscreenElement || d.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => { document.removeEventListener('fullscreenchange', onChange); document.removeEventListener('webkitfullscreenchange', onChange); };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === 'undefined') return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const ua = navigator.userAgent.toLowerCase();
      const isMobileUA = /iphone|ipad|ipod|android|blackberry|mini|windows\sce|palm/i.test(ua);
      const isTouch = navigator.maxTouchPoints > 0;
      setIsMobile(isMobileUA || (isTouch && w < 1024) || w <= 960);
      setIsLandscape(w > h);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.subtitleTrack = (subEnabled && typeof selectedSub === 'number') ? selectedSub : -1;
  }, [subEnabled, selectedSub]);

  const resetControls = useCallback(() => {
    setShowControls(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (panelOpen === 'none') setShowControls(false);
    }, 4500);
  }, [panelOpen]);

  useEffect(() => { resetControls(); return () => { if (timerRef.current) clearTimeout(timerRef.current); }; }, [resetControls]);

  useEffect(() => {
    if (panelOpen !== 'episodes') return;
    try {
      const s = localStorage.getItem('cinemax_progress');
      if (s) setProgressMap(JSON.parse(s));
      const epS = localStorage.getItem('cinemax_episodes_progress');
      if (epS) setEpisodeProgressMap(JSON.parse(epS));
    } catch {}
  }, [panelOpen]);

  const togglePlay = useCallback((e) => {
    e?.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) { v.pause(); }
    else { const p = v.play(); if (p) p.catch(err => { if (err.name !== 'AbortError') setIsPlaying(false); }); }
  }, [isPlaying]);

  const skip = useCallback((sec: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + sec));
    
    setSeekFx(prev => {
      const type = sec > 0 ? 'fwd' : 'rev';
      if (prev && prev.type === type) {
        return { type, amount: prev.amount + 10 };
      }
      return { type, amount: 10 };
    });

    if (seekFxRef.current) clearTimeout(seekFxRef.current);
    seekFxRef.current = setTimeout(() => setSeekFx(null), 450);
    resetControls();
  }, [resetControls]);

  const toggleMute = (e) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (v) v.muted = !v.muted;
  };

  const toggleFullscreen = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const el = containerRef.current;
    if (!el) return;
    const d = document as any;
    const isFull = !!(d.fullscreenElement || d.webkitFullscreenElement || simulatedFullscreen);
    if (!isFull) {
      setSimulatedFullscreen(true);
      try {
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
        if (screen.orientation && (screen.orientation as any).lock) await (screen.orientation as any).lock('landscape').catch(()=>{});
      } catch {}
    } else {
      setSimulatedFullscreen(false);
      try {
        if (d.exitFullscreen) await d.exitFullscreen();
        else if (d.webkitExitFullscreen) await d.webkitExitFullscreen();
        if (screen.orientation?.unlock) screen.orientation.unlock();
      } catch {}
    }
  };

  const handleRate = (r: number) => {
    if (videoRef.current) videoRef.current.playbackRate = r;
    setPlaybackRate(r);
    try {
      localStorage.setItem('cinemax_playback_rate', String(r));
    } catch {}
  };

  useEffect(() => {
    try {
      const savedVol = localStorage.getItem('cinemax_player_volume');
      if (savedVol && videoRef.current) {
        const v = parseFloat(savedVol);
        videoRef.current.volume = v;
        setVolume(v);
      }

      const savedMuted = localStorage.getItem('cinemax_player_muted');
      if (savedMuted && videoRef.current) {
        const m = savedMuted === 'true';
        videoRef.current.muted = m;
        setIsMuted(m);
      }

      const savedRate = localStorage.getItem('cinemax_playback_rate');
      if (savedRate) {
        const r = parseFloat(savedRate);
        setPlaybackRate(r);
        if (videoRef.current) videoRef.current.playbackRate = r;
      }

      const savedOffset = localStorage.getItem('cinemax_sub_offset');
      if (savedOffset) setSubOffset(parseInt(savedOffset, 10));
    } catch {}
  }, []);
  const handleQuality = (id) => { if (hlsRef.current) hlsRef.current.currentLevel = id; setActiveQuality(id); };

  const handleSubChange = (id) => {
    setSelectedSub(id);
    setSubEnabled(id !== 'off');
    const isVi = activeStream?.category === 'vi';
    localStorage.setItem(isVi ? 'cinemax_sub_enabled_vi' : 'cinemax_sub_enabled_foreign', id === 'off' ? 'false' : 'true');
    if (hlsRef.current) hlsRef.current.subtitleTrack = (typeof id === 'number') ? id : -1;
  };

  const handleSeekBar = (e) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    v.currentTime = parseFloat(e.target.value);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
      const v = videoRef.current;
      switch (e.key.toLowerCase()) {
        case ' ': case 'k': e.preventDefault(); togglePlay(); break;
        case 'arrowleft': case 'j': e.preventDefault(); skip(e.key === 'ArrowLeft' ? -5 : -10); break;
        case 'arrowright': case 'l': e.preventDefault(); skip(e.key === 'ArrowRight' ? 5 : 10); break;
        case 'arrowup': e.preventDefault(); if (v) v.volume = Math.min(1, v.volume + 0.05); break;
        case 'arrowdown': e.preventDefault(); if (v) v.volume = Math.max(0, v.volume - 0.05); break;
        case 'f': case 'enter': e.preventDefault(); toggleFullscreen(e); break;
        case 'm': e.preventDefault(); if (v) v.muted = !v.muted; break;
        case '[': e.preventDefault(); setSubOffset(p => p - 250); break;
        case ']': e.preventDefault(); setSubOffset(p => p + 250); break;
        case '0': case '1': case '2': case '3': case '4': case '5': case '6': case '7': case '8': case '9':
          e.preventDefault(); if (v && v.duration) v.currentTime = v.duration * parseInt(e.key) / 10; break;
      }
      resetControls();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, skip, resetControls]);

  const lastTapRef = useRef<number>(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
  }, []);

  const handleVideoClick = (e: React.MouseEvent<HTMLVideoElement>) => {
    e.stopPropagation();
    const now = Date.now();
    const diff = now - lastTapRef.current;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;

    if (diff > 0 && diff < 300) {
      // Double tap/click detected: cancel pending single-click togglePlay
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      
      // Seek -10s on left 45%, +10s on right 55%
      if (clickX < width * 0.45) {
        skip(-10);
      } else {
        skip(10);
      }
      lastTapRef.current = now;
    } else {
      // Single tap/click: delay by 250ms to check for double tap
      lastTapRef.current = now;
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
      clickTimerRef.current = setTimeout(() => {
        if (isMobile) {
          // On Mobile, single-tap ONLY toggles UI controls visibility, NEVER pauses/plays video!
          setShowControls(prev => !prev);
        } else {
          // On Desktop PC, single-click toggles play/pause
          togglePlay();
        }
        clickTimerRef.current = null;
      }, 250);
    }
    resetControls();
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const buffered = useMemo(() => {
    const v = videoRef.current;
    if (!v || !v.buffered.length || !duration) return 0;
    return (v.buffered.end(v.buffered.length - 1) / duration) * 100;
  }, [currentTime, duration]);

  const openPanel = (p) => (e) => {
    e.stopPropagation();
    setPanelOpen(prev => prev === p ? 'none' : p);
    resetControls();
  };
  const closePanel = () => setPanelOpen('none');

  const currentEpIdx = episodes.findIndex((ep) => isSameEp(ep.name, episodeName));
  const nextEp = currentEpIdx !== -1 && currentEpIdx < episodes.length - 1 ? episodes[currentEpIdx + 1] : null;
  const activeSubLabel = combinedSubs.find(s => s.id === selectedSub)?.name ?? 'Tắt';
  const settingsPanelOpen = panelOpen === 'settings' || panelOpen === 'quality' || panelOpen === 'speed' || panelOpen === 'sub';

  return (
    <div className={cn(
      "relative w-full h-full flex flex-col bg-black overflow-hidden select-none",
      simulatedFullscreen && "fixed inset-0 z-[100] w-screen h-screen"
    )} ref={containerRef}>
      <div className="relative w-full flex-1 bg-black overflow-hidden">
        {isEmbed ? (
          <iframe
            key={resolvedEmbedUrl}
            src={resolvedEmbedUrl}
            className="w-full h-full border-0 bg-black pointer-events-auto relative z-10"
            allow="autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            playsInline
            preload="auto"
            onClick={handleVideoClick}
            onMouseMove={resetControls}
            onTouchStart={resetControls}
          />
        )}

        {activeSubUrl && subEnabled && !isEmbed && (
          <SubtitleOverlay
            subtitleUrl={activeSubUrl}
            videoRef={videoRef}
            offsetMs={subOffset}
            isControlVisible={showControls}
            onError={(u) => setFailedSubs(p => { const n = new Set(p); n.add(u); return n; })}
          />
        )}

        <AnimatePresence>
          {isBuffering && !isEmbed && (
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <Loader2 size={44} className="animate-spin text-white/70" />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showControls && !isEmbed && (
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.2 }}
              className="absolute inset-0 z-40 flex flex-col justify-between pointer-events-none"
              onMouseMove={resetControls}>
              {isLocked ? (
                /* Locked screen overlay: only show Unlock button in center */
                <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsLocked(false); resetControls(); }}
                    className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-white font-bold text-xs shadow-2xl hover:bg-black/90 active:scale-95 transition-all cursor-pointer"
                  >
                    <Lock size={16} className="text-[#E50914]" />
                    <span>Màn hình đang khóa (Bấm để mở)</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Top bar */}
                  <div className="pointer-events-none flex items-center justify-between px-4 sm:px-6 pt-3 sm:pt-4 pb-8 sm:pb-12 bg-gradient-to-b from-black/90 via-black/40 to-transparent">
                    {isMobile && isMobileFullscreenMode ? (
                      <button onClick={(e) => { e.stopPropagation(); onClose?.(); }}
                        className="pointer-events-auto w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-all cursor-pointer hover:scale-105 active:scale-95" title="Trở về">
                        <ArrowLeft size={20} className="text-white" />
                      </button>
                    ) : isMobile ? <div className="w-8" /> : null}

                    <div className="pointer-events-auto flex-1 text-center px-3 min-w-0">
                      <p className="text-white text-xs sm:text-base font-bold truncate tracking-wide">
                        {movieName || title}
                        {isTv && episodeName ? ` • Tập ${episodeName}` : ''}
                      </p>
                    </div>

                    {isMobile && isMobileFullscreenMode ? (
                      <button onClick={(e) => { e.stopPropagation(); setIsLocked(true); setPanelOpen('none'); resetControls(); }}
                        className="pointer-events-auto p-2 rounded-full hover:bg-white/10 transition-all cursor-pointer text-white hover:scale-110 active:scale-95"
                        title="Khóa màn hình">
                        <Lock size={20} />
                      </button>
                    ) : isMobile ? <div className="w-8" /> : null}
                  </div>

                  {/* Center controls (Netflix Style) */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-6 sm:gap-12 md:gap-16 z-50">
                    {/* Left button (-10s) */}
                    <div className="relative flex items-center justify-center">
                      <button onClick={(e) => { e.stopPropagation(); skip(-10); }}
                        className="pointer-events-auto text-white hover:text-white/80 transition-all transform hover:scale-110 active:scale-90 cursor-pointer drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] p-1.5 relative flex items-center justify-center"
                        title="Tua lùi 10 giây">
                        <RotateCcw className="w-6 h-6 sm:w-9 sm:h-9 md:w-11 md:h-11 text-white stroke-[1.8]" />
                        <span className="absolute text-[7px] sm:text-[10px] font-black text-white pointer-events-none select-none">10</span>
                      </button>

                      <AnimatePresence>
                        {seekFx?.type === 'rev' && (
                          <motion.span
                            key={`rev-${seekFx.amount}`}
                            initial={{ opacity: 1, x: 0 }}
                            animate={{ opacity: 0, x: -20 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.38, ease: "easeOut" }}
                            className="absolute right-full mr-1 text-white font-extrabold text-xs sm:text-sm md:text-base pointer-events-none select-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] whitespace-nowrap"
                          >
                            -{seekFx.amount}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Center Play/Pause button */}
                    <button onClick={(e) => { e.stopPropagation(); togglePlay(e); }}
                      className="pointer-events-auto text-white hover:text-white/80 transition-all transform hover:scale-110 active:scale-90 cursor-pointer drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] p-1.5"
                      title={isPlaying ? "Tạm dừng" : "Phát"}>
                      {isPlaying ? (
                        <Pause className="w-9 h-9 sm:w-14 sm:h-14 md:w-18 md:h-18 fill-white text-white" />
                      ) : (
                        <Play className="w-9 h-9 sm:w-14 sm:h-14 md:w-18 md:h-18 fill-white text-white ml-0.5" />
                      )}
                    </button>

                    {/* Right button (+10s) */}
                    <div className="relative flex items-center justify-center">
                      <button onClick={(e) => { e.stopPropagation(); skip(10); }}
                        className="pointer-events-auto text-white hover:text-white/80 transition-all transform hover:scale-110 active:scale-90 cursor-pointer drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] p-1.5 relative flex items-center justify-center"
                        title="Tua tới 10 giây">
                        <RotateCw className="w-6 h-6 sm:w-9 sm:h-9 md:w-11 md:h-11 text-white stroke-[1.8]" />
                        <span className="absolute text-[7px] sm:text-[10px] font-black text-white pointer-events-none select-none">10</span>
                      </button>

                      <AnimatePresence>
                        {seekFx?.type === 'fwd' && (
                          <motion.span
                            key={`fwd-${seekFx.amount}`}
                            initial={{ opacity: 1, x: 0 }}
                            animate={{ opacity: 0, x: 20 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.38, ease: "easeOut" }}
                            className="absolute left-full ml-1 text-white font-extrabold text-xs sm:text-sm md:text-base pointer-events-none select-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] whitespace-nowrap"
                          >
                            +{seekFx.amount}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Bottom control bar with scrim gradient */}
                  {(isMobile && !isMobileFullscreenMode) ? (
                    /* Windowed Mode (!isMobileFullscreenMode) — YouTube Style Minimalist Layout */
                    <div className="pointer-events-none absolute bottom-0 inset-x-0 flex flex-col justify-end px-3 pb-0 pt-8 bg-gradient-to-t from-black/95 via-black/60 to-transparent z-40">
                      {/* Top row: Time counter (Left) & Only 3 essential buttons (Right: Sub, Settings, Fullscreen) */}
                      <div className="pointer-events-auto flex items-center justify-between px-1 mb-1.5">
                        <span className="text-white/80 text-[11px] font-mono tabular-nums font-medium select-none">
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </span>

                        <div className="flex items-center gap-1">
                          {!isEmbed && (
                            <button onClick={() => setPanelOpen('sub')}
                              className={`p-1.5 rounded-md transition-colors cursor-pointer ${panelOpen === 'sub' ? 'text-[#E50914] bg-white/10' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
                              title="Phụ đề">
                              <span className="font-bold text-[9px] leading-none px-1 py-[1.5px] border border-current/80 rounded-[3px] select-none inline-flex items-center justify-center font-sans tracking-wide">
                                CC
                              </span>
                            </button>
                          )}

                          <button onClick={openPanel('settings')}
                            className={`p-1.5 rounded-md transition-colors cursor-pointer ${(panelOpen === 'settings' || panelOpen === 'quality') ? 'text-[#E50914] bg-white/10' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
                            title="Nguồn phát & Cài đặt">
                            <Settings size={16} />
                          </button>

                          <button onClick={toggleFullscreen}
                            className="p-1.5 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                            title="Toàn màn hình">
                            <Maximize size={16} />
                          </button>
                        </div>
                      </div>

                      {/* YouTube-style Seekbar pinned to VERY BOTTOM EDGE (bottom-0) below subtitles */}
                      {!isEmbed && (
                        <div className="pointer-events-auto relative w-full h-3 flex items-center group/seek cursor-pointer">
                          <div className="absolute left-0 h-1 group-hover/seek:h-1.5 bg-white/20 rounded-full transition-all duration-150" style={{ width: `${buffered}%` }} />
                          <div className="absolute left-0 h-1 group-hover/seek:h-1.5 bg-[#E50914] rounded-full transition-all duration-150 pointer-events-none" style={{ width: `${progress}%` }}>
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#E50914] shadow-[0_0_8px_#E50914] opacity-0 group-hover/seek:opacity-100 transition-all" />
                          </div>
                          <div className="absolute left-0 right-0 h-1 group-hover/seek:h-1.5 bg-white/10 rounded-full -z-10 transition-all duration-150" />
                          <input type="range" min="0" max={duration || 0} step="0.5" value={currentTime}
                            onChange={handleSeekBar} onClick={e => e.stopPropagation()}
                            className="absolute inset-0 w-full opacity-0 cursor-pointer h-full z-10" />
                        </div>
                      )}
                    </div>
                  ) : isMobile && isMobileFullscreenMode ? (
                    /* Mobile Fullscreen Mode — Netflix Mobile Layout */
                    <div className="pointer-events-none flex flex-col gap-2 px-3 sm:px-6 pb-3 sm:pb-5 pt-10 bg-gradient-to-t from-black/95 via-black/75 to-transparent z-40">
                      {/* Seek bar with remaining time on far right */}
                      {!isEmbed && (
                        <div className="pointer-events-auto flex items-center gap-3 w-full">
                          <div className="relative flex-1 h-3 flex items-center group/seek cursor-pointer">
                            <div className="absolute left-0 h-1 group-hover/seek:h-1.5 bg-white/20 rounded-full transition-all duration-150" style={{ width: `${buffered}%` }} />
                            <div className="absolute left-0 h-1 group-hover/seek:h-1.5 bg-[#E50914] rounded-full transition-all duration-150 pointer-events-none" style={{ width: `${progress}%` }}>
                              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 rounded-full bg-[#E50914] shadow-[0_0_8px_#E50914] transition-all" />
                            </div>
                            <div className="absolute left-0 right-0 h-1 group-hover/seek:h-1.5 bg-white/10 rounded-full -z-10 transition-all duration-150" />
                            <input type="range" min="0" max={duration || 0} step="0.5" value={currentTime}
                              onChange={handleSeekBar} onClick={e => e.stopPropagation()}
                              className="absolute inset-0 w-full opacity-0 cursor-pointer h-full z-10" />
                          </div>
                          <span className="text-white/90 text-xs sm:text-sm font-mono tabular-nums font-medium shrink-0 select-none">
                            {formatTime(Math.max(0, duration - currentTime))}
                          </span>
                        </div>
                      )}

                      {/* 5 Mobile Fullscreen Buttons — Evenly distributed across bottom */}
                      <div className="pointer-events-auto flex items-center justify-between sm:justify-evenly gap-1.5 w-full pt-1 overflow-x-auto scrollbar-hide">
                        {!isEmbed && (
                          <button onClick={() => setPanelOpen('speed')}
                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${panelOpen === 'speed' ? 'text-[#E50914] bg-white/10' : 'text-white/80 hover:text-white'}`}
                            title="Tốc độ phát">
                            <Gauge size={16} />
                            <span>Tốc độ ({playbackRate}x)</span>
                          </button>
                        )}

                        {isTv && episodes.length > 0 && (
                          <button onClick={openPanel('episodes')}
                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${panelOpen === 'episodes' ? 'text-[#E50914] bg-white/10' : 'text-white/80 hover:text-white'}`}
                            title="Các tập phim">
                            <Layers size={16} />
                            <span>Các tập</span>
                          </button>
                        )}

                        {!isEmbed && (
                          <button onClick={() => setPanelOpen('sub')}
                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${panelOpen === 'sub' ? 'text-[#E50914] bg-white/10' : 'text-white/80 hover:text-white'}`}
                            title="Âm thanh và phụ đề">
                            <span className="font-bold text-[9px] leading-none px-1 py-[1.5px] border border-current/80 rounded-[3px] select-none inline-flex items-center justify-center font-sans tracking-wide shrink-0">
                              CC
                            </span>
                            <span>Âm thanh & Phụ đề</span>
                          </button>
                        )}

                        <button onClick={openPanel('settings')}
                          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${(panelOpen === 'settings' || panelOpen === 'quality') ? 'text-[#E50914] bg-white/10' : 'text-white/80 hover:text-white'}`}
                          title="Nguồn phát">
                          <Server size={16} />
                          <span>Nguồn phát</span>
                        </button>

                        {isTv && nextEp && (
                          <button onClick={(e) => { e.stopPropagation(); onEpisodeSelect?.(nextEp); }}
                            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold text-white/80 hover:text-white transition-colors cursor-pointer shrink-0"
                            title="Tập tiếp theo">
                            <SkipForward size={16} />
                            <span>Tập tiếp theo</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Fullscreen Mode or Desktop View — Netflix Layout */
                    <div className="pointer-events-none flex flex-col gap-0 px-3 sm:px-6 pb-3 sm:pb-5 pt-10 sm:pt-16 bg-gradient-to-t from-black/95 via-black/70 to-transparent z-40">
                      {/* Seek bar */}
                      {!isEmbed && (
                        <div className="pointer-events-auto relative w-full h-4 sm:h-5 flex items-center group/seek mb-1 cursor-pointer">
                          <div className="absolute left-0 h-1 group-hover/seek:h-2 bg-white/20 rounded-full transition-all duration-150" style={{ width: `${buffered}%` }} />
                          <div className="absolute left-0 h-1 group-hover/seek:h-2 bg-[#E50914] rounded-full transition-all duration-150 pointer-events-none" style={{ width: `${progress}%` }}>
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-[#E50914] shadow-[0_0_10px_#E50914] opacity-0 group-hover/seek:opacity-100 transition-all transform group-hover/seek:scale-110" />
                          </div>
                          <div className="absolute left-0 right-0 h-1 group-hover/seek:h-2 bg-white/10 rounded-full -z-10 transition-all duration-150" />
                          <input type="range" min="0" max={duration || 0} step="0.5" value={currentTime}
                            onChange={handleSeekBar} onClick={e => e.stopPropagation()}
                            className="absolute inset-0 w-full opacity-0 cursor-pointer h-full z-10" />
                        </div>
                      )}

                      {/* Button row - Horizontal Layout */}
                      <div className="pointer-events-auto flex items-center justify-between gap-1 sm:gap-2 mt-1">
                        {!isEmbed ? (
                          <div className="flex items-center gap-2 sm:gap-4">
                            <button onClick={togglePlay} className="p-1 hover:scale-110 active:scale-95 transition-transform cursor-pointer" title={isPlaying ? "Tạm dừng" : "Phát"}>
                              {isPlaying ? <Pause size={20} className="text-white" /> : <Play size={20} className="text-white" fill="white" />}
                            </button>

                            <div className="group/vol flex items-center gap-1">
                              <button onClick={toggleMute} className="p-1 hover:scale-110 active:scale-95 transition-all cursor-pointer" title="Âm lượng">
                                {isMuted || volume === 0 ? <VolumeX size={18} className="text-white/80" />
                                  : volume < 0.5 ? <Volume1 size={18} className="text-white/80" />
                                  : <Volume2 size={18} className="text-white/80" />}
                              </button>
                              <input type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume}
                                onChange={(e) => { const v = parseFloat(e.target.value); if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = v === 0; } }}
                                onClick={e => e.stopPropagation()}
                                className="w-0 opacity-0 group-hover/vol:w-16 sm:group-hover/vol:w-20 group-hover/vol:opacity-100 transition-[width,opacity] duration-200 accent-[#E50914] h-1 cursor-pointer" />
                            </div>

                            <span className="text-white/70 text-[11px] sm:text-xs font-mono tabular-nums">
                              {formatTime(currentTime)} / {formatTime(duration)}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-white/40 text-[10px] sm:text-xs font-semibold uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded border border-white/5">
                              Nguồn nhúng
                            </span>
                          </div>
                        )}

                        {/* Center/Right Distributed Actions */}
                        <div className="flex items-center gap-1.5 sm:gap-3 md:gap-4 overflow-x-auto scrollbar-hide py-1">
                          {!isEmbed && (
                            <button onClick={() => setPanelOpen('speed')}
                              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] sm:text-xs font-medium transition-all cursor-pointer ${panelOpen === 'speed' ? 'text-[#E50914] bg-white/10' : 'text-white/80 hover:text-white hover:bg-white/5'}`}
                              title="Tốc độ phát">
                              <Gauge size={15} />
                              <span className="hidden xs:inline">Tốc độ ({playbackRate}x)</span>
                              <span className="xs:hidden">{playbackRate}x</span>
                            </button>
                          )}

                          {isTv && episodes.length > 0 && (
                            <button onClick={openPanel('episodes')}
                              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] sm:text-xs font-medium transition-all cursor-pointer ${panelOpen === 'episodes' ? 'text-[#E50914] bg-white/10' : 'text-white/80 hover:text-white hover:bg-white/5'}`}
                              title="Các tập phim">
                              <Layers size={15} />
                              <span>Các tập</span>
                            </button>
                          )}

                          {!isEmbed && (
                            <button onClick={() => setPanelOpen('sub')}
                              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] sm:text-xs font-medium transition-all cursor-pointer ${panelOpen === 'sub' ? 'text-[#E50914] bg-white/10' : 'text-white/80 hover:text-white hover:bg-white/5'}`}
                              title="Phụ đề">
                              <span className="font-bold text-[9px] leading-none px-1 py-[1.5px] border border-current/80 rounded-[3px] select-none inline-flex items-center justify-center font-sans tracking-wide">
                                CC
                              </span>
                              <span className="hidden sm:inline">Phụ đề</span>
                            </button>
                          )}

                          {isTv && nextEp && (
                            <button onClick={(e) => { e.stopPropagation(); onEpisodeSelect?.(nextEp); }}
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] sm:text-xs font-medium text-white/80 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                              title="Tập tiếp theo">
                              <SkipForward size={15} />
                              <span className="hidden sm:inline">Tập tiếp</span>
                            </button>
                          )}

                          {/* Settings / Stream Sources button */}
                          <button onClick={openPanel('settings')}
                            className={`p-1.5 rounded-md hover:bg-white/10 transition-all cursor-pointer ${(panelOpen === 'settings' || panelOpen === 'quality') ? 'text-[#E50914]' : 'text-white/80 hover:text-white'}`}
                            title="Cài đặt & Nguồn phát">
                            <Settings size={18} />
                          </button>

                          {/* Fullscreen button */}
                          <button onClick={toggleFullscreen} className="p-1.5 rounded-md hover:bg-white/10 transition-all cursor-pointer text-white/80 hover:text-white" title="Toàn màn hình">
                            {effectiveFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      {/* Mobile Fullscreen Audio & Subtitles Panel (Matching Netflix Mobile UI Screenshot 1) */}
      <AnimatePresence>
        {isMobile && panelOpen === 'sub' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] bg-black/95 p-4 sm:p-8 flex flex-col justify-between overflow-hidden"
            onClick={e => e.stopPropagation()}>
            
            {/* 2-Column Split Body */}
            <div className="flex-1 grid grid-cols-2 gap-6 sm:gap-12 pt-2 pb-3 overflow-hidden min-h-0">
              {/* Left Column: Âm thanh (Nguồn phát HLS / Thuyết minh / Lồng tiếng) */}
              <div className="flex flex-col min-h-0 overflow-hidden">
                <h3 className="text-lg sm:text-xl font-bold text-white mb-4 tracking-wide shrink-0">Âm thanh</h3>
                <div className="space-y-2.5 overflow-y-auto custom-scrollbar pr-2 flex-1">
                  {(() => {
                    const formatAudioName = (s: any, idx: number) => {
                      if (!s) return 'Ngôn ngữ gốc [Gốc]';
                      const label = (s.providerLabel || s.label || s.name || s.provider || '').toLowerCase();
                      const lang = (s.lang || '').toLowerCase();
                      
                      // 1. CHỈ KHI luồng HLS/nguồn có chứa từ khóa thuyết minh / lồng tiếng thì mới được hiện Tiếng Việt
                      const isVietDub = label.includes('thuyết minh') || label.includes('thuyet minh') ||
                                        label.includes('lồng tiếng') || label.includes('long tieng') ||
                                        label.includes('lồng tiếng việt') || label.includes('thuyết minh việt');

                      if (isVietDub) {
                        if (label.includes('thuyết minh') || label.includes('thuyet minh')) return 'Tiếng Việt [Thuyết minh]';
                        if (label.includes('lồng tiếng') || label.includes('long tieng')) return 'Tiếng Việt [Lồng tiếng]';
                        return 'Tiếng Việt';
                      }

                      // 2. Nếu là nguồn phim sản xuất tại Việt Nam:
                      if (label.includes('phim việt') || label.includes('phim viet')) return 'Tiếng Việt [Gốc]';

                      // 3. Phim Nhật (Anime), Hàn, Anh, Mỹ:
                      if (lang === 'ja' || label.includes('japanese') || label.includes('anime')) {
                        return idx === 0 ? 'Tiếng Nhật [Gốc]' : `Tiếng Nhật (Server ${idx + 1})`;
                      }
                      if (lang === 'ko' || label.includes('korean')) {
                        return idx === 0 ? 'Tiếng Hàn [Gốc]' : `Tiếng Hàn (Server ${idx + 1})`;
                      }
                      if (lang === 'en' || label.includes('english')) {
                        return idx === 0 ? 'Tiếng Anh [Gốc]' : `Tiếng Anh (Server ${idx + 1})`;
                      }

                      // 4. Mặc định là Ngôn ngữ gốc [Gốc]
                      return idx === 0 ? 'Ngôn ngữ gốc [Gốc]' : `Ngôn ngữ gốc (Server ${idx + 1})`;
                    };

                    // CHỈ lọc các nguồn phim HLS (loại bỏ các nguồn embed iframe 3rd party không can thiệp được)
                    const hlsStreamsOnly = (streams && streams.length > 0)
                      ? streams.filter((s: any) => s.type !== 'embed' && s.type !== 'iframe')
                      : [];

                    const rawList = (hlsStreamsOnly.length > 0)
                      ? hlsStreamsOnly.map((s: any, idx: number) => ({
                          ...s,
                          displayName: formatAudioName(s, idx)
                        }))
                      : [
                          { displayName: 'Ngôn ngữ gốc [Gốc]', url: url },
                        ];

                    const seenNames = new Set<string>();
                    const audioList = rawList.filter((item: any) => {
                      if (seenNames.has(item.displayName)) return false;
                      seenNames.add(item.displayName);
                      return true;
                    });

                    return audioList.map((s: any, idx: number) => {
                      const isActive = activeStream
                        ? (activeStream.providerLabel === s.providerLabel && activeStream.url === s.url)
                        : idx === 0;

                      return (
                        <button key={idx} onClick={() => s.url && onStreamSelect?.(s)}
                          className={`flex items-center gap-3 text-left w-full cursor-pointer py-2 px-3 rounded-xl transition-all group ${isActive ? 'bg-white/10 border border-white/20' : 'hover:bg-white/5'}`}>
                          <Check size={18} className={isActive ? "text-[#E50914] opacity-100" : "opacity-0"} />
                          <span className={`text-sm sm:text-base truncate ${isActive ? 'text-white font-bold' : 'text-white/70 group-hover:text-white'}`}>
                            {s.displayName}
                          </span>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Right Column: Phụ đề */}
              <div className="flex flex-col min-h-0 overflow-hidden">
                <h3 className="text-lg sm:text-xl font-bold text-white mb-4 tracking-wide shrink-0">Phụ đề</h3>
                <div className="space-y-2.5 overflow-y-auto custom-scrollbar pr-2 flex-1">
                  {combinedSubs.map(s => {
                    const isActive = selectedSub === s.id;
                    return (
                      <button key={String(s.id)} onClick={() => handleSubChange(s.id)}
                        className={`flex items-center gap-3 text-left w-full cursor-pointer py-2 px-3 rounded-xl transition-all group ${isActive ? 'bg-white/10 border border-white/20' : 'hover:bg-white/5'}`}>
                        <Check size={18} className={isActive ? "text-[#E50914] opacity-100" : "opacity-0"} />
                        <span className={`text-sm sm:text-base ${isActive ? 'text-white font-bold' : 'text-white/70 group-hover:text-white'}`}>
                          {s.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Sticky Fixed Footer Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 pb-1 border-t border-white/10 shrink-0 sticky bottom-0 bg-black/95 z-30">
              <button onClick={closePanel} className="px-6 py-2 rounded-full bg-neutral-800 text-white text-xs sm:text-sm font-bold hover:bg-neutral-700 active:scale-95 transition-all cursor-pointer shadow-md">
                Hủy
              </button>
              <button onClick={closePanel} className="px-6 py-2 rounded-full bg-white text-black text-xs sm:text-sm font-bold hover:bg-white/90 active:scale-95 transition-all cursor-pointer shadow-md">
                Áp dụng
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings / Quality / Speed / Subtitle Panel */}
      <AnimatePresence>
        {settingsPanelOpen && (panelOpen !== 'sub' || !isMobile) && (
          <>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration: 0.12 }}
              className="fixed inset-0 z-50 bg-black/50" onClick={closePanel} />
            <motion.div
              initial={isMobile ? { opacity: 0, scale: 0.95 } : { scale: 0.96, opacity: 0, y: 6 }}
              animate={isMobile ? { opacity: 1, scale: 1 } : { scale: 1, opacity: 1, y: 0 }}
              exit={isMobile ? { opacity: 0, scale: 0.95 } : { scale: 0.96, opacity: 0, y: 6 }}
              transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "z-[100] bg-[#0a0a0d]/95 backdrop-blur-2xl border border-white/15 flex flex-col shadow-[0_20px_60px_rgba(0,0,0,0.85)] overflow-hidden transform-gpu will-change-transform",
                isMobile
                  ? "fixed inset-0 w-full h-full rounded-0 border-0 p-6 flex flex-col justify-between"
                  : cn(
                      "absolute bottom-16 rounded-2xl shadow-2xl transition-all duration-200",
                      panelOpen === 'speed' && "right-32 sm:right-48 w-60 sm:w-68 max-h-[48vh]",
                      panelOpen === 'sub' && "right-12 sm:right-28 w-[360px] sm:w-[420px] max-h-[55vh]",
                      panelOpen === 'settings' && "right-4 sm:right-10 w-[320px] sm:w-[380px] max-h-[55vh]"
                    )
              )}
              onClick={e => e.stopPropagation()}>

              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.06] shrink-0 sticky top-0 z-20 bg-[#0a0a0c]/98 backdrop-blur-md">
                {panelOpen !== 'settings' && panelOpen !== 'sub' && (
                  <button onClick={() => setPanelOpen('settings')} className="p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer">
                    <ArrowLeft size={16} className="text-white/70" />
                  </button>
                )}
                <h3 className="text-sm font-bold text-white/90 uppercase tracking-wider flex-1">
                  {panelOpen === 'settings' && 'Nguồn phát'}
                  {panelOpen === 'quality'  && 'Chất lượng'}
                  {panelOpen === 'speed'    && 'Tốc độ phát'}
                  {panelOpen === 'sub'      && 'Âm thanh & Phụ đề'}
                </h3>
                <button onClick={closePanel} className="p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer">
                  <X size={16} className="text-white/60" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {panelOpen === 'settings' && (
                  <>


                    {selectedSub !== 'off' && subEnabled && (
                      <div className="px-5 py-3.5 border-b border-white/10">
                        <p className="text-xs text-white/40 mb-2 font-medium">Bù trừ phụ đề</p>
                        <div className="flex items-center justify-between gap-2.5 bg-white/[0.03] p-2 rounded-xl border border-white/[0.05]">
                          <button 
                            onClick={() => setSubOffset(p => p - 250)} 
                            className="px-3 py-2 bg-white/[0.06] hover:bg-white/12 active:scale-95 rounded-lg text-xs font-bold text-white shrink-0 cursor-pointer transition-all border border-white/5"
                          >
                            −0.25s
                          </button>
                          <span className={`flex-1 text-center text-xs sm:text-sm font-mono font-bold px-1 truncate ${subOffset === 0 ? 'text-white/30' : 'text-emerald-400'}`}>
                            {subOffset >= 0 ? '+' : ''}{(subOffset / 1000).toFixed(2)}s
                          </span>
                          <button 
                            onClick={() => setSubOffset(p => p + 250)} 
                            className="px-3 py-2 bg-white/[0.06] hover:bg-white/12 active:scale-95 rounded-lg text-xs font-bold text-white shrink-0 cursor-pointer transition-all border border-white/5"
                          >
                            +0.25s
                          </button>
                        </div>
                        {subOffset !== 0 && (
                          <button onClick={() => setSubOffset(0)} className="mt-2 w-full text-xs text-white/30 hover:text-white/60 transition-colors cursor-pointer text-center">Reset delay</button>
                        )}
                      </div>
                    )}

                    {((servers && servers.length > 0) || (streams && streams.length > 0)) && (
                      <div className="flex flex-col flex-1 p-5 overflow-hidden">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Nguồn Phát</h3>
                        
                        {/* Tab Headers */}
                        {(() => {
                          const viStreams = streams?.filter(s => s.category === 'vi' || s.lang === 'vi').sort((a, b) => (b.score || 0) - (a.score || 0)) || [];
                          const premiumStreams = streams?.filter(s => s.category === 'premium' && s.lang !== 'vi').sort((a, b) => (b.score || 0) - (a.score || 0)) || [];
                          const commStreams = streams?.filter(s => (s.category === 'standard' || s.category === 'free' || !s.category) && s.lang !== 'vi').sort((a, b) => (b.score || 0) - (a.score || 0)) || [];

                          // Check active tab validity
                          let currentTab = activeSourceTab;
                          if (currentTab === 'vi' && viStreams.length === 0) {
                            if (premiumStreams.length > 0) currentTab = 'vip';
                            else if (commStreams.length > 0) currentTab = 'comm';
                          } else if (currentTab === 'vip' && premiumStreams.length === 0) {
                            if (viStreams.length > 0) currentTab = 'vi';
                            else if (commStreams.length > 0) currentTab = 'comm';
                          } else if (currentTab === 'comm' && commStreams.length === 0) {
                            if (viStreams.length > 0) currentTab = 'vi';
                            else if (premiumStreams.length > 0) currentTab = 'vip';
                          }

                          const activeList = currentTab === 'vi' ? viStreams : currentTab === 'vip' ? premiumStreams : commStreams;

                          return (
                            <>
                              <div className="flex gap-2 mb-4 border-b border-white/10 pb-2">
                                {viStreams.length > 0 && (
                                  <button onClick={() => setActiveSourceTab('vi')}
                                    className={`tab-btn text-xs font-medium pb-2 px-2.5 transition-all cursor-pointer ${currentTab === 'vi' ? 'text-white font-bold border-b-2 border-[#E50914]' : 'text-gray-400 hover:text-white'}`}>
                                    Việt Nam ({viStreams.length})
                                  </button>
                                )}
                                {premiumStreams.length > 0 && (
                                  <button onClick={() => setActiveSourceTab('vip')}
                                    className={`tab-btn text-xs font-medium pb-2 px-2.5 transition-all cursor-pointer ${currentTab === 'vip' ? 'text-yellow-400 font-bold border-b-2 border-yellow-500' : 'text-gray-400 hover:text-white'}`}>
                                    VIP ({premiumStreams.length})
                                  </button>
                                )}
                                {commStreams.length > 0 && (
                                  <button onClick={() => setActiveSourceTab('comm')}
                                    className={`tab-btn text-xs font-medium pb-2 px-2.5 transition-all cursor-pointer ${currentTab === 'comm' ? 'text-white font-bold border-b-2 border-white' : 'text-gray-400 hover:text-white'}`}>
                                    Cộng Đồng ({commStreams.length})
                                  </button>
                                )}
                              </div>

                              {/* Source List */}
                              <div className="source-list overflow-y-auto space-y-2 pr-1 custom-scrollbar max-h-[340px]">
                                {activeList.map((s, idx) => {
                                  const isActive = activeStream?.providerLabel === s.providerLabel && activeStream?.url === s.url;
                                  return (
                                    <div key={`source-${currentTab}-${idx}`} onClick={() => onStreamSelect?.(s)}
                                      className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${isActive ? 'bg-white/10 border-[#E50914] shadow-[0_0_12px_rgba(229,9,20,0.25)]' : 'bg-white/5 border-transparent hover:border-white/20 hover:bg-white/10'}`}>
                                      <div className="flex flex-col min-w-0 pr-2">
                                        <div className="flex items-center gap-2">
                                          {isActive && <Check size={13} className="text-[#E50914] shrink-0" />}
                                          <span className={`text-xs font-semibold truncate ${isActive ? 'text-white font-bold' : 'text-white/90'}`}>{s.providerLabel || 'Nguồn phát'}</span>
                                        </div>
                                        <span className="text-[10px] text-gray-400 mt-0.5">{currentTab === 'vi' ? 'Nguồn Tiếng Việt' : currentTab === 'vip' ? 'Nguồn VIP Chất Lượng' : 'Nguồn Cộng Đồng'}</span>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        {s.quality && <span className="bg-white/10 text-white/70 text-[10px] px-2 py-0.5 rounded font-mono">{s.quality}</span>}
                                        {s.score !== undefined && <span className="text-amber-500 text-xs font-bold">★ {s.score}</span>}
                                      </div>
                                    </div>
                                  );
                                })}

                                {activeList.length === 0 && (
                                  <p className="text-xs text-gray-500 py-4 text-center">Không có nguồn phát nào ở mục này.</p>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </>
                )}

                {panelOpen === 'sub' && (
                  <div className="flex flex-col h-full min-h-0 overflow-hidden">
                    {/* 2-Column Split Body */}
                    <div className="grid grid-cols-2 gap-4 p-5 overflow-hidden min-h-0">
                      {/* Left Column: Âm thanh */}
                      <div className="flex flex-col min-h-0 overflow-hidden border-r border-white/5 pr-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 shrink-0">Âm thanh</h4>
                        <div className="space-y-2 overflow-y-auto custom-scrollbar pr-1 flex-1 max-h-[25vh]">
                          {(() => {
                            const formatAudioName = (s: any, idx: number) => {
                              if (!s) return 'Ngôn ngữ gốc [Gốc]';
                              const label = (s.providerLabel || s.label || s.name || s.provider || '').toLowerCase();
                              const lang = (s.lang || '').toLowerCase();
                              
                              // 1. CHỈ KHI luồng HLS/nguồn có chứa từ khóa thuyết minh / lồng tiếng thì mới được hiện Tiếng Việt
                              const isVietDub = label.includes('thuyết minh') || label.includes('thuyet minh') ||
                                                label.includes('lồng tiếng') || label.includes('long tieng') ||
                                                label.includes('lồng tiếng việt') || label.includes('thuyết minh việt');

                              if (isVietDub) {
                                if (label.includes('thuyết minh') || label.includes('thuyet minh')) return 'Tiếng Việt [Thuyết minh]';
                                if (label.includes('lồng tiếng') || label.includes('long tieng')) return 'Tiếng Việt [Lồng tiếng]';
                                return 'Tiếng Việt';
                              }

                              // 2. Nếu là nguồn phim sản xuất tại Việt Nam:
                              if (label.includes('phim việt') || label.includes('phim viet')) return 'Tiếng Việt [Gốc]';

                              // 3. Phim Nhật (Anime), Hàn, Anh, Mỹ:
                              if (lang === 'ja' || label.includes('japanese') || label.includes('anime')) {
                                return idx === 0 ? 'Tiếng Nhật [Gốc]' : `Tiếng Nhật (Server ${idx + 1})`;
                              }
                              if (lang === 'ko' || label.includes('korean')) {
                                return idx === 0 ? 'Tiếng Hàn [Gốc]' : `Tiếng Hàn (Server ${idx + 1})`;
                              }
                              if (lang === 'en' || label.includes('english')) {
                                return idx === 0 ? 'Tiếng Anh [Gốc]' : `Tiếng Anh (Server ${idx + 1})`;
                              }

                              // 4. Mặc định là Ngôn ngữ gốc [Gốc]
                              return idx === 0 ? 'Ngôn ngữ gốc [Gốc]' : `Ngôn ngữ gốc (Server ${idx + 1})`;
                            };

                            // CHỈ lọc các nguồn phim HLS (loại bỏ các nguồn embed iframe 3rd party không can thiệp được)
                            const hlsStreamsOnly = (streams && streams.length > 0)
                              ? streams.filter((s: any) => s.type !== 'embed' && s.type !== 'iframe')
                              : [];

                            const rawList = (hlsStreamsOnly.length > 0)
                              ? hlsStreamsOnly.map((s: any, idx: number) => ({
                                  ...s,
                                  displayName: formatAudioName(s, idx)
                                }))
                              : [
                                  { displayName: 'Ngôn ngữ gốc [Gốc]', url: url },
                                ];

                            const seenNames = new Set<string>();
                            const audioList = rawList.filter((item: any) => {
                              if (seenNames.has(item.displayName)) return false;
                              seenNames.add(item.displayName);
                              return true;
                            });

                            return audioList.map((s: any, idx: number) => {
                              const isActive = activeStream
                                ? (activeStream.providerLabel === s.providerLabel && activeStream.url === s.url)
                                : idx === 0;

                              return (
                                <button key={idx} onClick={() => s.url && onStreamSelect?.(s)}
                                  className={`flex items-center gap-2.5 text-left w-full cursor-pointer py-1.5 px-2 rounded-lg transition-all group ${isActive ? 'bg-white/10 border border-white/20' : 'hover:bg-white/5'}`}>
                                  <Check size={14} className={isActive ? "text-[#E50914] opacity-100" : "opacity-0"} />
                                  <span className={`text-xs truncate ${isActive ? 'text-white font-bold' : 'text-white/70 group-hover:text-white'}`}>
                                    {s.displayName}
                                  </span>
                                </button>
                              );
                            });
                          })()}
                        </div>
                      </div>

                      {/* Right Column: Phụ đề */}
                      <div className="flex flex-col min-h-0 overflow-hidden pl-2">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 shrink-0">Phụ đề</h4>
                        <div className="space-y-2 overflow-y-auto custom-scrollbar pr-1 flex-1 max-h-[25vh]">
                          {combinedSubs.map(s => {
                            const isActive = selectedSub === s.id;
                            return (
                              <button key={String(s.id)} onClick={() => handleSubChange(s.id)}
                                className={`flex items-center gap-2.5 text-left w-full cursor-pointer py-1.5 px-2 rounded-lg transition-all group ${isActive ? 'bg-white/10 border border-white/20' : 'hover:bg-white/5'}`}>
                                <Check size={14} className={isActive ? "text-[#E50914] opacity-100" : "opacity-0"} />
                                <span className={`text-xs ${isActive ? 'text-white font-bold' : 'text-white/70 group-hover:text-white'}`}>
                                  {s.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Subtitle Offset adjusting (Bù trừ phụ đề) */}
                    {selectedSub !== 'off' && subEnabled && (
                      <div className="px-5 py-3 border-t border-white/[0.06] bg-[#0c0d11]">
                        <p className="text-[11px] text-white/40 mb-1.5 font-medium">Bù trừ phụ đề</p>
                        <div className="flex items-center justify-between gap-2.5 bg-white/[0.03] p-1.5 rounded-xl border border-white/[0.05]">
                          <button 
                            onClick={() => setSubOffset(p => p - 250)} 
                            className="px-2.5 py-1.5 bg-white/[0.06] hover:bg-white/12 active:scale-95 rounded-lg text-xs font-bold text-white shrink-0 cursor-pointer transition-all border border-white/5"
                          >
                            −0.25s
                          </button>
                          <span className={`flex-1 text-center text-xs font-mono font-bold px-1 truncate ${subOffset === 0 ? 'text-white/30' : 'text-emerald-400'}`}>
                            {subOffset >= 0 ? '+' : ''}{(subOffset / 1000).toFixed(2)}s
                          </span>
                          <button 
                            onClick={() => setSubOffset(p => p + 250)} 
                            className="px-2.5 py-1.5 bg-white/[0.06] hover:bg-white/12 active:scale-95 rounded-lg text-xs font-bold text-white shrink-0 cursor-pointer transition-all border border-white/5"
                          >
                            +0.25s
                          </button>
                        </div>
                        {subOffset !== 0 && (
                          <button onClick={() => setSubOffset(0)} className="mt-1.5 w-full text-[10px] text-white/30 hover:text-white/60 transition-colors cursor-pointer text-center">Reset delay</button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {panelOpen === 'quality' && qualities.map(q => (
                  <button key={q.id} onClick={() => { handleQuality(q.id); setPanelOpen('settings'); }}
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.04] transition-colors cursor-pointer">
                    <div className="w-4 flex justify-center">{activeQuality === q.id && <Check size={14} className="text-white" />}</div>
                    <span className={`text-sm ${activeQuality === q.id ? 'text-white font-medium' : 'text-white/60'}`}>{q.name}</span>
                  </button>
                ))}

                {panelOpen === 'speed' && [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(r => (
                  <button key={r} onClick={() => { handleRate(r); setPanelOpen('settings'); }}
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.04] transition-colors cursor-pointer">
                    <div className="w-4 flex justify-center">{playbackRate === r && <Check size={14} className="text-white" />}</div>
                    <span className={`text-sm ${playbackRate === r ? 'text-white font-medium' : 'text-white/60'}`}>{r === 1 ? 'Chuẩn' : `${r}x`}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Episode Drawer: Mobile Fullscreen Horizontal Cards Overlay (Screenshot 2) vs Desktop Popover */}
      <AnimatePresence>
        {panelOpen === 'episodes' && (
          isMobile ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[100] bg-black/95 p-6 sm:p-8 flex flex-col justify-between overflow-hidden"
              onClick={e => e.stopPropagation()}>
              
              {/* Top Header Bar */}
              <div className="flex items-center justify-between gap-4 pb-2 border-b border-white/10 shrink-0">
                <button onClick={closePanel} className="p-2 rounded-full hover:bg-white/10 text-white cursor-pointer transition-all active:scale-95">
                  <ArrowLeft size={24} />
                </button>
                <h2 className="text-base sm:text-lg font-bold text-white truncate text-right">{movieName || title}</h2>
              </div>

              {/* Season Tabs if multiple seasons */}
              {seasons && seasons.length > 0 && (
                <div className="flex gap-2 py-2 overflow-x-auto scrollbar-hide shrink-0">
                  {seasons.map((s) => (
                    <button key={s.season_number} onClick={() => onSeasonChange?.(s.season_number)}
                      className={cn(
                        "shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border",
                        s.season_number === activeEpSeason
                          ? "bg-[#E50914] border-[#E50914] text-white"
                          : "bg-white/5 border-white/10 text-white/60 hover:text-white"
                      )}>
                      {s.name || `Mùa ${s.season_number}`}
                    </button>
                  ))}
                </div>
              )}

              {/* Horizontal Scrollable Episode Cards Container */}
              <div className="flex-1 flex items-start gap-5 overflow-x-auto py-3 scrollbar-hide w-full align-top">
                {episodes.map((ep, i) => {
                  const isActive = isSameEp(ep.name, episodeName);
                  const epKey = `${slug}_ep_${ep.name}`;
                  const epProg = episodeProgressMap[epKey];
                  const pct = epProg && epProg.duration > 0 ? Math.min(100, (epProg.currentTime / epProg.duration) * 100) : 0;
                  const tmdbEp = tmdbEpisodes?.find((t: any) => t.episode_number === (i + 1) || isSameEp(t.episode_number, ep.name));
                  const epTitle = tmdbEp?.name || (ep.title && ep.title !== ep.name ? ep.title : (ep.name ? `Tập ${ep.name}` : `Tập ${i + 1}`));
                  const stillPath = tmdbEp?.still_path || ep.still_path;
                  const stillImg = stillPath ? `https://image.tmdb.org/t/p/w500${stillPath}` : (thumbUrl || posterUrl);
                  const durationText = tmdbEp?.runtime ? `${tmdbEp.runtime} phút` : '23 phút';
                  const overview = tmdbEp?.overview || ep.overview || '';

                  return (
                    <div key={ep.slug || i} onClick={() => { onEpisodeSelect?.(ep); closePanel(); }}
                      className="flex flex-col w-64 sm:w-72 shrink-0 gap-2 cursor-pointer group/ep">
                      {/* 16:9 Thumbnail */}
                      <div className="relative w-full aspect-video rounded-md overflow-hidden bg-black/60 border border-white/10 shrink-0">
                        {stillImg ? (
                          <img src={stillImg} alt={epTitle} className="w-full h-full object-cover group-hover/ep:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-neutral-900 text-white/40 text-xs font-bold">Tập {i + 1}</div>
                        )}
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center border border-white/30", isActive ? "bg-[#E50914] text-white border-[#E50914]" : "bg-black/60 text-white")}>
                            <Play size={20} fill="white" className="ml-0.5" />
                          </div>
                        </div>
                        {pct > 0 && (
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/80">
                            <div className="h-full bg-[#E50914]" style={{ width: `${pct}%` }} />
                          </div>
                        )}
                      </div>
                      {/* Title & Info */}
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <h4 className={cn("text-xs sm:text-sm font-bold truncate", isActive ? "text-[#E50914]" : "text-white")}>
                          {i + 1}. {epTitle}
                        </h4>
                      </div>
                      <span className="text-[11px] text-gray-400 font-medium">{durationText}</span>
                      {overview && <p className="text-[11px] text-gray-400 line-clamp-3 leading-relaxed">{overview}</p>}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <>
              <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration: 0.12 }}
                className="fixed inset-0 z-50 bg-black/50" onClick={closePanel} />
              <motion.div
                initial={{ scale: 0.96, opacity: 0, y: 6 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0, y: 6 }}
                transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                className="z-50 bg-[#0a0a0d]/95 backdrop-blur-2xl border border-white/15 flex flex-col shadow-[0_20px_60px_rgba(0,0,0,0.85)] overflow-hidden absolute bottom-16 right-16 sm:right-32 w-[380px] sm:w-[460px] max-h-[55vh] rounded-2xl"
                onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] shrink-0 sticky top-0 z-20 bg-[#0d0e12]">
                  <h3 className="text-sm font-bold text-white/90 uppercase tracking-wider">Danh sách tập</h3>
                  <button onClick={closePanel} className="p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer">
                    <X size={16} className="text-white/60" />
                  </button>
                </div>

                {/* Horizontal Season Tabs */}
                {seasons && seasons.length > 0 && (
                  <div className="flex gap-2 px-5 py-3 border-b border-white/[0.04] overflow-x-auto scrollbar-hide shrink-0 bg-[#0d0e12]">
                    {seasons.map((s) => (
                      <button key={s.season_number} onClick={() => onSeasonChange?.(s.season_number)}
                        className={cn(
                          "shrink-0 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer border",
                          s.season_number === activeEpSeason
                            ? "bg-[#E50914] border-[#E50914] text-white shadow-[0_4px_12px_rgba(229,9,20,0.35)] scale-[1.02]"
                            : "bg-white/[0.04] border-white/[0.06] text-white/60 hover:bg-white/[0.08] hover:text-white"
                        )}>
                        {s.name || `Mùa ${s.season_number}`}
                      </button>
                    ))}
                  </div>
                )}

                {/* Episodes List (Netflix Cards) */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 custom-scrollbar overscroll-contain touch-pan-y">
                  {episodes.map((ep, i) => {
                    const isActive = isSameEp(ep.name, episodeName);
                    const prog = progressMap[slug || ''];
                    const epKey = `${slug}_ep_${ep.name}`;
                    const epProg = episodeProgressMap[epKey] || (prog && isSameEp(prog.episodeName, ep.name) ? prog : null);
                    const pct = epProg && epProg.duration > 0
                      ? Math.min(100, (epProg.currentTime / epProg.duration) * 100) : 0;
                    
                    const tmdbEp = tmdbEpisodes?.find((t: any) => t.episode_number === (i + 1) || isSameEp(t.episode_number, ep.name));
                    const epTitle = tmdbEp?.name || (ep.title && ep.title !== ep.name ? ep.title : (ep.name ? `Tập ${ep.name}` : `Tập ${i + 1}`));
                    const stillPath = tmdbEp?.still_path || ep.still_path;
                    const stillImg = stillPath 
                      ? `https://image.tmdb.org/t/p/w500${stillPath}` 
                      : (thumbUrl || posterUrl);
                    const durationText = tmdbEp?.runtime ? `${tmdbEp.runtime} phút` : '';
                    const overview = tmdbEp?.overview || ep.overview || '';

                    return (
                      <div 
                        key={ep.slug || i} 
                        onClick={() => { onEpisodeSelect?.(ep); closePanel(); }}
                        className={cn(
                          "flex flex-col sm:flex-row gap-3.5 sm:gap-4 p-3 rounded-xl border transition-all cursor-pointer group/ep",
                          isActive
                            ? "bg-white/10 border-[#E50914] shadow-[0_0_20px_rgba(229,9,20,0.3)] ring-1 ring-[#E50914]/50"
                            : "bg-white/5 border-transparent hover:bg-white/10 hover:border-white/20"
                        )}
                      >
                        {/* 16:9 Thumbnail Card */}
                        <div className="relative w-full sm:w-[170px] md:w-[190px] aspect-video rounded-lg overflow-hidden shrink-0 bg-black/60 border border-white/10">
                          {stillImg ? (
                            <img src={stillImg} alt={epTitle} className="w-full h-full object-cover group-hover/ep:scale-105 transition-transform duration-300" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-neutral-900 text-white/40 text-xs font-bold">
                              Tập {i + 1}
                            </div>
                          )}
                          
                          {/* Hover / Active Play icon overlay */}
                          <div className="absolute inset-0 bg-black/30 group-hover/ep:bg-black/10 flex items-center justify-center transition-all">
                            <div className={cn(
                              "w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all transform group-hover/ep:scale-110",
                              isActive ? "bg-[#E50914] text-white shadow-lg" : "bg-black/60 text-white border border-white/20"
                            )}>
                              <Play size={18} fill="white" className="ml-0.5" />
                            </div>
                          </div>

                          {/* Bottom watch progress bar (Netflix Red) */}
                          {pct > 0 && (
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/80">
                              <div className="h-full bg-[#E50914] transition-all rounded-r-full" style={{ width: `${pct}%` }} />
                            </div>
                          )}
                        </div>

                        {/* Details Section */}
                        <div className="flex flex-col justify-center flex-1 min-w-0 pr-1">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <h4 className={cn("text-xs sm:text-sm font-bold truncate", isActive ? "text-[#E50914]" : "text-white group-hover/ep:text-white")}>
                              {i + 1}. {epTitle}
                            </h4>
                            {durationText && <span className="text-[11px] text-gray-400 shrink-0 font-medium">{durationText}</span>}
                          </div>
                          
                          {overview ? (
                            <p className="text-[11px] sm:text-xs text-gray-400 line-clamp-2 leading-relaxed font-normal">
                              {overview}
                            </p>
                          ) : (
                            <p className="text-[11px] text-gray-500 italic">Nhấn để xem tập này</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </>
          )
        )}
      </AnimatePresence>

      </div>

      {/* Embed bottom controls bar */}
      {isEmbed && (
        <div className="w-full bg-[#0a0a0c] border-t border-white/[0.06] p-2.5 sm:p-3 flex items-center justify-between gap-3 shrink-0 z-30 pointer-events-auto select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2 h-2 rounded-full animate-pulse bg-emerald-400 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Đang phát (Embed)</span>
              <span className="text-xs font-bold text-white truncate max-w-[200px] sm:max-w-md">{movieName || title}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {((servers && servers.length > 0) || (streams && streams.length > 0)) && (
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setPanelOpen(prev => prev === 'settings' ? 'none' : 'settings'); 
                }} 
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 bg-white/[0.06] hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/90 cursor-pointer transition-colors"
              >
                <Settings size={14} className="text-white/70" />
                <span>Nguồn phát</span>
              </button>
            )}

            <button 
              onClick={() => onClose?.()}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 bg-white/[0.06] hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/90 cursor-pointer transition-colors"
            >
              <ArrowLeft size={14} />
              <span>Thoát</span>
            </button>
          </div>
        </div>
      )}

      <ReportModal
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        movieTitle={movieName || title || 'Phim'}
        movieSlug={slug || ''}
        tmdbId={tmdbId}
        mediaType={type === 'series' || isTv ? 'tv' : 'movie'}
        season={currentSeason}
        episodeName={episodeName}
        serverName={activeStream?.providerLabel || (selectedServerId !== undefined && servers ? servers[selectedServerId]?.server_name : undefined) || 'Nguồn chưa xác định'}
        streamUrl={activeStream?.url || url}
        streamType={activeStream?.type || (embedUrl ? 'embed' : 'hls')}
        quality={activeStream?.quality || 'auto'}
        currentTime={currentTime}
        duration={duration}
        isFullscreen={isFullscreen}
      />
    </div>
  );
};
