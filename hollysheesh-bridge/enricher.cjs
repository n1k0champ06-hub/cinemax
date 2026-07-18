/**
 * enricher.cjs — AI Enrichment Pipeline cho Cinemax DB
 *
 * Groq (llama-3.3-70b) match title→tmdbId + TMDB verify + Gemini Embedding
 * Chạy 3 worker song song, rate-limit tự động tránh 429.
 *
 * Usage:
 *   node enricher.cjs               # Enrich tất cả phim chưa có tmdbId
 *   node enricher.cjs --limit=500   # Chỉ làm 500 phim
 *   node enricher.cjs --watch       # Lặp lại mỗi 30 phút
 *   node enricher.cjs --re-enrich   # Làm lại kể cả phim đã enrich
 */
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
require('dotenv').config({ path: require('path').join(__dirname, '.env'), override: false });

const { MongoClient } = require('mongodb');

const MONGODB_URI    = process.env.MONGODB_URI;
const GROQ_API_KEY   = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TMDB_TOKEN     = process.env.VITE_TMDB_ACCESS_TOKEN;

// Groq free: 30 req/min → 2.1s/req
const GROQ_INTERVAL_MS   = 2100;
const GEMINI_INTERVAL_MS = 1500;
const WORKERS            = 3;
const WATCH_INTERVAL_MIN = 30;

const args      = process.argv.slice(2);
const LIMIT     = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0');
const WATCH     = args.includes('--watch');
const RE_ENRICH = args.includes('--re-enrich');

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Rate limiter
// ---------------------------------------------------------------------------
function makeLimiter(intervalMs) {
  let last = 0;
  return async () => {
    const wait = Math.max(0, last + intervalMs - Date.now());
    if (wait > 0) await sleep(wait);
    last = Date.now();
  };
}
const groqLim   = makeLimiter(GROQ_INTERVAL_MS);
const geminiLim = makeLimiter(GEMINI_INTERVAL_MS);

// ---------------------------------------------------------------------------
// Groq AI Matcher
// ---------------------------------------------------------------------------
async function resolveWithGroq(title, originTitle, year, type) {
  if (!GROQ_API_KEY) return null;
  await groqLim();

  const prompt = [
    'You are a professional movie database expert. Match this movie/series to its exact TMDB record.',
    '',
    'Input:',
    '- Vietnamese title: "' + title + '"',
    '- Original/English title: "' + originTitle + '"',
    '- Scraped year: ' + year,
    '- Type: ' + (type === 'series' ? 'tv series' : 'movie'),
    '',
    'Rules:',
    '- Focus on the original English/international title',
    '- TMDB ID must be exact — if not 100% sure, set to null',
    '- Year is the first air/release year on TMDB',
    '',
    'Respond with ONLY valid JSON (no markdown, no extra text):',
    '{ "tmdb_id": "string or null", "title": "string", "titleVi": "string", "year": number, "confidence": number }',
  ].join('\n');

  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_API_KEY },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (res.status === 429) { wrn('GROQ', 'Rate limited — chờ 65s...'); await sleep(65000); continue; }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error('Empty response');
      return JSON.parse(text.trim());
    } catch (e) {
      if (i === 2) { wrn('GROQ', 'Failed: ' + e.message); return null; }
      await sleep(2000 * (i + 1));
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// TMDB Verify → also gets imdbId
// ---------------------------------------------------------------------------
async function verifyWithTmdb(tmdbId, type) {
  if (!TMDB_TOKEN || !tmdbId) return null;
  const endpoint = type === 'series' ? 'tv' : 'movie';
  try {
    const res = await fetch('https://api.themoviedb.org/3/' + endpoint + '/' + tmdbId + '/external_ids', {
      headers: { Authorization: 'Bearer ' + TMDB_TOKEN, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const d = await res.json();
    return { tmdbId: String(tmdbId), imdbId: d.imdb_id || null };
  } catch (_) { return null; }
}

// ---------------------------------------------------------------------------
// Gemini Embedding
// ---------------------------------------------------------------------------
async function generateEmbedding(text) {
  if (!GEMINI_API_KEY) return null;
  await geminiLim();
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=' + GEMINI_API_KEY;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/gemini-embedding-2',
          content: { parts: [{ text: text.slice(0, 2000) }] },
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 429) { wrn('GEMINI', 'Quota hit — chờ 30s...'); await sleep(30000); continue; }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const d = await res.json();
      return d.embedding?.values || null;
    } catch (e) {
      if (i === 2) { wrn('GEMINI', 'Embedding failed: ' + e.message); return null; }
      await sleep(2000 * (i + 1));
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Enrich one movie
// ---------------------------------------------------------------------------
async function enrichMovie(movie, col) {
  const { slug, title, originTitle, year, type, content, category } = movie;
  const upd = {};
  let changed = false;

  // Step 1: Groq AI match
  const ai = await resolveWithGroq(title, originTitle, year, type);
  if (ai && ai.confidence >= 0.7 && ai.tmdb_id) {
    // Step 2: TMDB verify → get imdbId
    const v = await verifyWithTmdb(ai.tmdb_id, type);
    upd.tmdbId = v ? v.tmdbId : String(ai.tmdb_id);
    upd.imdbId = v ? v.imdbId : null;
    upd.aiConf = ai.confidence;
    if (ai.title)   upd.originTitle = ai.title;
    if (ai.titleVi) upd.title       = ai.titleVi;
    if (ai.year)    upd.year        = ai.year;
    ok('ENRICH', slug + ' → tmdb:' + upd.tmdbId + ' imdb:' + (upd.imdbId || 'n/a') + ' conf:' + ai.confidence.toFixed(2));
    changed = true;
  } else if (ai) {
    wrn('ENRICH', slug + ' — conf thấp (' + (ai.confidence?.toFixed(2) || '?') + '), bỏ qua');
  }

  // Step 3: Gemini embedding
  const clean = (content || '').replace(/<[^>]*>/g, '').trim();
  if (clean) {
    const catStr = Array.isArray(category) ? category.join(', ') : '';
    const textToEmbed = [
      (upd.title || title),
      ' (' + (upd.originTitle || originTitle) + ' - ' + (upd.year || year) + ').',
      ' Thể loại: ' + catStr + '.',
      ' Nội dung: ' + clean,
    ].join('');
    const emb = await generateEmbedding(textToEmbed);
    if (emb) { upd.embedding = emb; changed = true; }
  }

  // Step 4: Save
  if (changed) {
    upd.enrichedAt = new Date();
    await col.updateOne({ slug }, { $set: upd });
  }
  return changed;
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------
async function worker(id, queue, col, stats) {
  while (queue.length > 0) {
    const movie = queue.shift();
    if (!movie) break;
    stats.active++;
    try {
      const enriched = await enrichMovie(movie, col);
      if (enriched) stats.enriched++; else stats.skipped++;
    } catch (e) {
      er('W' + id, movie.slug + ': ' + e.message);
      stats.failed++;
    }
    stats.active--;
    stats.done++;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function run() {
  if (!MONGODB_URI) { er('ENRICHER', 'MONGODB_URI không có'); process.exit(1); }
  if (!GROQ_API_KEY && !GEMINI_API_KEY) { er('ENRICHER', 'Không có API key nào'); process.exit(1); }

  console.log(C.green + C.bold + [
    '',
    '  ███████╗███╗   ██╗██████╗ ██╗ ██████╗██╗  ██╗███████╗██████╗ ',
    '  ██╔════╝████╗  ██║██╔══██╗██║██╔════╝██║  ██║██╔════╝██╔══██╗',
    '  █████╗  ██╔██╗ ██║██████╔╝██║██║     ███████║█████╗  ██████╔╝',
    '  ██╔══╝  ██║╚██╗██║██╔══██╗██║██║     ██╔══██║██╔══╝  ██╔══██╗',
    '  ███████╗██║ ╚████║██║  ██║██║╚██████╗██║  ██║███████╗██║  ██║',
    '  ╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝',
    '  AI Enrichment Pipeline v1.0 — Groq + Gemini + TMDB',
    '',
  ].join('\n') + C.reset);

  inf('ENRICHER', 'Groq:' + (GROQ_API_KEY ? '✓' : '✗') + ' | Gemini:' + (GEMINI_API_KEY ? '✓' : '✗') + ' | TMDB:' + (TMDB_TOKEN ? '✓' : '✗'));

  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const col = client.db('cinemax').collection('movies');

  const doRun = async () => {
    const query = RE_ENRICH
      ? {}
      : { $or: [{ tmdbId: { $exists: false } }, { tmdbId: null }, { embedding: { $exists: false } }] };

    const total = await col.countDocuments(query);
    if (!total) { ok('ENRICHER', 'Không còn phim nào cần enrich.'); return; }
    const lim = LIMIT > 0 ? LIMIT : total;
    inf('ENRICHER', total + ' phim cần enrich — xử lý ' + lim + ' (' + WORKERS + ' workers)');

    const queue = await col
      .find(query, { projection: { slug: 1, title: 1, originTitle: 1, year: 1, type: 1, content: 1, category: 1 }, limit: lim })
      .toArray();

    const stats = { done: 0, enriched: 0, skipped: 0, failed: 0, active: 0 };

    const prog = setInterval(() => {
      const pct = queue.length ? ((stats.done / queue.length) * 100).toFixed(1) : '0';
      inf('PROGRESS', stats.done + '/' + queue.length + ' (' + pct + '%) ✓' + stats.enriched + ' skip:' + stats.skipped + ' ✗' + stats.failed);
    }, 15000);

    await Promise.all(Array.from({ length: WORKERS }, (_, i) => worker(i + 1, queue, col, stats)));
    clearInterval(prog);
    ok('ENRICHER', 'Xong! Enriched:' + stats.enriched + ' | Skip:' + stats.skipped + ' | Err:' + stats.failed);
  };

  if (WATCH) {
    inf('ENRICHER', 'Watch mode — lặp mỗi ' + WATCH_INTERVAL_MIN + ' phút');
    await doRun();
    setInterval(async () => { inf('ENRICHER', 'Auto-cycle...'); await doRun(); }, WATCH_INTERVAL_MIN * 60 * 1000);
  } else {
    await doRun();
    await client.close();
  }
}

run().catch(e => { er('FATAL', e.message); process.exit(1); });
