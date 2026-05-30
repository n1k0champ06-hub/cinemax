/**
 * UnifiedPlayer.tsx — Unified player for Meta-Streaming Aggregator
 *
 * Handles two stream types:
 *  - 'hls': native <video> + hls.js (when stream.type === 'hls')
 *  - 'embed': <iframe> with subtitle overlay (when stream.type === 'embed')
 *
 * The StreamPicker drives which stream is active. This component just plays it.
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import Hls from 'hls.js';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  Settings, SkipForward, SkipBack, Loader2, AlertCircle,
  RefreshCw, Subtitles, Plus, Minus, Check,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { SubtitleOverlay } from './SubtitleOverlay';
import type { StreamItem } from '../../api/streamProviders/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UnifiedPlayerProps {
  stream: StreamItem | null;
  /** Subtitle .srt/.vtt URL */
  subtitleUrl?: string | null;
  /** Movie/episode title for display */
  title?: string;
  /** Called when playback starts */
  onPlay?: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Subtitle toast
// ---------------------------------------------------------------------------

let toastId = 0;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const UnifiedPlayer: React.FC<UnifiedPlayerProps> = ({
  stream,
  subtitleUrl,
  title,
  onPlay,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Video state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Subtitle state
  const [subtitleOffset, setSubtitleOffset] = useState(0);
  const [subEnabled, setSubEnabled] = useState(true);
  const OFFSET_STEP = 250;

  // Toast
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);

  // Iframe sync
  const [iframePlayStart, setIframePlayStart] = useState<number | null>(null);
  const [iframeBase, setIframeBase] = useState(0);
  const iframeCurrentMs = useMemo(() => {
    if (!iframePlayStart) return iframeBase;
    return iframeBase + (Date.now() - iframePlayStart);
  }, [iframePlayStart, iframeBase]);

  const showToast = useCallback((text: string) => {
    const id = ++toastId;
    setToasts(p => [...p, { id, text }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 2200);
  }, []);

  const adjustOffset = useCallback((delta: number) => {
    setSubtitleOffset(prev => {
      const next = prev + delta;
      showToast(`Sub ${next >= 0 ? '+' : ''}${(next / 1000).toFixed(2)}s`);
      return next;
    });
  }, [showToast]);

  const resetOffset = useCallback(() => {
    setSubtitleOffset(0);
    showToast('Reset sub offset');
  }, [showToast]);

  const offsetLabel = (ms: number) => `${ms >= 0 ? '+' : ''}${(ms / 1000).toFixed(1)}s`;

  // ---------------------------------------------------------------------------
  // Load HLS stream
  // ---------------------------------------------------------------------------

  const loadHls = useCallback((url: string, headers?: Record<string, string>) => {
    const video = videoRef.current;
    if (!video) return;

    setIsLoading(true);
    setLoadError(null);

    // Clean up previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        maxMaxBufferLength: 60,
        enableWorker: true,
        xhrSetup: (xhr, url) => {
          if (headers?.['Referer']) xhr.setRequestHeader('Referer', headers['Referer']);
        },
      });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          setLoadError('Không thể tải stream HLS. Thử chọn nguồn khác.');
          setIsLoading(false);
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      video.src = url;
      video.load();
      video.play().catch(() => {});
      setIsLoading(false);
    } else {
      setLoadError('Trình duyệt không hỗ trợ HLS.');
      setIsLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Load stream when active stream changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!stream) return;

    setLoadError(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsLoading(true);

    if (stream.type === 'hls') {
      loadHls(stream.url, stream.headers);
    } else {
      // embed — just show iframe
      setIsLoading(false);
      setIframePlayStart(Date.now());
      setIframeBase(0);
      setIsPlaying(true);
      onPlay?.();
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [stream?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Video event listeners
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => { setIsPlaying(true); setIsBuffering(false); };
    const onPause = () => { setIsPlaying(false); setShowControls(true); };
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onDurationChange = () => setDuration(video.duration || 0);
    const onWaiting = () => setIsBuffering(true);
    const onCanPlay = () => setIsBuffering(false);
    const onEnded = () => { setIsPlaying(false); setShowControls(true); };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('ended', onEnded);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('ended', onEnded);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Controls auto-hide
  // ---------------------------------------------------------------------------

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (isPlaying && stream?.type === 'hls') setShowControls(false);
    }, 2800);
  }, [isPlaying, stream?.type]);

  // ---------------------------------------------------------------------------
  // Controls handlers
  // ---------------------------------------------------------------------------

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || stream?.type !== 'hls') return;
    if (video.paused) video.play();
    else video.pause();
  }, [stream?.type]);

  const seek = useCallback((secs: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.currentTime + secs, duration));
  }, [duration]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const changeVolume = useCallback((v: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = v;
    setVolume(v);
    if (v === 0) video.muted = true;
    else video.muted = false;
    setIsMuted(v === 0);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // Keyboard shortcuts (only when HLS mode)
  useEffect(() => {
    if (stream?.type !== 'hls') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.code === 'ArrowLeft') seek(-10);
      if (e.code === 'ArrowRight') seek(10);
      if (e.code === 'ArrowUp') changeVolume(Math.min(1, volume + 0.1));
      if (e.code === 'ArrowDown') changeVolume(Math.max(0, volume - 0.1));
      if (e.code === 'KeyF') toggleFullscreen();
      if (e.code === 'BracketLeft') adjustOffset(-OFFSET_STEP);
      if (e.code === 'BracketRight') adjustOffset(OFFSET_STEP);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [togglePlay, seek, changeVolume, toggleFullscreen, adjustOffset, volume, stream?.type]);

  // ---------------------------------------------------------------------------
  // Time formatting
  // ---------------------------------------------------------------------------

  const fmt = (s: number) => {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // ---------------------------------------------------------------------------
  // No stream state
  // ---------------------------------------------------------------------------

  if (!stream) {
    return (
      <div className={cn('relative bg-black flex items-center justify-center', className)}>
        <div className="text-center space-y-2">
          <Loader2 size={28} className="animate-spin text-white/20 mx-auto" />
          <p className="text-white/30 text-sm">Đang tìm nguồn phát...</p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isHls = stream.type === 'hls';

  return (
    <div
      ref={containerRef}
      className={cn('relative bg-black overflow-hidden select-none', className)}
      onMouseMove={resetControlsTimer}
      onMouseLeave={() => { if (isPlaying && isHls) setShowControls(false); }}
    >
      {/* ---- HLS video element ---- */}
      {isHls && (
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          playsInline
          onClick={togglePlay}
        />
      )}

      {/* ---- Embed iframe ---- */}
      {!isHls && (
        <iframe
          key={stream.id}
          src={stream.url}
          className="w-full h-full border-0 absolute inset-0 z-0 bg-black pointer-events-auto"
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          sandbox={
            stream.url && (stream.url.includes('cinemaos.tech') || stream.url.includes('vidsrc') || stream.url.includes('embed.su'))
              ? "allow-scripts allow-forms"
              : "allow-scripts allow-same-origin allow-forms"
          }
          referrerPolicy="origin"
          title={stream.label}
        />
      )}

      {/* ---- Subtitle Overlay ---- */}
      <SubtitleOverlay
        subtitleUrl={subtitleUrl || null}
        videoRef={isHls ? videoRef : undefined}
        currentTimeMs={isHls ? undefined : iframeCurrentMs}
        offsetMs={subtitleOffset}
        enabled={subEnabled}
      />

      {/* ---- Loading / buffering ---- */}
      <AnimatePresence>
        {(isLoading || isBuffering) && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/40 z-10 pointer-events-none"
          >
            <Loader2 size={36} className="animate-spin text-white/60" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- Error overlay ---- */}
      <AnimatePresence>
        {loadError && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 gap-3"
          >
            <AlertCircle size={28} className="text-red-400" />
            <p className="text-white/70 text-sm text-center max-w-xs">{loadError}</p>
            <button
              onClick={() => { setLoadError(null); loadHls(stream.url, stream.headers); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
            >
              <RefreshCw size={13} />
              Thử lại
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- HLS Controls ---- */}
      {isHls && (
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 flex flex-col justify-end z-30 pointer-events-none"
            >
              {/* Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

              {/* Title */}
              {title && (
                <div className="absolute top-0 left-0 right-0 p-4">
                  <p className="text-white/70 text-sm font-medium line-clamp-1">{title}</p>
                </div>
              )}

              {/* Controls bar */}
              <div className="relative z-10 px-4 pb-4 space-y-2 pointer-events-auto">
                {/* Progress */}
                <input
                  type="range"
                  min={0}
                  max={duration || 1}
                  step={0.5}
                  value={currentTime}
                  onChange={e => {
                    const v = parseFloat(e.target.value);
                    if (videoRef.current) videoRef.current.currentTime = v;
                    setCurrentTime(v);
                  }}
                  className="w-full h-1 accent-red-500 cursor-pointer"
                />

                {/* Buttons row */}
                <div className="flex items-center gap-2">
                  <button onClick={() => seek(-10)} className="p-1.5 hover:bg-white/10 rounded text-white/70 hover:text-white transition-colors">
                    <SkipBack size={16} />
                  </button>
                  <button onClick={togglePlay} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
                    {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                  <button onClick={() => seek(10)} className="p-1.5 hover:bg-white/10 rounded text-white/70 hover:text-white transition-colors">
                    <SkipForward size={16} />
                  </button>

                  <button onClick={toggleMute} className="p-1.5 hover:bg-white/10 rounded text-white/70 hover:text-white transition-colors">
                    {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                  </button>
                  <input
                    type="range" min={0} max={1} step={0.05} value={isMuted ? 0 : volume}
                    onChange={e => changeVolume(parseFloat(e.target.value))}
                    className="w-20 h-1 accent-white cursor-pointer"
                  />

                  <span className="text-white/50 text-xs font-mono ml-1">
                    {fmt(currentTime)} / {fmt(duration)}
                  </span>

                  <div className="flex-1" />

                  {/* Sub offset */}
                  <div className="flex items-center gap-1 bg-white/5 rounded-lg px-1.5 py-1 border border-white/10">
                    <Subtitles size={10} className="text-white/40" />
                    <button onClick={() => adjustOffset(-OFFSET_STEP)} className="w-4 h-4 flex items-center justify-center hover:bg-white/10 rounded text-white/60">
                      <Minus size={9} />
                    </button>
                    <span className={cn('text-[9px] font-mono font-bold min-w-[28px] text-center', subtitleOffset === 0 ? 'text-white/30' : 'text-emerald-400')}>
                      {offsetLabel(subtitleOffset)}
                    </span>
                    <button onClick={() => adjustOffset(OFFSET_STEP)} className="w-4 h-4 flex items-center justify-center hover:bg-white/10 rounded text-white/60">
                      <Plus size={9} />
                    </button>
                    {subtitleOffset !== 0 && (
                      <button onClick={resetOffset} className="w-3 h-3 flex items-center justify-center text-white/20 hover:text-white transition-colors">
                        <RefreshCw size={7} />
                      </button>
                    )}
                  </div>

                  {/* Sub toggle */}
                  <button
                    onClick={() => { setSubEnabled(p => !p); showToast(subEnabled ? 'Tắt phụ đề' : 'Bật phụ đề'); }}
                    className={cn(
                      'flex items-center gap-1 px-1.5 py-1 rounded-lg border text-[9px] font-bold uppercase transition-all',
                      subEnabled ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-white/30'
                    )}
                  >
                    <Check size={8} />
                    Sub VI
                  </button>

                  <button onClick={toggleFullscreen} className="p-1.5 hover:bg-white/10 rounded text-white/70 hover:text-white transition-colors">
                    {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* ---- Embed iframe controls (sub offset only) ---- */}
      {!isHls && (
        <div className="absolute bottom-0 left-0 right-0 z-20">
          <div className="bg-black/60 backdrop-blur-sm px-3 py-2 flex items-center gap-2">
            <Subtitles size={11} className="text-white/40 shrink-0" />
            <button onClick={() => adjustOffset(-OFFSET_STEP)} className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-white/60">
              <Minus size={9} />
            </button>
            <span className={cn('text-[10px] font-mono font-bold min-w-[32px] text-center', subtitleOffset === 0 ? 'text-white/30' : 'text-emerald-400')}>
              {offsetLabel(subtitleOffset)}
            </span>
            <button onClick={() => adjustOffset(OFFSET_STEP)} className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-white/60">
              <Plus size={9} />
            </button>
            {subtitleOffset !== 0 && (
              <button onClick={resetOffset} className="w-4 h-4 flex items-center justify-center text-white/20 hover:text-white transition-colors">
                <RefreshCw size={7} />
              </button>
            )}

            <button
              onClick={() => { setSubEnabled(p => !p); showToast(subEnabled ? 'Tắt phụ đề' : 'Bật phụ đề'); }}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-lg border text-[9px] font-bold uppercase ml-1 transition-all',
                subEnabled ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-white/30'
              )}
            >
              {subEnabled ? <Check size={8} /> : <Subtitles size={8} />}
              Sub VI
            </button>

            <div className="flex-1" />

            {/* Sub sync control for iframe */}
            <button
              onClick={() => {
                if (iframePlayStart) {
                  setIframeBase(iframeCurrentMs);
                  setIframePlayStart(null);
                  setIsPlaying(false);
                  showToast('Sub sync tạm dừng');
                } else {
                  setIframePlayStart(Date.now());
                  setIsPlaying(true);
                  showToast('Sub sync tiếp tục');
                }
              }}
              title="Sync subtitle timer"
              className="w-7 h-7 flex items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-white/50 hover:text-white"
            >
              {iframePlayStart ? (
                <span className="flex gap-0.5">
                  <span className="w-1 h-3 bg-current rounded-sm" />
                  <span className="w-1 h-3 bg-current rounded-sm" />
                </span>
              ) : <Play size={9} className="ml-0.5" />}
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
    </div>
  );
};
