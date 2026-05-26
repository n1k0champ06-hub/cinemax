import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Play, Pause, Rewind, FastForward, Maximize, VolumeX, Volume2, Volume1, 
  Settings, ArrowLeft, Loader2, Check, PictureInPicture, RotateCcw, RotateCw, 
  List, ShieldCheck, Sparkles, Palette, Eye, Sliders, Maximize2, Users, 
  Cast, Download, X, ChevronDown, ChevronRight, CheckSquare, Square, Tv, Film,
  Minimize2, Expand, Sun
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Hls from 'hls.js';
import { useWatchProgress } from '../../hooks/useStorage';
import { cn } from '../../lib/utils';
import { PlayerSelect } from './PlayerSelect';

interface NetflixPlayerProps {
  url?: string;
  embedUrl?: string;
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
}

const getEpisodeNumber = (nameStr: string | number | undefined | null): number | null => {
  if (nameStr === undefined || nameStr === null) return null;
  const cleaned = nameStr.toString().replace(/\D/g, '');
  if (!cleaned) return null;
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
};

const isSameEpisode = (epAName: string | number | undefined | null, epBName: string | number | undefined | null): boolean => {
  if (!epAName || !epBName) return false;
  const numA = getEpisodeNumber(epAName);
  const numB = getEpisodeNumber(epBName);
  if (numA !== null && numB !== null) return numA === numB;
  return epAName.toString().toLowerCase().trim() === epBName.toString().toLowerCase().trim();
};

export const NetflixPlayer = ({ 
  url, embedUrl, title, slug, episodeName, posterUrl, thumbUrl, movieName, onClose,
  servers, selectedServerId, onServerChange,
  episodes = [], onEpisodeSelect,
  isTv = false, currentSeason = 1, activeEpSeason = 1, seasons = [], onSeasonChange, tmdbEpisodes = []
}: NetflixPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { saveProgress } = useWatchProgress();

  // Web Audio refs for Audio Boost
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Core Video Status
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isSpeeding, setIsSpeeding] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const hlsRef = useRef<Hls | null>(null);
  // When set to true, the next HLS handleReady will skip auto-play and load the episode paused.
  const startPausedRef = useRef<boolean>(false);

  // Settings & Navigation panels
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEpisodesOpen, setIsEpisodesOpen] = useState(false);
  const [isSeasonDropdownOpen, setIsSeasonDropdownOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'main' | 'quality' | 'speed' | 'captions' | 'audioTrack' | 'appearance' | 'videoFit' | 'aspectRatio' | 'gestures'>('main');
 
  // Interactive controls & preferences
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [seekIndicator, setSeekIndicator] = useState<'fwd' | 'rev' | null>(null);
  const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const seekIndicatorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hudTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [volume, setVolume] = useState(1.0);
  const [activeGestureHUD, setActiveGestureHUD] = useState<{ type: 'volume' | 'brightness'; value: number } | null>(null);
 
  // Direct video customization states (SAVED IN LOCALSTORAGE)
  const [videoFit, setVideoFit] = useState<'contain' | 'cover' | 'fill'>(() => {
    return (localStorage.getItem('cinemax_video_fit') as any) || 'contain';
  });
  const [aspectRatio, setAspectRatio] = useState<string>(() => {
    return localStorage.getItem('cinemax_aspect_ratio') || 'default';
  });
  const [isFlipped, setIsFlipped] = useState<boolean>(() => {
    return localStorage.getItem('cinemax_flipped') === 'true';
  });
  const [playerTheme, setPlayerTheme] = useState<'crimson' | 'purple' | 'gray'>(() => {
    return (localStorage.getItem('cinemax_player_theme') as any) || 'crimson';
  });
  const [subSize, setSubSize] = useState<'small' | 'medium' | 'large'>(() => {
    return (localStorage.getItem('cinemax_sub_size') as any) || 'medium';
  });
  const [subColor, setSubColor] = useState<'white' | 'yellow' | 'cyan'>(() => {
    return (localStorage.getItem('cinemax_sub_color') as any) || 'white';
  });
  const [autoplay, setAutoplay] = useState<boolean>(() => {
    return localStorage.getItem('cinemax_autoplay') !== 'false';
  });
  const [autoNext, setAutoNext] = useState<boolean>(() => {
    return localStorage.getItem('cinemax_auto_next') !== 'false';
  });
  const [audioBoost, setAudioBoost] = useState<number>(1.0); // 1.0 (Tắt) to 3.0 (300%)
  const [brightness, setBrightness] = useState<number>(1.0); // 0.1 to 2.0
  const [gestureLeft, setGestureLeft] = useState<'brightness' | 'volume' | 'disabled'>(() => {
    return (localStorage.getItem('cinemax_gesture_left') as any) || 'brightness';
  });
  const [gestureRight, setGestureRight] = useState<'brightness' | 'volume' | 'disabled'>(() => {
    return (localStorage.getItem('cinemax_gesture_right') as any) || 'volume';
  });
  const [gestureHorizontal, setGestureHorizontal] = useState<'seek' | 'disabled'>(() => {
    return (localStorage.getItem('cinemax_gesture_horizontal') as any) || 'seek';
  });
  const [gestureSplitRatio, setGestureSplitRatio] = useState<number>(() => {
    const val = localStorage.getItem('cinemax_gesture_split_ratio');
    return val ? parseFloat(val) : 0.5;
  });

  // HLS stream metadata states
  const [qualities, setQualities] = useState<{ id: number; name: string }[]>([]);
  const [activeQuality, setActiveQuality] = useState<number>(-1);
  const [audioTracks, setAudioTracks] = useState<{ id: number; name: string }[]>([]);
  const [activeAudioTrack, setActiveAudioTrack] = useState<number>(-1);
  const [subtitleTracks, setSubtitleTracks] = useState<{ id: number; name: string }[]>([]);
  const [activeSubtitle, setActiveSubtitle] = useState<number>(-1);

  // Watch histories (progress bars in side overlay)
  const [progressMap, setProgressMap] = useState<Record<string, any>>({});
  
  const [isMobile, setIsMobile] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [swipeSeekTime, setSwipeSeekTime] = useState<number | null>(null);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setIsMobile(w < 768);
      setIsPortrait(h > w);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Embedding
  const [useEmbed, setUseEmbed] = useState(!url && !!embedUrl);
  const isIframeMode = useEmbed || (!url && !!embedUrl);

  useEffect(() => {
    setUseEmbed(!url && !!embedUrl);
  }, [url, embedUrl]);

  // Load progress histories once when overlay is toggled or initialized
  const loadProgressHistory = () => {
    try {
      const stored = localStorage.getItem('cinemax_progress');
      if (stored) {
        setProgressMap(JSON.parse(stored));
      }
    } catch (e) {}
  };

  useEffect(() => {
    loadProgressHistory();
  }, [isEpisodesOpen, episodeName]);

  // Sync state preferences with localStorage
  useEffect(() => {
    localStorage.setItem('cinemax_video_fit', videoFit);
  }, [videoFit]);
  useEffect(() => {
    localStorage.setItem('cinemax_aspect_ratio', aspectRatio);
  }, [aspectRatio]);
  useEffect(() => {
    localStorage.setItem('cinemax_flipped', isFlipped.toString());
  }, [isFlipped]);
  useEffect(() => {
    localStorage.setItem('cinemax_player_theme', playerTheme);
  }, [playerTheme]);
  useEffect(() => {
    localStorage.setItem('cinemax_sub_size', subSize);
  }, [subSize]);
  useEffect(() => {
    localStorage.setItem('cinemax_sub_color', subColor);
  }, [subColor]);
  useEffect(() => {
    localStorage.setItem('cinemax_autoplay', autoplay.toString());
  }, [autoplay]);
  useEffect(() => {
    localStorage.setItem('cinemax_auto_next', autoNext.toString());
  }, [autoNext]);
  useEffect(() => {
    localStorage.setItem('cinemax_gesture_left', gestureLeft);
  }, [gestureLeft]);
  useEffect(() => {
    localStorage.setItem('cinemax_gesture_right', gestureRight);
  }, [gestureRight]);
  useEffect(() => {
    localStorage.setItem('cinemax_gesture_horizontal', gestureHorizontal);
  }, [gestureHorizontal]);
  useEffect(() => {
    localStorage.setItem('cinemax_gesture_split_ratio', gestureSplitRatio.toString());
  }, [gestureSplitRatio]);

  // Handle hls.js level and track extraction
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

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
      // If the user picked an episode from the drawer while playing, start the new episode paused.
      if (startPausedRef.current) {
        startPausedRef.current = false;
        video.pause();
        setIsPlaying(false);
        return;
      }
      if (autoplay) {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            if (error.name !== 'AbortError') {
              setIsPlaying(false);
            }
          });
        }
      } else {
        setIsPlaying(false);
      }
    };

    const handleVideoError = () => {
      console.warn("Lỗi phát luồng trực tiếp, tự động chuyển sang Iframe embed dự phòng!");
      if (embedUrl) {
        setUseEmbed(true);
      }
    };

    let hls: Hls | null = null;
    
    if (Hls.isSupported() && url) {
      hls = new Hls({ 
        maxBufferLength: 10,
        maxMaxBufferLength: 20,
        maxBufferSize: 15 * 1000 * 1000,
        enableWorker: true,
        lowLatencyMode: true,
        capLevelToPlayerSize: true,
        backBufferLength: 10
      });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        handleReady();
        if (hls) {
          const lvls = hls.levels.map((lvl, index) => {
            const mappedName = (() => {
              const w = lvl.width || 0;
              const h = lvl.height || 0;
              if (h >= 2160 || w >= 3840) return "4K";
              if (h >= 1440 || w >= 2560) return "2K";
              if (h >= 1080 || w >= 1920 || h === 1088 || w === 1080 || h === 608 || h === 640) return "1080p";
              if (h >= 720 || w >= 1280 || w === 720 || h === 540) return "720p";
              if (h >= 480 || w >= 854) return "480p";
              if (h >= 360 || w >= 640) return "360p";
              return h ? `${h}p` : `Hộp ${index + 1}`;
            })();
            return {
              id: index,
              name: mappedName
            };
          });
          setQualities([{ id: -1, name: 'Tự động' }, ...lvls]);
          setActiveQuality(hls.currentLevel);

          const tracks = hls.audioTracks.map((t, index) => ({
            id: index,
            name: t.name || t.lang || `Thuyết minh ${index + 1}`
          }));
          setAudioTracks([{ id: -1, name: 'Mặc định' }, ...tracks]);
          setActiveAudioTrack(hls.audioTrack);
        }
      });

      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (event, data) => {
        if (hls) {
          const subs = hls.subtitleTracks.map((sub, index) => ({
            id: index,
            name: sub.name || sub.lang || `Phụ đề ${index + 1}`
          }));
          setSubtitleTracks([{ id: -1, name: 'Tắt phụ đề' }, ...subs]);
          setActiveSubtitle(hls.subtitleTrack);
        }
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.warn("HLS fatal error, falling back to Iframe embed:", data);
          if (embedUrl) {
            setUseEmbed(true);
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl') && url) {
      video.src = url;
      video.addEventListener('loadedmetadata', handleReady);
      video.addEventListener('error', handleVideoError);
    }

    return () => {
      if (video && video.currentTime > 0 && video.duration > 0 && slug && episodeName) {
        try {
          const stored = localStorage.getItem('cinemax_progress');
          const parsed = stored ? JSON.parse(stored) : {};
          parsed[slug] = {
            episodeName,
            currentTime: video.currentTime,
            duration: video.duration,
            savedAt: Date.now(),
            posterUrl: posterUrl || '',
            thumbUrl: thumbUrl || '',
            movieName: movieName || '',
            season: isTv ? currentSeason : undefined
          };
          localStorage.setItem('cinemax_progress', JSON.stringify(parsed));
        } catch (e) {}
      }

      if (hls) {
        hls.destroy();
        hlsRef.current = null;
      }
      video.removeEventListener('loadedmetadata', handleReady);
      video.removeEventListener('error', handleVideoError);
    };
  }, [url, slug, episodeName, embedUrl, autoplay, isTv, posterUrl, thumbUrl, movieName]);

  // Audio Context Web Audio Boost Configuration
  const handleAudioBoostChange = (boostValue: number) => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        audioCtxRef.current = ctx;

        const source = ctx.createMediaElementSource(video);
        sourceNodeRef.current = source;

        const gainNode = ctx.createGain();
        gainNodeRef.current = gainNode;

        source.connect(gainNode);
        gainNode.connect(ctx.destination);
      }

      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }

      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = boostValue;
      }
      setAudioBoost(boostValue);
    } catch (err) {
      console.warn("Không thể kích hoạt Audio Boost (thường do giới hạn thuộc tính CORS của file nguồn phát):", err);
      // Fallback update state to show option completed regardless
      setAudioBoost(boostValue);
    }
  };

  // Auto Save watch activities
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
          thumbUrl,
          movieName,
          season: isTv ? currentSeason : undefined
        });
      }
    };

    const interval = setInterval(save, 10000); // 10s
    return () => {
      clearInterval(interval);
      save();
    };
  }, [slug, episodeName, posterUrl, thumbUrl, movieName, saveProgress]);

  // Keyboard Shortcuts Effect
  useEffect(() => {
    if (isIframeMode) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;

      const video = videoRef.current;
      if (!video) return;

      switch(e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          if (isPlaying) video.pause();
          else video.play();
          setIsPlaying(!isPlaying);
          break;
        case 'arrowleft':
        case 'j':
          e.preventDefault();
          video.currentTime -= (e.key.toLowerCase() === 'arrowleft' ? 5 : 10);
          setSeekIndicator('rev');
          if (seekIndicatorTimeoutRef.current) clearTimeout(seekIndicatorTimeoutRef.current);
          seekIndicatorTimeoutRef.current = setTimeout(() => setSeekIndicator(null), 800);
          break;
        case 'arrowright':
        case 'l':
          e.preventDefault();
          video.currentTime += (e.key.toLowerCase() === 'arrowright' ? 5 : 10);
          setSeekIndicator('fwd');
          if (seekIndicatorTimeoutRef.current) clearTimeout(seekIndicatorTimeoutRef.current);
          seekIndicatorTimeoutRef.current = setTimeout(() => setSeekIndicator(null), 800);
          break;
        case 'arrowup':
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.05);
          if (video.volume > 0 && video.muted) {
            video.muted = false;
          }
          break;
        case 'arrowdown':
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.05);
          if (video.volume === 0 && !video.muted) {
            video.muted = true;
          }
          break;
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          e.preventDefault();
          const percentage = parseInt(e.key) * 10;
          video.currentTime = (video.duration || 0) * (percentage / 100);
          break;
        case ',':
          e.preventDefault();
          if (!isPlaying) video.currentTime -= 0.04;
          break;
        case '.':
          e.preventDefault();
          if (!isPlaying) video.currentTime += 0.04;
          break;
        case 'f':
        case 'enter':
          e.preventDefault();
          toggleFullscreen(e as any);
          break;
        case 'p':
          e.preventDefault();
          togglePiP(e as any);
          break;
        case 'c':
          e.preventDefault();
          // Cycle subtitle tracks if available
          if (hlsRef.current) {
             const hls = hlsRef.current;
             const subsCount = hls.subtitleTracks.length;
             if (subsCount > 0) {
               let nextSub = activeSubtitle + 1;
               if (nextSub >= subsCount) nextSub = -1; // -1 means off
               hls.subtitleTrack = nextSub;
               setActiveSubtitle(nextSub);
             }
          }
          break;
        case '<':
          if (e.shiftKey) {
            e.preventDefault();
            const newRate = Math.max(0.25, playbackRate - 0.25);
            handleRateChange(newRate);
          }
          break;
        case '>':
          if (e.shiftKey) {
            e.preventDefault();
             const newRate = Math.min(2.0, playbackRate + 0.25);
             handleRateChange(newRate);
          }
          break;
      }
      resetControlsTimeout();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isIframeMode, isPlaying, isMuted, playbackRate, activeSubtitle]);
  // Control overlay hiding timer
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
    const video = videoRef.current;
    if (video) {
      if (isPlaying) {
        video.pause();
        setIsPlaying(false);
      } else {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            if (error.name !== 'AbortError') {
              console.warn("Không phát được video:", error);
              setIsPlaying(false);
            }
          });
        }
        setIsPlaying(true);
      }
    }
  }, [isPlaying]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>, direction: 'fwd' | 'rev') => {
    if (e.detail === 2 && videoRef.current) {
      videoRef.current.currentTime += (direction === 'fwd' ? 10 : -10);
      setSeekIndicator(direction);
      if (seekIndicatorTimeoutRef.current) clearTimeout(seekIndicatorTimeoutRef.current);
      seekIndicatorTimeoutRef.current = setTimeout(() => setSeekIndicator(null), 800);
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
      console.error('PiP lỗi', err);
    }
  };

  const handleHoldSpeedStart = (e: React.TouchEvent | React.MouseEvent) => {
    if ((e as React.MouseEvent).button !== 0 && e.type !== 'touchstart') return;
    if (videoRef.current) {
      videoRef.current.playbackRate = 2.0;
      setIsSpeeding(true);
    }
  };

  const handleHoldSpeedEnd = () => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
      setIsSpeeding(false);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
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
        if (screen.orientation && (screen.orientation as any).lock) {
          await (screen.orientation as any).lock('landscape').catch(() => {});
        }
      } catch (err) {
        console.error('Lỗi fullscreen', err);
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
        console.error('Lỗi thoát fullscreen', err);
      }
    }
  };

  const handleRateChange = (rate: number) => {
    if (videoRef.current) {
        videoRef.current.playbackRate = rate;
        setPlaybackRate(rate);
    }
  };

  const handleQualityChange = (id: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = id;
      setActiveQuality(id);
    }
  };

  const handleAudioTrackChange = (id: number) => {
    if (hlsRef.current) {
      hlsRef.current.audioTrack = id;
      setActiveAudioTrack(id);
    }
  };

  const handleSubtitleTrackChange = (id: number) => {
    if (hlsRef.current) {
      hlsRef.current.subtitleTrack = id;
      setActiveSubtitle(id);
    }
  };

  const handleVideoEnded = () => {
    if (autoNext && episodes.length > 0 && onEpisodeSelect) {
      // Find index of the current active episode using robust comparison
      const currIdx = episodes.findIndex((ep: any) => isSameEpisode(ep.name, episodeName));
      if (currIdx !== -1 && currIdx < episodes.length - 1) {
        const nextEp = episodes[currIdx + 1];
        onEpisodeSelect(nextEp);
      }
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

  // Touch Gesture States
  const touchStateRef = useRef<{
    startX: number;
    startY: number;
    startBrightness: number;
    startVolume: number;
    isPinching: boolean;
    initialDistance: number;
    lastTapTime: number;
    isSeeking: boolean;
    startVideoTime: number;
  }>({
    startX: 0, startY: 0, startBrightness: 1, startVolume: 1,
    isPinching: false, initialDistance: 0, lastTapTime: 0,
    isSeeking: false, startVideoTime: 0
  });

  

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isIframeMode || !videoRef.current) return;
    
    // Pinch to zoom
    if (e.touches.length === 2) {
      touchStateRef.current.isPinching = true;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStateRef.current.initialDistance = Math.sqrt(dx*dx + dy*dy);
      return;
    }
    
    if (e.touches.length === 1) {
      touchStateRef.current.isPinching = false;
      touchStateRef.current.startX = e.touches[0].clientX;
      touchStateRef.current.startY = e.touches[0].clientY;
      touchStateRef.current.startBrightness = brightness;
      touchStateRef.current.startVolume = videoRef.current.volume;
      touchStateRef.current.startVideoTime = videoRef.current.currentTime;
      touchStateRef.current.isSeeking = false;
      
      const now = Date.now();
      const timeSinceLastTap = now - touchStateRef.current.lastTapTime;
      if (timeSinceLastTap < 300) {
        // Double tap handled here on mobile
        const w = window.innerWidth;
        if (e.touches[0].clientX < w * gestureSplitRatio) {
           // seek rev
           videoRef.current.currentTime -= 10;
           setSeekIndicator('rev');
        } else {
           // seek fwd
           videoRef.current.currentTime += 10;
           setSeekIndicator('fwd');
        }
        if (seekIndicatorTimeoutRef.current) clearTimeout(seekIndicatorTimeoutRef.current);
        seekIndicatorTimeoutRef.current = setTimeout(() => setSeekIndicator(null), 800);
        touchStateRef.current.lastTapTime = 0; // reset
      } else {
        touchStateRef.current.lastTapTime = now;
        
        // Long press for 2x
        if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
        seekTimeoutRef.current = setTimeout(() => {
          if (!touchStateRef.current.isSeeking && !touchStateRef.current.isPinching) {
            handleHoldSpeedStart(e);
          }
        }, 500); // 500ms long press
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isIframeMode || !videoRef.current) return;

    if (touchStateRef.current.isPinching && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx*dx + dy*dy);
      // Determine if zoom in or out
      if (distance > touchStateRef.current.initialDistance + 50) {
        setVideoFit('cover');
      } else if (distance < touchStateRef.current.initialDistance - 50) {
        setVideoFit('contain');
      }
      return;
    }

    if (e.touches.length === 1 && !touchStateRef.current.isPinching) {
       const dx = e.touches[0].clientX - touchStateRef.current.startX;
       const dy = e.touches[0].clientY - touchStateRef.current.startY;
       
       const w = window.innerWidth;
       const h = window.innerHeight;
       
       // Clear long press if user moves finger significantly (swiping)
       if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
         if (seekTimeoutRef.current) {
           clearTimeout(seekTimeoutRef.current);
           seekTimeoutRef.current = null;
         }
       }

       if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 20) {
         // Horizontal Swipe -> Fine Seek
         if (gestureHorizontal === 'seek') {
           touchStateRef.current.isSeeking = true;
           const percentDelta = dx / w;
           const timeDelta = percentDelta * (videoRef.current.duration || 0) * 0.2; // 20% max seek per swipe
           const newTime = Math.max(0, touchStateRef.current.startVideoTime + timeDelta);
           videoRef.current.currentTime = newTime;
           setSwipeSeekTime(newTime);
         }
       } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 20 && !touchStateRef.current.isSeeking) {
         // Vertical Swipe
         const percentDelta = -(dy / h); // up is negative dy
         const isLeftSide = touchStateRef.current.startX < w * gestureSplitRatio;
         const action = isLeftSide ? gestureLeft : gestureRight;
         
         if (action === 'brightness') {
           const newBri = Math.max(0.1, Math.min(2.0, touchStateRef.current.startBrightness + percentDelta * 1.5));
           setBrightness(newBri);
           setActiveGestureHUD({ type: 'brightness', value: newBri });
         } else if (action === 'volume') {
           const newVol = Math.max(0, Math.min(1.0, touchStateRef.current.startVolume + percentDelta * 1.5));
           videoRef.current.volume = newVol;
           if (newVol > 0 && videoRef.current.muted) {
             videoRef.current.muted = false;
           }
           setActiveGestureHUD({ type: 'volume', value: newVol });
         }
       }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchStateRef.current.isPinching = false;
    touchStateRef.current.isSeeking = false;
    setSwipeSeekTime(null);
    if (seekTimeoutRef.current) {
      clearTimeout(seekTimeoutRef.current);
      seekTimeoutRef.current = null;
    }
    handleHoldSpeedEnd();

    // Clear gesture HUD after a delay
    if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
    hudTimeoutRef.current = setTimeout(() => {
      setActiveGestureHUD(null);
    }, 1000);
  };

  const toggleControlsMobile = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) e.stopPropagation();
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

  // Find exact theme colors
  const activeColor = useMemo(() => {
    if (playerTheme === 'purple') return '#8B5CF6';
    if (playerTheme === 'gray') return '#9CA3AF';
    return '#E50914'; // crimson
  }, [playerTheme]);

  const activeBg = useMemo(() => {
    if (playerTheme === 'purple') return 'bg-purple-600 hover:bg-purple-700';
    if (playerTheme === 'gray') return 'bg-gray-600 hover:bg-gray-700';
    return 'bg-[#E50914] hover:bg-red-700';
  }, [playerTheme]);

  const activeText = useMemo(() => {
    if (playerTheme === 'purple') return 'text-purple-500';
    if (playerTheme === 'gray') return 'text-gray-400';
    return 'text-[#E50914]';
  }, [playerTheme]);

  const activeBorder = useMemo(() => {
    if (playerTheme === 'purple') return 'border-purple-500/50';
    if (playerTheme === 'gray') return 'border-gray-500/50';
    return 'border-red-500/50';
  }, [playerTheme]);

  const renderSettingsOverlay = () => {
    if (isIframeMode) return null;

    const overlayContent = (
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div 
            key="settings-overlay-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "fixed inset-0 z-[9999] bg-black/60 pointer-events-auto flex transition-colors shadow-2xl",
              isFullscreen ? "absolute z-50 inset-0" : "",
              isMobile && isPortrait ? "items-end justify-center" : "items-end justify-end pb-16 pr-4 sm:pb-24 sm:pr-8"
            )}
          >
        {/* Click outside sidebar to close on mobile */}
        <div className="absolute inset-0 z-10" onClick={() => { setIsSettingsOpen(false); setTimeout(() => setSettingsTab('main'), 300); }} />

        <motion.div 
          key="settings-overlay-box"
          initial={{ y: (isMobile && isPortrait) ? '100%' : 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: (isMobile && isPortrait) ? '100%' : 20, opacity: 0 }}
          transition={{ type: 'tween', ease: [0.16, 1, 0.3, 1], duration: 0.22 }}
          className={cn(
            "w-full sm:w-[350px] flex flex-col relative z-20 text-white overflow-hidden shadow-2xl transition-all duration-300",
            isMobile && isPortrait 
              ? "bg-[#050505] border-t border-white/[0.08] rounded-t-[32px] pb-8 pt-3 shadow-[0_-15px_40px_rgba(0,0,0,0.85)]" 
              : "bg-black/80 backdrop-blur-md border border-white/10 rounded-2xl p-0"
          )}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          {settingsTab === 'main' ? (
            <>
              <div className="flex justify-between items-center px-5 py-4 border-b border-white/[0.06] relative">
                <span className="w-12 h-1.5 bg-white/15 rounded-full absolute top-2.5 left-1/2 -translate-x-1/2 sm:hidden" />
                <h3 className="text-sm font-extrabold ml-1 mt-2 sm:mt-0 uppercase tracking-wider text-gray-200">Cài đặt</h3>
                <button 
                  onClick={() => { setIsSettingsOpen(false); setTimeout(() => setSettingsTab('main'), 300); }}
                  className="p-1.5 rounded-full hover:bg-white/10 transition-colors mt-2 sm:mt-0"
                >
                  <X size={18} className="text-gray-400" />
                </button>
              </div>
              <div className="flex flex-col py-2 max-h-[70vh] custom-scrollbar overflow-y-auto">
                {qualities && qualities.length > 0 && (
                  <div className="flex items-center justify-between py-3 px-5 hover:bg-white/5 cursor-pointer transition-colors active:bg-white/10" onClick={() => setSettingsTab('quality')}>
                    <div className="flex items-center gap-4">
                      <Sliders size={20} className="text-white" />
                      <span className="text-sm font-medium">Chất lượng</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <span className="text-xs">{activeQuality === -1 ? 'Tự động' : qualities.find(q => q.id === activeQuality)?.name || ''}</span>
                      <ChevronRight size={16} />
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between py-3 px-5 hover:bg-white/5 cursor-pointer transition-colors active:bg-white/10" onClick={() => setSettingsTab('speed')}>
                  <div className="flex items-center gap-4">
                    <Play size={20} className="text-white" />
                    <span className="text-sm font-medium">Tốc độ phát</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="text-xs">{playbackRate === 1 ? 'Chuẩn' : `${playbackRate}x`}</span>
                    <ChevronRight size={16} />
                  </div>
                </div>

                <div className="flex items-center justify-between py-3 px-5 hover:bg-white/5 cursor-pointer transition-colors active:bg-white/10" onClick={() => setSettingsTab('appearance')}>
                  <div className="flex items-center gap-4">
                    <Settings size={20} className="text-white" />
                    <span className="text-sm font-medium">Tuỳ chọn khác</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <ChevronRight size={16} />
                  </div>
                </div>

                <div className="flex items-center justify-between py-3 px-5 hover:bg-white/5 cursor-pointer transition-colors active:bg-white/10" onClick={() => setSettingsTab('gestures')}>
                   <div className="flex items-center gap-4">
                     <Sun size={20} className="text-white" />
                     <span className="text-sm font-medium">Cử chỉ</span>
                   </div>
                   <div className="flex items-center gap-2 text-gray-400">
                     <ChevronRight size={16} />
                   </div>
                 </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 px-4 py-4 border-b border-white/[0.06] relative">
                <span className="w-12 h-1.5 bg-white/15 rounded-full absolute top-2.5 left-1/2 -translate-x-1/2 sm:hidden" />
                <button onClick={() => setSettingsTab('main')} className="p-2 ml-1 rounded-full hover:bg-white/10 mt-2 sm:mt-0 transition-colors">
                  <ArrowLeft size={18} className="text-gray-300" />
                </button>
                <h3 className="text-sm font-extrabold mt-2 sm:mt-0 uppercase tracking-wider text-gray-200">
                  {settingsTab === 'quality' && 'Chất lượng'}
                  {settingsTab === 'speed' && 'Tốc độ phát'}
                  {settingsTab === 'appearance' && 'Tuỳ chọn khác'}
                  {settingsTab === 'gestures' && 'Cử chỉ'}
                </h3>
              </div>

              <div className="flex flex-col py-2 max-h-[70vh] custom-scrollbar overflow-y-auto">
                {settingsTab === 'quality' && qualities.map(q => (
                  <div key={q.id} className="flex items-center gap-4 py-3 px-5 hover:bg-white/5 cursor-pointer transition-colors" onClick={() => { handleQualityChange(q.id); setSettingsTab('main'); }}>
                    <div className="w-5 flex justify-center">{activeQuality === q.id && <Check size={18} className="text-white" />}</div>
                    <span className={cn("text-sm transition-colors", activeQuality === q.id ? "text-white font-medium" : "text-gray-300")}>{q.id === -1 ? 'Tự động' : q.name}</span>
                  </div>
                ))}

                {settingsTab === 'speed' && [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map(speed => (
                  <div key={speed} className="flex items-center gap-4 py-3 px-5 hover:bg-white/5 cursor-pointer transition-colors" onClick={() => { handleRateChange(speed); setSettingsTab('main'); }}>
                    <div className="w-5 flex justify-center">{playbackRate === speed && <Check size={18} className="text-white" />}</div>
                    <span className={cn("text-sm transition-colors", playbackRate === speed ? "text-white font-medium" : "text-gray-300")}>{speed === 1 ? 'Chuẩn' : `${speed}x`}</span>
                  </div>
                ))}

                {settingsTab === 'appearance' && (
                  <div className="flex flex-col gap-1 pb-4">
                    <div className="px-5 py-2 text-[10px] font-bold tracking-wider uppercase text-gray-500">Màn hình & Hiển thị</div>
                    
                    <div className="flex items-center justify-between py-2 px-5 hover:bg-white/5">
                      <span className="text-sm text-gray-300">Vừa vặn khung hình</span>
                      <PlayerSelect
                        value={videoFit}
                        onChange={(val) => setVideoFit(val)}
                        activeColor={activeColor}
                        options={[
                          { value: 'contain', label: 'Mặc định', icon: <Minimize2 size={14} /> },
                          { value: 'cover', label: 'Lấp đầy', icon: <Maximize2 size={14} /> },
                          { value: 'fill', label: 'Kéo giãn', icon: <Expand size={14} /> }
                        ]}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between py-2 px-5 hover:bg-white/5">
                      <span className="text-sm text-gray-300">Tỉ lệ khung hình</span>
                      <PlayerSelect
                        value={aspectRatio}
                        onChange={(val) => setAspectRatio(val)}
                        activeColor={activeColor}
                        options={[
                          { value: 'default', label: 'Tự động', icon: <Tv size={14} /> },
                          { value: '16/9', label: '16:9', icon: <Film size={14} /> },
                          { value: '4/3', label: '4:3', icon: <Film size={14} /> },
                          { value: '21/9', label: '21:9', icon: <Film size={14} /> }
                        ]}
                      />
                    </div>

                    <div className="flex items-center justify-between py-2 px-5 hover:bg-white/5 cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
                      <span className="text-sm text-gray-300">Lật ngang Video</span>
                      <div className={cn("w-9 h-5 rounded-full relative transition-colors", isFlipped ? "bg-[#E50914]" : "bg-neutral-600")}>
                         <div className={cn("absolute top-[2px] bottom-[2px] w-4 bg-white rounded-full transition-all", isFlipped ? "right-[2px]" : "left-[2px]")} />
                      </div>
                    </div>

                    <div className="px-5 py-2 mt-1">
                      <div className="flex justify-between text-sm text-gray-300 mb-2">
                         <span>Độ sáng</span>
                         <span className="font-mono text-xs">{(brightness * 100).toFixed(0)}%</span>
                      </div>
                      <input 
                          type="range" min="0.1" max="2.0" step="0.1" 
                          value={brightness} onChange={(e) => setBrightness(parseFloat(e.target.value))}
                          className="w-full accent-[#E50914] h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="px-5 py-2 mt-2 text-[10px] font-bold tracking-wider uppercase text-gray-500">Âm thanh</div>
                    <div className="flex items-center justify-between py-2 px-5 hover:bg-white/5">
                      <span className="text-sm text-gray-300">Khuếch đại âm lượng</span>
                      <PlayerSelect
                        value={audioBoost}
                        onChange={(val) => handleAudioBoostChange(val)}
                        activeColor={activeColor}
                        options={[
                          { value: 1.0, label: 'Tắt (1x)', icon: <Volume1 size={14} /> },
                          { value: 1.5, label: '1.5x', icon: <Volume2 size={14} /> },
                          { value: 2.0, label: '2.0x', icon: <Volume2 size={14} /> }
                        ]}
                      />
                    </div>

                    <div className="px-5 py-2 mt-2 text-[10px] font-bold tracking-wider uppercase text-gray-500">Phát lại</div>
                    <div className="flex items-center justify-between py-3 px-5 hover:bg-white/5 cursor-pointer" onClick={() => setAutoplay(!autoplay)}>
                      <span className="text-sm text-gray-300">Tự động phát</span>
                      <div className={cn("w-9 h-5 rounded-full relative transition-colors", autoplay ? "bg-[#E50914]" : "bg-neutral-600")}>
                         <div className={cn("absolute top-[2px] bottom-[2px] w-4 bg-white rounded-full transition-all", autoplay ? "right-[2px]" : "left-[2px]")} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-3 px-5 hover:bg-white/5 cursor-pointer" onClick={() => setAutoNext(!autoNext)}>
                      <span className="text-sm text-gray-300">Tự động nhảy tập tiếp</span>
                      <div className={cn("w-9 h-5 rounded-full relative transition-colors", autoNext ? "bg-[#E50914]" : "bg-neutral-600")}>
                         <div className={cn("absolute top-[2px] bottom-[2px] w-4 bg-white rounded-full transition-all", autoNext ? "right-[2px]" : "left-[2px]")} />
                      </div>
                    </div>
                  </div>
                )}

                {settingsTab === 'gestures' && (
                  <div className="flex flex-col gap-1 pb-4">
                    <div className="px-5 py-2 text-[10px] font-bold tracking-wider uppercase text-gray-500">Cử chỉ vuốt dọc</div>
                    
                    <div className="flex items-center justify-between py-2 px-5 hover:bg-white/5">
                      <span className="text-sm text-gray-300">Vuốt bên trái</span>
                      <PlayerSelect
                        value={gestureLeft}
                        onChange={(val: any) => setGestureLeft(val)}
                        activeColor={activeColor}
                        options={[
                          { value: 'brightness', label: 'Độ sáng', icon: <Sun size={14} /> },
                          { value: 'volume', label: 'Âm lượng', icon: <Volume2 size={14} /> },
                          { value: 'disabled', label: 'Tắt', icon: <VolumeX size={14} /> }
                        ]}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between py-2 px-5 hover:bg-white/5">
                      <span className="text-sm text-gray-300">Vuốt bên phải</span>
                      <PlayerSelect
                        value={gestureRight}
                        onChange={(val: any) => setGestureRight(val)}
                        activeColor={activeColor}
                        options={[
                          { value: 'volume', label: 'Âm lượng', icon: <Volume2 size={14} /> },
                          { value: 'brightness', label: 'Độ sáng', icon: <Sun size={14} /> },
                          { value: 'disabled', label: 'Tắt', icon: <VolumeX size={14} /> }
                        ]}
                      />
                    </div>

                    <div className="px-5 py-2 mt-2 text-[10px] font-bold tracking-wider uppercase text-gray-500">Cử chỉ vuốt ngang</div>
                    <div className="flex items-center justify-between py-2 px-5 hover:bg-white/5">
                      <span className="text-sm text-gray-300">Tua thời gian</span>
                      <PlayerSelect
                        value={gestureHorizontal}
                        onChange={(val: any) => setGestureHorizontal(val)}
                        activeColor={activeColor}
                        options={[
                          { value: 'seek', label: 'Bật', icon: <FastForward size={14} /> },
                          { value: 'disabled', label: 'Tắt', icon: <X size={14} /> }
                        ]}
                      />
                    </div>

                    <div className="px-5 py-2 mt-3 border-t border-white/[0.06] pt-3">
                      <div className="flex justify-between text-sm text-gray-300 mb-2">
                         <span>Phân chia vùng vuốt dọc</span>
                         <span className="font-mono text-xs">{(gestureSplitRatio * 100).toFixed(0)}% / {((1 - gestureSplitRatio) * 100).toFixed(0)}%</span>
                      </div>
                      <input 
                          type="range" min="0.2" max="0.8" step="0.05" 
                          value={gestureSplitRatio} onChange={(e) => setGestureSplitRatio(parseFloat(e.target.value))}
                          className="w-full accent-[#E50914] h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] text-gray-500 mt-1">
                        <span>Trái 20%</span>
                        <span>Cân bằng (50%)</span>
                        <span>Phải 20%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );

    if (isFullscreen) {
      return overlayContent;
    }
    return createPortal(overlayContent, document.body);
  };

  if (isIframeMode) {
    return (
      <iframe 
        src={embedUrl}
        className="w-full h-full border-0 bg-black pointer-events-auto"
        allowFullScreen
        allow="autoplay; fullscreen; encrypted-media"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-forms allow-pointer-lock allow-modals allow-orientation-lock"
        referrerPolicy="origin"
      />
    );
  }

  return (
    <div 
      ref={containerRef}
      className={cn("relative w-full h-full bg-black group netflix-player-container", isFullscreen ? "overflow-hidden" : "")}
      onMouseMove={isIframeMode ? undefined : resetControlsTimeout}
      onMouseLeave={isIframeMode ? undefined : () => { if(isPlaying && !isSettingsOpen && !isEpisodesOpen) setShowControls(false); }}
      onClick={isIframeMode ? undefined : toggleControlsMobile}
      onTouchStart={isIframeMode ? undefined : handleTouchStart}
      onTouchMove={isIframeMode ? undefined : handleTouchMove}
      onTouchEnd={isIframeMode ? undefined : handleTouchEnd}
    >
      {isIframeMode ? (
        <iframe 
          src={embedUrl}
          className="w-full h-full border-0 absolute inset-0 z-0 bg-black pointer-events-auto"
          allowFullScreen
          allow="autoplay; fullscreen; encrypted-media"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
          referrerPolicy="origin"
        />
      ) : (
        <video
          ref={videoRef}
          playsInline
          onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
          onDurationChange={() => setDuration(videoRef.current?.duration || 0)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onCanPlay={() => setIsBuffering(false)}
          onVolumeChange={() => {
            if (videoRef.current) {
              setVolume(videoRef.current.volume);
              setIsMuted(videoRef.current.muted || videoRef.current.volume === 0);
            }
          }}
          onEnded={handleVideoEnded}
          style={{
            transform: isFlipped ? 'scaleX(-1)' : 'none',
            objectFit: videoFit === 'fill' ? 'fill' : (videoFit === 'cover' ? 'cover' : 'contain'),
            aspectRatio: aspectRatio !== 'default' ? aspectRatio.replace('/', ' / ') : 'auto',
            filter: `brightness(${brightness})`,
          }}
          className={cn(
            "w-full transition-all duration-350",
             aspectRatio === 'default' ? "h-full" : "h-auto max-h-full m-auto" 
          )}
        />
      )}

      {/* Subtitles custom styling mock renderer for full aesthetics if enabled */}
      {!isIframeMode && activeSubtitle !== -1 && (
        <div 
          className="absolute bottom-20 left-1/2 -translate-x-1/2 z-[35] text-center pointer-events-none select-none px-4"
          style={{
            fontSize: subSize === 'small' ? '14px' : subSize === 'large' ? '24px' : '18px',
            color: subColor === 'yellow' ? '#facc15' : subColor === 'cyan' ? '#22d3ee' : '#ffffff',
            textShadow: '0 2px 4px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.9)'
          }}
        >
          {/* Default subtitle cue is rendered by browser, preferences are mapped here */}
        </div>
      )}

      {/* Transparent overlay for mouse seeks / taps */}
      {!isIframeMode && (
        <div className="absolute inset-0 flex z-10">
          <div 
            className="w-1/3 h-full cursor-pointer flex items-center justify-center relative select-none pointer-events-auto" 
            onClick={(e) => handleSeek(e, 'rev')} 
          >
            <AnimatePresence>
              {seekIndicator === 'rev' && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.5 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  exit={{ opacity: 0, scale: 0.5 }} 
                  transition={{ duration: 0.15 }} 
                  className="pointer-events-none text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
                >
                   <RotateCcw size={48} className="animate-pulse" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div 
            className="w-1/3 h-full cursor-pointer flex items-center justify-center pointer-events-auto" 
            onClick={togglePlay} 
          />
          <div 
            className="w-1/3 h-full cursor-pointer flex items-center justify-center relative select-none pointer-events-auto" 
            onClick={(e) => handleSeek(e, 'fwd')}
            onMouseDown={handleHoldSpeedStart}
            onMouseUp={handleHoldSpeedEnd}
            onMouseLeave={handleHoldSpeedEnd}
            onTouchStart={handleHoldSpeedStart}
            onTouchEnd={handleHoldSpeedEnd}
          >
            <AnimatePresence>
              {seekIndicator === 'fwd' && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.5 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  exit={{ opacity: 0, scale: 0.5 }} 
                  transition={{ duration: 0.15 }} 
                  className="pointer-events-none text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
                >
                   <RotateCw size={48} className="animate-pulse" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      <AnimatePresence>
        {!isIframeMode && swipeSeekTime !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20">
             <div className="bg-black/80 px-6 py-3 rounded-xl text-white font-mono text-xl sm:text-2xl font-black tracking-wider border border-white/10 shadow-2xl">
               {new Date(swipeSeekTime * 1000).toISOString().substring(11, 19).replace(/^00:/, '')}
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isIframeMode && isBuffering && swipeSeekTime === null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center pointer-events-none z-10" style={{ color: activeColor }}>
            <Loader2 size={48} className="animate-spin drop-shadow-lg" />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isIframeMode && isSpeeding && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/60 rounded-full px-4 py-2 text-white flex items-center gap-2 font-bold z-25 pointer-events-none">
            <FastForward size={20} fill="currentColor" /> 2x Tốc độ
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isIframeMode && activeGestureHUD && (
          <motion.div
            initial={{ opacity: 0, y: -15, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/80 border border-white/10 rounded-full px-4 py-2.5 flex items-center gap-3 z-50 pointer-events-none shadow-2xl animate-fade-in"
          >
            {activeGestureHUD.type === 'brightness' ? (
              <Sun size={18} className="text-amber-400 animate-pulse" />
            ) : activeGestureHUD.value === 0 ? (
              <VolumeX size={18} className="text-gray-400" />
            ) : (
              <Volume2 size={18} className="text-white" />
            )}
            <div className="w-24 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-75"
                style={{
                  width: `${(activeGestureHUD.type === 'brightness' ? activeGestureHUD.value / 2 : activeGestureHUD.value) * 100}%`,
                  backgroundColor: activeGestureHUD.type === 'brightness' ? '#f59e0b' : '#ffffff'
                }}
              />
            </div>
            <span className="font-mono text-xs font-bold min-w-[28px] text-right">
              {Math.round(activeGestureHUD.value * 100)}%
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Title Bar inside Custom Player controls */}
      <AnimatePresence>
        {((!isIframeMode && showControls) || (!isPlaying && !isIframeMode)) && !(isMobile && isPortrait && !isFullscreen) && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="absolute top-0 w-full bg-gradient-to-b from-black/90 via-black/40 to-transparent p-4 md:p-6 z-30 pointer-events-auto flex items-center justify-between text-white">
            <h2 className="font-extrabold text-sm md:text-lg drop-shadow-md truncate pr-8 cursor-default flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: activeColor }} />
              <span>{title}</span>
            </h2>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Player Settings HUD Overlay (YouTube Style) */}
      {renderSettingsOverlay()}

      {/* Dynamic Advanced Episodes Overlay Modal (Matches Second Image Request) */}
      <AnimatePresence>
        {isEpisodesOpen && episodes.length > 0 && onEpisodeSelect && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-black/90 pointer-events-auto flex justify-end"
          >
            
            {/* Click outside sidebar to close */}
            <div className="absolute inset-0 z-10" onClick={() => setIsEpisodesOpen(false)} />

            <motion.div 
              initial={{ x: '100%', opacity: 0.5 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0.5 }}
              transition={{ type: 'spring', damping: 24, stiffness: 150 }}
              className="relative z-20 w-full max-w-md sm:max-w-lg h-full bg-black border-l border-white/[0.08] flex flex-col shadow-[rgba(0,0,0,0.9)_0px_0px_50px_10px]"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
            >
              
              {/* Overlay Top Bar (Season Selection + Close) */}
              <div className="p-4 border-b border-white/[0.08] flex flex-col gap-3 shrink-0 bg-black sticky top-0 z-30">
                <div className="flex items-center justify-between w-full">
                  <div className="flex flex-col gap-1 min-w-0">
                    <h3 className="text-sm font-black text-white tracking-wider uppercase">Danh sách tập</h3>
                    <p className="text-[10px] text-gray-400 font-medium uppercase font-sans tracking-wider truncate max-w-[220px]">{movieName}</p>
                  </div>
                  
                  <button 
                    onClick={() => setIsEpisodesOpen(false)}
                    className="w-8 h-8 rounded-full hover:bg-white/10 transition-all flex items-center justify-center text-gray-400 hover:text-white shrink-0"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Stremio-style Season horizontal tabs */}
                {isTv && seasons && seasons.length > 1 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1 pt-1 custom-scrollbar snap-x w-full">
                    {seasons.map((s: any) => {
                      const isSelectedSeason = currentSeason === s.season_number;
                      return (
                        <button 
                          key={s.season_number}
                          onClick={() => {
                            if (onSeasonChange) onSeasonChange(s.season_number);
                          }}
                          className={cn(
                            "px-3.5 py-1.5 rounded-full text-[11px] font-extrabold whitespace-nowrap transition-colors snap-start cursor-pointer",
                            isSelectedSeason 
                              ? cn(activeBg, "text-white") 
                              : "bg-black border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                          )}
                        >
                          Mùa {s.season_number}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Scrollable Episodes List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar bg-black">
                {episodes.map((ep: any, index: number) => {
                  const epNameStr = ep.name;
                  
                  // Only highlight the episode if the drawer is showing the same season as the playing episode
                  const isSelected = currentSeason === activeEpSeason && isSameEpisode(episodeName, epNameStr);
                  
                  // Match with TMDB metadata episodes object
                  const tmdbEp = tmdbEpisodes.find(t => isSameEpisode(t.episode_number || t.name, epNameStr));

                  const runtime = tmdbEp?.runtime ? `${tmdbEp.runtime}m` : 'Phát ngay';
                  const cleanEpNum = getEpisodeNumber(epNameStr)?.toString() || epNameStr.replace("Tập ", "").trim();
                  const displayTitle = tmdbEp?.name ? `${cleanEpNum}. ${tmdbEp.name}` : (ep.name.startsWith("Tập") ? ep.name : `Tập ${ep.name}`);

                  // Extract Still image
                  const imgUrl = tmdbEp?.still_path 
                    ? `https://image.tmdb.org/t/p/w300${tmdbEp.still_path}`
                    : posterUrl || thumbUrl || '';

                  // Track watched ratio under localStorage history
                  const saved = progressMap[slug || ''];
                  let ratio = 0;
                  if (saved && isSameEpisode(saved.episodeName, ep.name)) {
                    if (saved.duration) {
                      ratio = (saved.currentTime / saved.duration) * 100;
                    }
                  }

                  return (
                    <button
                      key={index}
                      onClick={() => {
                        onEpisodeSelect(ep);
                        setIsEpisodesOpen(false);
                      }}
                      className={cn(
                        "w-full text-left rounded-xl p-2 transition-all duration-200 flex gap-3 border select-none cursor-pointer bg-black",
                        isSelected 
                          ? cn("border-white/10", activeBorder)
                          : "border-white/5 hover:bg-white/[0.02] hover:border-white/10"
                      )}
                    >
                      {/* Thumbnail wrapper */}
                      <div className="w-[100px] aspect-video rounded-lg overflow-hidden relative bg-neutral-900 border border-white/5 shrink-0 shadow-md">
                        {imgUrl ? (
                          <img 
                            src={imgUrl} 
                            alt={displayTitle} 
                            className="w-full h-full object-cover transition-transform duration-500" 
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full bg-[#111] flex items-center justify-center text-gray-600 text-[10px] font-bold">
                            CinemaOS
                          </div>
                        )}

                        {/* Watched progress bar indicator inside image footer */}
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-white/20">
                          <div 
                            className="h-full bg-red-600 transition-all duration-300"
                            style={{ width: `${ratio ? ratio : isSelected ? 100 : 0}%` }}
                          />
                        </div>
                      </div>

                      {/* Title, runtime, description */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                        <div className="flex items-center justify-between w-full">
                          <h4 className={cn(
                            "text-xs font-bold truncate leading-snug tracking-wide",
                            isSelected ? cn(activeText, "font-extrabold") : "text-gray-200"
                          )}>
                            {displayTitle}
                          </h4>
                          {runtime && (
                            <span className="text-[9px] text-gray-500 font-sans shrink-0 ml-2 font-semibold">
                              {runtime}
                            </span>
                          )}
                        </div>

                        {/* Overview synopsis if parsed in TMDB */}
                        {tmdbEp?.overview && (
                          <p className="text-[10px] text-gray-500 line-clamp-1 leading-relaxed font-medium">
                            {tmdbEp.overview}
                          </p>
                        )}
                      </div>

                    </button>
                  );
                })}
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary Video Screen Controls bar at Bottom */}
      <AnimatePresence>
        {!isIframeMode && (showControls || !isPlaying) && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: 20 }} 
            className={cn(
              "absolute bottom-0 w-full bg-gradient-to-t from-black/100 via-black/75 to-transparent z-35 pointer-events-auto",
              isMobile && isPortrait ? "pt-10 pb-3 px-3" : "pt-16 pb-4 px-4 md:px-6"
            )}
          >
            <div className={cn("flex flex-col", isMobile && isPortrait ? "gap-2" : "gap-3 md:gap-4_5")}>
              
              {/* Timeline Slider Track */}
              <div 
                className="group/progress-container py-2 -my-2 flex items-center cursor-pointer" 
                onClick={(e) => {
                  e.stopPropagation();
                  const r = e.currentTarget.getBoundingClientRect();
                  const p = (e.clientX - r.left) / r.width;
                  if (videoRef.current) videoRef.current.currentTime = p * duration;
                }}
              >
                <div className="w-full h-1 md:h-1.5 bg-white/20 relative rounded-full transition-all duration-300 group-hover/progress-container:h-2 md:group-hover/progress-container:h-2.5">
                  <div className="absolute inset-y-0 left-0 bg-white/35 rounded-full transition-all duration-350" style={{ width: `${duration && videoRef.current?.buffered?.length ? (videoRef.current.buffered.end(videoRef.current.buffered.length - 1) / duration) * 100 : 0}%` }} />
                  <div className="h-full rounded-full relative z-10" style={{ width: `${duration ? (currentTime/duration)*100 : 0}%`, backgroundColor: activeColor }}>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 md:w-4.5 md:h-4.5 rounded-full opacity-0 group-hover/progress-container:opacity-100 scale-125 md:scale-150 transition-all shadow-[0_0_15px_rgba(255,255,255,0.9)]" style={{ backgroundColor: activeColor }} />
                  </div>
                </div>
              </div>
              
              {/* Media Controllers bar layout */}
              <div className="flex items-center justify-between text-white mt-1">
                <div className="flex items-center gap-3 sm:gap-4 md:gap-6">
                  <button onClick={togglePlay} className="hover:text-gray-300 hover:scale-110 active:scale-95 transition-all">
                    {isPlaying ? <Pause fill="currentColor" size={22} /> : <Play fill="currentColor" size={22} />}
                  </button>
                  
                  {!(isMobile && isPortrait) && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); if (videoRef.current) videoRef.current.currentTime -= 10; }} className="hover:text-gray-300 hover:scale-110 active:scale-95 transition-all">
                        <Rewind fill="currentColor" size={20} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); if (videoRef.current) videoRef.current.currentTime += 10; }} className="hover:text-gray-300 hover:scale-110 active:scale-95 transition-all">
                        <FastForward fill="currentColor" size={20} />
                      </button>
                    </>
                  )}

                  {/* Volume Control (Desktop/Landscape) */}
                  {!(isMobile && isPortrait) && (
                    <div className="flex items-center gap-2 group/volume ml-2">
                      <button 
                        onClick={toggleMute} 
                        className="hover:text-gray-300 hover:scale-110 active:scale-95 transition-all cursor-pointer"
                        title={isMuted ? "Bật âm thanh" : "Tắt tiếng"}
                      >
                        {isMuted ? (
                          <VolumeX size={20} />
                        ) : volume < 0.5 ? (
                          <Volume1 size={20} />
                        ) : (
                          <Volume2 size={20} />
                        )}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={isMuted ? 0 : volume}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (videoRef.current) {
                            videoRef.current.volume = val;
                            videoRef.current.muted = val === 0;
                          }
                        }}
                        className="w-0 opacity-0 invisible group-hover/volume:w-20 group-hover/volume:opacity-100 group-hover/volume:visible group-focus-within/volume:w-20 group-focus-within/volume:opacity-100 group-focus-within/volume:visible transition-all duration-300 accent-[#E50914] h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  )}

                  <span className="text-[10px] md:text-sm font-bold font-mono text-gray-300 mt-0.5 tabular-nums select-none">
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
                </div>

                <div className="flex items-center gap-3 sm:gap-4 md:gap-6 text-xs font-semibold">
                  {/* Side list trigger button for episodes */}
                  {episodes && episodes.length > 0 && !(isMobile && isPortrait) && (
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        const newOpen = !isEpisodesOpen;
                        setIsEpisodesOpen(newOpen); 
                        setIsSettingsOpen(false); 
                        if (newOpen && videoRef.current) {
                          videoRef.current.pause();
                          setIsPlaying(false);
                        }
                      }} 
                      className={cn(
                        "hover:opacity-100 transition-all flex items-center gap-2 rounded-xl active:scale-95 cursor-pointer px-3 py-1.5 bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1]",
                        isEpisodesOpen ? "text-[#E50914] opacity-100 font-bold border-red-500/50" : "opacity-85 text-white"
                      )}
                      title="Danh sách tập"
                    >
                      <List size={18} />
                      <span className="font-sans text-xs">Tập phim</span>
                    </button>
                  )}

                  {/* Picture-in-Picture (Overlay Player) */}
                  {typeof document !== 'undefined' && document.pictureInPictureEnabled && (
                    <button 
                      onClick={togglePiP} 
                      className="hover:text-gray-300 hover:scale-110 transition-all cursor-pointer"
                      title="Phát đè màn hình (Picture-in-Picture)"
                    >
                      <PictureInPicture size={20} />
                    </button>
                  )}

                  {/* Custom System Configuration/Settings Overlay HUD opener */}
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setIsSettingsOpen(!isSettingsOpen); 
                      setIsEpisodesOpen(false); 
                    }} 
                    className={cn("hover:text-gray-300 hover:scale-110 transition-all cursor-pointer", isSettingsOpen && "text-red-500 rotate-90")}
                  >
                    <Settings size={20} />
                  </button>
                  <button onClick={toggleFullscreen} className="hover:text-gray-300 hover:scale-110 active:scale-95 transition-all">
                    <Maximize size={20} />
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
