const { spawn } = require('child_process');
const puppeteer = require('puppeteer');

(async () => {
  console.log("Starting dev-api...");
  const api = spawn('node', ['scripts/dev-api.cjs'], { cwd: 'c:/Users/cykab/Downloads/cinemax' });
  
  // Wait for port 3000 to be freed just in case
  await new Promise(r => setTimeout(r, 1000));

  console.log("Starting vite...");
  const vite = spawn('npx', ['vite', '--port=3000'], { cwd: 'c:/Users/cykab/Downloads/cinemax', shell: true });
  
  // Wait for vite to start
  await new Promise(r => setTimeout(r, 4000));

  console.log("Starting browser...");
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    } else if (msg.type() === 'warning') {
      // ignore warnings
    } else {
      console.log('BROWSER LOG:', msg.text());
    }
  });

  page.on('pageerror', err => {
    console.log('\n======================================');
    console.log('REACT UNHANDLED ERROR:', err.toString());
    console.log('======================================\n');
  });

  console.log("Navigating to http://localhost:3000...");
  await page.goto('http://localhost:3000/?tab=hoat-hinh', { waitUntil: 'networkidle2' });

  console.log("Clicking the anime link...");
  await page.evaluate(() => {
    window.history.pushState({ modalOpen: true }, "", "/?movie=anilist-62076-tv");
    window.dispatchEvent(new Event('popstate'));
  });

  console.log("Waiting 3 seconds for crash to appear...");
  await new Promise(r => setTimeout(r, 3000));

  await browser.close();
  vite.kill();
  api.kill();
  console.log("Done.");
  process.exit(0);
})();
