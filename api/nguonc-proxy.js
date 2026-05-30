import { proxyFetch } from './proxy-helper.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing url query parameter' });
  }

  // Restrict to phim.nguonc.com to prevent open proxy abuse
  if (!targetUrl.startsWith('https://phim.nguonc.com/')) {
    return res.status(403).json({ error: 'Domain not allowed' });
  }

  try {
    const response = await proxyFetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });

    const data = await response.text();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=1800');
    return res.status(response.status).send(data);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch NguonC API', details: error.message });
  }
}
