import https from 'https';

function testFetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data.slice(0, 1000)
        });
      });
    }).on('error', reject);
  });
}

async function run() {
  try {
    console.log("Fetching fight club (550)...");
    const res1 = await testFetch('https://cinepro-core.cykablyatt1505.workers.dev/v1/movies/550');
    console.log("550 status:", res1.status);
    console.log("550 data:", res1.data);

    console.log("\nFetching tv show (1396 S1E1)...");
    const res2 = await testFetch('https://cinepro-core.cykablyatt1505.workers.dev/v1/tv/1396/seasons/1/episodes/1');
    console.log("1396 status:", res2.status);
    console.log("1396 data:", res2.data);
  } catch (err) {
    console.error("Test error:", err);
  }
}

run();
