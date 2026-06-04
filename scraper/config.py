"""
Cinemax Scraper — Configuration Module

Loads source definitions from sources.yaml and environment variables
for Cloudflare KV, proxy settings, and other runtime config.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Load .env from project root (two levels up from scraper/)
# ---------------------------------------------------------------------------
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_ENV_PATH = _PROJECT_ROOT / ".env"
load_dotenv(_ENV_PATH, override=False)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SOURCES_YAML_PATH = Path(__file__).resolve().parent / "sources.yaml"


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class SourceAPI:
    """URL templates for a movie source's API endpoints."""

    list: str
    detail: str


@dataclass(frozen=True)
class SourceConfig:
    """Configuration for a single movie source (e.g. OPhim, KKPhim)."""

    key: str
    name: str
    enabled: bool
    base_url: str
    api: SourceAPI
    referer: str
    fetcher_tiers: list[str] = field(default_factory=lambda: ["httpx"])
    rate_limit: float = 0.5
    max_pages: int = 0
    default_quality: str = "1080p"


@dataclass(frozen=True)
class CloudflareKVConfig:
    """Cloudflare KV REST API credentials."""

    account_id: str
    api_token: str
    namespace_id: str

    @property
    def is_configured(self) -> bool:
        """Return True if all required credentials are set."""
        return bool(self.account_id and self.api_token and self.namespace_id)

    @property
    def base_url(self) -> str:
        """Return the KV REST API base URL."""
        return (
            f"https://api.cloudflare.com/client/v4/accounts/"
            f"{self.account_id}/storage/kv/namespaces/{self.namespace_id}"
        )


@dataclass(frozen=True)
class AppConfig:
    """Top-level application configuration."""

    sources: dict[str, SourceConfig]
    kv: CloudflareKVConfig
    proxy_url: str | None
    user_agent: str


# ---------------------------------------------------------------------------
# Loaders
# ---------------------------------------------------------------------------
def _load_sources_yaml(path: Path | None = None) -> dict[str, Any]:
    """Load and parse the sources.yaml file.

    Args:
        path: Override path to sources.yaml. Defaults to the bundled file.

    Returns:
        Parsed YAML as a dict.

    Raises:
        FileNotFoundError: If the YAML file doesn't exist.
        yaml.YAMLError: If the YAML is malformed.
    """
    yaml_path = path or SOURCES_YAML_PATH
    if not yaml_path.exists():
        raise FileNotFoundError(f"Sources config not found: {yaml_path}")

    with open(yaml_path, "r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh)

    if not isinstance(data, dict) or "sources" not in data:
        raise ValueError(f"Invalid sources.yaml: missing 'sources' key in {yaml_path}")

    return data


def _parse_source(key: str, raw: dict[str, Any]) -> SourceConfig:
    """Parse a raw source dict from YAML into a SourceConfig.

    Args:
        key: The source identifier (e.g. 'ophim').
        raw: Raw dict from YAML.

    Returns:
        A validated SourceConfig instance.
    """
    api_raw = raw.get("api", {})
    return SourceConfig(
        key=key,
        name=raw.get("name", key),
        enabled=raw.get("enabled", True),
        base_url=raw.get("base_url", ""),
        api=SourceAPI(
            list=api_raw.get("list", ""),
            detail=api_raw.get("detail", ""),
        ),
        referer=raw.get("referer", ""),
        fetcher_tiers=raw.get("fetcher_tiers", ["httpx"]),
        rate_limit=float(raw.get("rate_limit", 0.5)),
        max_pages=int(raw.get("max_pages", 0)),
        default_quality=raw.get("default_quality", "1080p"),
    )


def load_config(sources_path: Path | None = None) -> AppConfig:
    """Load the full application configuration.

    Reads sources.yaml and merges with environment variables for
    Cloudflare KV credentials and proxy settings.

    Args:
        sources_path: Override path to sources.yaml.

    Returns:
        A fully populated AppConfig instance.
    """
    raw_data = _load_sources_yaml(sources_path)

    sources: dict[str, SourceConfig] = {}
    for key, raw_source in raw_data.get("sources", {}).items():
        sources[key] = _parse_source(key, raw_source)

    kv_config = CloudflareKVConfig(
        account_id=os.getenv("CF_ACCOUNT_ID", ""),
        api_token=os.getenv("CF_API_TOKEN", ""),
        namespace_id=os.getenv("CF_KV_NAMESPACE_ID", ""),
    )

    proxy_url = os.getenv("PROXY_URL") or None

    user_agent = os.getenv(
        "SCRAPER_USER_AGENT",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    )

    return AppConfig(
        sources=sources,
        kv=kv_config,
        proxy_url=proxy_url,
        user_agent=user_agent,
    )
