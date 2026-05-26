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
    `https://phimapi.com/${path1}`,
    `https://phimapi.com/${path2}`,
    `https://ophim1.com/${path1}`
  ];
  const results = await Promise.allSettled(sources.map(url => fetch(url).then(r => r.json())));
  const merged: any[] = [];
  results.forEach(res => {
    if (res.status === 'fulfilled' && res.value) {
      const v = res.value;
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
    `https://phimapi.com/v1/api/tim-kiem?keyword=${encodedKw}&limit=30`,
    `https://ophim1.com/v1/api/tim-kiem?keyword=${encodedKw}&limit=30`
  ];

  const results = await Promise.allSettled(sources.map(url => fetch(url).then(r => r.json()).then(data => ({url, data}))));
  const merged: any[] = [];
  results.forEach(res => {
    if (res.status === 'fulfilled') {
      const v = res.value.data;
      const pathImage = v?.data?.APP_DOMAIN_CDN_IMAGE || v?.pathImage || 'https://phimimg.com/';
      if (v?.data?.items) {
         v.data.items.forEach((item: any) => {
           let poster = typeof item.poster_url === 'string' ? item.poster_url : '';
           let thumb = typeof item.thumb_url === 'string' ? item.thumb_url : '';
           if (poster && !poster.startsWith('http')) poster = pathImage.endsWith('/') ? `${pathImage}${poster}` : `${pathImage}/${poster}`;
           if (thumb && !thumb.startsWith('http')) thumb = pathImage.endsWith('/') ? `${pathImage}${thumb}` : `${pathImage}/${thumb}`;
           merged.push({ ...item, poster_url: poster, thumb_url: thumb });
         });
      }
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

export const fetchDetail = async (slug: string) => {
  const sources = [
    { name: 'OPhim', url: `https://ophim1.com/phim/${slug}` },
    { name: 'PhimAPI', url: `https://phimapi.com/phim/${slug}` }
  ];
  
  const results = await Promise.allSettled(sources.map(s => fetch(s.url).then(r => r.json()).then(data => ({ sourceName: s.name, data }))));
  
  let baseMovie: any = null;
  const allEpisodes: any[] = [];
  
  results.forEach(res => {
    if (res.status === 'fulfilled' && res.value.data?.status && res.value.data?.movie) {
      if (!baseMovie) {
        baseMovie = res.value.data.movie;
        // Merge the episode data format exactly like Ophim provides
      }
      
      const eps = res.value.data.episodes;
      if (Array.isArray(eps)) {
        eps.forEach(ep => {
          allEpisodes.push({
            server_name: `${res.value.sourceName} - ${ep.server_name || 'Server'}`,
            server_data: ep.server_data
          });
        });
      }
    }
  });

  if (!baseMovie) throw new Error("Not found");
  
  return { movie: baseMovie, episodes: allEpisodes };
};
