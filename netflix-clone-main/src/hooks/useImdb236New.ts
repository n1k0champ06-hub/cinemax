import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { fetchRapidApi } from "../lib/rapidapi";

const HOST = "imdb236.p.rapidapi.com";

export const fetchWithKey = async (url: string) => {
  const data = await fetchRapidApi(url, HOST);
  if (!data || data.message || data.error) {
    return null;
  }
  return data;
};

export const useImdbRanking = (type: "top250-movies" | "top250-tv" | "most-popular-tv" | "top-box-office") => {
  return useQuery({
    queryKey: ["imdb236", "ranking", type],
    queryFn: () => fetchWithKey(`https://${HOST}/api/imdb/${type}`),
    staleTime: 60 * 60 * 1000,
  });
};

export const useImdbSearchAdvanced = (query: string, type: string, genre: string) => {
  return useQuery({
    queryKey: ["imdb236", "search", query, type, genre],
    queryFn: async () => {
      let q = new URLSearchParams();
      if (query) q.append("query", query);
      if (type) q.append("type", type);
      if (genre) q.append("genre", genre);
      q.append("rows", "25");
      return fetchWithKey(`https://${HOST}/api/imdb/search?${q.toString()}`);
    },
    enabled: !!(query || type || genre),
  });
};

export const useImdbAutocomplete = (query: string) => {
  return useQuery({
    queryKey: ["imdb236", "autocomplete", query],
    queryFn: () => fetchWithKey(`https://${HOST}/api/imdb/autocomplete?query=${encodeURIComponent(query)}`),
    enabled: !!query,
  });
};

export const useImdbTitleDetails = (id: string | null) => {
  return useQuery({
    queryKey: ["imdb236", "title", id],
    queryFn: async () => {
      if (!id) return null;
      const detail = await fetchWithKey(`https://${HOST}/api/imdb/${id}`);
      if (!detail) return null;
      const [cast, trailer] = await Promise.allSettled([
         fetchWithKey(`https://${HOST}/api/imdb/${id}/cast`),
         fetchWithKey(`https://${HOST}/api/imdb/${id}/trailer`), // might not exist in old version
      ]);
      return {
         ...detail,
         cast: cast.status === "fulfilled" ? cast.value : undefined,
      };
    },
    enabled: !!id,
  });
};

export const useImdbSimilar = (id: string | null) => {
  return useQuery({
    queryKey: ["imdb236", "similar", id],
    queryFn: () => fetchWithKey(`https://${HOST}/api/imdb/${id}/similar`),
    enabled: !!id,
  });
};

export const useImdbActor = (id: string | null) => {
  return useQuery({
    queryKey: ["imdb236", "actor", id],
    queryFn: async () => {
      if (!id) return null;
      const detail = await fetchWithKey(`https://${HOST}/api/imdb/name/${id}`);
      const movies = await fetchWithKey(`https://${HOST}/api/imdb/cast/${id}/most-popular-titles`);
      return { ...detail, popularTitles: movies };
    },
    enabled: !!id,
  });
};

