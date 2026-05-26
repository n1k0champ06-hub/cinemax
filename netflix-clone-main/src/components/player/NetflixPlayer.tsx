import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Play, Pause, Rewind, FastForward, Maximize, VolumeX, Volume2, Settings, ArrowLeft, Loader2, Check, PictureInPicture, RotateCcw, RotateCw, List } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Hls from 'hls.js';
import { useWatchProgress } from '../../hooks/useStorage';
import { cn } from '../../lib/utils';

export const NetflixPlayer = ({ 
  url, embedUrl, title, slug, episodeName, posterUrl, movieName, onClose,
  servers, selectedServerId, onServerChange,
  episodes, onEpisodeSelect
}: { 
  url?: string, embedUrl?: string, title?: string, slug?: string, episodeName?: string, posterUrl?: string, movieName?: string, onClose?: () => void,
  servers?: any[], selectedServerId?: number, onServerChange?: (id: number) => void,
  episodes?: any[], onEpisodeSelect?: (ep: any) => void
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isSpeeding, setIsSpeeding] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEpisodesOpen, setIsEpisodesOpen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [seekIndicator, setSeekIndicator] = useState<'fwd' | 'rev' | null>(null);
  const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { saveProgress } = useWatchProgress();
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isHoldingRef = useRef(false);
  const wasLongPressRef = useRef(false);

  const isIframeMode = !url && !!embedUrl;

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
          const savedProgress = parsed[slug];
          if (savedProgress && savedProgress.episodeName === episodeName && savedProgress.currentTime) {
             initialTime = savedProgress.currentTime - 2;
             if (initialTime < 0) initialTime = 0;
          }
        }
      }
    } catch (e) {}

    const handleReady = () => {
      if (initialTime > 0 && video) {
        video.currentTime = initialTime;
      }
      video.play().catch(() => setIsPlaying(false));
    };

    let hls: Hls | null = null;
    
    if (Hls.isSupported()) {
      hls = new Hls({ maxBufferLength: 30 });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, handleReady);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.addEventListener('loadedmetadata', handleReady);
    }

    return () => {
      if (hls) hls.destroy();
      video.removeEventListener('loadedmetadata', handleReady);
    };
  }, [url, slug, episodeName]);

  // Save progress periodically and on unmount
  useEffect(() => {
    if (!slug || !episodeName || !posterUrl || !movieName) return;
    
    const save = () => {
      const vid = videoRef.current;
      if (vid && vid.duration > 0) {
        saveProgress(slug, {
          episodeName,
          currentTime: vid.currentTime,
          duration: vid.duration,
          savedAt: Date.now(),
          posterUrl,
          movieName
        });
      }
    };

    const interval = setInterval(save, 10000); // every 10s
    return () => {
      clearInterval(interval);
      save();
    };
  }, [slug, episodeName, posterUrl, movieName, saveProgress]);

  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (isPlaying && !isSettingsOpen && !isEpisodesOpen) setShowControls(false);
    }, 4000);
  }, [isPlaying, isSettingsOpen, isEpisodesOpen]);

  useEffect(() => {
    resetControlsTimeout();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [resetControlsTimeout]);

  const togglePlay = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (wasLongPressRef.current) {
      wasLongPressRef.current = false;
      return;
    }
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>, direction: 'fwd' | 'rev') => {
    if (wasLongPressRef.current) {
      wasLongPressRef.current = false;
      return;
    }
    if (e.detail === 2 && videoRef.current) {
      videoRef.current.currentTime += (direction === 'fwd' ? 10 : -10);
      setSeekIndicator(direction);
      if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
      seekTimeoutRef.current = setTimeout(() => setSeekIndicator(null), 600);
      resetControlsTimeout();
    }
  };

  const togglePiP = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.error('PiP failed', err);
    }
  };

  const handleHoldSpeedStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (e.type === 'mousedown' && (e as React.MouseEvent).button !== 0) return;
    
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    
    isHoldingRef.current = true;
    wasLongPressRef.current = false;
    
    holdTimeoutRef.current = setTimeout(() => {
      if (isHoldingRef.current && videoRef.current) {
        videoRef.current.playbackRate = 2.0;
        setIsSpeeding(true);
        wasLongPressRef.current = true;
      }
    }, 450);
  }, []);

  const handleHoldSpeedEnd = useCallback((e?: React.TouchEvent | React.MouseEvent) => {
    isHoldingRef.current = false;
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    
    if (isSpeeding) {
      if (videoRef.current) {
        videoRef.current.playbackRate = playbackRate;
      }
      setIsSpeeding(false);
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }, [isSpeeding, playbackRate]);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const container = containerRef.current;
    const video = videoRef.current;
    
    if (!container || !video) return;

    const doc = document as any;
    const isFull = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);

    if (!isFull) {
      try {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if ((container as any).webkitRequestFullscreen) {
          await (container as any).webkitRequestFullscreen();
        } else if ((video as any).webkitEnterFullscreen) {
          await (video as any).webkitEnterFullscreen();
        }
        setIsFullscreen(true);
        // Try to lock orientation to landscape on mobile
        if (screen.orientation && (screen.orientation as any).lock) {
          await (screen.orientation as any).lock('landscape').catch(() => {});
        }
      } catch (err) {
        console.error('Fullscreen failed', err);
      }
    } else {
      try {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
        setIsFullscreen(false);
        if (screen.orientation && screen.orientation.unlock) {
          screen.orientation.unlock();
        }
      } catch (err) {
        console.error('Exit fullscreen failed', err);
      }
    }
  };

  const handleRateChange = (rate: number) => {
    if (videoRef.current) {
        videoRef.current.playbackRate = rate;
        setPlaybackRate(rate);
        setIsSettingsOpen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      const isFull = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);
      setIsFullscreen(isFull);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
       document.removeEventListener('fullscreenchange', handleFullscreenChange);
       document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (isIframeMode) return;

      const video = videoRef.current;
      if (!video) return;

      resetControlsTimeout();

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          if (video.paused) { video.play(); setIsPlaying(true); }
          else { video.pause(); setIsPlaying(false); }
          break;
        case 'arrowleft':
        case 'j':
          e.preventDefault();
          video.currentTime -= 10;
          setSeekIndicator('rev');
          if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
          seekTimeoutRef.current = setTimeout(() => setSeekIndicator(null), 600);
          break;
        case 'arrowright':
        case 'l':
          e.preventDefault();
          video.currentTime += 10;
          setSeekIndicator('fwd');
          if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
          seekTimeoutRef.current = setTimeout(() => setSeekIndicator(null), 600);
          break;
        case 'arrowup':
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.05);
          video.muted = false;
          setIsMuted(false);
          break;
        case 'arrowdown':
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.05);
          if (video.volume === 0) {
            video.muted = true;
            setIsMuted(true);
          }
          break;
        case 'm':
          e.preventDefault();
          video.muted = !video.muted;
          setIsMuted(video.muted);
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen({ stopPropagation: () => {} } as any);
          break;
        case '>':
          e.preventDefault();
          const nextRate = Math.min(2.0, video.playbackRate + 0.25);
          video.playbackRate = nextRate;
          setPlaybackRate(nextRate);
          break;
        case '<':
          e.preventDefault();
          const prevRate = Math.max(0.5, video.playbackRate - 0.25);
          video.playbackRate = prevRate;
          setPlaybackRate(prevRate);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isIframeMode, isFullscreen, playbackRate, resetControlsTimeout]);

  const toggleControlsMobile = () => {
    setShowControls(prev => {
      const next = !prev;
      if (!next) {
         setIsSettingsOpen(false);
         setIsEpisodesOpen(false);
      }
      return next;
    });
    resetControlsTimeout();
  };
      
  return (
    <div 
      ref={containerRef}
      className={cn("relative w-full h-full bg-black group", isFullscreen ? "overflow-hidden" : "")}
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => { if(isPlaying && !isSettingsOpen && !isEpisodesOpen) setShowControls(false); }}
      onClick={toggleControlsMobile}
    >
      {isIframeMode ? (
        <iframe 
          src={embedUrl}
          className="w-full h-full border-0 absolute inset-0 z-0 bg-black pointer-events-auto"
          allowFullScreen
          allow="autoplay; fullscreen"
          referrerPolicy="origin"
        />
      ) : (
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          playsInline
          onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
          onDurationChange={() => setDuration(videoRef.current?.duration || 0)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onCanPlay={() => setIsBuffering(false)}
        />
      )}

      <div 
        className={cn("absolute inset-0 flex z-10 select-none", isIframeMode && "pointer-events-none")}
        onMouseDown={!isIframeMode ? handleHoldSpeedStart : undefined}
        onMouseUp={!isIframeMode ? handleHoldSpeedEnd : undefined}
        onMouseLeave={!isIframeMode ? handleHoldSpeedEnd : undefined}
        onTouchStart={!isIframeMode ? handleHoldSpeedStart : undefined}
        onTouchEnd={!isIframeMode ? handleHoldSpeedEnd : undefined}
      >
        <div 
          className={cn("w-1/3 h-full cursor-pointer flex items-center justify-center relative select-none", !isIframeMode && "pointer-events-auto")} 
          onClick={!isIframeMode ? (e) => handleSeek(e, 'rev') : undefined} 
        >
          <AnimatePresence>
            {!isIframeMode && seekIndicator === 'rev' && (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.2 }} className="pointer-events-none flex flex-col items-center justify-center text-white/90 bg-black/20 rounded-full w-24 h-24 sm:w-32 sm:h-32 backdrop-blur-sm shadow-xl">
                 <RotateCcw size={32} />
                 <span className="mt-1 font-bold text-sm select-none">-10s</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div 
          className={cn("w-1/3 h-full cursor-pointer flex items-center justify-center", !isIframeMode && "pointer-events-auto")} 
          onClick={!isIframeMode ? togglePlay : undefined} 
        />
        <div 
          className={cn("w-1/3 h-full cursor-pointer flex items-center justify-center relative select-none", !isIframeMode && "pointer-events-auto")} 
          onClick={!isIframeMode ? (e) => handleSeek(e, 'fwd') : undefined}
        >
          <AnimatePresence>
            {!isIframeMode && seekIndicator === 'fwd' && (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.2 }} className="pointer-events-none flex flex-col items-center justify-center text-white/90 bg-black/20 rounded-full w-24 h-24 sm:w-32 sm:h-32 backdrop-blur-sm shadow-xl">
                 <RotateCw size={32} />
                 <span className="mt-1 font-bold text-sm select-none">+10s</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {!isIframeMode && isBuffering && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 text-red-600">
            <Loader2 size={48} className="animate-spin drop-shadow-lg" />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {((!isIframeMode && showControls) || (!isPlaying && !isIframeMode) || (isIframeMode && showControls)) && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="absolute top-0 w-full bg-gradient-to-b from-black/80 via-black/40 to-transparent p-4 md:p-6 z-30 pointer-events-auto flex items-center gap-4 text-white">
            {onClose && (
              <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="hover:text-gray-300 p-2 -ml-2 rounded-full hover:bg-white/20 bg-black/50 sm:bg-transparent backdrop-blur-sm transition-colors border border-white/10 sm:border-transparent">
                <ArrowLeft size={28} />
              </button>
            )}
            <h2 className="font-bold text-base md:text-xl drop-shadow-md truncate pr-8 cursor-default">{title}</h2>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Permanent Back Button for Iframe Mode just in case controls disappear */}
      {isIframeMode && onClose && !showControls && (
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="absolute top-4 left-4 md:top-6 md:left-6 z-50 text-white hover:text-gray-300 p-2 rounded-full hover:bg-white/20 bg-black/50 backdrop-blur-sm transition-colors border border-white/10">
           <ArrowLeft size={28} />
        </button>
      )}

      <AnimatePresence>
        {!isIframeMode && isSpeeding && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/60 rounded-full px-4 py-2 text-white flex items-center gap-2 font-bold z-20 pointer-events-none">
            <FastForward size={20} fill="currentColor" /> 2x Tốc độ
          </motion.div>
        )}
      </AnimatePresence>

      {/* Center play icon animation (optional, but keep it simple with just controls) */}
      <AnimatePresence>
        {!isIframeMode && !isPlaying && showControls && !isBuffering && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 text-white/50">
             <div className="w-20 h-20 md:w-24 md:h-24 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center">
                <Play size={40} fill="currentColor" className="ml-2" />
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: 20 }} 
            transition={{ duration: 0.2 }}
            className="absolute right-4 bottom-20 md:bottom-28 w-64 bg-black/80 backdrop-blur-2xl rounded-2xl border border-white/10 p-3 z-40 text-white shadow-2xl flex flex-col pointer-events-auto max-h-[60vh] overflow-y-auto custom-scrollbar"
          >
            <div className="px-2 py-1.5 mb-2 sticky top-0 bg-transparent z-10 flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider text-gray-400">Tốc độ phát</h3>
            </div>
            <div className="flex flex-col gap-1">
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                <button 
                  key={rate} 
                  onClick={(e) => { e.stopPropagation(); handleRateChange(rate); }} 
                  className={cn(
                    "text-left px-3 py-2.5 rounded-xl text-sm font-medium flex items-center justify-between transition-all duration-200",
                    playbackRate === rate 
                      ? "bg-white/15 text-white font-bold" 
                      : "text-gray-300 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <span>{rate === 1 ? 'Bình thường' : rate + 'x'}</span>
                  {playbackRate === rate && <Check size={16} className="text-white" />}
                </button>
              ))}
            </div>

            {servers && servers.length > 1 && onServerChange && (
              <>
                <div className="w-full h-px bg-white/10 my-3" />
                <div className="px-2 py-1.5 mb-2 sticky top-0 bg-transparent z-10">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-gray-400">Nguồn phát (Server)</h3>
                </div>
                <div className="flex flex-col gap-1">
                  {servers.map((s, i) => (
                    <button 
                      key={i} 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        onServerChange(i); 
                        setIsSettingsOpen(false); 
                      }} 
                      className={cn(
                        "text-left px-3 py-2.5 rounded-xl text-sm font-medium flex items-center justify-between transition-all duration-200",
                        selectedServerId === i 
                          ? "bg-white/15 text-white font-bold" 
                          : "text-gray-300 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <span>{s.server_name}</span>
                      {selectedServerId === i && <Check size={16} className="text-white" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isEpisodesOpen && episodes && onEpisodeSelect && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: 20 }} 
            transition={{ duration: 0.2 }}
            className="absolute right-2 sm:right-4 bottom-20 md:bottom-28 w-64 sm:w-72 bg-black/80 backdrop-blur-2xl rounded-2xl border border-white/10 p-3 z-40 text-white shadow-2xl flex flex-col pointer-events-auto max-h-[60vh] overflow-y-auto custom-scrollbar"
          >
            <div className="px-2 py-1.5 mb-2 sticky top-0 bg-transparent z-10 flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider text-gray-400">Chọn Tập</h3>
            </div>
            <div className="flex flex-col gap-1">
              {episodes.map((ep, i) => (
                <button 
                  key={i} 
                  onClick={(e) => { e.stopPropagation(); onEpisodeSelect(ep); setIsEpisodesOpen(false); }} 
                  className={cn(
                    "text-left px-3 py-2.5 rounded-xl text-sm font-medium flex items-center justify-between transition-all duration-200",
                    episodeName === ep.name 
                      ? "bg-white/15 text-white font-bold" 
                      : "text-gray-300 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <span>{ep.name || `Tập ${i+1}`}</span>
                  {episodeName === ep.name && <Check size={16} className="text-white" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(showControls || (!isPlaying && !isIframeMode)) && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute bottom-0 w-full bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-12 pb-4 px-4 md:px-6 z-30 pointer-events-auto">
            <div className="flex flex-col gap-3 md:gap-4">
              {/* Progress */}
              {!isIframeMode && (
                <div className="group/progress-container py-2 -my-2 flex items-center cursor-pointer" onClick={(e) => {
                    e.stopPropagation();
                    const r = e.currentTarget.getBoundingClientRect();
                    const p = (e.clientX - r.left) / r.width;
                    if (videoRef.current) videoRef.current.currentTime = p * duration;
                  }}>
                  <div 
                    className="w-full h-1 md:h-1.5 bg-white/20 relative rounded-full transition-all duration-200 group-hover/progress-container:h-2 md:group-hover/progress-container:h-2.5"
                  >
                    <div className="absolute inset-y-0 left-0 bg-white/40 rounded-full transition-all duration-200" style={{ width: `${duration && videoRef.current?.buffered?.length ? (videoRef.current.buffered.end(videoRef.current.buffered.length - 1) / duration) * 100 : 0}%` }} />
                    <div className="h-full bg-red-600 rounded-full relative z-10" style={{ width: `${duration ? (currentTime/duration)*100 : 0}%` }}>
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 md:w-4 md:h-4 bg-red-600 rounded-full opacity-0 group-hover/progress-container:opacity-100 scale-125 md:scale-150 transition-all shadow-[0_0_10px_rgba(220,38,38,0.8)]" />
                    </div>
                  </div>
                </div>
              )}
              
              {/* Controls */}
              <div className="flex items-center justify-between text-white mt-1">
                <div className="flex items-center gap-4 md:gap-6">
                  {!isIframeMode && (
                    <>
                      <button onClick={togglePlay} className="hover:text-gray-300 hover:scale-110 transition-transform hidden sm:block">
                        {isPlaying ? <Pause fill="currentColor" size={28} /> : <Play fill="currentColor" size={28} />}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); if (videoRef.current) videoRef.current.currentTime -= 10; }} className="hover:text-gray-300 hover:scale-110 transition-transform hidden sm:block">
                        <Rewind fill="currentColor" size={24} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); if (videoRef.current) videoRef.current.currentTime += 10; }} className="hover:text-gray-300 hover:scale-110 transition-transform hidden sm:block">
                        <FastForward fill="currentColor" size={24} />
                      </button>
                      <button onClick={toggleMute} className="hover:text-gray-300 hover:scale-110 transition-transform hidden sm:block">
                        {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
                      </button>
                      <span className="text-xs sm:text-sm md:text-base font-medium select-none tabular-nums tracking-wide text-gray-200 whitespace-nowrap">
                        {(() => {
                          const formatTime = (time: number) => {
                            if (isNaN(time) || !isFinite(time)) return "00:00";
                            const h = Math.floor(time / 3600);
                            const m = Math.floor((time % 3600) / 60);
                            const s = Math.floor(time % 60);
                            if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                            return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                          };
                          return `${formatTime(currentTime)} / ${formatTime(duration)}`;
                        })()}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-4 md:gap-6 text-sm font-medium">
                  {/* PiP Button */}
                  {/* @ts-ignore */}
                  {document.pictureInPictureEnabled && (
                    <button onClick={togglePiP} className="hover:text-gray-300 hover:scale-110 transition-transform">
                      <PictureInPicture size={24} />
                    </button>
                  )}
                  {episodes && episodes.length > 1 && (
                    <button onClick={(e) => { e.stopPropagation(); setIsEpisodesOpen(!isEpisodesOpen); setIsSettingsOpen(false); }} className={cn("hover:text-gray-300 transition-transform flex items-center gap-2", isEpisodesOpen && "text-red-500")}>
                      <List size={24} />
                      <span className="hidden sm:inline">Tập phim</span>
                    </button>
                  )}
                  {/* Settings Button */}
                  <button onClick={(e) => { e.stopPropagation(); setIsSettingsOpen(!isSettingsOpen); setIsEpisodesOpen(false); }} className={cn("hover:text-gray-300 hover:scale-110 transition-transform", isSettingsOpen && "text-red-500 rotate-90")}>
                    <Settings size={24} />
                  </button>
                  <button onClick={toggleFullscreen} className="hover:text-gray-300 hover:scale-110 transition-transform">
                    <Maximize size={24} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
