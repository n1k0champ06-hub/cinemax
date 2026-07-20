import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Play, Pause, RotateCcw, RotateCw, Maximize, Minimize,
  VolumeX, Volume1, Volume2, Settings, ArrowLeft,
  Loader2, Check, ChevronRight, X, List, Flag,
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

function clientFilterPlaylistAds(text, playlistUrl) {
  if (!text || !text.includes('#EXTM3U')) return text;
  const isKKPhim = playlistUrl && (playlistUrl.includes('kkphim') || playlistUrl.includes('phimapi'));
  const isOPhim  = playlistUrl && (playlistUrl.includes('ophim') || playlistUrl.includes('opstream'));
  const isViCdn  = isKKPhim || isOPhim || playlistUrl.includes('nguonc') || playlistUrl.includes('xem20');
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let blockStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line && !line.startsWith('#')) {
      blocks.push({ start: blockStart, uriIndex: i, end: i, uri: line });
      blockStart = i + 1;
    }
  }
  const removalRanges = [];
  for (const block of blocks) {
    const norm = block.uri.toLowerCase();
    let isAd = false;
    if (norm.includes('rovideo') || norm.includes('rostream') || norm.includes('phimimg.com/ads') || norm.includes('9922.com')) isAd = true;
    if (isKKPhim && (norm.includes('convertv') || norm.includes('convert') || norm.includes('doubleclick') || norm.includes('googleads'))) isAd = true;
    if (isViCdn && block.uri.startsWith('/') && (norm.includes('/v7/') || norm.includes('/v8/') || norm.includes('/v9/') || norm.includes('/v10/') || norm.includes('/segment'))) isAd = true;
    if (isAd) {
      let start = block.uriIndex;
      for (let i = block.uriIndex - 1; i >= block.start; i--) {
        const l = lines[i].trim();
        if (l.startsWith('#EXTINF') || l.startsWith('#EXT-X-DISCONTINUITY') || l.startsWith('#EXT-X-KEY') || l === '') { start = i; continue; }
        break;
      }
      removalRanges.push({ start, end: block.end });
    }
  }
  if (blocks.length > 1) {
    const hostCounts = new Map();
    for (const b of blocks) { const h = extractHostname(b.uri); if (h) hostCounts.set(h, (hostCounts.get(h) || 0) + 1); }
    let mainHost = null; let maxCount = 0;
    for (const [h, c] of hostCounts.entries()) { if (c > maxCount) { mainHost = h; maxCount = c; } }
    if (mainHost) {
      for (let bi = 0; bi < blocks.length; bi++) {
        const block = blocks[bi];
        const segHost = extractHostname(block.uri);
        if (removalRanges.some(r => block.uriIndex >= r.start && block.uriIndex <= r.end)) continue;
        if (segHost && segHost !== mainHost) {
          let hasDiscBefore = false;
          for (let i = block.start; i < block.uriIndex; i++) { if (lines[i].trim().toUpperCase() === '#EXT-X-DISCONTINUITY') { hasDiscBefore = true; break; } }
          const nb = blocks[bi + 1]; let hasDiscAfter = false;
          if (nb) { for (let i = block.end + 1; i < nb.uriIndex; i++) { if (lines[i].trim().toUpperCase() === '#EXT-X-DISCONTINUITY') { hasDiscAfter = true; break; } } }
          if (hasDiscBefore && hasDiscAfter) {
            let start = block.uriIndex;
            for (let i = block.uriIndex - 1; i >= block.start; i--) {
              const l = lines[i].trim();
              if (l.startsWith('#EXTINF') || l.startsWith('#EXT-X-DISCONTINUITY') || l.startsWith('#EXT-X-KEY') || l === '') { start = i; continue; }
              break;
            }
            removalRanges.push({ start, end: block.end });
          }
        }
      }
    }
  }
  const kept = [];
  for (let i = 0; i < lines.length; i++) {
    if (!removalRanges.some(r => i >= r.start && i <= r.end)) kept.push(lines[i]);
  }
  const compacted = []; let prevWasDisc = false;
  for (const line of kept) {
    const isDisc = line.trim().toUpperCase() === '#EXT-X-DISCONTINUITY';
    if (isDisc) { if (isViCdn) continue; if (prevWasDisc) continue; }
    compacted.push(line); prevWasDisc = isDisc;
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
  const [seekFx,       setSeekFx]       = useState<'fwd' | 'rev' | null>(null);
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
  const [isMobile,     setIsMobile]     = useState(false);
  const [progressMap,  setProgressMap]  = useState<Record<string, any>>({});

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
    const isVi = activeStream?.category === 'vi';
    const storageKey = isVi ? 'cinemax_sub_enabled_vi' : 'cinemax_sub_enabled_foreign';
    const saved = localStorage.getItem(storageKey);
    const shouldOn = saved !== null ? saved === 'true' : !isVi;
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
        maxBufferLength: isVi ? 40 : 10,
        maxMaxBufferLength: isVi ? 60 : 20,
        maxBufferSize: isVi ? 80*1024*1024 : 15*1000*1000,
        enableWorker: true,
        lowLatencyMode: !isVi,
        capLevelToPlayerSize: true,
        backBufferLength: 10,
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
          .map((s,i) => ({ id:i, name: s.name || s.lang || `Phụ đề ${i+1}`, lang: s.lang||'' }))
          .filter(s => s.lang.toLowerCase().includes('vi') || s.lang.toLowerCase().includes('viet'))
          .map(s => ({ id:s.id, name:s.name }));
        setSubTracks(subs);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRetries < 3) { mediaRetries++; hls.recoverMediaError(); }
        else if (data.type === Hls.ErrorTypes.NETWORK_ERROR && netRetries < 3) { netRetries++; hls.startLoad(); }
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
    const onVol  = () => { setVolume(v.volume); setIsMuted(v.muted); };
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
    const hls = hlsRef.current;
    if (!hls) return;
    hls.subtitleTrack = (subEnabled && typeof selectedSub === 'number') ? selectedSub : -1;
  }, [subEnabled, selectedSub]);

  const resetControls = useCallback(() => {
    setShowControls(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (panelOpen === 'none') setShowControls(false);
    }, 3500);
  }, [panelOpen]);

  useEffect(() => { resetControls(); return () => { if (timerRef.current) clearTimeout(timerRef.current); }; }, [resetControls]);

  useEffect(() => {
    if (panelOpen !== 'episodes') return;
    try {
      const s = localStorage.getItem('cinemax_progress');
      if (s) setProgressMap(JSON.parse(s));
    } catch {}
  }, [panelOpen]);

  const togglePlay = useCallback((e) => {
    e?.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) { v.pause(); }
    else { const p = v.play(); if (p) p.catch(err => { if (err.name !== 'AbortError') setIsPlaying(false); }); }
  }, [isPlaying]);

  const skip = useCallback((sec) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + sec));
    setSeekFx(sec > 0 ? 'fwd' : 'rev');
    if (seekFxRef.current) clearTimeout(seekFxRef.current);
    seekFxRef.current = setTimeout(() => setSeekFx(null), 700);
    resetControls();
  }, [resetControls]);

  const toggleMute = (e) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (v) v.muted = !v.muted;
  };

  const toggleFullscreen = async (e) => {
    e.stopPropagation();
    const el = containerRef.current;
    if (!el) return;
    const d = document as any;
    const isFull = !!(d.fullscreenElement || d.webkitFullscreenElement);
    if (!isFull) {
      try {
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
        if (screen.orientation && (screen.orientation as any).lock) await (screen.orientation as any).lock('landscape').catch(()=>{});
      } catch {}
    } else {
      try {
        if (d.exitFullscreen) await d.exitFullscreen();
        else if (d.webkitExitFullscreen) await d.webkitExitFullscreen();
        if (screen.orientation?.unlock) screen.orientation.unlock();
      } catch {}
    }
  };

  const handleRate = (r) => { if (videoRef.current) videoRef.current.playbackRate = r; setPlaybackRate(r); };
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
      // Single tap/click: delay togglePlay by 250ms to check for double tap
      lastTapRef.current = now;
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
      const clickEvent = { ...e };
      clickTimerRef.current = setTimeout(() => {
        togglePlay(clickEvent);
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
    <div className="relative w-full h-full flex flex-col bg-black overflow-hidden select-none" ref={containerRef}>
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
          />
        )}

        {activeSubUrl && subEnabled && !isEmbed && (
          <SubtitleOverlay
            subtitleUrl={activeSubUrl}
            videoRef={videoRef}
            offsetMs={subOffset}
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
          {seekFx && !isEmbed && (
            <motion.div key={seekFx} initial={{ opacity:0, scale:0.8 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
              transition={{ duration: 0.18 }}
              className={`absolute top-1/2 -translate-y-1/2 pointer-events-none z-30 flex flex-col items-center gap-1 ${seekFx === 'fwd' ? 'right-12 md:right-24' : 'left-12 md:left-24'}`}>
              <div className="bg-white/15 backdrop-blur-sm rounded-full w-16 h-16 md:w-20 md:h-20 flex items-center justify-center">
                {seekFx === 'fwd' ? <RotateCw size={28} className="text-white" /> : <RotateCcw size={28} className="text-white" />}
              </div>
              <span className="text-white text-xs font-semibold">{seekFx === 'fwd' ? '+10s' : '-10s'}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showControls && !isEmbed && (
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.2 }}
              className="absolute inset-0 z-40 flex flex-col justify-between pointer-events-none"
              onMouseMove={resetControls}>
            {/* Top bar */}
            <div className="pointer-events-auto flex items-center justify-between px-4 pt-4 pb-10 bg-gradient-to-b from-black/70 via-black/20 to-transparent">
              <button onClick={(e) => { e.stopPropagation(); onClose?.(); }}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors cursor-pointer">
                <ArrowLeft size={20} className="text-white" />
              </button>
              <div className="flex-1 text-center px-4">
                {movieName && <p className="text-white text-sm font-semibold truncate">{movieName}</p>}
                {episodeName && isTv && <p className="text-white/50 text-xs truncate">{episodeName}</p>}
              </div>
              <button onClick={(e) => { e.stopPropagation(); setShowReport(true); }}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors cursor-pointer" title="Báo lỗi">
                <Flag size={17} className="text-white/70" />
              </button>
            </div>

            {/* Bottom controls */}
            <div className="pointer-events-auto flex flex-col gap-0 px-4 pb-4 pt-12 bg-gradient-to-t from-black/80 via-black/30 to-transparent">
              {/* Seek bar */}
              {!isEmbed && (
                <div className="relative w-full h-5 flex items-center group/seek mb-1 cursor-pointer">
                  <div className="absolute left-0 h-[3px] group-hover/seek:h-1 bg-white/20 rounded-full transition-all duration-150" style={{ width: `${buffered}%` }} />
                  <div className="absolute left-0 h-[3px] group-hover/seek:h-1 bg-[#E50914] rounded-full transition-all duration-150 pointer-events-none" style={{ width: `${progress}%` }}>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 rounded-full bg-white shadow opacity-0 group-hover/seek:opacity-100 transition-opacity" />
                  </div>
                  <div className="absolute left-0 right-0 h-[3px] group-hover/seek:h-1 bg-white/10 rounded-full -z-10 transition-all duration-150" />
                  <input type="range" min="0" max={duration || 0} step="0.5" value={currentTime}
                    onChange={handleSeekBar} onClick={e => e.stopPropagation()}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" />
                </div>
              )}

              {/* Button row */}
              <div className="flex items-center justify-between mt-1">
                {!isEmbed ? (
                  <div className="flex items-center gap-3 md:gap-4">
                    <button onClick={togglePlay} className="p-1.5 hover:scale-110 active:scale-95 transition-transform cursor-pointer">
                      {isPlaying ? <Pause size={22} className="text-white" /> : <Play size={22} className="text-white" fill="white" />}
                    </button>
                    <button onClick={() => skip(-10)} className="hover:scale-110 active:scale-95 transition-transform cursor-pointer">
                      <RotateCcw size={20} className="text-white" />
                    </button>
                    <button onClick={() => skip(10)} className="hover:scale-110 active:scale-95 transition-transform cursor-pointer">
                      <RotateCw size={20} className="text-white" />
                    </button>
                    <span className="text-white/70 text-xs font-mono tabular-nums hidden sm:block">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-white/40 text-xs font-semibold uppercase tracking-wider bg-white/5 px-2.5 py-1 rounded-md border border-white/5">
                      Nguồn nhúng (Embed)
                    </span>
                  </div>
                )}

                {!isEmbed && (
                  <div className="flex-1 text-center sm:hidden px-2">
                    <span className="text-white/50 text-xs truncate block">{formatTime(currentTime)} / {formatTime(duration)}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 md:gap-3">
                  {isTv && nextEp && (
                    <button onClick={(e) => { e.stopPropagation(); onEpisodeSelect?.(nextEp); }}
                      className="hidden sm:flex items-center gap-1 text-white/70 hover:text-white text-xs font-medium transition-colors cursor-pointer" title="Tập tiếp theo">
                      <RotateCw size={16} />
                      <span className="hidden md:inline">Tập tiếp</span>
                    </button>
                  )}

                  {isTv && episodes.length > 0 && (
                    <button onClick={openPanel('episodes')}
                      className={`p-1.5 hover:scale-110 active:scale-95 transition-all cursor-pointer ${panelOpen === 'episodes' ? 'text-[#E50914]' : 'text-white/80 hover:text-white'}`}
                      title="Danh sách tập">
                      <List size={20} />
                    </button>
                  )}

                  <button onClick={openPanel('settings')}
                    className={`p-1.5 hover:scale-110 active:scale-95 transition-all cursor-pointer ${settingsPanelOpen ? 'text-[#E50914]' : 'text-white/80 hover:text-white'}`}
                    title="Cài đặt">
                    <Settings size={20} />
                  </button>

                  {!isMobile && !isEmbed && (
                    <div className="group/vol flex items-center gap-1">
                      <button onClick={toggleMute} className="p-1.5 hover:scale-110 active:scale-95 transition-all cursor-pointer">
                        {isMuted || volume === 0 ? <VolumeX size={20} className="text-white/80" />
                          : volume < 0.5 ? <Volume1 size={20} className="text-white/80" />
                          : <Volume2 size={20} className="text-white/80" />}
                      </button>
                      <input type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume}
                        onChange={(e) => { const v = parseFloat(e.target.value); if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = v === 0; } }}
                        onClick={e => e.stopPropagation()}
                        className="w-0 opacity-0 group-hover/vol:w-20 group-hover/vol:opacity-100 transition-[width,opacity] duration-200 accent-[#E50914] h-1 cursor-pointer" />
                    </div>
                  )}

                  <button onClick={toggleFullscreen} className="p-1.5 hover:scale-110 active:scale-95 transition-all cursor-pointer">
                    {isFullscreen ? <Minimize size={20} className="text-white/80" /> : <Maximize size={20} className="text-white/80" />}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings panel */}
      <AnimatePresence>
        {settingsPanelOpen && (
          <>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs" onClick={closePanel} />
            <motion.div
              initial={isMobile ? { y: '100%', opacity: 0 } : { x: '100%', opacity: 0 }}
              animate={{ x: 0, y: 0, opacity: 1 }}
              exit={isMobile ? { y: '100%', opacity: 0 } : { x: '100%', opacity: 0 }}
              transition={{ type: 'tween', ease: [0.16, 1, 0.3, 1], duration: 0.25 }}
              className={cn(
                "z-50 bg-[#0a0a0c]/98 backdrop-blur-xl border-white/[0.08] flex flex-col shadow-2xl overflow-hidden",
                isMobile
                  ? "fixed inset-x-0 bottom-0 top-auto max-h-[80vh] rounded-t-2xl border-t shadow-[0_-10px_30px_rgba(0,0,0,0.95)]"
                  : "absolute right-0 top-0 bottom-0 w-80 border-l"
              )}
              onClick={e => e.stopPropagation()}>
              
              {isMobile && (
                <div className="w-10 h-1 bg-white/20 rounded-full mx-auto my-2.5 shrink-0" />
              )}

              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.06] shrink-0 sticky top-0 z-20 bg-[#0a0a0c]/98 backdrop-blur-md">
                {panelOpen !== 'settings' && (
                  <button onClick={() => setPanelOpen('settings')} className="p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer">
                    <ArrowLeft size={16} className="text-white/70" />
                  </button>
                )}
                <h3 className="text-sm font-bold text-white/90 uppercase tracking-wider flex-1">
                  {panelOpen === 'settings' && 'Cài đặt'}
                  {panelOpen === 'quality'  && 'Chất lượng'}
                  {panelOpen === 'speed'    && 'Tốc độ phát'}
                  {panelOpen === 'sub'      && 'Phụ đề'}
                </h3>
                <button onClick={closePanel} className="p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer">
                  <X size={16} className="text-white/60" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {panelOpen === 'settings' && (
                  <>
                    {!isEmbed && qualities.length > 0 && (
                      <button className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.04] transition-colors cursor-pointer text-sm text-white/80" onClick={() => setPanelOpen('quality')}>
                        <span>Chất lượng</span>
                        <div className="flex items-center gap-2 text-white/40 text-xs">
                          <span>{activeQuality === -1 ? 'Tự động' : qualities.find(q=>q.id===activeQuality)?.name}</span>
                          <ChevronRight size={14} />
                        </div>
                      </button>
                    )}
                    {!isEmbed && (
                      <button className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.04] transition-colors cursor-pointer text-sm text-white/80" onClick={() => setPanelOpen('speed')}>
                        <span>Tốc độ phát</span>
                        <div className="flex items-center gap-2 text-white/40 text-xs">
                          <span>{playbackRate === 1 ? 'Chuẩn' : `${playbackRate}x`}</span>
                          <ChevronRight size={14} />
                        </div>
                      </button>
                    )}
                    {!isEmbed && (
                      <button className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.04] transition-colors cursor-pointer text-sm text-white/80" onClick={() => setPanelOpen('sub')}>
                        <span>Phụ đề</span>
                        <div className="flex items-center gap-2 text-white/40 text-xs">
                          <span className="max-w-[120px] truncate">{activeSubLabel}</span>
                          <ChevronRight size={14} />
                        </div>
                      </button>
                    )}

                    {selectedSub !== 'off' && subEnabled && (
                      <div className="px-5 py-3.5 border-t border-white/[0.04]">
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
                      <div className="px-5 py-3.5 border-t border-white/[0.04]">
                        <p className="text-xs text-white/40 mb-3 uppercase tracking-wider font-semibold">Nguồn phát</p>
                        
                        {/* 1. Nguồn Việt Nam */}
                        {(() => {
                          const viStreams = streams
                            ?.filter(s => s.category === 'vi' || s.lang === 'vi')
                            .sort((a, b) => (b.score || 0) - (a.score || 0)) || [];
                          if (viStreams.length === 0) return null;
                          return (
                            <div className="mb-3">
                              <p className="text-[9px] text-[#E50914] font-bold mb-1.5 uppercase tracking-widest">Nguồn Việt Nam</p>
                              <div className="flex flex-col gap-1">
                                {viStreams.map((s, idx) => {
                                  const isActive = activeStream?.providerLabel === s.providerLabel && activeStream?.url === s.url;
                                  return (
                                    <button key={`vi-${idx}`} onClick={() => onStreamSelect?.(s)}
                                      className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-colors cursor-pointer text-left ${isActive ? 'bg-[#E50914]/10 border border-[#E50914]/30 text-white font-medium' : 'bg-white/[0.02] border border-white/[0.04] text-white/60 hover:bg-white/[0.06]'}`}>
                                      <div className="w-3.5 flex justify-center shrink-0">
                                        {isActive && <Check size={11} className="text-[#E50914] shrink-0" />}
                                      </div>
                                      <span className="truncate flex-1">{s.providerLabel || 'Nguồn Việt'}</span>
                                      {s.quality && <span className="text-[9px] bg-white/10 px-1 py-0.2 rounded text-white/50">{s.quality}</span>}
                                      {s.score !== undefined && <span className="text-[9px] text-[#E50914]/80 ml-1 font-bold">★ {s.score}</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}

                        {/* 2. Nguồn VIP */}
                        {(() => {
                          const premiumStreams = streams
                            ?.filter(s => s.category === 'premium' && s.lang !== 'vi')
                            .sort((a, b) => (b.score || 0) - (a.score || 0)) || [];
                          if (premiumStreams.length === 0) return null;
                          return (
                            <div className="mb-3">
                              <p className="text-[9px] text-yellow-500 font-bold mb-1.5 uppercase tracking-widest">Nguồn VIP</p>
                              <div className="flex flex-col gap-1">
                                {premiumStreams.map((s, idx) => {
                                  const isActive = activeStream?.providerLabel === s.providerLabel && activeStream?.url === s.url;
                                  return (
                                    <button key={`vip-${idx}`} onClick={() => onStreamSelect?.(s)}
                                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer text-left ${isActive ? 'bg-yellow-500/10 border border-yellow-500/30 text-white font-medium' : 'bg-white/[0.02] border border-white/[0.04] text-white/60 hover:bg-white/[0.06]'}`}>
                                      <div className="w-3.5 flex justify-center shrink-0">
                                        {isActive && <Check size={11} className="text-yellow-500 shrink-0" />}
                                      </div>
                                      <span className="truncate flex-1">{s.providerLabel || 'Nguồn VIP'}</span>
                                      {s.quality && <span className="text-[9px] bg-white/10 px-1 py-0.2 rounded text-white/50">{s.quality}</span>}
                                      {s.score !== undefined && <span className="text-[9px] text-yellow-500/80 ml-1 font-bold">★ {s.score}</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}

                        {/* 3. Nguồn Community */}
                        {(() => {
                          const commStreams = streams
                            ?.filter(s => (s.category === 'standard' || s.category === 'free' || !s.category) && s.lang !== 'vi')
                            .sort((a, b) => (b.score || 0) - (a.score || 0)) || [];
                          if (commStreams.length === 0) return null;
                          return (
                            <div className="mb-3">
                              <p className="text-[9px] text-white/40 font-bold mb-1.5 uppercase tracking-widest">Nguồn Community</p>
                              <div className="flex flex-col gap-1">
                                {commStreams.map((s, idx) => {
                                  const isActive = activeStream?.providerLabel === s.providerLabel && activeStream?.url === s.url;
                                  return (
                                    <button key={`comm-${idx}`} onClick={() => onStreamSelect?.(s)}
                                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer text-left ${isActive ? 'bg-white/10 border border-white/20 text-white font-medium' : 'bg-white/[0.02] border border-white/[0.04] text-white/60 hover:bg-white/[0.06]'}`}>
                                      <div className="w-3.5 flex justify-center shrink-0">
                                        {isActive && <Check size={11} className="text-white shrink-0" />}
                                      </div>
                                      <span className="truncate flex-1">{s.providerLabel || 'Nguồn Community'}</span>
                                      {s.quality && <span className="text-[9px] bg-white/10 px-1 py-0.2 rounded text-white/50">{s.quality}</span>}
                                      {s.score !== undefined && <span className="text-[9px] text-white/40 ml-1 font-bold">★ {s.score}</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}

                        {/* 4. Nguồn Web dự phòng (Servers) */}
                        {servers && servers.length > 0 && (
                          <div>
                            <p className="text-[9px] text-white/40 font-bold mb-1.5 uppercase tracking-widest">Nguồn Web dự phòng</p>
                            <div className="flex flex-col gap-1">
                              {servers.map((s, i) => {
                                const isActive = i === selectedServerId && !activeStream;
                                return (
                                  <button key={`server-${i}`} onClick={() => onServerChange?.(i)}
                                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer text-left ${isActive ? 'bg-[#E50914]/10 border border-[#E50914]/30 text-white font-medium' : 'bg-white/[0.02] border border-white/[0.04] text-white/60 hover:bg-white/[0.06]'}`}>
                                    <div className="w-3.5 flex justify-center shrink-0">
                                      {isActive && <Check size={11} className="text-[#E50914] shrink-0" />}
                                    </div>
                                    <span className="truncate flex-1">{s.server_name || `Server ${i+1}`}</span>
                                    <span className="text-[9px] bg-white/10 px-1 py-0.2 rounded text-white/50">HLS</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
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

                {panelOpen === 'sub' && combinedSubs.map(s => (
                  <button key={String(s.id)} onClick={() => { handleSubChange(s.id); setPanelOpen('settings'); }}
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.04] transition-colors cursor-pointer">
                    <div className="w-4 flex justify-center">{selectedSub === s.id && <Check size={14} className="text-white" />}</div>
                    <span className={`text-sm ${selectedSub === s.id ? 'text-white font-medium' : 'text-white/60'}`}>{s.name}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Episode drawer */}
      <AnimatePresence>
        {panelOpen === 'episodes' && (
          <>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              className="absolute inset-0 z-50" onClick={closePanel} />
            <motion.div
              initial={{ x:'100%', opacity:0 }} animate={{ x:0, opacity:1 }} exit={{ x:'100%', opacity:0 }}
              transition={{ type:'tween', ease:[0.16,1,0.3,1], duration:0.22 }}
              className="absolute right-0 top-0 bottom-0 z-50 w-72 bg-[#0a0a0c]/95 backdrop-blur-md border-l border-white/[0.07] flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                <h3 className="text-sm font-bold text-white/90 uppercase tracking-wider">Danh sách tập</h3>
                <button onClick={closePanel} className="p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer">
                  <X size={16} className="text-white/60" />
                </button>
              </div>

              {seasons.length > 1 && (
                <div className="flex gap-2 px-4 py-3 border-b border-white/[0.04] overflow-x-auto scrollbar-hide">
                  {seasons.map((s) => (
                    <button key={s.season_number} onClick={() => onSeasonChange?.(s.season_number)}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${s.season_number === activeEpSeason ? 'bg-[#E50914] text-white' : 'bg-white/[0.05] text-white/50 hover:bg-white/[0.1]'}`}>
                      {s.name || `Phần ${s.season_number}`}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex-1 overflow-y-auto py-2">
                {episodes.map((ep, i) => {
                  const isActive = isSameEp(ep.name, episodeName);
                  const prog = progressMap[slug||''];
                  const pct = prog && isSameEp(prog.episodeName, ep.name) && prog.duration > 0
                    ? Math.min(100, (prog.currentTime / prog.duration) * 100) : 0;
                  return (
                    <button key={ep.slug || i} onClick={() => { onEpisodeSelect?.(ep); closePanel(); }}
                      className={`w-full flex flex-col px-5 py-3 text-left transition-colors cursor-pointer ${isActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'}`}>
                      <div className="flex items-center gap-3">
                        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[#E50914] shrink-0" />}
                        <span className={`text-sm font-medium truncate ${isActive ? 'text-white' : 'text-white/60'}`}>{ep.name}</span>
                      </div>
                      {pct > 0 && (
                        <div className="mt-1.5 h-0.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-[#E50914] rounded-full" style={{ width:`${pct}%` }} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
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
