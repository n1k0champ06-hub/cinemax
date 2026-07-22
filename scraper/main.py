#!/usr/bin/env python3
"""
Cinemax Movie Scraper — Main Entry Point
Cào phim từ 3 nguồn API công khai của Việt Nam và lưu vào MongoDB Atlas.

Nguồn hỗ trợ:
  - kkphim  (Tier A): https://phimapi.com
  - ophim   (Tier B): https://ophim1.com
  - nguonc  (Tier C): https://phim.nguonc.com/api

Cách dùng:
  python -m scraper.main --tier all --pages 3 --verbose
  python -m scraper.main --tier a --pages 10
  python -m scraper.main --tier b --dry-run
"""

import argparse
import logging
import os
import sys
import time
from datetime import datetime, timezone

import certifi
import requests
from dotenv import load_dotenv
from pymongo import MongoClient, UpdateOne
from pymongo.errors import BulkWriteError

# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
log = logging.getLogger('cinemax-scraper')

# ---------------------------------------------------------------------------
# Source definitions
# ---------------------------------------------------------------------------
SOURCES = {
    'kkphim': {
        'tier': 'a',
        'base_url': 'https://phimapi.com',
        'list_path': '/danh-sach/phim-moi-cap-nhat',
        'detail_path': '/phim/{slug}',
        'format': 'kkphim',
    },
    'ophim': {
        'tier': 'b',
        'base_url': 'https://ophim1.com',
        'list_path': '/danh-sach/phim-moi-cap-nhat',
        'detail_path': '/phim/{slug}',
        'format': 'ophim',
    },
    'nguonc': {
        'tier': 'c',
        'base_url': 'https://phim.nguonc.com/api',
        'list_path': '/films/phim-moi-cap-nhat',
        'detail_path': '/film/{slug}',
        'format': 'nguonc',
    },
}

TIER_MAP = {
    'a': ['kkphim'],
    'b': ['ophim'],
    'c': ['nguonc'],
    'all': list(SOURCES.keys()),
}

# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------
SESSION = requests.Session()
SESSION.headers.update({
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/125.0.0.0 Safari/537.36'
    ),
    'Accept': 'application/json',
})

PROXY_URL = os.getenv('PROXY_URL', '')
if PROXY_URL:
    SESSION.proxies = {'http': PROXY_URL, 'https': PROXY_URL}
    log.info('[HTTP] Đang dùng proxy: %s', PROXY_URL)


def fetch_json(url: str, retries: int = 3, timeout: int = 15) -> dict | None:
    """Fetch JSON từ URL với retry exponential backoff."""
    for attempt in range(retries):
        try:
            resp = SESSION.get(url, timeout=timeout, verify=certifi.where())
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.HTTPError as e:
            log.warning('[HTTP] %s — HTTP %s (attempt %d/%d)', url, e.response.status_code, attempt + 1, retries)
        except requests.exceptions.RequestException as e:
            log.warning('[HTTP] %s — %s (attempt %d/%d)', url, e, attempt + 1, retries)

        if attempt < retries - 1:
            wait = 2 ** attempt
            time.sleep(wait)

    return None


# ---------------------------------------------------------------------------
# Data normalizer — chuẩn hóa dữ liệu về định dạng thống nhất
# ---------------------------------------------------------------------------
def normalize_movie(raw: dict, source_fmt: str, source_name: str) -> dict | None:
    """Chuyển đổi dữ liệu thô từ từng nguồn về cấu trúc MongoDB chuẩn."""
    if source_fmt == 'nguonc':
        # nguonc trả về cấu trúc hơi khác
        movie = raw.get('movie') or raw
    else:
        movie = raw.get('movie') or raw

    if not movie:
        return None

    slug = movie.get('slug') or movie.get('_id')
    if not slug:
        return None

    # Xử lý thumbnail/poster
    thumb = movie.get('thumb_url') or movie.get('poster_url') or ''
    poster = movie.get('poster_url') or movie.get('thumb_url') or ''

    # Xử lý thể loại
    raw_cats = movie.get('category') or movie.get('categories') or []
    if isinstance(raw_cats, list):
        categories = [c.get('name') or c if isinstance(c, dict) else str(c) for c in raw_cats]
    else:
        categories = []

    # Xử lý diễn viên / đạo diễn
    def extract_names(field):
        raw_list = movie.get(field) or []
        if isinstance(raw_list, list):
            return [a.get('name') or a if isinstance(a, dict) else str(a) for a in raw_list]
        if isinstance(raw_list, str):
            return [n.strip() for n in raw_list.split(',') if n.strip()]
        return []

    return {
        'slug': slug,
        'title': movie.get('name') or movie.get('title') or '',
        'originTitle': movie.get('origin_name') or movie.get('original_name') or '',
        'thumbUrl': thumb,
        'posterUrl': poster,
        'type': movie.get('type') or 'series',
        'status': movie.get('status') or 'ongoing',
        'year': movie.get('year') or datetime.now().year,
        'content': movie.get('content') or movie.get('description') or '',
        'category': [c for c in categories if c],
        'actor': extract_names('actor'),
        'director': extract_names('director'),
        'country': movie.get('country') or [],
        'tmdbId': movie.get('tmdb_id') or None,
        'source': source_name,
        'updatedAt': datetime.now(timezone.utc),
    }


def normalize_streams(raw_detail: dict, slug: str, source_name: str) -> list[dict]:
    """Trích xuất danh sách stream từ response chi tiết phim."""
    episodes_raw = raw_detail.get('episodes') or []
    streams = []

    for ep_group in episodes_raw:
        server_name = ep_group.get('server_name') or ep_group.get('name') or source_name
        server_data = ep_group.get('server_data') or ep_group.get('items') or ep_group.get('episodes') or []

        for ep in server_data:
            stream_url = (
                ep.get('link_m3u8') or
                ep.get('m3u8') or
                ep.get('embed') or
                ep.get('link_embed') or
                ''
            )
            if not stream_url:
                continue

            ep_name = str(ep.get('name') or ep.get('filename') or '1')

            streams.append({
                'slug': slug,
                'server': server_name,
                'episode': ep_name,
                'streamUrl': stream_url,
                'source': source_name,
                'updatedAt': datetime.now(timezone.utc),
            })

    return streams


# ---------------------------------------------------------------------------
# Core scraper logic
# ---------------------------------------------------------------------------
def scrape_source(
    source_name: str,
    cfg: dict,
    num_pages: int,
    db,
    dry_run: bool = False,
    verbose: bool = False,
) -> dict:
    """Cào toàn bộ trang danh sách từ một nguồn và lưu vào MongoDB."""
    stats = {'movies_upserted': 0, 'streams_upserted': 0, 'errors': 0, 'skipped': 0}
    base = cfg['base_url'].rstrip('/')
    movies_col = db['movies'] if db is not None else None
    streams_col = db['streams'] if db is not None else None

    for page in range(1, num_pages + 1):
        list_url = f"{base}{cfg['list_path']}?page={page}"
        log.info('[%s] Đang tải trang %d/%d — %s', source_name.upper(), page, num_pages, list_url)

        list_data = fetch_json(list_url)
        if not list_data:
            log.error('[%s] Không tải được trang %d, bỏ qua.', source_name.upper(), page)
            stats['errors'] += 1
            continue

        items = list_data.get('items') or list_data.get('data') or []
        if not items:
            log.warning('[%s] Trang %d không có dữ liệu.', source_name.upper(), page)
            continue

        log.info('[%s] Trang %d — %d phim mới cập nhật.', source_name.upper(), page, len(items))

        movie_ops = []
        stream_ops = []

        for item in items:
            slug = item.get('slug')
            if not slug:
                stats['skipped'] += 1
                continue

            # Lấy chi tiết phim (có đầy đủ episodes)
            detail_url = f"{base}{cfg['detail_path'].format(slug=slug)}"
            detail_data = fetch_json(detail_url)
            if not detail_data:
                log.warning('[%s] Không tải được chi tiết phim: %s', source_name.upper(), slug)
                stats['errors'] += 1
                continue

            # Chuẩn hóa dữ liệu phim
            movie_doc = normalize_movie(detail_data, cfg['format'], source_name)
            if not movie_doc:
                stats['skipped'] += 1
                continue

            if verbose:
                log.info('[%s] [OK] %s (%s)', source_name.upper(), movie_doc['title'], slug)

            # Chuẩn hóa dữ liệu stream
            stream_docs = normalize_streams(detail_data, slug, source_name)

            if not dry_run:
                movie_ops.append(
                    UpdateOne(
                        {'slug': slug},
                        {'$set': movie_doc},
                        upsert=True
                    )
                )
                for s in stream_docs:
                    stream_ops.append(
                        UpdateOne(
                            {'slug': s['slug'], 'server': s['server'], 'episode': s['episode']},
                            {'$set': s},
                            upsert=True
                        )
                    )
            else:
                stats['movies_upserted'] += 1
                stats['streams_upserted'] += len(stream_docs)

            # Throttle nhẹ tránh bị block
            time.sleep(0.15)

        # Bulk write batch
        if not dry_run and movie_ops and movies_col is not None:
            try:
                res = movies_col.bulk_write(movie_ops, ordered=False)
                stats['movies_upserted'] += res.upserted_count + res.modified_count
            except BulkWriteError as bwe:
                log.error('[%s] Lỗi bulk write movies: %s', source_name.upper(), bwe.details)
                stats['errors'] += 1

        if not dry_run and stream_ops and streams_col is not None:
            try:
                res = streams_col.bulk_write(stream_ops, ordered=False)
                stats['streams_upserted'] += res.upserted_count + res.modified_count
            except BulkWriteError as bwe:
                log.error('[%s] Lỗi bulk write streams: %s', source_name.upper(), bwe.details)
                stats['errors'] += 1

        log.info(
            '[%s] Trang %d hoàn tất — Movies: +%d | Streams: +%d',
            source_name.upper(), page,
            stats['movies_upserted'], stats['streams_upserted']
        )

    return stats


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description='Cinemax Movie Scraper Bot')
    parser.add_argument('--tier', default='all',
                        choices=['a', 'b', 'c', 'all'],
                        help='Source tier: a=kkphim, b=ophim, c=nguonc, all=tất cả')
    parser.add_argument('--pages', type=int, default=3,
                        help='Số trang cào từ mỗi nguồn (default: 3)')
    parser.add_argument('--dry-run', action='store_true',
                        help='Chỉ fetch, không ghi vào database')
    parser.add_argument('--verbose', action='store_true',
                        help='In ra tên từng phim đang xử lý')
    args = parser.parse_args()

    # Kết nối MongoDB (bắt buộc nếu không phải dry-run)
    mongo_uri = os.getenv('MONGODB_URI', '')
    db = None

    if not args.dry_run:
        if not mongo_uri:
            log.error('[DB] MONGODB_URI chưa được cấu hình! Thoát.')
            sys.exit(1)
        try:
            client = MongoClient(mongo_uri, serverSelectionTimeoutMS=10_000, tlsCAFile=certifi.where())
            client.admin.command('ping')
            try:
                db = client.get_default_database(default='cinemax')
            except Exception:
                db = client['cinemax']
            log.info('[DB] Kết nối MongoDB thành công: %s', db.name)
        except Exception as e:
            log.error('[DB] Kết nối MongoDB thất bại: %s', e)
            sys.exit(1)
    else:
        log.info('[DRY-RUN] Chế độ dry-run — không ghi vào database.')

    # Xác định nguồn cần cào
    source_names = TIER_MAP.get(args.tier, list(SOURCES.keys()))
    log.info('=== Cinemax Scraper Bot khởi động ===')
    log.info('Tier: %s | Nguồn: %s | Trang/nguồn: %d | Dry-run: %s',
             args.tier.upper(), ', '.join(source_names), args.pages, args.dry_run)

    total_stats = {'movies_upserted': 0, 'streams_upserted': 0, 'errors': 0, 'skipped': 0}
    start_time = time.time()

    for source_name in source_names:
        cfg = SOURCES[source_name]
        log.info('--- Bắt đầu nguồn: %s (%s) ---', source_name.upper(), cfg['base_url'])
        try:
            stats = scrape_source(
                source_name=source_name,
                cfg=cfg,
                num_pages=args.pages,
                db=db,
                dry_run=args.dry_run,
                verbose=args.verbose,
            )
            for k in total_stats:
                total_stats[k] += stats[k]
            log.info('[%s] Kết quả: %s', source_name.upper(), stats)
        except Exception as e:
            log.error('[%s] Lỗi nghiêm trọng: %s', source_name.upper(), e)
            total_stats['errors'] += 1

    elapsed = time.time() - start_time
    log.info('=== Hoàn tất trong %.1f giây ===', elapsed)
    log.info('Tổng kết: Movies +%d | Streams +%d | Lỗi: %d | Bỏ qua: %d',
             total_stats['movies_upserted'], total_stats['streams_upserted'],
             total_stats['errors'], total_stats['skipped'])

    # Ghi log ra file
    log_dir = os.path.join(os.path.dirname(__file__), 'logs')
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log")
    with open(log_file, 'w', encoding='utf-8') as f:
        f.write(f"Run at: {datetime.now().isoformat()}\n")
        f.write(f"Tier: {args.tier} | Pages: {args.pages} | Dry-run: {args.dry_run}\n")
        f.write(f"Elapsed: {elapsed:.1f}s\n")
        f.write(f"Stats: {total_stats}\n")

    # Exit code non-zero nếu có lỗi nghiêm trọng
    if total_stats['errors'] > 0 and total_stats['movies_upserted'] == 0:
        sys.exit(1)


if __name__ == '__main__':
    main()
