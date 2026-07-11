/**
 * useMusicStore — Zustand global store for music playback state.
 *
 * Inspired by Nuclear's queueStore / trackActions pattern.
 * Single source of truth for: queue, current index, repeat mode, shuffle.
 * Persists preferences (volume, loop, shuffle) to localStorage.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Track {
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

export type RepeatMode = "none" | "one" | "all";

export interface EQBand {
  frequency: number;
  gain: number; // -12 to +12 dB
}

export interface EQPreset {
  name: string;
  bands: number[]; // 10 gains for 31Hz,62Hz,125Hz,250Hz,500Hz,1k,2k,4k,8k,16kHz
}

export const EQ_PRESETS: EQPreset[] = [
  { name: "Flat",         bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: "Bass Boost",   bands: [8, 7, 5, 3, 1, 0, 0, 0, 0, 0] },
  { name: "Vocal",        bands: [-2, -2, 0, 3, 5, 6, 5, 3, 0, -2] },
  { name: "Classical",    bands: [4, 3, 2, 0, -2, -2, 0, 2, 3, 4] },
  { name: "Electronic",   bands: [6, 4, 1, 0, -3, -2, 1, 4, 6, 7] },
  { name: "Hip-Hop",      bands: [7, 5, 2, -1, -2, 0, 2, 3, 4, 5] },
  { name: "Rock",         bands: [5, 3, 1, -1, -3, 0, 2, 4, 5, 6] },
  { name: "Acoustic",     bands: [3, 2, 1, 2, 3, 3, 2, 1, 1, 2] },
];

export const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

// ─── State interface ───────────────────────────────────────────────────────────

interface MusicState {
  // Queue
  queue: Track[];
  currentIndex: number;
  history: Track[]; // last 50 played
  shuffledIndices: number[]; // pre-shuffled index list
  shufflePos: number; // current position in shuffledIndices

  // Playback preferences (persisted)
  volume: number;
  isMuted: boolean;
  repeatMode: RepeatMode;
  shuffle: boolean;

  // EQ (persisted)
  eqEnabled: boolean;
  eqPresetIndex: number;
  eqBands: number[]; // 10 custom gains

  // UI state
  showQueue: boolean;
  showEQ: boolean;
  likedIds: string[];
  likedTracks: Track[];

  // Derived helpers
  currentTrack: Track | null;
  nextTrack: Track | null;
}

interface MusicActions {
  // Queue actions
  setQueue: (tracks: Track[], startIndex?: number) => void;
  enqueue: (track: Track) => void;
  enqueueBatch: (tracks: Track[]) => void;
  insertNext: (track: Track) => void;
  removeAt: (index: number) => void;
  clearQueue: () => void;
  moveTo: (fromIndex: number, toIndex: number) => void;

  // Playback
  setCurrentIndex: (index: number) => void;
  goNext: () => void;
  goPrev: () => void;

  // Preferences
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  toggleMuted: () => void;
  setRepeat: (mode: RepeatMode) => void;
  cycleRepeat: () => void;
  setShuffle: (s: boolean) => void;
  toggleShuffle: () => void;

  // EQ
  setEQEnabled: (on: boolean) => void;
  setEQPreset: (index: number) => void;
  setEQBand: (bandIndex: number, gain: number) => void;

  // UI
  setShowQueue: (v: boolean) => void;
  setShowEQ: (v: boolean) => void;
  toggleLike: (trackOrId: Track | string) => void;
  isLiked: (id: string) => boolean;
}

// ─── Fisher-Yates shuffle ──────────────────────────────────────────────────────
function shuffleArray(arr: number[]): number[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildShuffleIndices(length: number, currentIndex: number): number[] {
  const indices = Array.from({ length }, (_, i) => i).filter(i => i !== currentIndex);
  return [currentIndex, ...shuffleArray(indices)];
}

function deriveCurrentTrack(queue: Track[], index: number): Track | null {
  return queue[index] ?? null;
}

function deriveNextTrack(
  queue: Track[],
  index: number,
  repeatMode: RepeatMode,
  shuffle: boolean,
  shuffledIndices: number[],
  shufflePos: number
): Track | null {
  if (queue.length === 0) return null;
  if (repeatMode === "one") return queue[index] ?? null;
  if (shuffle) {
    const nextPos = (shufflePos + 1) % shuffledIndices.length;
    return queue[shuffledIndices[nextPos]] ?? null;
  }
  if (repeatMode === "all") return queue[(index + 1) % queue.length] ?? null;
  return queue[index + 1] ?? null;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useMusicStore = create<MusicState & MusicActions>()(
  persist<MusicState & MusicActions>(
    (set, get) => ({
      // Initial state
      queue: [],
      currentIndex: 0,
      history: [],
      shuffledIndices: [],
      shufflePos: 0,

      volume: 0.8,
      isMuted: false,
      repeatMode: "all" as RepeatMode,
      shuffle: false,

      eqEnabled: false,
      eqPresetIndex: 0,
      eqBands: [...EQ_PRESETS[0].bands],

      showQueue: false,
      showEQ: false,
      likedIds: [],
      likedTracks: [],

      currentTrack: null,
      nextTrack: null,

      // ── Queue actions ──────────────────────────────────────────────────────

      setQueue: (tracks, startIndex = 0) => {
        const si = startIndex < tracks.length ? startIndex : 0;
        const shuffled = buildShuffleIndices(tracks.length, si);
        set(state => ({
          queue: tracks,
          currentIndex: si,
          shuffledIndices: shuffled,
          shufflePos: 0,
          currentTrack: deriveCurrentTrack(tracks, si),
          nextTrack: deriveNextTrack(tracks, si, state.repeatMode, state.shuffle, shuffled, 0),
        }));
      },

      enqueue: (track) => {
        set(state => {
          const queue = [...state.queue, track];
          const shuffled = buildShuffleIndices(queue.length, state.currentIndex);
          return {
            queue,
            shuffledIndices: shuffled,
            nextTrack: deriveNextTrack(queue, state.currentIndex, state.repeatMode, state.shuffle, shuffled, state.shufflePos),
          };
        });
      },

      enqueueBatch: (tracks) => {
        set(state => {
          const queue = [...state.queue, ...tracks];
          const shuffled = buildShuffleIndices(queue.length, state.currentIndex);
          return {
            queue,
            shuffledIndices: shuffled,
            nextTrack: deriveNextTrack(queue, state.currentIndex, state.repeatMode, state.shuffle, shuffled, state.shufflePos),
          };
        });
      },

      insertNext: (track) => {
        set(state => {
          const queue = [...state.queue];
          queue.splice(state.currentIndex + 1, 0, track);
          return { queue };
        });
      },

      removeAt: (index) => {
        set(state => {
          const queue = state.queue.filter((_, i) => i !== index);
          const ci = index < state.currentIndex ? state.currentIndex - 1 : state.currentIndex;
          const bounded = Math.max(0, Math.min(ci, queue.length - 1));
          return {
            queue,
            currentIndex: bounded,
            currentTrack: deriveCurrentTrack(queue, bounded),
          };
        });
      },

      clearQueue: () => set({ queue: [], currentIndex: 0, currentTrack: null, nextTrack: null }),

      moveTo: (fromIndex, toIndex) => {
        set(state => {
          const queue = [...state.queue];
          const [item] = queue.splice(fromIndex, 1);
          queue.splice(toIndex, 0, item);
          let ci = state.currentIndex;
          if (state.currentIndex === fromIndex) ci = toIndex;
          else if (fromIndex < state.currentIndex && toIndex >= state.currentIndex) ci--;
          else if (fromIndex > state.currentIndex && toIndex <= state.currentIndex) ci++;
          return { queue, currentIndex: ci };
        });
      },

      // ── Navigation ────────────────────────────────────────────────────────

      setCurrentIndex: (index) => {
        set(state => {
          if (index < 0 || index >= state.queue.length) return {};
          const history = [
            ...state.history.slice(-49),
            ...(state.currentTrack ? [state.currentTrack] : []),
          ];
          return {
            currentIndex: index,
            history,
            currentTrack: deriveCurrentTrack(state.queue, index),
            nextTrack: deriveNextTrack(state.queue, index, state.repeatMode, state.shuffle, state.shuffledIndices, state.shufflePos),
          };
        });
      },

      goNext: () => {
        set(state => {
          const { queue, currentIndex, repeatMode, shuffle, shuffledIndices, shufflePos } = state;
          if (queue.length === 0) return {};

          let nextIndex: number;
          let nextShufflePos = shufflePos;

          if (repeatMode === "one") {
            nextIndex = currentIndex;
          } else if (shuffle) {
            nextShufflePos = (shufflePos + 1) % shuffledIndices.length;
            nextIndex = shuffledIndices[nextShufflePos];
          } else if (repeatMode === "all") {
            nextIndex = (currentIndex + 1) % queue.length;
          } else {
            nextIndex = Math.min(currentIndex + 1, queue.length - 1);
          }

          const history = [
            ...state.history.slice(-49),
            ...(state.currentTrack ? [state.currentTrack] : []),
          ];

          return {
            currentIndex: nextIndex,
            shufflePos: nextShufflePos,
            history,
            currentTrack: deriveCurrentTrack(queue, nextIndex),
            nextTrack: deriveNextTrack(queue, nextIndex, repeatMode, shuffle, shuffledIndices, nextShufflePos),
          };
        });
      },

      goPrev: () => {
        set(state => {
          const { queue, currentIndex, history } = state;
          if (queue.length === 0) return {};

          // If more than 3 seconds in, restart current. Otherwise go to prev.
          // (The audio engine decides this based on currentTime)
          let prevIndex: number;
          if (history.length > 0) {
            // pop history
            const hist = [...history];
            hist.pop();
            prevIndex = Math.max(0, currentIndex - 1);
            return {
              currentIndex: prevIndex,
              history: hist,
              currentTrack: deriveCurrentTrack(queue, prevIndex),
            };
          }
          prevIndex = Math.max(0, currentIndex - 1);
          return {
            currentIndex: prevIndex,
            currentTrack: deriveCurrentTrack(queue, prevIndex),
          };
        });
      },

      // ── Preferences ───────────────────────────────────────────────────────

      setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),
      setMuted: (m) => set({ isMuted: m }),
      toggleMuted: () => set(state => ({ isMuted: !state.isMuted })),
      setRepeat: (mode) => set({ repeatMode: mode }),
      cycleRepeat: () => set(state => {
        const order: RepeatMode[] = ["none", "all", "one"];
        const next = order[(order.indexOf(state.repeatMode) + 1) % order.length];
        return { repeatMode: next };
      }),
      setShuffle: (s) => set(state => ({
        shuffle: s,
        shuffledIndices: s ? buildShuffleIndices(state.queue.length, state.currentIndex) : [],
        shufflePos: 0,
      })),
      toggleShuffle: () => set(state => {
        const s = !state.shuffle;
        return {
          shuffle: s,
          shuffledIndices: s ? buildShuffleIndices(state.queue.length, state.currentIndex) : [],
          shufflePos: 0,
        };
      }),

      // ── EQ ────────────────────────────────────────────────────────────────

      setEQEnabled: (on) => set({ eqEnabled: on }),
      setEQPreset: (index) => set({
        eqPresetIndex: index,
        eqBands: [...EQ_PRESETS[index].bands],
      }),
      setEQBand: (bandIndex, gain) => set(state => {
        const eqBands = [...state.eqBands];
        eqBands[bandIndex] = Math.max(-12, Math.min(12, gain));
        return { eqBands, eqPresetIndex: -1 }; // -1 = custom
      }),

      // ── UI ────────────────────────────────────────────────────────────────

      setShowQueue: (v) => set({ showQueue: v }),
      setShowEQ: (v) => set({ showEQ: v }),
      toggleLike: (trackOrId) => set(state => {
        const id = typeof trackOrId === "string" ? trackOrId : trackOrId.id;
        const likedIds = new Set(state.likedIds);
        let likedTracks = [...(state.likedTracks || [])];

        if (likedIds.has(id)) {
          likedIds.delete(id);
          likedTracks = likedTracks.filter(t => t.id !== id);
        } else {
          likedIds.add(id);
          if (typeof trackOrId !== "string") {
            if (!likedTracks.some(t => t.id === id)) {
              likedTracks.push(trackOrId);
            }
          } else {
            const foundInQueue = state.queue.find(t => t.id === id);
            const foundCurrent = state.currentTrack?.id === id ? state.currentTrack : null;
            const trackToAdd = foundInQueue || foundCurrent;
            if (trackToAdd && !likedTracks.some(t => t.id === id)) {
              likedTracks.push(trackToAdd);
            }
          }
        }
        return {
          likedIds: [...likedIds],
          likedTracks,
        };
      }),
      isLiked: (id) => (get() as MusicState & MusicActions).likedIds.includes(id),
    }),
    {
      name: "cinemax-music-store",
      partialize: (state: MusicState & MusicActions) => ({
        volume: state.volume,
        isMuted: state.isMuted,
        repeatMode: state.repeatMode,
        shuffle: state.shuffle,
        eqEnabled: state.eqEnabled,
        eqPresetIndex: state.eqPresetIndex,
        eqBands: state.eqBands,
        likedIds: state.likedIds,
        likedTracks: state.likedTracks || [],
      }) as unknown as MusicState & MusicActions,
    }
  )
);

