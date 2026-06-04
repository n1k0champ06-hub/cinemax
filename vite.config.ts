import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Proxy /api/*, /tmdb/*, and /img/* directly to the Cloudflare Workers edge.
      // This emulates Vercel Edge proxy redirection locally.
      proxy: {
        '/api': {
          target: 'https://cinemax-backend-proxy.cykablyatt1505.workers.dev',
          changeOrigin: true,
          secure: false,
        },
        '/tmdb': {
          target: 'https://cinemax-backend-proxy.cykablyatt1505.workers.dev',
          changeOrigin: true,
          secure: false,
        },
        '/img': {
          target: 'https://cinemax-backend-proxy.cykablyatt1505.workers.dev',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
