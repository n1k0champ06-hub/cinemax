import https from 'https';
https.get('https://phimapi.com/phim/batman', (res) => {
  let data = '';
  res.on('data', (c) => data += c);
  res.on('end', () => {
    let d = JSON.parse(data);
    console.log(JSON.stringify(d.episodes, null, 2).slice(0, 1000));
  });
});
