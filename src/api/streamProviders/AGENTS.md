# AGENTS.md — Stream Providers Domain

> Đọc file này khi task liên quan đến: nguồn phát phim, scoring, thêm provider mới, fix VI source.
> **Không cần đọc `viProviders.ts` toàn bộ** — dùng `get_code_snippet` MCP theo provider ID.

---

## 📁 Files trong Domain này

| File | Responsibility | Kích thước |
|------|---------------|------------|
| `types.ts` | Interfaces + `computeScore()` algorithm | ~7KB ✅ Đọc được |
| `viProviders.ts` | KKPhim, OPhim, NguonC, Hollysheesh | ~32KB ⚠️ Đọc theo section |
| `embedProviders.ts` | VidSrc, 2Embed, CinemaOS embed sources | ~5KB |
| `cineproProvider.ts` | CinePro HLS (international) | ~2KB |
| `animapperProvider.ts` | AniList/Anime via AniMapper REST | ~7KB |
| `hianimeProvider.ts` | HiAnime MegaCloud decryptor | ~3KB |
| `allmangaProvider.ts` | AllManga anime streams | ~2KB |

---

## 🔌 Provider Interface Contract

Mọi provider **phải** implement interface này:

```ts
interface StreamProvider {
  id: ProviderID;      // unique string key, e.g. 'kkphim', 'ophim'
  label: string;       // display name
  lang: StreamLang;    // 'vi' | 'en' | 'multi' | 'unknown'
  group: 'vi' | 'intl' | 'hls';
  fetchStreams(query: StreamQuery): Promise<StreamItem[]>;
  // PHẢI resolve (không được reject) — trả [] nếu lỗi
}
```

---

## 📊 Scoring Algorithm — `computeScore()` trong `types.ts`

**Đừng thay đổi** algorithm này trừ khi có bug cụ thể. Score quyết định provider nào được auto-select.

Thứ tự ưu tiên hiện tại (score cao nhất lên đầu):

| Score | Provider | Lý do |
|-------|----------|-------|
| 998 | `animapper` | Anime VI Vietsub — ưu tiên tuyệt đối |
| ~109 | `kkphim` HLS + 1080p + vi | KKPhim HLS + quality + lang bonus |
| ~108 | `ophim`/`nguonc` HLS + 1080p + vi | OPhim/NguonC HLS |
| 94 | `hianime` | HiAnime MegaCloud |
| 92 | `allmanga` | AllManga anime |
| 90 | `cinepro` | CinePro international HLS |
| 75 | `ophim`/`kkphim` embed | Vietnamese embed (fallback) |
| 48 | `vidnest` | Demoted — Ad injection |
| 100 | VidSrc group | International embed |
| 45 | `cinemaos` | Slow embed |

---

## 🌐 VI CDN Routing (Quan trọng!)

VI CDN URLs (kkphimplayer7.com, v.ophim...) **bị block bởi Cloudflare IPs**.

```ts
// buildProxiedM3u8Url() trong src/api/cineproApi.ts
// Tự động detect VI CDN và route qua Render bridge:
url → isViCdn(url) === true
  → https://hollysheesh-bridge.onrender.com/proxy/m3u8?url=...
  → Render IP (không bị block) → VI CDN ✅

// ĐỪNG bypass logic này hoặc gọi VI CDN trực tiếp từ client
```

---

## 🔍 Stream Discovery Flow (VI Sources)

```
viProviders.ts → fetchFromVietnameseApi(query)
  │
  ├── 1. fetchAiMapping(tmdbId) → Cloudflare KV cached slug
  │      ↓ nếu có slug
  ├── 2. Direct slug fetch (nhanh nhất)
  │      ↓ nếu không có
  ├── 3. Title search → computeMatchScore() → chọn kết quả tốt nhất
  │      ↓ 
  └── 4. Lấy episode data → buildProxiedM3u8Url() → StreamItem
```

---

## ➕ Thêm Provider Mới

1. Tạo file `newProvider.ts` trong folder này
2. Implement `StreamProvider` interface (xem trên)
3. **PHẢI** dùng `computeScore()` từ `types.ts` để tính score, không tự hardcode
4. Register trong `src/hooks/useStreamAggregator.ts` (thêm vào array `providers`)
5. Nếu là VI CDN → wrap URL qua `buildProxiedM3u8Url()`

---

## 🚫 Không làm trong domain này

- Đừng thêm provider logic vào `MovieDetail.tsx` hay `NetflixPlayer.tsx`
- Đừng thay đổi `computeScore()` mà không update bảng score ở trên
- Đừng gọi VI CDN trực tiếp từ frontend — luôn qua `buildProxiedM3u8Url()`
- Đừng dùng `graphql.anilist.co` — dùng AniMapper REST: `https://api.animapper.net/api/v1`
