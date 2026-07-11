/**
 * useLyrics — Fetches synced (LRC) lyrics from LRCLIB.
 * Falls back to plain text if synced unavailable.
 * Returns timed lines ready for highlighting.
 */
import { useState, useEffect, useRef } from "react";

export interface LyricLine {
  time: number; // seconds
  text: string;
}

interface UseLyricsResult {
  lines: LyricLine[];
  plainText: string;
  loading: boolean;
  error: string | null;
  hasSynced: boolean;
}

const cache = new Map<string, LyricLine[]>();

function parseLRC(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;

  for (const line of lrc.split("\n")) {
    const stripped = line.replace(timeRegex, "").trim();
    let match: RegExpExecArray | null;
    const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
    while ((match = regex.exec(line)) !== null) {
      const mins = parseInt(match[1]);
      const secs = parseInt(match[2]);
      const ms = parseInt(match[3].padEnd(3, "0"));
      const time = mins * 60 + secs + ms / 1000;
      if (stripped) lines.push({ time, text: stripped });
    }
  }

  return lines.sort((a, b) => a.time - b.time);
}

export function useLyrics(title: string, artist: string, album?: string): UseLyricsResult {
  const [lines, setLines] = useState<LyricLine[]>([]);
  const [plainText, setPlainText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSynced, setHasSynced] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!title || !artist) return;

    const key = `${artist}::${title}`;
    if (cache.has(key)) {
      const cached = cache.get(key)!;
      setLines(cached);
      setHasSynced(cached.some(l => l.time > 0));
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setLines([]);
    setPlainText("");

    const params = new URLSearchParams({
      artist_name: artist,
      track_name: title,
      ...(album ? { album_name: album } : {}),
    });

    fetch(`https://lrclib.net/api/get?${params}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`LRCLIB ${res.status}`);
        const data = await res.json();

        if (data.syncedLyrics) {
          const parsed = parseLRC(data.syncedLyrics);
          cache.set(key, parsed);
          setLines(parsed);
          setHasSynced(true);
          setPlainText(data.plainLyrics || "");
        } else if (data.plainLyrics) {
          const plain: LyricLine[] = data.plainLyrics
            .split("\n")
            .map((text: string) => ({ time: 0, text }));
          cache.set(key, plain);
          setLines(plain);
          setHasSynced(false);
          setPlainText(data.plainLyrics);
        } else {
          throw new Error("No lyrics found");
        }
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError("Không tìm thấy lời bài hát");
        setLoading(false);
      });

    return () => controller.abort();
  }, [title, artist, album]);

  return { lines, plainText, loading, error, hasSynced };
}

/**
 * Returns the index of the current lyric line given playback time.
 */
export function useCurrentLyricIndex(lines: LyricLine[], currentTime: number): number {
  if (lines.length === 0) return -1;
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= currentTime) idx = i;
    else break;
  }
  return idx;
}
