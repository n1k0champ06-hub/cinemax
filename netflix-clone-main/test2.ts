const RAPID_KEY = "dc085282f5mshe6977cddf598decp1f301bjsnacd41e19228f";
const HOST = "imdb236.p.rapidapi.com";
fetch("https://imdb236.p.rapidapi.com/api/imdb/top250-movies", {
  headers: {
    'x-rapidapi-host': HOST,
    'x-rapidapi-key': RAPID_KEY,
  }
}).then(r => r.json()).then(console.log);
