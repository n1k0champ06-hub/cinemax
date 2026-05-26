import { useQuery } from '@tanstack/react-query';

export const useKinoCheckTrailer = (id?: string) => {
  return useQuery({
    queryKey: ['kinocheck_trailer', id],
    queryFn: async () => {
      if (!id) return null;
      let param = '';
      if (id.startsWith('tt')) {
        param = `imdb_id=${id}`;
      } else {
        param = `tmdb_id=${id}`;
      }
      
      try {
        const headers = {
          'X-Api-Key': 'cWPzE6dInZm3kY2SoOqgG0xxKq7D891Ytu7fEuwAGz5i1jUQ2lWao9ymHVyXRveT',
          'X-Api-Host': 'api.kinocheck.com'
        };
        const res = await fetch(`https://api.kinocheck.com/movies?${param}&language=en&categories=Trailer`, { headers });
        if (!res.ok) {
          // If error or not found in movies, maybe it's a show
          const showRes = await fetch(`https://api.kinocheck.com/shows?${param}&language=en&categories=Trailer`, { headers });
          if (!showRes.ok) return null;
          const showData = await showRes.json();
          return showData?.trailer?.youtube_video_id || null;
        }
        const data = await res.json();
        return data?.trailer?.youtube_video_id || null;
      } catch (err) {
        return null;
      }
    },
    enabled: !!id,
  });
};
