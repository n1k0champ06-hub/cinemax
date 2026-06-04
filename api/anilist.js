export const config = {
  runtime: 'edge', // Edge Function runtime for Vercel
};

export default async function handler(req) {
  const url = new URL(req.url);
  const search = url.searchParams.get('search');
  
  if (!search) {
    return new Response(JSON.stringify({ error: 'Missing search parameter' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  // Clean the title slightly to improve match rates
  const cleanTitle = search
    .replace(/\s*[\(\[].*?[\)\]]/g, "") // remove brackets contents
    .replace(/\s*-\s*Phần\s+\d+/gi, "") // remove " - Phần X"
    .replace(/\s*Phần\s+\d+/gi, "")     // remove "Phần X"
    .replace(/\s*Season\s+\d+/gi, "")   // remove "Season X"
    .replace(/\s*Part\s+\d+/gi, "")     // remove "Part X"
    .replace(/\s*P\d+/gi, "")           // remove "P5"
    .trim();

  const RAPIDAPI_HOST = 'Anilistmikilior1V1.p.rapidapi.com';
  const RAPIDAPI_KEY = '1349644f56mshbd1a582f9f80113p171564jsneb07bf153208';
  const RAPIDAPI_URL = 'https://anilistmikilior1v1.p.rapidapi.com/searchSeries';

  // Try RapidAPI first with a strict 2s timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);

  try {
    const response = await fetch(RAPIDAPI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': RAPIDAPI_KEY,
      },
      body: JSON.stringify({ search: cleanTitle }),
      signal: controller.signal,
    });

    if (response.ok) {
      const data = await response.json();
      const media = data?.data?.Media || data?.Media || (Array.isArray(data) ? data[0] : data);
      if (media) {
        clearTimeout(timeoutId);
        return new Response(JSON.stringify({
          extraLarge: media.coverImage?.extraLarge || media.coverImage?.large || null,
          large: media.coverImage?.large || media.coverImage?.medium || null,
          medium: media.coverImage?.medium || null,
          banner: media.bannerImage || null,
          color: media.coverImage?.color || null,
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 's-maxage=86400, stale-while-revalidate=43200'
          }
        });
      }
    }
  } catch (err) {
    // Fail silently, fallback handles it
  } finally {
    clearTimeout(timeoutId);
  }

  // Fallback to official GraphQL endpoint on server side (no CORS issue here)
  try {
    const query = `
      query ($search: String) {
        Media (search: $search, type: ANIME) {
          id
          title {
            english
            romaji
            native
          }
          coverImage {
            extraLarge
            large
            medium
            color
          }
          bannerImage
        }
      }
    `;

    const fallbackRes = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { search: cleanTitle }
      })
    });

    if (fallbackRes.ok) {
      const result = await fallbackRes.json();
      const media = result?.data?.Media;
      if (media) {
        return new Response(JSON.stringify({
          extraLarge: media.coverImage?.extraLarge || null,
          large: media.coverImage?.large || null,
          medium: media.coverImage?.medium || null,
          banner: media.bannerImage || null,
          color: media.coverImage?.color || null,
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 's-maxage=86400, stale-while-revalidate=43200'
          }
        });
      }
    }
  } catch (err) {
    console.error('[AniList Proxy API] Fallback GraphQL query failed:', err);
  }

  return new Response(JSON.stringify(null), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
