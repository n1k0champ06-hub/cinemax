"""
Cinemax Scraper — Extractor Module

Functions to extract m3u8 stream links, iframe embed URLs, and movie
metadata from API JSON responses (OPhim/KKPhim format) and raw HTML.
Includes ad-iframe filtering to skip known ad networks.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

logger = logging.getLogger("cinemax.extractors")

# ---------------------------------------------------------------------------
# Ad iframe domains / patterns to filter out
# ---------------------------------------------------------------------------
AD_PATTERNS: list[str] = [
    "ads",
    "doubleclick",
    "histats",
    "google",
    "facebook",
    "popup",
    "banner",
    "adserver",
    "adsense",
    "googlesyndication",
    "googletagmanager",
    "analytics",
    "tracker",
    "clicktrack",
]

# Compiled regex for efficient ad detection
_AD_REGEX = re.compile(
    "|".join(re.escape(pattern) for pattern in AD_PATTERNS),
    re.IGNORECASE,
)


def is_ad_url(url: str) -> bool:
    """Check if a URL belongs to an ad network.

    Args:
        url: The URL to check.

    Returns:
        True if the URL matches known ad patterns.
    """
    if not url:
        return True
    return bool(_AD_REGEX.search(url))


def _clean_url(url: str | None) -> str:
    """Strip whitespace and validate a URL.

    Args:
        url: Raw URL string.

    Returns:
        Cleaned URL, or empty string if invalid.
    """
    if not url or not isinstance(url, str):
        return ""
    url = url.strip()
    if not url.startswith(("http://", "https://", "//")):
        return ""
    return url


# ---------------------------------------------------------------------------
# Movie list extraction
# ---------------------------------------------------------------------------

@dataclass
class MovieListItem:
    """A movie entry from a list/pagination API response."""

    slug: str
    title: str
    title_en: str
    year: int | None
    type: str  # "series", "single", "hoathinh", "tvshows"
    poster: str
    thumb: str
    modified_time: str




def extract_movie_list(api_response: dict[str, Any]) -> list[dict[str, Any]]:
    """Extract movie slugs and basic info from a list API response.

    Works with both OPhim and KKPhim list endpoints, which share the
    same response format.

    Expected format:
        {
            "items": [
                {"slug": "...", "name": "...", "origin_name": "...", ...},
                ...
            ],
            "pagination": {"totalPages": N, "currentPage": M}
        }

    Args:
        api_response: Parsed JSON from the list endpoint.

    Returns:
        List of dicts with movie metadata (slug, title, type, etc.).
    """
    items = api_response.get("items", [])
    if not items:
        # Some responses nest items differently
        items = api_response.get("data", {}).get("items", [])

    results: list[dict[str, Any]] = []
    for item in items:
        slug = item.get("slug", "").strip()
        if not slug:
            logger.warning("Skipping item with no slug: %s", item.get("name", "???"))
            continue

        results.append({
            "slug": slug,
            "title": item.get("name", ""),
            "title_en": item.get("origin_name", ""),
            "year": _safe_int(item.get("year")),
            "type": item.get("type", "single"),
            "poster": item.get("poster_url", ""),
            "thumb": item.get("thumb_url", ""),
            "modified_time": item.get("modified", {}).get("time", ""),
        })

    return results


def extract_total_pages(api_response: dict[str, Any]) -> int:
    """Extract the total number of pages from a list API response.

    Args:
        api_response: Parsed JSON from the list endpoint.

    Returns:
        Total page count. Returns 1 if not found.
    """
    pagination = api_response.get("pagination", {})
    if not pagination:
        pagination = api_response.get("params", {}).get("pagination", {})

    total = pagination.get("totalPages", 1)
    return max(1, _safe_int(total) or 1)


# ---------------------------------------------------------------------------
# Episode / stream extraction from detail API
# ---------------------------------------------------------------------------

@dataclass
class StreamInfo:
    """A single stream source for an episode."""

    source: str        # e.g. "ophim", "kkphim"
    m3u8: str          # Direct m3u8 URL
    embed: str         # Iframe embed URL
    referer: str       # Referer needed for playback
    quality: str       # e.g. "1080p", "720p"
    checked_at: str    # ISO timestamp
    alive: bool        # Whether the stream was reachable


@dataclass
class EpisodeData:
    """Extracted episode with its streams."""

    episode_number: str  # "1", "2", etc. or "Full" for movies
    episode_name: str
    streams: list[StreamInfo]


def extract_episodes(
    api_response: dict[str, Any],
    *,
    source_key: str,
    referer: str = "",
    default_quality: str = "1080p",
) -> list[EpisodeData]:
    """Extract episode stream data from a detail API response.

    Works with the standard OPhim/KKPhim detail format:
        {
            "movie": {...},
            "episodes": [
                {
                    "server_name": "...",
                    "server_data": [
                        {
                            "name": "1",
                            "slug": "tap-1",
                            "filename": "...",
                            "link_embed": "https://...",
                            "link_m3u8": "https://..."
                        },
                        ...
                    ]
                }
            ]
        }

    Args:
        api_response: Parsed JSON from the detail endpoint.
        source_key: Source identifier (e.g. "ophim").
        referer: Referer URL for stream playback.
        default_quality: Quality label when not specified.

    Returns:
        List of EpisodeData with streams from all servers.
    """
    episodes_raw = api_response.get("episodes", [])
    movie_info = api_response.get("movie", {})
    now_iso = datetime.now(timezone.utc).isoformat()

    # Detect quality from movie info
    quality = _detect_quality(movie_info) or default_quality

    # Merge episodes from all servers into a unified episode map
    episode_map: dict[str, EpisodeData] = {}

    for server in episodes_raw:
        server_name = server.get("server_name", "Unknown")
        server_data = server.get("server_data", [])

        if not isinstance(server_data, list):
            logger.warning(
                "server_data is not a list for server '%s' — skipping", server_name
            )
            continue

        for ep_raw in server_data:
            ep_name = ep_raw.get("name", "").strip()
            ep_slug = ep_raw.get("slug", "").strip()
            link_m3u8 = _clean_url(ep_raw.get("link_m3u8"))
            link_embed = _clean_url(ep_raw.get("link_embed"))

            # Derive episode number from name or slug
            ep_number = _normalize_episode_number(ep_name, ep_slug)
            if not ep_number:
                continue

            # Skip if both links are empty
            if not link_m3u8 and not link_embed:
                logger.debug(
                    "No stream links for %s ep %s on server '%s'",
                    source_key, ep_number, server_name,
                )
                continue

            # Filter ad iframes
            if link_embed and is_ad_url(link_embed):
                logger.debug("Filtered ad iframe: %s", link_embed)
                link_embed = ""

            stream = StreamInfo(
                source=source_key,
                m3u8=link_m3u8,
                embed=link_embed,
                referer=referer,
                quality=quality,
                checked_at=now_iso,
                alive=True,  # Assume alive on first scrape
            )

            if ep_number not in episode_map:
                episode_map[ep_number] = EpisodeData(
                    episode_number=ep_number,
                    episode_name=ep_name,
                    streams=[stream],
                )
            else:
                episode_map[ep_number].streams.append(stream)

    # Sort by episode number
    sorted_episodes = sorted(
        episode_map.values(),
        key=lambda ep: _sort_key_for_episode(ep.episode_number),
    )

    return sorted_episodes


def extract_movie_metadata(api_response: dict[str, Any]) -> dict[str, Any]:
    """Extract movie-level metadata from a detail API response.

    Args:
        api_response: Parsed JSON from the detail endpoint.

    Returns:
        Dict with title, title_en, year, type, and slug.
    """
    movie = api_response.get("movie", {})
    return {
        "title": movie.get("name", ""),
        "title_en": movie.get("origin_name", ""),
        "year": _safe_int(movie.get("year")),
        "type": movie.get("type", "single"),
        "slug": movie.get("slug", ""),
        "poster": movie.get("poster_url", ""),
        "thumb": movie.get("thumb_url", ""),
    }


# ---------------------------------------------------------------------------
# HTML iframe extraction (fallback for non-API pages)
# ---------------------------------------------------------------------------

# Regex to find iframe src attributes in HTML
_IFRAME_REGEX = re.compile(
    r'<iframe[^>]+src=["\']([^"\']+)["\']',
    re.IGNORECASE,
)

# Regex to find m3u8 URLs in HTML/JS
_M3U8_REGEX = re.compile(
    r'(https?://[^\s"\'<>]+\.m3u8[^\s"\'<>]*)',
    re.IGNORECASE,
)


def extract_iframes_from_html(html: str) -> list[str]:
    """Extract non-ad iframe src URLs from raw HTML.

    Args:
        html: Raw HTML content.

    Returns:
        List of cleaned iframe URLs, with ads filtered out.
    """
    matches = _IFRAME_REGEX.findall(html)
    results: list[str] = []
    for url in matches:
        url = _clean_url(url)
        if url and not is_ad_url(url):
            results.append(url)
        elif url:
            logger.debug("Filtered ad iframe from HTML: %s", url)
    return results


def extract_m3u8_from_html(html: str) -> list[str]:
    """Extract m3u8 stream URLs from raw HTML or embedded JavaScript.

    Args:
        html: Raw HTML content.

    Returns:
        List of unique m3u8 URLs found.
    """
    matches = _M3U8_REGEX.findall(html)
    # Deduplicate while preserving order
    seen: set[str] = set()
    results: list[str] = []
    for url in matches:
        url = url.strip()
        if url not in seen:
            seen.add(url)
            results.append(url)
    return results


# ---------------------------------------------------------------------------
# KV value builder
# ---------------------------------------------------------------------------

def build_kv_value(
    metadata: dict[str, Any],
    episodes: list[EpisodeData],
    existing: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build the KV storage value by merging new episode data.

    If an existing KV value is provided, new streams are merged into
    existing episodes (preserving streams from other sources).

    Args:
        metadata: Movie metadata dict.
        episodes: Newly extracted episodes.
        existing: Existing KV value (if any) to merge into.

    Returns:
        Complete KV value dict ready for storage.
    """
    now_iso = datetime.now(timezone.utc).isoformat()

    # Start from existing or create new
    kv_value: dict[str, Any] = existing.copy() if existing else {}

    # Update top-level metadata
    kv_value["title"] = metadata.get("title", kv_value.get("title", ""))
    kv_value["title_en"] = metadata.get("title_en", kv_value.get("title_en", ""))
    kv_value["year"] = metadata.get("year", kv_value.get("year"))
    kv_value["type"] = metadata.get("type", kv_value.get("type", "single"))
    kv_value["sources_updated"] = now_iso

    # Merge episodes
    existing_episodes: dict[str, Any] = kv_value.get("episodes", {})

    for ep in episodes:
        ep_key = ep.episode_number
        if ep_key not in existing_episodes:
            existing_episodes[ep_key] = {"streams": []}

        ep_entry = existing_episodes[ep_key]
        existing_streams: list[dict[str, Any]] = ep_entry.get("streams", [])

        for stream in ep.streams:
            new_stream = {
                "source": stream.source,
                "m3u8": stream.m3u8,
                "embed": stream.embed,
                "referer": stream.referer,
                "quality": stream.quality,
                "checked_at": stream.checked_at,
                "alive": stream.alive,
            }

            # Replace existing stream from same source, or append
            replaced = False
            for i, existing_s in enumerate(existing_streams):
                if existing_s.get("source") == stream.source:
                    existing_streams[i] = new_stream
                    replaced = True
                    break

            if not replaced:
                existing_streams.append(new_stream)

        ep_entry["streams"] = existing_streams

    kv_value["episodes"] = existing_episodes
    return kv_value


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_int(value: Any) -> int | None:
    """Safely convert a value to int, returning None on failure."""
    if value is None:
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def _normalize_episode_number(name: str, slug: str) -> str:
    """Normalize an episode name/slug to a consistent episode number.

    Handles formats like:
        "Tập 1" → "1"
        "tap-1" → "1"
        "Full" → "Full"
        "1" → "1"
        "01" → "1"

    Args:
        name: Episode name from API (e.g. "Tập 1", "1").
        slug: Episode slug from API (e.g. "tap-1").

    Returns:
        Normalized episode number string, or empty string if unparseable.
    """
    # Try name first
    if name:
        # "Full" / "Trailer" — keep as-is
        lower_name = name.lower().strip()
        if lower_name in ("full", "trailer"):
            return name.strip().capitalize()

        # Try to extract a number
        match = re.search(r"(\d+)", name)
        if match:
            return str(int(match.group(1)))

    # Fall back to slug
    if slug:
        match = re.search(r"(\d+)", slug)
        if match:
            return str(int(match.group(1)))

    return ""


def _sort_key_for_episode(ep_number: str) -> tuple[int, str]:
    """Generate a sort key for episode numbers.

    Numeric episodes sort numerically; non-numeric sort alphabetically after.

    Args:
        ep_number: Episode number string.

    Returns:
        Sort key tuple.
    """
    try:
        return (0, str(int(ep_number)).zfill(10))
    except ValueError:
        return (1, ep_number)


def _detect_quality(movie_info: dict[str, Any]) -> str:
    """Detect video quality from movie metadata.

    Args:
        movie_info: Movie dict from detail API.

    Returns:
        Quality string (e.g. "1080p", "720p"), or empty string if unknown.
    """
    quality = movie_info.get("quality", "")
    if quality:
        quality = quality.strip().upper()
        # Normalize common formats
        if "4K" in quality or "2160" in quality:
            return "4K"
        if "1080" in quality:
            return "1080p"
        if "720" in quality:
            return "720p"
        if "480" in quality:
            return "480p"
        if "HD" in quality:
            return "720p"
        if "FHD" in quality:
            return "1080p"
        return quality.lower()
    return ""
