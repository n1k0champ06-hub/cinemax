import { useQuery } from '@tanstack/react-query';

export const useAnimeDbRanking = (page = 1, size = 15) => {
  return useQuery({
    queryKey: ['animeDb', 'ranking', page, size],
    queryFn: async () => {
      // Use Jikan API (MyAnimeList unofficial API) which is free, high quality, and no API key required
      const res = await fetch(`https://api.jikan.moe/v4/top/anime?page=${page}&limit=${size}&filter=bypopularity`);
      if (!res.ok) throw new Error("Failed to fetch anime ranking from Jikan API");
      return res.json();
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });
};
