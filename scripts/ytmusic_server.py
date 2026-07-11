"""
ytmusic_server.py — YouTube Music microservice (port 3002)

Endpoints:
  GET /search?q=...                     Search songs
  GET /home_charts                      Home charts (cached 2h)
  GET /stream_url?id=VIDEO_ID           Get direct stream URL (cached 6h)
  GET /recommend?id=VIDEO_ID&limit=10   Watch-next recommendations
  GET /artist?id=CHANNEL_ID            Artist info + top songs
"""

from http.server import BaseHTTPRequestHandler, HTTPServer
import urllib.parse
import json
import sys
import os
import time
import hashlib

try:
    from ytmusicapi import YTMusic
except ImportError:
    YTMusic = None
    print("[WARN] ytmusicapi not installed.")

try:
    import yt_dlp
except ImportError:
    yt_dlp = None
    print("[WARN] yt_dlp not installed.")

# ── YTMusic instance ──────────────────────────────────────────────────────────

ytmusic = None

def get_ytmusic():
    global ytmusic
    if ytmusic is None and YTMusic:
        try:
            ytmusic = YTMusic()
        except Exception as e:
            print(f"[YTMusic] Init error: {e}")
    return ytmusic

# ── Cache helpers ─────────────────────────────────────────────────────────────

CACHE_DIR = os.path.join(os.path.dirname(__file__), '..', 'scratch', 'yt_cache')

def cache_path(key: str) -> str:
    os.makedirs(CACHE_DIR, exist_ok=True)
    safe = hashlib.md5(key.encode()).hexdigest()
    return os.path.join(CACHE_DIR, f"{safe}.json")

def cache_read(key: str, ttl: int):
    path = cache_path(key)
    if not os.path.exists(path):
        return None
    try:
        mtime = os.path.getmtime(path)
        if time.time() - mtime > ttl:
            return None
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None

def cache_write(key: str, data):
    path = cache_path(key)
    try:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)
    except Exception as e:
        print(f"[Cache] Write error: {e}")

# ── Data helpers ──────────────────────────────────────────────────────────────

def parse_duration(item: dict) -> int:
    secs = item.get('duration_seconds', 0)
    if secs:
        return secs
    dur_str = item.get('duration', '')
    if dur_str:
        parts = dur_str.split(':')
        try:
            if len(parts) == 2:
                return int(parts[0]) * 60 + int(parts[1])
            elif len(parts) == 3:
                return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
        except ValueError:
            pass
    return 0

def best_thumbnail(thumbnails: list) -> str:
    if not thumbnails:
        return ''
    # Prefer 500px+ thumbnails for quality
    for t in reversed(thumbnails):
        url = t.get('url', '')
        w = t.get('width', 0)
        if w >= 400 or 'maxresdefault' in url or 'hqdefault' in url:
            return url
    return thumbnails[-1].get('url', '')

def song_from_item(item: dict) -> dict:
    video_id = item.get('videoId') or item.get('id', '')
    artists_raw = item.get('artists', []) or item.get('artist', [])
    if isinstance(artists_raw, str):
        artists_str = artists_raw
    else:
        artists_str = ', '.join(a.get('name', '') for a in (artists_raw or []) if a.get('name'))

    album_info = item.get('album')
    album_name = ''
    if isinstance(album_info, dict):
        album_name = album_info.get('name', '')
    elif isinstance(album_info, str):
        album_name = album_info

    thumbnails = item.get('thumbnails') or item.get('thumbnail') or []
    cover = best_thumbnail(thumbnails)

    return {
        'id': video_id,
        'title': item.get('title', ''),
        'artist': artists_str,
        'album': album_name,
        'coverUrl': cover,
        'duration': parse_duration(item),
    }

def get_playlist_tracks(yt, query: str, limit: int = 20) -> list:
    try:
        results = yt.search(query, filter='playlists')
        if not results:
            return []
        browse_id = results[0].get('browseId', '')
        playlist_id = browse_id[2:] if browse_id.startswith('VL') else browse_id
        data = yt.get_playlist(playlist_id, limit=limit)
        return [song_from_item(t) for t in data.get('tracks', []) if t.get('videoId')]
    except Exception as e:
        print(f"[get_playlist_tracks] '{query}': {e}")
        return []

# ── Home charts (heavy — cached 2h) ──────────────────────────────────────────

HOME_TTL = 7200

def get_home_charts() -> dict:
    cached = cache_read('home_charts', HOME_TTL)
    if cached:
        return cached

    print("[YTMusic] Fetching home charts...")
    yt = get_ytmusic()
    if not yt:
        return {'charts': [], 'trending': [], 'indie': [], 'international': []}

    charts       = get_playlist_tracks(yt, 'BXH Nhac Viet 2024', 20)
    trending     = get_playlist_tracks(yt, 'V-Pop Thinh Hanh 2024', 20)
    indie        = get_playlist_tracks(yt, 'Nhac Indie Viet', 15)
    international = get_playlist_tracks(yt, 'Top Hits Global 2024', 15)
    bolero       = get_playlist_tracks(yt, 'Nhac Bolero Viet Nam', 15)

    result = {
        'charts': charts,
        'trending': trending,
        'indie': indie,
        'international': international,
        'bolero': bolero,
    }
    cache_write('home_charts', result)
    return result

# ── Stream URL (yt_dlp — cached 6h) ──────────────────────────────────────────

STREAM_TTL = 21600

def get_stream_url(video_id: str) -> str:
    if not yt_dlp:
        return ''
    cache_key = f'stream_{video_id}'
    cached = cache_read(cache_key, STREAM_TTL)
    if cached:
        return cached.get('url', '')

    try:
        ydl_opts = {
            'format': 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best',
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
            'nocheckcertificate': True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f'https://www.youtube.com/watch?v={video_id}', download=False)
            url = info.get('url', '')
            if url:
                cache_write(cache_key, {'url': url})
            return url
    except Exception as e:
        print(f"[stream_url] {video_id}: {e}")
        return ''

# ── Watch-next recommendations ────────────────────────────────────────────────

RECOMMEND_TTL = 3600

def get_recommendations(video_id: str, limit: int = 10) -> list:
    cache_key = f'recommend_{video_id}'
    cached = cache_read(cache_key, RECOMMEND_TTL)
    if cached:
        return cached

    yt = get_ytmusic()
    if not yt:
        return []

    try:
        playlist = yt.get_watch_playlist(videoId=video_id)
        tracks = []
        for item in playlist.get('tracks', [])[:limit + 1]:
            if item.get('videoId') == video_id:
                continue
            tracks.append(song_from_item(item))
            if len(tracks) >= limit:
                break
        cache_write(cache_key, tracks)
        return tracks
    except Exception as e:
        print(f"[recommend] {video_id}: {e}")
        return []

# ── Artist info ───────────────────────────────────────────────────────────────

def get_artist(artist_id: str) -> dict:
    cache_key = f'artist_{artist_id}'
    cached = cache_read(cache_key, 3600)
    if cached:
        return cached

    yt = get_ytmusic()
    if not yt:
        return {}

    try:
        data = yt.get_artist(artist_id)
        top_songs = []
        songs_data = data.get('songs', {})
        for item in (songs_data.get('results') or [])[:10]:
            top_songs.append(song_from_item(item))

        thumbnails = data.get('thumbnails', [])
        result = {
            'name': data.get('name', ''),
            'description': data.get('description', ''),
            'coverUrl': best_thumbnail(thumbnails),
            'topSongs': top_songs,
            'views': data.get('views', ''),
        }
        cache_write(cache_key, result)
        return result
    except Exception as e:
        print(f"[artist] {artist_id}: {e}")
        return {}

# ── HTTP Handler ──────────────────────────────────────────────────────────────

class YTMusicHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Suppress default request logs; use our own
        print(f"[ytmusic] {self.path.split('?')[0]}")

    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        query_params = urllib.parse.parse_qs(parsed_path.query)
        path = parsed_path.path

        try:
            if path == '/search':
                self._handle_search(query_params)
            elif path == '/home_charts':
                self._handle_home_charts()
            elif path == '/stream_url':
                self._handle_stream_url(query_params)
            elif path == '/recommend':
                self._handle_recommend(query_params)
            elif path == '/artist':
                self._handle_artist(query_params)
            elif path == '/health':
                self.send_json({'status': 'ok', 'ytmusic': ytmusic is not None})
            else:
                self.send_error_json(404, 'Not Found')
        except Exception as e:
            print(f"[ytmusic] Unhandled error on {path}: {e}")
            self.send_error_json(500, str(e))

    def _handle_search(self, params):
        q = params.get('q', [''])[0].strip()
        if not q:
            return self.send_error_json(400, "Missing 'q'")
        yt = get_ytmusic()
        if not yt:
            return self.send_error_json(503, 'YTMusic not available')

        cached = cache_read(f'search_{q}', 300)  # 5 min cache
        if cached:
            return self.send_json(cached)

        results = yt.search(q, filter='songs', limit=20)
        songs = [song_from_item(r) for r in results if r.get('videoId')]
        cache_write(f'search_{q}', songs)
        self.send_json(songs)

    def _handle_home_charts(self):
        data = get_home_charts()
        self.send_json(data)

    def _handle_stream_url(self, params):
        video_id = params.get('id', [''])[0].strip()
        if not video_id:
            return self.send_error_json(400, "Missing 'id'")
        url = get_stream_url(video_id)
        if not url:
            return self.send_error_json(404, 'No stream URL found')
        self.send_json({'url': url})

    def _handle_recommend(self, params):
        video_id = params.get('id', [''])[0].strip()
        limit = int(params.get('limit', ['10'])[0])
        if not video_id:
            return self.send_error_json(400, "Missing 'id'")
        tracks = get_recommendations(video_id, limit)
        self.send_json(tracks)

    def _handle_artist(self, params):
        artist_id = params.get('id', [''])[0].strip()
        if not artist_id:
            return self.send_error_json(400, "Missing 'id'")
        data = get_artist(artist_id)
        self.send_json(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def send_json(self, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, status, message):
        body = json.dumps({'error': message}).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)


def run(port=3002):
    server_address = ('127.0.0.1', port)
    httpd = HTTPServer(server_address, YTMusicHandler)
    print(f"[YTMusic Server] Running on http://127.0.0.1:{port}")
    print(f"  /search?q=...           Search songs")
    print(f"  /home_charts            Home charts (2h cache)")
    print(f"  /stream_url?id=...      Stream URL (6h cache)")
    print(f"  /recommend?id=...       Watch-next recommendations")
    print(f"  /artist?id=...          Artist info")
    httpd.serve_forever()


if __name__ == '__main__':
    port = 3002
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    run(port)
