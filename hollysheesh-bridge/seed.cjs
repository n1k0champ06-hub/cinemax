'use strict';
/**
 * Hollysheesh Real Scraper
 * Crawl stream URLs từ KKPhim & OPhim APIs → lưu vào MongoDB Atlas
 * Chạy: node seed.cjs [số_phim] (default: 20)
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI ||
  'mongodb://cykablyatt1505_db_user:cxnCVvtZDwe3Y71h@ac-ouqwte0-shard-00-00.axhiwhx.mongodb.net:27017,ac-ouqwte0-shard-00-01.axhiwhx.mongodb.net:27017,ac-ouqwte0-shard-00-02.axhiwhx.mongodb.net:27017/cinemax?authSource=admin&replicaSet=atlas-aobgkq-shard-0&tls=true';

const KKPHIM_API  = 'https://phimapi.com';
const OPHIM_API   = 'https://ophim1.com';

const LIMIT = parseInt(process.argv[2] || '20', 10);

// Delay để tránh rate-limit
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120 Safari/537.36' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

// Lấy danh sách phim mới nhất từ KKPhim
async function getKKPhimList(page = 1) {
  const data = await fetchJson(`${KKPHIM_API}/danh-sach/phim-moi-cap-nhat?page=${page}`);
  return (data.items || []).slice(0, LIMIT);
}

// Lấy chi tiết + stream URLs của 1 phim từ KKPhim
async function getKKPhimDetail(slug) {
  const data = await fetchJson(`${KKPHIM_API}/phim/${slug}`);
  return data;
}

// Lấy danh sách phim từ OPhim
async function getOPhimList(page = 1) {
  const data = await fetchJson(`${OPHIM_API}/api/v1/list/movie?page=${page}&limit=${LIMIT}`);
  return (data.data?.items || []).slice(0, LIMIT);
}

// Lấy chi tiết + stream URLs của 1 phim từ OPhim
async function getOPhimDetail(slug) {
  const data = await fetchJson(`${OPHIM_API}/api/v1/movie/${slug}`);
  return data;
}

async function main() {
  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db = client.db('cinemax');
  const moviesCol = db.collection('movies');
  const streamsCol = db.collection('streams');

  // Indexes
  await moviesCol.createIndex({ slug: 1 }, { unique: true });
  await streamsCol.createIndex({ slug: 1, server: 1, episode: 1 });

  let saved = 0;

  console.log(`[Seed] Bắt đầu crawl ${LIMIT} phim từ KKPhim...`);

  // === KKPhim ===
  let list = [];
  try { list = await getKKPhimList(1); } catch (e) { console.error('[KKPhim] List error:', e.message); }

  for (const item of list) {
    const slug = item.slug;
    if (!slug) continue;
    try {
      const detail = await getKKPhimDetail(slug);
      const movie = detail.movie || detail;
      const episodes = detail.episodes || [];

      // Upsert movie
      await moviesCol.updateOne(
        { slug },
        { $set: {
          slug,
          title: movie.name || item.name || slug,
          originTitle: movie.origin_name || '',
          year: parseInt(movie.year) || 0,
          type: movie.type || 'movie',
          status: movie.episode_current || 'full',
          poster: movie.poster_url || movie.thumb_url || '',
          updatedAt: new Date(),
          source: 'kkphim',
        }},
        { upsert: true }
      );

      // Upsert streams
      let streamCount = 0;
      for (const server of episodes) {
        const serverName = (server.server_name || 'Server').replace(/\s*#\d+/g, '');
        for (const ep of (server.server_data || [])) {
          if (!ep.link_m3u8 && !ep.link_embed) continue;
          await streamsCol.updateOne(
            { slug, server: serverName, episode: ep.name },
            { $set: {
              slug,
              title: movie.name || slug,
              server: serverName,
              episode: ep.name || '1',
              streamUrl: ep.link_m3u8 || ep.link_embed || '',
              isEmbed: !ep.link_m3u8,
              referer: 'https://phimapi.com/',
              updatedAt: new Date(),
              source: 'kkphim',
            }},
            { upsert: true }
          );
          streamCount++;
        }
      }

      console.log(`[KKPhim] ✅ ${movie.name || slug} — ${streamCount} streams`);
      saved++;
      await sleep(300);
    } catch (e) {
      console.error(`[KKPhim] ❌ ${slug}: ${e.message}`);
    }
  }

  console.log(`\n[Seed] Xong KKPhim. Đã lưu ${saved} phim.`);
  console.log('[Seed] Kiểm tra DB...');

  const totalMovies  = await moviesCol.countDocuments();
  const totalStreams  = await streamsCol.countDocuments();
  console.log(`[Seed] Movies: ${totalMovies} | Streams: ${totalStreams}`);

  // In ra vài slug mẫu để test
  const sampleMovies = await moviesCol.find({}).limit(5).toArray();
  console.log('\n[Seed] Slug mẫu để test Hollysheesh:');
  sampleMovies.forEach(m => console.log(`  - ${m.slug} (${m.title})`));

  await client.close();
}

main().catch(e => { console.error(e.message); process.exit(1); });
