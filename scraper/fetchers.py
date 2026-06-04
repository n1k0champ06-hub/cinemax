"""
Cinemax Scraper — Fetcher Cascade Module

Provides a multi-tier HTTP fetcher that tries progressively heavier
browser-emulation strategies to beat anti-bot protections:

  Tier A: httpx (fast, async, lightweight)
  Tier B: Scrapling Fetcher (browser-like TLS fingerprint)
  Tier C: Scrapling StealthyFetcher (full headless browser)

Each tier is tried in order until one succeeds. The cascade is
configurable per source via sources.yaml.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any

import httpx

logger = logging.getLogger("cinemax.fetchers")

# ---------------------------------------------------------------------------
# Response wrapper
# ---------------------------------------------------------------------------

@dataclass
class FetchResult:
    """Normalized result from any fetcher tier."""

    url: str
    status_code: int
    text: str
    headers: dict[str, str] = field(default_factory=dict)
    tier: str = "unknown"
    ok: bool = False
    error: str | None = None

    def json(self) -> Any:
        """Parse the response body as JSON.

        Returns:
            Parsed JSON data.

        Raises:
            ValueError: If the body is not valid JSON.
        """
        import json

        try:
            return json.loads(self.text)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Failed to parse JSON from {self.url}: {exc}") from exc


# ---------------------------------------------------------------------------
# Individual fetcher implementations
# ---------------------------------------------------------------------------

async def _fetch_httpx(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    proxy: str | None = None,
    timeout: float = 30.0,
) -> FetchResult:
    """Tier A: Fast async fetch with httpx.

    Args:
        url: Target URL.
        headers: Optional HTTP headers.
        proxy: Optional proxy URL (e.g. socks5://...).
        timeout: Request timeout in seconds.

    Returns:
        FetchResult with the response data.
    """
    try:
        async with httpx.AsyncClient(
            http2=True,
            follow_redirects=True,
            timeout=httpx.Timeout(timeout),
            proxy=proxy,
            verify=True,
        ) as client:
            response = await client.get(url, headers=headers or {})
            return FetchResult(
                url=url,
                status_code=response.status_code,
                text=response.text,
                headers=dict(response.headers),
                tier="httpx",
                ok=200 <= response.status_code < 400,
            )
    except httpx.TimeoutException:
        logger.warning("httpx timeout for %s", url)
        return FetchResult(
            url=url, status_code=0, text="", tier="httpx",
            ok=False, error="Timeout",
        )
    except httpx.HTTPError as exc:
        logger.warning("httpx error for %s: %s", url, exc)
        return FetchResult(
            url=url, status_code=0, text="", tier="httpx",
            ok=False, error=str(exc),
        )
    except Exception as exc:
        logger.error("httpx unexpected error for %s: %s", url, exc)
        return FetchResult(
            url=url, status_code=0, text="", tier="httpx",
            ok=False, error=str(exc),
        )


def _fetch_scrapling_sync(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    proxy: str | None = None,
) -> FetchResult:
    """Tier B: Scrapling Fetcher (browser-like TLS, sync).

    Uses Scrapling's Fetcher which provides realistic TLS fingerprints
    without launching a full browser.

    Args:
        url: Target URL.
        headers: Optional HTTP headers.
        proxy: Optional proxy URL.

    Returns:
        FetchResult with the response data.
    """
    try:
        from scrapling import Fetcher

        fetcher = Fetcher(auto_match=False)
        response = fetcher.get(
            url,
            headless=True,
            extra_headers=headers or {},
        )
        return FetchResult(
            url=url,
            status_code=response.status,
            text=response.text,
            headers=dict(response.headers) if hasattr(response, "headers") else {},
            tier="scrapling",
            ok=200 <= response.status < 400,
        )
    except ImportError:
        logger.warning("Scrapling not installed — skipping tier B")
        return FetchResult(
            url=url, status_code=0, text="", tier="scrapling",
            ok=False, error="Scrapling not installed",
        )
    except Exception as exc:
        logger.warning("Scrapling error for %s: %s", url, exc)
        return FetchResult(
            url=url, status_code=0, text="", tier="scrapling",
            ok=False, error=str(exc),
        )


def _fetch_stealthy_sync(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    proxy: str | None = None,
) -> FetchResult:
    """Tier C: Scrapling StealthyFetcher (full headless browser).

    Launches a real Chromium-based browser for maximum stealth.
    This is the slowest tier but bypasses most protections.

    Args:
        url: Target URL.
        headers: Optional HTTP headers.
        proxy: Optional proxy URL.

    Returns:
        FetchResult with the response data.
    """
    try:
        from scrapling import StealthyFetcher

        fetcher = StealthyFetcher(auto_match=False)
        response = fetcher.fetch(
            url,
            headless=True,
            extra_headers=headers or {},
        )
        return FetchResult(
            url=url,
            status_code=response.status,
            text=response.text,
            headers=dict(response.headers) if hasattr(response, "headers") else {},
            tier="stealthy",
            ok=200 <= response.status < 400,
        )
    except ImportError:
        logger.warning("Scrapling StealthyFetcher not available — skipping tier C")
        return FetchResult(
            url=url, status_code=0, text="", tier="stealthy",
            ok=False, error="StealthyFetcher not installed",
        )
    except Exception as exc:
        logger.warning("StealthyFetcher error for %s: %s", url, exc)
        return FetchResult(
            url=url, status_code=0, text="", tier="stealthy",
            ok=False, error=str(exc),
        )


# ---------------------------------------------------------------------------
# Fetcher Cascade
# ---------------------------------------------------------------------------

# Registry mapping tier names to their fetcher functions
_TIER_REGISTRY: dict[str, str] = {
    "httpx": "_fetch_httpx",
    "scrapling": "_fetch_scrapling_sync",
    "stealthy": "_fetch_stealthy_sync",
}


class FetcherCascade:
    """Multi-tier fetcher that tries progressively heavier strategies.

    The cascade respects per-source tier configuration from sources.yaml.
    If a tier succeeds (HTTP 2xx/3xx), the result is returned immediately.
    If all tiers fail, the last failure result is returned.

    Example:
        cascade = FetcherCascade(
            tiers=["httpx", "scrapling", "stealthy"],
            user_agent="Mozilla/5.0 ...",
            proxy_url="socks5://127.0.0.1:1080",
        )
        result = await cascade.fetch("https://ophim1.com/phim/avengers")
        if result.ok:
            data = result.json()
    """

    def __init__(
        self,
        tiers: list[str] | None = None,
        user_agent: str = "",
        proxy_url: str | None = None,
        referer: str = "",
    ) -> None:
        """Initialize the fetcher cascade.

        Args:
            tiers: Ordered list of tier names to try. Defaults to all tiers.
            user_agent: User-Agent header to send.
            proxy_url: Optional proxy URL for all tiers.
            referer: Default Referer header.
        """
        self.tiers = tiers or list(_TIER_REGISTRY.keys())
        self.user_agent = user_agent
        self.proxy_url = proxy_url
        self.referer = referer

    def _build_headers(self, extra_headers: dict[str, str] | None = None) -> dict[str, str]:
        """Build the headers dict for a request.

        Args:
            extra_headers: Additional headers to merge.

        Returns:
            Merged headers dict.
        """
        headers: dict[str, str] = {
            "Accept": "application/json, text/html, */*",
            "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
        }
        if self.user_agent:
            headers["User-Agent"] = self.user_agent
        if self.referer:
            headers["Referer"] = self.referer
        if extra_headers:
            headers.update(extra_headers)
        return headers

    async def fetch(
        self,
        url: str,
        *,
        extra_headers: dict[str, str] | None = None,
        allowed_tiers: list[str] | None = None,
    ) -> FetchResult:
        """Fetch a URL using the tier cascade.

        Tries each tier in order. Returns the first successful result,
        or the last failure if all tiers fail.

        Args:
            url: Target URL to fetch.
            extra_headers: Additional headers to send.
            allowed_tiers: Override the default tier list for this request.

        Returns:
            FetchResult from the first successful tier.
        """
        tiers_to_try = allowed_tiers or self.tiers
        headers = self._build_headers(extra_headers)
        last_result: FetchResult | None = None

        for tier_name in tiers_to_try:
            if tier_name not in _TIER_REGISTRY:
                logger.warning("Unknown fetcher tier: %s — skipping", tier_name)
                continue

            logger.debug("Trying tier '%s' for %s", tier_name, url)

            if tier_name == "httpx":
                result = await _fetch_httpx(
                    url, headers=headers, proxy=self.proxy_url,
                )
            else:
                # Scrapling fetchers are synchronous — run in thread pool
                func_name = _TIER_REGISTRY[tier_name]
                func = globals()[func_name]
                result = await asyncio.to_thread(
                    func, url, headers=headers, proxy=self.proxy_url,
                )

            last_result = result

            if result.ok:
                logger.debug(
                    "Tier '%s' succeeded for %s (status=%d)",
                    tier_name, url, result.status_code,
                )
                return result

            logger.info(
                "Tier '%s' failed for %s: status=%d error=%s",
                tier_name, url, result.status_code, result.error,
            )

        # All tiers failed — return the last result
        assert last_result is not None, "No tiers were tried"
        logger.error("All tiers failed for %s", url)
        return last_result

    async def fetch_json(
        self,
        url: str,
        *,
        extra_headers: dict[str, str] | None = None,
        allowed_tiers: list[str] | None = None,
    ) -> tuple[Any | None, FetchResult]:
        """Fetch a URL and parse the response as JSON.

        Convenience wrapper around fetch() that handles JSON parsing.

        Args:
            url: Target URL to fetch.
            extra_headers: Additional headers to send.
            allowed_tiers: Override the default tier list.

        Returns:
            Tuple of (parsed_json_or_None, FetchResult).
        """
        result = await self.fetch(
            url, extra_headers=extra_headers, allowed_tiers=allowed_tiers,
        )
        if not result.ok:
            return None, result

        try:
            data = result.json()
            return data, result
        except ValueError as exc:
            logger.warning("JSON parse failed for %s: %s", url, exc)
            result.ok = False
            result.error = f"JSON parse error: {exc}"
            return None, result
