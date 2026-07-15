/**
 * Script to migrate existing movies in MongoDB Atlas to add vector embeddings.
 * Run: node scripts/generate-embeddings.cjs
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// ---------------------------------------------------------------------------
// Load .env
// ---------------------------------------------------------------------------
function loadEnv() {
  const filePath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(filePath)) return;

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

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI;

if (!GEMINI_API_KEY) {
  console.error('Error: GEMINI_API_KEY is not defined in .env');
  process.exit(1);
}

if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI is not defined in .env');
  process.exit(1);
}

async function getGeminiEmbedding(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${GEMINI_API_KEY}`;
  
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
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
        signal: AbortSignal.timeout(15000)
      });
      
      if (res.status === 429) {
        attempts++;
        console.log(`\n[MIGRATION] [Rate Limit 429] Limit hit. Waiting 60 seconds (Attempt ${attempts}/${maxAttempts})...`);
        await new Promise(r => setTimeout(r, 60000));
        continue;
      }
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }
      
      const data = await res.json();
      return data.embedding?.values || null;
    } catch (err) {
      attempts++;
      if (attempts >= maxAttempts) throw err;
      const delay = Math.min(1000 * Math.pow(2, attempts), 16000);
      console.warn(`[MIGRATION] Fetch error: ${err.message}. Retrying in ${delay / 1000}s...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  return null;
}

async function run() {
  console.log('[MIGRATION] Connecting to MongoDB Atlas...');
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    const moviesCol = db.collection('movies');
    
    // Find movies without embeddings
    const movies = await moviesCol.find({
      $or: [
        { embedding: { $exists: false } },
        { embedding: null }
      ]
    }).toArray();
    
    console.log(`[MIGRATION] Found ${movies.length} movies without embeddings.`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < movies.length; i++) {
      const movie = movies[i];
      const percent = (((i + 1) / movies.length) * 100).toFixed(1);
      
      const cleanContent = (movie.content || '').replace(/<[^>]*>/g, '').trim();
      const categories = Array.isArray(movie.category) 
          ? movie.category.join(', ') 
          : (movie.category || '');
          
      const textToEmbed = `${movie.title || movie.name || ''} (${movie.originTitle || movie.origin_name || ''} - ${movie.year || ''}). Thể loại: ${categories}. Nội dung: ${cleanContent}`.slice(0, 1000);
      
      if (!textToEmbed.trim()) {
        console.log(`[${i+1}/${movies.length}] (${percent}%) Skipping movie "${movie.title || movie.name}" (empty text)`);
        continue;
      }
      
      try {
        console.log(`[${i+1}/${movies.length}] (${percent}%) Generating embedding for: "${movie.title || movie.name}"...`);
        const embedding = await getGeminiEmbedding(textToEmbed);
        
        if (embedding) {
          await moviesCol.updateOne(
            { _id: movie._id },
            { $set: { embedding } }
          );
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        console.error(`[${i+1}/${movies.length}] Failed to generate embedding for "${movie.title || movie.name}":`, err.message);
        failCount++;
      }
      
      // Delay to avoid rate limit (650ms is safe for 100 RPM limit)
      await new Promise(r => setTimeout(r, 650));
    }
    
    console.log(`[MIGRATION] Completed! Success: ${successCount}, Failures: ${failCount}`);
  } catch (err) {
    console.error('[MIGRATION] Critical error:', err);
  } finally {
    await client.close();
    console.log('[MIGRATION] Database connection closed.');
  }
}

run();
