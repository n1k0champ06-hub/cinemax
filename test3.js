import https from 'https';
https.get('https://phimapi.com/v1/api/the-loai/hanh-dong', (res) => {
  let data = '';
  res.on('data', (c) => data += c);
  res.on('end', () => console.log('KEYS:', Object.keys(JSON.parse(data).data), JSON.parse(data).data.items ? 'HAS_ITEMS' : 'NO_ITEMS'));
});
