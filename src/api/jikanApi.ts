// Jikan v4 API integration (MyAnimeList official public data)
export interface JikanAnime {
  mal_id: number;
  url: string;
  images: {
    jpg: {
      image_url: string;
      small_image_url: string;
      large_image_url: string;
    };
    webp?: {
      image_url: string;
      small_image_url: string;
      large_image_url: string;
    };
  };
  title: string;
  title_english: string | null;
  title_japanese: string | null;
  type: string;
  episodes: number | null;
  status: string;
  score: number | null;
  scored_by: number | null;
  rank: number | null;
  popularity: number | null;
  synopsis: string | null;
  season: string | null;
  year: number | null;
  genres: Array<{ mal_id: number; name: string }>;
}

/**
 * Convert a Jikan MAL item into Cinemax internal Movie structure
 */
export function jikanItemToMovie(item: JikanAnime) {
  const posterUrl = item.images?.webp?.large_image_url || item.images?.jpg?.large_image_url || item.images?.jpg?.image_url;
  const displayName = item.title_english || item.title;
  
  return {
    _id: `jikan-${item.mal_id}`,
    id: `jikan-${item.mal_id}`,
    slug: `jikan-${item.mal_id}`,
    name: displayName,
    origin_name: item.title_japanese || item.title,
    title: displayName,
    poster_url: posterUrl,
    thumb_url: posterUrl,
    type: 'hoathinh',
    media_type: 'anime',
    isJikan: true,
    score: item.score ? item.score.toFixed(1) : null,
    episode_current: item.episodes ? `${item.episodes} tập` : item.status,
    year: item.year || undefined,
    tmdb: {
      poster_path: posterUrl,
      backdrop_path: posterUrl,
      vote_average: item.score || undefined,
    }
  };
}

export async function fetchJikanTopAnime(limit = 10): Promise<any[]> {
  try {
    const res = await fetch(`https://api.jikan.moe/v4/top/anime?limit=${limit}&filter=bypopularity`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).map(jikanItemToMovie);
  } catch (err) {
    console.error("[Jikan API] Error fetching top anime:", err);
    return [];
  }
}
