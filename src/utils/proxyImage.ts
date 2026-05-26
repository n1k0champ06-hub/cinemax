/// <reference types="vite/client" />

const USE_IMAGE_PROXY = import.meta.env.VITE_USE_PROXY === 'true';

export const proxyImage = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (!url.startsWith('http')) return url;
  
  if (USE_IMAGE_PROXY) {
    // If it's already a relative URL or our API route, don't proxy
    if (url.startsWith('/') && !url.startsWith('//')) return url;
    
    return `/api/img-proxy?url=${encodeURIComponent(url)}`;
  }
  
  return url;
};
