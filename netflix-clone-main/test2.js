import https from 'https';
https.get('https://phimapi.com/v1/api/the-loai/hanh-dong', (res) => {
  let data = '';
  res.on('data', (c) => data += c);
  res.on('end', () => console.log('HANHDONG:', data.slice(0, 100)));
});
