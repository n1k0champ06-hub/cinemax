/**
 * Local dev server — emulates Cloudflare Workers on port 3001.
 * Run: node scripts/dev-api.cjs
 */

'use strict';

const http = require('http');
const https = require('https');
const urlModule = require('url');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { MongoClient } = require('mongodb');
const { spawn } = require('child_process');

const PORT = 3001;

// ---------------------------------------------------------------------------
// Load .env.local / .env
// ---------------------------------------------------------------------------
function loadEnv() {
  const candidates = [
    path.join(__dirname, '..', '.env.local'),
    path.join(__dirname, '..', '.env'),
  ];
  const filePath = candidates.find(f => fs.existsSync(f));
  if (!filePath) return;

  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  for (const line of lines) {
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
}

loadEnv();

// ---------------------------------------------------------------------------
// Gemini AI API Helpers
// ---------------------------------------------------------------------------
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function getGeminiEmbedding(text) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured in .env file');
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${GEMINI_API_KEY}`;
  
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/gemini-embedding-2',
          content: {
            parts: [{ text }]
          },
          outputDimensionality: 768
        }),
        signal: AbortSignal.timeout(10000)
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }
      const data = await res.json();
      return data.embedding?.values || null;
    } catch (err) {
      if (i === 2) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

async function resolveMovieWithAI(movieTitle, originTitle, year, type) {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    console.warn('[AI Matcher] GROQ_API_KEY is not configured, skipping AI resolution.');
    return {
      tmdb_id: null,
      title: originTitle,
      titleVi: movieTitle,
      year: year,
      confidence: 0
    };
  }

  const url = 'https://api.groq.com/openai/v1/chat/completions';
  
  const prompt = `You are a professional movie database matcher. Your job is to correct spelling mistakes in the Vietnamese title, find the official English title, correct release year, and the exact TMDB (The Movie Database) ID for this movie/TV series:
Input:
- Scraped Title: "${movieTitle}"
- Original Title: "${originTitle}"
- Scraped Year: ${year}
- Type: ${type === 'tv' ? 'tv series' : 'movie'}

Respond ONLY with a valid JSON object matching the following structure (do NOT wrap it in markdown code blocks like \`\`\`json, do NOT output anything else):
{
  "tmdb_id": "string or null", // The official TMDB ID if found, otherwise null
  "title": "string", // Official English/Original title
  "titleVi": "string", // Cleaned/Corrected Vietnamese title
  "year": number, // Correct release year
  "confidence": number // A rating from 0.0 to 1.0 representing your confidence
}`;

  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' }
        }),
        signal: AbortSignal.timeout(10000)
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error('No content returned from Groq');
      
      const parsed = JSON.parse(text.trim());
      return parsed;
    } catch (err) {
      if (i === 2) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

async function processMovieAI(movie) {
  let resolved = {
    tmdb_id: null,
    title: movie.origin_name,
    titleVi: movie.name,
    year: movie.year,
    confidence: 0
  };
  
  let embedding = null;

  // 1. Resolve movie details using AI (AI Scraper Matcher)
  try {
    if (GEMINI_API_KEY) {
      console.log(`[AI Scraper Matcher] Resolving "${movie.name}"...`);
      const aiResult = await resolveMovieWithAI(movie.name, movie.origin_name, movie.year, movie.type);
      if (aiResult && aiResult.confidence >= 0.7) {
        resolved = aiResult;
        console.log(`[AI Scraper Matcher] Success! Resolved TMDB ID: ${resolved.tmdb_id}, Year: ${resolved.year}`);
      }
    }
  } catch (err) {
    console.warn(`[AI Scraper Matcher] Failed to resolve "${movie.name}":`, err.message);
  }

  // 2. Generate Vector Embedding (AI Semantic Search Prep)
  try {
    if (GEMINI_API_KEY) {
      const cleanContent = (movie.content || '').replace(/<[^>]*>/g, '').trim();
      const categoryStr = Array.isArray(movie.category) 
        ? movie.category.map(c => c.name || c).join(', ') 
        : '';
      const textToEmbed = `${resolved.titleVi || movie.name} (${resolved.title || movie.origin_name} - ${resolved.year || movie.year}). Thể loại: ${categoryStr}. Nội dung: ${cleanContent}`.slice(0, 1000);
      
      if (cleanContent) {
        console.log(`[AI Embeddings] Generating embedding for "${movie.name}"...`);
        embedding = await getGeminiEmbedding(textToEmbed);
      }
    }
  } catch (err) {
    console.warn(`[AI Embeddings] Failed to generate embedding for "${movie.name}":`, err.message);
  }

  return { resolved, embedding };
}

// Load wrangler vars as fallback
let wranglerVars = {};
try {
  const wranglerConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../wrangler.json'), 'utf8'));
  wranglerVars = wranglerConfig.vars || {};
} catch (_) {}

// ---------------------------------------------------------------------------
// Connect to MongoDB
// ---------------------------------------------------------------------------
let dbClient = null;
let db = null;

async function connectMongoDB() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.log('[CINEMAX dev-api] MONGODB_URI not configured in .env, MongoDB caching disabled.');
    return;
  }
  try {
    dbClient = new MongoClient(mongoUri);
    await dbClient.connect();
    db = dbClient.db();
    console.log('[CINEMAX dev-api] Connected to MongoDB database:', db.databaseName);
  } catch (err) {
    console.error('[CINEMAX dev-api] MongoDB connection failed:', err.message);
  }
}
connectMongoDB();

// ---------------------------------------------------------------------------
// Scraper / Miner Admin Endpoints
// ---------------------------------------------------------------------------
const runningJobs = new Map();

let continuousMiningActive = false;
let continuousMiningPage = 1;
let continuousMiningType = 'movie'; // Alternates between 'movie' and 'tv'

function getUnifiedScraperState() {
  const isRunning = runningJobs.size > 0;
  let currentTask = 'Idle';
  let processed = 0;
  let total = 0;
  
  if (isRunning) {
    const jobs = Array.from(runningJobs.values());
    currentTask = jobs.map(j => j.task).join(' | ');
    processed = jobs.reduce((sum, j) => sum + j.processed, 0);
    total = jobs.reduce((sum, j) => sum + j.total, 0);
  }
  
  return {
    isRunning,
    currentTask,
    processed,
    total,
    logs: scraperState.logs
  };
}

let scraperState = {
  logs: ['[System] Trình quản trị máy đào sẵn sàng.']
};

function addScraperLog(msg) {
  const time = new Date().toLocaleTimeString();
  scraperState.logs.push(`[${time}] ${msg}`);
  if (scraperState.logs.length > 200) {
    scraperState.logs.shift();
  }
}

async function fetchJson(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

async function startBackgroundSync(source, limitPages = 2, customUrl = '') {
  if (runningJobs.has(source)) return;
  
  const job = {
    source,
    processed: 0,
    total: limitPages,
    task: `Đồng bộ ${source.toUpperCase()}`
  };
  runningJobs.set(source, job);

  let baseUrl = (customUrl || '').trim();
  if (!baseUrl) {
    if (source === 'kkphim') baseUrl = 'https://phimapi.com';
    else if (source === 'nguonc') baseUrl = 'https://phim.nguonc.com/api';
    else baseUrl = 'https://ophim1.com';
  }
  baseUrl = baseUrl.replace(/\/$/, '');

  addScraperLog(`[${source.toUpperCase()}] Bắt đầu đồng bộ từ nguồn: ${baseUrl} (Giới hạn: ${limitPages} trang)...`);

  try {
    if (!db) {
      throw new Error("Chưa kết nối cơ sở dữ liệu MongoDB. Hãy cấu hình MONGODB_URI trong file .env");
    }

    const moviesCol = db.collection('movies');
    const streamsCol = db.collection('streams');

    let actualLimit = limitPages;
    for (let page = 1; page <= actualLimit; page++) {
      if (!runningJobs.has(source)) {
        addScraperLog(`[${source.toUpperCase()}] Đồng bộ bị dừng bởi người dùng.`);
        break;
      }

      addScraperLog(`[${source.toUpperCase()}] Đang tải dữ liệu trang ${page}...`);
      
      let listUrl = `${baseUrl}/danh-sach/phim-moi-cap-nhat?page=${page}`;
      if (source === 'nguonc' || baseUrl.includes('nguonc.com')) {
        listUrl = `${baseUrl}/films/phim-moi-cap-nhat?page=${page}`;
      }
      
      let listData;
      try {
        listData = await fetchJson(listUrl);
      } catch (err) {
        addScraperLog(`[${source.toUpperCase()}] Lỗi tải trang ${page}: ${err.message}`);
        continue;
      }

      // Dynamic pagination limit for "Sync All" (9999)
      if (page === 1 && limitPages === 9999) {
        const paginationObj = listData.paginate || listData.pagination || {};
        const totalPages = parseInt(paginationObj.total_page || paginationObj.totalPages || paginationObj.total_pages || '1000', 10);
        actualLimit = totalPages;
        job.total = totalPages;
        addScraperLog(`[${source.toUpperCase()}] Cài đặt chế độ đồng bộ tất cả: Tổng cộng ${totalPages} trang.`);
      }

      const items = listData.items || listData.data || [];
      addScraperLog(`[${source.toUpperCase()}] Trang ${page} có ${items.length} phim mới cập nhật.`);

      for (const item of items) {
        if (!runningJobs.has(source)) break;

        const slug = item.slug;
        let detailsUrl = `${baseUrl}/phim/${slug}`;
        if (source === 'nguonc' || baseUrl.includes('nguonc.com')) {
          detailsUrl = `${baseUrl}/film/${slug}`;
        }
        
        let detailData;
        try {
          detailData = await fetchJson(detailsUrl);
        } catch (err) {
          addScraperLog(`[${source.toUpperCase()}] Lỗi tải chi tiết phim '${slug}': ${err.message}`);
          continue;
        }

        const movie = detailData.movie;
        const episodes = detailData.episodes || [];

        if (!movie) continue;

        // Xử lý AI Scraper Matcher & Vector Embedding
        let aiData = { resolved: { tmdb_id: null, title: movie.origin_name, titleVi: movie.name, year: movie.year }, embedding: null };
        if (GEMINI_API_KEY) {
          try {
            addScraperLog(`[${source.toUpperCase()}] Đang chạy AI Matcher & Embedding cho '${movie.name}'...`);
            aiData = await processMovieAI(movie);
          } catch (err) {
            console.error(`[AI Process] Error for '${movie.name}':`, err.message);
          }
        }

        // Lưu thông tin phim vào bộ sưu tập movies
        const updateDoc = {
          title: aiData.resolved.titleVi || movie.name,
          originTitle: aiData.resolved.title || movie.origin_name,
          slug: movie.slug,
          thumbUrl: movie.thumb_url,
          posterUrl: movie.poster_url,
          type: movie.type || 'series',
          status: movie.status || 'ongoing',
          year: aiData.resolved.year || movie.year || new Date().getFullYear(),
          content: movie.content || '',
          category: Array.isArray(movie.category) ? movie.category.map(c => c.name || c) : [],
          actor: Array.isArray(movie.actor) ? movie.actor.map(a => a.name || a) : [],
          director: Array.isArray(movie.director) ? movie.director.map(d => d.name || d) : [],
          tmdbId: aiData.resolved.tmdb_id || null,
          updatedAt: new Date()
        };

        if (aiData.embedding) {
          updateDoc.embedding = aiData.embedding;
        }

        await moviesCol.updateOne(
          { slug: movie.slug },
          { $set: updateDoc },
          { upsert: true }
        );

        // Lưu thông tin luồng phát vào bộ sưu tập streams
        let addedEpisodesCount = 0;
        for (const epGroup of episodes) {
          const serverName = epGroup.server_name;
          const serverData = epGroup.server_data || epGroup.items || [];
          for (const ep of serverData) {
            const streamUrl = ep.link_m3u8 || ep.m3u8 || ep.embed || '';
            if (streamUrl) {
              await streamsCol.updateOne(
                { slug: movie.slug, server: serverName, episode: ep.name },
                {
                  $set: {
                    title: movie.name,
                    slug: movie.slug,
                    server: serverName,
                    episode: ep.name,
                    streamUrl: streamUrl,
                    updatedAt: new Date()
                  }
                },
                { upsert: true }
              );
              addedEpisodesCount++;
            }
          }
        }

        addScraperLog(`[${source.toUpperCase()}] Đã đồng bộ phim '${movie.name}' (${addedEpisodesCount} tập).`);
        await new Promise(r => setTimeout(r, 200));
      }

      job.processed = page;
    }

    if (runningJobs.has(source)) {
      addScraperLog(`[${source.toUpperCase()}] Đồng bộ hoàn tất thành công!`);
    }
  } catch (err) {
    addScraperLog(`[${source.toUpperCase()}] Lỗi hệ thống trong quá trình đồng bộ: ${err.message}`);
    console.error(err);
  } finally {
    runningJobs.delete(source);
  }
}

const net = require('net');

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const onError = () => {
      socket.destroy();
      resolve(false);
    };
    socket.setTimeout(1000);
    socket.once('error', onError);
    socket.once('timeout', onError);
    socket.connect(port, '127.0.0.1', () => {
      socket.end();
      resolve(true);
    });
  });
}

async function handleLocalScraperStats() {
  if (!db) {
    return new Response(JSON.stringify({ 
      connected: false,
      moviesCount: 0,
      streamsCount: 0,
      cineproConnected: false,
      resolverQueue: 0,
      resolverCached: 0,
      error: "Chưa kết nối MongoDB"
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const moviesCount = await db.collection('movies').countDocuments();
    const streamsCount = await db.collection('streams').countDocuments();
    const cineproConnected = await isPortOpen(3232);
    
    // Thống kê VidSrc Resolver
    const pendingCount = await db.collection('resolving_queue').countDocuments({ status: 'pending' });
    const processingCount = await db.collection('resolving_queue').countDocuments({ status: 'processing' });
    const resolverCached = await db.collection('vidsrc_streams').countDocuments({ expiredAt: { $gt: new Date() } });

    return new Response(JSON.stringify({
      connected: true,
      moviesCount,
      streamsCount,
      cineproConnected,
      resolverQueue: pendingCount + processingCount,
      resolverCached
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

async function handleResolverCheck(searchParams) {
  if (!db) {
    return new Response(JSON.stringify({ ok: false, error: 'Chưa kết nối MongoDB' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
  const tmdbId  = searchParams.get('tmdbId')  || '';
  const type    = searchParams.get('type')     || 'movie';
  const season  = parseInt(searchParams.get('season')  || '1');
  const episode = parseInt(searchParams.get('episode') || '1');

  if (!tmdbId) {
    return new Response(JSON.stringify({ ok: false, error: 'tmdbId required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const stream = await db.collection('vidsrc_streams').findOne({
      tmdbId: String(tmdbId),
      type,
      season,
      episode,
      expiredAt: { $gt: new Date() }
    });

    if (stream) {
      return new Response(JSON.stringify({ ok: true, streamUrl: stream.streamUrl }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ ok: true, streamUrl: null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

async function importMovieFromTMDB(tmdbId, type, targetSeason = 1) {
  const tmdbToken = process.env.VITE_TMDB_ACCESS_TOKEN || process.env.TMDB_ACCESS_TOKEN;
  if (!tmdbToken) throw new Error('Chưa cấu hình TMDB Access Token trong .env');

  // 1. Gọi TMDB API chi tiết để lấy thông tin phim (bằng tiếng Việt)
  const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?language=vi-VN&append_to_response=external_ids`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${tmdbToken}`,
      'Accept': 'application/json'
    }
  });

  if (!res.ok) {
    throw new Error(`Không thể lấy thông tin từ TMDB (HTTP ${res.status})`);
  }

  const data = await res.json();

  const title = type === 'movie' ? data.title : data.name;
  const originTitle = type === 'movie' ? data.original_title : data.original_name;
  const releaseDate = type === 'movie' ? data.release_date : data.first_air_date;
  const year = releaseDate ? parseInt(releaseDate.split('-')[0], 10) : new Date().getFullYear();
  
  // Format link ảnh qua proxy cục bộ /img/ để tránh nhà mạng chặn hiển thị ảnh
  const posterUrl = data.poster_path ? `/img/https://image.tmdb.org/t/p/w500${data.poster_path}` : '';
  const thumbUrl = posterUrl;
  const backdropUrl = data.backdrop_path ? `/img/https://image.tmdb.org/t/p/w1280${data.backdrop_path}` : '';

  const genres = (data.genres || []).map(g => g.name);
  const overview = data.overview || '';
  const slug = `tmdb-${tmdbId}-${type}`;

  // 2. Lưu vào collection 'movies'
  const moviePayload = {
    title,
    originTitle,
    slug,
    type,
    thumbUrl,
    posterUrl,
    backdropUrl,
    year,
    status: type === 'movie' ? 'completed' : 'ongoing',
    genres,
    overview,
    source: 'vidsrc',
    updatedAt: new Date()
  };

  // Tạo thêm Vector Embedding nếu cấu hình AI Studio để hỗ trợ AI Semantic Search
  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (GEMINI_API_KEY) {
      const textToEmbed = `${title} (${originTitle} - ${year}). Thể loại: ${genres.join(', ')}. Nội dung: ${overview}`.slice(0, 1000);
      const embedding = await getGeminiEmbedding(textToEmbed);
      if (embedding) {
        moviePayload.embedding = embedding;
      }
    }
  } catch (err) {
    console.warn('[TMDB Importer] Lỗi tạo embedding:', err.message);
  }

  await db.collection('movies').updateOne(
    { slug },
    { $set: moviePayload },
    { upsert: true }
  );

  console.log(`[TMDB Importer] Đã đồng bộ thông tin phim: ${title} (${originTitle})`);

  // 3. Tạo các luồng phát trong collection 'streams' và đẩy vào resolving_queue
  let createdStreams = 0;
  
  if (type === 'movie') {
    const streamUrl = `/api/resolver/stream?tmdbId=${tmdbId}&type=movie&season=1&episode=1`;
    await db.collection('streams').updateOne(
      { slug, server: 'VidSrc Clean', episode: '1' },
      {
        $set: {
          title,
          slug,
          server: 'VidSrc Clean',
          episode: '1',
          streamUrl,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    const existingQueue = await db.collection('resolving_queue').findOne({
      tmdbId: String(tmdbId),
      type: 'movie',
      season: 1,
      episode: 1,
      status: { $in: ['pending', 'processing'] }
    });

    if (!existingQueue) {
      await db.collection('resolving_queue').insertOne({
        tmdbId: String(tmdbId),
        type: 'movie',
        season: 1,
        episode: 1,
        status: 'pending',
        createdAt: new Date(),
        retries: 0
      });
    }
    createdStreams = 1;

  } else {
    // TV Show: Lấy số lượng tập chính xác của season từ TMDB
    const seasonObj = (data.seasons || []).find(s => s.season_number === targetSeason);
    const episodeCount = seasonObj ? seasonObj.episode_count : 12;

    for (let ep = 1; ep <= episodeCount; ep++) {
      const streamUrl = `/api/resolver/stream?tmdbId=${tmdbId}&type=tv&season=${targetSeason}&episode=${ep}`;
      const epStr = String(ep);
      
      await db.collection('streams').updateOne(
        { slug, server: 'VidSrc Clean', episode: epStr },
        {
          $set: {
            title: `${title} - Tập ${ep}`,
            slug,
            server: 'VidSrc Clean',
            episode: epStr,
            streamUrl,
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );

      const existingQueue = await db.collection('resolving_queue').findOne({
        tmdbId: String(tmdbId),
        type: 'tv',
        season: targetSeason,
        episode: ep,
        status: { $in: ['pending', 'processing'] }
      });

      if (!existingQueue) {
        await db.collection('resolving_queue').insertOne({
          tmdbId: String(tmdbId),
          type: 'tv',
          season: targetSeason,
          episode: ep,
          status: 'pending',
          createdAt: new Date(),
          retries: 0
        });
      }
      createdStreams++;
    }
  }

  return {
    title,
    originTitle,
    year,
    type,
    createdStreams
  };
}

async function handleResolverQueue(bodyBuffer) {
  if (!db) {
    return new Response(JSON.stringify({ ok: false, error: 'Chưa kết nối MongoDB' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const bodyStr = bodyBuffer ? bodyBuffer.toString('utf-8') : '{}';
    const { tmdbId, type, season } = JSON.parse(bodyStr);

    if (!tmdbId) {
      return new Response(JSON.stringify({ ok: false, error: 'tmdbId required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const cleanType = type || 'movie';
    const targetSeason = parseInt(season || 1);

    addScraperLog(`[RESOLVER] Bắt đầu cào thông tin và tạo luồng từ TMDB ID: ${tmdbId} (${cleanType})`);

    // Thực hiện đào trọn gói từ A-Z
    const result = await importMovieFromTMDB(tmdbId, cleanType, targetSeason);
    
    addScraperLog(`[RESOLVER] Hoàn tất cào phim: ${result.title}. Đã tạo ${result.createdStreams} tập/luồng phát và đẩy vào queue bẻ khóa!`);

    return new Response(JSON.stringify({ ok: true, queued: true, movie: result }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    addScraperLog(`[RESOLVER] [ERROR] Đào từ A-Z thất bại cho TMDB ID ${tmdbId}: ${err.message}`);
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

async function handleResolverAutoTrending() {
  if (!db) {
    return new Response(JSON.stringify({ ok: false, error: 'Chưa kết nối MongoDB' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }

  const tmdbToken = process.env.VITE_TMDB_ACCESS_TOKEN || process.env.TMDB_ACCESS_TOKEN;
  if (!tmdbToken) {
    return new Response(JSON.stringify({ ok: false, error: 'Chưa cấu hình TMDB Access Token trong .env' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    addScraperLog('[RESOLVER] Bắt đầu quét danh sách phim Trending từ TMDB...');
    
    // Gọi TMDB API lấy phim lẻ và phim bộ hot trong tuần
    const fetchTrending = async (type) => {
      const url = `https://api.themoviedb.org/3/trending/${type}/week?language=vi-VN`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${tmdbToken}`,
          'Accept': 'application/json'
        }
      });
      if (!res.ok) throw new Error(`TMDB API error: HTTP ${res.status}`);
      const data = await res.json();
      return data.results || [];
    };

    const trendingMovies = await fetchTrending('movie');
    const trendingTv = await fetchTrending('tv');

    // Lấy top 15 phim lẻ và 15 phim bộ
    const allTrending = [
      ...trendingMovies.slice(0, 15).map(m => ({ id: String(m.id), type: 'movie', title: m.title || m.original_title })),
      ...trendingTv.slice(0, 15).map(t => ({ id: String(t.id), type: 'tv', title: t.name || t.original_name }))
    ];

    addScraperLog(`[RESOLVER] Tìm thấy tổng cộng ${allTrending.length} phim hot trending trong tuần.`);

    let importedCount = 0;
    let totalStreamsCreated = 0;

    for (const item of allTrending) {
      try {
        addScraperLog(`[RESOLVER] Đang tiến hành đào trọn gói A-Z cho phim: ${item.title} (TMDB ID ${item.id})...`);
        const result = await importMovieFromTMDB(item.id, item.type, 1);
        importedCount++;
        totalStreamsCreated += result.createdStreams;
      } catch (err) {
        addScraperLog(`[RESOLVER] [ERROR] Đào phim ${item.title} thất bại: ${err.message}`);
      }
    }

    addScraperLog(`[RESOLVER] Quá trình đào A-Z hoàn tất! Đã nhập thành công ${importedCount}/${allTrending.length} phim | Đã tạo ${totalStreamsCreated} luồng phát.`);
    return new Response(JSON.stringify({ ok: true, trendingScanned: allTrending.length, importedCount, totalStreamsCreated }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    addScraperLog(`[RESOLVER] [ERROR] Lỗi tự động quét trending: ${err.message}`);
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

async function runContinuousMiningLoop() {
  if (!continuousMiningActive) return;
  
  try {
    const tmdbToken = process.env.VITE_TMDB_ACCESS_TOKEN || process.env.TMDB_ACCESS_TOKEN;
    if (!tmdbToken) {
      addScraperLog('[24/7 MINER] [WARN] Chưa cấu hình TMDB Access Token. Dừng đào 24/7.');
      continuousMiningActive = false;
      return;
    }

    addScraperLog(`[24/7 MINER] Đang quét Trang ${continuousMiningPage} danh sách phổ biến (${continuousMiningType === 'movie' ? 'Phim lẻ' : 'Phim bộ'})...`);
    
    const listType = continuousMiningType === 'movie' ? 'movie/popular' : 'tv/popular';
    const url = `https://api.themoviedb.org/3/${listType}?language=vi-VN&page=${continuousMiningPage}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${tmdbToken}`,
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`TMDB API HTTP ${res.status}`);
    }

    const data = await res.json();
    const results = data.results || [];
    addScraperLog(`[24/7 MINER] Trang ${continuousMiningPage} có ${results.length} phim.`);

    let newMoviesAdded = 0;
    for (const item of results) {
      if (!continuousMiningActive) break;

      const tmdbId = String(item.id);
      const title = item.title || item.name || item.original_title || item.original_name;
      
      const slug = `tmdb-${tmdbId}-${continuousMiningType}`;
      const existingStream = await db.collection('streams').findOne({ slug, server: 'VidSrc Clean' });
      
      if (existingStream) {
        continue;
      }

      addScraperLog(`[24/7 MINER] Phát hiện phim mới: ${title} (TMDB ${tmdbId}). Đang đào trọn gói A-Z...`);
      try {
        const result = await importMovieFromTMDB(tmdbId, continuousMiningType, 1);
        newMoviesAdded++;
        addScraperLog(`[24/7 MINER] Đã đào xong: ${result.title} (${result.createdStreams} tập). Nghỉ 5s...`);
        await new Promise(r => setTimeout(r, 5000));
      } catch (err) {
        addScraperLog(`[24/7 MINER] [ERROR] Lỗi đào phim ${title}: ${err.message}`);
      }
    }

    addScraperLog(`[24/7 MINER] Hoàn thành Trang ${continuousMiningPage}. Đã thêm mới ${newMoviesAdded} phim.`);

    if (continuousMiningType === 'movie') {
      continuousMiningType = 'tv';
    } else {
      continuousMiningType = 'movie';
      continuousMiningPage++;
      if (continuousMiningPage > 150) {
        continuousMiningPage = 1;
      }
    }
  } catch (err) {
    addScraperLog(`[24/7 MINER] [ERROR] Lỗi hệ thống trong vòng lặp đào: ${err.message}`);
  }

  if (continuousMiningActive) {
    addScraperLog('[24/7 MINER] Nghỉ 30 giây trước khi quét trang tiếp theo...');
    setTimeout(runContinuousMiningLoop, 30000);
  }
}

async function handleContinuousMiningStatus() {
  return new Response(JSON.stringify({
    active: continuousMiningActive,
    page: continuousMiningPage,
    type: continuousMiningType
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

async function handleContinuousMiningToggle() {
  continuousMiningActive = !continuousMiningActive;
  
  if (continuousMiningActive) {
    addScraperLog('[24/7 MINER] >>> KÍCH HOẠT CHẾ ĐỘ ĐÀO LIÊN TỤC 24/7 <<<');
    setTimeout(runContinuousMiningLoop, 1000);
  } else {
    addScraperLog('[24/7 MINER] >>> ĐÃ TẮT CHẾ ĐỘ ĐÀO LIÊN TỤC 24/7 <<<');
  }

  return new Response(JSON.stringify({
    active: continuousMiningActive
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

let pythonProcess = null;

async function runPythonScraper(tmdbId, title) {
  if (runningJobs.has('python')) return;
  
  const job = {
    source: 'python',
    processed: 0,
    total: 1,
    task: `Chạy Python Scrapling: ${title}`
  };
  runningJobs.set('python', job);

  addScraperLog(`[PYTHON] Bắt đầu chạy kịch bản Python Scrapling cho TMDB ID ${tmdbId}...`);

  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  const scraperScript = path.join(__dirname, 'scraper.py');

  try {
    pythonProcess = spawn(pythonCmd, [scraperScript, tmdbId, title], {
      env: { ...process.env, MONGODB_URI: process.env.MONGODB_URI }
    });

    pythonProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) addScraperLog(`[PYTHON] ${line.trim()}`);
      });
    });

    pythonProcess.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) addScraperLog(`[PYTHON] [ERROR] ${line.trim()}`);
      });
    });

    pythonProcess.on('close', (code) => {
      pythonProcess = null;
      runningJobs.delete('python');
      if (code === 0) {
        job.processed = 1;
        addScraperLog(`[PYTHON] Kịch bản Python hoàn thành thành công (code ${code})!`);
      } else {
        addScraperLog(`[PYTHON] [ERROR] Kịch bản Python kết thúc với mã lỗi ${code}.`);
      }
    });

    pythonProcess.on('error', (err) => {
      pythonProcess = null;
      runningJobs.delete('python');
      addScraperLog(`[PYTHON] [ERROR] Không thể khởi chạy python: ${err.message}`);
    });
  } catch (err) {
    pythonProcess = null;
    runningJobs.delete('python');
    addScraperLog(`[PYTHON] [ERROR] Lỗi hệ thống: ${err.message}`);
  }
}

async function handleLocalScraperStart(searchParams) {
  const source = searchParams.get('source') || 'kkphim';
  const limit = parseInt(searchParams.get('limit') || '2', 10);
  const customUrl = searchParams.get('customUrl') || '';
  
  if (source === 'all') {
    const activeSources = ['kkphim', 'ophim', 'nguonc'];
    let startedCount = 0;
    
    for (const src of activeSources) {
      if (!runningJobs.has(src)) {
        let defaultUrl = '';
        if (src === 'kkphim') defaultUrl = 'https://phimapi.com';
        else if (src === 'nguonc') defaultUrl = 'https://phim.nguonc.com/api';
        else defaultUrl = 'https://ophim1.com';
        
        startBackgroundSync(src, limit, defaultUrl);
        startedCount++;
      }
    }
    
    if (startedCount === 0) {
      return new Response(JSON.stringify({ error: 'Tất cả 3 nguồn đều đang chạy rồi.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    
    return new Response(JSON.stringify({ ok: true, message: `Đã kích hoạt song song ${startedCount} nguồn chạy ngầm.` }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  if (runningJobs.has(source)) {
    return new Response(JSON.stringify({ error: `Nguồn ${source.toUpperCase()} đang được đồng bộ. Vui lòng chờ hoàn thành.` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  if (source === 'python') {
    const tmdbId = searchParams.get('tmdb_id');
    const title = searchParams.get('title');
    if (!tmdbId || !title) {
      return new Response(JSON.stringify({ error: 'Thiếu TMDB ID hoặc Tiêu đề phim' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    // Chạy nền kịch bản Python
    runPythonScraper(tmdbId, title);
    return new Response(JSON.stringify({ ok: true, message: 'Đã kích hoạt kịch bản Python Scrapling chạy ngầm.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // Chạy nền
  startBackgroundSync(source, limit, customUrl);

  return new Response(JSON.stringify({ ok: true, message: 'Đã kích hoạt máy đào chạy ngầm.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

async function handleLocalScraperStatus() {
  return new Response(JSON.stringify(getUnifiedScraperState()), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

async function handleLocalScraperStop() {
  if (runningJobs.size > 0) {
    addScraperLog("Đang yêu cầu dừng toàn bộ máy đào...");
    runningJobs.clear();
    if (pythonProcess) {
      pythonProcess.kill();
      pythonProcess = null;
      addScraperLog("Đã tắt tiến trình kịch bản Python.");
    }
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

async function handleLocalScraperSemanticSearch(searchParams) {
  if (!db) {
    return new Response(JSON.stringify({ error: 'Chưa kết nối MongoDB', results: [] }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
  const query = searchParams.get('q') || '';
  if (!query.trim()) {
    return new Response(JSON.stringify({ ok: true, results: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    let results = [];

    // 1. Thử Vector Search nếu có Gemini Embedding
    try {
      console.log(`[AI Semantic Search] Embedding search query: "${query}"...`);
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
              _id: 0,
              title: 1, originTitle: 1, slug: 1, thumbUrl: 1, posterUrl: 1, type: 1, status: 1, year: 1,
              score: { $meta: "vectorSearchScore" }
            }
          }
        ];
        results = await db.collection('movies').aggregate(pipeline).toArray();
      }
    } catch (vectorErr) {
      console.warn('[AI Semantic Search] Vector search skipped/fallback:', vectorErr.message);
    }

    // 2. Fallback Multi-word Regex Search nếu Vector Search rỗng hoặc không hỗ trợ
    if (!results || results.length === 0) {
      const escapeReg = (s) => s.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
      const words = query.trim().split(/\s+/).filter(Boolean);
      const regexPatterns = words.map(w => new RegExp(escapeReg(w), 'i'));

      const filter = {
        $or: [
          { title: { $regex: escapeReg(query), $options: 'i' } },
          { originTitle: { $regex: escapeReg(query), $options: 'i' } },
          { content: { $regex: escapeReg(query), $options: 'i' } },
          { $and: regexPatterns.map(r => ({ $or: [{ title: r }, { originTitle: r }, { content: r }] })) }
        ]
      };
      results = await db.collection('movies').find(filter).limit(20).toArray();
    }

    console.log(`[AI Semantic Search] Complete! Returned ${results.length} movies.`);
    return new Response(JSON.stringify({ ok: true, results }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[AI Semantic Search] Fatal error:', err.message);
    return new Response(JSON.stringify({ ok: false, error: err.message, results: [] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

async function handleLocalScraperGetStreams(searchParams) {
  if (!db) {
    return new Response(JSON.stringify({ error: 'Chưa kết nối MongoDB' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  const title = searchParams.get('title') || '';
  const titleVi = searchParams.get('titleVi') || '';
  const slug = searchParams.get('slug') || '';
  const year = parseInt(searchParams.get('year') || '0', 10);
  const episode = searchParams.get('episode') || '1';

  try {
    let bestMovie = null;
    if (slug) {
      bestMovie = await db.collection('movies').findOne({ slug });
    }

    if (!bestMovie) {
      const queryConds = [];
      if (title) {
        queryConds.push({ title: { $regex: new RegExp(`^${escapeRegex(title)}$`, 'i') } });
        queryConds.push({ originTitle: { $regex: new RegExp(`^${escapeRegex(title)}$`, 'i') } });
        queryConds.push({ title: { $regex: new RegExp(escapeRegex(title), 'i') } });
        queryConds.push({ originTitle: { $regex: new RegExp(escapeRegex(title), 'i') } });
      }
      if (titleVi) {
        queryConds.push({ title: { $regex: new RegExp(`^${escapeRegex(titleVi)}$`, 'i') } });
        queryConds.push({ originTitle: { $regex: new RegExp(`^${escapeRegex(titleVi)}$`, 'i') } });
        queryConds.push({ title: { $regex: new RegExp(escapeRegex(titleVi), 'i') } });
        queryConds.push({ originTitle: { $regex: new RegExp(escapeRegex(titleVi), 'i') } });
      }

      if (queryConds.length > 0) {
        const movies = await db.collection('movies').find({
          $or: queryConds
        }).toArray();

        if (movies.length > 0) {
          bestMovie = movies[0];
          if (year > 0) {
            const matchYear = movies.find(m => parseInt(m.year) === year);
            if (matchYear) bestMovie = matchYear;
          }
        }
      }
    }

    // If still no movie matches, fallback to querying streams using the slug directly
    let matchedSlug = bestMovie ? bestMovie.slug : slug;
    if (!matchedSlug) {
      return new Response(JSON.stringify({ streams: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const streams = await db.collection('streams').find({
      slug: matchedSlug
    }).toArray();

    const getEpNum = (str) => {
      const num = String(str).toLowerCase().replace(/\D/g, '');
      return num ? parseInt(num, 10) : str;
    };
    const targetEpNum = getEpNum(episode);

    const matchedStreams = streams.filter(s => {
      const sEpNum = getEpNum(s.episode);
      return sEpNum === targetEpNum || String(s.episode).toLowerCase() === String(episode).toLowerCase();
    });

    return new Response(JSON.stringify({
      ok: true,
      movie: bestMovie,
      streams: matchedStreams
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

function escapeRegex(string) {
  return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------
async function main() {
  // Dynamically import the Cloudflare Worker module (must be ES module format)
  const workerPath = path.join(__dirname, '..', 'cloudflare-worker.js');
  const workerModule = await import(urlModule.pathToFileURL(workerPath).href);
  const worker = workerModule.default;

  const server = http.createServer(async (req, res) => {
    const parsed = urlModule.parse(req.url, true);
    const pathname = parsed.pathname || '/';
    const searchParams = new URLSearchParams(parsed.search || '');

    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Api-Key, Range');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Handled local scraper endpoints
    if (pathname === '/api/admin/scraper/stats') {
      const response = await handleLocalScraperStats();
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    if (pathname === '/api/admin/scraper/start') {
      const response = await handleLocalScraperStart(searchParams);
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    if (pathname === '/api/admin/scraper/status') {
      const response = await handleLocalScraperStatus();
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    if (pathname === '/api/admin/scraper/stop') {
      const response = await handleLocalScraperStop();
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    if (pathname === '/api/admin/scraper/streams') {
      const response = await handleLocalScraperGetStreams(searchParams);
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    if (pathname === '/api/admin/scraper/semantic-search') {
      const response = await handleLocalScraperSemanticSearch(searchParams);
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }

    if (pathname === '/api/admin/resolver/auto-trending') {
      const response = await handleResolverAutoTrending();
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }

    if (pathname === '/api/admin/resolver/continuous/status') {
      const response = await handleContinuousMiningStatus();
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }

    
    if (pathname === '/api/admin/resolver/focus') {
      const active = searchParams.get('active') === 'true';
      const concurrency = active ? 12 : 8;
      if (db) {
        db.collection('system_settings').updateOne(
          { key: 'max_concurrent' },
          { $set: { key: 'max_concurrent', value: concurrency, updatedAt: new Date() } },
          { upsert: true }
        ).catch(err => console.error(err));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, active, maxConcurrent: concurrency }));
      return;
    }
    if (pathname === '/api/admin/resolver/continuous/toggle') {
      const response = await handleContinuousMiningToggle();
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }

    if (!pathname.startsWith('/api/') && !pathname.startsWith('/tmdb/') && !pathname.startsWith('/img/')) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not an allowed path' }));
      return;
    }

    // Convert Node req to WHATWG Request for Cloudflare Worker fetch()
    const url = `http://localhost:${PORT}${req.url}`;
    
    // Read request body for POST/PUT if present
    let body = null;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks);
    }

    const headers = { ...req.headers };
    // Remove host header to let Request constructor resolve it to local
    delete headers['host'];

    // Intercept On-Demand Resolver endpoints locally
    if (pathname === '/api/resolver/check') {
      const response = await handleResolverCheck(searchParams);
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    if (pathname === '/api/resolver/queue') {
      const response = await handleResolverQueue(body);
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }

    const request = new Request(url, {
      method: req.method,
      headers: headers,
      body: body,
      duplex: 'half'
    });

    const env = {
      ...wranglerVars,
      ...process.env,
    };

    const ctx = {
      waitUntil(promise) {
        promise.catch(err => console.error('[dev-api worker-ctx] Error in waitUntil:', err));
      }
    };

    try {
      const response = await worker.fetch(request, env, ctx);
      
      const resHeaders = {};
      for (const [key, val] of response.headers.entries()) {
        resHeaders[key] = val;
      }
      // Access-Control-Allow-Origin is already added by our server CORS logic or the worker
      resHeaders['Access-Control-Allow-Origin'] = '*';

      res.writeHead(response.status, resHeaders);
      const arrayBuffer = await response.arrayBuffer();
      res.end(Buffer.from(arrayBuffer));
    } catch (err) {
      console.error(`[dev-api worker] Error handling ${req.method} ${pathname}:`, err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  server.listen(PORT, () => {
    console.log(`\n[CINEMAX dev-api] Running on http://localhost:${PORT}`);
    console.log('[CINEMAX dev-api] Routes:');
    console.log(`  /api/cinepro-proxy?type=movie&tmdbId=550`);
    console.log(`  /api/cinepro-proxy?type=tv&tmdbId=1396&season=1&episode=1`);
    console.log(`  /api/m3u8-proxy?url=<encoded_url>&referer=<encoded_referer>`);
    console.log(`  /api/sub-proxy?provider=subdl&tmdb_id=123&type=movie&lang=vi`);
    console.log(`  /api/tmdb?path=/movie/popular`);
    console.log('\n  Run Vite in a separate terminal: npm run dev\n');

    // Tự động khởi chạy resolver.cjs làm tiến trình con chạy nền (hỗ trợ auto-restart đệ quy trọn đời)
    try {
      const { fork } = require('child_process');
      const resolverPath = path.join(__dirname, '..', 'hollysheesh-bridge', 'resolver.cjs');
      
      function startResolverProcess() {
        console.log('[dev-api] Khởi chạy tiến trình bẻ khóa VidSrc (resolver.cjs)...');
        const resolverProcess = fork(resolverPath, [], { silent: true });
        
        resolverProcess.stdout.on('data', (data) => {
          const lines = data.toString().split('\n');
          lines.forEach(line => {
            const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '').trim();
            if (cleanLine) addScraperLog(`[RESOLVER] ${cleanLine}`);
          });
        });

        resolverProcess.stderr.on('data', (data) => {
          const lines = data.toString().split('\n');
          lines.forEach(line => {
            const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '').trim();
            if (cleanLine) addScraperLog(`[RESOLVER] [ERROR] ${cleanLine}`);
          });
        });

        resolverProcess.on('error', (err) => {
          console.error('[dev-api] Tiến trình bẻ khóa lỗi:', err.message);
          addScraperLog(`[RESOLVER] [ERROR] Lỗi hệ thống: ${err.message}`);
        });

        resolverProcess.on('exit', (code) => {
          console.warn(`[dev-api] Tiến trình bẻ khóa thoát với mã code: ${code}. Đang tự động khởi động lại sau 5s...`);
          addScraperLog(`[RESOLVER] [WARN] Tiến trình bẻ khóa thoát (mã ${code}). Đang tự động khởi động lại sau 5s...`);
          setTimeout(startResolverProcess, 5000);
        });
      }
      
      startResolverProcess();
    } catch (err) {
      console.error('[dev-api] Không thể khởi chạy resolver process:', err.message);
    }
  });
}

main().catch(err => {
  console.error('[CINEMAX dev-api] Server startup failure:', err);
  process.exit(1);
});
