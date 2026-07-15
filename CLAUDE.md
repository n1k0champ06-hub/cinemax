# CLAUDE.md — Cinemax Agent Directives

> Tài liệu kỹ thuật cho AI agent. Đọc kỹ trước khi sửa code hoặc deploy.

---

## 🗺️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                                │
│   focusflow.id.vn  (Cloudflare Pages — React SPA)                  │
└───────────────┬─────────────────────────────────────────────────────┘
                │ API calls /api/* /tmdb/* /img/*
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│           CLOUDFLARE WORKER  (cinemax-backend-proxy)                │
│   focusflow.id.vn/api/*  |  focusflow.id.vn/tmdb/*                 │
│                                                                     │
│  Routes:                                                            │
│  ├─ /tmdb/*           → TMDB API proxy (bypass ISP block)          │
│  ├─ /img/*            → Poster image proxy                         │
│  ├─ /api/imdb-proxy   → IMDb rating + Metacritic scraper           │
│  ├─ /api/m3u8-proxy   → HLS proxy (NON-VI CDN only)               │
│  ├─ /api/cinepro-proxy → CinePro Core worker                       │
│  ├─ /api/sub-proxy    → Subtitle proxy (Subdl / Stremio)           │
│  └─ /api/admin/scraper/streams → HOLLYSHEESH bridge proxy          │
│                                                                     │
│  Cron: */10 * * * *   → ping Render bridge (keep-alive)           │
└──────────┬──────────────────────────────┬───────────────────────────┘
           │                              │
           ▼                              ▼
┌──────────────────────┐      ┌───────────────────────────────────────┐
│  CINEPRO CORE WORKER │      │  HOLLYSHEESH BRIDGE  (Render.com)     │
│  cinepro-core.cykab… │      │  hollysheesh-bridge.onrender.com      │
│                      │      │                                       │
│  - International HLS │      │  Routes:                              │
│  - MegaCloud decrypt │      │  ├─ /health           health check    │
│  - Embed sources     │      │  ├─ /api/admin/scraper/streams  ←DB   │
└──────────────────────┘      │  ├─ /api/admin/scraper/stats    ←DB   │
                              │  └─ /proxy/m3u8   HLS proxy for VI    │
                              │                   CDN (bypass CF IPs) │
                              └──────────────┬────────────────────────┘
                                             │
                                             ▼
                              ┌──────────────────────────┐
                              │   MONGODB ATLAS           │
                              │   cluster0.axhiwhx        │
                              │   DB: cinemax             │
                              │   ├─ movies collection    │
                              │   └─ streams collection   │
                              └──────────────────────────┘
```

### Stream Flow (VI Sources)

```
Browser → buildProxiedM3u8Url()
           ├─ VI CDN (kkphim, ophim, xem20, nguonc)?
           │    YES → https://hollysheesh-bridge.onrender.com/proxy/m3u8
           │           └─ Render IP (không bị block) → kkphimplayer7.com ✅
           └─ NO  → /api/m3u8-proxy (Cloudflare Worker proxy + ad-filter)
```

### HOLLYSHEESH Source Flow

```
User opens movie
  → useStreamAggregator → hollysheeshProvider.fetchStreams()
  → GET /api/admin/scraper/streams?slug=...&episode=...
  → Cloudflare Worker → GET https://hollysheesh-bridge.onrender.com/api/admin/scraper/streams
  → MongoDB Atlas lookup (movies + streams collections)
  → Return real stream URLs (from KKPhim/OPhim seeds)
  → Player plays via /proxy/m3u8 on Render bridge
```

---

## 🚀 Deployment

| Layer | Platform | Deploy Command |
|---|---|---|
| **Frontend (SPA)** | Cloudflare Pages (`cinemax`) | `npm run build` → `npx wrangler pages deploy dist --project-name cinemax --branch main` |
| **Backend Worker** | Cloudflare Workers (`cinemax-backend-proxy`) | `npx wrangler deploy` |
| **Hollysheesh Bridge** | Render.com (auto-deploy from GitHub `main`) | `git push` → Render auto-builds `hollysheesh-bridge/` |

> ⚠️ **QUAN TRỌNG:** `git push` KHÔNG deploy frontend/worker. Phải chạy wrangler thủ công.
> Render tự deploy khi push vào `main` (Root Directory: `hollysheesh-bridge`).

---

## ⚙️ Environment Variables

### Cloudflare Worker (`cinemax-backend-proxy`) — `wrangler.json` + Dashboard
| Var | Value |
|---|---|
| `CINEPRO_URL` | `https://cinepro-core.cykablyatt1505.workers.dev` |
| `GEMINI_API_KEY` | AI Studio key |
| `SUBDL_API_KEY` | Subdl API key |
| `TMDB_ACCESS_TOKEN` | TMDB v4 Bearer token |
| `VITE_SUBTITLE_ADDONS` | Stremio subtitle addon manifest URL |
| `HOLLYSHEESH_API_URL` | `https://hollysheesh-bridge.onrender.com` |

### Cloudflare Pages (`cinemax`) — Dashboard Environment Variables → Production
| Var | Value |
|---|---|
| `VITE_BACKEND_URL` | `https://focusflow.id.vn` |
| `VITE_TMDB_ACCESS_TOKEN` | TMDB v4 Bearer token |

### Render Bridge (`hollysheesh-bridge`)
| Var | Value |
|---|---|
| `MONGODB_URI` | MongoDB Atlas direct connection string (no SRV) |

> ⚠️ MongoDB dùng **direct hosts** (không phải `+srv`) vì DNS SRV không resolve trong môi trường restricted:
> `mongodb://user:pass@ac-xxxx-shard-00-00.axhiwhx.mongodb.net:27017,...`

---

## 🛠️ Dev Commands

```bash
npm run dev      # Frontend dev server (port 3000)
npm run api      # Local API emulator (port 3001) — dev-api.cjs
npm run build    # Production build → dist/
npm run lint     # TypeScript check (tsc --noEmit)

npx wrangler pages deploy dist --project-name cinemax --branch main  # Deploy frontend
npx wrangler deploy                                                    # Deploy worker
```

### Seed MongoDB (Hollysheesh data)
```bash
cd hollysheesh-bridge
node seed.cjs 50   # Crawl 50 phim mới từ KKPhim → MongoDB
```

---

## 📍 Key Files

| File | Purpose |
|---|---|
| [`src/App.tsx`](file:///c:/Users/cykab/Downloads/cinemax/src/App.tsx) | Router & page manager |
| [`src/components/movie/MovieDetail.tsx`](file:///c:/Users/cykab/Downloads/cinemax/src/components/movie/MovieDetail.tsx) | Detail modal, episodes, servers, source picker |
| [`src/hooks/movie/useMovieDetail.ts`](file:///c:/Users/cykab/Downloads/cinemax/src/hooks/movie/useMovieDetail.ts) | TMDB, IMDb, Metacritic resolution |
| [`src/hooks/useStreamAggregator.ts`](file:///c:/Users/cykab/Downloads/cinemax/src/hooks/useStreamAggregator.ts) | Parallel stream provider orchestrator |
| [`src/api/cineproApi.ts`](file:///c:/Users/cykab/Downloads/cinemax/src/api/cineproApi.ts) | `buildProxiedM3u8Url()` — routes VI CDN via Render bridge |
| [`src/api/streamProviders/viProviders.ts`](file:///c:/Users/cykab/Downloads/cinemax/src/api/streamProviders/viProviders.ts) | KKPhim, OPhim, Xem20, Hollysheesh providers |
| [`src/components/player/NetflixPlayer.tsx`](file:///c:/Users/cykab/Downloads/cinemax/src/components/player/NetflixPlayer.tsx) | HLS/iframe player, progress save |
| [`cloudflare-worker.js`](file:///c:/Users/cykab/Downloads/cinemax/cloudflare-worker.js) | Cloudflare Worker — all backend routes |
| [`wrangler.json`](file:///c:/Users/cykab/Downloads/cinemax/wrangler.json) | Worker config (routes, vars, cron) |
| [`hollysheesh-bridge/server.cjs`](file:///c:/Users/cykab/Downloads/cinemax/hollysheesh-bridge/server.cjs) | Render bridge API server |
| [`hollysheesh-bridge/seed.cjs`](file:///c:/Users/cykab/Downloads/cinemax/hollysheesh-bridge/seed.cjs) | MongoDB seeder (crawl KKPhim → Atlas) |
| [`scripts/dev-api.cjs`](file:///c:/Users/cykab/Downloads/cinemax/scripts/dev-api.cjs) | Local dev API emulator |

---

## 🔄 Core Flow Rules

### 1. TMDB Routing
- Cards dùng slug `tmdb-${id}-tv` hoặc `tmdb-${id}-movie`.
- `MovieDetail` remount via `key={selectedMovieSlug}` để isolate state.

### 2. IMDb / Metacritic
- Resolve IMDb ID từ TMDB external IDs.
- Fetch từ `/api/imdb-proxy?imdbId=...`.

### 3. Watch Progress
- Save `{currentTime, duration, tmdbId, type}` trong `NetflixPlayer` on tick/unload.
- `ContinueWatchingRow` dùng `tmdbId` + `type` để trigger TMDB bulk queries.
- Progress bar: yellow `bg-[#FBC02D]` ở bottom card.

### 4. Visual Style (StreamBerry Theme)
- Cards KHÔNG có text bên dưới trong rows.
- Landscape cards overlay logo PNG (`enDetails.logo_path`) bottom-left. Fallback: "Be Vietnam Pro" 700.
- Logo fade out on hover → show controls, metadata, badges.
- IMDb badge (vàng) và Metascore badge (color-coded) trên hover state.
- `RankingCard`: logo offset sang phải của rank number.

### 5. Stream Source Priority
```
VI Sources (Vietsub/Thuyết Minh):
  1. HOLLYSHEESH (MongoDB cache — nếu phim đã được seed)
  2. KKPHIM (phimapi.com API)
  3. OPHIM (ophim1.com API)
  4. XEM20 (xem20.net API)

Premium:
  5. CinemaOS VIP Embed

International:
  6. CinePro Core (HLS + MegaCloud)
  7. VidSrc / VidSrc Embed
```

### 6. Hollysheesh — QUAN TRỌNG
- Chỉ hiện nguồn HOLLYSHEESH nếu MongoDB có document khớp với `slug` hoặc `title` của phim.
- Để thêm phim: chạy `node hollysheesh-bridge/seed.cjs [số]` từ project root.
- VI CDN (kkphimplayer7.com, v.ophim...) **block Cloudflare IPs** → PHẢI route qua Render bridge `/proxy/m3u8`.
- Render free tier ngủ sau 15 phút → Cloudflare cron `*/10 * * * *` ping `/health` để keep-alive.

### 7. AniList (No GraphQL)
- **KHÔNG** dùng `graphql.anilist.co`.
- Dùng AniMapper REST: `https://api.animapper.net/api/v1` qua `/api/anilist`.

### 8. Coding Practices
- Node scripts dùng CJS (`.cjs`) hoặc ESM với explicit `.js` extensions.
- Chạy `npm run lint` trước khi propose changes.
- Không commit `.env` (gitignored) — set vars trên Dashboard.

---

## 🐛 Known Issues & Fixes

| Issue | Root Cause | Fix |
|---|---|---|
| HOLLYSHEESH không hiện | MongoDB trống (chưa seed) | `node hollysheesh-bridge/seed.cjs 50` |
| KKPhim/OPhim loading mãi | kkphimplayer7.com block Cloudflare IPs | Route qua Render `/proxy/m3u8` trong `buildProxiedM3u8Url()` |
| Phải reload mới đủ nguồn | `serversLength` trong `queryKey` → re-fetch | Đã bỏ `serversLength` khỏi `queryKey` |
| Render cold start ~50s | Free tier sleep sau 15 phút | Cloudflare cron keep-alive mỗi 10 phút |
| wrangler deploy xóa Dashboard vars | Vars set trên Dashboard không có trong `wrangler.json` | Luôn add vars mới vào `wrangler.json` trước khi deploy |
