import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Repeat, Shuffle,
  Music, X, ChevronUp, ChevronDown, Heart, Radio, Search,
  ListMusic, Settings, Loader2, CheckCircle2, Mic2,
  Plus, Flame, TrendingUp, SlidersHorizontal, Globe2, ExternalLink,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import { useMusicStore, EQ_PRESETS, EQ_FREQUENCIES } from "../../hooks/useMusicStore";
import { useLyrics, useCurrentLyricIndex } from "../../hooks/useLyrics";

// ─── Types ──────────────────────────────────────────────────────────────────
interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  coverUrl: string;
  bannerUrl: string;
  audioUrl: string;
  youtubeId: string;
  category: "vpop" | "indie" | "bolero" | "search" | "trending" | "recommend";
  lyrics: { time: number; text: string }[];
  duration: number;
  description?: string;
  themeColor: string;
  spotifyId?: string;
  liked?: boolean;
}

// ─── Color from text hash ────────────────────────────────────────────────────
const hashColor = (text: string): string => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = text.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return `hsla(${h}, 65%, 45%, 0.5)`;
};

// ─── Curated Vietnamese Tracks ───────────────────────────────────────────────
const CURATED: Track[] = [
  {
    id: "vpop-1", title: "Chúng Ta Của Tương Lai", artist: "Sơn Tùng M-TP", album: "Sky Tour",
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273cfbe108fb263c37553f1a60f",
    bannerUrl: "https://img.youtube.com/vi/zoEtcR5EW08/maxresdefault.jpg",
    audioUrl: "", youtubeId: "zoEtcR5EW08", category: "vpop", duration: 372,
    description: "Siêu phẩm V-Pop mang màu sắc lãng mạn về tình duyên vượt thời không.",
    themeColor: "hsla(265, 65%, 45%, 0.5)",
    lyrics: [
      { time: 0, text: "🎵 (Nhạc dạo đầu...)" }, { time: 10, text: "Từng lời nguyện ước xưa kia nay trôi về đâu..." },
      { time: 20, text: "Một mình lặng bước trong đêm sương lạnh căm..." }, { time: 30, text: "Giờ đây chúng ta vẽ hai lối đi riêng..." },
      { time: 42, text: "Liệu mai sau ta còn gặp lại nhau không em?" }, { time: 54, text: "🎵 (Điệp khúc)" },
      { time: 56, text: "Chúng ta của tương lai, sẽ mãi mãi bình yên..." },
    ]
  },
  {
    id: "vpop-2", title: "Có Chắc Yêu Là Đây", artist: "Sơn Tùng M-TP", album: "Single",
    coverUrl: "https://i.scdn.co/image/ab67616d0000b2737a3bab0e9ea1d1b13b33b3a9",
    bannerUrl: "https://img.youtube.com/vi/wuCkuMC3xDw/maxresdefault.jpg",
    audioUrl: "", youtubeId: "wuCkuMC3xDw", category: "vpop", duration: 206,
    description: "Bản pop bubblegum catchy với nét nhạc trẻ trung sôi nổi.",
    themeColor: "hsla(340, 65%, 45%, 0.5)",
    lyrics: [{ time: 0, text: "🎵 Có chắc yêu là đây..." }, { time: 15, text: "Khi anh nhìn em, lòng anh ngây ngất..." }]
  },
  {
    id: "vpop-3", title: "Chạy Ngay Đi", artist: "Sơn Tùng M-TP", album: "Sky Tour",
    coverUrl: "https://i.scdn.co/image/ab67616d0000b27375e1cf5e8cfbea45e3b9ed91",
    bannerUrl: "https://img.youtube.com/vi/mleOk1bvhpI/maxresdefault.jpg",
    audioUrl: "", youtubeId: "mleOk1bvhpI", category: "vpop", duration: 256,
    description: "Bản pop-rock kịch tính với những giai điệu hùng tráng.",
    themeColor: "hsla(220, 65%, 45%, 0.5)",
    lyrics: [{ time: 0, text: "🎵 (Nhạc dạo...)" }, { time: 12, text: "Chạy ngay đi, sao còn đứng đó..." }]
  },
  {
    id: "vpop-4", title: "Mang Tiền Về Cho Mẹ", artist: "Đen Vâu ft. Nguyên Thảo", album: "Single",
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273bdd1bec40e1ce79ffb6e6069",
    bannerUrl: "https://img.youtube.com/vi/dmtSKwb2oXE/maxresdefault.jpg",
    audioUrl: "", youtubeId: "dmtSKwb2oXE", category: "vpop", duration: 285,
    description: "Ca khúc Rap đầy cảm xúc về tình mẫu tử.",
    themeColor: "hsla(35, 65%, 45%, 0.5)",
    lyrics: [{ time: 0, text: "🎵 (Nhạc dạo...)" }, { time: 10, text: "Con sẽ mang tiền về cho mẹ..." }]
  },
  {
    id: "vpop-5", title: "Bạc Phận", artist: "K-ICM ft. Jack", album: "Single",
    coverUrl: "https://i.scdn.co/image/ab67616d0000b27368e2a79b6a0dce6b1e1af8ae",
    bannerUrl: "https://img.youtube.com/vi/tFf9pHjTNQI/maxresdefault.jpg",
    audioUrl: "", youtubeId: "tFf9pHjTNQI", category: "vpop", duration: 237,
    description: "Bản nhạc Pop-Electronic đầy sắc màu của bộ đôi Jack & K-ICM.",
    themeColor: "hsla(190, 65%, 45%, 0.5)",
    lyrics: [{ time: 0, text: "🎵" }, { time: 12, text: "Một đời bạc phận, sao lại thế này..." }]
  },
  {
    id: "indie-1", title: "Chờ Người Nơi Ấy", artist: "Vũ.", album: "Vũ. (2019)",
    coverUrl: "https://i.scdn.co/image/ab67616d0000b27396f84a11e3bd2d60e4d8bec1",
    bannerUrl: "https://img.youtube.com/vi/Wf7SFpvNRaY/maxresdefault.jpg",
    audioUrl: "", youtubeId: "Wf7SFpvNRaY", category: "indie", duration: 326,
    description: "Bản nhạc Indie folk mang nỗi buồn da diết khi chờ đợi người thương.",
    themeColor: "hsla(200, 65%, 45%, 0.5)",
    lyrics: [{ time: 0, text: "🎵 (Guitar nhẹ nhàng...)" }, { time: 14, text: "Chờ người nơi ấy, nơi ấy mãi vắng ta..." }]
  },
  {
    id: "indie-2", title: "Lối Nhỏ", artist: "Đen Vâu", album: "Mang Tiền Về Cho Mẹ",
    coverUrl: "https://i.scdn.co/image/ab67616d0000b27382d56a7356c39f28d8442a8b",
    bannerUrl: "https://img.youtube.com/vi/KKc_RMln5UY/maxresdefault.jpg",
    audioUrl: "", youtubeId: "KKc_RMln5UY", category: "indie", duration: 348,
    description: "Nhạc Rap tự sự nhẹ nhàng mang chiều sâu triết lý sống đời thường.",
    themeColor: "hsla(145, 65%, 35%, 0.5)",
    lyrics: [{ time: 0, text: "🎵" }, { time: 12, text: "Lối nhỏ ta về hôm nay sao thênh thang quá..." }]
  },
  {
    id: "indie-3", title: "Mascara", artist: "Chillies", album: "Trái Tim Em Cũng Biết Đau",
    coverUrl: "https://i.scdn.co/image/ab67616d0000b2733b003a8f4c6e7a2df2fca03e",
    bannerUrl: "https://img.youtube.com/vi/ntEoGvhoVac/maxresdefault.jpg",
    audioUrl: "", youtubeId: "ntEoGvhoVac", category: "indie", duration: 318,
    description: "Indie Pop-Rock sâu lắng vẽ nên bức tranh tình yêu buồn đầy tính tự sự.",
    themeColor: "hsla(0, 65%, 45%, 0.5)",
    lyrics: [{ time: 0, text: "🎵" }, { time: 12, text: "Mascara nhòe đi trên đôi mi em nhạt nhòa..." }]
  },
  {
    id: "bolero-1", title: "Duyên Phận", artist: "Như Quỳnh", album: "Duyên Phận",
    coverUrl: "https://i.scdn.co/image/ab67616d0000b27389ab4e9f50e7a1fb536412f7",
    bannerUrl: "https://img.youtube.com/vi/l84rJ27x17k/maxresdefault.jpg",
    audioUrl: "", youtubeId: "l84rJ27x17k", category: "bolero", duration: 302,
    description: "Ca khúc Bolero huyền thoại gắn liền với tiếng hát ngọt ngào của Như Quỳnh.",
    themeColor: "hsla(175, 65%, 35%, 0.5)",
    lyrics: [{ time: 0, text: "🎵" }, { time: 12, text: "Phận là con gái chưa một lần yêu ai..." }]
  },
  {
    id: "bolero-2", title: "Sầu Tím Thiệp Hồng", artist: "Quang Lê & Lệ Quyên", album: "Duet",
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273f552e6de02b74052f50ee0e9",
    bannerUrl: "https://img.youtube.com/vi/QJ5G928k63w/maxresdefault.jpg",
    audioUrl: "", youtubeId: "QJ5G928k63w", category: "bolero", duration: 334,
    description: "Màn song ca Bolero kinh điển của hoàng tử Quang Lê và nữ hoàng Lệ Quyên.",
    themeColor: "hsla(280, 65%, 45%, 0.5)",
    lyrics: [{ time: 0, text: "🎵" }, { time: 12, text: "Từ lúc quen nhau chưa nói một lời yêu..." }]
  },
];

// ─── Format seconds ──────────────────────────────────────────────────────────
const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? "0" : ""}${sec}`;
};

// ─── Equalizer bars component ─────────────────────────────────────────────────
const EqBars = ({ playing, color = "#ef4444", count = 4 }: { playing: boolean; color?: string; count?: number }) => (
  <div className="flex items-end gap-[2px]" style={{ height: 16 }}>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className={cn("rounded-sm transition-all", playing ? "animate-pulse" : "")}
        style={{
          width: 3, backgroundColor: color,
          height: playing ? `${8 + ((i * 17 + 7) % 9)}px` : "3px",
          animationDuration: `${0.4 + i * 0.15}s`,
          animationDelay: `${i * 0.08}s`,
        }}
      />
    ))}
  </div>
);

// ─── CoverImage component with multi-level fallbacks ─────────────────────────
const CoverImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
  youtubeId?: string;
  themeColor?: string;
}> = ({ src, alt, className, youtubeId, themeColor }) => {
  const [errorCount, setErrorCount] = useState(0);
  const [currentSrc, setCurrentSrc] = useState(src);

  useEffect(() => {
    setCurrentSrc(src);
    setErrorCount(0);
  }, [src]);

  const handleError = () => {
    if (errorCount === 0 && youtubeId) {
      setErrorCount(1);
      setCurrentSrc(`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`);
    } else if (errorCount < 2) {
      setErrorCount(2);
      if (src && !src.includes("image-proxy")) {
        setCurrentSrc(`/api/image-proxy?url=${encodeURIComponent(src)}`);
      } else {
        setErrorCount(3);
      }
    } else {
      setErrorCount(3);
    }
  };

  if (errorCount >= 3 || !currentSrc) {
    return (
      <div
        className={cn("w-full h-full flex flex-col items-center justify-center bg-gradient-to-br text-white/50 p-2 select-none", className)}
        style={{
          background: `linear-gradient(135deg, ${themeColor || 'hsla(0, 65%, 45%, 0.5)'} 0%, #080808 100%)`
        }}
      >
        <Music className="w-1/3 h-1/3 stroke-1 text-red-500/50 mb-1" />
        <span className="text-[8px] font-bold uppercase tracking-wider text-neutral-400 text-center truncate max-w-full px-1">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      onError={handleError}
      loading="lazy"
    />
  );
};

// ─── TrackCard component ──────────────────────────────────────────────────────
interface TrackCardProps {
  track: Track;
  compact?: boolean;
  isCurrent: boolean;
  isPlaying: boolean;
  liked: boolean;
  onPlay: (track: Track) => void;
  onToggleLike: (track: Track) => void;
}

const TrackCard: React.FC<TrackCardProps> = ({ track, compact = false, isCurrent, isPlaying, liked, onPlay, onToggleLike }) => {
  if (compact) {
    return (
      <div
        className={cn("flex items-center gap-3 p-2 rounded-xl cursor-pointer group transition-all select-none border border-transparent", isCurrent ? "bg-white/[0.06] border-white/5" : "hover:bg-white/[0.04]")}
        onClick={() => onPlay(track)}
      >
        <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-neutral-900 shadow-sm">
          <CoverImage src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" youtubeId={track.youtubeId} themeColor={track.themeColor} />
          {isCurrent && isPlaying && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><EqBars playing color="#ef4444" count={3} /></div>}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("text-xs font-bold truncate", isCurrent ? "text-red-500" : "text-white")}>{track.title}</p>
          <p className="text-[10px] text-neutral-500 truncate">{track.artist}</p>
        </div>
        <span className="text-[10px] text-neutral-600 shrink-0">{fmt(track.duration)}</span>
      </div>
    );
  }
  return (
    <motion.div
      layout
      className="group flex flex-col cursor-pointer transition-all w-full select-none"
      onClick={() => onPlay(track)}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="aspect-square relative rounded-2xl overflow-hidden bg-neutral-900 shadow-lg border border-white/[0.03] group-hover:border-white/10 transition-colors">
        <CoverImage src={track.coverUrl} alt={track.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" youtubeId={track.youtubeId} themeColor={track.themeColor} />
        {isCurrent && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            {isPlaying ? <EqBars playing count={5} /> : <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"><Music className="w-4 h-4 text-white" /></div>}
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button onClick={e => { e.stopPropagation(); onPlay(track); }} className="w-12 h-12 bg-red-600 hover:bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90 hover:scale-105 cursor-pointer">
            {isCurrent && isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>
        </div>
        {liked && <div className="absolute top-3 right-3 text-red-500 drop-shadow-md"><Heart className="w-4 h-4 fill-red-500 text-red-500" /></div>}
      </div>
      <div className="mt-3 px-1">
        <p className={cn("text-xs font-black truncate leading-tight", isCurrent ? "text-red-500" : "text-white")}>{track.title}</p>
        <p className="text-[10px] text-neutral-500 truncate mt-1">{track.artist}</p>
      </div>
    </motion.div>
  );
};;

// ─── EQ Panel Component ────────────────────────────────────────────────────────
const EQPanel = ({ onClose }: { onClose: () => void }) => {
  const { eqEnabled, setEQEnabled, eqPresetIndex, setEQPreset, eqBands, setEQBand } = useMusicStore();
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.97 }}
      className="absolute bottom-[76px] right-4 md:right-8 z-50 bg-[#0e0e0e] border border-white/10 rounded-2xl p-5 shadow-2xl w-[340px] md:w-[420px]"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-red-400" />
          <span className="text-sm font-black text-white">Equalizer</span>
          <button
            onClick={() => setEQEnabled(!eqEnabled)}
            className={cn("ml-2 px-2.5 py-0.5 rounded-full text-[10px] font-black border transition-all cursor-pointer",
              eqEnabled ? "bg-red-500/20 border-red-500/30 text-red-400" : "bg-white/5 border-white/10 text-neutral-500"
            )}
          >
            {eqEnabled ? "BẬT" : "TẮT"}
          </button>
        </div>
        <button onClick={onClose} className="p-1 text-neutral-500 hover:text-white cursor-pointer rounded-full hover:bg-white/5">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Preset selector */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        {EQ_PRESETS.map((preset, i) => (
          <button
            key={preset.name}
            onClick={() => setEQPreset(i)}
            className={cn("px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer border",
              eqPresetIndex === i
                ? "bg-red-500/20 border-red-500/30 text-red-400"
                : "bg-white/[0.03] border-white/[0.08] text-neutral-500 hover:text-white hover:border-white/20"
            )}
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* Sliders */}
      <div className={cn("flex gap-2 justify-between transition-opacity", !eqEnabled && "opacity-40 pointer-events-none")}>
        {EQ_FREQUENCIES.map((freq, i) => (
          <div key={freq} className="flex flex-col items-center gap-2">
            <span className="text-[8px] font-bold text-red-400">{eqBands[i] > 0 ? `+${eqBands[i]}` : eqBands[i]}</span>
            <div className="relative h-20 flex items-center justify-center">
              <input
                type="range" min={-12} max={12} step={0.5}
                value={eqBands[i]}
                onChange={e => setEQBand(i, parseFloat(e.target.value))}
                className="cursor-pointer"
                style={{ writingMode: "vertical-lr", direction: "rtl", width: 20, height: 80, accentColor: "#ef4444" }}
              />
            </div>
            <span className="text-[8px] text-neutral-600 font-mono">
              {freq >= 1000 ? `${freq / 1000}k` : freq}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const MusicPage = () => {
  // ─── Spotify ─────────────────────────────────────────────────────────────
  const [spotifyToken, setSpotifyToken] = useState<string | null>(() => localStorage.getItem("spotify_access_token"));
  const [showSettings, setShowSettings] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [isResolvingTracks, setIsResolvingTracks] = useState(false);

  // ─── Zustand store ────────────────────────────────────────────────────────
  const {
    volume, setVolume,
    isMuted, toggleMuted, setMuted,
    repeatMode, cycleRepeat,
    shuffle, toggleShuffle,
    likedIds, likedTracks, toggleLike, isLiked,
    showQueue, setShowQueue,
    showEQ, setShowEQ,
    eqEnabled, eqBands,
  } = useMusicStore();

  // ─── Local state ─────────────────────────────────────────────────────────
  const [tracks, setTracks] = useState<Track[]>(CURATED);
  const [currentTrack, setCurrentTrack] = useState<Track>(CURATED[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playerExpanded, setPlayerExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [spotifyResults, setSpotifyResults] = useState<Track[]>([]);
  const [searchingSpotify, setSearchingSpotify] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"home" | "discover" | "library">("home");
  const [buffered, setBuffered] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [ytCharts, setYtCharts] = useState<Track[]>([]);
  const [ytTrending, setYtTrending] = useState<Track[]>([]);
  const [ytIndie, setYtIndie] = useState<Track[]>([]);
  const [ytInternational, setYtInternational] = useState<Track[]>([]);
  const [ytBolero, setYtBolero] = useState<Track[]>([]);
  const [ytRecommend, setYtRecommend] = useState<Track[]>([]);
  const [loadingHome, setLoadingHome] = useState(false);
  const [loadingRecommend, setLoadingRecommend] = useState(false);

  // ─── Refs ────────────────────────────────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement>(null);
  const lyricsRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const eqNodesRef = useRef<BiquadFilterNode[]>([]);
  const animFrameRef = useRef<number>(0);
  const searchRef = useRef<HTMLInputElement>(null);

  // ─── LRCLIB lyrics ───────────────────────────────────────────────────────
  const lrcResult = useLyrics(currentTrack.title, currentTrack.artist, currentTrack.album);
  const activeLyrics = lrcResult.lines.length > 0 ? lrcResult.lines : currentTrack.lyrics;
  const hasSyncedLyrics = lrcResult.hasSynced;
  const lrcActiveIdx = useCurrentLyricIndex(lrcResult.lines, currentTime);
  const lyricIdx = lrcResult.lines.length > 0 ? lrcActiveIdx : (() => {
    if (!currentTrack.lyrics?.length) return -1;
    let idx = 0;
    for (let i = 0; i < currentTrack.lyrics.length; i++) {
      if (currentTime >= currentTrack.lyrics[i].time) idx = i; else break;
    }
    return idx;
  })();

  // ─── Persist volume/mute via Web Audio gain ───────────────────────────────
  useEffect(() => {
    const master = masterGainRef.current;
    const ctx = audioCtxRef.current;
    if (!master || !ctx) return;
    const target = isMuted ? 0 : volume;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(target, ctx.currentTime, 0.02);
  }, [volume, isMuted]);

  // ─── EQ band updates ─────────────────────────────────────────────────────
  useEffect(() => {
    const nodes = eqNodesRef.current;
    const ctx = audioCtxRef.current;
    if (!nodes.length || !ctx) return;
    nodes.forEach((node, i) => {
      const g = eqEnabled ? (eqBands[i] ?? 0) : 0;
      node.gain.setTargetAtTime(g, ctx.currentTime, 0.05);
    });
  }, [eqEnabled, eqBands]);

  // ─── Web Audio API setup with EQ chain ───────────────────────────────────
  const setupAudioCtx = useCallback(() => {
    if (!audioRef.current || audioCtxRef.current) return;
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      // Master gain
      const master = ctx.createGain();
      master.gain.value = isMuted ? 0 : volume;
      masterGainRef.current = master;

      // 10-band EQ
      const eqNodes: BiquadFilterNode[] = EQ_FREQUENCIES.map((freq, i) => {
        const f = ctx.createBiquadFilter();
        f.type = i === 0 ? "lowshelf" : i === EQ_FREQUENCIES.length - 1 ? "highshelf" : "peaking";
        f.frequency.value = freq;
        f.gain.value = 0;
        f.Q.value = 1.4;
        return f;
      });
      eqNodesRef.current = eqNodes;

      // Analyser
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      // Chain: source → eq[0] → eq[1] → ... → analyser → master → destination
      for (let i = 0; i < eqNodes.length - 1; i++) {
        eqNodes[i].connect(eqNodes[i + 1]);
      }
      eqNodes[eqNodes.length - 1].connect(analyser);
      analyser.connect(master);
      master.connect(ctx.destination);

      // Source
      sourceRef.current = ctx.createMediaElementSource(audioRef.current);
      sourceRef.current.connect(eqNodes[0]);
    } catch { /* ignore CORS/policy errors */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Canvas visualizer loop (red gradient) ─────────────────────────────────
  useEffect(() => {
    if (!isPlaying || !canvasRef.current || !analyserRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      const data = new Uint8Array(analyserRef.current!.frequencyBinCount);
      analyserRef.current!.getByteFrequencyData(data);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const step = Math.floor(data.length / 64);
      const barCount = Math.floor(data.length / step);
      const barW = canvas.width / barCount * 0.8;
      for (let i = 0; i < barCount; i++) {
        const val = data[i * step];
        const barH = (val / 255) * canvas.height * 0.9;
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barH);
        gradient.addColorStop(0, "rgba(239,68,68,0.9)");
        gradient.addColorStop(0.5, "rgba(239,68,68,0.5)");
        gradient.addColorStop(1, "rgba(239,68,68,0.1)");
        ctx.fillStyle = gradient;
        const x = i * (canvas.width / barCount) + (canvas.width / barCount - barW) / 2;
        ctx.beginPath();
        ctx.roundRect(x, canvas.height - barH, barW, barH, 2);
        ctx.fill();
      }
    };
    draw();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying]);

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      switch (e.key) {
        case " ": e.preventDefault(); handlePlayPause(); break;
        case "ArrowRight": e.preventDefault(); handleNextTrack(); break;
        case "ArrowLeft": e.preventDefault(); handlePrevTrack(); break;
        case "m": case "M": toggleMuted(); break;
        case "s": case "S": toggleShuffle(); break;
        case "f": case "F": searchRef.current?.focus(); break;
        case "Escape": setPlayerExpanded(false); setShowSettings(false); setShowEQ(false); break;
        case "ArrowUp": e.preventDefault(); setVolume(Math.min(1, volume + 0.05)); break;
        case "ArrowDown": e.preventDefault(); setVolume(Math.max(0, volume - 0.05)); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Resolve YouTube ID ───────────────────────────────────────────────────
  const resolveYouTubeId = async (title: string, artist: string): Promise<string> => {
    try {
      const res = await fetch(`/api/youtube-search?q=${encodeURIComponent(title + " " + artist + " official")}`);
      if (res.ok) { const d = await res.json(); return d.youtubeId || ""; }
    } catch { /* ignore */ }
    return "";
  };

  // ─── Update track in all state lists ─────────────────────────────────────
  const patchTrack = (id: string, patch: Partial<Track>) => {
    const apply = (t: Track) => t.id === id ? { ...t, ...patch } : t;
    setTracks(ts => ts.map(apply));
    setSpotifyResults(ts => ts.map(apply));
    setCurrentTrack(prev => prev.id === id ? { ...prev, ...patch } : prev);
  };

  // ─── Map API response to Track ────────────────────────────────────────────
  const mapApiToTrack = (item: any, cat: Track["category"] = "trending"): Track => ({
    id: item.id,
    title: item.title || "",
    artist: item.artist || "",
    album: item.album || "",
    coverUrl: item.coverUrl || "",
    bannerUrl: item.coverUrl || `https://img.youtube.com/vi/${item.id}/maxresdefault.jpg`,
    audioUrl: `/api/yt-stream?id=${item.id}`,
    youtubeId: item.id,
    category: cat,
    lyrics: [
      { time: 0, text: `🎵 ${item.title}` },
      { time: 5, text: `👤 ${item.artist}` },
      { time: 10, text: `💿 ${item.album || "YouTube Music"}` },
    ],
    duration: item.duration || 0,
    themeColor: hashColor(item.title + item.artist),
    description: `Nguồn: YouTube Music`,
  });

  // ─── Fetch home charts ────────────────────────────────────────────────────
  const fetchHomeCharts = async () => {
    setLoadingHome(true);
    try {
      const res = await fetch("/api/yt-home");
      if (res.ok) {
        const d = await res.json();
        if (d.charts?.length) setYtCharts(d.charts.map((i: any) => mapApiToTrack(i, "trending")));
        if (d.trending?.length) setYtTrending(d.trending.map((i: any) => mapApiToTrack(i, "trending")));
        if (d.indie?.length) setYtIndie(d.indie.map((i: any) => mapApiToTrack(i, "indie")));
        if (d.international?.length) setYtInternational(d.international.map((i: any) => mapApiToTrack(i, "trending")));
        if (d.bolero?.length) setYtBolero(d.bolero.map((i: any) => mapApiToTrack(i, "bolero")));
      }
    } catch (err) {
      console.error("[MusicPage] fetchHomeCharts error:", err);
    }
    setLoadingHome(false);
  };

  // ─── Fetch recommendations ────────────────────────────────────────────────
  const fetchRecommend = useCallback(async (youtubeId: string) => {
    if (!youtubeId) return;
    setLoadingRecommend(true);
    try {
      const res = await fetch(`/api/yt-recommend?id=${youtubeId}&limit=10`);
      if (res.ok) {
        const d = await res.json();
        if (d.length) setYtRecommend(d.map((i: any) => mapApiToTrack(i, "recommend")));
      }
    } catch { /* ignore */ }
    setLoadingRecommend(false);
  }, []);

  useEffect(() => { fetchHomeCharts(); }, []);

  useEffect(() => {
    if (currentTrack.youtubeId) {
      const t = setTimeout(() => fetchRecommend(currentTrack.youtubeId), 1200);
      return () => clearTimeout(t);
    }
  }, [currentTrack.youtubeId, fetchRecommend]);

  // ─── Loop mode for audio element ──────────────────────────────────────────
  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = repeatMode === "one";
  }, [repeatMode]);

  // ─── Lyrics scroll sync ───────────────────────────────────────────────────
  useEffect(() => {
    if (!lyricsRef.current || lyricIdx < 0) return;
    const el = lyricsRef.current.children[lyricIdx] as HTMLElement;
    if (el) lyricsRef.current.scrollTo({ top: el.offsetTop - lyricsRef.current.clientHeight / 2 + el.clientHeight / 2, behavior: "smooth" });
  }, [lyricIdx]);

  // ─── Load and play track ──────────────────────────────────────────────────
  const loadAndPlay = useCallback((track: Track, autoPlay = true) => {
    setupAudioCtx();
    if (audioCtxRef.current?.state === "suspended") audioCtxRef.current.resume();

    setCurrentTrack(track);
    setCurrentTime(0);
    setBuffered(0);
    setIsBuffering(false);

    const audio = audioRef.current;
    if (!audio) return;

    const playUrl = track.audioUrl || (track.youtubeId ? `/api/yt-stream?id=${track.youtubeId}` : "");
    audio.src = playUrl;
    audio.load();

    if (autoPlay) {
      if (!playUrl) return;
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }

    if (!track.youtubeId) {
      resolveYouTubeId(track.title, track.artist).then(id => {
        if (id) patchTrack(track.id, { youtubeId: id, bannerUrl: `https://img.youtube.com/vi/${id}/maxresdefault.jpg` });
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Play/Pause ───────────────────────────────────────────────────────────
  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setupAudioCtx();
    if (audioCtxRef.current?.state === "suspended") audioCtxRef.current.resume();

    const playUrl = currentTrack.audioUrl || (currentTrack.youtubeId ? `/api/yt-stream?id=${currentTrack.youtubeId}` : "");
    if (!playUrl) return;

    if (isPlaying) { audio.pause(); setIsPlaying(false); }
    else { audio.play().then(() => setIsPlaying(true)).catch(() => {}); }
  }, [isPlaying, currentTrack]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Track navigation ──────────────────────────────────────────────────────
  const queue = useMemo(() => {
    if (activeSubTab === "library") return likedTracks;
    if (searchQuery.trim() && spotifyResults.length > 0) return spotifyResults;
    const allTracks = [...tracks, ...ytCharts, ...ytTrending, ...ytIndie, ...ytInternational, ...ytBolero, ...ytRecommend];
    const unique = allTracks.filter((t, idx, arr) => arr.findIndex(x => x.id === t.id) === idx);
    return unique.length > 0 ? unique : CURATED;
  }, [activeSubTab, likedTracks, tracks, ytCharts, ytTrending, ytIndie, ytInternational, ytBolero, ytRecommend, spotifyResults, searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNextTrack = useCallback(() => {
    const idx = queue.findIndex(t => t.id === currentTrack.id);
    const next = shuffle
      ? Math.floor(Math.random() * queue.length)
      : (idx + 1) % queue.length;
    if (queue[next]) loadAndPlay(queue[next]);
  }, [queue, currentTrack.id, shuffle, loadAndPlay]);

  const handlePrevTrack = useCallback(() => {
    if (currentTime > 3 && audioRef.current) { audioRef.current.currentTime = 0; return; }
    const idx = queue.findIndex(t => t.id === currentTrack.id);
    const prev = idx <= 0 ? queue.length - 1 : idx - 1;
    if (queue[prev]) loadAndPlay(queue[prev]);
  }, [queue, currentTrack.id, currentTime, loadAndPlay]);

  const handleTrackEnded = useCallback(() => {
    if (repeatMode === "one") { if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play(); } }
    else if (repeatMode === "all" || shuffle) handleNextTrack();
    else setIsPlaying(false);
  }, [repeatMode, shuffle, handleNextTrack]);

  // ─── Seek ─────────────────────────────────────────────────────────────────
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect || !audioRef.current || !duration) return;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = pct * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // ─── Buffer tracking ──────────────────────────────────────────────────────
  const handleProgress = () => {
    const audio = audioRef.current;
    if (!audio || !audio.buffered.length || !duration) return;
    setBuffered(audio.buffered.end(audio.buffered.length - 1));
  };

  // ─── Spotify resolve curated ──────────────────────────────────────────────
  const resolveSpotifyTracks = async (token: string) => {
    setIsResolvingTracks(true);
    const resolved: Track[] = [];
    for (const track of CURATED) {
      try {
        const q = encodeURIComponent(`track:${track.title} artist:${track.artist}`);
        const r = await fetch(`https://api.spotify.com/v1/search?q=${q}&type=track&limit=1`, { headers: { Authorization: `Bearer ${token}` } });
        if (r.status === 401) { disconnectSpotify("Token hết hạn. Đã khôi phục nhạc mặc định."); setIsResolvingTracks(false); return; }
        if (r.ok) {
          const d = await r.json();
          const sp = d.tracks?.items?.[0];
          if (sp) {
            resolved.push({ ...track, spotifyId: sp.id, coverUrl: sp.album?.images?.[0]?.url || track.coverUrl, audioUrl: sp.preview_url || "", duration: Math.floor(sp.duration_ms / 1000), description: `Album: ${sp.album.name} (${sp.album.release_date?.substring(0, 4)})` });
            continue;
          }
        }
      } catch { /* skip */ }
      resolved.push(track);
    }
    setTracks(resolved);
    const cur = resolved.find(t => t.id === currentTrack.id);
    if (cur) setCurrentTrack(cur);
    setIsResolvingTracks(false);
  };

  useEffect(() => {
    if (spotifyToken) resolveSpotifyTracks(spotifyToken);
    else { setTracks(CURATED); setCurrentTrack(CURATED[0]); }
  }, [spotifyToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Search ───────────────────────────────────────────────────────────────
  const searchSpotify = async (q: string, token: string) => {
    if (!q.trim()) { setSpotifyResults([]); return; }
    setSearchingSpotify(true);
    try {
      const r = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=20`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.status === 401) { disconnectSpotify("Token hết hạn."); setSearchingSpotify(false); return; }
      if (r.ok) {
        const d = await r.json();
        const mapped: Track[] = (d.tracks?.items || []).map((item: any) => {
          const img = item.album?.images?.[0]?.url || "";
          return { id: `spotify-${item.id}`, spotifyId: item.id, title: item.name, artist: item.artists.map((a: any) => a.name).join(", "), album: item.album.name, coverUrl: img, bannerUrl: img, audioUrl: item.preview_url || "", youtubeId: "", category: "search" as const, lyrics: [{ time: 0, text: `🎵 ${item.name}` }, { time: 5, text: `👤 ${item.artists.map((a: any) => a.name).join(", ")}` }], duration: Math.floor(item.duration_ms / 1000), themeColor: hashColor(item.name), description: `Album: ${item.album.name}` };
        });
        setSpotifyResults(mapped);
      }
    } catch { /* ignore */ }
    setSearchingSpotify(false);
  };

  const searchYTMusic = async (q: string) => {
    if (!q.trim()) { setSpotifyResults([]); return; }
    setSearchingSpotify(true);
    try {
      const r = await fetch(`/api/yt-search?q=${encodeURIComponent(q)}`);
      if (r.ok) {
        const d = await r.json();
        setSpotifyResults((d || []).map((item: any) => mapApiToTrack(item, "search")));
      }
    } catch (err) { console.error("[MusicPage] YTMusic search error:", err); }
    setSearchingSpotify(false);
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if (spotifyToken) searchSpotify(searchQuery, spotifyToken);
      else searchYTMusic(searchQuery);
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery, spotifyToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Spotify connect/disconnect ───────────────────────────────────────────
  const connectSpotify = () => {
    let t = tokenInput.trim();
    if (t.toLowerCase().startsWith("bearer ")) t = t.slice(7);
    if (!t) return;
    localStorage.setItem("spotify_access_token", t);
    setSpotifyToken(t); setShowSettings(false);
  };

  const disconnectSpotify = (msg = "Đã ngắt kết nối Spotify.") => {
    localStorage.removeItem("spotify_access_token");
    setSpotifyToken(null); setTracks(CURATED); setSpotifyResults([]); setSearchQuery("");
    (window as any).showCinemaxAlert?.(msg);
  };

  // ─── Render helpers ───────────────────────────────────────────────────────
  const renderTrack = (track: Track, extraKey?: string) => (
    <TrackCard
      key={extraKey || track.id}
      track={track}
      isCurrent={currentTrack.id === track.id}
      isPlaying={isPlaying}
      liked={isLiked(track.id)}
      onPlay={loadAndPlay}
      onToggleLike={toggleLike}
    />
  );

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufPct = duration > 0 ? (buffered / duration) * 100 : 0;

  // ─── Derived lists ─────────────────────────────────────────────────────────
  const quickPicks = useMemo(() => {
    if (ytTrending.length > 0) return ytTrending.slice(0, 12);
    return tracks.slice(0, 12);
  }, [ytTrending, tracks]);

  const topCharts = useMemo(() => {
    return ytCharts.length > 0 ? ytCharts : tracks;
  }, [ytCharts, tracks]);

  const trendingList = useMemo(() => {
    return ytTrending.length > 0 ? ytTrending : tracks.filter(t => t.category === "vpop");
  }, [ytTrending, tracks]);

  const indieList = useMemo(() => {
    return ytIndie.length > 0 ? ytIndie : tracks.filter(t => t.category === "indie");
  }, [ytIndie, tracks]);

  const boleroList = useMemo(() => {
    return ytBolero.length > 0 ? ytBolero : tracks.filter(t => t.category === "bolero");
  }, [ytBolero, tracks]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const match = tracks.filter(t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q));
    return {
      vpop: match.filter(t => t.category === "vpop"),
      indie: match.filter(t => t.category === "indie"),
      bolero: match.filter(t => t.category === "bolero"),
    };
  }, [tracks, searchQuery]);

  const isShowingSpotifySearch = !!searchQuery.trim() && spotifyResults.length > 0;
  const isShowingLocalSearch = !!searchQuery.trim() && spotifyResults.length === 0;

  const bgStyle = {
    background: `radial-gradient(ellipse 80% 40% at 50% 0%, ${currentTrack?.themeColor || "hsla(0, 65%, 45%, 0.15)"}, transparent 70%), #000000`,
    transition: "background 1.5s cubic-bezier(0.16,1,0.3,1)"
  };

  const playLikedTracks = () => {
    if (likedTracks && likedTracks.length > 0) {
      loadAndPlay(likedTracks[0]);
    } else {
      (window as any).showCinemaxAlert?.("Bạn chưa thích bài hát nào. Hãy bấm ❤ để thêm nhạc vào Thư viện!");
    }
  };

  return (
    <div className="min-h-screen text-white bg-[#000000] relative select-none pb-32 overflow-x-hidden" style={bgStyle}>
      {/* Ambient glow container */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[350px] rounded-full blur-[150px] opacity-15 pointer-events-none transition-all duration-1000 -z-10"
        style={{
          background: `radial-gradient(circle, ${currentTrack?.themeColor || 'hsla(0, 65%, 45%, 0.5)'} 0%, transparent 70%)`
        }}
      />
      <audio
        ref={audioRef}
        onTimeUpdate={() => { if (audioRef.current) setCurrentTime(audioRef.current.currentTime); }}
        onLoadedMetadata={() => { if (audioRef.current) setDuration(audioRef.current.duration || currentTrack.duration); }}
        onEnded={handleTrackEnded}
        onProgress={handleProgress}
        onWaiting={() => setIsBuffering(true)}
        onCanPlay={() => setIsBuffering(false)}
        onPlaying={() => { setIsBuffering(false); setIsPlaying(true); }}
        onPause={() => setIsPlaying(false)}
      />

      <div className="px-4 md:px-8 lg:px-16 pt-24 pb-36 max-w-[1600px] mx-auto mt-4">
        {/* ── Sub Navigation Header Bar ────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-8 pb-4 border-b border-white/[0.04] select-none">
          {/* Left: navigation controls (< >) */}
          <div className="hidden md:flex items-center gap-3">
            <button className="p-2 rounded-full bg-white/5 border border-white/[0.03] hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer select-none">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button className="p-2 rounded-full bg-white/5 border border-white/[0.03] hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer select-none">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Center: Tabs */}
          <div className="flex items-center justify-center md:justify-start gap-8 flex-1 md:pl-8">
            <button 
              onClick={() => setActiveSubTab("home")} 
              className={cn("text-sm md:text-base font-black transition-all cursor-pointer relative py-1", 
                activeSubTab === "home" ? "text-red-500 scale-105" : "text-neutral-400 hover:text-white"
              )}
            >
              Trang Chủ
              {activeSubTab === "home" && <motion.div layoutId="subTabLine" className="absolute bottom-0 left-0 w-full h-0.5 bg-red-600 rounded-full" />}
            </button>
            <button 
              onClick={() => setActiveSubTab("discover")} 
              className={cn("text-sm md:text-base font-black transition-all cursor-pointer relative py-1", 
                activeSubTab === "discover" ? "text-red-500 scale-105" : "text-neutral-400 hover:text-white"
              )}
            >
              Khám Phá
              {activeSubTab === "discover" && <motion.div layoutId="subTabLine" className="absolute bottom-0 left-0 w-full h-0.5 bg-red-600 rounded-full" />}
            </button>
            <button 
              onClick={() => setActiveSubTab("library")} 
              className={cn("text-sm md:text-base font-black transition-all cursor-pointer relative py-1", 
                activeSubTab === "library" ? "text-red-500 scale-105" : "text-neutral-400 hover:text-white"
              )}
            >
              Thư Viện
              {activeSubTab === "library" && <motion.div layoutId="subTabLine" className="absolute bottom-0 left-0 w-full h-0.5 bg-red-600 rounded-full" />}
            </button>
          </div>

          {/* Right: Search box & Spotify Connection */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-2 focus-within:border-red-500/30 focus-within:bg-white/[0.07] transition-all w-full md:w-64">
              <Search className="w-4 h-4 text-neutral-500 shrink-0" />
              <input 
                ref={searchRef} 
                type="text" 
                value={searchQuery} 
                onChange={e => { 
                  setSearchQuery(e.target.value); 
                  if (activeSubTab !== "discover") setActiveSubTab("discover"); 
                }}
                placeholder={spotifyToken ? "Tìm trên Spotify..." : "Tìm bài hát, ca sĩ..."}
                className="bg-transparent outline-none text-xs text-white placeholder-neutral-600 w-full" 
              />
              {searchQuery && <button onClick={() => setSearchQuery("")}><X className="w-3.5 h-3.5 text-neutral-500 hover:text-white" /></button>}
            </div>
            
            <button 
              onClick={() => { setTokenInput(spotifyToken || ""); setShowSettings(true); }}
              className={cn("flex items-center gap-1.5 px-3 py-2 rounded-2xl border text-xs font-bold transition-all cursor-pointer shrink-0", 
                spotifyToken ? "bg-red-500/10 border-red-500/25 text-red-400 hover:bg-red-500/15" : "bg-white/5 border-white/10 text-neutral-400 hover:text-white hover:bg-white/10"
              )}
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{spotifyToken ? "Spotify ✓" : "Spotify"}</span>
            </button>
          </div>
        </div>

        {isResolvingTracks && (
          <div className="flex items-center gap-2 text-neutral-400 text-sm justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-red-500" /> Đang tải từ Spotify API...
          </div>
        )}

        {loadingHome && (
          <div className="flex flex-col items-center justify-center py-20 text-neutral-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-red-500" />
            <p className="text-xs">Đang đồng bộ nhạc từ YouTube Music...</p>
          </div>
        )}

        {!loadingHome && (
          <>
            {/* ── SUB-TAB: HOME ────────────────────────────────────────────────── */}
            {activeSubTab === "home" && (
              <div className="flex flex-col gap-12">
                {/* User Library Header */}
                <div className="flex items-center gap-3 select-none">
                  <div className="w-10 h-10 rounded-full bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-500 text-sm font-black shadow-md shadow-red-500/5">
                    C
                  </div>
                  <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                    Thư viện nhạc của Cyber
                  </h2>
                </div>

                {/* Hero section (Liked Card + Quick Picks) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Left: Liked Card */}
                  <div className="lg:col-span-5">
                    <div 
                      className="relative rounded-3xl p-8 flex flex-col justify-between h-[340px] overflow-hidden border border-white/[0.05] group select-none shadow-2xl transition-all duration-500 hover:border-white/10"
                      style={{
                        background: `linear-gradient(135deg, ${currentTrack?.themeColor || 'hsla(265, 65%, 45%, 0.5)'}22, #0d0d0d 60%, #050505 100%)`
                      }}
                    >
                      {/* Ambient background glow */}
                      <div 
                        className="absolute top-0 right-0 w-48 h-48 rounded-full blur-[80px] pointer-events-none transition-colors duration-1000 opacity-20"
                        style={{ backgroundColor: currentTrack?.themeColor || '#ef4444' }}
                      />
                      
                      {/* Quote / Lyrics */}
                      <div className="relative z-10 flex flex-col gap-2">
                        <p className="text-xs text-neutral-400 italic font-medium leading-relaxed max-w-[85%]">
                          {activeLyrics?.[lyricIdx]?.text && activeLyrics[lyricIdx].text !== "🎵"
                            ? `"${activeLyrics[lyricIdx].text}"`
                            : `"Âm nhạc là tiếng vọng của cảm xúc, là nơi tâm hồn tìm thấy sự đồng điệu sâu sắc nhất."`}
                        </p>
                        <span className="text-[10px] text-neutral-600">— Cyber Music</span>
                      </div>

                      {/* Card Info & Play Button */}
                      <div className="relative z-10 flex items-end justify-between mt-auto">
                        <div>
                          <h3 className="text-xl md:text-2xl font-black text-white tracking-tight">
                            Bài hát đã thích
                          </h3>
                          <p className="text-xs text-red-500 font-bold mt-1 uppercase tracking-wider">
                            {likedTracks.length} bài hát
                          </p>
                        </div>

                        <button 
                          onClick={playLikedTracks}
                          className="w-14 h-14 bg-red-600 hover:bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-red-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                        >
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right: Quick Picks (3 cols, 4 rows = 12 tracks) */}
                  <div className="lg:col-span-7 flex flex-col justify-between">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
                      {quickPicks.slice(0, 12).map((track) => {
                        const isCur = track.id === currentTrack.id;
                        return (
                          <div 
                            key={track.id} 
                            onClick={() => loadAndPlay(track)}
                            className={cn(
                              "flex items-center gap-3 p-2 rounded-xl transition-all cursor-pointer select-none group border border-transparent",
                              isCur ? "bg-white/[0.06] border-white/5" : "hover:bg-white/[0.04]"
                            )}
                          >
                            <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-neutral-900 shadow">
                              <CoverImage src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" youtubeId={track.youtubeId} themeColor={track.themeColor} />
                              {isCur && isPlaying && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                  <EqBars playing color="#ef4444" count={3} />
                                </div>
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-xs font-bold truncate", isCur ? "text-red-500" : "text-white")}>
                                {track.title}
                              </p>
                              <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                                {track.artist}
                              </p>
                            </div>

                            <button 
                              onClick={e => { e.stopPropagation(); toggleLike(track); }} 
                              className={cn(
                                "p-1 hover:text-red-500 shrink-0 transition-opacity",
                                isLiked(track.id) ? "opacity-100 text-red-500" : "opacity-0 group-hover:opacity-100 text-neutral-500"
                              )}
                            >
                              <Heart className={cn("w-3.5 h-3.5", isLiked(track.id) ? "fill-red-500 text-red-500" : "")} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Grid layout: Charts + Playlist Đề xuất */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4">
                  {/* Column 1-2: Charts */}
                  <div className="lg:col-span-2">
                    <h2 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-red-500" /> Bảng Xếp Hạng Nhạc Việt
                    </h2>
                    <div className="flex flex-col bg-white/[0.01] border border-white/[0.04] rounded-3xl p-4 gap-1.5">
                      {topCharts.slice(0, 8).map((track, idx) => {
                        const isCur = track.id === currentTrack.id;
                        return (
                          <div 
                            key={track.id} 
                            onClick={() => loadAndPlay(track)}
                            className={cn("flex items-center gap-4 p-2.5 rounded-2xl transition-all cursor-pointer group select-none border border-transparent",
                              isCur ? "bg-red-500/10 border-red-500/10" : "hover:bg-white/[0.03]"
                            )}
                          >
                            <span className={cn("text-base font-black w-6 text-center shrink-0 font-mono",
                              idx === 0 ? "text-red-500" : idx === 1 ? "text-orange-500" : idx === 2 ? "text-amber-500" : "text-neutral-500"
                            )}>
                              {idx + 1}
                            </span>
                            <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-neutral-900 shadow">
                              <CoverImage src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" youtubeId={track.youtubeId} themeColor={track.themeColor} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-xs font-bold truncate", isCur ? "text-red-500" : "text-white")}>{track.title}</p>
                              <p className="text-[10px] text-neutral-400 truncate mt-0.5">{track.artist}</p>
                            </div>
                            {track.album && <span className="text-[10px] text-neutral-500 truncate hidden md:block max-w-[120px]">{track.album}</span>}
                            <div className="flex items-center gap-3 shrink-0">
                              <button onClick={e => { e.stopPropagation(); toggleLike(track); }} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <Heart className={cn("w-3.5 h-3.5", isLiked(track.id) ? "text-red-500 fill-red-500" : "text-neutral-500 hover:text-red-500")} />
                              </button>
                              <span className="text-[10px] font-mono text-neutral-500 w-8 text-right">{fmt(track.duration)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Column 3: Playlist Đề xuất */}
                  <div>
                    <h2 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                      <div className="w-1.5 h-5 bg-red-600 rounded-full" /> Playlist Đề Xuất
                    </h2>
                    <div className="flex flex-col gap-3">
                      {[
                        { title: "V-POP Thịnh Hành", desc: "Top bài hát V-POP đang gây bão cộng đồng mạng", cover: trendingList[0]?.coverUrl || CURATED[0].coverUrl, list: trendingList },
                        { title: "Indie Chill & Lofi", desc: "Nhạc Indie, Lofi nhẹ nhàng thư giãn cuối ngày", cover: indieList[0]?.coverUrl || CURATED[5].coverUrl, list: indieList },
                        { title: "Bolero Trữ Tình", desc: "Các ca khúc Bolero đi cùng năm tháng", cover: boleroList[0]?.coverUrl || CURATED[8].coverUrl, list: boleroList },
                        { title: "Nhạc Quốc Tế", desc: "Top hits quốc tế đang thịnh hành trên toàn thế giới", cover: ytInternational[0]?.coverUrl || CURATED[1].coverUrl, list: ytInternational },
                      ].map((pl, i) => (
                        <div 
                          key={i} 
                          className="flex items-center gap-3 p-3 bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-white/10 rounded-2xl cursor-pointer transition-all group"
                          onClick={() => { if (pl.list.length) loadAndPlay(pl.list[0]); }}
                        >
                          <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-neutral-900 shadow">
                            <CoverImage src={pl.cover} alt={pl.title} className="w-full h-full object-cover" themeColor="hsla(0, 65%, 45%, 0.3)" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white group-hover:text-red-500 transition-colors">{pl.title}</p>
                            <p className="text-[10px] text-neutral-500 mt-1 line-clamp-2 leading-relaxed">{pl.desc}</p>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-red-600/90 group-hover:bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow shrink-0">
                            <Play className="w-3.5 h-3.5 fill-white text-white ml-0.5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* V-POP Row */}
                <div>
                  <h2 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                    <div className="w-1.5 h-5 bg-red-600 rounded-full" /> V-POP & Thịnh Hành
                  </h2>
                  <div className="flex overflow-x-auto gap-5 pb-4 scrollbar-hide -mx-4 px-4 md:-mx-8 md:px-8 lg:-mx-16 lg:px-16">
                    {trendingList.map(track => (
                      <div key={track.id} className="w-[140px] sm:w-[160px] shrink-0">
                        {renderTrack(track)}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Indie Row */}
                <div>
                  <h2 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                    <div className="w-1.5 h-5 bg-red-600 rounded-full" /> Indie & Lofi Chill
                  </h2>
                  <div className="flex overflow-x-auto gap-5 pb-4 scrollbar-hide -mx-4 px-4 md:-mx-8 md:px-8 lg:-mx-16 lg:px-16">
                    {indieList.map(track => (
                      <div key={track.id} className="w-[140px] sm:w-[160px] shrink-0">
                        {renderTrack(track)}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bolero Row */}
                <div>
                  <h2 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                    <div className="w-1.5 h-5 bg-red-600 rounded-full" /> Trữ Tình & Bolero
                  </h2>
                  <div className="flex overflow-x-auto gap-5 pb-4 scrollbar-hide -mx-4 px-4 md:-mx-8 md:px-8 lg:-mx-16 lg:px-16">
                    {boleroList.map(track => (
                      <div key={track.id} className="w-[140px] sm:w-[160px] shrink-0">
                        {renderTrack(track)}
                      </div>
                    ))}
                  </div>
                </div>

                {/* International Row */}
                {ytInternational.length > 0 && (
                  <div>
                    <h2 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                      <Globe2 className="w-5 h-5 text-red-400" /> Nhạc Quốc Tế
                    </h2>
                    <div className="flex overflow-x-auto gap-5 pb-4 scrollbar-hide -mx-4 px-4 md:-mx-8 md:px-8 lg:-mx-16 lg:px-16">
                      {ytInternational.map(track => (
                        <div key={track.id} className="w-[140px] sm:w-[160px] shrink-0">
                          {renderTrack(track)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommend Row */}
                {ytRecommend.length > 0 && (
                  <div>
                    <h2 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                      <Radio className="w-5 h-5 text-red-400" /> Tiếp Theo Có Thể Bạn Thích
                      {loadingRecommend && <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500 ml-1" />}
                    </h2>
                    <div className="flex overflow-x-auto gap-5 pb-4 scrollbar-hide -mx-4 px-4 md:-mx-8 md:px-8 lg:-mx-16 lg:px-16">
                      {ytRecommend.map(track => (
                        <div key={track.id} className="w-[140px] sm:w-[160px] shrink-0">
                          {renderTrack(track)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Keyboard shortcuts */}
                <div className="mt-4 p-4 border border-white/5 rounded-2xl bg-white/[0.02]">
                  <p className="text-xs font-bold text-neutral-500 mb-2">⌨️ Phím tắt</p>
                  <div className="flex flex-wrap gap-3 text-[10px] text-neutral-600">
                    {[["Space", "Play/Pause"], ["← →", "Bài trước/sau"], ["↑ ↓", "Âm lượng"], ["M", "Tắt tiếng"], ["S", "Trộn bài"], ["F", "Tìm kiếm"]].map(([k, v]) => (
                      <span key={k}><kbd className="bg-white/10 text-neutral-400 px-1.5 py-0.5 rounded text-[9px] font-mono">{k}</kbd> {v}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── SUB-TAB: DISCOVER ────────────────────────────────────────────── */}
            {activeSubTab === "discover" && (
              <div className="flex flex-col gap-6">
                {!searchQuery.trim() ? (
                  <div>
                    <h2 className="text-xl font-black text-white mb-6">Thể loại đề xuất</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {[
                        { title: "V-POP", query: "V-POP", color: "from-blue-600 to-indigo-900" },
                        { title: "Indie Việt", query: "Indie Việt", color: "from-green-600 to-teal-900" },
                        { title: "Lofi Chill", query: "Lofi Chill", color: "from-purple-600 to-pink-900" },
                        { title: "Bolero", query: "Bolero", color: "from-orange-600 to-amber-900" },
                        { title: "Acoustic", query: "Acoustic", color: "from-red-600 to-rose-900" },
                        { title: "Remix Việt", query: "Remix Việt", color: "from-fuchsia-600 to-purple-900" },
                      ].map((cat, idx) => (
                        <div 
                          key={idx}
                          onClick={() => {
                            setSearchQuery(cat.query);
                            if (spotifyToken) searchSpotify(cat.query, spotifyToken);
                            else searchYTMusic(cat.query);
                          }}
                          className={cn("h-32 rounded-2xl bg-gradient-to-br p-5 flex flex-col justify-between cursor-pointer transition-all hover:scale-105 active:scale-98 shadow-md border border-white/[0.04]", cat.color)}
                        >
                          <span className="text-sm font-black text-white tracking-tight">{cat.title}</span>
                          <Play className="w-5 h-5 fill-white text-white self-end opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-base font-black text-white">
                        Kết quả tìm kiếm cho <span className="text-red-500">"{searchQuery}"</span>
                      </h3>
                      {searchingSpotify && <Loader2 className="w-4 h-4 animate-spin text-red-500" />}
                    </div>
                    {spotifyResults.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                        {spotifyResults.map(track => renderTrack(track))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 text-neutral-600 gap-2">
                        <Search className="w-10 h-10 stroke-1" />
                        <p className="text-sm">Không tìm thấy kết quả nào cho "{searchQuery}"</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── SUB-TAB: LIBRARY ─────────────────────────────────────────────── */}
            {activeSubTab === "library" && (
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Heart className="w-6 h-6 text-red-500 fill-red-500" />
                    <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">Thư viện nhạc của bạn</h2>
                  </div>
                  <span className="text-xs text-neutral-500 font-bold bg-neutral-900 border border-white/5 px-3 py-1 rounded-full uppercase tracking-wider">
                    {likedTracks.length} bài hát
                  </span>
                </div>

                {likedTracks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 text-neutral-500 gap-4 bg-white/[0.01] border border-white/[0.04] rounded-3xl">
                    <Heart className="w-16 h-16 text-neutral-700 stroke-[1.2]" />
                    <div className="text-center">
                      <h3 className="text-base font-bold text-white">Thư viện của bạn đang trống</h3>
                      <p className="text-xs text-neutral-500 mt-1 max-w-sm">Hãy nhấn nút ❤ khi nghe nhạc để thêm các bài hát yêu thích của bạn vào đây.</p>
                    </div>
                    <button 
                      onClick={() => setActiveSubTab("home")} 
                      className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-full text-xs font-bold transition-all shadow-lg active:scale-95 cursor-pointer mt-2"
                    >
                      Khám phá âm nhạc
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-4 mb-8 select-none">
                      <button 
                        onClick={playLikedTracks} 
                        className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-full text-xs font-black flex items-center gap-2 transition-all active:scale-95 shadow-lg cursor-pointer"
                      >
                        <Play className="w-4 h-4 fill-white" /> Phát tất cả
                      </button>
                      <button 
                        onClick={() => {
                          if (likedTracks.length > 0) {
                            if (!shuffle) toggleShuffle();
                            playLikedTracks();
                          }
                        }} 
                        className="px-5 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-full text-xs font-black flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                      >
                        <Shuffle className="w-4 h-4" /> Phát ngẫu nhiên
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                      {likedTracks.map(track => renderTrack(track))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── EQ Panel ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showEQ && <EQPanel onClose={() => setShowEQ(false)} />}
      </AnimatePresence>

      {/* ── Bottom Player Bar ────────────────────────────────────────────── */}
      <AnimatePresence>
        {currentTrack && (
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 24 }}
            className={cn("fixed bottom-0 left-0 w-full z-50 border-t border-white/[0.07] bg-[#0a0a0a]/97 backdrop-blur-2xl",
              playerExpanded ? "h-[90vh] md:h-[70vh] rounded-t-3xl" : "h-[70px]"
            )}>

            {/* Compact player */}
            {!playerExpanded && (
              <div className="flex items-center h-full px-4 md:px-8 gap-4 max-w-7xl mx-auto">
                {/* Progress bar top */}
                <div ref={progressRef} onClick={handleProgressClick}
                  className="absolute top-0 left-0 w-full h-[3px] bg-white/10 cursor-pointer group"
                  style={{ transform: "translateY(-2px)" }}>
                  <div className="absolute top-0 left-0 h-full bg-white/20 transition-all" style={{ width: `${bufPct}%` }} />
                  <div className="absolute top-0 left-0 h-full bg-red-500 transition-[width]" style={{ width: `${pct}%` }} />
                  <div className="absolute -top-1 h-[5px] w-full bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                {/* Track info */}
                <div className="flex items-center gap-3 min-w-0 w-56 shrink-0 cursor-pointer" onClick={() => setPlayerExpanded(true)}>
                  <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-neutral-800">
                    <CoverImage src={currentTrack.coverUrl} alt={currentTrack.title} className={cn("w-full h-full object-cover", isPlaying ? "animate-[spin_12s_linear_infinite]" : "")} youtubeId={currentTrack.youtubeId} themeColor={currentTrack.themeColor} />
                    {isBuffering && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-white" /></div>}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{currentTrack.title}</p>
                    <p className="text-[10px] text-neutral-500 truncate">{currentTrack.artist}</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); toggleLike(currentTrack); }} className="shrink-0 ml-1 hidden sm:block">
                    <Heart className={cn("w-4 h-4", isLiked(currentTrack.id) ? "text-red-400 fill-red-400" : "text-neutral-600 hover:text-neutral-400")} />
                  </button>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-3 flex-1 justify-center">
                  <button onClick={handlePrevTrack} className="p-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer active:scale-90"><SkipBack className="w-4 h-4 fill-current" /></button>
                  <button onClick={handlePlayPause} className="w-9 h-9 bg-white hover:bg-neutral-200 text-black rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90 shadow-md">
                    {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black ml-0.5" />}
                  </button>
                  <button onClick={handleNextTrack} className="p-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer active:scale-90"><SkipForward className="w-4 h-4 fill-current" /></button>
                </div>

                {/* Time */}
                <div className="hidden md:flex items-center gap-1.5 text-[10px] font-mono text-neutral-500 shrink-0">
                  <span>{fmt(currentTime)}</span><span className="text-neutral-700">/</span><span>{fmt(duration)}</span>
                </div>

                {/* Right controls */}
                <div className="hidden md:flex items-center gap-2 shrink-0">
                  <button onClick={toggleShuffle} className={cn("p-1.5 rounded-full hover:bg-white/5 cursor-pointer transition-colors", shuffle ? "text-red-400" : "text-neutral-500 hover:text-white")}><Shuffle className="w-4 h-4" /></button>
                  <button onClick={cycleRepeat} className={cn("p-1.5 rounded-full hover:bg-white/5 cursor-pointer transition-colors relative", repeatMode !== "none" ? "text-red-400" : "text-neutral-500 hover:text-white")}>
                    <Repeat className="w-4 h-4" />{repeatMode === "one" && <span className="absolute top-0.5 right-0.5 text-[7px] bg-red-500 text-white rounded-full w-3 h-3 flex items-center justify-center font-black">1</span>}
                  </button>
                  <button onClick={() => setShowEQ(!showEQ)} className={cn("p-1.5 rounded-full hover:bg-white/5 cursor-pointer transition-colors", showEQ ? "text-red-400" : "text-neutral-500 hover:text-white")}>
                    <SlidersHorizontal className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-1 group">
                    <button onClick={() => toggleMuted()} className="p-1.5 text-neutral-500 hover:text-white cursor-pointer rounded-full hover:bg-white/5">
                      {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <input type="range" min={0} max={1} step={0.01} value={isMuted ? 0 : volume}
                      onChange={e => { setVolume(parseFloat(e.target.value)); setMuted(false); }}
                      className="w-20 h-1 cursor-pointer opacity-50 group-hover:opacity-100 transition-opacity" style={{ accentColor: "#ef4444" }} />
                  </div>
                  <button onClick={() => setPlayerExpanded(true)} className="p-1.5 text-neutral-500 hover:text-white rounded-full hover:bg-white/5 cursor-pointer"><ChevronUp className="w-4 h-4" /></button>
                </div>

                {/* Mobile expand */}
                <button onClick={() => setPlayerExpanded(true)} className="md:hidden p-2 text-neutral-500"><ChevronUp className="w-4 h-4" /></button>
              </div>
            )}

            {/* Expanded player */}
            {playerExpanded && (
              <div className="h-full flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 md:px-10 py-4 border-b border-white/5 shrink-0">
                  <div className="flex items-center gap-2 text-xs text-neutral-500 font-bold uppercase tracking-wider">
                    <Music className="w-4 h-4 text-red-500" /> Đang phát
                  </div>
                  <button onClick={() => setPlayerExpanded(false)} className="p-2 bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white rounded-full cursor-pointer transition-colors"><ChevronDown className="w-5 h-5" /></button>
                </div>

                {/* Body */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-0 overflow-hidden">

                  {/* Left: vinyl + controls */}
                  <div className="md:col-span-5 flex flex-col items-center justify-center gap-5 p-6 md:p-10 border-b md:border-b-0 md:border-r border-white/5 overflow-y-auto">
                    {/* Vinyl disc */}
                    <div className={cn("relative rounded-full border-4 border-neutral-800 bg-[#0d0d0d] flex items-center justify-center shadow-2xl", "w-44 h-44 sm:w-52 sm:h-52")}>
                      {[0.85, 0.7, 0.55].map(s => <div key={s} className="absolute inset-0 rounded-full border border-neutral-700/20" style={{ transform: `scale(${s})` }} />)}
                      <div className={cn("w-[82%] h-[82%] rounded-full overflow-hidden relative", isPlaying ? "animate-[spin_20s_linear_infinite]" : "")}>
                        <CoverImage src={currentTrack.coverUrl} alt={currentTrack.title} className="w-full h-full object-cover" youtubeId={currentTrack.youtubeId} themeColor={currentTrack.themeColor} />
                      </div>
                      <div className="absolute inset-0 m-auto w-6 h-6 rounded-full bg-neutral-900 border-4 border-neutral-800" />
                    </div>

                    {/* Visualizer canvas */}
                    <canvas ref={canvasRef} width={280} height={48} className="w-full max-w-xs opacity-80 rounded-lg" />

                    {/* Track info */}
                    <div className="text-center min-w-0 w-full">
                      <h2 className="text-xl md:text-2xl font-black text-white truncate">{currentTrack.title}</h2>
                      <p className="text-base text-neutral-400 truncate mt-1">{currentTrack.artist}</p>
                      {currentTrack.album && <p className="text-xs text-neutral-600 mt-0.5">💿 {currentTrack.album}</p>}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-3">
                      <button onClick={() => toggleLike(currentTrack)} className={cn("p-2 rounded-full border transition-all cursor-pointer", isLiked(currentTrack.id) ? "bg-red-500/15 border-red-500/25 text-red-400" : "border-white/10 text-neutral-500 hover:text-red-400")}>
                        <Heart className={cn("w-4 h-4", isLiked(currentTrack.id) ? "fill-red-400" : "")} />
                      </button>
                      <button onClick={() => setShowEQ(!showEQ)} className={cn("p-2 rounded-full border transition-all cursor-pointer", showEQ ? "bg-red-500/15 border-red-500/25 text-red-400" : "border-white/10 text-neutral-500 hover:text-red-400")}>
                        <SlidersHorizontal className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Progress */}
                    <div className="w-full flex flex-col gap-2 max-w-sm">
                      <div ref={progressRef} onClick={handleProgressClick} className="relative w-full h-1.5 bg-neutral-800 rounded-full cursor-pointer group">
                        <div className="absolute top-0 left-0 h-full bg-neutral-700 rounded-full" style={{ width: `${bufPct}%` }} />
                        <div className="absolute top-0 left-0 h-full bg-red-500 rounded-full transition-[width]" style={{ width: `${pct}%` }} />
                        <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: `calc(${pct}% - 7px)` }} />
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-neutral-600">
                        <span>{fmt(currentTime)}</span><span>{fmt(duration)}</span>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-5">
                      <button onClick={toggleShuffle} className={cn("p-2 cursor-pointer transition-colors rounded-full hover:bg-white/5", shuffle ? "text-red-400" : "text-neutral-500 hover:text-white")}><Shuffle className="w-5 h-5" /></button>
                      <button onClick={handlePrevTrack} className="p-2 text-neutral-400 hover:text-white cursor-pointer active:scale-90"><SkipBack className="w-5 h-5 fill-current" /></button>
                      <button onClick={handlePlayPause} className="w-14 h-14 bg-white hover:bg-neutral-200 text-black rounded-full flex items-center justify-center shadow-2xl cursor-pointer active:scale-90 transition-all">
                        {isPlaying ? <Pause className="w-6 h-6 fill-black" /> : <Play className="w-6 h-6 fill-black ml-1" />}
                      </button>
                      <button onClick={handleNextTrack} className="p-2 text-neutral-400 hover:text-white cursor-pointer active:scale-90"><SkipForward className="w-5 h-5 fill-current" /></button>
                      <button onClick={cycleRepeat} className={cn("p-2 cursor-pointer rounded-full hover:bg-white/5 relative", repeatMode !== "none" ? "text-red-400" : "text-neutral-500 hover:text-white")}>
                        <Repeat className="w-5 h-5" />{repeatMode === "one" && <span className="absolute top-1 right-1 text-[7px] bg-red-500 text-white rounded-full w-3 h-3 flex items-center justify-center font-black">1</span>}
                      </button>
                    </div>

                    {/* Volume */}
                    <div className="flex items-center gap-2 w-full max-w-[200px]">
                      <button onClick={() => toggleMuted()} className="text-neutral-500 hover:text-white cursor-pointer">
                        {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                      <input type="range" min={0} max={1} step={0.01} value={isMuted ? 0 : volume}
                        onChange={e => { setVolume(parseFloat(e.target.value)); setMuted(false); }}
                        className="flex-1 h-1 cursor-pointer" style={{ accentColor: "#ef4444" }} />
                      <span className="text-[10px] font-mono text-neutral-600 w-8">{Math.round((isMuted ? 0 : volume) * 100)}%</span>
                    </div>
                  </div>

                  {/* Right: lyrics + queue */}
                  <div className="md:col-span-7 flex flex-col overflow-hidden">
                    {/* Tabs */}
                    <div className="flex items-center border-b border-white/5 shrink-0 px-6 md:px-8">
                      <button onClick={() => setShowQueue(false)} className={cn("py-3 px-4 text-sm font-bold border-b-2 transition-all cursor-pointer", !showQueue ? "border-red-500 text-white" : "border-transparent text-neutral-500 hover:text-white")}>
                        🎤 Lời bài hát
                      </button>
                      <button onClick={() => setShowQueue(true)} className={cn("py-3 px-4 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5", showQueue ? "border-red-500 text-white" : "border-transparent text-neutral-500 hover:text-white")}>
                        <ListMusic className="w-4 h-4" /> Danh sách ({queue.length})
                      </button>
                    </div>

                    {/* Lyrics pane */}
                    {!showQueue && (
                      <div ref={lyricsRef} className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-4 scroll-smooth" style={{ scrollbarWidth: "none" }}>
                        {/* Lyrics source badge */}
                        {lrcResult.lines.length > 0 && (
                          <div className="flex items-center gap-1.5 text-[9px] text-neutral-600 mb-2">
                            {hasSyncedLyrics ? (
                              <><span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />Lời đồng bộ từ LRCLIB</>
                            ) : (
                              <><span className="w-1.5 h-1.5 rounded-full bg-neutral-600 inline-block" />Lời bài hát từ LRCLIB</>
                            )}
                          </div>
                        )}
                        {lrcResult.loading && (
                          <div className="flex items-center gap-2 text-neutral-600 text-xs">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tìm lời bài hát...
                          </div>
                        )}
                        {activeLyrics?.length ? activeLyrics.map((line, i) => {
                          const active = lyricIdx === i;
                          return (
                            <p key={i}
                              onClick={() => { if (audioRef.current && line.time > 0) { audioRef.current.currentTime = line.time; setCurrentTime(line.time); } }}
                              className={cn("text-lg md:text-xl font-bold tracking-tight transition-all duration-300 leading-snug",
                                line.time > 0 ? "cursor-pointer" : "",
                                active
                                  ? "text-red-400 scale-[1.02] origin-left drop-shadow-[0_2px_12px_rgba(239,68,68,0.3)]"
                                  : "text-neutral-600 hover:text-neutral-400")}>
                              {line.text}
                            </p>
                          );
                        }) : !lrcResult.loading && (
                          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-neutral-700">
                            <Mic2 className="w-10 h-10 stroke-1" />
                            <p className="text-sm">Chưa có lời bài hát</p>
                            <p className="text-xs text-neutral-700">Lời được tự động tải từ LRCLIB</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Queue pane */}
                    {showQueue && (
                      <div className="flex-1 overflow-y-auto py-4 px-4 md:px-6 flex flex-col gap-1" style={{ scrollbarWidth: "none" }}>
                        {queue.map((track, idx) => {
                          const isCur = track.id === currentTrack.id;
                          return (
                            <div key={track.id} className={cn("flex items-center gap-3 p-2.5 rounded-xl cursor-pointer group transition-all", isCur ? "bg-red-500/10" : "hover:bg-white/5")} onClick={() => loadAndPlay(track)}>
                              <span className="text-[10px] font-mono text-neutral-700 w-5 text-center shrink-0">{isCur ? <EqBars playing={isPlaying} count={3} /> : idx + 1}</span>
                              <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-neutral-900 shadow">
                                <CoverImage src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" youtubeId={track.youtubeId} themeColor={track.themeColor} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn("text-xs font-bold truncate", isCur ? "text-red-400" : "text-white")}>{track.title}</p>
                                <p className="text-[10px] text-neutral-500 truncate">{track.artist}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button onClick={e => { e.stopPropagation(); toggleLike(track); }} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Heart className={cn("w-3.5 h-3.5", isLiked(track.id) ? "text-red-400 fill-red-400" : "text-neutral-600")} />
                                </button>
                                <span className="text-[10px] font-mono text-neutral-700">{fmt(track.duration)}</span>
                              </div>
                            </div>
                          );
                        })}
                        {/* Recommend next up section */}
                        {ytRecommend.length > 0 && (
                          <>
                            <div className="py-3 px-2 mt-3">
                              <p className="text-[10px] font-black text-neutral-600 uppercase tracking-wider flex items-center gap-1.5">
                                <Radio className="w-3 h-3" /> Tiếp Theo Được Gợi Ý
                              </p>
                            </div>
                            {ytRecommend.map((track, idx) => {
                              const isCur = track.id === currentTrack.id;
                              return (
                                <div key={`rec-${track.id}-${idx}`} className={cn("flex items-center gap-3 p-2.5 rounded-xl cursor-pointer group transition-all opacity-70 hover:opacity-100", isCur ? "bg-red-500/10 opacity-100" : "hover:bg-white/5")} onClick={() => loadAndPlay(track)}>
                                  <Plus className="w-3.5 h-3.5 text-neutral-700 group-hover:text-red-400 shrink-0 transition-colors" />
                                  <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-neutral-900 shadow">
                                    <CoverImage src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" youtubeId={track.youtubeId} themeColor={track.themeColor} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold truncate text-neutral-300 group-hover:text-white transition-colors">{track.title}</p>
                                    <p className="text-[10px] text-neutral-600 truncate">{track.artist}</p>
                                  </div>
                                  <span className="text-[10px] font-mono text-neutral-700 shrink-0">{fmt(track.duration)}</span>
                                </div>
                              );
                            })}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Spotify Settings Modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/80 backdrop-blur flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}>
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="bg-[#0e0e0e] border border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-red-400">
                  <Settings className="w-5 h-5" /> Spotify API
                </div>
                <button onClick={() => setShowSettings(false)} className="p-1.5 hover:bg-white/5 rounded-full text-neutral-500 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
              </div>

              {spotifyToken && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-2 rounded-xl text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> Đã kết nối! Tìm kiếm toàn cầu đã bật.
                </div>
              )}

              <div className="bg-white/[0.03] rounded-2xl p-4 text-xs text-neutral-400 flex flex-col gap-2">
                <p className="font-bold text-neutral-300">Cách lấy Spotify Access Token miễn phí:</p>
                <ol className="list-decimal pl-4 flex flex-col gap-1.5 leading-relaxed">
                  <li>Vào <a href="https://developer.spotify.com/console/get-track" target="_blank" rel="noopener noreferrer" className="text-red-400 hover:underline inline-flex items-center gap-0.5">Spotify Web Console <ExternalLink className="w-3 h-3" /></a></li>
                  <li>Bấm <strong className="text-white">"Get Token"</strong> và đăng nhập</li>
                  <li>Sao chép Access Token và dán vào ô bên dưới</li>
                </ol>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider mb-1.5 block">Access Token</label>
                <textarea value={tokenInput} onChange={e => setTokenInput(e.target.value)} placeholder="eyJhbGciOiJSUzI1NiJ9..."
                  className="w-full h-20 bg-black border border-white/10 rounded-xl p-3 text-xs text-white placeholder-neutral-700 focus:outline-none focus:border-red-500 resize-none font-mono" />
              </div>

              <div className="flex gap-3">
                {spotifyToken && (
                  <button onClick={() => { disconnectSpotify(); setShowSettings(false); }} className="flex-1 border border-red-500/25 text-red-400 hover:bg-red-500/10 text-xs font-bold py-2.5 rounded-xl cursor-pointer transition-all">
                    Ngắt kết nối
                  </button>
                )}
                <button onClick={() => setShowSettings(false)} className="flex-1 bg-white/5 border border-white/10 text-xs font-bold py-2.5 rounded-xl cursor-pointer text-neutral-400 hover:text-white transition-all">Hủy</button>
                <button onClick={connectSpotify} className="flex-1 bg-red-600 hover:bg-red-500 text-white text-xs font-black py-2.5 rounded-xl cursor-pointer transition-all shadow-lg shadow-red-500/20">Kết nối</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default MusicPage;
