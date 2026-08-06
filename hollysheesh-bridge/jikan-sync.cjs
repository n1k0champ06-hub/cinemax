'use strict';
/**
 * Anime SFW Sync — Fribb/anime-lists + Jikan rating check
 *
 * Strategy (không dùng Jikan search/list endpoints vì hay bị 504):
 *   1. Tải anime-list-mini.json từ Fribb/anime-lists (GitHub static file, 42k entries, có mal_id → themoviedb_id)
 *   2. Filter: chỉ lấy TV/OVA có mal_id VÀ themoviedb_id
 *   3. Sort theo anilist_id (proxy cho popularity — ID nhỏ = anime ra sớm, nổi tiếng hơn)
 *   4. Với từng entry, gọi Jikan /anime/{mal_id} (GET by ID — cached, ổn định dù MAL search bị chặn)
 *      → check rating field, skip nếu 'Rx - Hentai'
 *   5. Upsert vào MongoDB anime_sfw collection
 *
 * Chạy: node jikan-sync.cjs
 * Hoặc trigger qua POST /api/anime-sfw/sync
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI ||
  'mongodb://cykablyatt1505_db_user:cxnCVvtZDwe3Y71h@ac-ouqwte0-shard-00-00.axhiwhx.mongodb.net:27017,ac-ouqwte0-shard-00-01.axhiwhx.mongodb.net:27017,ac-ouqwte0-shard-00-02.axhiwhx.mongodb.net:27017/cinemax?authSource=admin&replicaSet=atlas-aobgkq-shard-0&tls=true&retryWrites=true&w=majority';

const FRIBB_URL  = 'https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-mini.json';
const JIKAN_BASE = 'https://api.jikan.moe/v4';

// Số lượng anime tối đa cần sync (đủ để fill các rows)
const MAX_ENTRIES = parseInt(process.env.ANIME_SFW_LIMIT || '500', 10);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchJson(url, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'CinemaxAnimeSync/1.0' },
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 429) {
        await sleep(2000 * (i + 1));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${url.slice(0, 80)}`);
      return await res.json();
    } catch (e) {
      if (i === retries) throw e;
      await sleep(1500 * (i + 1));
    }
  }
}

/**
 * Fetch Jikan details cho 1 anime theo mal_id
 * Endpoint /anime/{id} dùng cache riêng của Jikan → ổn định dù MAL search bị block
 * Returns null nếu không fetch được
 */
async function fetchJikanById(malId) {
  try {
    const data = await fetchJson(`${JIKAN_BASE}/anime/${malId}`);
    return data?.data || null;
  } catch (_) {
    return null;
  }
}

/**
 * Main sync function
 */
async function runSync() {
  console.log('[jikan-sync] Bắt đầu sync anime SFW...');
  console.log('[jikan-sync] Source: Fribb/anime-lists (GitHub) + Jikan rating check');

  // ── Step 1: Tải Fribb mapping ───────────────────────────────────────────────
  console.log('[jikan-sync] Đang tải Fribb anime-list-mini.json...');
  let fribbData;
  try {
    fribbData = await fetchJson(FRIBB_URL);
  } catch (e) {
    throw new Error(`Không thể tải Fribb data: ${e.message}`);
  }
  console.log(`[jikan-sync] Fribb: ${fribbData.length} entries tổng cộng`);

  // ── Step 2: Filter entries có đủ data ──────────────────────────────────────
  const validEntries = fribbData.filter(e =>
    e.mal_id &&
    e.themoviedb_id &&
    (e.themoviedb_id.tv || e.themoviedb_id.movie) &&
    ['TV', 'Movie', 'OVA', 'Special'].includes(e.type)
  );
  console.log(`[jikan-sync] Có TMDB ID: ${validEntries.length} entries`);

  // Sort: anilist_id nhỏ = anime cũ/nổi tiếng, ưu tiên TV trước
  validEntries.sort((a, b) => {
    // TV > Movie > OVA > Special về mức độ phổ biến với users
    const typeScore = { TV: 0, Movie: 1, OVA: 2, Special: 3 };
    const typeDiff = (typeScore[a.type] ?? 3) - (typeScore[b.type] ?? 3);
    if (typeDiff !== 0) return typeDiff;
    // Trong cùng type: anilist_id nhỏ hơn = nổi tiếng hơn
    return (a.anilist_id || 99999) - (b.anilist_id || 99999);
  });

  // Giới hạn số lượng cần check
  const toProcess = validEntries.slice(0, MAX_ENTRIES);
  console.log(`[jikan-sync] Sẽ process ${toProcess.length} entries (limit: ${MAX_ENTRIES})`);

  // ── Step 3: Connect MongoDB ─────────────────────────────────────────────────
  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db  = client.db('cinemax');
  const col = db.collection('anime_sfw');

  await col.createIndex({ mal_id: 1 }, { unique: true });
  await col.createIndex({ tmdb_id: 1 }, { sparse: true });
  await col.createIndex({ tmdb_type: 1 });
  await col.createIndex({ anilist_id: 1 }, { sparse: true });

  let upserted = 0;
  let skipped  = 0; // hentai Rx
  let noJikan  = 0; // Jikan call failed (lưu vào DB không có rating)

  // ── Step 4: Check từng entry với Jikan ─────────────────────────────────────
  for (let i = 0; i < toProcess.length; i++) {
    const entry = toProcess[i];
    const malId  = entry.mal_id;
    const tmdbTv = entry.themoviedb_id?.tv;
    const tmdbMovie = entry.themoviedb_id?.movie;
    const tmdbId   = tmdbTv || tmdbMovie;
    const tmdbType = tmdbTv ? 'tv' : 'movie';

    // Gọi Jikan để lấy rating — delay 400ms để tránh rate limit
    const jikan = await fetchJikanById(malId);
    await sleep(400);

    if (jikan) {
      const rating = jikan.rating || '';

      // Skip hentai (Rx)
      if (rating.startsWith('Rx')) {
        skipped++;
        if (i % 20 === 0) console.log(`[jikan-sync] [${i+1}/${toProcess.length}] Skip Rx: ${jikan.title}`);
        continue;
      }

      const genres = (jikan.genres || []).map(g => g.name);

      await col.updateOne(
        { mal_id: malId },
        { $set: {
          mal_id:     malId,
          tmdb_id:    String(tmdbId),
          tmdb_type:  tmdbType,
          anilist_id: entry.anilist_id || null,
          tvdb_id:    entry.tvdb_id || null,
          title:      jikan.title_english || jikan.title || '',
          title_ja:   jikan.title || '',
          type:       entry.type,
          rating:     rating,
          score:      jikan.score || 0,
          popularity: jikan.popularity || 9999,
          genres,
          mal_genres: (jikan.genres || []).map(g => g.mal_id),
          episodes:   jikan.episodes || null,
          year:       jikan.year || entry.anilist_id ? null : null,
          updatedAt:  new Date(),
        }},
        { upsert: true }
      );
      upserted++;
    } else {
      // Jikan call failed — lưu với data từ Fribb (không có rating, giả định SFW)
      noJikan++;
      await col.updateOne(
        { mal_id: malId },
        { $setOnInsert: {
          mal_id:     malId,
          tmdb_id:    String(tmdbId),
          tmdb_type:  tmdbType,
          anilist_id: entry.anilist_id || null,
          tvdb_id:    entry.tvdb_id || null,
          title:      '',
          title_ja:   '',
          type:       entry.type,
          rating:     'unknown',
          score:      0,
          popularity: 9999,
          genres:     [],
          mal_genres: [],
          updatedAt:  new Date(),
        }},
        { upsert: true }
      );
      upserted++;
    }

    if ((i + 1) % 50 === 0) {
      console.log(`[jikan-sync] Progress: ${i+1}/${toProcess.length} | upserted=${upserted} skipped=${skipped} no-jikan=${noJikan}`);
    }
  }

  const total    = await col.countDocuments();
  const withJikan = await col.countDocuments({ rating: { $ne: 'unknown' } });

  console.log('\n[jikan-sync] ✅ Done.');
  console.log(`  Tổng anime_sfw trong DB : ${total}`);
  console.log(`  Có Jikan rating         : ${withJikan}`);
  console.log(`  Upserted lần này        : ${upserted}`);
  console.log(`  Bị skip (Rx - Hentai)   : ${skipped}`);
  console.log(`  Jikan call failed       : ${noJikan}`);

  await client.close();
  return { total, withJikan, upserted, skipped, noJikan };
}

if (require.main === module) {
  runSync()
    .then(r => { console.log('[jikan-sync] Result:', r); process.exit(0); })
    .catch(e => { console.error('[jikan-sync] Fatal:', e.message); process.exit(1); });
}

module.exports = { runSync };
