# Cinemax - Nền tảng xem phim trực tuyến hiện đại

Cinemax là một ứng dụng web xem phim trực tuyến cao cấp, được phát triển bằng React, Vite, TypeScript và Tailwind CSS. Dự án mang lại trải nghiệm xem phim mượt mà với trình phát video tùy biến cao, hỗ trợ nhiều nguồn phát khác nhau và lưu trữ tiến trình xem phim tự động.

## 🚀 Tính năng nổi bật

- **Trình phát video chuyên nghiệp (Netflix-style Player):**
  - Hỗ trợ phát luồng trực tiếp HLS (.m3u8) thông qua thư viện `hls.js` hoạt động ổn định và tối ưu.
  - Dự phòng tự động (fallback) sang trình phát iframe embed (CinemaOS VIP) nếu nguồn HLS gặp lỗi.
  - Tùy chỉnh chất lượng luồng phát, phụ đề và kênh âm thanh trực tiếp.
  - **Hệ thống cử chỉ thông minh (Gesture Controls):** Vuốt dọc bên trái để chỉnh độ sáng, vuốt dọc bên phải để chỉnh âm lượng, vuốt ngang để tua nhanh/tua lại.
  - **Tiện ích nâng cao:** Khuếch đại âm lượng (Audio Boost lên tới 2.0x), thay đổi tỉ lệ khung hình (16:9, 4:3, 21:9, tự động), lật ngang video và điều chỉnh độ sáng trực tiếp trên player.

- **Trải nghiệm người dùng cao cấp:**
  - Tự động lưu tiến trình xem phim (`localStorage`) để xem tiếp chính xác tập phim và thời gian đang xem dở.
  - Giao diện Dark Mode chuẩn điện ảnh, tối giản, sang trọng và phản hồi nhanh.
  - Danh sách tập phim và phần phim (Seasons) phân chia khoa học, dễ dàng duyệt và chuyển tập nhanh chóng.
  - Hỗ trợ nhiều nguồn phát stream (Ophim, KKphim, CinemaOS VIP Server).

## 🛠️ Công nghệ sử dụng

- **Core:** React, TypeScript, Vite
- **Styling:** Tailwind CSS, Framer Motion
- **Phát Video:** HLS.js
- **API dữ liệu:** PhimAPI/Ophim & TMDB (Metadata & hình ảnh)

## 💻 Hướng dẫn chạy dự án

### Yêu cầu hệ thống
- Đã cài đặt **Node.js** (khuyến nghị phiên bản 18 trở lên).

### Các bước thiết lập và chạy cục bộ
1. Cài đặt các thư viện phụ thuộc:
   ```bash
   npm install
   ```
2. Khởi chạy máy chủ phát triển cục bộ:
   ```bash
   npm run dev
   ```
   *Ứng dụng sẽ chạy tại địa chỉ mặc định `http://localhost:3000` hoặc cổng khác tùy thiết lập hệ thống.*

3. Biên dịch sản phẩm để deploy (Production build):
   ```bash
   npm run build
   ```
