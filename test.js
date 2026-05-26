import https from 'https';
https.get('https://phimapi.com/v1/api/tim-kiem?keyword=batman&limit=1', (res) => {
  let data = '';
  res.on('data', (c) => data += c);
  res.on('end', () => console.log('SEARCH:', data.slice(0, 100)));
});
https.get('https://phimapi.com/v1/api/tim-kiem?keyword=a', (res) => {
  let data = '';
  res.on('data', (c) => data += c);
  res.on('end', () => console.log('THE-LOAI:', data.slice(0, 100)));
});
