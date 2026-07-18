'use strict';

/**
 * Hollysheesh Bridge API
 * Routes:
 *   GET /health                      — health check
 *   GET /api/admin/scraper/streams   — MongoDB stream lookup
 *   GET /api/admin/scraper/stats     — DB stats
 *   GET /proxy/m3u8                  — HLS proxy (bypass Cloudflare IP block for VI CDNs)
 */

const http = require('http');
const urlModule = require('url');
const { MongoClient } = require('mongodb');

const PORT = process.env.PORT || 3099;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('[Bridge] MONGODB_URI env var is required!');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// MongoDB connection
// ---------------------------------------------------------------------------
let db = null;

async function connectDB() {
  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  db = client.db();
  console.log(`[Bridge] Connected to MongoDB: ${db.databaseName}`);
  return client;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function json(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function escapeRegex(str) {
  return str.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}

function getEpNum(str) {
  const num = String(str).toLowerCase().replace(/\D/g, '');
  return num ? parseInt(num, 10) : str;
}

// ---------------------------------------------------------------------------
// Route: GET /api/admin/scraper/streams
// ---------------------------------------------------------------------------
async function handleStreams(req, res, searchParams) {
  if (!db) return json(res, { ok: false, error: 'Database not connected', streams: [] }, 503);

  const title   = searchParams.get('title') || '';
  const titleVi = searchParams.get('titleVi') || '';
  const slug    = searchParams.get('slug') || '';
  const year    = parseInt(searchParams.get('year') || '0', 10);
  const episode = searchParams.get('episode') || '1';

  try {
    let bestMovie = null;

    if (slug) {
      bestMovie = await db.collection('movies').findOne({ slug });
    }

    if (!bestMovie) {
      const queryConds = [];
      const addTitleConds = (t) => {
        if (!t) return;
        const esc = escapeRegex(t);
        queryConds.push({ title: { $regex: `^${esc}$`, $options: 'i' } });
        queryConds.push({ originTitle: { $regex: `^${esc}$`, $options: 'i' } });
        queryConds.push({ title: { $regex: esc, $options: 'i' } });
        queryConds.push({ originTitle: { $regex: esc, $options: 'i' } });
      };
      addTitleConds(title);
      addTitleConds(titleVi);

      if (queryConds.length > 0) {
        const movies = await db.collection('movies').find({ $or: queryConds }).limit(10).toArray();
        if (movies.length > 0) {
          bestMovie = movies[0];
          if (year > 0) {
            const matchYear = movies.find(m => parseInt(m.year) === year);
            if (matchYear) bestMovie = matchYear;
          }
        }
      }
    }

    const matchedSlug = bestMovie ? bestMovie.slug : slug;
    if (!matchedSlug) return json(res, { ok: true, streams: [] });

    const targetEpNum = getEpNum(episode);

    // Timeout MongoDB query 5s để không treo khi DB chậm
    const queryPromise = db.collection('streams')
      .find({ slug: matchedSlug })
      .limit(50)
      .toArray();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('MongoDB query timeout')), 5000)
    );
    const allStreams = await Promise.race([queryPromise, timeoutPromise]);

    const streams = allStreams.filter(s => {
      const sEpNum = getEpNum(s.episode);
      return sEpNum === targetEpNum || String(s.episode).toLowerCase() === String(episode).toLowerCase();
    });

    return json(res, { ok: true, movie: bestMovie, streams });
  } catch (err) {
    console.error('[Bridge] Query error:', err.message);
    return json(res, { ok: false, error: err.message, streams: [] }, 500);
  }
}

// ---------------------------------------------------------------------------
// Route: GET /api/admin/scraper/stats
// ---------------------------------------------------------------------------
async function handleStats(req, res) {
  if (!db) return json(res, { ok: false, error: 'Database not connected' }, 503);
  try {
    const movies  = await db.collection('movies').countDocuments();
    const streams = await db.collection('streams').countDocuments();
    return json(res, { ok: true, movies, streams });
  } catch (err) {
    return json(res, { ok: false, error: err.message }, 500);
  }
}

// ---------------------------------------------------------------------------
// Route: GET /proxy/m3u8 — HLS proxy bypass Cloudflare IP block cho VI CDNs
// ---------------------------------------------------------------------------
async function handleM3u8Proxy(req, res, searchParams) {
  const targetUrl = searchParams.get('url');
  const referer   = searchParams.get('referer') || '';

  if (!targetUrl || !/^https?:\/\//.test(targetUrl)) {
    return json(res, { error: 'Missing or invalid url param' }, 400);
  }

  const reqHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  if (referer) {
    reqHeaders['Referer'] = referer;
    try { reqHeaders['Origin'] = new URL(referer).origin; } catch (_) {}
  }
  if (req.headers['range']) reqHeaders['Range'] = req.headers['range'];

  let upstream;
  try {
    upstream = await fetch(targetUrl, { headers: reqHeaders, redirect: 'follow' });
  } catch (err) {
    return json(res, { error: `Fetch failed: ${err.message}` }, 502);
  }

  if (!upstream.ok && upstream.status !== 206) {
    console.warn(`[proxy/m3u8] Upstream ${upstream.status} for: ${targetUrl}`);
    return json(res, { error: `Upstream returned ${upstream.status}` }, upstream.status);
  }

  const contentType = upstream.headers.get('content-type') || '';
  const isM3U8 = contentType.includes('mpegurl') || targetUrl.includes('.m3u8');

  if (isM3U8) {
    const text = await upstream.text();
    const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
    const selfBase = `https://hollysheesh-bridge.onrender.com/proxy/m3u8`;

    // Rewrite relative URLs to route through this proxy
    const rewritten = text.replace(/^(?!#)(.+)$/gm, (line) => {
      line = line.trim();
      if (!line || line.startsWith('#')) return line;
      const absUrl = line.startsWith('http') ? line : baseUrl + line;
      return `${selfBase}?url=${encodeURIComponent(absUrl)}&referer=${encodeURIComponent(referer)}`;
    });

    res.writeHead(upstream.status, {
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    });
    return res.end(rewritten);
  }

  // Binary TS / AAC segments
  const buf = Buffer.from(await upstream.arrayBuffer());
  const respHeaders = {
    'Content-Type': contentType || 'video/MP2T',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=3600',
  };
  if (upstream.status === 206) {
    const cr = upstream.headers.get('content-range');
    if (cr) respHeaders['Content-Range'] = cr;
    const ar = upstream.headers.get('accept-ranges');
    if (ar) respHeaders['Accept-Ranges'] = ar;
  }
  res.writeHead(upstream.status, respHeaders);
  return res.end(buf);
}

async function getGeminiEmbedding(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${apiKey}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-2',
        content: { parts: [{ text: text.slice(0, 1000) }] }
      }),
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.embedding?.values || null;
  } catch (_) {
    return null;
  }
}

async function handleSemanticSearch(req, res, searchParams) {
  if (!db) return json(res, { ok: false, error: 'Database not connected', results: [] }, 503);

  const query = searchParams.get('q') || '';
  if (!query.trim()) return json(res, { ok: true, results: [] });

  try {
    let results = [];

    // 1. Vector Search (Atlas Vector Index)
    if (process.env.GEMINI_API_KEY) {
      try {
        const embedding = await getGeminiEmbedding(query);
        if (embedding) {
          const pipeline = [
            {
              $vectorSearch: {
                index: "default",
                path: "embedding",
                queryVector: embedding,
                numCandidates: 50,
                limit: 20
              }
            },
            {
              $project: {
                _id: 0, title: 1, originTitle: 1, slug: 1, thumbUrl: 1, posterUrl: 1, type: 1, status: 1, year: 1,
                score: { $meta: "vectorSearchScore" }
              }
            }
          ];
          results = await db.collection('movies').aggregate(pipeline).toArray();
        }
      } catch (e) {
        console.warn('[Bridge Semantic Search] Vector search fallback to regex:', e.message);
      }
    }

    // 2. Multi-word Regex Fallback trên MongoDB
    if (!results || results.length === 0) {
      const words = query.trim().split(/\s+/).filter(Boolean);
      const regexPatterns = words.map(w => new RegExp(escapeRegex(w), 'i'));

      const filter = {
        $or: [
          { title: { $regex: escapeRegex(query), $options: 'i' } },
          { originTitle: { $regex: escapeRegex(query), $options: 'i' } },
          { content: { $regex: escapeRegex(query), $options: 'i' } },
          { $and: regexPatterns.map(r => ({ $or: [{ title: r }, { originTitle: r }, { content: r }] })) }
        ]
      };
      results = await db.collection('movies').find(filter).limit(20).toArray();
    }

    return json(res, { ok: true, results });
  } catch (err) {
    console.error('[Bridge Semantic Search] Error:', err.message);
    return json(res, { ok: false, error: err.message, results: [] }, 500);
  }
}

// ---------------------------------------------------------------------------
// HTTP Server
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const parsed = urlModule.parse(req.url, true);
  const pathname = parsed.pathname;
  const searchParams = new URLSearchParams(parsed.search);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Range',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    });
    return res.end();
  }

  // POST chỉ được phép cho /api/resolver/queue
  if (req.method === 'POST' && pathname !== '/api/resolver/queue') {
    return json(res, { error: 'Method not allowed' }, 405);
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json(res, { error: 'Method not allowed' }, 405);
  }

  if (pathname === '/' || pathname === '/health') {
    return json(res, { ok: true, service: 'hollysheesh-bridge', db: db ? 'connected' : 'disconnected' });
  }

  if (pathname === '/api/admin/scraper/streams') {
    return await handleStreams(req, res, searchParams);
  }

  if (pathname === '/api/admin/scraper/semantic-search') {
    return await handleSemanticSearch(req, res, searchParams);
  }

  if (pathname === '/api/admin/scraper/stats') {
    return await handleStats(req, res);
  }

  if (pathname === '/proxy/m3u8') {
    return await handleM3u8Proxy(req, res, searchParams);
  }

  // ---------------------------------------------------------------------------
  // On-Demand Resolver Routes
  // ---------------------------------------------------------------------------

  // GET /api/resolver/check — Kiểm tra có link sạch còn hạn không
  if (pathname === '/api/resolver/check') {
    if (!db) return json(res, { ok: false, error: 'Database not connected' }, 503);
    const tmdbId  = searchParams.get('tmdbId')  || '';
    const type    = searchParams.get('type')     || 'movie';
    const season  = parseInt(searchParams.get('season')  || '1');
    const episode = parseInt(searchParams.get('episode') || '1');
    if (!tmdbId) return json(res, { ok: false, error: 'tmdbId required' }, 400);
    try {
      const cached = await db.collection('vidsrc_streams').findOne({
        tmdbId: String(tmdbId), type, season, episode,
        expiredAt: { $gt: new Date() },
      });
      if (cached) {
        return json(res, { ok: true, streamUrl: cached.streamUrl, provider: cached.provider, resolvedAt: cached.resolvedAt });
      }
      return json(res, { ok: false, reason: 'no_cache' });
    } catch (err) {
      return json(res, { ok: false, error: err.message }, 500);
    }
  }

  // POST /api/resolver/queue — Đẩy yêu cầu giải mã vào hàng đợi
  if (pathname === '/api/resolver/queue' && req.method === 'POST') {
    if (!db) return json(res, { ok: false, error: 'Database not connected' }, 503);
    let body = '';
    for await (const chunk of req) body += chunk;
    let payload;
    try { payload = JSON.parse(body); } catch { return json(res, { ok: false, error: 'Invalid JSON' }, 400); }

    const { tmdbId, type = 'movie', season = 1, episode = 1 } = payload;
    if (!tmdbId) return json(res, { ok: false, error: 'tmdbId required' }, 400);

    try {
      // Idempotent: không thêm nếu job cùng key đang pending/processing
      const existing = await db.collection('resolving_queue').findOne({
        tmdbId: String(tmdbId), type,
        season: parseInt(season), episode: parseInt(episode),
        status: { $in: ['pending', 'processing'] },
      });

      if (existing) {
        return json(res, { ok: true, queued: false, note: 'Job đã tồn tại trong hàng đợi' });
      }

      await db.collection('resolving_queue').insertOne({
        tmdbId: String(tmdbId), type,
        season: parseInt(season), episode: parseInt(episode),
        status: 'pending',
        createdAt: new Date(),
        retries: 0,
      });

      return json(res, { ok: true, queued: true });
    } catch (err) {
      return json(res, { ok: false, error: err.message }, 500);
    }
  }

  return json(res, { error: 'Not found' }, 404);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`[Bridge] Server listening on port ${PORT}`);

      // Tự động khởi chạy resolver.cjs dưới dạng tiến trình con chạy nền
      try {
        const { fork } = require('child_process');
        const path = require('path');
        const resolverPath = path.join(__dirname, 'resolver.cjs');
        
        console.log('[Bridge] Khởi chạy tiến trình bẻ khóa VidSrc (resolver.cjs)...');
        const resolverProcess = fork(resolverPath);
        
        resolverProcess.on('error', (err) => {
          console.error('[Bridge] Tiến trình bẻ khóa lỗi:', err.message);
        });

        resolverProcess.on('exit', (code) => {
          console.warn(`[Bridge] Tiến trình bẻ khóa thoát với mã code: ${code}. Đang khởi động lại sau 5s...`);
          setTimeout(() => {
            fork(resolverPath);
          }, 5000);
        });
      } catch (err) {
        console.error('[Bridge] Không thể khởi chạy resolver process:', err.message);
      }
    });
  })
  .catch(err => {
    console.error('[Bridge] Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
