'use strict';
/**
 * ██████╗ ██╗███╗   ██╗███████╗███╗   ███╗ █████╗ ██╗  ██╗    ███╗   ███╗██╗███╗   ██╗███████╗██████╗
 * ██╔════╝██║████╗  ██║██╔════╝████╗ ████║██╔══██╗╚██╗██╔╝    ████╗ ████║██║████╗  ██║██╔════╝██╔══██╗
 * ██║     ██║██╔██╗ ██║█████╗  ██╔████╔██║███████║ ╚███╔╝     ██╔████╔██║██║██╔██╗ ██║█████╗  ██████╔╝
 * ██║     ██║██║╚██╗██║██╔══╝  ██║╚██╔╝██║██╔══██║ ██╔██╗     ██║╚██╔╝██║██║██║╚██╗██║██╔══╝  ██╔══██╗
 * ╚██████╗██║██║ ╚████║███████╗██║ ╚═╝ ██║██║  ██║██╔╝ ██╗    ██║ ╚═╝ ██║██║██║ ╚████║███████╗██║  ██║
 *  ╚═════╝╚═╝╚═╝  ╚═══╝╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝    ╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝
 *
 * Cinemax Miner v2.0
 * Crawl stream data từ KKPhim / OPhim / NguonC → MongoDB Atlas
 *
 * Cách dùng:
 *   node miner.cjs                         # Sync 5 trang từ tất cả nguồn
 *   node miner.cjs --source kkphim         # Chỉ sync KKPhim
 *   node miner.cjs --source ophim --pages 10
 *   node miner.cjs --all                   # Sync toàn bộ (tất cả trang)
 *   node miner.cjs --watch 60              # Auto sync mỗi 60 phút
 *   node miner.cjs --stats                 # Chỉ xem thống kê DB
 */

const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const MONGODB_URI = process.env.MONGODB_URI ||
  'mongodb://cykablyatt1505_db_user:cxnCVvtZDwe3Y71h@ac-ouqwte0-shard-00-00.axhiwhx.mongodb.net:27017,ac-ouqwte0-shard-00-01.axhiwhx.mongodb.net:27017,ac-ouqwte0-shard-00-02.axhiwhx.mongodb.net:27017/cinemax?authSource=admin&replicaSet=atlas-aobgkq-shard-0&tls=true';

const SOURCES = {
  kkphim: {
    label: 'KKPhim',
    color: '\x1b[36m',   // cyan
    listUrl: (page) => `https://phimapi.com/danh-sach/phim-moi-cap-nhat?page=${page}`,
    detailUrl: (slug) => `https://phimapi.com/phim/${slug}`,
    referer: 'https://phimapi.com/',
    parseList: (d) => d.items || [],
    parseDetail: (d) => ({ movie: d.movie, episodes: d.episodes || [] }),
    totalPages: (d) => {
      const p = d.paginate || d.pagination || {};
      return parseInt(p.total_page || p.totalPages || p.total_pages || '100', 10);
    },
  },
  ophim: {
    label: 'OPhim',
    color: '\x1b[33m',   // yellow
    listUrl: (page) => `https://ophim1.com/danh-sach/phim-moi-cap-nhat?page=${page}`,
    detailUrl: (slug) => `https://ophim1.com/phim/${slug}`,
    referer: 'https://ophim1.com/',
    parseList: (d) => d.items || d.data?.items || [],
    parseDetail: (d) => ({ movie: d.movie, episodes: d.episodes || [] }),
    totalPages: (d) => {
      const p = d.paginate || d.pagination || {};
      return parseInt(p.total_page || p.totalPages || '100', 10);
    },
  },
  nguonc: {
    label: 'NguonC',
    color: '\x1b[35m',   // magenta
    listUrl: (page) => `https://phim.nguonc.com/api/films/phim-moi-cap-nhat?page=${page}`,
    detailUrl: (slug) => `https://phim.nguonc.com/api/film/${slug}`,
    referer: 'https://phim.nguonc.com/',
    parseList: (d) => d.data?.items || d.items || [],
    parseDetail: (d) => {
      const movie = d.movie || d;
      const eps = (d.movie?.episodes || d.episodes || []).map(s => ({
        server_name: s.server_name || s.name || 'Server',
        server_data: (s.items || s.server_data || []).map(ep => ({
          name: ep.name || ep.slug,
          link_m3u8: ep.m3u8 || ep.link_m3u8 || '',
          link_embed: ep.embed || ep.link_embed || '',
        })),
      }));
      return { movie, episodes: eps };
    },
    totalPages: (d) => {
      const p = d.paginate || d.data?.paginate || {};
      return parseInt(p.total_page || p.totalPages || '100', 10);
    },
  },
};

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
};
const hasFlag = (flag) => args.includes(flag);

const SOURCE_ARG = getArg('--source');     // 'kkphim' | 'ophim' | 'nguonc'
const PAGES_ARG  = parseInt(getArg('--pages') || '5', 10);
const ALL_ARG    = hasFlag('--all');        // sync tất cả trang
const WATCH_ARG  = parseInt(getArg('--watch') || '0', 10);  // interval phút
const STATS_ONLY = hasFlag('--stats');
const CONCURRENCY = parseInt(getArg('--concurrency') || '3', 10);

const ACTIVE_SOURCES = SOURCE_ARG
  ? [SOURCE_ARG].filter(s => SOURCES[s])
  : Object.keys(SOURCES);

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------
const RESET  = '\x1b[0m';
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const BOLD   = '\x1b[1m';
const GRAY   = '\x1b[90m';

function ts() {
  return new Date().toLocaleTimeString('vi-VN');
}

function log(color, label, msg) {
  console.log(`${GRAY}[${ts()}]${RESET} ${color}${BOLD}[${label}]${RESET} ${msg}`);
}

function logOk(label, msg)  { log(GREEN, label, msg); }
function logErr(label, msg) { log(RED,   label, `❌ ${msg}`); }
function logInfo(label, msg){ log(GRAY,  label, msg); }

// ---------------------------------------------------------------------------
// HTTP fetch with timeout + retry
// ---------------------------------------------------------------------------
async function fetchJson(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120 Safari/537.36' },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === retries) throw err;
      await sleep(1000 * (i + 1));
    }
  }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Concurrency pool
// ---------------------------------------------------------------------------
async function pool(tasks, concurrency, fn) {
  const results = [];
  let i = 0;
  async function run() {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await fn(tasks[idx], idx).catch(e => ({ error: e.message }));
    }
  }
  await Promise.all(Array.from({ length: concurrency }, run));
  return results;
}

// ---------------------------------------------------------------------------
// Sync one source
// ---------------------------------------------------------------------------
async function syncSource(srcKey, db, { pages, syncAll }) {
  const src = SOURCES[srcKey];
  if (!src) { logErr('MINER', `Nguồn không hợp lệ: ${srcKey}`); return { movies: 0, streams: 0 }; }

  const moviesCol  = db.collection('movies');
  const streamsCol = db.collection('streams');

  let totalMovies = 0;
  let totalStreams = 0;
  let maxPages = pages;

  logOk(src.label, `Bắt đầu crawl (${syncAll ? 'TẤT CẢ trang' : `${pages} trang`}, concurrency=${CONCURRENCY})...`);

  for (let page = 1; page <= maxPages; page++) {
    let listData;
    try {
      listData = await fetchJson(src.listUrl(page));
    } catch (err) {
      logErr(src.label, `Trang ${page}: ${err.message}`);
      continue;
    }

    // Xác định tổng số trang khi syncAll
    if (syncAll && page === 1) {
      maxPages = src.totalPages(listData);
      logInfo(src.label, `Tổng số trang: ${maxPages}`);
    }

    const items = src.parseList(listData);
    if (!items.length) { logInfo(src.label, `Trang ${page}: trống → dừng.`); break; }

    logInfo(src.label, `Trang ${page}/${maxPages} — ${items.length} phim`);

    // Crawl parallel theo concurrency
    await pool(items, CONCURRENCY, async (item) => {
      const slug = item.slug;
      if (!slug) return;

      let detailData;
      try {
        detailData = await fetchJson(src.detailUrl(slug));
      } catch (err) {
        logErr(src.label, `Detail '${slug}': ${err.message}`);
        return;
      }

      const { movie, episodes } = src.parseDetail(detailData);
      if (!movie) return;

      // Upsert movie
      await moviesCol.updateOne(
        { slug: movie.slug || slug },
        { $set: {
          slug:        movie.slug || slug,
          title:       movie.name || item.name || slug,
          originTitle: movie.origin_name || '',
          year:        parseInt(movie.year) || 0,
          type:        movie.type || 'series',
          status:      movie.episode_current || movie.status || 'ongoing',
          thumbUrl:    movie.thumb_url || '',
          posterUrl:   movie.poster_url || '',
          source:      srcKey,
          updatedAt:   new Date(),
        }},
        { upsert: true }
      );
      totalMovies++;

      // Upsert streams
      let epCount = 0;
      for (const server of episodes) {
        const serverName = (server.server_name || 'Server').replace(/\s*#\d+/g, '');
        for (const ep of (server.server_data || [])) {
          const streamUrl = ep.link_m3u8 || ep.link_embed || '';
          if (!streamUrl) continue;
          await streamsCol.updateOne(
            { slug: movie.slug || slug, server: serverName, episode: ep.name },
            { $set: {
              slug:      movie.slug || slug,
              title:     movie.name || slug,
              server:    serverName,
              episode:   ep.name || '1',
              streamUrl,
              isEmbed:   !ep.link_m3u8,
              referer:   src.referer,
              source:    srcKey,
              updatedAt: new Date(),
            }},
            { upsert: true }
          );
          epCount++;
        }
      }
      totalStreams += epCount;
      logOk(src.label, `✓ ${movie.name || slug} — ${epCount} streams`);
    });

    // Rate limit giữa các trang
    await sleep(400);
  }

  logOk(src.label, `Hoàn tất: ${totalMovies} phim, ${totalStreams} streams.`);
  return { movies: totalMovies, streams: totalStreams };
}

// ---------------------------------------------------------------------------
// Print stats
// ---------------------------------------------------------------------------
async function printStats(db) {
  const movies  = await db.collection('movies').countDocuments();
  const streams = await db.collection('streams').countDocuments();
  const bySource = await db.collection('movies').aggregate([
    { $group: { _id: '$source', count: { $sum: 1 } } }
  ]).toArray();

  console.log(`\n${BOLD}╔══════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}║       CINEMAX MINER — DB STATS       ║${RESET}`);
  console.log(`${BOLD}╚══════════════════════════════════════╝${RESET}`);
  console.log(`  📽  Movies  : ${GREEN}${movies}${RESET}`);
  console.log(`  🎞  Streams : ${GREEN}${streams}${RESET}`);
  bySource.forEach(s => console.log(`  └─ ${s._id || 'unknown'}: ${s.count} phim`));
  console.log('');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function run() {
  console.log(`\n${BOLD}${GREEN}
  ██████╗██╗███╗   ██╗███████╗███╗   ███╗ █████╗ ██╗  ██╗
 ██╔════╝██║████╗  ██║██╔════╝████╗ ████║██╔══██╗╚██╗██╔╝
 ██║     ██║██╔██╗ ██║█████╗  ██╔████╔██║███████║ ╚███╔╝ 
 ██║     ██║██║╚██╗██║██╔══╝  ██║╚██╔╝██║██╔══██║ ██╔██╗ 
 ╚██████╗██║██║ ╚████║███████╗██║ ╚═╝ ██║██║  ██║██╔╝ ██╗
  ╚═════╝╚═╝╚═╝  ╚═══╝╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝
         MINER v2.0 — KKPhim + OPhim + NguonC → MongoDB
${RESET}`);

  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  try {
    logInfo('DB', 'Đang kết nối MongoDB Atlas...');
    await client.connect();
    const db = client.db('cinemax');
    logOk('DB', `Kết nối thành công → DB: ${db.databaseName}`);

    // Tạo indexes
    await db.collection('movies').createIndex({ slug: 1 }, { unique: true });
    await db.collection('streams').createIndex({ slug: 1, server: 1, episode: 1 });
    await db.collection('movies').createIndex({ title: 'text', originTitle: 'text' });

    if (STATS_ONLY) {
      await printStats(db);
      await client.close();
      return;
    }

    const runOnce = async () => {
      const start = Date.now();
      let totalMovies = 0;
      let totalStreams = 0;

      console.log(`\n${BOLD}Nguồn: ${ACTIVE_SOURCES.join(', ')} | Trang: ${ALL_ARG ? 'TẤT CẢ' : PAGES_ARG} | Concurrency: ${CONCURRENCY}${RESET}\n`);

      const results = await Promise.all(
        ACTIVE_SOURCES.map(src => syncSource(src, db, { pages: PAGES_ARG, syncAll: ALL_ARG }))
      );
      for (const result of results) {
        totalMovies  += result.movies;
        totalStreams  += result.streams;
      }

      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      await printStats(db);
      logOk('MINER', `Tổng kết: ${totalMovies} phim mới, ${totalStreams} streams. Thời gian: ${elapsed}s`);
    };

    await runOnce();

    if (WATCH_ARG > 0) {
      logInfo('MINER', `Chế độ watch: tự sync lại sau ${WATCH_ARG} phút...`);
      setInterval(async () => {
        logInfo('MINER', `Auto-sync bắt đầu...`);
        await runOnce();
      }, WATCH_ARG * 60 * 1000);
    } else {
      await client.close();
    }
  } catch (err) {
    logErr('MINER', `Lỗi nghiêm trọng: ${err.message}`);
    await client.close();
    process.exit(1);
  }
}

run();
