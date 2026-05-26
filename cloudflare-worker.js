/**
 * Cloudflare Worker Proxy script
 * Triển khai file này lên Cloudflare Workers để tạo Proxy cho TMDB và Hình ảnh
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Xử lý CORS Options
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
      });
    }

    // Proxy cho TMDB API - Sử dụng: https://[worker-url]/tmdb/movie/popular?language=vi
    if (url.pathname.startsWith("/tmdb/")) {
      const tmdbPath = url.pathname.replace("/tmdb", "");
      const tmdbUrl = new URL(`https://api.themoviedb.org/3${tmdbPath}${url.search}`);
      
      const response = await fetch(tmdbUrl, {
        headers: {
          "Authorization": `Bearer ${env.TMDB_ACCESS_TOKEN || "API_KEY_CUA_BAN_O_DAY"}`,
          "Accept": "application/json"
        }
      });

      const data = await response.text();
      return new Response(data, {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600"
        }
      });
    }

    // Proxy cho hình ảnh (Bypass nhà mạng chặn) - Sử dụng: https://[worker-url]/img/https://phimimg.com/...
    if (url.pathname.startsWith("/img/")) {
      const imageUrl = url.pathname.replace("/img/", "") + url.search;
      if (!imageUrl || !imageUrl.startsWith('http')) return new Response("Invalid URL", { status: 400 });

      const response = await fetch(imageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });

      return new Response(response.body, {
        status: response.status,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": response.headers.get("Content-Type") || "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable"
        }
      });
    }

    return new Response("PhimVN Proxy Server is running!", {
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }
};
