import { useQuery } from '@tanstack/react-query';

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

