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
    const allStreams = await db.collection('streams').find({ slug: matchedSlug }).toArray();
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

  if (req.method !== 'GET') {
    return json(res, { error: 'Method not allowed' }, 405);
  }

  if (pathname === '/' || pathname === '/health') {
    return json(res, { ok: true, service: 'hollysheesh-bridge', db: db ? 'connected' : 'disconnected' });
  }

  if (pathname === '/api/admin/scraper/streams') {
    return await handleStreams(req, res, searchParams);
  }

  if (pathname === '/api/admin/scraper/stats') {
    return await handleStats(req, res);
  }

  if (pathname === '/proxy/m3u8') {
    return await handleM3u8Proxy(req, res, searchParams);
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
    });
  })
  .catch(err => {
    console.error('[Bridge] Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
