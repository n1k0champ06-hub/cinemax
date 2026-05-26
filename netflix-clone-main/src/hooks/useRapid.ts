import { useQuery } from "@tanstack/react-query";
import { fetchRapidApi } from "../lib/rapidapi";
import { getRottenTomatoRating } from "./useRottenTomato";

export const fetchRottenTomatoes = async (name: string) => {
  return getRottenTomatoRating(name);
};

export const fetchMainActors = async (imdbId: string | null) => {
  if (!imdbId) return null;
  try {
    const data = await fetchRapidApi(`https://moviesdatabase.p.rapidapi.com/titles/${imdbId}/main_actors`, 'moviesdatabase.p.rapidapi.com');
    if (!data || data.message) {
      return null;
    }
    return data.results || data;
  } catch (e) {
    console.error("moviesdatabase error", e);
    return null;
  }
};

export const useRottenTomatoes = (name: string | undefined) => {
  return useQuery({
    queryKey: ["rottenTomatoes", name],
    queryFn: () => fetchRottenTomatoes(name || ""),
    enabled: !!name,
    staleTime: 24 * 60 * 60 * 1000,
  });
};

export const useMainActors = (imdbId: string | null | undefined) => {
  return useQuery({
    queryKey: ["mainActors", imdbId],
    queryFn: () => fetchMainActors(imdbId || null),
    enabled: !!imdbId,
    staleTime: 24 * 60 * 60 * 1000,
  });
};
