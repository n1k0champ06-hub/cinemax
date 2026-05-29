import React, { useEffect, useState, useCallback, useRef } from 'react';
import { parseVttCues, srtToVtt, type VttCue } from '../../api/subtitleApi';

interface SubtitleOverlayProps {
  // Presenter mode (direct cues rendering)
  cues?: VttCue[];
  currentTimeMs?: number;
  fontSize?: 'small' | 'medium' | 'large';
  color?: 'white' | 'yellow' | 'cyan';

  // Container mode (automatic load and parse)
  subtitleUrl?: string | null;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  offsetMs?: number;
  enabled?: boolean;
}

const FONT_SIZE_MAP = {
  small: '14px',
  medium: '18px',
  large: '22px',
};

const COLOR_MAP = {
  white: '#ffffff',
  yellow: '#ffd700',
  cyan: '#00e5ff',
};

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({
  cues: externalCues,
  currentTimeMs: externalTimeMs,
  fontSize = 'medium',
  color = 'white',
  subtitleUrl,
  videoRef,
  offsetMs = 0,
  enabled = true,
}) => {
  const [internalCues, setInternalCues] = useState<VttCue[]>([]);
  const [loading, setLoading] = useState(false);

  // Sync video time using hook if videoRef is provided
  const videoTimeMs = useVideoSubtitleSync(videoRef || { current: null });

  // Determine current playback time
  const timeMs = externalTimeMs !== undefined 
    ? externalTimeMs 
    : (videoRef?.current ? videoTimeMs : (externalTimeMs || 0));

  // Load and parse subtitle from subtitleUrl if provided
  useEffect(() => {
    if (!subtitleUrl) {
      setInternalCues([]);
      return;
    }

    let active = true;
    setLoading(true);

    const loadSub = async () => {
      try {
        // Route through local proxy to bypass CORS
        let fetchUrl = subtitleUrl;
        if (subtitleUrl.startsWith('http') && !subtitleUrl.includes('localhost') && !subtitleUrl.includes(window.location.host)) {
          fetchUrl = `/api/sub-proxy?provider=download&url=${encodeURIComponent(subtitleUrl)}`;
        }
        
        const res = await fetch(fetchUrl);
        if (!res.ok) throw new Error(`Subtitle load failed: ${res.status}`);
        let text = await res.text();

        // Convert SRT to VTT if needed
        const isSrt = subtitleUrl.toLowerCase().endsWith('.srt') || (text.includes('-->') && !text.includes('WEBVTT'));
        if (isSrt) {
          text = srtToVtt(text);
        }

        const parsed = parseVttCues(text);

        if (active) {
          setInternalCues(parsed);
          setLoading(false);
        }
      } catch (err) {
        console.error('[SubtitleOverlay] Error loading subtitle:', err);
        if (active) setLoading(false);
      }
    };

    loadSub();
    return () => {
      active = false;
    };
  }, [subtitleUrl]);

  if (!enabled) return null;

  const cues = externalCues || internalCues;
  if (!cues || cues.length === 0) return null;

  // Find cues matching the current time (with offset applied)
  const activeCues = cues.filter(c => {
    const start = c.startMs + offsetMs;
    const end = c.endMs + offsetMs;
    return timeMs >= start && timeMs <= end;
  });

  if (activeCues.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '12%',
        left: '50%',
        transform: 'translateX(-50%)',
        textAlign: 'center',
        pointerEvents: 'none',
        zIndex: 100,
        maxWidth: '85%',
        width: 'max-content',
        padding: '6px 12px',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: '8px',
        backdropFilter: 'blur(2px)',
      }}
    >
      {activeCues.map((cue, i) => (
        <div
          key={i}
          style={{
            fontSize: FONT_SIZE_MAP[fontSize],
            color: COLOR_MAP[color],
            textShadow: `
              -1.5px -1.5px 0 #000,
               1.5px -1.5px 0 #000,
              -1.5px  1.5px 0 #000,
               1.5px  1.5px 0 #000,
               0    2px 4px rgba(0,0,0,0.8)
            `,
            lineHeight: 1.4,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: 600,
            whiteSpace: 'pre-wrap',
            marginBottom: i < activeCues.length - 1 ? '4px' : '0',
          }}
          dangerouslySetInnerHTML={{ __html: cue.text.replace(/\n/g, '<br/>') }}
        />
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Hook: useVideoSubtitleSync — reads directly from <video> element
// ---------------------------------------------------------------------------

export function useVideoSubtitleSync(
  videoRef: React.RefObject<HTMLVideoElement | null>
): number {
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const rafRef = useRef<number | null>(null);

  const tick = useCallback(() => {
    if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
      setCurrentTimeMs(videoRef.current.currentTime * 1000);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [videoRef]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [tick]);

  return currentTimeMs;
}

// ---------------------------------------------------------------------------
// Hook: usePlaybackTimer — estimates currentTime via local clock (for iframe)
// ---------------------------------------------------------------------------

interface UsePlaybackTimerOptions {
  isPlaying: boolean;
  playStartedAt: number | null;
  startTimeMs: number;
}

export function usePlaybackTimer({
  isPlaying,
  playStartedAt,
  startTimeMs,
}: UsePlaybackTimerOptions): number {
  const [currentTimeMs, setCurrentTimeMs] = useState(startTimeMs);
  const rafRef = useRef<number | null>(null);

  const tick = useCallback(() => {
    if (isPlaying && playStartedAt !== null) {
      const elapsed = Date.now() - playStartedAt;
      setCurrentTimeMs(startTimeMs + elapsed);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [isPlaying, playStartedAt, startTimeMs]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [tick]);

  useEffect(() => {
    if (!isPlaying) setCurrentTimeMs(startTimeMs);
  }, [isPlaying, startTimeMs]);

  return currentTimeMs;
}
