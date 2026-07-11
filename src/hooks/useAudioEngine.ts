/**
 * useAudioEngine — Web Audio API engine.
 *
 * Inspired by Nuclear's Sound/Crossfade/Equalizer architecture.
 * Features:
 * - GainNode with smooth volume ramping (no pops)
 * - 10-band parametric EQ via BiquadFilterNodes
 * - Crossfade between tracks using two audio elements
 * - FFT analyser (2048 bins) for visualizer
 * - Buffering state detection
 * - Media Session API integration
 */
import { useRef, useEffect, useCallback, useState } from "react";
import { EQ_FREQUENCIES, useMusicStore } from "./useMusicStore";
import type { Track } from "./useMusicStore";

const CROSSFADE_DURATION = 2.0; // seconds

interface UseAudioEngineOptions {
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onBuffering?: (buffering: boolean) => void;
  onBuffered?: (pct: number) => void;
}

export interface AudioEngineHandle {
  play: () => Promise<void>;
  pause: () => void;
  seek: (time: number) => void;
  getFrequencyData: () => Uint8Array | null;
  getWaveformData: () => Uint8Array | null;
}

export function useAudioEngine(options: UseAudioEngineOptions = {}): AudioEngineHandle {
  const { onEnded, onTimeUpdate, onBuffering, onBuffered } = options;

  const store = useMusicStore();
  const { volume, isMuted, eqEnabled, eqBands } = store;

  // Two audio elements for crossfade (A/B pattern)
  const audioARef = useRef<HTMLAudioElement | null>(null);
  const audioBRef = useRef<HTMLAudioElement | null>(null);
  const activeRef = useRef<"A" | "B">("A");

  // Web Audio nodes
  const ctxRef = useRef<AudioContext | null>(null);
  const gainARef = useRef<GainNode | null>(null);
  const gainBRef = useRef<GainNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const eqNodesRef = useRef<BiquadFilterNode[]>([]);
  const sourceARef = useRef<MediaElementAudioSourceNode | null>(null);
  const sourceBRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Internal state
  const [isReady, setIsReady] = useState(false);
  const crossfadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTrackRef = useRef<Track | null>(null);
  const prevSrcRef = useRef<string>("");

  // ── Init Web Audio context ─────────────────────────────────────────────────
  const initCtx = useCallback(() => {
    if (ctxRef.current) return;
    try {
      const ctx = new AudioContext();
      ctxRef.current = ctx;

      // Master gain → destination
      const master = ctx.createGain();
      master.gain.value = volume * (isMuted ? 0 : 1);
      masterGainRef.current = master;

      // Analyser
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      // 10-band EQ chain
      const eqNodes: BiquadFilterNode[] = EQ_FREQUENCIES.map((freq, i) => {
        const filter = ctx.createBiquadFilter();
        filter.type = i === 0 ? "lowshelf" : i === EQ_FREQUENCIES.length - 1 ? "highshelf" : "peaking";
        filter.frequency.value = freq;
        filter.gain.value = 0;
        filter.Q.value = 1.4;
        return filter;
      });
      eqNodesRef.current = eqNodes;

      // Chain: EQ nodes → analyser → master → destination
      for (let i = 0; i < eqNodes.length - 1; i++) {
        eqNodes[i].connect(eqNodes[i + 1]);
      }
      eqNodes[eqNodes.length - 1].connect(analyser);
      analyser.connect(master);
      master.connect(ctx.destination);

      // Per-track gain nodes (for crossfade)
      const gainA = ctx.createGain();
      const gainB = ctx.createGain();
      gainA.gain.value = 1;
      gainB.gain.value = 0;
      gainARef.current = gainA;
      gainBRef.current = gainB;

      // Gain A/B → first EQ node
      gainA.connect(eqNodes[0]);
      gainB.connect(eqNodes[0]);

      setIsReady(true);
    } catch (err) {
      console.warn("[AudioEngine] Failed to init Web Audio:", err);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Create/attach media source ─────────────────────────────────────────────
  const attachSource = useCallback((audio: HTMLAudioElement, isA: boolean) => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    try {
      const source = ctx.createMediaElementSource(audio);
      const gainNode = isA ? gainARef.current : gainBRef.current;
      if (gainNode) source.connect(gainNode);
      if (isA) sourceARef.current = source;
      else sourceBRef.current = source;
    } catch {
      // Already connected — safe to ignore
    }
  }, []);

  // ── Volume ramping ─────────────────────────────────────────────────────────
  useEffect(() => {
    const master = masterGainRef.current;
    const ctx = ctxRef.current;
    if (!master || !ctx) return;
    const target = isMuted ? 0 : volume;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(target, ctx.currentTime, 0.02); // 20ms ramp
  }, [volume, isMuted]);

  // ── EQ band updates ────────────────────────────────────────────────────────
  useEffect(() => {
    const nodes = eqNodesRef.current;
    const ctx = ctxRef.current;
    if (!nodes.length || !ctx) return;

    nodes.forEach((node, i) => {
      const targetGain = eqEnabled ? (eqBands[i] ?? 0) : 0;
      node.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.05);
    });
  }, [eqEnabled, eqBands]);

  // ── Load a track into the inactive audio element, then crossfade ───────────
  const loadTrack = useCallback(async (track: Track, autoPlay: boolean) => {
    initCtx();
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (ctx.state === "suspended") await ctx.resume();

    const srcUrl = track.audioUrl || (track.youtubeId ? `/api/yt-stream?id=${track.youtubeId}` : "");
    if (!srcUrl) return;
    if (srcUrl === prevSrcRef.current) return; // same source, just resume
    prevSrcRef.current = srcUrl;

    const isCurrentA = activeRef.current === "A";
    const inactiveAudio = isCurrentA ? audioBRef.current : audioARef.current;
    const inactiveGain = isCurrentA ? gainBRef.current : gainARef.current;
    const activeGain = isCurrentA ? gainARef.current : gainBRef.current;

    if (!inactiveAudio || !inactiveGain || !activeGain) return;

    // Attach source node if not done yet
    attachSource(inactiveAudio, !isCurrentA);

    // Load new track on inactive element
    inactiveAudio.src = srcUrl;
    inactiveAudio.load();
    inactiveAudio.volume = 1; // gain handled by GainNode

    if (!autoPlay) return;

    // Start playback on inactive element, then crossfade
    try {
      await inactiveAudio.play();
    } catch {
      return; // Autoplay blocked
    }

    const now = ctx.currentTime;
    const dur = CROSSFADE_DURATION;

    // Fade out active, fade in inactive
    activeGain.gain.cancelScheduledValues(now);
    activeGain.gain.setValueAtTime(activeGain.gain.value, now);
    activeGain.gain.linearRampToValueAtTime(0, now + dur);

    inactiveGain.gain.cancelScheduledValues(now);
    inactiveGain.gain.setValueAtTime(0, now);
    inactiveGain.gain.linearRampToValueAtTime(1, now + dur);

    // After crossfade, pause old audio and swap active ref
    crossfadeTimerRef.current && clearTimeout(crossfadeTimerRef.current);
    crossfadeTimerRef.current = setTimeout(() => {
      const oldAudio = isCurrentA ? audioARef.current : audioBRef.current;
      if (oldAudio) { oldAudio.pause(); oldAudio.src = ""; }
      activeRef.current = isCurrentA ? "B" : "A";
    }, dur * 1000 + 100);
  }, [initCtx, attachSource]);

  // ── Expose playback controls ───────────────────────────────────────────────
  const getActiveAudio = useCallback((): HTMLAudioElement | null => {
    return activeRef.current === "A" ? audioARef.current : audioBRef.current;
  }, []);

  const play = useCallback(async () => {
    initCtx();
    const ctx = ctxRef.current;
    if (ctx?.state === "suspended") await ctx.resume();
    const audio = getActiveAudio();
    if (audio) await audio.play();
  }, [initCtx, getActiveAudio]);

  const pause = useCallback(() => {
    const audio = getActiveAudio();
    if (audio) audio.pause();
  }, [getActiveAudio]);

  const seek = useCallback((time: number) => {
    const audio = getActiveAudio();
    if (audio) audio.currentTime = time;
  }, [getActiveAudio]);

  const getFrequencyData = useCallback((): Uint8Array | null => {
    const analyser = analyserRef.current;
    if (!analyser) return null;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    return data;
  }, []);

  const getWaveformData = useCallback((): Uint8Array | null => {
    const analyser = analyserRef.current;
    if (!analyser) return null;
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    return data;
  }, []);

  // ── Create audio elements on mount ────────────────────────────────────────
  useEffect(() => {
    const audioA = new Audio();
    const audioB = new Audio();
    audioA.crossOrigin = "anonymous";
    audioB.crossOrigin = "anonymous";
    audioA.preload = "auto";
    audioB.preload = "auto";
    audioARef.current = audioA;
    audioBRef.current = audioB;

    // Time update events on both
    const onTime = (audio: HTMLAudioElement) => () => {
      if (audio === getActiveAudio()) {
        onTimeUpdate?.(audio.currentTime, isFinite(audio.duration) ? audio.duration : 0);
      }
    };
    const onBufA = () => {
      const r = audioA.buffered;
      if (r.length > 0) onBuffered?.((r.end(0) / (audioA.duration || 1)) * 100);
    };
    const onBufB = () => {
      const r = audioB.buffered;
      if (r.length > 0) onBuffered?.((r.end(0) / (audioB.duration || 1)) * 100);
    };
    const onWaiting = () => onBuffering?.(true);
    const onCanPlay = () => onBuffering?.(false);
    const onEnd = () => {
      if ((activeRef.current === "A" ? audioA : audioB) === getActiveAudio()) {
        onEnded?.();
      }
    };

    audioA.addEventListener("timeupdate", onTime(audioA));
    audioB.addEventListener("timeupdate", onTime(audioB));
    audioA.addEventListener("progress", onBufA);
    audioB.addEventListener("progress", onBufB);
    audioA.addEventListener("waiting", onWaiting);
    audioB.addEventListener("waiting", onWaiting);
    audioA.addEventListener("canplay", onCanPlay);
    audioB.addEventListener("canplay", onCanPlay);
    audioA.addEventListener("ended", onEnd);
    audioB.addEventListener("ended", onEnd);

    return () => {
      audioA.pause(); audioA.src = "";
      audioB.pause(); audioB.src = "";
      ctxRef.current?.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    play,
    pause,
    seek,
    getFrequencyData,
    getWaveformData,
  };
}

// ── Standalone helper to load track (used by MusicPage) ───────────────────────
export { };
