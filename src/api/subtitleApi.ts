/**
 * subtitleApi.ts
 * Fetch + transform Vietnamese subtitles from Subdl (primary) via /api/sub-proxy.
 * Provides SRT→VTT conversion and timestamp offset shifting.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SubtitleTrack {
  id: string;
  language: string;
  name: string;
  /** Absolute URL to fetch the raw .srt / .vtt file */
  downloadUrl: string;
  format: 'srt' | 'vtt';
  hi: boolean;
  rating: number;
  /** Raw VTT content once downloaded */
  vttContent?: string;
}

export interface SubtitleSearchResult {
  tracks: SubtitleTrack[];
  source: 'subdl' | 'opensubtitles' | 'none';
  error?: string;
}

export interface VttCue {
  startMs: number;
  endMs: number;
  text: string;
}

// ---------------------------------------------------------------------------
// API base (works both locally via Vite proxy and on Vercel)
// ---------------------------------------------------------------------------

const API_BASE = typeof window !== 'undefined' ? '' : 'http://localhost:3001';

function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

// ---------------------------------------------------------------------------
// Fetch subtitle list
// ---------------------------------------------------------------------------

export async function fetchSubtitles(
  tmdbId: number | string,
  mediaType: 'movie' | 'tv',
  season?: number | null,
  episode?: number | null,
  lang = 'vi',
  imdbId?: string | null
): Promise<SubtitleSearchResult> {
  try {
    const params = new URLSearchParams({
      provider: 'subdl',
      tmdb_id: String(tmdbId),
      type: mediaType === 'movie' ? 'movie' : 'episode',
      lang,
    });
    if (imdbId) params.set('imdb_id', imdbId);
    if (mediaType === 'tv' && season) params.set('season', String(season));
    if (mediaType === 'tv' && episode) params.set('episode', String(episode));

    const res = await fetch(apiUrl(`/api/sub-proxy?${params.toString()}`));
    if (!res.ok) throw new Error(`sub-proxy returned ${res.status}`);
    const data = await res.json();

    return {
      tracks: (data.subtitles || []) as SubtitleTrack[],
      source: data.source || 'subdl',
    };
  } catch (err) {
    console.warn('[subtitleApi] fetchSubtitles failed:', err);
    return { tracks: [], source: 'none', error: String(err) };
  }
}

// ---------------------------------------------------------------------------
// Download and cache the raw subtitle file content
// ---------------------------------------------------------------------------

export async function downloadSubtitleContent(track: SubtitleTrack): Promise<string> {
  // Route through our proxy to avoid CORS
  const proxyUrl = apiUrl(
    `/api/sub-proxy?provider=download&url=${encodeURIComponent(track.downloadUrl)}`
  );
  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error(`Subtitle download failed: ${res.status}`);
  return await res.text();
}

// ---------------------------------------------------------------------------
// SRT → VTT conversion
// ---------------------------------------------------------------------------

/**
 * Convert SubRip (.srt) content to WebVTT (.vtt).
 * Handles BOM, Windows line endings, and common encoding quirks.
 */
export function srtToVtt(srt: string): string {
  // Strip BOM
  let content = srt.replace(/^\uFEFF/, '');
  // Normalize line endings
  content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const lines = ['WEBVTT', ''];
  const blocks = content.trim().split(/\n\n+/);

  for (const block of blocks) {
    const blockLines = block.trim().split('\n');
    if (blockLines.length < 2) continue;

    let timeLineIdx = 0;
    // Skip numeric cue index line if present
    if (/^\d+$/.test(blockLines[0].trim())) {
      timeLineIdx = 1;
    }

    const timeLine = blockLines[timeLineIdx];
    if (!timeLine || !timeLine.includes('-->')) continue;

    // Convert SRT timestamps (hh:mm:ss,mmm) to VTT (hh:mm:ss.mmm)
    const convertedTimeline = timeLine.replace(
      /(\d{2}:\d{2}:\d{2}),(\d{3})/g,
      '$1.$2'
    );

    const textLines = blockLines.slice(timeLineIdx + 1);
    if (textLines.length === 0) continue;

    lines.push(convertedTimeline);
    lines.push(...textLines);
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// ASS → VTT conversion
// ---------------------------------------------------------------------------

/**
 * Convert Advanced SubStation Alpha (.ass / .ssa) content to WebVTT (.vtt).
 * Handles styles, positions, centisecond timestamps, and alignment.
 */
export function assToVtt(ass: string): string {
  // Strip BOM and normalize line endings
  let content = ass.replace(/^\uFEFF/, '');
  content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = content.split('\n');

  const vttLines = ['WEBVTT', ''];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('Dialogue:')) continue;

    // The format is typically: Dialogue: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
    const firstCommaIdx = trimmed.indexOf(':');
    if (firstCommaIdx === -1) continue;

    const fieldsStr = trimmed.slice(firstCommaIdx + 1).trim();
    const parts = fieldsStr.split(',');
    if (parts.length < 10) continue;

    const startStr = parts[1].trim(); // e.g. 0:00:23.90 or 00:00:23.90
    const endStr = parts[2].trim(); // e.g. 0:00:25.59 or 00:00:25.59

    // Join remaining fields for the actual dialogue text (which can contain commas)
    let text = parts.slice(9).join(',');

    // Remove ASS override styling tags like {\pos(960,960)} or {\fnArial\fs20\b1}
    text = text.replace(/\{[^}]+\}/g, '');

    // Replace ASS newline markers (\N, \n) with standard newlines
    text = text.replace(/\\N/gi, '\n').replace(/\\n/gi, '\n');

    // Convert ASS timestamp (h:mm:ss.cc or hh:mm:ss.cc) to VTT (hh:mm:ss.mmm)
    const padTime = (timeStr: string) => {
      const p = timeStr.split(':');
      if (p.length !== 3) return '00:00:00.000';
      const h = p[0].padStart(2, '0');
      const m = p[1].padStart(2, '0');
      let [s, cc] = p[2].split('.');
      s = s.padStart(2, '0');
      cc = (cc || '00').padEnd(3, '0').slice(0, 3);
      return `${h}:${m}:${s}.${cc}`;
    };

    const startVtt = padTime(startStr);
    const endVtt = padTime(endStr);

    vttLines.push(`${startVtt} --> ${endVtt}`);
    vttLines.push(text.trim());
    vttLines.push('');
  }

  return vttLines.join('\n');
}


// ---------------------------------------------------------------------------
// Parse VTT into cue objects
// ---------------------------------------------------------------------------

export function parseVttCues(vttContent: string): VttCue[] {
  const cues: VttCue[] = [];
  // Normalize
  const content = vttContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = content.split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const timeLine = lines.find(l => l.includes('-->'));
    if (!timeLine) continue;

    const match = timeLine.match(
      /(\d{1,2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{3})/
    );
    if (!match) continue;

    const startMs = timestampToMs(match[1]);
    const endMs = timestampToMs(match[2]);

    // Collect text lines (everything after the --> line, excluding the cue identifier)
    const timeIdx = lines.indexOf(timeLine);
    const textLines = lines.slice(timeIdx + 1).filter(l => l.trim());
    if (textLines.length === 0) continue;

    // Strip VTT tags like <b>, <i>, <c.color>, <00:00:00.000>
    const text = textLines
      .join('\n')
      .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, '')
      .replace(/<[^>]+>/g, '')
      .trim();

    if (text) {
      cues.push({ startMs, endMs, text });
    }
  }

  return cues;
}

// ---------------------------------------------------------------------------
// Apply subtitle offset (shift all cue timestamps)
// ---------------------------------------------------------------------------

/**
 * Rebuild VTT content with all timestamps shifted by offsetSeconds.
 * Negative values shift subtitles earlier (appear sooner).
 * Positive values shift subtitles later (appear later).
 */
export function applySubtitleOffset(vttContent: string, offsetSeconds: number): string {
  if (offsetSeconds === 0) return vttContent;

  const offsetMs = Math.round(offsetSeconds * 1000);
  const content = vttContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  return content.replace(
    /(\d{1,2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{3})/g,
    (_, startStr, endStr) => {
      const newStart = Math.max(0, timestampToMs(startStr) + offsetMs);
      const newEnd = Math.max(0, timestampToMs(endStr) + offsetMs);
      return `${msToTimestamp(newStart)} --> ${msToTimestamp(newEnd)}`;
    }
  );
}

// ---------------------------------------------------------------------------
// Timestamp helpers
// ---------------------------------------------------------------------------

function timestampToMs(ts: string): number {
  // Supports h:mm:ss.mmm and hh:mm:ss,mmm
  const normalized = ts.replace(',', '.');
  const parts = normalized.split(':');
  if (parts.length === 3) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const [s, ms] = parts[2].split('.').map(Number);
    return ((h * 3600 + m * 60 + s) * 1000) + (ms || 0);
  }
  return 0;
}

function msToTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const milliseconds = ms % 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ].join(':') + '.' + String(milliseconds).padStart(3, '0');
}
