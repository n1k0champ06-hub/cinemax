#!/usr/bin/env python3
"""
Cinemax Scraper Engine using Scrapling
Abstract/generic implementation for educational and demonstration purposes.
Runs as a background service or script.
"""

import os
import sys
import time
from pymongo import MongoClient

try:
    from scrapling import fetch
except ImportError:
    print("[Error] Thư viện 'scrapling' chưa được cài đặt. Vui lòng cài đặt: pip install scrapling")
    sys.exit(1)

# Lấy cấu hình MongoDB từ biến môi trường
MONGO_URI = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017/cinemax")

class CinemaxScraper:
    def __init__(self, uri=MONGO_URI):
        self.client = MongoClient(uri)
        self.db = self.client.get_database()
        self.movies_col = self.db["movies"]
        self.streams_col = self.db["streams"]
        print(f"[Scraper] Đã kết nối cơ sở dữ liệu MongoDB: {self.db.name}")

    def fetch_page_metadata(self, target_url):
        """
        Sử dụng Scrapling với chế độ stealthy=True để tải dữ liệu trang ẩn danh
        tránh bị phát hiện là bot.
        """
        print(f"[Scraper] Đang tải trang: {target_url}")
        try:
            # Scrapling fetch tự động giả lập browser fingerprint
            response = fetch(
                url=target_url,
                stealthy=True,
                follow_redirects=True,
                timeout=15
            )
            
            if response.status_code != 200:
                print(f"[Scraper] Lỗi tải trang: HTTP {response.status_code}")
                return None
                
            return response
        except Exception as e:
            print(f"[Scraper] Yêu cầu HTTP thất bại: {str(e)}")
            return None

    def extract_and_save_mock(self, tmdb_id, title, episode_count=12):
        """
        Giả lập xử lý trích xuất dữ liệu từ một trang mẫu và ghi nhận thông tin tập phim vào MongoDB.
        """
        print(f"[Scraper] Bắt đầu xử lý bóc tách cho Phim: {title} (TMDB: {tmdb_id})")
        
        # Giả lập cào một trang sandbox công cộng để kiểm thử Scrapling
        sandbox_url = "https://httpbin.org/html"
        response = self.fetch_page_metadata(sandbox_url)
        
        if response:
            # Ví dụ trích xuất thẻ h1 bằng CSS Selector của Scrapling
            extracted_header = response.css("h1::text").first()
            print(f"[Scraper] Trích xuất thành công tiêu đề trang sandbox: '{extracted_header}'")

        slug = f"tmdb-{tmdb_id}-tv"
        
        # 1. Lưu thông tin phim vào collection 'movies'
        self.movies_col.update_one(
            {"slug": slug},
            {
                "$set": {
                    "title": title,
                    "slug": slug,
                    "tmdbId": int(tmdb_id),
                    "type": "tv",
                    "status": "completed",
                    "year": 2026,
                    "updatedAt": time.time()
                }
            },
            upsert=True
        )

        # 2. Lưu các luồng phát giả lập vào collection 'streams'
        for ep in range(1, episode_count + 1):
            stream_url = f"https://example-cdn.com/hls/tmdb-{tmdb_id}/ep{ep}/index.m3u8"
            self.streams_col.update_one(
                {"slug": slug, "server": "VIP-Stealth", "episode": str(ep)},
                {
                    "$set": {
                        "title": title,
                        "slug": slug,
                        "server": "VIP-Stealth",
                        "episode": str(ep),
                        "streamUrl": stream_url,
                        "updatedAt": time.time()
                    }
                },
                upsert=True
            )
            
        print(f"[Scraper] Đồng bộ thành công {episode_count} tập của phim '{title}' vào database.")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Sử dụng: python scraper.py <tmdb_id> <title>")
        sys.exit(1)
        
    tmdb_id = sys.argv[1]
    title = sys.argv[2]
    
    scraper = CinemaxScraper()
    scraper.extract_and_save_mock(tmdb_id, title)
