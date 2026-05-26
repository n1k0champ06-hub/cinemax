import https from 'https';
https.get('https://phimapi.com/v1/api/tim-kiem?keyword=batman&limit=1', (res) => {
  let data = '';
  res.on('data', (c) => data += c);
  res.on('end', () => {
    let slug = JSON.parse(data).data.items[0].slug;
    console.log('SLUG:', slug);
    https.get(`https://phimapi.com/phim/${slug}`, (res2) => {
      let data2 = '';
      res2.on('data', (c) => data2 += c);
      res2.on('end', () => {
        let d = JSON.parse(data2);
        console.log(JSON.stringify(d.episodes[0].server_data[0]));
      });
    });
  });
});
