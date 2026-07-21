# AGENTS.md — Player & Video Domain

> Đọc file này khi task liên quan đến: Player UI, HLS playback, Subtitle, Stream picker, Settings panel.
> **Không cần đọc NetflixPlayer.tsx toàn bộ** — dùng `get_code_snippet` MCP để lấy đúng section cần thiết.

---

## 📁 Files trong Domain này

| File | Responsibility | Kích thước |
|------|---------------|------------|
| `NetflixPlayer.tsx` | Main player: HLS/iframe, controls, panels, progress | ~107KB ⚠️ Đọc theo section |
| `PlayerSelect.tsx` | Dropdown chọn player source, portal rendering | ~6KB |
| `StreamPicker.tsx` | UI chọn stream/server trong panel | ~13KB |
| `SubtitleOverlay.tsx` | Render subtitle lên video | ~7KB |
| `src/api/subtitleApi.ts` | Fetch subtitle từ Subdl/Stremio | ~ngoài folder |

---

## 🧠 State Architecture trong NetflixPlayer

### Dùng `useRef` (không trigger re-render):
```ts
videoRef          // HTMLVideoElement
iframeRef         // HTMLIFrameElement
timerRef          // setTimeout handle cho hide controls
progressSaveRef   // interval handle lưu tiến độ
```

### Dùng `useState` (trigger re-render khi thay đổi):
```ts
isPlaying         // play/pause state
volume            // 0-1
currentTime       // chỉ sync mỗi giây, không realtime
buffered          // progress bar buffer
panelOpen         // 'source' | 'settings' | 'sub' | null
isFullscreen      // boolean
```

> **Trap:** Đừng thêm `useState` cho giá trị chỉ cần trong event handler (dùng `ref`).

---

## 🔗 HLS vs iFrame Switching

```
Player mode quyết định bởi: stream.url type
  ├── .m3u8 → HLS mode (hls.js)
  └── embed URL → iFrame mode
```

Khi switch source:
1. Destroy HLS instance cũ (`hls.destroy()`)
2. Set new src vào `videoRef`
3. Attach HLS lại

> **Trap:** Không được swap src trực tiếp khi HLS instance còn active → sẽ leak memory.

---

## 🔒 Scroll Lock Lifecycle

```ts
// ĐÚNG — dùng classList để tránh race condition
useEffect(() => {
  document.body.classList.add('overflow-hidden');
  return () => document.body.classList.remove('overflow-hidden');
}, []);

// SAI — inline style bị capture sai value khi re-run
// const orig = document.body.style.overflow; ← có thể capture 'hidden'
```

---

## 📐 Panel System

`panelOpen` state điều khiển side panel. Các giá trị hợp lệ:
- `'source'` — chọn stream source/server
- `'settings'` — video settings (quality, speed)
- `'sub'` — subtitle settings
- `null` — tắt panel

Thêm panel mới: tạo thêm case trong `panelOpen` type union và thêm render condition trong JSX panel container.

---

## ⚡ Progress Saving

Watch progress lưu vào `localStorage` key: `watchProgress_${tmdbId}_${type}`.  
Format:
```ts
{ currentTime: number, duration: number, tmdbId: number, type: 'movie'|'tv', episodeKey?: string }
```

Save trigger: mỗi 5s (interval) + `beforeunload` event.

---

## 🚫 Không làm trong domain này

- Đừng thêm stream fetching logic vào player → thuộc `src/api/streamProviders/viProviders.ts`
- Đừng sửa danh sách sources/servers → thuộc `useStreamAggregator.ts`
- Đừng thêm TMDB/movie metadata call → thuộc `useMovieDetail.ts`
