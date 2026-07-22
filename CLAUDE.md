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
    
    CF_Worker <-->|HLS/Embed Proxy (/api/m3u8-proxy)| CinePro
    CF_Worker <-->|Read/Write Mappings| CF_KV
    CF_Worker <-->|Cron Job (AI Sync)| Gemini
    CF_Worker <-->|VI CDN Proxy (/proxy/m3u8)| Render
    
    Render <-->|Read/Write Streams| Mongo
```

### 📂 File Structure & Directory Map
Sơ đồ kiến trúc thư mục cốt lõi của dự án:
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
    │   ├── streamProviders/     # 🎬 Quản lý nguồn phát (Ophim, KKPhim, NguonC, Hollysheesh, AniMapper, HiAnime)
    │   │   ├── types.ts         # Types & `computeScore()` algorithm
    │   │   ├── viProviders.ts   # Logic search nguồn Việt, chấm điểm & lấy tập phim
    │   │   ├── animapperProvider.ts # Nguồn Anime Vietsub (AniMapper REST API)
    │   │   └── hianimeProvider.ts  # Nguồn HiAnime (MegaCloud decryptor)
    │   ├── aiMappingApi.ts      # Fetch Cloudflare KV AI mappings
    │   ├── phimApi.ts           # Fetch TMDB (phim mới, trending, related)
    │   ├── anilistApi.ts        # Fetch Anime metadata qua AniMapper REST (`/api/anilist`)
    │   └── subtitleApi.ts       # Quản lý Subdl/Stremio
    ├── components/
    │   ├── movie/               # Component hiển thị phim (MovieCard, MovieDetail, MovieRows, TvSeasons)
    │   ├── player/              # Logic Trình phát Video (NetflixPlayer, SubtitleOverlay, Settings)
    │   ├── layout/              # NavBar, Footer
    │   └── pages/               # Các trang chính (Home, Discover, Search, Swipe, Profile)
    └── hooks/                   # 🪝 React Hooks chứa Business Logic
        ├── movie/
        │   └── useMovieDetail.ts  # Unified TMDB & IMDb Metadata, Lifted Season State & Season-aware AniList ID Resolution
        └── useStreamAggregator.ts # Kéo luồng (streams) song song từ mọi nguồn (VI, VIP, International)
```

---

## 🔍 Stream Flow & Proxy Architecture

### 1. HLS Proxy Routing & Direct VI CDN Bypass
- **VI CDN Direct Streaming (KKPhim, OPhim, PhimAPI, NguonC):** Các nguồn HLS Việt Nam có CORS `Allow-Origin: *` bắt buộc phải **phát trực tiếp từ trình duyệt** (`isViCDN` check trong `cineproApi.ts`), KHÔNG được đi qua `/api/m3u8-proxy` vì IP của Cloudflare Worker bị VI CDN chặn `403 Forbidden`.
- **International / Protected Streams:** Các nguồn quốc tế hoặc cần Header Referer đặc thù mới đi qua `/api/m3u8-proxy` (Cloudflare Worker Proxy):
```
Browser → buildProxiedM3u8Url(rawUrl, referer)
            ├─ VI CDN? → Stream direct from browser client IP
            └─ Other Stream → /api/m3u8-proxy?url=<encoded_url>&referer=<encoded_referer>
```

### 2. HOLLYSHEESH Source Flow
```
User opens movie / episode
  → useStreamAggregator → hollysheeshProvider.fetchStreams()
  → GET /api/admin/scraper/streams?slug=...&episode=...
  → Cloudflare Worker → GET https://hollysheesh-bridge.onrender.com/api/admin/scraper/streams
  → MongoDB Atlas lookup (movies + streams collections)
  → Return real stream URLs (from KKPhim/OPhim seeds)
  → Player plays via /api/m3u8-proxy or Render bridge /proxy/m3u8
```

---

## 🎯 TMDB Primary Database & Season Unified Architecture

1. **TMDB làm Database Gốc (Single Source of Truth):**
   - Mọi bộ phim lẻ, phim bộ và **Anime** đều lấy TMDB làm ID chính (dạng `tmdb-${id}-movie` hoặc `tmdb-${id}-tv`).
   - Các Season Anime (VD: *Jujutsu Kaisen Season 1, Season 2*) được gộp chung dưới cùng 1 trang TMDB duy nhất.
2. **Season-aware AniList Resolution:**
   - Khi ở Season $X$, hệ thống tự động tìm kiếm AniList ID theo từ khóa `"Tên Phim Season X"` (qua `useMovieDetail.ts` & `/api/anilist`).
   - AniMapper dùng `anilistId` này để kéo đúng các nguồn phát Vietsub/Lồng tiếng chuẩn xác cho mùa tương ứng.

---

## 🚀 Deployment Gates & Workflows

| Layer | Platform | Deploy Command |
|---|---|---|
| **Frontend (SPA)** | Cloudflare Pages (`cinemax`) | `npm run build` → `npx wrangler pages deploy dist --project-name cinemax --branch main` |
| **Backend Worker** | Cloudflare Workers (`cinemax-backend-proxy`) | `npx wrangler deploy` |
| **Hollysheesh Bridge** | Render.com (auto-deploy từ GitHub `main`) | `git push` → Render tự động build `hollysheesh-bridge/` |

> ⚠️ **QUAN TRỌNG:** `git push` KHÔNG tự động deploy Cloudflare Worker hay Cloudflare Pages. Bạn phải chạy `npx wrangler deploy` riêng khi thay đổi backend worker.

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

---

## 🛠️ Dev Commands

```bash
npm run dev      # Frontend dev server (port 3000)
npm run api      # Local API emulator (port 3001) — dev-api.cjs
npm run build    # Production build → dist/
npm run lint     # TypeScript check (tsc --noEmit)

npx wrangler deploy   # Deploy Cloudflare Worker
```

---

## 📍 Key Files & Responsibility Map

| File | Purpose |
|---|---|
| [`src/App.tsx`](file:///c:/Users/cykab/Downloads/cinemax/src/App.tsx) | Router, Navigation Tabs & Page Manager |
| [`src/components/movie/MovieDetail.tsx`](file:///c:/Users/cykab/Downloads/cinemax/src/components/movie/MovieDetail.tsx) | Detail modal, episode selection, player launcher, season switcher |
| [`src/hooks/movie/useMovieDetail.ts`](file:///c:/Users/cykab/Downloads/cinemax/src/hooks/movie/useMovieDetail.ts) | Lifted season states, TMDB & IMDb resolution, AniList ID mapping |
| [`src/hooks/useStreamAggregator.ts`](file:///c:/Users/cykab/Downloads/cinemax/src/hooks/useStreamAggregator.ts) | Parallel stream provider orchestrator & direct server stream injection |
| [`src/api/cineproApi.ts`](file:///c:/Users/cykab/Downloads/cinemax/src/api/cineproApi.ts) | `buildProxiedM3u8Url()` — proxy routing qua Cloudflare Worker |
| [`src/api/streamProviders/viProviders.ts`](file:///c:/Users/cykab/Downloads/cinemax/src/api/streamProviders/viProviders.ts) | OPhim, KKPhim, NguonC, Xem20, Hollysheesh providers |
| [`src/api/streamProviders/animapperProvider.ts`](file:///c:/Users/cykab/Downloads/cinemax/src/api/streamProviders/animapperProvider.ts) | AniMapper REST provider (Anime Vietsub/Lồng tiếng) |
| [`docs/AniMapper_Documentation.md`](file:///c:/Users/cykab/Downloads/cinemax/docs/AniMapper_Documentation.md) | Tài liệu kỹ thuật & API Spec đầy đủ của AniMapper |
| [`src/components/player/NetflixPlayer.tsx`](file:///c:/Users/cykab/Downloads/cinemax/src/components/player/NetflixPlayer.tsx) | HLS & Iframe player, stream selection drawer, watch progress saving |
| [`cloudflare-worker.js`](file:///c:/Users/cykab/Downloads/cinemax/cloudflare-worker.js) | Cloudflare Worker Backend API Router |
| [`wrangler.json`](file:///c:/Users/cykab/Downloads/cinemax/wrangler.json) | Worker configuration (routes, env vars, cron triggers) |

---

## ❌ Anti-Patterns (Bắt Buộc Tránh)

### DOM & React State
- ❌ **KHÔNG** set `document.body.style.overflow` trực tiếp → PHẢI dùng `document.body.classList.add/remove('overflow-hidden')`.
- ❌ **KHÔNG** dùng state cho các giá trị không gây re-render UI (như `video.currentTime`, `timers`) → Dùng `useRef`.

### Architecture & Player
- ❌ **KHÔNG** thêm stream/source fetch logic trực tiếp vào component UI (`MovieDetail.tsx`, `NetflixPlayer.tsx`) → PHẢI để trong `src/api/streamProviders/`.
- ❌ **KHÔNG** gọi trực tiếp `graphql.anilist.co` → PHẢI dùng AniMapper REST qua route `/api/anilist`.
- ❌ **KHÔNG** tạo file `.ts` mới trong thư mục `scripts/` → PHẢI dùng `.cjs` (CommonJS).
- ❌ **KHÔNG** ghi đè `selectedServerId` khi người dùng chọn stream thủ công từ drawer `NetflixPlayer` → Tránh tạo race-condition với effect đồng bộ server.
- ❌ **KHÔNG** trả về `embedUrl` (VidSrc/CinemaOS fallback) khi `activeStream` đã có luồng HLS → PHẢI trả `resolvedEmbedUrl = null` để render `<video>` thay vì `<iframe>`.
- ❌ **KHÔNG** giảm thông số Hls.js buffer (`maxBufferLength: 180s`, `maxBufferSize: 150MB`) trong `NetflixPlayer.tsx` với lý do "tối ưu bộ lọc" → Giữ nguyên buffer lớn để người dùng tua phim mượt mà.
- ❌ **KHÔNG** để nguồn Embed (CinemaOS, VidSrc) auto-select cướp vị trí trong khi HLS đang fetch bất đồng bộ → PHẢI dùng HLS-Wait Grace Window (`hlsWaitSettled`) trong `useStreamAggregator.ts`.

### Workflow & Verification
- ❌ **KHÔNG** dùng `grep_search` để navigate codebase → PHẢI dùng `search_graph` / `trace_path` từ codebase-memory-mcp.
- ❌ **KHÔNG** đọc toàn bộ các file > 500 dòng → Dùng `get_code_snippet` MCP hoặc đọc theo section.
- ❌ **KHÔNG** commit hoặc deploy mà chưa chạy `npm run lint` (`tsc --noEmit`).

---

## 🐛 Known Issues & Solutions

| Sự cố / Hiện tượng | Nguyên nhân gốc (Root Cause) | Giải pháp chuẩn (Standard Fix) |
|---|---|---|
| **Bộ lọc quảng cáo KKPhim bị lọt (phút 14-15)** | KKPhim chèn ad segment theo **path pattern mã hex** (`/v\d+/[a-f0-9]{16,}/segment_\d+.ts`) chứ không dùng hostname quảng cáo hay từ khóa `9922`. Quảng cáo đi kèm với tag `#EXT-X-KEY` và `#EXT-X-DISCONTINUITY`. | Áp dụng thuật toán chuẩn từ `AdsSkipperRoPhim` (`SinonCute/AdsSkipperRoPhim`): Bắt pattern `/v\d+/[hex]/segment_\d+.ts`, bóc tách cả `#EXT-X-KEY` & `#EXTINF`, normalize `convertv8/` prefix (giữ file) và compact các thẻ `#EXT-X-DISCONTINUITY` liên tiếp. |
| **Trình phát ưu tiên Embed VIP hơn HLS khi vừa vào phim** | Embed providers (CinemaOS, VidSrc) trả về kết quả tức thì (sync/instant URL), trong khi HLS (KKPhim/OPhim/CinePro) cần fetch API bất đồng bộ. Khi vừa mở phim, HLS chưa kịp về thì `autoSelected` đã tự động chọn Embed. | Thiết lập **HLS-Wait Grace Window** (`hlsWaitSettled` + 4s timeout) trong `useStreamAggregator.ts`. Trong khi HLS đang load, tạm hoãn auto-select Embed cho tới khi HLS resolve xong hoặc hết 4s. |
| **Nguồn Việt Nam bị lỗi 403 khi dùng proxy** | Cloudflare Worker IP bị VI CDN (KKPhim/OPhim) chặn 403 | Thêm `VI_CDN_PATTERNS` bypass proxy để trình duyệt phát trực tiếp |
| **Lỗi phát luồng HLS khi chuyển nguồn** | `resolvedEmbedUrl` bị đè bởi fallback `embedUrl`, render `<iframe>` thay vì `<video>` | Fix `resolvedEmbedUrl = activeStream?.type === 'hls' ? null : ...` |
| **Xung đột chọn nguồn thủ công** | `handleStreamSelect` tự động đổi `selectedServerId` kích hoạt effect đồng bộ lại | Bỏ `handleStreamSelect` và dùng trực tiếp `selectStream` |
| **Render bridge cold start ~50s** | Render free tier tự ngủ sau 15 phút không dùng | Cloudflare Worker Cron `*/10 * * * *` ping `/health` |
| **Body scroll bị lock sau khi back** | `body.style.overflow` race condition | Chuyển sang `classList.add/remove('overflow-hidden')` |

