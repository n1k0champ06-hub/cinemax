export interface AniListCoverData {
  extraLarge: string | null;
  large: string | null;
  medium: string | null;
  banner: string | null;
  color: string | null;
}

export interface AnimeDetailsData {
  anilistId: number;
  title: string;
  bannerImage: string | null;
  coverImage: {
    extraLarge: string | null;
    large: string | null;
    medium: string | null;
  } | null;
  description: string | null;
  genres: string[];
  year: number | null;
  episodesCount: number | null;
  status: string | null;
  showId: string | null;
  episodes: Array<{ name: string; id: string; title: string }>;
}

const API_BASE = typeof window !== 'undefined' ? '' : 'http://localhost:3001';

function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export const fetchAniListCover = async (title: string): Promise<AniListCoverData | null> => {
  if (!title) return null;

  try {
    const searchUrl = `https://api.animapper.net/api/v1/search?title=${encodeURIComponent(title)}&mediaType=ANIME&limit=1`;
    const res = await fetch(searchUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.results && data.results.length > 0) {
        const item = data.results[0];
        return {
          extraLarge: item.images?.coverXl || null,
          large: item.images?.coverLg || null,
          medium: item.images?.coverMd || null,
          banner: item.images?.bannerUrl || null,
          color: item.images?.coverColor || null
        };
      }
    }
  } catch (err) {
    console.error('[AniList API Client] Failed to fetch cover from AniMapper:', err);
  }

  return null;
};

export const fetchAnimeDetailsClient = async (anilistId: string | number): Promise<AnimeDetailsData | null> => {
  if (!anilistId) return null;

  // 1. Try querying AniMapper metadata API first for Vietnamese metadata and episode list
  try {
    const animapperRes = await fetch(`https://api.animapper.net/api/v1/metadata?id=${anilistId}`);
    if (animapperRes.ok) {
      const animapperData = await animapperRes.json();
      if (animapperData.success && animapperData.result) {
        const result = animapperData.result;
        
        // Extract title: prioritize Vietnamese, then English, then original/Romaji
        const title = result.titles?.vi || result.titles?.en || result.titles?.ja || "Unknown Title";
        
        // Extract description: prioritize Vietnamese, then English
        const description = result.descriptions?.vi || result.descriptions?.en || null;
        
        // Map units to episodes
        const episodesList = (result.units || [])
          .filter((unit: any) => unit.unitKind === "EPISODE")
          .map((unit: any) => ({
            name: String(unit.number),
            id: String(unit.number), // Use episode number as string ID
            title: unit.titles?.vi || unit.titles?.en || unit.titles?.ja || `Tập ${unit.number}`
          }));

        return {
          anilistId: result.id,
          title,
          bannerImage: result.images?.bannerUrl || null,
          coverImage: result.images ? {
            extraLarge: result.images.coverXl || null,
            large: result.images.coverLg || null,
            medium: result.images.coverMd || null
          } : null,
          description,
          genres: (result.genres || []).map((g: any) => g.name || g),
          year: result.seasonYear || null,
          episodesCount: result.totalUnits || result.units?.length || null,
          status: result.status || null,
          showId: null, // showId is for HiAnime provider, not used for AniMapper
          episodes: episodesList
        };
      }
    }
  } catch (err) {
    console.warn('[AniList API Client] AniMapper metadata fetch failed, falling back to AniList/HiAnime:', err);
  }

  // Fallback: call the backend proxy details directly just in case
  try {
    const fallbackRes = await fetch(apiUrl(`/api/anime/details?anilist_id=${anilistId}`));
    if (fallbackRes.ok) {
      return await fallbackRes.json();
    }
  } catch (fallbackErr) {
    console.error('[AniList API Client] Fallback to backend failed:', fallbackErr);
  }

  return null;
};
