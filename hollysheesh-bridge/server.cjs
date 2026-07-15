'use strict';

/**
 * Hollysheesh Bridge API
 * Kết nối MongoDB Atlas và expose /api/admin/scraper/streams
 * để Cloudflare Worker proxy qua.
 * Deploy: Render.com / Railway / Fly.io (free tier)
 */

const http = require('http');
const urlModule = require('url');
const { MongoClient } = require('mongodb');

const PORT = process.env.PORT || 3099;
const MONGODB_URI = process.env.MONGODB_URI;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',');

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

  const title    = searchParams.get('title') || '';
  const titleVi  = searchParams.get('titleVi') || '';
  const slug     = searchParams.get('slug') || '';
  const year     = parseInt(searchParams.get('year') || '0', 10);
  const episode  = searchParams.get('episode') || '1';

  try {
    let bestMovie = null;

    // 1. Try slug first (exact match)
    if (slug) {
      bestMovie = await db.collection('movies').findOne({ slug });
    }

    // 2. Fallback to title search
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
    if (!matchedSlug) {
      return json(res, { ok: true, streams: [] });
    }

    // 3. Query streams
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
      'Access-Control-Allow-Headers': 'Content-Type',
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
