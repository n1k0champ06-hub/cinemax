export interface AniListCoverData {
  extraLarge: string | null;
  large: string | null;
  medium: string | null;
  banner: string | null;
  color: string | null;
}

const API_BASE = typeof window !== 'undefined' ? '' : 'http://localhost:3001';

function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export const fetchAniListCover = async (title: string): Promise<AniListCoverData | null> => {
  if (!title) return null;

  try {
    const res = await fetch(apiUrl(`/api/anilist?search=${encodeURIComponent(title)}`));
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('[AniList API Client] Failed to fetch cover from proxy:', err);
  }

  return null;
};
