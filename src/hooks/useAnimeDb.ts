import { useQuery } from '@tanstack/react-query';

function getCurrentSeasonAndYear() {
  const date = new Date();
  const month = date.getMonth(); // 0-indexed (0 is Jan, 11 is Dec)
  const year = date.getFullYear();
  
  let season = 'SPRING';
  if (month === 11 || month === 0 || month === 1) {
    season = 'WINTER';
  } else if (month >= 2 && month <= 4) {
    season = 'SPRING';
  } else if (month >= 5 && month <= 7) {
    season = 'SUMMER';
  } else if (month >= 8 && month <= 10) {
    season = 'FALL';
  }
  
  // Adjust year for Winter (December belongs to Winter of the next year in AniList model)
  const seasonYear = (month === 11) ? year + 1 : year;
  
  return { season, year: seasonYear };
}

export const useAnimeDbRanking = (page = 1, size = 15, enabled = true) => {
  return useQuery({
    queryKey: ['animeDb', 'ranking', page, size],
    queryFn: async () => {
      // Use Jikan API (MyAnimeList unofficial API) which is free, high quality, and no API key required
      const res = await fetch(`https://api.jikan.moe/v4/top/anime?page=${page}&limit=${size}&filter=bypopularity`);
      if (!res.ok) throw new Error("Failed to fetch anime ranking from Jikan API");
      return res.json();
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    enabled,
  });
};

export const useAnimeDbSeasonNow = (page = 1, size = 20, enabled = true) => {
  return useQuery({
    queryKey: ['animeDb', 'season-now', page, size],
    queryFn: async () => {
      const res = await fetch(`https://api.jikan.moe/v4/seasons/now?page=${page}&limit=${size}`);
      if (!res.ok) throw new Error("Failed to fetch current season anime from Jikan API");
      return res.json();
    },
    staleTime: 1000 * 60 * 60 * 12, // 12 hours
    enabled,
  });
};

export const useAnimeDbUpcoming = (page = 1, size = 20, enabled = true) => {
  return useQuery({
    queryKey: ['animeDb', 'upcoming', page, size],
    queryFn: async () => {
      const res = await fetch(`https://api.jikan.moe/v4/seasons/upcoming?page=${page}&limit=${size}`);
      if (!res.ok) throw new Error("Failed to fetch upcoming anime from Jikan API");
      return res.json();
    },
    staleTime: 1000 * 60 * 60 * 12, // 12 hours
    enabled,
  });
};

export const useAnimeDbSearch = (params: { q?: string; genres?: string; type?: string; status?: string; min_score?: string }, enabled = true) => {
  return useQuery({
    queryKey: ['animeDb', 'search', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.q) searchParams.set('q', params.q);
      if (params.genres) searchParams.set('genres', params.genres);
      if (params.type) searchParams.set('type', params.type);
      if (params.status) searchParams.set('status', params.status);
      if (params.min_score) searchParams.set('min_score', params.min_score);
      searchParams.set('limit', '15');

      const res = await fetch(`https://api.jikan.moe/v4/anime?${searchParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch search results from Jikan API");
      return res.json();
    },
    staleTime: 1000 * 60 * 30, // 30 mins
    enabled,
  });
};

export const useAniListCover = (title: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['anilist', 'cover', title],
    queryFn: async () => {
      const { fetchAniListCover } = await import('../api/anilistApi');
      return fetchAniListCover(title);
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    enabled: (options?.enabled !== false) && !!title,
  });
};

export const useAnilistBulkCovers = (titles: string[], options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['anilist', 'bulk', 'empty'],
    queryFn: async () => {
      return {};
    },
    enabled: true,
  });
};
