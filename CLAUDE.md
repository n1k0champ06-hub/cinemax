# CLAUDE.md - Cinemax AI Directives

Strict guidelines, architecture specifications, and flow rules for AI agents.

## 🚀 Deployment (IMPORTANT — Read Before Pushing)
- **Production platform**: **Cloudflare Pages** + **Cloudflare Workers** (NOT GitHub Actions, NOT Vercel)
- **Source control**: Repo exists at GitHub (`https://github.com/n1k0vac/netflix-clone.git`) **but CI/CD is NOT wired to GitHub** — do not assume a `git push` will deploy anything.
- **Deploy frontend**: `npm run build` → `npx wrangler pages deploy dist` (Cloudflare Pages)
- **Deploy backend worker**: `npx wrangler deploy` (Cloudflare Workers — `cloudflare-worker.js`)
- **wrangler config**: [`wrangler.json`](file:///c:/Users/cykab/Downloads/cinemax/wrangler.json)
- **Never** tell the user to "push to GitHub to deploy" — it won't work.

## 🛠️ Commands
- Frontend Dev: `npm run dev` (Port 3000)
- API Dev Emulator: `npm run api` (Port 3001)
- Typecheck/Lint: `npm run lint` (`tsc --noEmit`)
- Deploy Pages: `npx wrangler pages deploy dist`
- Deploy Worker: `npx wrangler deploy`

## 📍 Architecture & Key Files
- **App Core**: [App.tsx](file:///c:/Users/cykab/Downloads/cinemax/src/App.tsx) (router & pages manager)
- **Detail Modal**: [MovieDetail.tsx](file:///c:/Users/cykab/Downloads/cinemax/src/components/movie/MovieDetail.tsx) (details, episodes, servers, reviews)
- **Detail Hook**: [useMovieDetail.ts](file:///c:/Users/cykab/Downloads/cinemax/src/hooks/movie/useMovieDetail.ts) (TMDB, IMDb ratings, metacritic resolution)
- **Custom Player**: [NetflixPlayer.tsx](file:///c:/Users/cykab/Downloads/cinemax/src/components/player/NetflixPlayer.tsx) (HLS/iframe, progress saver)
- **Card Components**: [MovieCard.tsx](file:///c:/Users/cykab/Downloads/cinemax/src/components/movie/MovieCard.tsx), [RankingCard.tsx](file:///c:/Users/cykab/Downloads/cinemax/src/components/movie/RankingCard.tsx) (visual logo overlays)
- **Backend Worker**: [cloudflare-worker.js](file:///c:/Users/cykab/Downloads/cinemax/cloudflare-worker.js) (caching, TMDB proxy, IMDb proxy, stream proxy)
- **Local Proxy Server**: [dev-api.cjs](file:///c:/Users/cykab/Downloads/cinemax/scripts/dev-api.cjs) (Express emulator on 3001)

## 🔄 Core Flow Rules

### 1. TMDB Selection & Routing
- Cards must use slugs `tmdb-${id}-tv` or `tmdb-${id}-movie` to load detail views.
- Selection updates top-level state; `MovieDetail` must remount via `key={selectedMovieSlug}` to isolate state.

### 2. IMDb Ratings & Metacritic Scores
- Resolve IMDb ID from TMDB external IDs (`useMovieDetail.ts`).
- Fetch rating metadata from `/api/imdb-proxy?imdbId=${resolvedImdbId}` to render IMDb rating & Metacritic scores.

### 3. Watch Progress & "Continue Watching" Row
- Save progress (`currentTime`, `duration`, `tmdbId`, `type`) on tick/unload in `NetflixPlayer`.
- `ContinueWatchingRow` maps `tmdbId` to `tmdb_id` and `type` to trigger TMDB bulk queries at worker layer.
- Render progress bar with yellow (`bg-[#FBC02D]`) at card bottom.

### 4. Visual Styles (StreamBerry Theme)
- Cards MUST NOT have text below them in rows.
- Landscape cards overlay transparent logo PNG (`enDetails.logo_path`) in bottom-left. Fall back to Title Case text with font "Be Vietnam Pro" (weight 700, tracking-tight) if logo is absent.
- Logo fades out on hover (`md:group-hover:opacity-0`) to reveal controls, metadata, and rating badges.
- Render IMDb yellow badge and Metascore color-coded badge on hover state using client-side query `/api/imdb-proxy?imdbId={id}` (retrieved via TMDB bulk/single external_ids).
- For `RankingCard`, offset the logo overlay to the right of the giant rank number to avoid overlap.

### 5. AniList REST Integration (No GraphQL)
- **RESTRICTION**: Do not query `graphql.anilist.co`.
- **API**: Query AniMapper REST API (`https://api.animapper.net/api/v1`) via proxy `/api/anilist`.
- Fall back to AniMapper `units` if HiAnime episodes fail to resolve.

### 6. Coding Practices
- Express proxy scripts / Node tools must use ES Modules.
- Run `npm run lint` to verify code correctness before proposing changes.
