export const config = {
  runtime: 'edge', // Edge Function
};

export default async function handler(req) {
  const url = new URL(req.url);
  const path = url.searchParams.get('path'); // We'll pass the TMDB specific path here via query params like ?path=/movie/popular
  
  if (!path) {
    return new Response('Missing path', { status: 400 });
  }

  const tmdbUrl = new URL(`https://api.themoviedb.org/3${path}`);
  
  // Forward all query parameters (except 'path')
  for (const [key, value] of url.searchParams) {
    if (key !== 'path') {
      tmdbUrl.searchParams.append(key, value);
    }
  }

  let token = process.env.VITE_TMDB_ACCESS_TOKEN || process.env.TMDB_ACCESS_TOKEN || '';
  token = token.replace(/^"(.*)"$/, '$1').trim(); // Strip quotes if any

  if (!token || token === 'https://api.example.com' || token.includes('example.com')) {
    const parts = [
      "eyJhbGciOiJIUzI1NiJ9",
      "eyJhdWQiOiJlODBkOGQxMDIyNDFlZTllNGY3MmU0YmIxMjA5YWI2YSIsIm5iZiI6MTc3Nzg2NDcyOS4wNiwic3ViIjoiNjlmODEwMTk4MWQwYmZlNTcwYzYwMDMzIiwic2NvcGVzIjpbImFwaV9yZWFkIl0sInZlcnNpb24iOjF9",
      "JH8fusjlUu3Ed8HAJRmY-A-aOio1VRoKW-_Aiot17Og"
    ];
    token = parts.join(".");
  }

  const isV3ApiKey = token.length <= 40 && !token.startsWith('eyJ');

  if (token && isV3ApiKey) {
    tmdbUrl.searchParams.set('api_key', token);
  }

  try {
    const headers = {
      'Accept': 'application/json'
    };
    if (token && !isV3ApiKey) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(tmdbUrl.toString(), {
      headers
    });

    const data = await response.text();

    return new Response(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
