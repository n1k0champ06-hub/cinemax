# CLAUDE.md - Developer Guide & Project Blueprint

This file outlines the codebase architecture, development workflows, core application flows, and guidelines for future AI agents working on Cinemax.

---

## 🛠️ Architecture & Deployment Setup

Cinemax operates on a split serverless architecture:
- **Frontend & Serverless Backend (Vercel)**: The React 19 app and the serverless functions in the `api/` directory (e.g. `api/anilist.js`, `api/sub-proxy.js`) are deployed directly to **Vercel** (`focusflow.id.vn`, project `netflix-clone`) via the Vercel CLI.
- **Edge Proxy Backend (Cloudflare)**: The proxy gateway is also deployed to **Cloudflare Workers** (`cinemax-backend-proxy` at `cloudflare-worker.js` and `cinepro-core`). It acts as a redundant edge gateway and cache layer for AniList, subtitle search, and stream providers to resolve CORS restrictions.
- **Python Movie Scraper Bot**: Located in the `scraper/` folder. Crawls external stream providers (OPhim/KKPhim), extracts stream links, checks differences, and pushes updates to the Cloudflare KV database namespace `MOVIE_CACHE`. Runs automatically via GitHub Actions `.github/workflows/scraper.yml`.
- **Local Emulation**: For local development, Express emulates the Vercel/Edge Serverless runtime on port `3001` (`scripts/dev-api.cjs`), loading proxy scripts dynamically from `api/*.js`.

---

## 🚀 Key Commands

- **Start Frontend Dev Server**: `npm run dev` (Runs Vite on port `3000`)
- **Start Backend Dev Server**: `npm run api` (Runs the Express API emulator on port `3001`)
- **Lint / Type Check**: `npm run lint` (`tsc --noEmit`)
- **Deploy Frontend (Vercel)**: `npx vercel --prod`
- **Deploy Backend (Cloudflare Worker)**: `npx wrangler deploy`
- **Run Python Scraper CLI**:
  - `python -m scraper.main --tier all --pages 3`
  - `python -m scraper.main --tier a --dry-run`

---

## 📍 Key Directory & File Map

### 1. Frontend Core (`src/`)
- [App.tsx](file:///c:/Users/cykab/Downloads/cinemax/src/App.tsx): Main router, manages search visibility and active selections.
- [src/components/movie/](file:///c:/Users/cykab/Downloads/cinemax/src/components/movie/): Renders rows, grids, details drawer, and card layouts.
  - [MovieDetail.tsx](file:///c:/Users/cykab/Downloads/cinemax/src/components/movie/MovieDetail.tsx): Details view. Renders metadata, seasons, episode lists, and integrates the player.
  - [MovieCard.tsx](file:///c:/Users/cykab/Downloads/cinemax/src/components/movie/MovieCard.tsx): Landscape/poster card. Always queries TMDB details in the background when a valid `tmdbId` is resolved to render high-quality posters.
  - [RankingCard.tsx](file:///c:/Users/cykab/Downloads/cinemax/src/components/movie/RankingCard.tsx): Horizontal card containing giant carousel ranking numbers.
- [src/components/player/NetflixPlayer.tsx](file:///c:/Users/cykab/Downloads/cinemax/src/components/player/NetflixPlayer.tsx): Premium custom HTML5 player supporting HLS, iframe embeds, audio boost, subtitles, and keyboard bindings.

### 2. Edge Backends & Proxies
- [cloudflare-worker.js](file:///c:/Users/cykab/Downloads/cinemax/cloudflare-worker.js): Production entrypoint. Maps `/api/*` endpoint routes.
- [wrangler.json](file:///c:/Users/cykab/Downloads/cinemax/wrangler.json): Cloudflare Worker config. Defines the `MOVIE_CACHE` KV namespace binding (`26fa9d0570f0473181207439732645d4`) and environment variables (`CINEPRO_URL`, `TMDB_ACCESS_TOKEN`, etc.).
- [api/](file:///c:/Users/cykab/Downloads/cinemax/api): Directory of backend serverless endpoints.
- [scripts/dev-api.cjs](file:///c:/Users/cykab/Downloads/cinemax/scripts/dev-api.cjs): Emulates serverless routing locally on port `3001`.

### 3. Movie Scraper Python Module (`scraper/`)
- [scraper/main.py](file:///c:/Users/cykab/Downloads/cinemax/scraper/main.py): Main entry point orchestrator.
- [scraper/sources.yaml](file:///c:/Users/cykab/Downloads/cinemax/scraper/sources.yaml): Configuration file defining external provider endpoints and crawl selectors.
- [scraper/kv_client.py](file:///c:/Users/cykab/Downloads/cinemax/scraper/kv_client.py): Direct API client to read/write from Cloudflare KV database.

---

## 🔄 Core Flows & AI Constraints

### 1. Direct TMDB Selection (No Redirection Modals)
- Cards call `onSelect` with TMDB slugs (`tmdb-${id}-tv` or `tmdb-${id}-movie`).
- [App.tsx](file:///c:/Users/cykab/Downloads/cinemax/src/App.tsx) updates selection state directly and remounts `<MovieDetail key={selectedMovieSlug} slug={selectedMovieSlug} ... />` to ensure a clean state slate.
- `useMovieDetail` fetches details from the TMDB API. If the series is a TV show, the `season-servers` query in [MovieDetail.tsx](file:///c:/Users/cykab/Downloads/cinemax/src/components/movie/MovieDetail.tsx) resolves the episode list by dynamically querying search terms on KKPhim/OPhim in the background.

### 2. Search Results Consolidation
- To prevent separate season listings (such as Season 1, 2, and 3 of "From") from cluttering search grids, search results in [phimApi.ts](file:///c:/Users/cykab/Downloads/cinemax/src/api/phimApi.ts) are grouped by `tmdb_id`.
- Duplicate seasons are merged into a single entry displaying the latest season's release year. Its slug is rewritten to the native TMDB format (e.g. `tmdb-124364-tv`), redirecting selections directly to the multi-season native view.

### 3. Jikan Anime Discover Page Deduplication
- Under `DiscoverPage.tsx` (when browsing the "Anime" media type), results loaded from the Jikan API are deduplicated by their normalized English/main title to merge different formats (TV, OVAs, Movies) into a single main TV series listing.

### 4. Watch History Progress Tracking (Mobile & Embeds)
- To support history tracking in mobile and browser modes that fallback to embeds/iframes (CORS restricted), the player registers progress inside [NetflixPlayer.tsx](file:///c:/Users/cykab/Downloads/cinemax/src/components/player/NetflixPlayer.tsx) using the `isIframeMode` check.
- If in iframe mode, progress is saved immediately on player load (with `currentTime: 0, duration: 100`) so the title appears in the home page's **"Tiếp tục xem"** row.

### 5. ESM Guidelines & Types
- Node scripts utilize ES modules (`import`/`export`) instead of CommonJS (`require`).
- Ensure all TS types compile cleanly with `npm run lint` before production deployments.
