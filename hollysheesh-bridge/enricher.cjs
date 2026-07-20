/**
 * enricher.cjs — Turbo TMDB Match Pipeline cho Cinemax DB
 *
 * Strategy: TMDB search-text trực tiếp (không cần Groq AI)
 * - Nhiều TMDB token song song (mỗi token rate-limit độc lập)
 * - N workers thực sự parallel (không xếp hàng)
 * - Batch MongoDB updateMany để giảm round-trips
 * - Bỏ Gemini embedding (slow path)
 *
 * Usage:
 *   node enricher.cjs                    # Enrich tất cả phim chưa có tmdbId
 *   node enricher.cjs --limit=5000       # Chỉ làm 5000 phim
 *   node enricher.cjs --workers=64       # Override worker count
 *   node enricher.cjs --re-enrich        # Làm lại kể cả phim đã enrich
 *   node enricher.cjs --watch            # Lặp lại mỗi 30 phút
 */
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
require('dotenv').config({ path: require('path').join(__dirname, '.env'), override: false });

const { MongoClient } = require('mongodb');

// ─── Config ────────────────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI;

// Hỗ trợ nhiều TMDB tokens — mỗi token 50 req/s rate limit riêng
// VITE_TMDB_ACCESS_TOKEN,TMDB_TOKEN_2,TMDB_TOKEN_3,...
const TMDB_TOKENS = [
  process.env.VITE_TMDB_ACCESS_TOKEN,
  process.env.TMDB_TOKEN_2,
  process.env.TMDB_TOKEN_3,
  process.env.TMDB_TOKEN_4,
  process.env.TMDB_TOKEN_5,
].filter(Boolean);

const args        = process.argv.slice(2);
const LIMIT       = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0');
const RE_ENRICH   = args.includes('--re-enrich');
const WATCH       = args.includes('--watch');
const ARG_WORKERS = parseInt(args.find(a => a.startsWith('--workers='))?.split('=')[1] || '0');

// TMDB cho phép ~40 req/s per token. 1 worker ~200ms/phim (2 TMDB calls).
// 4 tokens × 20 workers/token = 80 workers → ~400 phim/s lý thuyết
// Thực tế network latency: 60-100ms/call → ~20 phim/s/token
const WORKERS_PER_TOKEN = 16;
const WORKERS = ARG_WORKERS || (TMDB_TOKENS.length * WORKERS_PER_TOKEN);
const BATCH_WRITE_SIZE = 100; // Gom bulk write sau mỗi 100 kết quả
const WATCH_INTERVAL_MIN = 30;

// ─── Logger ─────────────────────────────────────────────────────────────────
const C = {
  reset:'\x1b[0m', green:'\x1b[32m', red:'\x1b[31m',
  yellow:'\x1b[33m', cyan:'\x1b[36m', gray:'\x1b[90m', bold:'\x1b[1m',
};
const ts    = () => new Date().toLocaleTimeString('vi-VN');
const logFn = (clr, tag, msg) => console.log(C.gray+'['+ts()+']'+C.reset+' '+clr+C.bold+'['+tag+']'+C.reset+' '+msg);
const ok    = (tag, msg) => logFn(C.green,  tag, '✓ '+msg);
const er    = (tag, msg) => logFn(C.red,    tag, '✗ '+msg);
const inf   = (tag, msg) => logFn(C.cyan,   tag, msg);
const wrn   = (tag, msg) => logFn(C.yellow, tag, '⚠ '+msg);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Token pool (round-robin + per-token rate limiting) ──────────────────────
class TokenPool {
  constructor(tokens) {
    this.tokens  = tokens;
    this.index   = 0;
    // TMDB: 50 req/s per token → min 20ms between requests per token
    this.lastUsed = tokens.map(() => 0);
    this.MIN_GAP  = 25; // 25ms = 40 req/s per token (conservative)
    this.locks    = tokens.map(() => Promise.resolve());
  }

  async acquire() {
    const idx = this.index % this.tokens.length;
    this.index++;

    // Serialize access per token slot
    let resolve;
    const prev = this.locks[idx];
    this.locks[idx] = new Promise(r => { resolve = r; });
    await prev;

    const wait = Math.max(0, this.lastUsed[idx] + this.MIN_GAP - Date.now());
    if (wait > 0) await sleep(wait);
    this.lastUsed[idx] = Date.now();

    resolve();
    return this.tokens[idx];
  }
}

// ─── TMDB Search + Verify ────────────────────────────────────────────────────
async function tmdbSearch(pool, query, type, year) {
  const token    = await pool.acquire();
  const endpoint = type === 'series' ? 'tv' : 'movie';
  const url = 'https://api.themoviedb.org/3/search/' + endpoint
    + '?query=' + encodeURIComponent(query)
    + (year ? '&year=' + year : '')
    + '&language=vi&include_adult=false&page=1';

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 429) {
        wrn('TMDB', 'Rate limited — chờ 5s...');
        await sleep(5000);
        continue;
      }
      if (!res.ok) return null;
      const d = await res.json();
      return d.results || [];
    } catch (e) {
      if (attempt === 2) return null;
      await sleep(500 * (attempt + 1));
    }
  }
  return null;
}

async function tmdbExternalIds(pool, tmdbId, type) {
  const token    = await pool.acquire();
  const endpoint = type === 'series' ? 'tv' : 'movie';
  try {
    const res = await fetch(`https://api.themoviedb.org/3/${endpoint}/${tmdbId}/external_ids`, {
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const d = await res.json();
    return { tmdbId: String(tmdbId), imdbId: d.imdb_id || null };
  } catch (_) { return null; }
}

// ─── String similarity (no deps) ────────────────────────────────────────────
function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordOverlap(a, b) {
  const wa = new Set(normalize(a).split(' ').filter(Boolean));
  const wb = new Set(normalize(b).split(' ').filter(Boolean));
  if (!wa.size || !wb.size) return 0;
  let common = 0;
  for (const w of wa) if (wb.has(w)) common++;
  return common / Math.max(wa.size, wb.size);
}

function scoreResult(result, movie) {
  let score = 0;
  const tmdbTitle    = result.title || result.name || '';
  const tmdbOriginal = result.original_title || result.original_name || '';
  const tmdbYear     = parseInt((result.release_date || result.first_air_date || '').substring(0, 4)) || 0;
  const movieYear    = parseInt(movie.year) || 0;

  // Title overlap
  const overlapVi   = wordOverlap(movie.title, tmdbTitle);
  const overlapEn   = wordOverlap(movie.originTitle, tmdbOriginal);
  const overlapCross = wordOverlap(movie.originTitle, tmdbTitle);
  score += Math.max(overlapVi, overlapEn, overlapCross) * 60;

  // Year match
  if (movieYear && tmdbYear) {
    const diff = Math.abs(movieYear - tmdbYear);
    if (diff === 0) score += 30;
    else if (diff === 1) score += 15;
    else if (diff <= 2) score += 5;
    else score -= 20;
  }

  // Popularity boost (log scale)
  if (result.popularity) score += Math.min(10, Math.log(result.popularity + 1));

  return score;
}

// ─── Enrich single movie ─────────────────────────────────────────────────────
async function enrichMovie(movie, pool) {
  const { slug, title, originTitle, year, type } = movie;

  // Try queries in priority order: originTitle, title, both
  const queries = [];
  if (originTitle && originTitle !== title) queries.push(originTitle);
  if (title) queries.push(title);
  // Fallback: search without year constraint
  if (originTitle) queries.push({ q: originTitle, noYear: true });

  let bestResult = null;
  let bestScore  = -Infinity;

  for (const q of queries) {
    const query   = typeof q === 'string' ? q : q.q;
    const useYear = typeof q === 'string' ? true : !q.noYear;
    const results = await tmdbSearch(pool, query, type, useYear ? year : null);
    if (!results || results.length === 0) continue;

    for (const r of results.slice(0, 5)) { // Only check top 5
      const s = scoreResult(r, movie);
      if (s > bestScore) { bestScore = s; bestResult = r; }
    }

    if (bestScore >= 50) break; // Good enough — stop trying more queries
  }

  if (!bestResult || bestScore < 30) return null;

  // Get imdbId
  const ext = await tmdbExternalIds(pool, bestResult.id, type);
  return {
    slug,
    tmdbId: String(bestResult.id),
    imdbId: ext?.imdbId || null,
    score:  bestScore,
  };
}

// ─── Async queue consumer ────────────────────────────────────────────────────
async function workerLoop(id, getNext, pool, stats, writeBuffer) {
  while (true) {
    const movie = getNext();
    if (!movie) break;

    stats.active++;
    try {
      const result = await enrichMovie(movie, pool);
      if (result) {
        stats.enriched++;
        writeBuffer.push(result);
      } else {
        stats.skipped++;
      }
    } catch (e) {
      er('W' + id, movie.slug + ': ' + e.message);
      stats.failed++;
    }
    stats.active--;
    stats.done++;
  }
}

// ─── Flush write buffer to MongoDB ──────────────────────────────────────────
async function flushBuffer(col, writeBuffer, stats) {
  if (writeBuffer.length === 0) return;
  const batch = writeBuffer.splice(0, writeBuffer.length);
  const ops   = batch.map(r => ({
    updateOne: {
      filter: { slug: r.slug },
      update: { $set: { tmdbId: r.tmdbId, imdbId: r.imdbId, enrichedAt: new Date(), _matchScore: r.score } },
    },
  }));
  try {
    await col.bulkWrite(ops, { ordered: false });
    stats.written += ops.length;
  } catch (e) {
    wrn('DB', 'bulkWrite partial fail: ' + e.message);
  }
}

// ─── Main run ────────────────────────────────────────────────────────────────
async function run() {
  if (!MONGODB_URI)            { er('ENRICHER', 'MONGODB_URI không có'); process.exit(1); }
  if (TMDB_TOKENS.length === 0){ er('ENRICHER', 'Không có TMDB token nào (VITE_TMDB_ACCESS_TOKEN)'); process.exit(1); }

  inf('ENRICHER', `TMDB tokens: ${TMDB_TOKENS.length} | Workers: ${WORKERS} | Batch: ${BATCH_WRITE_SIZE}`);
  inf('ENRICHER', `Estimated throughput: ~${(TMDB_TOKENS.length * WORKERS_PER_TOKEN * 2).toFixed(0)} phim/phút`);

  const pool   = new TokenPool(TMDB_TOKENS);
  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const col = client.db('cinemax').collection('movies');

  const doRun = async () => {
    const query = RE_ENRICH
      ? {}
      : { $or: [{ tmdbId: { $exists: false } }, { tmdbId: null }] };

    const total = await col.countDocuments(query);
    if (!total) { ok('ENRICHER', 'Không còn phim nào cần enrich.'); return; }
    const lim = LIMIT > 0 ? LIMIT : total;
    inf('ENRICHER', `${total} phim cần enrich — xử lý ${lim} phim với ${WORKERS} workers`);

    const queue = await col
      .find(query, { projection: { slug: 1, title: 1, originTitle: 1, year: 1, type: 1 } })
      .limit(lim)
      .toArray();

    let qIdx = 0;
    const getNext = () => queue[qIdx++] || null;

    const stats = { done: 0, enriched: 0, skipped: 0, failed: 0, active: 0, written: 0 };
    const writeBuffer = [];

    // Periodic flush + progress display
    const start   = Date.now();
    const monitor = setInterval(async () => {
      await flushBuffer(col, writeBuffer, stats);
      const elapsed = (Date.now() - start) / 1000;
      const rate    = elapsed > 0 ? (stats.done / elapsed * 60).toFixed(0) : '0';
      const eta     = stats.done > 0 ? Math.round((lim - stats.done) / (stats.done / elapsed) / 60) : '?';
      inf('PROGRESS', `${stats.done}/${lim} | ✓${stats.enriched} skip:${stats.skipped} ✗${stats.failed} | ${rate} phim/min | ETA: ${eta}min`);
    }, 5000);

    await Promise.all(
      Array.from({ length: WORKERS }, (_, i) => workerLoop(i + 1, getNext, pool, stats, writeBuffer))
    );

    clearInterval(monitor);
    await flushBuffer(col, writeBuffer, stats); // Final flush
    const totalSec = ((Date.now() - start) / 1000).toFixed(0);
    ok('ENRICHER', `Xong trong ${totalSec}s! ✓${stats.enriched} match | skip:${stats.skipped} | ✗${stats.failed} | ghi DB:${stats.written}`);
  };

  if (WATCH) {
    inf('ENRICHER', 'Watch mode — lặp mỗi ' + WATCH_INTERVAL_MIN + ' phút');
    // eslint-disable-next-line no-constant-condition
    while (true) { await doRun(); await sleep(WATCH_INTERVAL_MIN * 60 * 1000); }
  } else {
    await doRun();
    await client.close();
  }
}

run().catch(e => { er('FATAL', e.message); console.error(e); process.exit(1); });
