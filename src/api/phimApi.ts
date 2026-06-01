
export const fetchMultiSource = async (type: string, page: number = 1) => {
  const isNew = type === 'phim-moi-cap-nhat';
  const isCategory = type.startsWith('the-loai/') || type.startsWith('quoc-gia/');
  
  let path1 = '', path2 = '';
  if (isNew) {
    path1 = `danh-sach/phim-moi-cap-nhat?page=${page * 2 - 1}`;
    path2 = `danh-sach/phim-moi-cap-nhat?page=${page * 2}`;
  } else if (isCategory) {
    path1 = `v1/api/${type}?limit=24&page=${page * 2 - 1}`;
    path2 = `v1/api/${type}?limit=24&page=${page * 2}`;
  } else {
    // Like phim-bo, phim-le, hoat-hinh
    path1 = `v1/api/danh-sach/${type}?limit=24&page=${page * 2 - 1}`;
    path2 = `v1/api/danh-sach/${type}?limit=24&page=${page * 2}`;
  }
  
  const sources = [
    { name: 'KKPhim1', url: `https://phimapi.com/${path1}` },
    { name: 'KKPhim2', url: `https://phimapi.com/${path2}` },
    { name: 'OPhim', url: `https://ophim1.com/${path1}` }
  ];

  const results = await Promise.allSettled(sources.map(s => fetch(s.url).then(r => r.json()).then(data => ({ sourceName: s.name, data }))));
  const merged: any[] = [];
  
  results.forEach(res => {
    if (res.status === 'fulfilled' && res.value?.data) {
      const v = res.value.data;
      const pathImage = v?.pathImage || v?.data?.APP_DOMAIN_CDN_IMAGE || 'https://phimimg.com/';
      const rawItems = v?.items || v?.data?.items || [];
      
      const items = rawItems.map((item: any) => {
        let poster = typeof item?.poster_url === 'string' ? item.poster_url : '';
        let thumb = typeof item?.thumb_url === 'string' ? item.thumb_url : '';
        
        if (poster && !poster.startsWith('http')) {
          poster = pathImage.endsWith('/') ? `${pathImage}${poster}` : `${pathImage}/${poster}`;
        }
        if (thumb && !thumb.startsWith('http')) {
          thumb = pathImage.endsWith('/') ? `${pathImage}${thumb}` : `${pathImage}/${thumb}`;
        }
        return { ...item, poster_url: poster, thumb_url: thumb };
      });

      merged.push(...items);
    }
  });

  const unique = new Map();
  merged.forEach(item => {
    if (typeof item?.slug === 'string' && !unique.has(item.slug)) {
      unique.set(item.slug, item);
    }
  });

  return Array.from(unique.values());
};

export const fetchSearch = async (keyword: string) => {
  if (!keyword) return [];
  const encodedKw = encodeURIComponent(keyword);
  const sources = [
    { name: 'KKPhim', url: `https://phimapi.com/v1/api/tim-kiem?keyword=${encodedKw}&limit=30` },
    { name: 'OPhim', url: `https://ophim1.com/v1/api/tim-kiem?keyword=${encodedKw}&limit=30` }
  ];

  const results = await Promise.allSettled(
    sources.map(s => 
      fetchWithTimeout(s.url, {}, 5000)
        .then(r => r.json())
        .then(data => ({ sourceName: s.name, data }))
    )
  );
  const merged: any[] = [];
  
  results.forEach(res => {
    if (res.status === 'fulfilled') {
      const v = res.value.data;
      const pathImage = v?.data?.APP_DOMAIN_CDN_IMAGE || v?.pathImage || 'https://phimimg.com/';
      const rawItems = v?.data?.items || v?.items || [];
      rawItems.forEach((item: any) => {
        let poster = typeof item.poster_url === 'string' ? item.poster_url : '';
        let thumb = typeof item.thumb_url === 'string' ? item.thumb_url : '';
        if (poster && !poster.startsWith('http')) poster = pathImage.endsWith('/') ? `${pathImage}${poster}` : `${pathImage}/${poster}`;
        if (thumb && !thumb.startsWith('http')) thumb = pathImage.endsWith('/') ? `${pathImage}${thumb}` : `${pathImage}/${thumb}`;
        merged.push({ ...item, poster_url: poster, thumb_url: thumb });
      });
    }
  });

  const unique = new Map();
  merged.forEach(item => {
    const key = typeof item?.slug === 'string' ? item.slug : null;
    if (key && !unique.has(key)) {
      unique.set(key, item);
    }
  });

  return Array.from(unique.values()).map((item: any) => {
    const poster = typeof item.poster_url === 'string' ? item.poster_url : '';
    const thumb = typeof item.thumb_url === 'string' ? item.thumb_url : '';
    return {
      ...item,
      poster_url: poster.startsWith('http') ? poster : `https://phimimg.com/${poster}`,
      thumb_url: thumb.startsWith('http') ? thumb : `https://phimimg.com/${thumb}`
    };
  });
};

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 15000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

const findAlternativeSlug = async (sourceName: string, title: string, originTitle: string, year: number) => {
  try {
    let searchUrl = '';
    const keyword = originTitle || title;
    if (!keyword) return null;
    const encodedKw = encodeURIComponent(keyword);

    if (sourceName === 'OPhim') {
      searchUrl = `https://ophim1.com/v1/api/tim-kiem?keyword=${encodedKw}&limit=10`;
    } else {
      searchUrl = `https://phimapi.com/v1/api/tim-kiem?keyword=${encodedKw}&limit=10`;
    }

    const res = await fetchWithTimeout(searchUrl, {}, 2500);
    const v = await res.json();
    
    let items: any[] = [];
    items = v?.data?.items || v?.items || [];

    if (!items || items.length === 0) return null;

    // Score the items to find the best match
    const scored = items.map((item: any) => {
      const itemTitle = item.name || '';
      const itemOrigin = item.origin_name || item.original_name || '';
      const itemYear = parseInt(item.year) || 0;
      
      // Simple similarity score
      let score = 0;
      if (itemTitle.toLowerCase() === title.toLowerCase() || itemOrigin.toLowerCase() === originTitle.toLowerCase()) {
        score += 80;
      } else if (itemTitle.toLowerCase().includes(title.toLowerCase()) || itemOrigin.toLowerCase().includes(originTitle.toLowerCase())) {
        score += 50;
      }
      
      if (year && itemYear) {
        if (Math.abs(itemYear - year) <= 1) {
          score += 20;
        } else {
          score -= 30;
        }
      }
      
      return { slug: item.slug, score };
    });

    scored.sort((a, b) => b.score - a.score);
    if (scored[0] && scored[0].score >= 40) {
      return scored[0].slug;
    }
  } catch (e) {
    console.warn(`Error searching alternative slug for ${sourceName}:`, e);
  }
  return null;
};

export const fetchDetail = async (slug: string) => {
  const sources = [
    { name: 'OPhim', url: `https://ophim1.com/phim/${slug}` },
    { name: 'KKPhim', url: `https://phimapi.com/phim/${slug}` }
  ];
  
  const results = await Promise.allSettled(
    sources.map(s => 
      fetchWithTimeout(s.url, {}, 3000)
        .then(r => r.json())
        .then(data => ({ sourceName: s.name, data }))
    )
  );
  
  let baseMovie: any = null;
  const serverResultsMap: Record<string, any> = {};
  
  results.forEach(res => {
    const sourceName = (res as any).value?.sourceName || ['OPhim', 'KKPhim'][results.indexOf(res)];
    if (res.status === 'fulfilled' && res.value?.data) {
      const v = res.value.data;
      const movieObj = v.movie || v.film || v.data?.item;
      const isMovieValid = movieObj && typeof movieObj === 'object' && !Array.isArray(movieObj) && Object.keys(movieObj).length > 0;
      if (isMovieValid) {
        if (!baseMovie) {
          baseMovie = movieObj;
        }
        serverResultsMap[sourceName] = { success: true, data: v };
        return;
      }
    }
    serverResultsMap[sourceName] = { success: false };
  });

  // If no source succeeded, throw not found
  if (!baseMovie) throw new Error("Not found");

  // Normalize origin_name for NguonC base movies
  baseMovie.origin_name = baseMovie.origin_name || baseMovie.original_name || '';

  // For failed sources, try searching for alternative slugs in parallel
  const title = baseMovie.name || "";
  const originTitle = baseMovie.origin_name || "";
  const year = parseInt(baseMovie.year) || 0;

  const fallbackFetches = Object.keys(serverResultsMap).map(async (sourceName) => {
    const statusObj = serverResultsMap[sourceName];
    if (statusObj.success) return; // already succeeded

    // Try finding alternative slug
    const altSlug = await findAlternativeSlug(sourceName, title, originTitle, year);
    if (altSlug) {
      try {
        let altUrl = '';
        if (sourceName === 'OPhim') altUrl = `https://ophim1.com/phim/${altSlug}`;
        else if (sourceName === 'KKPhim') altUrl = `https://phimapi.com/phim/${altSlug}`;

        const res = await fetchWithTimeout(altUrl, {}, 2500);
        const data = await res.json();
        const movieObj = data.movie || data.film || data.data?.item;
        if ((data.status === true || data.status === "success" || movieObj) && movieObj) {
          serverResultsMap[sourceName] = { success: true, data };
          console.log(`Successfully resolved alternative slug for ${sourceName}: ${altSlug}`);
        }
      } catch (e) {
        console.warn(`Failed to fetch alternative slug details for ${sourceName}:`, e);
      }
    }
  });

  // Wait for all fallback fetches to complete
  await Promise.all(fallbackFetches);

  // Now, assemble allEpisodes
  const allEpisodes: any[] = [];
  sources.forEach(s => {
    const statusObj = serverResultsMap[s.name];
    if (statusObj.success && statusObj.data) {
      const v = statusObj.data;
      const eps = v.episodes || v.items || v.movie?.episodes || v.data?.item?.episodes;
      if (Array.isArray(eps) && eps.length > 0) {
        eps.forEach((ep: any) => {
          let server_data = ep.server_data;
          // NguonC is removed
          allEpisodes.push({
            server_name: `${s.name} - ${ep.server_name || 'VIP'}`,
            server_data: server_data,
            status: 'ok'
          });
        });
      } else {
        allEpisodes.push({
          server_name: s.name,
          server_data: [],
          status: 'empty'
        });
      }
    } else {
      allEpisodes.push({
        server_name: s.name,
        server_data: [],
        status: 'error'
      });
    }
  });

  return { movie: baseMovie, episodes: allEpisodes };
};
