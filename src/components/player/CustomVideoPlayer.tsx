/**
 * CustomVideoPlayer.tsx
 * International streaming player — Consumet API + HLS.js + Vietnamese subtitles.
 *
 * Architecture:
 *  - Primary: Consumet API (FlixHQ) → raw HLS via m3u8-proxy (bypasses 403)
 *  - Fallback: VidSrc embed iframe (if Consumet fails to find the title)
 *  - Subtitles: Subdl via sub-proxy, overlay on <video> with real currentTime sync
 */

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import Hls from 'hls.js';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Subtitles,
  ChevronDown,
  Minus,
  Plus,
  RefreshCw,
  Globe,
  Loader2,
  AlertCircle,
  Check,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Settings,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { buildStreamSources } from '../../api/streamApi';
import { fetchCineproStreams, selectBestCineproSource, type CineproStreamResult } from '../../api/cineproApi';
import {
  fetchSubtitles,
  downloadSubtitleContent,
  srtToVtt,
  parseVttCues,
  applySubtitleOffset,
  type SubtitleTrack,
  type VttCue,
} from '../../api/subtitleApi';
import { SubtitleOverlay, useVideoSubtitleSync, usePlaybackTimer } from './SubtitleOverlay';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CustomVideoPlayerProps {
  tmdbId: number | string;
  imdbId?: string | null;
  mediaType: 'movie' | 'tv';
  season?: number | null;
  episode?: number | null;
  title?: string;
  posterUrl?: string;
  onClose?: () => void;
}

type SubFontSize = 'small' | 'medium' | 'large';
type SubColor = 'white' | 'yellow' | 'cyan';
type PlayerMode = 'hls' | 'iframe' | 'loading' | 'error';

interface ToastMessage { id: number; text: string }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OFFSET_STEP = 0.5;
const TOAST_DURATION_MS = 2500;
const FONT_LABEL: Record<SubFontSize, string> = { small: 'Nhỏ', medium: 'Vừa', large: 'Lớn' };
const COLOR_LABEL: Record<SubColor, string> = { white: 'Trắng', yellow: 'Vàng', cyan: 'Xanh lam' };

let toastCounter = 0;

function offsetLabel(n: number) {
  if (n === 0) return '0s';
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}s`;
}

function fmtTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const CustomVideoPlayer: React.FC<CustomVideoPlayerProps> = ({
  tmdbId,
  imdbId,
  mediaType,
  season,
  episode,
  title = 'Đang phát',
  posterUrl,
  onClose,
}) => {
  // --- Refs ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rawVttRef = useRef<string | null>(null);

  // --- Player state ---
  const [playerMode, setPlayerMode] = useState<PlayerMode>('loading');
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [iframeSourceIdx, setIframeSourceIdx] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState('Đang tải...');
  const [error, setError] = useState<string | null>(null);

  // --- Video controls state ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // --- Quality state ---
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const [currentQuality, setCurrentQuality] = useState<string>('auto');
  const [cineproResult, setCineproResult] = useState<CineproStreamResult | null>(null);

  // --- Subtitle state ---
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [activeTrackIdx, setActiveTrackIdx] = useState<number | null>(null);
  const [subtitleOffset, setSubtitleOffset] = useState(0);
  const [parsedCues, setParsedCues] = useState<VttCue[]>([]);
  const [isFetchingSubs, setIsFetchingSubs] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);
  const [subEnabled, setSubEnabled] = useState(true);
  const [subFontSize, setSubFontSize] = useState<SubFontSize>(
    () => (localStorage.getItem('cinemax_sub_size') as SubFontSize) || 'medium'
  );
  const [subColor, setSubColor] = useState<SubColor>(
    () => (localStorage.getItem('cinemax_sub_color') as SubColor) || 'white'
  );

  // --- UI panels ---
  const [showSubPanel, setShowSubPanel] = useState(false);
  const [showQualityPanel, setShowQualityPanel] = useState(false);

  // --- Toast ---
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // --- Subtitle sync: use real video.currentTime when in HLS mode ---
  const videoCurrentTimeMs = useVideoSubtitleSync(videoRef);
  // Fallback timer for iframe mode
  const [iframePlayStartedAt, setIframePlayStartedAt] = useState<number | null>(null);
  const [iframePlaybackStartMs, setIframePlaybackStartMs] = useState(0);
  const iframeCurrentTimeMs = usePlaybackTimer({
    isPlaying,
    playStartedAt: iframePlayStartedAt,
    startTimeMs: iframePlaybackStartMs,
  });

  const currentTimeMs = playerMode === 'hls' ? videoCurrentTimeMs : iframeCurrentTimeMs;

  // ===========================================================================
  // Helpers
  // ===========================================================================

  const showToast = useCallback((text: string) => {
    const id = ++toastCounter;
    setToasts(prev => [...prev, { id, text }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), TOAST_DURATION_MS);
  }, []);

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShowControls(false);
    }, 3000);
  }, []);

  // ===========================================================================
  // HLS setup
  // ===========================================================================

  const loadHlsStream = useCallback((proxiedUrl: string) => {
    const video = videoRef.current;
    if (!video) return;

    // Destroy previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        // The proxy already handles headers server-side — no need for xhrSetup
      });

      hlsRef.current = hls;
      hls.loadSource(proxiedUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        const levels = hls.levels;
        const qualities = levels.map(l => l.height ? `${l.height}p` : 'auto');
        setAvailableQualities(['auto', ...new Set(qualities)]);
        setPlayerMode('hls');
        video.play().catch(() => {
          setShowControls(true);
        });
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.error('[HLS] Fatal error:', data.type, data.details);
          showToast('Lỗi stream — đang thử VidSrc...');
          fallbackToIframe();
        }
      });

      // Sync quality selector
      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        const level = hls.levels[data.level];
        if (level) setCurrentQuality(`${level.height}p`);
      });

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      video.src = proxiedUrl;
      video.play().catch(() => {});
      setPlayerMode('hls');
    } else {
      console.warn('[HLS] Not supported, falling back to iframe');
      fallbackToIframe();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ===========================================================================
  // Fallback to embed iframe providers (VidLink, AutoEmbed, VidSrc...)
  // ===========================================================================

  // All embed iframe sources — built once
  const embedSources = useMemo(
    () => buildStreamSources({ tmdbId, imdbId, mediaType, season, episode }),
    [tmdbId, imdbId, mediaType, season, episode]
  );

  const fallbackToIframe = useCallback((sourceIdx = 0) => {
    const src = embedSources[sourceIdx] || embedSources[0];
    if (src) {
      setIframeUrl(src.embedUrl);
      setIframeSourceIdx(sourceIdx);
      setPlayerMode('iframe');
      setIframePlayStartedAt(Date.now());
      setIsPlaying(true);
    } else {
      setPlayerMode('error');
      setError('Không tìm được nguồn phát.');
    }
  }, [embedSources]);

  // ===========================================================================
  // Main load effect — Consumet → HLS → fallback
  // ===========================================================================

  useEffect(() => {
    let cancelled = false;
    setPlayerMode('loading');
    setError(null);
    setCineproResult(null);

    const cleanTitle = title
      .replace(/\s*\(Phần \d+\)/, '')
      .replace(/\s*- Tập \d+/, '')
      .replace(/\s*Season \d+/i, '')
      .trim();

    (async () => {
      // Check if CinePro is configured — if not, go straight to iframe
      const cineproConfigured = !!(import.meta.env.VITE_CINEPRO_URL);
      if (!cineproConfigured) {
        if (!cancelled) {
          setLoadingStatus('Đang tải nguồn phát...');
          fallbackToIframe(0);
        }
        return;
      }

      setLoadingStatus('Đang tìm kiếm trên CinePro...');
      try {
        const result = await fetchCineproStreams(tmdbId, mediaType, season, episode);
        if (cancelled) return;

        const bestSource = selectBestCineproSource(result.sources);
        if (bestSource && bestSource.isHLS) {
          setCineproResult(result);
          setLoadingStatus('Đang tải stream HLS...');
          const proxiedUrl = bestSource.url;
          loadHlsStream(proxiedUrl);
        } else {
          if (!cancelled) {
            setLoadingStatus('Không tìm thấy HLS trên CinePro — thử nguồn khác...');
            fallbackToIframe(0);
          }
        }
      } catch (err) {
        if (cancelled) return;
        console.warn('[CustomVideoPlayer] CinePro failed, falling back to embed:', err);
        fallbackToIframe(0);
      }
    })();

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [tmdbId, imdbId, mediaType, season, episode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ===========================================================================
  // Video event handlers
  // ===========================================================================

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => { setIsPlaying(false); setShowControls(true); };
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };
    const onDurationChange = () => setDuration(video.duration);
    const onVolumeChange = () => { setIsMuted(video.muted); setVolume(video.volume); };
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('volumechange', onVolumeChange);
    document.addEventListener('fullscreenchange', onFullscreenChange);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('volumechange', onVolumeChange);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  // ===========================================================================
  // Video controls
  // ===========================================================================

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) { video.play(); } else { video.pause(); }
  }, []);

  const seek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = parseFloat(e.target.value);
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  }, []);

  const changeVolume = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = parseFloat(e.target.value);
    video.muted = false;
  }, []);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  const changeQuality = useCallback((q: string) => {
    const hls = hlsRef.current;
    if (!hls) return;
    if (q === 'auto') {
      hls.currentLevel = -1;
    } else {
      const targetHeight = parseInt(q, 10);
      const idx = hls.levels.findIndex(l => l.height === targetHeight);
      if (idx !== -1) hls.currentLevel = idx;
    }
    setCurrentQuality(q);
    setShowQualityPanel(false);
    showToast(`Chất lượng: ${q}`);
  }, [showToast]);

  // ===========================================================================
  // Keyboard shortcuts
  // ===========================================================================

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      switch (e.key) {
        case ' ': e.preventDefault(); togglePlay(); break;
        case '[': e.preventDefault(); adjustOffset(-OFFSET_STEP); break;
        case ']': e.preventDefault(); adjustOffset(OFFSET_STEP); break;
        case 'ArrowLeft': {
          const v = videoRef.current;
          if (v) v.currentTime = Math.max(0, v.currentTime - 10);
          break;
        }
        case 'ArrowRight': {
          const v = videoRef.current;
          if (v) v.currentTime = Math.min(v.duration, v.currentTime + 10);
          break;
        }
        case 'f': e.preventDefault(); toggleFullscreen(); break;
        case 'm': e.preventDefault(); toggleMute(); break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [togglePlay, toggleFullscreen, toggleMute]); // eslint-disable-line react-hooks/exhaustive-deps

  // ===========================================================================
  // Subtitle offset
  // ===========================================================================

  const adjustOffset = useCallback((delta: number) => {
    setSubtitleOffset(prev => {
      const next = Math.round((prev + delta) * 10) / 10;
      showToast(delta > 0 ? `Sub chậm hơn ${offsetLabel(next)}` : `Sub nhanh hơn ${offsetLabel(next)}`);
      return next;
    });
  }, [showToast]);

  const resetOffset = useCallback(() => {
    setSubtitleOffset(0);
    showToast('Đặt lại sub về 0s');
  }, [showToast]);

  // Persist sub preferences
  useEffect(() => { localStorage.setItem('cinemax_sub_size', subFontSize); }, [subFontSize]);
  useEffect(() => { localStorage.setItem('cinemax_sub_color', subColor); }, [subColor]);

  // ===========================================================================
  // Subtitle loading
  // ===========================================================================

  useEffect(() => {
    let cancelled = false;
    setIsFetchingSubs(true);
    setSubError(null);
    setSubtitleTracks([]);
    setActiveTrackIdx(null);
    setParsedCues([]);
    rawVttRef.current = null;

    Promise.all([
      fetchSubtitles(tmdbId, mediaType, season, episode, 'vi', imdbId),
      fetchSubtitles(tmdbId, mediaType, season, episode, 'en', imdbId)
    ]).then(([viResult, enResult]) => {
      if (cancelled) return;
      const viTracks = (viResult.tracks || []).map(t => ({ ...t, name: `[VI] ${t.name}` }));
      const enTracks = (enResult.tracks || []).map(t => ({ ...t, name: `[EN] ${t.name}` }));
      const mergedTracks = [...viTracks, ...enTracks];

      if (mergedTracks.length > 0) {
        setSubtitleTracks(mergedTracks);
        const firstViIdx = mergedTracks.findIndex(t => t.name.startsWith('[VI]'));
        setActiveTrackIdx(firstViIdx !== -1 ? firstViIdx : 0);
      } else {
        setSubError('Không tìm thấy phụ đề.');
      }
    }).catch(() => {
      if (!cancelled) setSubError('Lỗi tải phụ đề.');
    }).finally(() => {
      if (!cancelled) setIsFetchingSubs(false);
    });

    return () => { cancelled = true; };
  }, [tmdbId, imdbId, mediaType, season, episode]);

  // Download + parse active track
  useEffect(() => {
    if (activeTrackIdx === null || !subtitleTracks[activeTrackIdx]) {
      setParsedCues([]);
      return;
    }
    const track = subtitleTracks[activeTrackIdx];
    if (!track.downloadUrl) { setParsedCues([]); return; }

    let cancelled = false;
    downloadSubtitleContent(track).then(raw => {
      if (cancelled) return;
      const vtt = track.format === 'vtt' ? raw : srtToVtt(raw);
      rawVttRef.current = vtt;
      const offsetVtt = applySubtitleOffset(vtt, subtitleOffset);
      setParsedCues(parseVttCues(offsetVtt));
    }).catch(() => {
      if (!cancelled) { setParsedCues([]); setSubError('Không tải được file phụ đề.'); }
    });

    return () => { cancelled = true; };
  }, [activeTrackIdx, subtitleTracks]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-apply offset without re-downloading
  useEffect(() => {
    if (!rawVttRef.current) return;
    const offsetVtt = applySubtitleOffset(rawVttRef.current, subtitleOffset);
    setParsedCues(parseVttCues(offsetVtt));
  }, [subtitleOffset]);

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  useEffect(() => {
    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  // ===========================================================================
  // Render
  // ===========================================================================

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl select-none group"
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => { if (isPlaying && playerMode === 'hls') setShowControls(false); }}
      onClick={() => { if (playerMode === 'hls') togglePlay(); }}
    >
      {/* ---- HLS <video> element ---- */}
      <video
        ref={videoRef}
        className={cn(
          'absolute inset-0 w-full h-full',
          playerMode !== 'hls' && 'invisible pointer-events-none'
        )}
        poster={playerMode === 'loading' ? posterUrl : undefined}
        playsInline
        onClick={e => e.stopPropagation()}
      />

      {/* ---- Iframe fallback (VidSrc) ---- */}
      {playerMode === 'iframe' && iframeUrl && (
        <iframe
          src={iframeUrl}
          title={title}
          className="absolute inset-0 w-full h-full border-0"
          allow="autoplay *; encrypted-media *; fullscreen *; picture-in-picture *"
          allowFullScreen
          sandbox={
            iframeUrl && iframeUrl.includes('cinemaos.tech')
              ? "allow-scripts allow-same-origin allow-forms"
              : undefined
          }
          referrerPolicy="origin"
          onLoad={() => {
            setIframePlayStartedAt(Date.now());
            setIsPlaying(true);
          }}
        />
      )}

      {/* ---- Loading overlay ---- */}
      {playerMode === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90">
          {posterUrl && (
            <img src={posterUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-10 blur-sm" />
          )}
          <Loader2 size={40} className="text-white/60 animate-spin relative z-10" />
          <p className="text-white/50 text-sm relative z-10 max-w-xs text-center">{loadingStatus}</p>
        </div>
      )}

      {/* ---- Error overlay ---- */}
      {playerMode === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black">
          <AlertCircle size={40} className="text-red-400" />
          <p className="text-white/60 text-sm max-w-xs text-center">{error || 'Không tìm được nguồn phát.'}</p>
        </div>
      )}

      {/* ---- Subtitle overlay ---- */}
      {subEnabled && parsedCues.length > 0 && (
        <SubtitleOverlay
          cues={parsedCues}
          currentTimeMs={currentTimeMs}
          fontSize={subFontSize}
          color={subColor}
        />
      )}

      {/* ---- Source badge ---- */}
      {playerMode === 'hls' && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 pointer-events-none">
          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[9px] font-bold uppercase tracking-widest border border-emerald-500/30">
            HLS · Consumet
          </span>
        </div>
      )}
      {playerMode === 'iframe' && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 pointer-events-none">
          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[9px] font-bold uppercase tracking-widest border border-amber-500/30">
            VidSrc · Fallback
          </span>
        </div>
      )}

      {/* ---- Close button ---- */}
      {onClose && (
        <button
          onClick={e => { e.stopPropagation(); onClose(); }}
          className="absolute top-3 right-3 z-30 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 flex items-center justify-center transition-colors"
        >
          <X size={15} className="text-white" />
        </button>
      )}

      {/* ---- HLS controls (hidden over iframe) ---- */}
      {playerMode === 'hls' && (
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex flex-col justify-end pointer-events-none z-20"
              onClick={e => e.stopPropagation()}
            >
              {/* Gradient */}
              <div className="h-32 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

              {/* Progress bar */}
              <div className="px-3 pb-1 pointer-events-auto">
                <div className="relative h-1 group/seek rounded-full overflow-hidden cursor-pointer">
                  {/* Buffered */}
                  <div
                    className="absolute inset-y-0 left-0 bg-white/20 rounded-full"
                    style={{ width: duration > 0 ? `${(buffered / duration) * 100}%` : '0%' }}
                  />
                  {/* Playback */}
                  <div
                    className="absolute inset-y-0 left-0 bg-red-500 rounded-full"
                    style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    step={0.5}
                    value={currentTime}
                    onChange={seek}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer h-1"
                  />
                </div>
              </div>

              {/* Controls row */}
              <div className="px-3 pb-3 flex items-center gap-2 pointer-events-auto bg-gradient-to-t from-black/80 to-transparent">
                {/* Play/Pause */}
                <button
                  onClick={togglePlay}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white"
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                </button>

                {/* Volume */}
                <button
                  onClick={e => { e.stopPropagation(); toggleMute(); }}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white"
                >
                  {isMuted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={changeVolume}
                  className="w-16 accent-red-500 cursor-pointer"
                />

                {/* Time */}
                <span className="text-white/60 text-[10px] font-mono tabular-nums">
                  {fmtTime(currentTime)} / {fmtTime(duration)}
                </span>

                <div className="flex-1" />

                {/* Subtitle offset */}
                <div className="flex items-center gap-1 bg-white/5 rounded-xl px-2 py-1 border border-white/10">
                  <Subtitles size={11} className="text-white/50 shrink-0" />
                  <button
                    onClick={e => { e.stopPropagation(); adjustOffset(-OFFSET_STEP); }}
                    title="Sub nhanh hơn [ "
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                  >
                    <Minus size={10} />
                  </button>
                  <span className={cn(
                    'text-[10px] font-mono font-bold min-w-[32px] text-center tabular-nums',
                    subtitleOffset === 0 ? 'text-white/40' : 'text-emerald-400'
                  )}>
                    {offsetLabel(subtitleOffset)}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); adjustOffset(OFFSET_STEP); }}
                    title="Sub chậm hơn ]"
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                  >
                    <Plus size={10} />
                  </button>
                  {subtitleOffset !== 0 && (
                    <button onClick={e => { e.stopPropagation(); resetOffset(); }} className="w-4 h-4 flex items-center justify-center rounded hover:bg-white/10 text-white/30 hover:text-white transition-colors">
                      <RefreshCw size={8} />
                    </button>
                  )}
                </div>

                {/* Sub enable */}
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setSubEnabled(p => !p);
                    showToast(subEnabled ? 'Tắt phụ đề' : 'Bật phụ đề');
                  }}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-xl border text-[9px] font-bold uppercase tracking-wider transition-all',
                    subEnabled && parsedCues.length > 0
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      : 'bg-white/5 border-white/10 text-white/40'
                  )}
                >
                  {isFetchingSubs ? <Loader2 size={9} className="animate-spin" /> : <Subtitles size={9} />}
                  {isFetchingSubs ? 'Sub...' : 'Sub VI'}
                </button>

                {/* Sub settings */}
                <div className="relative">
                  <button
                    onClick={e => { e.stopPropagation(); setShowSubPanel(p => !p); setShowQualityPanel(false); }}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white/60 hover:text-white"
                  >
                    <Settings size={13} />
                  </button>
                  <AnimatePresence>
                    {showSubPanel && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute bottom-full mb-2 right-0 bg-black/95 border border-white/10 rounded-2xl p-3 min-w-[190px] shadow-2xl z-50"
                        onClick={e => e.stopPropagation()}
                      >
                        <p className="text-white/40 text-[9px] uppercase tracking-widest font-bold mb-2">Cỡ chữ phụ đề</p>
                        <div className="flex gap-1.5 mb-3">
                          {(['small', 'medium', 'large'] as SubFontSize[]).map(size => (
                            <button key={size} onClick={() => setSubFontSize(size)}
                              className={cn('flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all',
                                subFontSize === size ? 'bg-white text-black' : 'bg-white/5 text-white/60 hover:bg-white/10')}>
                              {FONT_LABEL[size]}
                            </button>
                          ))}
                        </div>
                        <p className="text-white/40 text-[9px] uppercase tracking-widest font-bold mb-2">Màu chữ</p>
                        <div className="flex gap-1.5 mb-3">
                          {(['white', 'yellow', 'cyan'] as SubColor[]).map(c => (
                            <button key={c} onClick={() => setSubColor(c)}
                              className={cn('flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border',
                                subColor === c ? 'border-white/40 bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/10')}
                              style={{ color: c === 'white' ? '#fff' : c === 'yellow' ? '#ffd700' : '#00e5ff' }}>
                              {COLOR_LABEL[c]}
                            </button>
                          ))}
                        </div>
                        {subtitleTracks.length > 1 && (
                          <>
                            <p className="text-white/40 text-[9px] uppercase tracking-widest font-bold mb-2">Nguồn phụ đề</p>
                            <div className="flex flex-col gap-1 max-h-[160px] overflow-y-auto pr-1">
                              {subtitleTracks.slice(0, 15).map((track, idx) => (
                                <button key={track.id} onClick={() => setActiveTrackIdx(idx)}
                                  className={cn('text-left px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all truncate',
                                    activeTrackIdx === idx ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white/80')}>
                                  {idx === activeTrackIdx && <Check size={8} className="inline mr-1 text-emerald-400" />}
                                  {track.name}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Quality selector */}
                {availableQualities.length > 1 && (
                  <div className="relative">
                    <button
                      onClick={e => { e.stopPropagation(); setShowQualityPanel(p => !p); setShowSubPanel(false); }}
                      className="flex items-center gap-1 px-2 py-1 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-white/60 hover:text-white text-[9px] font-bold uppercase"
                    >
                      <Globe size={9} />
                      {currentQuality}
                      <ChevronDown size={8} className={cn('transition-transform', showQualityPanel && 'rotate-180')} />
                    </button>
                    <AnimatePresence>
                      {showQualityPanel && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="absolute bottom-full mb-2 right-0 bg-black/95 border border-white/10 rounded-2xl p-2 min-w-[120px] z-50"
                          onClick={e => e.stopPropagation()}
                        >
                          {availableQualities.map(q => (
                            <button key={q} onClick={() => changeQuality(q)}
                              className={cn('w-full text-left px-2.5 py-2 rounded-xl text-[11px] font-medium transition-all',
                                currentQuality === q ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white/80')}>
                              {currentQuality === q && <Check size={8} className="inline mr-1 text-emerald-400" />}
                              {q}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Fullscreen */}
                <button
                  onClick={e => { e.stopPropagation(); toggleFullscreen(); }}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white/60 hover:text-white"
                >
                  <Maximize2 size={13} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* ---- Iframe subtitle + source controls ---- */}
      {playerMode === 'iframe' && (
        <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
          <div className="bg-black/60 backdrop-blur-sm px-3 py-2 flex items-center gap-2 pointer-events-auto flex-wrap">
            {/* Subtitle offset */}
            <div className="flex items-center gap-1 bg-white/5 rounded-xl px-2 py-1 border border-white/10">
              <Subtitles size={11} className="text-white/50 shrink-0" />
              <button onClick={() => adjustOffset(-OFFSET_STEP)} title="[ Sub nhanh hơn"
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-white/70 transition-colors">
                <Minus size={10} />
              </button>
              <span className={cn('text-[10px] font-mono font-bold min-w-[32px] text-center',
                subtitleOffset === 0 ? 'text-white/40' : 'text-emerald-400')}>
                {offsetLabel(subtitleOffset)}
              </span>
              <button onClick={() => adjustOffset(OFFSET_STEP)} title="] Sub chậm hơn"
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-white/70 transition-colors">
                <Plus size={10} />
              </button>
              {subtitleOffset !== 0 && (
                <button onClick={resetOffset} className="w-4 h-4 flex items-center justify-center rounded hover:bg-white/10 text-white/30 hover:text-white transition-colors">
                  <RefreshCw size={8} />
                </button>
              )}
            </div>

            {/* Sub enable */}
            <button
              onClick={() => { setSubEnabled(p => !p); showToast(subEnabled ? 'Tắt phụ đề' : 'Bật phụ đề'); }}
              className={cn('flex items-center gap-1 px-2 py-1 rounded-xl border text-[9px] font-bold uppercase tracking-wider transition-all',
                subEnabled && parsedCues.length > 0
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-white/5 border-white/10 text-white/40')}>
              {parsedCues.length > 0 ? <Check size={9} /> : <Subtitles size={9} />}
              {isFetchingSubs ? 'Sub...' : 'Sub VI'}
            </button>

            <div className="flex-1" />

            {/* Embed source switcher */}
            {embedSources.length > 1 && (
              <div className="flex items-center gap-1">
                {embedSources.slice(0, 5).map((src, idx) => (
                  <button
                    key={src.key}
                    onClick={() => {
                      fallbackToIframe(idx);
                      showToast(`Đổi sang ${src.label}`);
                    }}
                    title={src.label}
                    className={cn(
                      'px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border',
                      iframeSourceIdx === idx
                        ? 'bg-white/15 border-white/30 text-white'
                        : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/70'
                    )}
                  >
                    {src.label.replace(' HD', '').replace('VidSrc.me', 'VS.me').replace('VidSrc Pro', 'VSPro')}
                  </button>
                ))}
              </div>
            )}

            {/* Sub sync timer */}
            <button
              onClick={() => {
                if (isPlaying) {
                  setIsPlaying(false); setIframePlaybackStartMs(iframeCurrentTimeMs); setIframePlayStartedAt(null);
                } else {
                  setIframePlayStartedAt(Date.now()); setIsPlaying(true);
                }
                showToast(isPlaying ? 'Sub sync tạm dừng' : 'Sub sync tiếp tục');
              }}
              title="Sync subtitle timer"
              className="w-7 h-7 flex items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-white/60 hover:text-white"
            >
              {isPlaying ? (
                <span className="flex gap-0.5">
                  <span className="w-1 h-3 bg-current rounded-sm" />
                  <span className="w-1 h-3 bg-current rounded-sm" />
                </span>
              ) : <Play size={10} className="ml-0.5" />}
            </button>
          </div>
        </div>
      )}


      {/* ---- Toasts ---- */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 z-50 pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div key={t.id}
              initial={{ opacity: 0, y: -8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.18 }}
              className="bg-black/85 backdrop-blur-md border border-white/15 text-white text-xs font-medium px-4 py-2 rounded-full shadow-xl whitespace-nowrap"
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ---- Sub error badge ---- */}
      {subError && !isFetchingSubs && parsedCues.length === 0 && (
        <div className="absolute top-12 right-3 flex items-center gap-1.5 bg-black/70 border border-white/10 rounded-xl px-2.5 py-1.5 text-[10px] text-white/50 pointer-events-none z-20">
          <AlertCircle size={10} className="text-amber-400/70" />
          {subError}
        </div>
      )}
    </div>
  );
};
