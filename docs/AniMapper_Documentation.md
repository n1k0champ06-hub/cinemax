# Tài liệu API AniMapper

Tài liệu tổng hợp đầy đủ về dự án AniMapper, hướng dẫn nhanh và API Reference.

---

## 1. Giới thiệu

### 1.1. AniMapper là gì?
**AniMapper** là một dự án nhằm mục đích cung cấp API cho việc lấy thông tin anime và nguồn stream từ các trang web phim anime trên Internet. Dự án chỉ tổng hợp thông tin từ các trang web khác nhau và không lưu trữ dữ liệu trực tiếp.

#### Mục tiêu
Dự án nhằm tạo ra một sân chơi cho cộng đồng yêu thích làm web anime nhưng chưa biết nguồn dữ liệu ở đâu, muốn vọc vạch và học hỏi. Các mục tiêu chính:
- **Cung cấp dữ liệu chính xác:** Thông tin được cập nhật từ nhiều nguồn.
- **Tích hợp dễ dàng:** Hỗ trợ nhiều định dạng cho lập trình viên.
- **Hiệu suất cao:** API được tối ưu hóa để phản hồi nhanh chóng.

#### Chi phí
Dự án AniMapper **hoàn toàn miễn phí**. Bạn có thể sử dụng API mà không cần phải trả bất kỳ chi phí nào (tuân theo Điều khoản sử dụng).

---

### 1.2. Điều khoản sử dụng
1. **Chấp nhận điều khoản:** Bằng việc sử dụng API của AniMapper, bạn đồng ý tuân theo các điều khoản và chính sách sử dụng.
2. **Sử dụng hợp pháp:** Lưu lượng request đến API phải vừa phải. Nếu phát hiện hành vi sai, có thể bị BAN-IP.
3. **Giới hạn trách nhiệm:**
   - AniMapper không chịu trách nhiệm về nội dung được cung cấp bởi bên thứ ba.
   - AniMapper có quyền thay đổi hoặc ngừng cung cấp API bất kỳ lúc nào mà không cần thông báo trước.
4. **Cập nhật điều khoản:** Điều khoản có thể được cập nhật theo thời gian. Bạn có trách nhiệm kiểm tra và tuân theo điều khoản mới nhất.

---

### 1.3. Rate Limiting (Giới hạn tốc độ)
API của AniMapper có giới hạn tốc độ là **60 yêu cầu / phút**.

#### Response Headers
- `X-RateLimit-Limit`: Số lượng yêu cầu tối đa.
- `X-RateLimit-Remaining`: Số lượng yêu cầu còn lại.
- `X-RateLimit-Reset`: Thời gian (tính bằng giây) đến khi rate limit được reset.

Khi vượt quá giới hạn, server trả về HTTP status `429 Too Many Requests` kèm header `Retry-After`:
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 60
```

---

### 1.4. Tiến độ phát triển

#### Trạng thái tích hợp các Provider
| Provider | Provider Link | Status |
| :--- | :--- | :--- |
| **AnimeVietSub** | `animevietsub.page` | ✅ Đã hoàn thành |
| **Niniyo** | `niniyo.com` | ✅ Đã hoàn thành |
| **AnimeTVN** | `animetvn.com` | ❌ Chưa hỗ trợ |
| **Anime47** | `anime47.baby` | ❌ Chưa hỗ trợ |
| **WebLinhTinh** | `weblinhtinh1.net` | ❌ Chưa hỗ trợ |
| **AnimeHay** | `animehay.red` | ❌ Chưa hỗ trợ |
| **BocTem** | `boctem.com` | ❌ Chưa hỗ trợ |

---

## 2. Hướng dẫn nhanh (Quick Start)

### Base URL
```
https://api.animapper.net/api/v1
```

### Quy trình cơ bản

#### 1. Tìm kiếm Media
```http
GET /api/v1/search?title=attack&mediaType=ANIME&limit=10
```

#### 2. Lấy thông tin chi tiết Media (Metadata)
```http
GET /api/v1/metadata?id=16498
```

#### 3. Lấy danh sách tập
```http
GET /api/v1/stream/episodes?id=16498&provider=ANIMEVIETSUB
```

#### 4. Lấy nguồn stream
```http
GET /api/v1/stream/source?episodeData=shingeki-no-kyojin$12345&provider=ANIMEVIETSUB&server=DU
```

---

## 3. API Reference

### 3.1. Search API
`GET /api/v1/search`
- `title`: tên anime/manga
- `mediaType`: `ANIME` / `MANGA`
- `limit`: số lượng kết quả

### 3.2. Streaming API
1. **Lấy danh sách tập:** `GET /api/v1/stream/episodes?id={mediaId}&provider={provider}`
2. **Lấy nguồn stream:** `GET /api/v1/stream/source?episodeData={episodeData}&provider={provider}&server={server}`

---

## 4. Providers
- **AnimeVietSub** (`animevietsub.page`)
- **Niniyo** (`niniyo.com`)
