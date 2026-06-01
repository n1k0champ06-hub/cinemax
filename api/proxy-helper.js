import { HttpsProxyAgent } from 'https-proxy-agent';
import fetch from 'node-fetch';

let cachedProxy = null;
let lastFetched = 0;
let cachedAgent = null;

/**
 * Retrieves the current proxy from proxyxoay API, caches it to avoid rate limits,
 * and returns an HttpsProxyAgent configured with the proxy credentials.
 */
export async function getProxyAgent() {
  const now = Date.now();
  // Cache the proxy agent for 3 minutes to stay within API rate limits
  if (cachedAgent && cachedProxy && (now - lastFetched < 180000)) {
    return cachedAgent;
  }

  const proxyKey = process.env.PROXY_KEY || 'Icat5S0eQRqXLfIz5Txh';
  try {
    const res = await fetch(`https://api.proxyxoay.org/api/key_xoay.php?key=${proxyKey}&live=5`);
    const data = await res.json();
    
    if (data && data.proxyhttp) {
      const proxyStr = data.proxyhttp.trim();
      if (proxyStr && proxyStr !== cachedProxy) {
        const parts = proxyStr.split(':');
        if (parts.length === 4) {
          const [ip, port, username, password] = parts;
          const proxyUrl = `http://${username}:${password}@${ip}:${port}`;
          cachedProxy = proxyStr;
          cachedAgent = new HttpsProxyAgent(proxyUrl);
          lastFetched = now;
          console.log('[ProxyHelper] Configured new ProxyAgent:', `${ip}:${port}`);
        }
      }
    }
  } catch (err) {
    console.error('[ProxyHelper] Error fetching rotating proxy:', err.message);
  }

  // Fallback to previous active agent if API fails
  return cachedAgent;
}

/**
 * Custom fetch wrapper that automatically routes requests through the proxy if available
 */
export async function proxyFetch(url, options = {}) {
  const agent = await getProxyAgent();
  if (agent) {
    return fetch(url, {
      ...options,
      agent,
    });
  }
  return fetch(url, options);
}
