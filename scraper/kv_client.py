"""
Cinemax Scraper — Cloudflare KV Client Module

Wraps the Cloudflare Workers KV REST API for reading/writing movie
stream data. Supports single and bulk operations, plus diff-checking
to avoid unnecessary writes.
"""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any

import httpx

from .config import CloudflareKVConfig

logger = logging.getLogger("cinemax.kv_client")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
KV_KEY_PREFIX = "movie:"
MAX_VALUE_SIZE = 25 * 1024 * 1024  # 25 MB KV value limit


# ---------------------------------------------------------------------------
# CloudflareKVClient
# ---------------------------------------------------------------------------

class CloudflareKVClient:
    """Client for interacting with Cloudflare Workers KV via REST API.

    Provides methods for reading/writing movie data with diff-checking
    to minimize unnecessary API calls.

    Example:
        config = CloudflareKVConfig(
            account_id="abc",
            api_token="token",
            namespace_id="ns123",
        )
        client = CloudflareKVClient(config)
        await client.put("movie:avengers", {"title": "Avengers", ...})
        data = await client.get("movie:avengers")
    """

    def __init__(self, config: CloudflareKVConfig) -> None:
        """Initialize the KV client.

        Args:
            config: Cloudflare KV configuration with credentials.
        """
        self.config = config
        self._base_url = config.base_url
        self._headers = {
            "Authorization": f"Bearer {config.api_token}",
            "Content-Type": "application/json",
        }

    @property
    def is_configured(self) -> bool:
        """Check if KV credentials are set."""
        return self.config.is_configured

    def _make_key(self, slug: str) -> str:
        """Build the full KV key for a movie slug.

        Args:
            slug: Movie slug (e.g. "avengers-endgame").

        Returns:
            Full KV key (e.g. "movie:avengers-endgame").
        """
        if slug.startswith(KV_KEY_PREFIX):
            return slug
        return f"{KV_KEY_PREFIX}{slug}"

    async def get(self, key: str) -> dict[str, Any] | None:
        """Read a single key from KV.

        Args:
            key: The KV key (with or without "movie:" prefix).

        Returns:
            Parsed JSON value, or None if the key doesn't exist.
        """
        full_key = self._make_key(key)
        url = f"{self._base_url}/values/{full_key}"

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=self._headers)

                if response.status_code == 404:
                    logger.debug("KV key not found: %s", full_key)
                    return None

                if response.status_code != 200:
                    logger.error(
                        "KV GET failed for %s: status=%d body=%s",
                        full_key, response.status_code, response.text[:200],
                    )
                    return None

                return response.json()

        except httpx.HTTPError as exc:
            logger.error("KV GET error for %s: %s", full_key, exc)
            return None
        except json.JSONDecodeError as exc:
            logger.error("KV GET JSON decode error for %s: %s", full_key, exc)
            return None

    async def put(self, key: str, value: dict[str, Any]) -> bool:
        """Write a single key-value pair to KV.

        Args:
            key: The KV key (with or without "movie:" prefix).
            value: JSON-serializable dict to store.

        Returns:
            True if the write succeeded, False otherwise.
        """
        full_key = self._make_key(key)
        url = f"{self._base_url}/values/{full_key}"

        try:
            serialized = json.dumps(value, ensure_ascii=False, separators=(",", ":"))

            if len(serialized.encode("utf-8")) > MAX_VALUE_SIZE:
                logger.error(
                    "KV value too large for %s: %d bytes (max %d)",
                    full_key, len(serialized.encode("utf-8")), MAX_VALUE_SIZE,
                )
                return False

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.put(
                    url,
                    content=serialized,
                    headers=self._headers,
                )

                if response.status_code == 200:
                    logger.debug("KV PUT succeeded for %s", full_key)
                    return True

                logger.error(
                    "KV PUT failed for %s: status=%d body=%s",
                    full_key, response.status_code, response.text[:200],
                )
                return False

        except httpx.HTTPError as exc:
            logger.error("KV PUT error for %s: %s", full_key, exc)
            return False

    async def bulk_put(self, items: list[tuple[str, dict[str, Any]]]) -> int:
        """Write multiple key-value pairs to KV in bulk.

        Uses the CF KV bulk write API to write up to 10,000 pairs at once.

        Args:
            items: List of (key, value) tuples.

        Returns:
            Number of items successfully written.
        """
        if not items:
            return 0

        url = f"{self._base_url}/bulk"

        # Build bulk write payload
        bulk_payload: list[dict[str, Any]] = []
        for key, value in items:
            full_key = self._make_key(key)
            serialized = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
            bulk_payload.append({
                "key": full_key,
                "value": serialized,
            })

        # CF KV bulk write has a limit of 10,000 pairs per request
        written = 0
        batch_size = 10_000

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                for i in range(0, len(bulk_payload), batch_size):
                    batch = bulk_payload[i : i + batch_size]
                    response = await client.put(
                        url,
                        json=batch,
                        headers=self._headers,
                    )

                    if response.status_code == 200:
                        written += len(batch)
                        logger.info(
                            "KV bulk PUT: %d/%d items written",
                            written, len(bulk_payload),
                        )
                    else:
                        logger.error(
                            "KV bulk PUT failed: status=%d body=%s",
                            response.status_code, response.text[:200],
                        )

        except httpx.HTTPError as exc:
            logger.error("KV bulk PUT error: %s", exc)

        return written

    async def bulk_get(self, keys: list[str]) -> dict[str, dict[str, Any] | None]:
        """Read multiple keys from KV.

        Note: CF KV doesn't have a native bulk read API, so this issues
        concurrent individual GET requests.

        Args:
            keys: List of KV keys to read.

        Returns:
            Dict mapping keys to their values (None if not found).
        """
        import asyncio

        results: dict[str, dict[str, Any] | None] = {}

        # Use semaphore to limit concurrency
        semaphore = asyncio.Semaphore(10)

        async def _get_one(key: str) -> None:
            async with semaphore:
                results[key] = await self.get(key)

        await asyncio.gather(*[_get_one(k) for k in keys])
        return results

    async def diff_and_write(
        self,
        key: str,
        new_data: dict[str, Any],
        *,
        dry_run: bool = False,
    ) -> tuple[bool, str]:
        """Compare new data with existing KV value and write only if changed.

        Uses content hashing to detect changes, avoiding unnecessary
        writes that would count against CF KV API quotas.

        Args:
            key: The KV key (with or without "movie:" prefix).
            new_data: The new value to potentially write.
            dry_run: If True, only check for differences without writing.

        Returns:
            Tuple of (was_written, reason):
                - (True, "created") — key didn't exist, created.
                - (True, "updated") — data changed, updated.
                - (False, "unchanged") — data identical, skipped.
                - (False, "error") — an error occurred.
                - (False, "dry_run") — would have written, but dry_run=True.
        """
        full_key = self._make_key(key)
        existing = await self.get(key)

        if existing is None:
            # Key doesn't exist — create it
            if dry_run:
                logger.info("[DRY RUN] Would create KV key: %s", full_key)
                return False, "dry_run"

            success = await self.put(key, new_data)
            return success, "created" if success else "error"

        # Compare content hashes (exclude volatile fields like sources_updated)
        old_hash = _content_hash(existing)
        new_hash = _content_hash(new_data)

        if old_hash == new_hash:
            logger.debug("KV key %s unchanged — skipping write", full_key)
            return False, "unchanged"

        # Data changed — write it
        if dry_run:
            logger.info("[DRY RUN] Would update KV key: %s", full_key)
            return False, "dry_run"

        success = await self.put(key, new_data)
        return success, "updated" if success else "error"

    async def delete(self, key: str) -> bool:
        """Delete a single key from KV.

        Args:
            key: The KV key (with or without "movie:" prefix).

        Returns:
            True if deletion succeeded (or key didn't exist).
        """
        full_key = self._make_key(key)
        url = f"{self._base_url}/values/{full_key}"

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.delete(url, headers=self._headers)
                if response.status_code in (200, 404):
                    return True
                logger.error(
                    "KV DELETE failed for %s: status=%d",
                    full_key, response.status_code,
                )
                return False
        except httpx.HTTPError as exc:
            logger.error("KV DELETE error for %s: %s", full_key, exc)
            return False


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _content_hash(data: dict[str, Any]) -> str:
    """Compute a hash of KV data for diff comparison.

    Excludes volatile fields (sources_updated, checked_at) that change
    on every scrape but don't indicate a meaningful data change.

    Args:
        data: KV value dict.

    Returns:
        SHA-256 hex digest of the normalized content.
    """
    # Deep copy and strip volatile fields
    cleaned = _strip_volatile(data)
    # Canonical JSON for deterministic hashing
    canonical = json.dumps(cleaned, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _strip_volatile(obj: Any) -> Any:
    """Recursively strip volatile fields from a dict.

    Args:
        obj: Any JSON-compatible value.

    Returns:
        Cleaned copy with volatile keys removed.
    """
    volatile_keys = {"sources_updated", "checked_at"}

    if isinstance(obj, dict):
        return {
            k: _strip_volatile(v)
            for k, v in obj.items()
            if k not in volatile_keys
        }
    if isinstance(obj, list):
        return [_strip_volatile(item) for item in obj]
    return obj
