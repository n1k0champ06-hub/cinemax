import https from 'https';
https.get('https://ophim1.com/v1/api/the-loai/hanh-dong', (res) => {
  let data = '';
  res.on('data', (c) => data += c);
  res.on('end', () => console.log('OPHIM HANHDONG:', data.slice(0, 100)));
});
https.get('https://ophim1.com/v1/api/tim-kiem?keyword=a', (res) => {
  let data = '';
  res.on('data', (c) => data += c);
  res.on('end', () => console.log('OPHIM TIMKIEM:', data.slice(0, 100)));
});
