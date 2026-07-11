# Original User Request

## Initial Request — 2026-06-04T16:45:12Z

Xây dựng và hoàn thiện hệ thống cào nguồn phim (bao gồm cả các trang bảo mật như AnimeVietSub sử dụng Playwright) để đồng bộ dữ liệu m3u8 vào Cloudflare KV phục vụ dự án Cinemax (Netflix clone).

Working directory: c:\Users\cykab\Downloads\cinemax
Integrity mode: development

## Requirements

### R1. AnimeVietSub Playwright Scraper
Xây dựng module `scraper/animevietsub.py` sử dụng Playwright (StealthyFetcher hoặc gọi trực tiếp) để giả lập truy cập vào trang `https://animevietsub.name/` (hoặc tên miền mới nhất), thực hiện tìm kiếm phim, chọn tập phim và sử dụng cơ chế lắng nghe mạng (Network Interception) để bắt link stream `.m3u8` thực tế của video.

### R2. Tích hợp CLI Orchestrator
Tích hợp nguồn mới `animevietsub` vào `scraper/sources.yaml` và `scraper/main.py` để người dùng có thể kích hoạt cào riêng nguồn này thông qua dòng lệnh:
```bash
python -m scraper.main --sources animevietsub --pages 1 --dry-run
```

### R3. Đồng bộ hóa Cloudflare KV
Sử dụng client REST API có sẵn (`scraper/kv_client.py`) để kiểm tra khác biệt (diff-check) và đẩy dữ liệu luồng phim cào được lên Cloudflare KV namespace với cấu trúc `movie:{slug}` đồng bộ với hệ thống.

## Acceptance Criteria

### Tính năng cào AnimeVietSub
- [ ] Chạy lệnh `python -m scraper.main --sources animevietsub --pages 1 --dry-run --verbose` không phát sinh lỗi ngoại lệ.
- [ ] Bot bắt được chính xác link m3u8 sạch của tập phim được cào.
- [ ] Dữ liệu kết quả được định dạng đúng cấu trúc JSON lưu trữ KV với đầy đủ thông tin tập phim và các stream.

### Tích hợp hệ thống
- [ ] Lệnh linter dự án `npm run lint` chạy không có lỗi để đảm bảo code React/TypeScript không bị ảnh hưởng.
- [ ] Tệp `sources.yaml` được khai báo đầy đủ cấu trúc của nguồn `animevietsub`.

## Follow-up — 2026-06-10T11:39:40Z

# Teamwork Project Prompt

The goal is to fix the issue where Vietnamese subtitles are listed in the user interface but do not display on the screen when playing movies/videos.

Working directory: c:\Users\cykab\Downloads\cinemax
Integrity mode: development

## Requirements

### R1. Resolve Subtitle Rendering
Make sure all selected subtitle tracks (both local default track and external subtitles fetched from Subdl or Stremio) render properly on the screen in both HTML5/HLS mode and Iframe/Embed mode.

### R2. Verify Subtitle Ticking in Iframe Mode
Ensure that subtitle cues update dynamically over time during playback in iframe/embed mode (VidSrc/CinemaOS).

## Acceptance Criteria

### Correct Subtitle Display
- [ ] Subtitle text appears over the video player matching the selected language track.
- [ ] Subtitle cues change according to the playback timer in both HTML5 player and Iframe player.
