const fetch = require('node-fetch');
fetch('https://www.omdbapi.com/?apikey=a74b078b&t=batman').then(r => r.json()).then(console.log);
