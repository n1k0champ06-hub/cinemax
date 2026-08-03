'use strict';
/**
 * Jikan SFW Anime Sync
 * Crawl anime SFW từ Jikan API → map mal_id → tmdb_id qua AniMapper → lưu MongoDB anime_sfw
 *
 * Chạy thủ công: node jikan-sync.cjs
 * Hoặc được gọi từ cron qua server.cjs /api/anime-sfw/sync
 *
 * Rate limits:
 *   Jikan: ~3 req/s (built-in delay)
 *   AniMapper: ~5 req/s
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI ||
  'mongodb://cykablyatt1505_db_user:cxnCVvtZDwe3Y71h@ac-ouqwte0-shard-00-00.axhiwhx.mongodb.net:27017,ac-ouqwte0-shard-00-01.axhiwhx.mongodb.net:27017,ac-ouqwte0-shard-00-02.axhiwhx.mongodb.net:27017/cinemax?authSource=admin&replicaSet=atlas-aobgkq-shard-0&tls=true&retryWrites=true&w=majority';

const JIKAN_BASE    = 'https://api.jikan.moe/v4';
const ANIMAPPER_BASE = 'https://armkai.vercel.app/api';

// Số trang Jikan cần sync (25 items/page → 10 pages = 250 anime SFW phổ biến nhất)
const MAX_PAGES = parseInt(process.env.JIKAN_SYNC_PAGES || '10', 10);

// Thể loại Jikan cần sync (genre IDs MAL)
// 1=Action, 2=Adventure, 4=Comedy, 7=Mystery, 8=Drama, 10=Fantasy, 22=Romance, 37=Supernatural
const GENRE_BATCHES = [
  { genres: '',                label: 'popular' },   // Top phổ biến không filter genre
  { genres: '1',              label: 'action' },
  { genres: '10',             label: 'fantasy' },
  { genres: '22',             label: 'romance' },
  { genres: '4',              label: 'comedy' },
  { genres: '4,8',            label: 'kids' },       // Comedy + Drama → anime kids/family
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchJson(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(12000),
      });
      if (res.status === 429) {
        // Jikan rate limit — back off 2s
        await sleep(2000);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
      return await res.json();
    } catch (e) {
      if (i === retries) throw e;
      await sleep(1000 * (i + 1));
    }
  }
}

/**
 * Fetch một trang SFW anime từ Jikan
 * @param {number} page
 * @param {string} genres  - comma-separated MAL genre IDs (empty = no filter)
 * @param {string} orderBy - popularity | score | rank
 */
async function fetchJikanPage(page, genres = '', orderBy = 'popularity') {
  const params = new URLSearchParams({
    page:     String(page),
    limit:    '25',
    sfw:      'true',
    order_by: orderBy,
    sort:     'desc',
  });
  if (genres) params.set('genres', genres);

  const data = await fetchJson(`${JIKAN_BASE}/anime?${params}`);
  return {
    items:       data.data || [],
    hasNextPage: data.pagination?.has_next_page || false,
  };
}

/**
 * Map mal_id → tmdb_id qua AniMapper REST API
 * Returns null nếu không tìm thấy
 */
async function mapMalToTmdb(malId) {
  try {
    const data = await fetchJson(`${ANIMAPPER_BASE}/search?type=anime&id=${malId}`);
    // AniMapper trả về mappings array hoặc single object
    const mappings = Array.isArray(data) ? data : (data.mappings || [data]);
    for (const m of mappings) {
      const tmdbId = m?.tmdb_id || m?.theMovieDb || m?.themoviedb;
      if (tmdbId) return String(tmdbId);
    }
    return null;
  } catch (_) {
    return null;
  }
}

/**
 * Main sync function — có thể được gọi từ cron
 */
async function runSync() {
  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db  = client.db('cinemax');
  const col = db.collection('anime_sfw');

  // Indexes
  await col.createIndex({ mal_id: 1 }, { unique: true });
  await col.createIndex({ tmdb_id: 1 }, { sparse: true });
  await col.createIndex({ genres: 1 });
  await col.createIndex({ updatedAt: 1 });

  let totalUpserted = 0;
  let totalSkipped  = 0;

  const syncedMalIds = new Set();

  for (const batch of GENRE_BATCHES) {
    console.log(`\n[jikan-sync] === Genre: ${batch.label} ===`);
    let page = 1;

    while (page <= MAX_PAGES) {
      let items, hasNextPage;
      try {
        ({ items, hasNextPage } = await fetchJikanPage(page, batch.genres));
      } catch (e) {
        console.error(`[jikan-sync] Jikan fetch error page ${page}:`, e.message);
        break;
      }

      if (!items.length) break;

      for (const item of items) {
        const malId = item.mal_id;
        if (!malId || syncedMalIds.has(malId)) continue;
        syncedMalIds.add(malId);

        // Jikan rating field: "Rx - Hentai", "R+ - Mild Nudity", "R - 17+", "PG-13", "PG", "G"
        // Chỉ lưu nếu KHÔNG phải Rx (hentai)
        const rating = item.rating || '';
        if (rating.startsWith('Rx')) {
          console.log(`[jikan-sync] Skip hentai: ${item.title} (${rating})`);
          totalSkipped++;
          continue;
        }

        // Map sang TMDB ID
        let tmdbId = null;
        try {
          tmdbId = await mapMalToTmdb(malId);
          await sleep(220); // ~4.5 req/s để tránh AniMapper rate limit
        } catch (_) {}

        const doc = {
          mal_id:       malId,
          tmdb_id:      tmdbId,                    // null nếu không map được
          title:        item.title_english || item.title || '',
          title_ja:     item.title || '',
          type:         item.type || 'TV',          // TV / Movie / OVA / Special
          rating:       rating,                     // G / PG / PG-13 / R / R+
          score:        item.score || 0,
          popularity:   item.popularity || 0,
          genres:       (item.genres || []).map(g => g.name),
          mal_genres:   (item.genres || []).map(g => g.mal_id),
          episodes:     item.episodes || null,
          year:         item.year || item.aired?.prop?.from?.year || null,
          status:       item.status || '',
          updatedAt:    new Date(),
        };

        await col.updateOne(
          { mal_id: malId },
          { $set: doc },
          { upsert: true }
        );
        totalUpserted++;

        if (totalUpserted % 20 === 0) {
          console.log(`[jikan-sync] Progress: ${totalUpserted} upserted, ${totalSkipped} skipped`);
        }

        // Jikan rate limit: 1 req / 350ms = ~2.8 req/s
        await sleep(350);
      }

      if (!hasNextPage) break;
      page++;
      await sleep(500);
    }
  }

  const total = await col.countDocuments();
  const withTmdb = await col.countDocuments({ tmdb_id: { $ne: null } });

  console.log(`\n[jikan-sync] Done.`);
  console.log(`  Tổng anime SFW trong DB: ${total}`);
  console.log(`  Có TMDB ID: ${withTmdb}`);
  console.log(`  Upserted lần này: ${totalUpserted}`);
  console.log(`  Bị skip (hentai/Rx): ${totalSkipped}`);

  await client.close();
  return { total, withTmdb, upserted: totalUpserted, skipped: totalSkipped };
}

// Chạy trực tiếp
if (require.main === module) {
  runSync()
    .then(r => { console.log('[jikan-sync] Result:', r); process.exit(0); })
    .catch(e => { console.error('[jikan-sync] Fatal:', e.message); process.exit(1); });
}

module.exports = { runSync };
