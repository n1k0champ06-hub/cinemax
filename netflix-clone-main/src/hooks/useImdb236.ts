import { useQuery } from "@tanstack/react-query";
import { fetchRapidApi } from "../lib/rapidapi";

const HOST = "imdb236.p.rapidapi.com";

const fetchWithKey = async (url: string) => {
  const data = await fetchRapidApi(url, HOST);
  if (!data || data.message || data.error || (data.message && data.message.toLowerCase().includes("not subscribed"))) {
    throw new Error(data?.message || data?.error || "Not subscribed");
  }
  return data;
};

export const fetchImdbSearch = async (query: string) => {
  if (!query) return null;
  try {
    const data = await fetchWithKey(`https://imdb236.p.rapidapi.com/search/?query=${encodeURIComponent(query)}`);
    if (data?.results && data.results.length > 0) {
      return data.results[0];
    }
    return null;
  } catch (e: any) {
    // Silently fail to avoid console errors
    return null;
  }
};

export const fetchImdbDetailsData = async (id: string | null) => {
  if (!id) return null;
  try {
    const data = await fetchWithKey(`https://imdb236.p.rapidapi.com/api/imdb/${id}`);
    
    const [rating, cast, directors, poster] = await Promise.allSettled([
      fetchWithKey(`https://imdb236.p.rapidapi.com/api/imdb/${id}/rating`),
      fetchWithKey(`https://imdb236.p.rapidapi.com/api/imdb/${id}/cast`),
      fetchWithKey(`https://imdb236.p.rapidapi.com/api/imdb/${id}/directors`),
      fetchWithKey(`https://imdb236.p.rapidapi.com/api/imdb/${id}/poster`)
    ]);

    const out = {
      ...data,
      id: id,
      rating: rating.status === 'fulfilled' ? rating.value?.averageRating || rating.value : undefined,
      actors: cast.status === 'fulfilled' ? cast.value?.map((c: any) => c.name || c) : undefined,
      director: directors.status === 'fulfilled' ? directors.value?.map((d: any) => d.name || d).join(', ') : undefined,
      image: poster.status === 'fulfilled' ? poster.value?.url || poster.value : undefined,
    };
    return out;
  } catch (e: any) {
    // Fall back to old endpoint if the new one errors out
    try {
      return await fetchWithKey(`https://imdb236.p.rapidapi.com/title/${id}/`);
    } catch (err) {
      return null;
    }
  }
};

export const fetchImdbTrailer = async (id: string | null) => {
  if (!id) return null;
  try {
    return await fetchWithKey(`https://imdb236.p.rapidapi.com/title/${id}/trailer/`);
  } catch (e: any) {
    return null;
  }
};

export const useImdbMeta = (title: string | undefined, year?: string | number) => {
  return useQuery({
    queryKey: ["imdbMeta", title, year],
    queryFn: async () => {
      const searchRes = await fetchImdbSearch(title + (year ? ` ${year}` : ''));
      if (searchRes?.id) {
        return fetchImdbDetailsData(searchRes.id);
      }
      return null;
    },
    enabled: !!title,
    staleTime: 24 * 60 * 60 * 1000,
  });
};

export const useImdbTrailer = (imdbId: string | undefined | null) => {
  return useQuery({
    queryKey: ["imdbTrailer", imdbId],
    queryFn: () => fetchImdbTrailer(imdbId || null),
    enabled: !!imdbId,
    staleTime: 24 * 60 * 60 * 1000,
  });
};
