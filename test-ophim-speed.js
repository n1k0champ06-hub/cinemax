import https from 'https';

const domains = [
  'https://ophim1.com',
  'https://ophimapi.cc'
];

async function measure(url) {
  const start = Date.now();
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        const time = Date.now() - start;
        resolve({ url, status: res.statusCode, time, length: data.length });
      });
    }).on('error', (err) => {
      resolve({ url, error: err.message, time: Date.now() - start });
    });
  });
}

async function run() {
  for (const domain of domains) {
    const r1 = await measure(`${domain}/v1/api/tim-kiem?keyword=a`);
    console.log(r1);
  }
}
run();
