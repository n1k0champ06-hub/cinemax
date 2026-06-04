import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Play, Pause, Rewind, FastForward, Maximize, VolumeX, Volume2, Volume1, 
  Settings, ArrowLeft, Loader2, Check, PictureInPicture, RotateCcw, RotateCw, 
  List, ShieldCheck, Sparkles, Palette, Eye, EyeOff, Sliders, Maximize2, Users, 
  Cast, Download, X, ChevronDown, ChevronRight, CheckSquare, Square, Tv, Film,
  Minimize2, Expand, Sun, Subtitles, Plus, Minus, Wifi, Server, Database, AlertCircle, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Hls from 'hls.js';
import { useWatchProgress } from '../../hooks/useStorage';
import { cn } from '../../lib/utils';
import { PlayerSelect } from './PlayerSelect';
import { SubtitleOverlay } from './SubtitleOverlay';
import { StreamItem } from '../../api/streamProviders/types';

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

const mapLangToDisplay = (lang: string): string => {
  const clean = lang.trim().toLowerCase();
  const map: Record<string, string> = {
    'vi': 'Tiếng Việt',
    'vie': 'Tiếng Việt',
    'en': 'Tiếng Anh',
    'eng': 'Tiếng Anh',
    'zh': 'Tiếng Trung',
    'zho': 'Tiếng Trung',
    'chi': 'Tiếng Trung',
    'ja': 'Tiếng Nhật',
    'jpn': 'Tiếng Nhật',
    'ko': 'Tiếng Hàn',
    'kor': 'Tiếng Hàn',
    'fr': 'Tiếng Pháp',
    'fra': 'Tiếng Pháp',
    'fre': 'Tiếng Pháp',
    'de': 'Tiếng Đức',
    'deu': 'Tiếng Đức',
    'ger': 'Tiếng Đức',
    'es': 'Tiếng Tây Ban Nha',
    'spa': 'Tiếng Tây Ban Nha',
    'pt': 'Tiếng Bồ Đào Nha',
    'por': 'Tiếng Bồ Đào Nha',
    'ru': 'Tiếng Nga',
    'rus': 'Tiếng Nga',
    'th': 'Tiếng Thái',
    'tha': 'Tiếng Thái',
  };
  return map[clean] || lang;
};

const getCleanSubName = (name: string | undefined | null, lang: string | undefined | null, index: number): string => {
  let cleanName = name ? name.trim() : '';
  let cleanLang = lang ? lang.trim() : '';
  
  if (/^\d+$/.test(cleanName)) {
    cleanName = '';
  }
  
  if (cleanLang) {
    const mapped = mapLangToDisplay(cleanLang);
    if (cleanName && cleanName.toLowerCase() !== cleanLang.toLowerCase()) {
      return `${mapped} (${cleanName})`;
    }
    return mapped;
  }
  
  if (cleanName) {
    return cleanName;
  }
  
  return `Phụ đề #${index + 1}`;
};

export const NetflixPlayer: React.FC<NetflixPlayerProps> = ({ 
  url, embedUrl, headers, subtitleUrl, externalSubtitles = [], title, slug, episodeName, posterUrl, thumbUrl, movieName, onClose,
  servers, selectedServerId, onServerChange,
  episodes = [], onEpisodeSelect,
  isTv = false, currentSeason = 1, activeEpSeason = 1, seasons = [], onSeasonChange, tmdbEpisodes = [],
  streams = [], activeStream = null, onStreamSelect, isAggregatorLoading = false
}) => {
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

  // Reset player state immediately when episode changes to avoid displaying old timestamp/video
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setIsBuffering(true);
    
    // Clean up Hls first before manipulating the video tag
    if (hlsRef.current) {
      try {
        hlsRef.current.detachMedia();
        hlsRef.current.destroy();
      } catch (e) {}
      hlsRef.current = null;
    }

    const video = videoRef.current;
    if (video) {
      try {
        video.pause();
        video.currentTime = 0;
        video.removeAttribute('src');
        video.load();
      } catch (e) {}
    }
  }, [episodeName]);

  // Settings & Navigation panels
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showAdWarning, setShowAdWarning] = useState(false);
  const [pendingStream, setPendingStream] = useState<StreamItem | null>(null);
  const [hasShownAdWarningForUrl, setHasShownAdWarningForUrl] = useState<string | null>(null);
  const [isEpisodesOpen, setIsEpisodesOpen] = useState(false);
  const [isSeasonDropdownOpen, setIsSeasonDropdownOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'main' | 'quality' | 'speed' | 'captions' | 'audioTrack' | 'appearance' | 'videoFit' | 'aspectRatio' | 'gestures' | 'subSettings'>('main');
 
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
  const [gestureLeftZone, setGestureLeftZone] = useState<number>(() => {
    const val = localStorage.getItem('cinemax_gesture_left_zone');
    return val ? parseInt(val) : 20; // Default 20%
  });
  const [gestureRightZone, setGestureRightZone] = useState<number>(() => {
    const val = localStorage.getItem('cinemax_gesture_right_zone');
    return val ? parseInt(val) : 20; // Default 20%
  });
  const [holdToSeekZone, setHoldToSeekZone] = useState<'center' | 'left' | 'right' | 'any'>(() => {
    return (localStorage.getItem('cinemax_hold_seek_zone') as any) || 'any';
  });
  const [holdToSeekDelay, setHoldToSeekDelay] = useState<number>(() => {
    const val = localStorage.getItem('cinemax_hold_seek_delay');
    return val ? parseFloat(val) : 0.5; // Default 0.5 seconds
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

  // Resolve streaming details from activeStream if available
  const resolvedUrl = useMemo(() => {
    return activeStream ? (activeStream.type === 'hls' ? activeStream.url : undefined) : url;
  }, [activeStream, url]);

  const resolvedEmbedUrl = useMemo(() => {
    return activeStream ? (activeStream.type === 'embed' ? activeStream.url : undefined) : embedUrl;
  }, [activeStream, embedUrl]);

  const resolvedHeaders = useMemo(() => {
    return activeStream?.headers || headers;
  }, [activeStream?.headers, headers]);

  const serializedHeaders = useMemo(() => {
    return JSON.stringify(resolvedHeaders || {});
  }, [resolvedHeaders]);

  const [isSourcesOpen, setIsSourcesOpen] = useState(false);

  // Embedding
  const [useEmbed, setUseEmbed] = useState(!resolvedUrl && !!resolvedEmbedUrl);
  const isIframeMode = useEmbed || (!resolvedUrl && !!resolvedEmbedUrl);
  const [areIframeControlsVisible, setAreIframeControlsVisible] = useState(true);

  useEffect(() => {
    setUseEmbed(!resolvedUrl && !!resolvedEmbedUrl);
  }, [resolvedUrl, resolvedEmbedUrl]);

  // Monitor resolvedEmbedUrl to auto-trigger ad warning popup for VidSrc/embed.su/vsrc.su
  useEffect(() => {
    console.log("[NetflixPlayer debug] resolvedEmbedUrl useEffect fired:", {
      resolvedEmbedUrl,
      activeStreamProvider: activeStream?.provider,
      hasShownAdWarningForUrl,
      shouldTrigger: resolvedEmbedUrl && 
        (resolvedEmbedUrl.includes('vidsrc') || resolvedEmbedUrl.includes('embed.su') || resolvedEmbedUrl.includes('vsrc.su')) && 
        hasShownAdWarningForUrl !== resolvedEmbedUrl
    });
    if (resolvedEmbedUrl && 
        (resolvedEmbedUrl.includes('vidsrc') || resolvedEmbedUrl.includes('embed.su') || resolvedEmbedUrl.includes('vsrc.su')) && 
        hasShownAdWarningForUrl !== resolvedEmbedUrl) {
      console.log("[NetflixPlayer debug] Setting showAdWarning to true");
      setPendingStream(activeStream);
      setShowAdWarning(true);
      setHasShownAdWarningForUrl(resolvedEmbedUrl);
    }
  }, [resolvedEmbedUrl, activeStream, hasShownAdWarningForUrl]);

  // External subtitle offset state & timer
  const [subtitleOffset, setSubtitleOffset] = useState(0);
  const [subEnabled, setSubEnabled] = useState(true);

  // Subtitle V3 & Audio source selection state
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<number | string>('v3');

  const combinedSubtitleTracks = useMemo(() => {
    const list: { id: number | string; name: string }[] = [
      { id: 'off', name: 'Tắt phụ đề' }
    ];

    // Deduplicate by downloadUrl to avoid identical options
    const seenUrls = new Set<string>();
    
    if (subtitleUrl) {
      seenUrls.add(subtitleUrl);
      list.push({ id: 'v3', name: 'Tiếng Việt #1' });
    }

    if (externalSubtitles && externalSubtitles.length > 0) {
      const langCounts: Record<string, number> = {};
      
      // If we already added the default subtitleUrl, increment count for its language
      if (subtitleUrl) {
        langCounts['vi'] = 1;
      }

      externalSubtitles.forEach((track, index) => {
        if (track.downloadUrl && !seenUrls.has(track.downloadUrl)) {
          seenUrls.add(track.downloadUrl);
          
          const lang = track.lang || 'vi';
          langCounts[lang] = (langCounts[lang] || 0) + 1;
          const langLabel = lang === 'en' ? 'Tiếng Anh' : 'Tiếng Việt';
          
          list.push({ id: `ext-${track.id || index}`, name: `${langLabel} #${langCounts[lang]}` });
        }
      });
    }

    subtitleTracks.forEach(track => {
      list.push({ id: track.id, name: track.name });
    });
    return list;
  }, [subtitleTracks, subtitleUrl, externalSubtitles]);

  useEffect(() => {
    if (subtitleUrl) {
      setSelectedSubtitleId('v3');
      setSubEnabled(true);
    } else if (externalSubtitles && externalSubtitles.length > 0) {
      const firstExt = externalSubtitles[0];
      setSelectedSubtitleId(`ext-${firstExt.id || 0}`);
      setSubEnabled(true);
    } else {
      setSelectedSubtitleId('off');
      setSubEnabled(false);
    }
  }, [subtitleUrl, externalSubtitles]);

  const activeExternalSubUrl = useMemo(() => {
    if (typeof selectedSubtitleId === 'string' && selectedSubtitleId.startsWith('ext-')) {
      const targetId = selectedSubtitleId.substring(4);
      const match = externalSubtitles?.find(t => `ext-${t.id}` === selectedSubtitleId || String(t.id) === targetId);
      return match ? match.downloadUrl : null;
    }
    if (selectedSubtitleId === 'v3') {
      return subtitleUrl || null;
    }
    return null;
  }, [selectedSubtitleId, externalSubtitles, subtitleUrl]);

  useEffect(() => {
    if (hlsRef.current) {
      if (subEnabled) {
        if (typeof selectedSubtitleId === 'number') {
          hlsRef.current.subtitleTrack = selectedSubtitleId;
        } else {
          hlsRef.current.subtitleTrack = -1;
        }
      } else {
        hlsRef.current.subtitleTrack = -1;
      }
    }
  }, [subEnabled, selectedSubtitleId]);

  // Iframe sync
  const [iframePlayStart, setIframePlayStart] = useState<number | null>(null);
  const [iframeBase, setIframeBase] = useState(0);
  const iframeCurrentMs = useMemo(() => {
    if (!iframePlayStart) return iframeBase;
    return iframeBase + (Date.now() - iframePlayStart);
  }, [iframePlayStart, iframeBase]);

  useEffect(() => {
    if (isIframeMode) {
      setIframePlayStart(Date.now());
      setIframeBase(0);
    } else {
      setIframePlayStart(null);
    }
  }, [resolvedEmbedUrl, isIframeMode]);

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
    localStorage.setItem('cinemax_gesture_left_zone', gestureLeftZone.toString());
  }, [gestureLeftZone]);
  useEffect(() => {
    localStorage.setItem('cinemax_gesture_right_zone', gestureRightZone.toString());
  }, [gestureRightZone]);
  useEffect(() => {
    localStorage.setItem('cinemax_hold_seek_zone', holdToSeekZone);
  }, [holdToSeekZone]);
  useEffect(() => {
    localStorage.setItem('cinemax_hold_seek_delay', holdToSeekDelay.toString());
  }, [holdToSeekDelay]);

  // Handle hls.js level and track extraction
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsBuffering(true);

    // Reset speed state on stream load / episode change
    setIsSpeeding(false);
    video.playbackRate = playbackRate;

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
      if (video) {
        try {
          video.currentTime = initialTime;
        } catch (e) {
          // Fallback if metadata is not loaded yet (readyState < HAVE_METADATA)
          const onMetadataLoaded = () => {
            try {
              video.currentTime = initialTime;
            } catch (_) {}
            video.removeEventListener('loadedmetadata', onMetadataLoaded);
          };
          video.addEventListener('loadedmetadata', onMetadataLoaded);
        }
      }
      // If the user picked an episode from the drawer while playing, start the new episode paused.
      if (startPausedRef.current) {
        startPausedRef.current = false;
        video.pause();
        setIsPlaying(false);
        setIsBuffering(false);
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
      setIsBuffering(false);
    };

    const handleVideoError = () => {
      console.warn("Lỗi phát luồng trực tiếp, tự động chuyển sang Iframe embed dự phòng!");
      if (resolvedEmbedUrl) {
        setUseEmbed(true);
      }
    };

    let hls: Hls | null = null;
    
    if (Hls.isSupported() && resolvedUrl) {
      const activeStreamCategory = activeStream?.category;
      const isVietnameseSource = activeStreamCategory === 'vi';
      console.log(`[NetflixPlayer debug] Initializing HLS.js for URL: ${resolvedUrl} (isVietnameseSource: ${isVietnameseSource})`);
      
      const headersObj = JSON.parse(serializedHeaders);

      hls = new Hls({ 
        maxBufferLength: isVietnameseSource ? 40 : 10,
        maxMaxBufferLength: isVietnameseSource ? 60 : 20,
        maxBufferSize: isVietnameseSource ? 80 * 1024 * 1024 : 15 * 1000 * 1000,
        enableWorker: true,
        lowLatencyMode: !isVietnameseSource,
        capLevelToPlayerSize: true,
        backBufferLength: 10,
        xhrSetup: (xhr) => {
          if (headersObj) {
            Object.entries(headersObj).forEach(([key, val]) => {
              xhr.setRequestHeader(key, String(val));
            });
          }
        }
      });
      hlsRef.current = hls;

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        console.log("[NetflixPlayer debug] HLS.js media attached successfully to video element");
      });

      hls.loadSource(resolvedUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        console.log(`[NetflixPlayer debug] HLS.js manifest parsed. Level count: ${data.levels?.length || 0}`);
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
            name: getCleanSubName(sub.name, sub.lang, index)
          }));
          setSubtitleTracks([{ id: -1, name: 'Tắt phụ đề' }, ...subs]);
          setActiveSubtitle(hls.subtitleTrack);
        }
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.warn(`[NetflixPlayer debug] HLS.js error event: ${data.type} (${data.details}), fatal: ${data.fatal}`, data);
        if (data.fatal) {
          console.error("[NetflixPlayer debug] HLS fatal error, falling back to Iframe embed:", data);
          if (resolvedEmbedUrl) {
            setUseEmbed(true);
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl') && resolvedUrl) {
      console.log(`[NetflixPlayer debug] Native Safari HLS playback for URL: ${resolvedUrl}`);
      video.src = resolvedUrl;
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
        try {
          console.log("[NetflixPlayer debug] Cleaning up HLS.js player instance");
          hls.detachMedia();
          hls.destroy();
        } catch (e) {}
        hlsRef.current = null;
      }
      try {
        video.pause();
        video.currentTime = 0;
        video.removeAttribute('src');
        video.load();
      } catch (e) {}
      video.removeEventListener('loadedmetadata', handleReady);
      video.removeEventListener('error', handleVideoError);
    };
  }, [resolvedUrl, slug, episodeName, resolvedEmbedUrl, autoplay, isTv, posterUrl, thumbUrl, movieName, activeStream?.category, serializedHeaders, isIframeMode]);

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
      if (isIframeMode) {
        saveProgress(slug, {
          episodeName,
          currentTime: 0,
          duration: 100,
          savedAt: Date.now(),
          posterUrl,
          thumbUrl,
          movieName,
          season: isTv ? currentSeason : undefined
        });
        return;
      }

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

    if (isIframeMode) {
      save();
      return;
    }

    const interval = setInterval(save, 10000); // 10s
    return () => {
      clearInterval(interval);
      save();
    };
  }, [slug, episodeName, posterUrl, thumbUrl, movieName, saveProgress, isIframeMode, isTv, currentSeason]);

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
        case '[':
          e.preventDefault();
          setSubtitleOffset(prev => prev - 250);
          break;
        case ']':
          e.preventDefault();
          setSubtitleOffset(prev => prev + 250);
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
      if (isPlaying && !isSettingsOpen && !isEpisodesOpen && !isSourcesOpen) setShowControls(false);
    }, 4000);
  }, [isPlaying, isSettingsOpen, isEpisodesOpen, isSourcesOpen]);

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

  const handleSubtitleTrackChange = (id: number | string) => {
    setSelectedSubtitleId(id);
    if (id === 'off') {
      setSubEnabled(false);
      if (hlsRef.current) hlsRef.current.subtitleTrack = -1;
    } else {
      setSubEnabled(true);
      if (hlsRef.current) {
        if (typeof id === 'number') {
          hlsRef.current.subtitleTrack = id;
        } else {
          hlsRef.current.subtitleTrack = -1;
        }
      }
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

  // Auto-next listener for native video ended and cross-origin iframe messages
  useEffect(() => {
    // 1. Listen for native video element ended event
    const video = videoRef.current;
    const onEndedListener = () => {
      console.log('[Cinemax] Native video ended event triggered.');
      handleVideoEnded();
    };

    if (video) {
      video.addEventListener('ended', onEndedListener);
    }

    // 2. Listen for cross-origin iframe postMessages (vidsrc, embed.su, etc.)
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!data) return;

        // Common ended flags in postMessage from embed providers
        const isEnded = 
          data.event === 'ended' || 
          data.event === 'video_ended' ||
          data.event === 'player_ended' ||
          data.type === 'ended' ||
          data.type === 'video_ended' ||
          data.status === 'ended' ||
          data.state === 'ended' ||
          data.state === 'FINISHED' ||
          (data.type === 'MEDIA_DATA' && (data.data?.event === 'ended' || data.data?.state === 'ended' || data.data?.status === 'ended')) ||
          data.method === 'ended' ||
          data.action === 'ended';

        if (isEnded) {
          console.log('[Cinemax] Detected video ended from iframe message:', data);
          handleVideoEnded();
        }
      } catch (err) {
        // Ignore JSON parse errors
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      if (video) {
        video.removeEventListener('ended', onEndedListener);
      }
      window.removeEventListener('message', handleMessage);
    };
  }, [videoRef.current, autoNext, episodes, episodeName]);

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
        // Double tap handled here on mobile (50/50 split)
        const w = window.innerWidth;
        if (e.touches[0].clientX < w * 0.5) {
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
        
        // Long press for seek/2x speed fwd
        if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
        
        const clickX = e.touches[0].clientX;
        const w = window.innerWidth;
        
        let isInsideHoldZone = false;
        if (holdToSeekZone === 'any') {
          isInsideHoldZone = true;
        } else if (holdToSeekZone === 'center') {
          const leftBoundary = w * (gestureLeftZone / 100);
          const rightBoundary = w * (1 - gestureRightZone / 100);
          isInsideHoldZone = clickX >= leftBoundary && clickX <= rightBoundary;
        } else if (holdToSeekZone === 'left') {
          isInsideHoldZone = clickX < w * (gestureLeftZone / 100);
        } else if (holdToSeekZone === 'right') {
          isInsideHoldZone = clickX > w * (1 - gestureRightZone / 100);
        }

        if (isInsideHoldZone) {
          seekTimeoutRef.current = setTimeout(() => {
            if (!touchStateRef.current.isSeeking && !touchStateRef.current.isPinching) {
              handleHoldSpeedStart(e);
            }
          }, holdToSeekDelay * 1000);
        }
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

       if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 20 && !touchStateRef.current.isSeeking) {
         // Vertical Swipe
         const percentDelta = -(dy / h); // up is negative dy
         const isLeftSide = touchStateRef.current.startX < w * (gestureLeftZone / 100);
         const isRightSide = touchStateRef.current.startX > w * (1 - gestureRightZone / 100);
         
         let action = 'disabled';
         if (isLeftSide) {
           action = gestureLeft;
         } else if (isRightSide) {
           action = gestureRight;
         }
         
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

  const renderAdWarningModal = () => {
    const modalContent = (
      <AnimatePresence>
        {showAdWarning && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm pointer-events-auto",
              isFullscreen ? "absolute inset-0" : "fixed inset-0"
            )}
            onClick={() => {
              setShowAdWarning(false);
              setPendingStream(null);
            }}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 180 }}
              className="w-full max-w-md bg-[#0c0c0e]/95 backdrop-blur-md border border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col items-center text-center shadow-[0_24px_60px_rgba(0,0,0,0.8)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mb-5 border border-amber-500/20">
                <AlertTriangle size={32} className="animate-pulse" />
              </div>
              <h3 className="text-lg sm:text-xl md:text-2xl font-extrabold uppercase tracking-wide text-white mb-3">
                Nguồn phát có quảng cáo
              </h3>
              <p className="text-sm md:text-base text-gray-300 leading-relaxed mb-6 font-medium">
                Nguồn phát này từ nhà cung cấp bên thứ ba có chứa nhiều quảng cáo. Để có trải nghiệm tốt nhất, chúng tôi khuyên bạn nên cài đặt tiện ích chặn quảng cáo <strong className="text-emerald-400">uBlock Origin</strong> hoặc sử dụng trình duyệt <strong className="text-emerald-400">Cốc Cốc</strong>.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <button
                  onClick={() => {
                    setShowAdWarning(false);
                    setPendingStream(null);
                    if (!isSourcesOpen && onClose) {
                      onClose();
                    }
                  }}
                  className="w-full sm:flex-1 h-12 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-bold text-gray-300 transition-colors cursor-pointer flex items-center justify-center"
                >
                  Quay lại
                </button>
                <button
                  onClick={() => {
                    if (pendingStream && onStreamSelect) {
                      if (pendingStream.url) {
                        setHasShownAdWarningForUrl(pendingStream.url);
                      }
                      onStreamSelect(pendingStream);
                    }
                    setShowAdWarning(false);
                    setPendingStream(null);
                    setIsSourcesOpen(false);
                  }}
                  className="w-full sm:flex-1 h-12 rounded-xl hover:opacity-90 text-sm font-bold tracking-wide text-white transition-all shadow-lg cursor-pointer active:scale-95 flex items-center justify-center text-center"
                  style={{
                    backgroundColor: activeColor,
                    boxShadow: `0 4px 20px ${activeColor}33`
                  }}
                >
                  Tôi đã hiểu, tiếp tục
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );

    if (isFullscreen) {
      return modalContent;
    }
    return createPortal(modalContent, document.body);
  };

  const renderSettingsOverlay = () => {
    if (isIframeMode) return null;
    const isLandscapeMobile = isMobile && !isPortrait;
    const textBaseClass = "text-sm md:text-base lg:text-lg font-medium text-gray-300";

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
              isMobile && isPortrait 
                ? "items-end justify-center" 
                : (isLandscapeMobile ? "items-end justify-end pb-2 pr-2" : "items-end justify-end pb-16 pr-4 sm:pb-24 sm:pr-8")
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
            "w-full sm:w-[300px] md:w-[380px] lg:w-[420px] flex flex-col relative z-20 text-white overflow-hidden shadow-2xl transition-all duration-300",
            isMobile && isPortrait 
              ? "bg-[#050505] border-t border-white/[0.08] rounded-t-[32px] pb-8 pt-3 shadow-[0_-15px_40px_rgba(0,0,0,0.85)]" 
              : "bg-black/90 backdrop-blur-md border border-white/10 rounded-2xl p-0"
          )}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          {settingsTab === 'main' ? (
            <>
              <div className="flex justify-between items-center px-5 py-4 md:px-7 md:py-5 lg:px-8 lg:py-6 border-b border-white/[0.06] relative">
                <span className="w-12 h-1.5 bg-white/15 rounded-full absolute top-2.5 left-1/2 -translate-x-1/2 sm:hidden" />
                <h3 className="text-sm md:text-base lg:text-lg font-extrabold ml-1 mt-2 sm:mt-0 uppercase tracking-wider text-gray-200">Cài đặt</h3>
                <button 
                  onClick={() => { setIsSettingsOpen(false); setTimeout(() => setSettingsTab('main'), 300); }}
                  className="p-1.5 md:p-2 rounded-full hover:bg-white/10 transition-colors mt-2 sm:mt-0"
                >
                  <X className="text-gray-400 w-4.5 h-4.5 md:w-5 md:h-5 lg:w-6 lg:h-6" />
                </button>
              </div>
              <div className={cn(
                "flex flex-col py-2 custom-scrollbar overflow-y-auto",
                isLandscapeMobile ? "max-h-[160px]" : "max-h-[70vh]"
              )}>
                {qualities && qualities.length > 0 && (
                  <div className="flex items-center justify-between py-3 px-5 md:py-4.5 md:px-7 lg:py-5 lg:px-8 hover:bg-white/5 cursor-pointer transition-colors active:bg-white/10" onClick={() => setSettingsTab('quality')}>
                    <div className="flex items-center gap-4">
                      <Sliders className="text-white w-5 h-5 md:w-5.5 md:h-5.5 lg:w-6 lg:h-6" />
                      <span className="text-sm md:text-base lg:text-lg font-medium">Chất lượng</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <span className="text-xs md:text-sm lg:text-base">{activeQuality === -1 ? 'Tự động' : qualities.find(q => q.id === activeQuality)?.name || ''}</span>
                      <ChevronRight className="w-4 h-4 md:w-[18px] md:h-[18px] lg:w-5 lg:h-5" />
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between py-3 px-5 md:py-4.5 md:px-7 lg:py-5 lg:px-8 hover:bg-white/5 cursor-pointer transition-colors active:bg-white/10" onClick={() => setSettingsTab('speed')}>
                  <div className="flex items-center gap-4">
                    <Play className="text-white w-5 h-5 md:w-5.5 md:h-5.5 lg:w-6 lg:h-6" />
                    <span className="text-sm md:text-base lg:text-lg font-medium">Tốc độ phát</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="text-xs md:text-sm lg:text-base">{playbackRate === 1 ? 'Chuẩn' : `${playbackRate}x`}</span>
                    <ChevronRight className="w-4 h-4 md:w-[18px] md:h-[18px] lg:w-5 lg:h-5" />
                  </div>
                </div>

                <div className="flex items-center justify-between py-3 px-5 md:py-4.5 md:px-7 lg:py-5 lg:px-8 hover:bg-white/5 cursor-pointer transition-colors active:bg-white/10" onClick={() => setSettingsTab('captions')}>
                  <div className="flex items-center gap-4">
                    <Subtitles className="text-white w-5 h-5 md:w-5.5 md:h-5.5 lg:w-6 lg:h-6" />
                    <span className="text-sm md:text-base lg:text-lg font-medium">Phụ đề</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="text-xs md:text-sm lg:text-base">
                      {combinedSubtitleTracks.find(t => t.id === selectedSubtitleId)?.name || 'Tắt'}
                    </span>
                    <ChevronRight className="w-4 h-4 md:w-[18px] md:h-[18px] lg:w-5 lg:h-5" />
                  </div>
                </div>

                <div className="flex items-center justify-between py-3 px-5 md:py-4.5 md:px-7 lg:py-5 lg:px-8 hover:bg-white/5 cursor-pointer transition-colors active:bg-white/10" onClick={() => setSettingsTab('subSettings')}>
                  <div className="flex items-center gap-4">
                    <Sliders className="text-white w-5 h-5 md:w-5.5 md:h-5.5 lg:w-6 lg:h-6" />
                    <span className="text-sm md:text-base lg:text-lg font-medium">Tùy chỉnh phụ đề</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="text-xs md:text-sm lg:text-base">
                      {`${subSize === 'small' ? 'Nhỏ' : subSize === 'large' ? 'Lớn' : 'Vừa'}, ${subColor === 'white' ? 'Trắng' : subColor === 'yellow' ? 'Vàng' : 'Xanh'}`}
                    </span>
                    <ChevronRight className="w-4 h-4 md:w-[18px] md:h-[18px] lg:w-5 lg:h-5" />
                  </div>
                </div>

                <div className="flex items-center justify-between py-3 px-5 md:py-4.5 md:px-7 lg:py-5 lg:px-8 hover:bg-white/5 cursor-pointer transition-colors active:bg-white/10" onClick={() => setSettingsTab('appearance')}>
                  <div className="flex items-center gap-4">
                    <Settings className="text-white w-5 h-5 md:w-5.5 md:h-5.5 lg:w-6 lg:h-6" />
                    <span className="text-sm md:text-base lg:text-lg font-medium">Tuỳ chọn khác</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <ChevronRight className="w-4 h-4 md:w-[18px] md:h-[18px] lg:w-5 lg:h-5" />
                  </div>
                </div>

                <div className="flex items-center justify-between py-3 px-5 md:py-4.5 md:px-7 lg:py-5 lg:px-8 hover:bg-white/5 cursor-pointer transition-colors active:bg-white/10" onClick={() => setSettingsTab('gestures')}>
                   <div className="flex items-center gap-4">
                     <Sun className="text-white w-5 h-5 md:w-5.5 md:h-5.5 lg:w-6 lg:h-6" />
                     <span className="text-sm md:text-base lg:text-lg font-medium">Cử chỉ</span>
                   </div>
                   <div className="flex items-center gap-2 text-gray-400">
                     <ChevronRight className="w-4 h-4 md:w-[18px] md:h-[18px] lg:w-5 lg:h-5" />
                   </div>
                 </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 px-4 py-4 md:px-6 md:py-5 lg:px-7 lg:py-6 border-b border-white/[0.06] relative">
                <span className="w-12 h-1.5 bg-white/15 rounded-full absolute top-2.5 left-1/2 -translate-x-1/2 sm:hidden" />
                <button onClick={() => setSettingsTab('main')} className="p-2 md:p-2.5 ml-1 rounded-full hover:bg-white/10 mt-2 sm:mt-0 transition-colors">
                  <ArrowLeft className="text-gray-300 w-4.5 h-4.5 md:w-5 md:h-5 lg:w-6 lg:h-6" />
                </button>
                <h3 className="text-sm md:text-base lg:text-lg font-extrabold mt-2 sm:mt-0 uppercase tracking-wider text-gray-200">
                  {settingsTab === 'quality' && 'Chất lượng'}
                  {settingsTab === 'speed' && 'Tốc độ phát'}
                  {settingsTab === 'appearance' && 'Tuỳ chọn khác'}
                  {settingsTab === 'gestures' && 'Cử chỉ'}
                  {settingsTab === 'captions' && 'Phụ đề'}
                  {settingsTab === 'audioTrack' && 'Kênh âm thanh'}
                  {settingsTab === 'subSettings' && 'Tùy chỉnh phụ đề'}
                </h3>
              </div>

              <div className={cn(
                "flex flex-col py-2 custom-scrollbar overflow-y-auto",
                isLandscapeMobile ? "max-h-[160px]" : "max-h-[70vh]"
              )}>
                {settingsTab === 'quality' && qualities.map(q => (
                  <div key={q.id} className="flex items-center gap-4 py-3 px-5 md:py-4.5 md:px-7 lg:py-5 lg:px-8 hover:bg-white/5 cursor-pointer transition-colors" onClick={() => { handleQualityChange(q.id); setSettingsTab('main'); }}>
                    <div className="w-5 md:w-6 lg:w-7 flex justify-center">{activeQuality === q.id && <Check className="text-white w-4.5 h-4.5 md:w-5 md:h-5 lg:w-6 lg:h-6" />}</div>
                    <span className={cn("text-sm md:text-base lg:text-lg transition-colors", activeQuality === q.id ? "text-white font-medium" : "text-gray-300")}>{q.id === -1 ? 'Tự động' : q.name}</span>
                  </div>
                ))}

                {settingsTab === 'speed' && [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map(speed => (
                  <div key={speed} className="flex items-center gap-4 py-3 px-5 md:py-4.5 md:px-7 lg:py-5 lg:px-8 hover:bg-white/5 cursor-pointer transition-colors" onClick={() => { handleRateChange(speed); setSettingsTab('main'); }}>
                    <div className="w-5 md:w-6 lg:w-7 flex justify-center">{playbackRate === speed && <Check className="text-white w-4.5 h-4.5 md:w-5 md:h-5 lg:w-6 lg:h-6" />}</div>
                    <span className={cn("text-sm md:text-base lg:text-lg transition-colors", playbackRate === speed ? "text-white font-medium" : "text-gray-300")}>{speed === 1 ? 'Chuẩn' : `${speed}x`}</span>
                  </div>
                ))}

                {settingsTab === 'captions' && combinedSubtitleTracks.map(track => (
                  <div key={track.id} className="flex items-center gap-4 py-3 px-5 md:py-4.5 md:px-7 lg:py-5 lg:px-8 hover:bg-white/5 cursor-pointer transition-colors" onClick={() => { handleSubtitleTrackChange(track.id); setSettingsTab('main'); }}>
                    <div className="w-5 md:w-6 lg:w-7 flex justify-center">{selectedSubtitleId === track.id && <Check className="text-white w-4.5 h-4.5 md:w-5 md:h-5 lg:w-6 lg:h-6" />}</div>
                    <span className={cn("text-sm md:text-base lg:text-lg transition-colors", selectedSubtitleId === track.id ? "text-white font-medium" : "text-gray-300")}>{track.name}</span>
                  </div>
                ))}

                {settingsTab === 'subSettings' && (
                  <div className="flex flex-col gap-1 pb-4">
                    <div className="px-5 py-2 md:px-7 md:py-3 text-[10px] md:text-xs lg:text-sm font-bold tracking-wider uppercase text-gray-500">Cấu hình phụ đề</div>
                    
                    <div className="flex items-center justify-between py-2.5 px-5 md:py-3.5 md:px-7 lg:py-4 lg:px-8 hover:bg-white/5">
                      <span className="text-sm md:text-base lg:text-lg text-gray-300">Cỡ chữ</span>
                      <PlayerSelect
                        value={subSize}
                        onChange={(val) => setSubSize(val)}
                        activeColor={activeColor}
                        options={[
                          { value: 'small', label: 'Nhỏ', icon: <Minus className="w-[14px] h-[14px] md:w-4.5 md:h-4.5 lg:w-5.5 lg:h-5.5" /> },
                          { value: 'medium', label: 'Vừa', icon: <CheckSquare className="w-[14px] h-[14px] md:w-4.5 md:h-4.5 lg:w-5.5 lg:h-5.5" /> },
                          { value: 'large', label: 'Lớn', icon: <Plus className="w-[14px] h-[14px] md:w-4.5 md:h-4.5 lg:w-5.5 lg:h-5.5" /> }
                        ]}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between py-2.5 px-5 md:py-3.5 md:px-7 lg:py-4 lg:px-8 hover:bg-white/5">
                      <span className="text-sm md:text-base lg:text-lg text-gray-300">Màu sắc</span>
                      <PlayerSelect
                        value={subColor}
                        onChange={(val) => setSubColor(val)}
                        activeColor={activeColor}
                        options={[
                          { value: 'white', label: 'Trắng', icon: <span className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 rounded-full bg-white border border-white/20 inline-block" /> },
                          { value: 'yellow', label: 'Vàng', icon: <span className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 rounded-full bg-yellow-400 inline-block" /> },
                          { value: 'cyan', label: 'Xanh', icon: <span className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 rounded-full bg-cyan-400 inline-block" /> }
                        ]}
                      />
                    </div>

                    <div className="px-5 py-3 md:px-7 md:py-4.5 lg:px-8 lg:py-5.5 mt-1 border-t border-white/[0.06] pt-3">
                      <div className="flex justify-between items-center text-sm md:text-base lg:text-lg text-gray-300 mb-2">
                        <span className={textBaseClass}>Độ lệch (Delay)</span>
                        <div className="flex items-center gap-2">
                          <span className={cn('text-xs md:text-sm lg:text-base font-mono font-bold min-w-[40px] text-right', subtitleOffset === 0 ? 'text-white/40' : 'text-emerald-400')}>
                            {subtitleOffset >= 0 ? '+' : ''}{(subtitleOffset / 1000).toFixed(2)}s
                          </span>
                          {subtitleOffset !== 0 && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); setSubtitleOffset(0); }} 
                              className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                              title="Reset delay"
                            >
                              <RotateCcw className="w-[14px] h-[14px] md:w-4.5 md:h-4.5 lg:w-5 lg:h-5" />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-2.5 mt-1.5">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSubtitleOffset(prev => prev - 250); }}
                          className="flex-1 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-lg py-2.5 md:py-3.5 lg:py-4 flex items-center justify-center gap-1.5 text-xs md:text-sm lg:text-base text-gray-300 hover:text-white font-bold transition-all cursor-pointer"
                        >
                          <Minus className="w-[14px] h-[14px] md:w-4.5 md:h-4.5 lg:w-5.5 lg:h-5.5" />
                          Nhanh hơn
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSubtitleOffset(prev => prev + 250); }}
                          className="flex-1 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-lg py-2.5 md:py-3.5 lg:py-4 flex items-center justify-center gap-1.5 text-xs md:text-sm lg:text-base text-gray-300 hover:text-white font-bold transition-all cursor-pointer"
                        >
                          <Plus className="w-[14px] h-[14px] md:w-4.5 md:h-4.5 lg:w-5.5 lg:h-5.5" />
                          Chậm hơn
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {settingsTab === 'appearance' && (
                  <div className="flex flex-col gap-1 pb-4">
                    <div className="px-5 py-2 md:px-7 md:py-3 text-[10px] md:text-xs lg:text-sm font-bold tracking-wider uppercase text-gray-500">Màn hình & Hiển thị</div>
                    
                    <div className="flex items-center justify-between py-2.5 px-5 md:py-3.5 md:px-7 lg:py-4 lg:px-8 hover:bg-white/5">
                      <span className="text-sm md:text-base lg:text-lg text-gray-300">Vừa vặn khung hình</span>
                      <PlayerSelect
                        value={videoFit}
                        onChange={(val) => setVideoFit(val)}
                        activeColor={activeColor}
                        options={[
                          { value: 'contain', label: 'Mặc định', icon: <Minimize2 className="w-[14px] h-[14px] md:w-4.5 md:h-4.5 lg:w-5.5 lg:h-5.5" /> },
                          { value: 'cover', label: 'Lấp đầy', icon: <Maximize2 className="w-[14px] h-[14px] md:w-4.5 md:h-4.5 lg:w-5.5 lg:h-5.5" /> },
                          { value: 'fill', label: 'Kéo giãn', icon: <Expand className="w-[14px] h-[14px] md:w-4.5 md:h-4.5 lg:w-5.5 lg:h-5.5" /> }
                        ]}
                      />
                    </div>


                    <div className="px-5 py-3 md:px-7 md:py-4.5 lg:px-8 lg:py-5.5 mt-1">
                      <div className="flex justify-between text-sm md:text-base lg:text-lg text-gray-300 mb-2">
                         <span className={textBaseClass}>Độ sáng</span>
                         <span className="font-mono text-xs md:text-sm lg:text-base">{(brightness * 100).toFixed(0)}%</span>
                      </div>
                      <input 
                          type="range" min="0.1" max="2.0" step="0.1" 
                          value={brightness} onChange={(e) => setBrightness(parseFloat(e.target.value))}
                          className="w-full accent-[#E50914] h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="px-5 py-2 md:px-7 md:py-3 mt-2 text-[10px] md:text-xs lg:text-sm font-bold tracking-wider uppercase text-gray-500">Phát lại</div>
                    <div className="flex items-center justify-between py-2.5 px-5 md:py-3.5 md:px-7 lg:py-4 lg:px-8 hover:bg-white/5 cursor-pointer" onClick={() => setAutoplay(!autoplay)}>
                      <span className="text-sm md:text-base lg:text-lg text-gray-300">Tự động phát</span>
                      <div className={cn("w-9 h-5 md:w-11 md:h-6 rounded-full relative transition-colors", autoplay ? "bg-[#E50914]" : "bg-neutral-600")}>
                         <div className={cn("absolute top-[2px] bottom-[2px] w-4 h-4 md:w-5 md:h-5 bg-white rounded-full transition-all", autoplay ? "right-[2px]" : "left-[2px]")} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-2.5 px-5 md:py-3.5 md:px-7 lg:py-4 lg:px-8 hover:bg-white/5 cursor-pointer" onClick={() => setAutoNext(!autoNext)}>
                      <span className="text-sm md:text-base lg:text-lg text-gray-300">Tự động nhảy tập tiếp</span>
                      <div className={cn("w-9 h-5 md:w-11 md:h-6 rounded-full relative transition-colors", autoNext ? "bg-[#E50914]" : "bg-neutral-600")}>
                         <div className={cn("absolute top-[2px] bottom-[2px] w-4 h-4 md:w-5 md:h-5 bg-white rounded-full transition-all", autoNext ? "right-[2px]" : "left-[2px]")} />
                      </div>
                    </div>
                  </div>
                )}

                {settingsTab === 'gestures' && (
                  <div className="flex flex-col gap-1 pb-4">
                    <div className="px-5 py-2 md:px-7 md:py-3 text-[10px] md:text-xs lg:text-sm font-bold tracking-wider uppercase text-gray-500">Cử chỉ vuốt dọc</div>
                    
                    <div className="flex items-center justify-between py-2.5 px-5 md:py-3.5 md:px-7 lg:py-4 lg:px-8 hover:bg-white/5">
                      <span className="text-sm md:text-base lg:text-lg text-gray-300">Vuốt bên trái</span>
                      <PlayerSelect
                        value={gestureLeft}
                        onChange={(val: any) => setGestureLeft(val)}
                        activeColor={activeColor}
                        options={[
                          { value: 'brightness', label: 'Độ sáng', icon: <Sun className="w-[14px] h-[14px] md:w-4.5 md:h-4.5 lg:w-5.5 lg:h-5.5" /> },
                          { value: 'volume', label: 'Âm lượng', icon: <Volume2 className="w-[14px] h-[14px] md:w-4.5 md:h-4.5 lg:w-5.5 lg:h-5.5" /> },
                          { value: 'disabled', label: 'Tắt', icon: <VolumeX className="w-[14px] h-[14px] md:w-4.5 md:h-4.5 lg:w-5.5 lg:h-5.5" /> }
                        ]}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between py-2.5 px-5 md:py-3.5 md:px-7 lg:py-4 lg:px-8 hover:bg-white/5">
                      <span className="text-sm md:text-base lg:text-lg text-gray-300">Vuốt bên phải</span>
                      <PlayerSelect
                        value={gestureRight}
                        onChange={(val: any) => setGestureRight(val)}
                        activeColor={activeColor}
                        options={[
                          { value: 'volume', label: 'Âm lượng', icon: <Volume2 className="w-[14px] h-[14px] md:w-4.5 md:h-4.5 lg:w-5.5 lg:h-5.5" /> },
                          { value: 'brightness', label: 'Độ sáng', icon: <Sun className="w-[14px] h-[14px] md:w-4.5 md:h-4.5 lg:w-5.5 lg:h-5.5" /> },
                          { value: 'disabled', label: 'Tắt', icon: <VolumeX className="w-[14px] h-[14px] md:w-4.5 md:h-4.5 lg:w-5.5 lg:h-5.5" /> }
                        ]}
                      />
                    </div>

                    <div className="px-5 py-3 md:px-7 md:py-4.5 lg:px-8 lg:py-5.5 mt-1 border-t border-white/[0.06] pt-2">
                      <div className="flex justify-between text-sm md:text-base lg:text-lg text-gray-300 mb-2">
                         <span className={textBaseClass}>Khu vực sát trái (Vuốt dọc)</span>
                         <span className="font-mono text-xs md:text-sm lg:text-base">{gestureLeftZone}%</span>
                      </div>
                      <input 
                          type="range" min="5" max="45" step="5" 
                          value={gestureLeftZone} onChange={(e) => setGestureLeftZone(parseInt(e.target.value))}
                          className="w-full accent-[#E50914] h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="px-5 py-3 md:px-7 md:py-4.5 lg:px-8 lg:py-5.5 mt-1">
                      <div className="flex justify-between text-sm md:text-base lg:text-lg text-gray-300 mb-2">
                         <span className={textBaseClass}>Khu vực sát phải (Vuốt dọc)</span>
                         <span className="font-mono text-xs md:text-sm lg:text-base">{gestureRightZone}%</span>
                      </div>
                      <input 
                          type="range" min="5" max="45" step="5" 
                          value={gestureRightZone} onChange={(e) => setGestureRightZone(parseInt(e.target.value))}
                          className="w-full accent-[#E50914] h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="px-5 py-2 md:px-7 md:py-3 mt-2 text-[10px] md:text-xs lg:text-sm font-bold tracking-wider uppercase text-gray-500 border-t border-white/[0.06] pt-3">Đè màn hình để tua nhanh</div>
                    <div className="flex items-center justify-between py-2.5 px-5 md:py-3.5 md:px-7 lg:py-4 lg:px-8 hover:bg-white/5">
                      <span className="text-sm md:text-base lg:text-lg text-gray-300">Vùng kích hoạt đè</span>
                      <PlayerSelect
                        value={holdToSeekZone}
                        onChange={(val: any) => setHoldToSeekZone(val)}
                        activeColor={activeColor}
                        options={[
                          { value: 'any', label: 'Bất kỳ đâu' },
                          { value: 'center', label: 'Ở giữa' },
                          { value: 'left', label: 'Sát trái' },
                          { value: 'right', label: 'Sát phải' }
                        ]}
                      />
                    </div>

                    <div className="flex items-center justify-between py-2.5 px-5 md:py-3.5 md:px-7 lg:py-4 lg:px-8 hover:bg-white/5">
                      <span className="text-sm md:text-base lg:text-lg text-gray-300">Thời gian đè để tua</span>
                      <PlayerSelect
                        value={holdToSeekDelay}
                        onChange={(val: any) => setHoldToSeekDelay(val)}
                        activeColor={activeColor}
                        options={[
                          { value: 0.5, label: '0.5 giây' },
                          { value: 1.0, label: '1.0 giây' },
                          { value: 1.5, label: '1.5 giây' },
                          { value: 2.0, label: '2.0 giây' }
                        ]}
                      />
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

  const getProviderName = (item: StreamItem) => {
    if (item.provider === 'cinepro') {
      const match = item.providerLabel.match(/\(([^)]+)\)/);
      return match ? match[1].toUpperCase() : 'CINEPRO';
    }
    return item.provider.toUpperCase();
  };

  const renderServerGroup = (title: string, groupStreams: StreamItem[]) => {
    if (groupStreams.length === 0) return null;

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1 py-1">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-white/40">{title}</span>
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-white/35">{groupStreams.length}</span>
        </div>
        <div className="flex flex-col gap-2">
          {groupStreams.map((stream) => {
            const isSelected = activeStream ? activeStream.id === stream.id : false;
            
            // Latency styling
            let latencyColor = 'text-white/40';
            if (stream.latencyLabel === 'Ultra-fast') latencyColor = 'text-emerald-400';
            else if (stream.latencyLabel === 'Fast') latencyColor = 'text-emerald-500';
            else if (stream.latencyLabel === 'Slow') latencyColor = 'text-amber-400';
            else if (stream.latencyLabel === 'Offline') latencyColor = 'text-rose-500';

            const uppercaseLatency = (stream.latencyLabel || 'Testing...').toUpperCase();

            return (
              <div
                key={stream.id}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickDetails = {
                    component: "NetflixPlayerStreamPicker",
                    action: "SelectStream",
                    streamId: stream.id,
                    provider: stream.provider,
                    type: stream.type,
                    url: stream.url,
                    clickCoordinates: {
                      clientX: e.clientX,
                      clientY: e.clientY,
                      relativeX: Math.round(e.clientX - rect.left),
                      relativeY: Math.round(e.clientY - rect.top),
                      elementWidth: Math.round(rect.width),
                      elementHeight: Math.round(rect.height)
                    },
                    timestamp: new Date().toISOString()
                  };
                  console.log(
                    `%c[USER ACTION: CLICK]%c Stream Source: "${stream.provider || 'unknown'}" (${stream.type || 'unknown'})`,
                    'background: #10B981; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
                    'color: #ffffff; font-weight: bold;',
                    clickDetails
                  );
                  const isThirdPartyEmbed = stream.type === 'embed' && !stream.url?.includes('cinemaos.tech');
                  if (isThirdPartyEmbed) {
                    setPendingStream(stream);
                    setShowAdWarning(true);
                  } else {
                    if (onStreamSelect) {
                      onStreamSelect(stream);
                    }
                  }
                }}
                className={cn(
                  "relative group/card bg-white/[0.01] hover:bg-white/[0.03] border border-white/[0.04] hover:border-white/[0.08] rounded-xl px-4 py-3.5 flex items-center justify-between transition-all duration-200 cursor-pointer overflow-hidden",
                  isSelected ? "border-emerald-500/30 bg-emerald-500/[0.02] shadow-[0_4px_20px_rgba(16,185,129,0.04)]" : ""
                )}
              >
                {/* Active sidebar highlight line */}
                {isSelected && (
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-emerald-500 rounded-l-xl" />
                )}
                
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center bg-white/5 text-white/40 group-hover/card:bg-white/10 group-hover/card:text-white/70 transition-colors",
                    isSelected ? "bg-emerald-500/10 text-emerald-400" : ""
                  )}>
                    <Database size={16} className={cn(isSelected && 'drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]')} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className={cn("text-sm font-semibold text-white/80 group-hover/card:text-white transition-colors truncate", isSelected ? "text-white font-semibold" : "")}>
                      {stream.providerLabel}
                    </span>
                    <span className="text-[10px] text-white/40 flex items-center gap-1.5 font-mono tracking-wide mt-1 uppercase">
                      {getProviderName(stream)} 
                      <span>•</span> 
                      <span className={cn("font-bold", latencyColor)}>{uppercaseLatency}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3.5">
                  <span className="text-[10px] font-bold font-mono text-white/50 bg-white/5 border border-white/5 px-2 py-0.5 rounded uppercase">
                    {stream.quality === 'auto' ? 'AUTO' : stream.quality}
                  </span>
                  {isSelected && (
                    <Check size={16} className="text-emerald-400 stroke-[3px] shrink-0" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // No early return for iframe mode to render Cinemax player layout, title and subtitles overlay

  return (
    <div className={cn("w-full flex flex-col", isFullscreen ? "h-screen bg-black" : "h-auto bg-black")}>
      <div 
        ref={containerRef}
        className={cn(
          "relative w-full bg-black group netflix-player-container",
          isFullscreen ? "h-full overflow-hidden" : "aspect-video"
        )}
        onMouseMove={isIframeMode ? undefined : resetControlsTimeout}
        onMouseLeave={isIframeMode ? undefined : () => { if(isPlaying && !isSettingsOpen && !isEpisodesOpen && !isSourcesOpen) setShowControls(false); }}
        onClick={isIframeMode ? undefined : toggleControlsMobile}
        onTouchStart={isIframeMode ? undefined : handleTouchStart}
        onTouchMove={isIframeMode ? undefined : handleTouchMove}
        onTouchEnd={isIframeMode ? undefined : handleTouchEnd}
        onTouchCancel={isIframeMode ? undefined : handleTouchEnd}
      >
      {isIframeMode ? (
        <>
          <iframe 
            key={resolvedEmbedUrl}
            src={resolvedEmbedUrl}
            className="w-full h-full border-0 absolute inset-0 z-0 bg-black pointer-events-auto"
            allowFullScreen
            allow="autoplay *; fullscreen *; encrypted-media *; picture-in-picture *"
            referrerPolicy="origin"
          />
        </>
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
          onSeeking={() => setIsBuffering(true)}
          onSeeked={() => setIsBuffering(false)}
          onLoadedData={() => setIsBuffering(false)}
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
            aspectRatio: (aspectRatio !== 'default' && videoFit === 'contain') ? aspectRatio.replace('/', ' / ') : 'auto',
            filter: `brightness(${brightness})`,
            width: '100%',
            height: (aspectRatio === 'default' || videoFit === 'cover' || videoFit === 'fill') ? '100%' : 'auto'
          }}
          className={cn(
            "w-full transition-all duration-350",
             (aspectRatio === 'default' || videoFit === 'cover' || videoFit === 'fill') ? "h-full" : "h-auto max-h-full m-auto" 
          )}
        />
      )}

      {/* External Subtitle Overlay */}
      <SubtitleOverlay
        subtitleUrl={activeExternalSubUrl}
        videoRef={!isIframeMode ? videoRef : undefined}
        currentTimeMs={isIframeMode ? iframeCurrentMs : undefined}
        offsetMs={subtitleOffset}
        enabled={activeStream?.category !== 'vi' && subEnabled && (selectedSubtitleId === 'v3' || (typeof selectedSubtitleId === 'string' && selectedSubtitleId.startsWith('ext-')))}
      />

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
            onTouchCancel={handleHoldSpeedEnd}
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
        {((!isIframeMode && isBuffering && swipeSeekTime === null) || (isAggregatorLoading && !resolvedUrl && !resolvedEmbedUrl)) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 pointer-events-none z-40 gap-3" style={{ color: activeColor }}>
            <Loader2 size={48} className="animate-spin drop-shadow-lg" />
            <p className="text-[11px] text-white/70 font-semibold uppercase tracking-widest animate-pulse font-sans">Đang tải tập phim mới...</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isAggregatorLoading && !resolvedUrl && !resolvedEmbedUrl && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 pointer-events-auto z-40 gap-4 text-center px-6">
            <AlertCircle size={48} className="text-red-500 drop-shadow-lg animate-pulse" />
            <div className="space-y-1">
              <p className="text-base font-bold text-white font-sans">Không tìm thấy nguồn phát nào</p>
              <p className="text-xs text-white/60 max-w-sm font-sans">Chúng tôi không thể tìm thấy liên kết phát cho tập phim này. Vui lòng chọn nguồn khác hoặc thử lại sau.</p>
            </div>
            <div className="flex gap-3 mt-2">
              {onClose && (
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-full text-white text-xs font-semibold transition-all active:scale-95 cursor-pointer font-sans"
                >
                  Quay lại
                </button>
              )}
              <button
                onClick={() => setIsSourcesOpen(true)}
                className={cn("px-4 py-2 rounded-full text-white text-xs font-semibold transition-all active:scale-95 cursor-pointer font-sans shadow-lg", activeBg)}
              >
                Chọn nguồn phát
              </button>
            </div>
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
        {((!isIframeMode && showControls) || (!isPlaying && !isIframeMode) || (isIframeMode && areIframeControlsVisible && isFullscreen)) && !(isMobile && isPortrait && !isFullscreen) && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="absolute top-0 w-full bg-gradient-to-b from-black/90 via-black/40 to-transparent p-4 md:p-6 z-30 pointer-events-auto flex items-center justify-between text-white">
            <h2 className="font-extrabold text-sm md:text-lg drop-shadow-md truncate pr-8 cursor-default flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: activeColor }} />
              <span>{title}</span>
            </h2>

            {/* Episode List Selection Button inside top-right of player (Only visible when fullscreen) */}
            {isFullscreen && episodes && episodes.length > 0 && onEpisodeSelect && (
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  const newOpen = !isEpisodesOpen;
                  setIsEpisodesOpen(newOpen); 
                  setIsSettingsOpen(false); 
                  setIsSourcesOpen(false);
                  if (newOpen && videoRef.current) {
                    videoRef.current.pause();
                    setIsPlaying(false);
                  }
                }} 
                className={cn(
                  "hover:opacity-100 transition-[transform,background-color,border-color,color] duration-150 flex items-center gap-1.5 md:gap-2 rounded-full active:scale-95 cursor-pointer px-4 py-2 md:px-5 md:py-2.5 bg-black/80 border border-white/15 hover:bg-black hover:border-white/30 text-white text-xs md:text-sm font-bold shadow-2xl select-none",
                  isEpisodesOpen ? "text-[#E50914] border-red-500/50 bg-black shadow-[0_0_15px_rgba(229,9,20,0.15)]" : "text-white"
                )}
                title="Chọn tập phim"
              >
                <List size={16} />
                <span>Chọn tập phim</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Player Settings HUD Overlay (YouTube Style) */}
      {renderSettingsOverlay()}

      {/* Video Sources Sidebar/Popup Panel */}
      {(() => {
        const isLandscapeMobile = isMobile && !isPortrait;
        const sidebarContent = (
          <AnimatePresence>
            {isSourcesOpen && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={cn(
                  "pointer-events-auto flex",
                  (isMobile && isPortrait) 
                    ? "items-end justify-center" 
                    : (isLandscapeMobile ? "items-end justify-end pb-2 pr-2" : "items-end justify-end pb-16 pr-4 sm:pb-24 sm:pr-8"),
                  isFullscreen ? "absolute inset-0 z-40 bg-black/20" : "fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm"
                )}
              >
                {/* Click outside sidebar to close */}
                <div className="absolute inset-0 z-10" onClick={() => setIsSourcesOpen(false)} />

                <motion.div 
                  initial={(isMobile && isPortrait) ? { y: '100%', opacity: 0.5 } : { y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={(isMobile && isPortrait) ? { y: '100%', opacity: 0.5 } : { y: 20, opacity: 0 }}
                  transition={(isMobile && isPortrait) ? { type: 'tween', ease: [0.16, 1, 0.3, 1], duration: 0.25 } : { type: 'tween', ease: [0.16, 1, 0.3, 1], duration: 0.22 }}
                  className={cn(
                    "relative z-20 flex flex-col transition-all duration-300 overflow-hidden",
                    (isMobile && isPortrait)
                      ? "w-full max-h-[82vh] h-auto pb-6 border-t border-white/[0.08] rounded-t-[28px] bg-black shadow-[0_-15px_40px_rgba(0,0,0,0.85)]"
                      : cn(
                          "w-full sm:w-[320px] md:w-[400px] lg:w-[440px] max-h-[65vh] sm:max-h-[75vh] h-auto border border-white/10 rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.8)] bg-black/90 backdrop-blur-md p-0",
                          isFullscreen ? "absolute z-50 bg-black/85" : ""
                        )
                  )}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => e.stopPropagation()}
                >
                  {isMobile && isPortrait && (
                    <div className="w-12 h-1.5 bg-white/15 rounded-full mx-auto my-3 shrink-0" />
                  )}
                  {/* Header */}
                  <div className="p-4 border-b border-white/[0.08] flex flex-col gap-3 shrink-0 bg-transparent">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        {(isMobile && isPortrait) ? (
                          <button 
                            onClick={() => setIsSourcesOpen(false)}
                            className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                          >
                            <ArrowLeft size={20} />
                          </button>
                        ) : (
                          <Database size={18} className="text-emerald-400 animate-pulse" />
                        )}
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-white tracking-wider uppercase">Nguồn phát Video</span>
                          <span className="text-[10px] text-gray-400 font-medium tracking-wide">Chọn server</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {isAggregatorLoading && (
                          <Loader2 size={16} className="text-emerald-400 animate-spin shrink-0" />
                        )}
                        {!(isMobile && isPortrait) && (
                          <button 
                            onClick={() => setIsSourcesOpen(false)}
                            className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                          >
                            <X size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Server List */}
                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-6">
                    {/* Vietnamese Sources */}
                    {renderServerGroup('NGUỒN VIỆT NAM', streams.filter(s => s.category === 'vi' || s.lang === 'vi'))}
                    
                    {/* Premium Sources */}
                    {renderServerGroup('PREMIUM SOURCES', streams.filter(s => s.category === 'premium' && s.lang !== 'vi'))}

                    {/* Community Sources */}
                    {renderServerGroup('COMMUNITY SOURCES', streams.filter(s => (s.category === 'standard' || s.category === 'free' || !s.category) && s.lang !== 'vi'))}

                    {streams.length === 0 && !isAggregatorLoading && (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <p className="text-sm text-gray-400 font-medium">Không tìm thấy nguồn phát nào.</p>
                      </div>
                    )}

                    {streams.length === 0 && isAggregatorLoading && (
                      <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                        <Loader2 size={24} className="text-emerald-400 animate-spin" />
                        <p className="text-sm text-gray-400 font-medium">Đang tìm kiếm các nguồn phát...</p>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="p-4 border-t border-white/[0.08] text-center bg-transparent shrink-0">
                    <span className="text-[10px] font-medium tracking-widest text-white/30 uppercase font-sans">
                      Đổi nguồn phát nếu gặp hiện tượng giật lag
                    </span>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        );

        if (isFullscreen) {
          return sidebarContent;
        } else {
          return createPortal(sidebarContent, document.body);
        }
      })()}

      {/* Dynamic Advanced Episodes Overlay Modal (Matches Second Image Request) */}
      {(() => {
        const episodesContent = (
          <AnimatePresence>
            {isEpisodesOpen && episodes.length > 0 && onEpisodeSelect && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={cn(
                  "pointer-events-auto flex",
                  (isMobile && isPortrait) ? "items-end justify-center" : "justify-end",
                  isFullscreen ? "absolute inset-0 z-40 bg-black/90" : "fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm"
                )}
              >
                {/* Click outside sidebar to close */}
                <div className="absolute inset-0 z-10" onClick={() => setIsEpisodesOpen(false)} />

                <motion.div 
                  initial={(isMobile && isPortrait) ? { y: '100%', opacity: 0.5 } : { x: '100%', opacity: 0.5 }}
                  animate={(isMobile && isPortrait) ? { y: 0, opacity: 1 } : { x: 0, opacity: 1 }}
                  exit={(isMobile && isPortrait) ? { y: '100%', opacity: 0.5 } : { x: '100%', opacity: 0.5 }}
                  transition={(isMobile && isPortrait) ? { type: 'tween', ease: [0.16, 1, 0.3, 1], duration: 0.25 } : { type: 'spring', damping: 24, stiffness: 150 }}
                  className={cn(
                    "relative z-20 flex flex-col transition-all duration-300",
                    (isMobile && isPortrait)
                      ? "w-full max-h-[82vh] h-auto pb-6 border-t border-white/[0.08] rounded-t-[28px] bg-black shadow-[0_-15px_40px_rgba(0,0,0,0.85)]"
                      : cn(
                          "w-full max-w-md sm:max-w-lg h-full border-l border-white/[0.08] shadow-[rgba(0,0,0,0.9)_0px_0px_50px_10px] bg-black",
                          isFullscreen ? "bg-black" : "bg-black/98 backdrop-blur-2xl"
                        )
                  )}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => e.stopPropagation()}
                >
                  {isMobile && isPortrait && (
                    <div className="w-12 h-1.5 bg-white/15 rounded-full mx-auto my-3 shrink-0" />
                  )}
                  {/* Overlay Top Bar (Season Selection + Close) */}
                  <div className="p-4 border-b border-white/[0.08] flex flex-col gap-3 shrink-0 bg-transparent sticky top-0 z-30">
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
                              onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const clickDetails = {
                                  component: "NetflixPlayerEpisodesSidebar",
                                  action: "SelectSeason",
                                  seasonNumber: s.season_number,
                                  clickCoordinates: {
                                    clientX: e.clientX,
                                    clientY: e.clientY,
                                    relativeX: Math.round(e.clientX - rect.left),
                                    relativeY: Math.round(e.clientY - rect.top),
                                    elementWidth: Math.round(rect.width),
                                    elementHeight: Math.round(rect.height)
                                  },
                                  timestamp: new Date().toISOString()
                                };
                                console.log(
                                  `%c[USER ACTION: CLICK]%c Season Changed to: Mùa ${s.season_number}`,
                                  'background: #7C3AED; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
                                  'color: #ffffff; font-weight: bold;',
                                  clickDetails
                                );
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
                  <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar bg-transparent">
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
                        : thumbUrl || posterUrl || '';

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
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickDetails = {
                              component: "NetflixPlayerEpisodesSidebar",
                              action: "SelectEpisode",
                              showTitle: movieName || title || "unknown",
                              episodeName: ep.name,
                              episodeTitle: tmdbEp?.name || "none",
                              episodeIndex: index,
                              seasonNumber: currentSeason,
                              slug: slug || "none",
                              clickCoordinates: {
                                clientX: e.clientX,
                                clientY: e.clientY,
                                relativeX: Math.round(e.clientX - rect.left),
                                relativeY: Math.round(e.clientY - rect.top),
                                elementWidth: Math.round(rect.width),
                                elementHeight: Math.round(rect.height)
                              },
                              timestamp: new Date().toISOString()
                            };
                            console.log(
                              `%c[USER ACTION: CLICK]%c Episode Selected: "${ep.name}" in season ${currentSeason} of "${movieName || title || 'unknown'}"`,
                              'background: #D97706; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
                              'color: #ffffff; font-weight: bold;',
                              clickDetails
                            );
                            onEpisodeSelect(ep);
                            setIsEpisodesOpen(false);
                          }}
                          className={cn(
                            "w-full text-left rounded-xl p-2 transition-all duration-200 flex gap-3 border select-none cursor-pointer bg-transparent",
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
        );

        if (isFullscreen) {
          return episodesContent;
        } else {
          return createPortal(episodesContent, document.body);
        }
      })()}

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
                  <button onClick={togglePlay} className="hover:text-gray-300 hover:scale-110 active:scale-95 transition-[transform,colors] duration-150 cursor-pointer">
                    {isPlaying ? <Pause fill="currentColor" size={22} /> : <Play fill="currentColor" size={22} />}
                  </button>
                  
                  {!(isMobile && isPortrait) && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); if (videoRef.current) videoRef.current.currentTime -= 10; }} className="hover:text-gray-300 hover:scale-110 active:scale-95 transition-[transform,colors] duration-150 cursor-pointer">
                        <Rewind fill="currentColor" size={20} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); if (videoRef.current) videoRef.current.currentTime += 10; }} className="hover:text-gray-300 hover:scale-110 active:scale-95 transition-[transform,colors] duration-150 cursor-pointer">
                        <FastForward fill="currentColor" size={20} />
                      </button>
                    </>
                  )}

                  {/* Volume Control (Desktop/Landscape) */}
                  {!(isMobile && isPortrait) && (
                    <div className="flex items-center gap-2 group/volume ml-2">
                      <button 
                        onClick={toggleMute} 
                        className="hover:text-gray-300 hover:scale-110 active:scale-95 transition-[transform,colors] duration-150 cursor-pointer"
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
                        className="w-0 opacity-0 invisible group-hover/volume:w-20 group-hover/volume:opacity-100 group-hover/volume:visible group-focus-within/volume:w-20 group-focus-within/volume:opacity-100 group-focus-within/volume:visible transition-[width,opacity] duration-200 accent-[#E50914] h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
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
                  {/* Picture-in-Picture (Overlay Player) */}
                  {typeof document !== 'undefined' && document.pictureInPictureEnabled && (
                    <button 
                      onClick={togglePiP} 
                      className="hover:text-gray-300 hover:scale-110 transition-[transform,colors] duration-150 cursor-pointer"
                      title="Phát đè màn hình (Picture-in-Picture)"
                    >
                      <PictureInPicture size={20} />
                    </button>
                  )}

                  {/* Video Sources / Server selection list */}
                  {streams && streams.length > 0 && (
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setIsSourcesOpen(!isSourcesOpen); 
                        setIsEpisodesOpen(false); 
                        setIsSettingsOpen(false);
                      }} 
                      className={cn(
                        "hover:opacity-100 transition-[transform,background-color,border-color,color] duration-150 flex items-center gap-2 rounded-xl active:scale-95 cursor-pointer px-3 py-1.5 bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1]",
                        isSourcesOpen ? "text-emerald-400 opacity-100 font-bold border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.15)]" : "opacity-85 text-white"
                      )}
                      title="Nguồn phát video"
                    >
                      <Wifi size={18} />
                      <span className="font-sans text-xs">Nguồn phát</span>
                    </button>
                  )}

                  {/* Custom System Configuration/Settings Overlay HUD opener */}
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setIsSettingsOpen(!isSettingsOpen); 
                      setIsEpisodesOpen(false); 
                      setIsSourcesOpen(false);
                    }} 
                    className={cn("hover:text-gray-300 hover:scale-110 transition-[transform,colors] duration-150 cursor-pointer", isSettingsOpen && "text-red-500 rotate-90")}
                  >
                    <Settings size={20} />
                  </button>
                  <button onClick={toggleFullscreen} className="hover:text-gray-300 hover:scale-110 active:scale-95 transition-[transform,colors] duration-150 cursor-pointer">
                    <Maximize size={20} />
                  </button>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Embed bottom controls bar */}
      {isIframeMode && areIframeControlsVisible && isFullscreen && (
        <div className="absolute bottom-0 left-0 w-full p-4 md:p-6 z-30 pointer-events-none flex items-center justify-between text-white">
          <div className="flex items-center gap-3 sm:gap-4 pointer-events-auto bg-[#0a0a0c]/85 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-white/10 shadow-[rgba(0,0,0,0.8)_0px_8px_30px]">
            {/* Subtitle offset */}
            <div className="flex items-center gap-1.5 bg-white/5 rounded-xl px-2.5 py-1 border border-white/10">
              <Subtitles size={14} className="text-white/40" />
              <button 
                onClick={(e) => { e.stopPropagation(); setSubtitleOffset(prev => prev - 250); }} 
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-white/60 cursor-pointer"
                title="Sub nhanh hơn [-250ms]"
              >
                <Minus size={11} />
              </button>
              <span className={cn('text-xs font-mono font-bold min-w-[36px] text-center', subtitleOffset === 0 ? 'text-white/30' : 'text-emerald-400')}>
                {subtitleOffset >= 0 ? '+' : ''}{(subtitleOffset / 1000).toFixed(2)}s
              </span>
              <button 
                onClick={(e) => { e.stopPropagation(); setSubtitleOffset(prev => prev + 250); }} 
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-white/60 cursor-pointer"
                title="Sub chậm hơn [+250ms]"
              >
                <Plus size={11} />
              </button>
              {subtitleOffset !== 0 && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setSubtitleOffset(0); }} 
                  className="w-4 h-4 flex items-center justify-center text-white/20 hover:text-white transition-colors cursor-pointer"
                  title="Reset delay"
                >
                  <RotateCcw size={10} />
                </button>
              )}
            </div>


          </div>

          <div className="flex items-center gap-4 pointer-events-auto bg-[#0a0a0c]/85 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-white/10 shadow-[rgba(0,0,0,0.8)_0px_8px_30px]">
            {/* Video Sources / Server selection list for iframe embed */}
            {streams && streams.length > 0 && (
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setIsSourcesOpen(!isSourcesOpen); 
                  setIsEpisodesOpen(false); 
                }} 
                className={cn(
                  "hover:opacity-100 transition-all flex items-center gap-2 rounded-xl active:scale-95 cursor-pointer px-3 py-1.5 bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1]",
                  isSourcesOpen ? "text-emerald-400 opacity-100 font-bold border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.15)]" : "opacity-85 text-white"
                )}
                title="Nguồn phát video"
              >
                <Wifi size={18} />
                <span className="font-sans text-xs">Nguồn phát</span>
              </button>
            )}



            {/* Fullscreen button */}
            <button onClick={toggleFullscreen} className="hover:text-gray-300 hover:scale-110 active:scale-95 transition-all cursor-pointer">
              <Maximize size={20} />
            </button>
          </div>
        </div>
      )}

      {renderAdWarningModal()}
      </div>

      {/* Embed bottom controls bar when NOT fullscreen (outside the viewport) */}
      {isIframeMode && !isFullscreen && (
        <div className="w-full bg-[#0a0a0c] border border-white/[0.06] rounded-b-2xl p-3 sm:p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4 select-none">
          {/* Title and source status */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-block w-2.5 h-2.5 rounded-full animate-pulse bg-emerald-400 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Đang phát (Embed)</span>
              <span className="text-xs sm:text-sm font-extrabold text-white truncate max-w-[250px] md:max-w-sm">{title}</span>
            </div>
          </div>

          {/* Controls button actions */}
          <div className="grid grid-cols-2 gap-2.5 w-full sm:flex sm:flex-wrap sm:w-auto sm:gap-2.5">
            {/* Subtitle Offset adjustment */}
            <div className="flex items-center justify-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.06] rounded-xl px-2 py-1 sm:px-2.5 sm:py-1.5 border border-white/[0.08] transition-all h-8 sm:h-9 w-full sm:w-auto shrink-0">
              <Subtitles size={14} className="text-white/40" />
              <button 
                onClick={(e) => { e.stopPropagation(); setSubtitleOffset(prev => prev - 250); }} 
                className="w-5.5 h-5.5 sm:w-6 sm:h-6 flex items-center justify-center rounded hover:bg-white/10 text-white/60 active:scale-90 transition-all cursor-pointer"
                title="Sub nhanh hơn [-250ms]"
              >
                <Minus size={11} />
              </button>
              <span className={cn('text-xs font-mono font-bold min-w-[38px] text-center', subtitleOffset === 0 ? 'text-white/30' : 'text-emerald-400')}>
                {subtitleOffset >= 0 ? '+' : ''}{(subtitleOffset / 1000).toFixed(2)}s
              </span>
              <button 
                onClick={(e) => { e.stopPropagation(); setSubtitleOffset(prev => prev + 250); }} 
                className="w-5.5 h-5.5 sm:w-6 sm:h-6 flex items-center justify-center rounded hover:bg-white/10 text-white/60 active:scale-90 transition-all cursor-pointer"
                title="Sub chậm hơn [+250ms]"
              >
                <Plus size={11} />
              </button>
              {subtitleOffset !== 0 && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setSubtitleOffset(0); }} 
                  className="w-4 h-4 flex items-center justify-center text-white/25 hover:text-white transition-colors cursor-pointer"
                  title="Reset delay"
                >
                  <RotateCcw size={10} />
                </button>
              )}
            </div>

            {/* Select source selection panel */}
            {streams && streams.length > 0 && (
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setIsSourcesOpen(!isSourcesOpen); 
                  setIsEpisodesOpen(false); 
                }} 
                className={cn(
                  "hover:opacity-100 transition-all flex items-center justify-center gap-2 rounded-xl active:scale-95 cursor-pointer h-8 sm:h-9 px-3 w-full sm:w-auto bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-xs sm:text-xs font-bold tracking-wide shrink-0",
                  isSourcesOpen ? "text-emerald-400 border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_10px_rgba(16,185,129,0.15)]" : "text-white/80"
                )}
                title="Chọn nguồn phát"
              >
                <Wifi size={15} className={isSourcesOpen ? "text-emerald-400" : "text-white/60"} />
                <span>Chọn nguồn</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
