# CLAUDE.md - Developer Guide & Project Blueprint

This file outlines the codebase architecture, development workflows, core application flows, and rules for future AI agents working on the Cinemax project.

---

## 🛠️ Architecture & Deployment Setup

Cinemax is built as a split stack architecture:
- **Frontend App**: Hosted on **Vercel** (project `netflix-clone`, custom production domain: `focusflow.id.vn`). Deploys automatically on git push to the `main` branch, or manually using the Vercel CLI.
- **Backend Edge Proxies**: Hosted on **Cloudflare Workers** (`cinemax-backend-proxy` at `cloudflare-worker.js` and `cinepro-core`). Handles serverless backend scripts, AniList lookups, subtitles, and request proxying to bypass CORS.
- **Local Emulation**: For local development, an Express server emulates Vercel Edge Serverless functions on port `3001` (`scripts/dev-api.cjs`), loading proxy endpoints dynamically from `api/*.js`.

---

## 🚀 Key Commands

- **Start Frontend Dev Server**: `npm run dev` (Runs Vite on port `3000`)
- **Start Backend Dev Server**: `npm run api` (Runs the Node dev-api proxy server on port `3001`)
- **Lint / Type Check**: `npm run lint` (`tsc --noEmit`)
- **Deploy Frontend (Vercel)**: `vercel --prod` (or push commits to the `main` branch)
- **Deploy Backend (Cloudflare Worker)**: `npx wrangler deploy`

---

## 📍 Key Directory & Component Map

### 1. Frontend Core (`src/`)
- [App.tsx](file:///c:/Users/cykab/Downloads/cinemax/src/App.tsx): App router, initializes selected movie states and syncs query params (`tab`, `movie`, `play`, `ep`, `season`).
- [src/components/movie/](file:///c:/Users/cykab/Downloads/cinemax/src/components/movie/): Contains rows, grids, details drawer, and card renders.
  - [MovieDetail.tsx](file:///c:/Users/cykab/Downloads/cinemax/src/components/movie/MovieDetail.tsx): Details layout. Renders metadata, seasons, episode lists, and integrates the player.
  - [MovieCard.tsx](file:///c:/Users/cykab/Downloads/cinemax/src/components/movie/MovieCard.tsx): Landscape or poster cards. Always calls TMDB details in the background if `tmdbId` is resolved to display high-quality posters.
  - [RankingCard.tsx](file:///c:/Users/cykab/Downloads/cinemax/src/components/movie/RankingCard.tsx): Standard carousel/ranking card with giant position numbers.
- [src/components/player/NetflixPlayer.tsx](file:///c:/Users/cykab/Downloads/cinemax/src/components/player/NetflixPlayer.tsx): Premium HTML5 custom video player supporting HLS, embed iframes, keyboard controls, subtitle tracks, and audio boost.

### 2. Hooks & Utilities
- [src/hooks/movie/useMovieDetail.ts](file:///c:/Users/cykab/Downloads/cinemax/src/hooks/movie/useMovieDetail.ts): Resolves movie data structures, details fallback, actors list, and validates active states.
- [src/hooks/movie/usePrefetchMovie.ts](file:///c:/Users/cykab/Downloads/cinemax/src/hooks/movie/usePrefetchMovie.ts): Pre-caches queries on hover/touch without triggering state or selection callbacks.
- [src/hooks/useStorage.ts](file:///c:/Users/cykab/Downloads/cinemax/src/hooks/useStorage.ts): Standard wrapper for `localStorage` collections (`cinemax_mylist` and `cinemax_progress`).

---

## 🔄 Core Flows & AI Rules

### 1. Direct TMDB Selection Flow (No Intermediate Redirection Modals)
- **Selection**: Cards call `onSelect` with the native TMDB slug structure: `tmdb-${id}-tv` or `tmdb-${id}-movie`.
- **App State**: [App.tsx](file:///c:/Users/cykab/Downloads/cinemax/src/App.tsx) immediately sets the selection state to the TMDB slug and passes it to `<MovieDetail key={selectedMovieSlug} slug={selectedMovieSlug} ... />`. Remounting via the `key` is required to clean transition state leaks.
- **Details Resolving**: `useMovieDetail` disabled KKPhim/OPhim base fetches for TMDB slugs and queries the TMDB API. If the series is a TV show, [MovieDetail.tsx](file:///c:/Users/cykab/Downloads/cinemax/src/components/movie/MovieDetail.tsx) runs the `season-servers` query in parallel, performing search lookups dynamically on KKPhim/OPhim using the show name and season index, matching episodes asynchronously.

### 2. Search Results Consolidation
- To prevent separate season listings (such as Season 1, 2, and 3 of "From") from cluttering search grids, search results in [phimApi.ts](file:///c:/Users/cykab/Downloads/cinemax/src/api/phimApi.ts) are grouped by `tmdb_id`.
- Duplicate seasons are merged into a single entry displaying the latest season's release year. Its slug is rewritten to the native TMDB format (e.g. `tmdb-124364-tv`), redirecting selections directly to the multi-season native view.

### 3. Jikan Anime Discover Page Deduplication
- Under `DiscoverPage.tsx` (when browsing the "Anime" media type), results loaded from the Jikan API are deduplicated by their normalized English/main title to merge different formats (TV, OVAs, Movies) into a single main TV series listing.

### 4. Watch History Progress Tracking (Mobile & Embeds)
- To support history tracking in mobile and browser modes that fallback to embeds/iframes (CORS restricted), the player registers progress inside [NetflixPlayer.tsx](file:///c:/Users/cykab/Downloads/cinemax/src/components/player/NetflixPlayer.tsx) using the `isIframeMode` check.
- If in iframe mode, progress is saved immediately on player load (with `currentTime: 0, duration: 100`) so the title appears in the home page's **"Tiếp tục xem"** row.

### 5. ESM Guidelines & Types
- The project runs as type `"module"` in Node. Always use ES modules (`import`/`export`) rather than CommonJS (`require`).
- Keep files typed and verify all TS/lint rules pass with `npm run lint` before deployments.
