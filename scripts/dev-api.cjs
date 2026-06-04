/**
 * Local dev server — emulates Vercel Edge Functions on port 3001.
 * Run: node scripts/dev-api.cjs
 *
 * Supports both text (JSON, m3u8 manifests) and binary (TS segments) responses.
 * Not needed on Vercel — Edge Functions run natively there.
 */

'use strict';

const http = require('http');
const https = require('https');
const urlModule = require('url');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

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
// fetch() polyfill — supports binary (Buffer) response
// ---------------------------------------------------------------------------
global.fetch = (targetUrl, options = {}) => {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(targetUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const lib = isHttps ? https : http;

    const reqOpts = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 35000,
    };

    const req = lib.request(reqOpts, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        let body = Buffer.concat(chunks);

        // Decompress gzip/br if needed
        const encoding = res.headers['content-encoding'] || '';
        try {
          if (encoding === 'gzip') body = zlib.gunzipSync(body);
          else if (encoding === 'deflate') body = zlib.inflateSync(body);
          else if (encoding === 'br') body = zlib.brotliDecompressSync(body);
        } catch (_) { /* ignore decompression errors — pass raw */ }

        const text = () => Promise.resolve(body.toString('utf-8'));
        const json = () => {
          try { return Promise.resolve(JSON.parse(body.toString('utf-8'))); }
          catch (e) { return Promise.reject(e); }
        };
        const arrayBuffer = () => {
          const ab = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
          return Promise.resolve(ab);
        };

        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          headers: {
            get: (h) => res.headers[h.toLowerCase()] || null,
            entries: () => Object.entries(res.headers),
          },
          _rawBody: body, // keep Buffer for binary pass-through
          text, json, arrayBuffer,
        });
      });
    });

    if (options.signal) {
      const onAbort = () => {
        req.destroy(new Error('Request aborted'));
      };
      if (options.signal.aborted) {
        onAbort();
      } else {
        options.signal.addEventListener('abort', onAbort);
        req.on('close', () => {
          options.signal.removeEventListener('abort', onAbort);
        });
      }
    }

    req.setTimeout(35000, () => { req.destroy(new Error('Request timeout')); });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
};

// ---------------------------------------------------------------------------
// AbortSignal.timeout polyfill
// ---------------------------------------------------------------------------
if (!global.AbortSignal) {
  global.AbortSignal = { timeout: (ms) => ({ aborted: false }) };
}

// ---------------------------------------------------------------------------
// Response class — supports both text and binary body
// ---------------------------------------------------------------------------
global.Response = class Response {
  constructor(body, init = {}) {
    this._body = body;   // string | ArrayBuffer | Buffer | null
    this.status = init.status || 200;
    this.headers = init.headers || {};
  }

  /** Returns true if body is binary (ArrayBuffer or Buffer) */
  get _isBinary() {
    return this._body instanceof ArrayBuffer ||
           Buffer.isBuffer(this._body) ||
           this._body instanceof Uint8Array;
  }

  get body() { return this._body; }
};

// ---------------------------------------------------------------------------
// Route handler — loads api/*.js files dynamically
// ---------------------------------------------------------------------------
async function routeRequest(pathname, searchParams, method, incomingHeaders) {
  const targetUrl = `https://cinemax-backend-proxy.cykablyatt1505.workers.dev${pathname}?${searchParams.toString()}`;
  
  try {
    const headers = { ...incomingHeaders };
    // Override host header to match the Cloudflare Worker domain
    headers['host'] = 'cinemax-backend-proxy.cykablyatt1505.workers.dev';
    
    // Remove headers that might cause decompression or agent issues
    delete headers['connection'];
    delete headers['accept-encoding'];

    const res = await fetch(targetUrl, {
      method,
      headers,
    });
    
    const contentType = res.headers.get('Content-Type') || 'application/json';
    const status = res.status;
    
    // Determine if the content is binary (m3u8-proxy, image, segment etc.)
    const isBinary = contentType.includes('video/') || contentType.includes('image/') || pathname.includes('m3u8-proxy') || pathname.includes('img');
    
    let body;
    if (isBinary) {
      const arrayBuffer = await res.arrayBuffer();
      body = Buffer.from(arrayBuffer);
    } else {
      const text = await res.text();
      body = Buffer.from(text, 'utf-8');
    }
    
    // Capture headers
    const resHeaders = {};
    for (const [key, val] of res.headers.entries()) {
      resHeaders[key] = val;
    }
    
    return {
      status,
      body,
      contentType,
      isBinary,
      resHeaders,
    };
  } catch (err) {
    console.error(`[dev-api proxy] Error routing ${pathname} to Cloudflare:`, err.message);
    return {
      status: 500,
      body: Buffer.from(JSON.stringify({ error: err.message })),
      contentType: 'application/json',
      isBinary: false,
    };
  }
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const parsed = urlModule.parse(req.url, true);
  const pathname = parsed.pathname || '/';
  const searchParams = new URLSearchParams(parsed.search || '');

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Api-Key, Range');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (!pathname.startsWith('/api/') && !pathname.startsWith('/tmdb/') && !pathname.startsWith('/img/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not an allowed path' }));
    return;
  }

  const isM3u8Proxy = pathname.startsWith('/api/m3u8-proxy');
  const isBinaryLikely = isM3u8Proxy;

  // Log (shorter for binary proxy to avoid spam)
  if (!isBinaryLikely || process.env.VERBOSE_API) {
    console.log(`[dev-api] ${req.method} ${pathname}${parsed.search ? parsed.search.slice(0, 80) + '...' : ''}`);
  }

  const result = await routeRequest(pathname, searchParams, req.method, req.headers);

  // Build response headers
  const headers = {
    'Content-Type': result.contentType,
    'Access-Control-Allow-Origin': '*',
  };

  // Pass through specific upstream headers for m3u8/stream content
  if (result.resHeaders) {
    const passThrough = ['Content-Range', 'Accept-Ranges', 'X-Proxy-Source'];
    for (const h of passThrough) {
      if (result.resHeaders[h] || result.resHeaders[h.toLowerCase()]) {
        headers[h] = result.resHeaders[h] || result.resHeaders[h.toLowerCase()];
      }
    }
  }

  res.writeHead(result.status, headers);
  res.end(result.body);
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
});
