# Cinemax

Một ứng dụng web xem phim trực tuyến (Netflix Clone) hiện đại được xây dựng và hỗ trợ thiết kế bởi AI.

## Các tính năng chính
- **Tích hợp TMDB:** Lấy dữ liệu phim xu hướng, phổ biến, đánh giá cao, thông tin chi tiết phim (dàn diễn viên, trailer, mô tả tập phim tiếng Việt) cực kỳ chuẩn xác.
- **Xem phim đa nguồn:** Tự động quy đổi và tìm nguồn streaming tốc độ cao từ PhimAPI và OPhim.
- **Trình phát video cao cấp:** Trình phát phim chuyên nghiệp (HLS.js) mượt mà, hỗ trợ ghi nhớ tiến độ xem phim.
- **Bộ lọc xịn:** Lọc thông minh theo phim bộ, phim lẻ, thể loại và sắp xếp theo lượt xem/điểm số từ TMDB.

## Chạy Local

**Yêu cầu:** Đã cài đặt Node.js.

1. Cài đặt các thư viện:
   ```bash
   npm install
   ```
2. Tạo file `.env` hoặc cấu hình token trong môi trường:
   Đặt API Read Access Token (v4) từ TMDB vào biến `VITE_TMDB_ACCESS_TOKEN`.
3. Chạy ứng dụng ở chế độ phát triển:
   ```bash
   npm run dev
   ```
