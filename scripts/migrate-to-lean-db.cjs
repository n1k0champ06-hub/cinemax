'use strict';

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// Load environment variables
function loadEnv() {
  const candidates = [
    path.join(__dirname, '..', '.env.local'),
    path.join(__dirname, '..', '.env'),
  ];
  const filePath = candidates.find(f => fs.existsSync(f));
  if (!filePath) {
    console.error('[Migration] No .env file found');
    process.exit(1);
  }

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

async function runMigration() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('[Migration] MONGODB_URI not set in env');
    process.exit(1);
  }

  console.log('[Migration] Đang kết nối MongoDB...');
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db();
  console.log('[Migration] Kết nối thành công. Database:', db.databaseName);

  // --- STATS BEFORE ---
  let moviesStatsBefore = { size: 0, count: 0 };
  let streamsStatsBefore = { size: 0, count: 0 };
  try {
    const mStats = await db.command({ collStats: 'movies' });
    moviesStatsBefore = { size: mStats.size, count: mStats.count };
    const sStats = await db.command({ collStats: 'streams' });
    streamsStatsBefore = { size: sStats.size, count: sStats.count };
  } catch (e) {
    console.log('[Migration] Lấy collStats trước di trú thất bại (có thể do collection rỗng hoặc quyền hạn):', e.message);
  }

  console.log(`\n--- DUNG LƯỢNG TRƯỚC DI TRÚ ---`);
  console.log(`- Movies: ${(moviesStatsBefore.size / 1024 / 1024).toFixed(2)} MB (${moviesStatsBefore.count} documents)`);
  console.log(`- Streams: ${(streamsStatsBefore.size / 1024 / 1024).toFixed(2)} MB (${streamsStatsBefore.count} documents)`);

  // --- 1. MIGRATING MOVIES (Conditional Metadata) ---
  console.log('\n[Migration] Bước 1: Dọn dẹp metadata của phim đã khớp TMDB ID...');
  const moviesCol = db.collection('movies');
  
  // unsetting fields for matched movies
  const cleanResult = await moviesCol.updateMany(
    { tmdbId: { $ne: null, $exists: true } },
    {
      $unset: {
        content: "",
        actor: "",
        director: "",
        category: "",
        posterUrl: "",
        thumbUrl: "",
        embedding: ""
      }
    }
  );
  console.log(`[Migration] Đã tối ưu hóa metadata cho ${cleanResult.modifiedCount} phim đã khớp TMDB.`);

  // --- 2. MIGRATING STREAMS (Aggregation) ---
  console.log('\n[Migration] Bước 2: Bắt đầu gộp tập phim (Streams Aggregation)...');
  const streamsCol = db.collection('streams');
  const tempStreamsCol = db.collection('streams_temp');

  // Clear temp collection if exists
  await tempStreamsCol.deleteMany({});

  console.log('[Migration] Đang đọc toàn bộ streams bằng Cursor và gom nhóm trong bộ nhớ Node.js...');
  const cursor = streamsCol.find({}, {
    projection: {
      slug: 1,
      server: 1,
      episode: 1,
      streamUrl: 1,
      referer: 1,
      updatedAt: 1
    }
  });

  const groups = new Map();
  let totalDocsRead = 0;

  for await (const doc of cursor) {
    if (!doc.slug) continue;
    
    if (!groups.has(doc.slug)) {
      groups.set(doc.slug, []);
    }
    
    groups.get(doc.slug).push({
      server: doc.server,
      episode: doc.episode,
      streamUrl: doc.streamUrl,
      referer: doc.referer,
      updatedAt: doc.updatedAt
    });

    totalDocsRead++;
    if (totalDocsRead % 50000 === 0) {
      console.log(`[Migration] Đã đọc ${totalDocsRead} documents tập phim...`);
    }
  }

  console.log(`[Migration] Tổng cộng đã đọc ${totalDocsRead} documents. Gom thành ${groups.size} nhóm phim.`);
  console.log('[Migration] Đang lưu các nhóm phim đã gộp vào collection tạm...');

  if (groups.size > 0) {
    const groupsArray = Array.from(groups.entries());
    const batchSize = 1000;
    for (let i = 0; i < groupsArray.length; i += batchSize) {
      const batch = groupsArray.slice(i, i + batchSize).map(([slug, streamsList]) => ({
        updateOne: {
          filter: { slug },
          update: {
            $set: {
              slug,
              streams: streamsList,
              updatedAt: new Date()
            }
          },
          upsert: true
        }
      }));
      await tempStreamsCol.bulkWrite(batch);
      console.log(`[Migration] Đã lưu tiến độ gộp: ${Math.min(i + batchSize, groupsArray.length)}/${groupsArray.length} nhóm.`);
    }
  }

  console.log('[Migration] Đang tráo đổi (swap) các collection streams...');
  
  // Drop old streams
  await streamsCol.drop().catch(() => {});
  
  // Rename temp to streams
  await tempStreamsCol.rename('streams');
  console.log('[Migration] Đã hoàn thành hoán đổi collection streams.');

  // Create index on slug for fast query
  console.log('[Migration] Đang tạo chỉ mục (index) cho streams...');
  await db.collection('streams').createIndex({ slug: 1 });

  // --- STATS AFTER ---
  let moviesStatsAfter = { size: 0, count: 0 };
  let streamsStatsAfter = { size: 0, count: 0 };
  try {
    const mStats = await db.command({ collStats: 'movies' });
    moviesStatsAfter = { size: mStats.size, count: mStats.count };
    const sStats = await db.command({ collStats: 'streams' });
    streamsStatsAfter = { size: sStats.size, count: sStats.count };
  } catch (e) {
    console.log('[Migration] Lấy collStats sau di trú thất bại:', e.message);
  }

  console.log(`\n--- DUNG LƯỢNG SAU DI TRÚ ---`);
  console.log(`- Movies: ${(moviesStatsAfter.size / 1024 / 1024).toFixed(2)} MB (${moviesStatsAfter.count} documents)`);
  console.log(`- Streams: ${(streamsStatsAfter.size / 1024 / 1024).toFixed(2)} MB (${streamsStatsAfter.count} documents)`);
  
  const savedMovies = (moviesStatsBefore.size - moviesStatsAfter.size) / 1024 / 1024;
  const savedStreams = (streamsStatsBefore.size - streamsStatsAfter.size) / 1024 / 1024;
  console.log(`\n[SUCCESS] Tiết kiệm tổng cộng: ${(savedMovies + savedStreams).toFixed(2)} MB dung lượng MongoDB Atlas!`);

  await client.close();
}

runMigration().catch(err => {
  console.error('[Migration] [ERROR] Lỗi di trú dữ liệu:', err);
  process.exit(1);
});
