import { fetchRapidApi } from "../lib/rapidapi";

export const fetchAnimeDb = async (endpoint: string) => {
  const host = "anime-db.p.rapidapi.com";
  try {
    const data = await fetchRapidApi(`https://${host}${endpoint}`, host);
    if (!data || (data.message && data.message.includes("not subscribed"))) {
      return null;
    }
    return data;
  } catch (error) {
    return null;
  }
};

export const searchAnime = async (query: string) => {
  if (!query) return null;
  const encodedKw = encodeURIComponent(query);
  return fetchAnimeDb(`/anime?page=1&size=10&search=${encodedKw}&sortBy=ranking&sortOrder=asc`);
};

export const getAnimeRanking = async () => {
  return fetchAnimeDb("/anime?page=1&size=10&sortBy=ranking&sortOrder=asc");
};
