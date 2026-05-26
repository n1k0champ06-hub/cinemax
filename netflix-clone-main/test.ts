import { fetchWithKey } from "./src/hooks/useImdb236New.ts";
fetchWithKey("https://imdb236.p.rapidapi.com/api/imdb/top250-movies").then(res => console.log("RES:", res));
