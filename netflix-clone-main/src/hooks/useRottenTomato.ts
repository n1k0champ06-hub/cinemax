import { fetchRapidApi } from "../lib/rapidapi";

export const fetchRottenTomato = async (endpoint: string) => {
  const host = "rottentomato.p.rapidapi.com";
  try {
    const data = await fetchRapidApi(`https://${host}${endpoint}`, host);
    if (!data || (data.message && data.message.includes("subscribed"))) {
      return null;
    }
    return data;
  } catch (error) {
    return null;
  }
};

export const searchRottenTomato = async (keyword: string) => {
  if (!keyword) return null;
  const encodedKw = encodeURIComponent(keyword);
  // Using the search endpoint
  return fetchRottenTomato(`/search?search-term=${encodedKw}`);
};

export const getRottenTomatoRating = async (name: string) => {
  if (!name) return null;
  const encodedName = encodeURIComponent(name);
  const searchResults = await searchRottenTomato(name);
  // Try to find exact or best match
  if (searchResults?.movies_shows && searchResults.movies_shows.length > 0) {
    const item = searchResults.movies_shows[0];
    return {
      tomatoMeter: item?.rottenTomatoes?.tomatometerScore || item?.tomatoRating?.tomatometer || item?.tomatometerScore?.score,
      audienceScore: item?.rottenTomatoes?.audienceScore || item?.tomatoRating?.audience_score || item?.audienceScore?.score,
      info: item
    };
  }
  
  if (searchResults?.items && searchResults.items.length > 0) {
    const item = searchResults.items[0];
    return {
      tomatoMeter: item?.tomatoRating?.tomatometer || item?.tomatometerScore?.score,
      audienceScore: item?.tomatoRating?.audience_score || item?.audienceScore?.score,
      info: item
    };
  }
  
  // fallback using by_name endpoint
  const byNameResult = await fetchRottenTomato(`/?name=${encodedName}`);
  if (byNameResult && typeof byNameResult === 'object') {
     return {
         tomatoMeter: byNameResult?.tomatometerScore?.score || byNameResult?.tomatoMeter || byNameResult?.tomatometer_score,
         audienceScore: byNameResult?.audienceScore?.score || byNameResult?.audienceScore || byNameResult?.audience_score,
         info: byNameResult
     }
  }
  return null;
};
