# CLAUDE.md — Cinemax Agent Directives

> Tài liệu kỹ thuật cho AI agent. Đọc kỹ trước khi sửa code hoặc deploy.
> **LUÔN đọc section `## ❌ Anti-Patterns` và `## 🗃️ Module Ownership` trước khi chạm vào bất kỳ file nào.**

---

## 🗺️ System Architecture

```mermaid
graph TD
    %% Define Styles
    classDef client fill:#3b82f6,stroke:#1d4ed8,stroke-width:2px,color:#fff,rx:8px,ry:8px;
    classDef cf fill:#f59e0b,stroke:#b45309,stroke-width:2px,color:#fff,rx:8px,ry:8px;
    classDef render fill:#10b981,stroke:#047857,stroke-width:2px,color:#fff,rx:8px,ry:8px;
    classDef db fill:#8b5cf6,stroke:#5b21b6,stroke-width:2px,color:#fff,rx:8px,ry:8px;
    classDef ai fill:#ec4899,stroke:#be185d,stroke-width:2px,color:#fff,rx:8px,ry:8px;

    %% Nodes
    User("👤 User Browser<br/>(focusflow.id.vn)"):::client
    CF_Pages("⚡ Cloudflare Pages<br/>(React SPA)"):::cf
    CF_Worker("🌩️ Cloudflare Worker<br/>(cinemax-backend-proxy)"):::cf
    CF_KV("💾 Cloudflare KV<br/>(MOVIE_CACHE)"):::cf
    Render("☁️ Render Bridge<br/>(hollysheesh-bridge)"):::render
    CinePro("🍿 CinePro Core<br/>(Worker)"):::cf
    Mongo("🍃 MongoDB Atlas<br/>(cluster0.axhiwhx)"):::db
    Gemini("🧠 Gemini API<br/>(AI Mapping Engine)"):::ai

    %% Connections
    User <-->|Static Files| CF_Pages
    User <-->|API Calls (/api, /tmdb, /img)| CF_Worker
    
    CF_Worker <-->|HLS/Embed Proxy| CinePro
    CF_Worker <-->|Read/Write Mappings| CF_KV
    CF_Worker <-->|Cron Job (AI Sync)| Gemini
    CF_Worker <-->|VI CDN Proxy (/proxy/m3u8)| Render
    
    Render <-->|Read/Write Streams| Mongo
```

### 📂 File Structure & Directory Map
Để Agent không cần phải `list_dir` nhiều lần, đây là sơ đồ kiến trúc thư mục cốt lõi:
```
cinemax/
├── cloudflare-worker.js         # Toàn bộ logic Backend (Cloudflare Worker): Proxy TMDB, Proxy M3U8, HLS, Subtitles, AI Mapping Engine
├── wrangler.json                # Cấu hình deploy Worker, Cron Trigger, KV Namespace binding
├── hollysheesh-bridge/          # (Render Backend Node.js)
│   ├── server.cjs               # API Server & M3U8 Proxy bypass Cloudflare IP block
│   └── seed.cjs                 # Script cào phim từ KKPhim đổ vào MongoDB
├── scripts/
│   └── dev-api.cjs              # API Emulator dùng để chạy localhost
└── src/
    ├── api/                     # 🔌 Data Fetching Layer (Không chứa UI)
    │   ├── cineproApi.ts        # Gọi CinePro Core, `buildProxiedM3u8Url()`
    │   ├── streamProviders/     # 🎬 Quản lý nguồn phát (Ophim, KKPhim, NguonC)
    │   │   ├── types.ts         # Types & `computeScore()` algorithm
    │   │   └── viProviders.ts   # Logic search nguồn Việt, chấm điểm & lấy tập phim
    │   ├── aiMappingApi.ts      # Fetch Cloudflare KV AI mappings
    │   ├── phimApi.ts           # Fetch TMDB (phim mới, trending, related)
    │   ├── anilistApi.ts        # Fetch Anime (AniMapper)
    │   └── subtitleApi.ts       # Quản lý Subdl/Stremio
    ├── components/
    │   ├── movie/               # Component hiển thị phim (MovieCard, MovieDetail, MovieRows)
    │   ├── player/              # Logic Trình phát Video (NetflixPlayer, SubtitleOverlay, Settings)
    │   ├── layout/              # NavBar, Footer
    │   └── pages/               # Các trang chính (Home, Discover, Search, Swipe, Profile)
    └── hooks/                   # 🪝 React Hooks chứa Business Logic
        ├── movie/
        │   └── useMovieDetail.ts  # Tính toán & Merge thông tin TMDB + IMDb
        └── useStreamAggregator.ts # Kéo luồng (streams) song song từ mọi nguồn
```

### 🤖 Antigravity MCP Integration Guide
Dự án được tối ưu để agent thao tác nhanh qua MCP:
1. **codebase-memory-mcp**:
   - Sử dụng tool `search_graph(name_pattern=".*computeScore.*")` thay vì `grep_search` để hiểu flow chấm điểm phim.
   - Sử dụng `trace_path(function_name="fetchFromVietnameseApi")` để xem nó gọi đến `fetchAiMapping` và fallback như thế nào.
2. **scrapling**:
   - Khi cần trích xuất DOM hoặc class HTML từ Ophim, PhimAPI để sửa lỗi crawler, dùng tool `get` hoặc `stealthy_fetch` của scrapling thay vì viết script local Node.js.

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

## ❌ Anti-Patterns — Đừng làm những thứ này

> Agent hay tự phát minh lại wheel hoặc làm theo cách sai. Danh sách này là "bẫy" đã từng xảy ra.

### DOM & React
- ❌ `document.body.style.overflow = 'hidden'` → ✅ `document.body.classList.add('overflow-hidden')`
  - *Lý do: inline style capture/restore tạo race condition với animation exit*
- ❌ `useEffect` với pattern `const orig = X; set X; return () => X = orig` cho mutable DOM → dễ capture sai giá trị
- ❌ Dùng `state` cho giá trị không cần re-render (video currentTime, timers) → dùng `ref`
- ❌ `useEffect(() => {...}, [slug])` khi chỉ cần chạy 1 lần lúc mount → dependency array sai

### Architecture
- ❌ Thêm stream/source logic vào component files (MovieDetail, NetflixPlayer) → ✅ thuộc `src/api/streamProviders/viProviders.ts`
- ❌ Thêm route mới vào `cloudflare-worker.js` mà không update `wrangler.json` nếu cần binding
- ❌ Gọi trực tiếp `graphql.anilist.co` → ✅ dùng AniMapper REST qua `/api/anilist`
- ❌ Tạo file `.ts` mới trong `scripts/` → dùng `.cjs` (CommonJS) vì Node scripts không có bundler

### Agent Workflow
- ❌ Dùng `grep_search` để navigate codebase → ✅ dùng `search_graph` / `trace_path` từ codebase-memory-mcp
- ❌ Đọc toàn bộ file > 500 lines → đọc từng section theo mục tiêu, dùng `get_code_snippet` MCP
- ❌ Commit mà chưa chạy `npm run lint` (tsc --noEmit)

---

## 🗃️ Module Ownership — File nào làm gì

Khi nhận task, map task → module trước, chỉ đọc file liên quan:

| Domain | File chính | File phụ |
|--------|------------|----------|
| Stream sources (VI) | `src/api/streamProviders/viProviders.ts` | `src/hooks/useStreamAggregator.ts` |
| Stream scoring algorithm | `src/api/streamProviders/types.ts` | — |
| Player UI & controls | `src/components/player/NetflixPlayer.tsx` | `PlayerSelect.tsx`, `StreamPicker.tsx` |
| Subtitle display | `src/components/player/SubtitleOverlay.tsx` | `src/api/subtitleApi.ts` |
| Movie metadata (TMDB+IMDb) | `src/hooks/movie/useMovieDetail.ts` | `src/api/phimApi.ts` |
| Movie detail page | `src/components/movie/MovieDetail.tsx` | `TvSeasons.tsx`, `MovieCollection.tsx` |
| Backend proxy routes | `cloudflare-worker.js` (monolith có comment blocks) | `wrangler.json` |
| Render bridge API | `hollysheesh-bridge/server.cjs` | — |
| MongoDB seeder | `hollysheesh-bridge/seed.cjs` | — |
| Routing & page layout | `src/App.tsx` | `src/components/layout/` |
| Home page rows | `src/components/movie/MovieRows.tsx` | `src/components/Hero.tsx` |

**Quy tắc:** Nếu task liên quan đến A mà phải sửa file của B → **dừng lại, hỏi trước**.

---

## 🔗 Agent Sub-Context

Context chuyên biệt cho từng domain — đọc file này thay vì đọc toàn bộ code:

| Domain | Context File | Khi nào đọc |
|--------|-------------|-------------|
| Player & Video | [`src/components/player/AGENTS.md`](file:///c:/Users/cykab/Downloads/cinemax/src/components/player/AGENTS.md) | Sửa player, subtitle, stream picker |
| Stream Providers | [`src/api/streamProviders/AGENTS.md`](file:///c:/Users/cykab/Downloads/cinemax/src/api/streamProviders/AGENTS.md) | Sửa nguồn phát, scoring, thêm provider |

---

## 🐛 Known Issues & Fixes

| Issue | Root Cause | Fix | Anti-Pattern tránh lặp |
|---|---|---|---|
| HOLLYSHEESH không hiện | MongoDB trống (chưa seed) | `node hollysheesh-bridge/seed.cjs 50` | Đừng hardcode stream URL vào code |
| KKPhim/OPhim loading mãi | kkphimplayer7.com block Cloudflare IPs | Route qua Render `/proxy/m3u8` trong `buildProxiedM3u8Url()` | Đừng bỏ qua VI CDN routing logic |
| Phải reload mới đủ nguồn | `serversLength` trong `queryKey` → re-fetch | Đã bỏ `serversLength` khỏi `queryKey` | Đừng thêm length/count vào queryKey |
| Render cold start ~50s | Free tier sleep sau 15 phút | Cloudflare cron keep-alive mỗi 10 phút | — |
| wrangler deploy xóa Dashboard vars | Vars set trên Dashboard không có trong `wrangler.json` | Luôn add vars mới vào `wrangler.json` trước khi deploy | Đừng set secret chỉ trên Dashboard |
| Body scroll bị lock sau back | `body.style.overflow` capture race condition | `classList.add/remove('overflow-hidden')` | Xem Anti-Patterns → DOM |
| URL history spam khi đổi tập/season | `pushState` tạo quá nhiều history entries | Dùng `replaceState` thay vì `pushState` trong MovieDetail URL sync | Đừng revert về `pushState` cho URL sync |
