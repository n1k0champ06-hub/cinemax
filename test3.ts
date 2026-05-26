const apiKey = "dc085282f5mshe6977cddf598decp1f301bjsnacd41e19228f";
const host = "rottentomato.p.rapidapi.com";
fetch(`https://${host}/search?search-term=batman`, {
  headers: {
    "x-rapidapi-key": apiKey,
    "x-rapidapi-host": host,
  },
}).then(r => r.json()).then(console.log);
