'use strict';
/**
 * ██████╗ ███████╗███████╗ ██████╗ ██╗    ██╗   ██╗███████╗██████╗
 * ██╔══██╗██╔════╝██╔════╝██╔═══██╗██║    ██║   ██║██╔════╝██╔══██╗
 * ██████╔╝█████╗  ███████╗██║   ██║██║    ██║   ██║█████╗  ██████╔╝
 * ██╔══██╗██╔══╝  ╚════██║██║   ██║██║    ╚██╗ ██╔╝██╔══╝  ██╔══██╗
 * ██║  ██║███████╗███████║╚██████╔╝███████╗╚████╔╝ ███████╗██║  ██║
 * ╚═╝  ╚═╝╚══════╝╚══════╝ ╚═════╝ ╚══════╝ ╚═══╝  ╚══════╝╚═╝  ╚═╝
 *
 * Cinemax On-Demand HLS Resolver v1.0
 * Chạy trên máy cá nhân — dùng Chrome ảo để bẻ khóa Vidsrc lấy link .m3u8 sạch.
 *
 * Cách dùng:
 *   node resolver.cjs             # Lắng nghe queue và giải mã tự động
 *   node resolver.cjs --test tt4154796   # Test với 1 TMDB/IMDB ID cụ thể (phim)
 *   node resolver.cjs --test tt0944947 --type tv --season 1 --episode 1
 */

const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');

chromium.use(StealthPlugin());

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
function loadEnv() {
  const candidates = [
    path.join(__dirname, '.env'),
    path.join(__dirname, '..', '.env'),
  ];
  for (const fp of candidates) {
    if (!fs.existsSync(fp)) continue;
    for (const line of fs.readFileSync(fp, 'utf-8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
    break;
  }
}
loadEnv();

const MONGODB_URI = process.env.MONGODB_URI;
const POLL_INTERVAL_MS   = 3000;   // Poll queue mỗi 3 giây
const LINK_TTL_HOURS     = 20;     // Link m3u8 hết hạn sau 20 giờ
const BROWSER_TIMEOUT_MS = 10000;  // Timeout cho 1 lần bẻ khóa (10s)
const MAX_CONCURRENT     = 8;      // Số phim giải mã đồng thời

// Nguồn thử lần lượt (fallback chain)
const VIDSRC_SOURCES = [
  { name: 'vidsrc.pm',    buildUrl: (id, type, s, e) => type === 'movie' ? `https://vidsrc.pm/embed/movie/${id}` : `https://vidsrc.pm/embed/tv/${id}/${s}/${e}` },
  { name: 'vidsrc.cc',    buildUrl: (id, type, s, e) => type === 'movie' ? `https://vidsrc.cc/embed/movie/${id}` : `https://vidsrc.cc/embed/tv/${id}/${s}/${e}` },
  { name: 'vidsrc.to',    buildUrl: (id, type, s, e) => type === 'movie' ? `https://vidsrc.to/embed/movie/${id}` : `https://vidsrc.to/embed/tv/${id}/${s}/${e}` },
  { name: 'vidsrc.me',    buildUrl: (id, type, s, e) => type === 'movie' ? `https://vidsrc.me/embed/movie?imdb=${id}` : `https://vidsrc.me/embed/tv?imdb=${id}&season=${s}&episode=${e}` },
  { name: 'vidnest.fun',  buildUrl: (id, type, s, e) => type === 'movie' ? `https://vidnest.fun/movie/${id}` : `https://vidnest.fun/tv/${id}/${s}/${e}` },
];

// ---------------------------------------------------------------------------
// Shared Browser Pool Management
// ---------------------------------------------------------------------------
let sharedBrowser = null;

async function getSharedBrowser() {
  if (sharedBrowser && sharedBrowser.isConnected()) {
    return sharedBrowser;
  }
  const isTest = process.argv.includes('--test');
  logInfo('BROWSER', 'Khởi tạo Chrome instance dùng chung (Shared Browser)...');
  sharedBrowser = await chromium.launch({
    headless: !isTest,
    channel: 'chrome',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--blink-settings=imagesEnabled=false',
      '--disable-web-security',
    ],
  });
  return sharedBrowser;
}

async function closeSharedBrowser() {
  if (sharedBrowser) {
    await sharedBrowser.close().catch(() => {});
    sharedBrowser = null;
    logInfo('BROWSER', 'Đã đóng Chrome instance dùng chung.');
  }
}

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------
const RESET = '\x1b[0m', GREEN = '\x1b[32m', RED = '\x1b[31m',
      CYAN  = '\x1b[36m', GRAY  = '\x1b[90m', YELLOW = '\x1b[33m', BOLD = '\x1b[1m';

function ts() { return new Date().toLocaleTimeString('vi-VN'); }
function log(color, tag, msg) { console.log(`${GRAY}[${ts()}]${RESET} ${color}${BOLD}[${tag}]${RESET} ${msg}`); }
const logOk   = (tag, msg) => log(GREEN,  tag, msg);
const logErr  = (tag, msg) => log(RED,    tag, `❌ ${msg}`);
const logInfo = (tag, msg) => log(CYAN,   tag, msg);
const logWarn = (tag, msg) => log(YELLOW, tag, `⚠ ${msg}`);

// ---------------------------------------------------------------------------
// MongoDB
// ---------------------------------------------------------------------------
let db = null;

async function connectDB() {
  if (!MONGODB_URI) {
    logErr('DB', 'MONGODB_URI chưa được cấu hình! Kiểm tra file .env');
    process.exit(1);
  }
  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  db = client.db();
  logOk('DB', `Kết nối MongoDB thành công: ${db.databaseName}`);
  return client;
}

function streamsCol()        { return db.collection('vidsrc_streams'); }
function queueCol()          { return db.collection('resolving_queue'); }

// ---------------------------------------------------------------------------
// Core: Bẻ khóa 1 phim bằng Playwright (Tối ưu Fast-Exit & Interception)
// ---------------------------------------------------------------------------
async function resolveWithPlaywright(job) {
  const { tmdbId, imdbId, type, season = 1, episode = 1 } = job;
  const mediaId = imdbId || String(tmdbId); // Ưu tiên IMDB ID nếu có
  const isTest = process.argv.includes('--test');

  logInfo('RESOLVER', `Bắt đầu giải mã: ${type} ID=${mediaId} S${season}E${episode}`);

  const browser = await getSharedBrowser();

  for (const source of VIDSRC_SOURCES) {
    const embedUrl = source.buildUrl(mediaId, type, season, episode);
    logInfo(source.name, `Thử nguồn: ${embedUrl}`);

    let context = null;
    try {
      context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 },
        extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
      });

      // TRIỆT TIÊU TÀI NGUYÊN RÁC & QUẢNG CÁO
      await context.route('**/*', (route) => {
        const reqUrl = route.request().url();
        const resType = route.request().resourceType();

        // Chặn ảnh, CSS, Font không cần thiết trừ khi link m3u8
        if (['image', 'stylesheet', 'font'].includes(resType) && !reqUrl.includes('.m3u8')) {
          return route.abort();
        }
        // Chặn các mạng quảng cáo phổ biến
        if (
          reqUrl.includes('doubleclick') ||
          reqUrl.includes('googleads') ||
          reqUrl.includes('adsystem') ||
          reqUrl.includes('popads') ||
          reqUrl.includes('popcash') ||
          reqUrl.includes('exoclick') ||
          reqUrl.includes('juicyads')
        ) {
          return route.abort();
        }
        return route.continue();
      });

      // TRIỆT TIÊU POPUP QUẢNG CÁO
      await context.addInitScript(() => {
        window.open = () => null;
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });

      const page = await context.newPage();

      page.on('popup', (popup) => {
        popup.close().catch(() => {});
      });

      // LẮNG NGHE ĐỂ BẮT LINK VIDEO THẬT
      let capturedM3u8 = null;
      page.on('request', (req) => {
        const reqUrl = req.url();
        if (
          (reqUrl.includes('.m3u8') || reqUrl.includes('.mp4') || reqUrl.includes('googleusercontent') || reqUrl.includes('hakunaymatata')) &&
          !reqUrl.includes('doubleclick') &&
          !reqUrl.includes('googleads') &&
          !reqUrl.includes('subtitle') &&
          !reqUrl.includes('favicon') &&
          !capturedM3u8
        ) {
          capturedM3u8 = reqUrl;
          logOk(source.name, `🎯 Bắt được link video: ${reqUrl.substring(0, 80)}...`);
        }
      });

      // Load trang embed
      await page.goto(embedUrl, {
        waitUntil: 'domcontentloaded',
        timeout: BROWSER_TIMEOUT_MS,
      });

      // FAST-EXIT LOOP 1: Kiểm tra liên tục 200ms trong 3.5 giây đầu
      const startMs = Date.now();
      while (!capturedM3u8 && Date.now() - startMs < 3500) {
        await page.waitForTimeout(200);
      }

      // Nếu bắt được link ngay từ autoload, THOÁT NGAY LẬP TỨC
      if (capturedM3u8) {
        await context.close().catch(() => {});
        logOk('RESOLVER', `⚡ Bẻ khóa siêu tốc thành công từ ${source.name}!`);
        return { streamUrl: capturedM3u8, provider: source.name, source: embedUrl };
      }

      // Nếu chưa bắt được, kích hoạt click nhẹ mô phỏng
      try {
        await page.mouse.click(640, 360).catch(() => {});
        await page.keyboard.press('Space').catch(() => {});
      } catch (_) {}

      // Quét nhanh selector nút Play trong các frame
      const frames = page.frames();
      const playSelectors = [
        'div[class*="play" i]',
        'button[class*="play" i]',
        'svg[class*="play" i]',
        '.art-state',
        '.jw-display-icon-container',
        '.play-btn',
        'video'
      ];

      for (const frame of frames) {
        if (capturedM3u8 || frame.isDetached()) break;
        const frameUrl = frame.url();
        if (frameUrl.includes('vidsrc') || frameUrl.includes('embed') || frameUrl.includes('node') || frameUrl === embedUrl) {
          for (const selector of playSelectors) {
            if (capturedM3u8 || frame.isDetached()) break;
            try {
              const btn = await frame.$(selector);
              if (btn) {
                await btn.click({ timeout: 1000 }).catch(() => {});
                break;
              }
            } catch (_) {}
          }
        }
      }

      // FAST-EXIT LOOP 2: Đợi tối đa thêm 3.5s sau click
      const clickDeadline = Date.now() + 3500;
      while (!capturedM3u8 && Date.now() < clickDeadline) {
        await page.waitForTimeout(200);
      }

      // Chỉ chụp ảnh screenshot debug khi test
      if (isTest && !capturedM3u8) {
        const logDir = path.join(__dirname, 'logs');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        await page.screenshot({ path: path.join(logDir, `debug_${source.name}.png`), timeout: 3000 }).catch(() => {});
      }

      await context.close().catch(() => {});

      if (capturedM3u8) {
        logOk('RESOLVER', `✅ Giải mã thành công từ ${source.name}!`);
        return { streamUrl: capturedM3u8, provider: source.name, source: embedUrl };
      }

      logWarn(source.name, 'Không bắt được link m3u8 từ nguồn này, thử nguồn tiếp...');
    } catch (err) {
      logErr(source.name, `Lỗi: ${err.message}`);
      if (context) await context.close().catch(() => {});
    }
  }

  logErr('RESOLVER', `Thất bại với tất cả ${VIDSRC_SOURCES.length} nguồn cho ID=${mediaId}`);
  return null;
}

// ---------------------------------------------------------------------------
// Lưu kết quả vào MongoDB
// ---------------------------------------------------------------------------
async function saveResolvedStream(job, result) {
  const expiredAt = new Date(Date.now() + LINK_TTL_HOURS * 3600 * 1000);
  const key = { tmdbId: job.tmdbId, type: job.type, season: job.season || 1, episode: job.episode || 1 };

  await streamsCol().updateOne(
    key,
    {
      $set: {
        ...key,
        streamUrl: result.streamUrl,
        provider: result.provider,
        sourceEmbed: result.source,
        expiredAt,
        resolvedAt: new Date(),
      },
    },
    { upsert: true }
  );

  logOk('DB', `Đã lưu link sạch cho TMDB ${job.tmdbId} (hết hạn: ${expiredAt.toLocaleString('vi-VN')})`);
}

// ---------------------------------------------------------------------------
// Queue processor
// ---------------------------------------------------------------------------
const processingIds = new Set();

async function processQueue() {
  try {
    let maxConcurrent = MAX_CONCURRENT;
    try {
      const settings = await db.collection('system_settings').findOne({ key: 'max_concurrent' });
      if (settings && typeof settings.value === 'number') {
        maxConcurrent = settings.value;
      }
    } catch (_) {}
    if (processingIds.size >= maxConcurrent) return;

    // Lấy job cũ nhất đang pending
    const job = await queueCol().findOneAndUpdate(
      { status: 'pending' },
      { $set: { status: 'processing', startedAt: new Date() } },
      { sort: { createdAt: 1 }, returnDocument: 'after' }
    );

    if (!job) return; // Không có job nào

    const jobId = job._id.toString();
    if (processingIds.has(jobId)) return;
    processingIds.add(jobId);

    logInfo('QUEUE', `Xử lý job: TMDB=${job.tmdbId} ${job.type} S${job.season || 1}E${job.episode || 1}`);

    // Chạy giải mã trong nền (không block queue loop)
    (async () => {
      try {
        const result = await resolveWithPlaywright(job);

        if (result) {
          await saveResolvedStream(job, result);
          await queueCol().updateOne(
            { _id: job._id },
            { $set: { status: 'completed', completedAt: new Date() } }
          );
          logOk('QUEUE', `Job hoàn tất: TMDB=${job.tmdbId}`);
        } else {
          await queueCol().updateOne(
            { _id: job._id },
            { $set: { status: 'failed', failedAt: new Date(), retries: (job.retries || 0) + 1 } }
          );
          logErr('QUEUE', `Job thất bại: TMDB=${job.tmdbId}`);
        }
      } catch (err) {
        logErr('QUEUE', `Lỗi xử lý job: ${err.message}`);
        await queueCol().updateOne(
          { _id: job._id },
          { $set: { status: 'failed', error: err.message } }
        ).catch(() => {});
      } finally {
        processingIds.delete(jobId);
      }
    })();
  } catch (err) {
    logErr('QUEUE', `Lỗi nghiêm trọng trong vòng lặp queue: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Check & serve (dùng bởi bridge server)
// ---------------------------------------------------------------------------
async function checkCachedStream(tmdbId, type, season, episode) {
  const now = new Date();
  return streamsCol().findOne({
    tmdbId: String(tmdbId),
    type,
    season: parseInt(season) || 1,
    episode: parseInt(episode) || 1,
    expiredAt: { $gt: now },
  });
}

// ---------------------------------------------------------------------------
// CLI: Test mode
// ---------------------------------------------------------------------------
async function runTestMode() {
  const args = process.argv.slice(2);
  const getArg = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

  const testId   = getArg('--test');
  const type     = getArg('--type') || 'movie';
  const season   = parseInt(getArg('--season') || '1');
  const episode  = parseInt(getArg('--episode') || '1');

  if (!testId) {
    console.log('Cách dùng: node resolver.cjs --test <tmdb_id_hoac_imdb_id> [--type tv] [--season 1] [--episode 1]');
    console.log('Ví dụ:     node resolver.cjs --test tt4154796');
    console.log('           node resolver.cjs --test 1396 --type tv --season 1 --episode 1');
    process.exit(0);
  }

  logInfo('TEST', `Bắt đầu test giải mã: ID=${testId} type=${type} S${season}E${episode}`);

  const result = await resolveWithPlaywright({ tmdbId: testId, imdbId: testId.startsWith('tt') ? testId : null, type, season, episode });

  if (result) {
    logOk('TEST', `\n${'─'.repeat(60)}\n✅ Link m3u8 sạch:\n${result.streamUrl}\n\nNguồn: ${result.provider}\n${'─'.repeat(60)}`);
    await closeSharedBrowser();
  } else {
    logErr('TEST', 'Không lấy được link m3u8 từ bất kỳ nguồn nào.');
    await closeSharedBrowser();
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const isTestMode = process.argv.includes('--test');

  if (isTestMode) {
    await runTestMode();
    process.exit(0);
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logInfo('RESOLVER', 'Đang dừng daemon và đóng trình duyệt...');
    await closeSharedBrowser();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await closeSharedBrowser();
    process.exit(0);
  });

  // Daemon mode: kết nối DB và lắng nghe queue
  await connectDB();

  logInfo('RESOLVER', `Daemon khởi động. Poll queue mỗi ${POLL_INTERVAL_MS / 1000}s | Max đồng thời: ${MAX_CONCURRENT}`);
  logInfo('RESOLVER', 'Nhấn Ctrl+C để dừng.\n');

  // Dọn dẹp các job "processing" bị treo từ lần chạy trước (nếu process bị kill đột ngột)
  const staleResult = await queueCol().updateMany(
    { status: 'processing' },
    { $set: { status: 'pending' } }
  );
  if (staleResult.modifiedCount > 0) {
    logWarn('QUEUE', `Reset ${staleResult.modifiedCount} job bị treo từ lần chạy trước.`);
  }

  // Poll queue liên tục
  setInterval(processQueue, POLL_INTERVAL_MS);
  processQueue(); // Chạy ngay lần đầu không cần đợi
}

main().catch(async (err) => {
  logErr('FATAL', err.message);
  console.error(err);
  await closeSharedBrowser();
  process.exit(1);
});

module.exports = { checkCachedStream };
