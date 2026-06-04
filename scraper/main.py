"""
Cinemax Scraper — Main Orchestrator

CLI entry point that coordinates the full scrape pipeline:
  1. Load sources from sources.yaml
  2. Fetch movie list pages
  3. Fetch detail pages for each movie
  4. Extract m3u8 + iframe stream links
  5. Diff-check against existing KV data
  6. Write only changed data to Cloudflare KV

Usage:
    python -m scraper.main --tier all --pages 3 --verbose
    python -m scraper.main --tier a --dry-run
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# Force UTF-8 on Windows to avoid UnicodeEncodeError with emoji
if sys.platform == "win32":
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    except (AttributeError, OSError):
        pass

from rich.console import Console
from rich.logging import RichHandler
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn
from rich.table import Table

from .config import AppConfig, SourceConfig, load_config
from .extractors import (
    build_kv_value,
    extract_episodes,
    extract_movie_list,
    extract_movie_metadata,
    extract_total_pages,
)
from .fetchers import FetcherCascade
from .kv_client import CloudflareKVClient

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
LOG_DIR = Path(__file__).resolve().parent / "logs"
console = Console()

# ---------------------------------------------------------------------------
# Stats tracker
# ---------------------------------------------------------------------------

@dataclass
class ScrapeStats:
    """Tracks scraping statistics for a single run."""

    movies_found: int = 0
    movies_processed: int = 0
    movies_skipped: int = 0
    movies_failed: int = 0
    kv_created: int = 0
    kv_updated: int = 0
    kv_unchanged: int = 0
    kv_errors: int = 0
    total_episodes: int = 0
    total_streams: int = 0
    sources_processed: list[str] = field(default_factory=list)
    start_time: float = field(default_factory=time.time)

    @property
    def elapsed(self) -> float:
        return time.time() - self.start_time

    def print_summary(self) -> None:
        """Print a rich summary table."""
        table = Table(title="🕷️ Scraper Run Summary", show_header=True)
        table.add_column("Metric", style="cyan")
        table.add_column("Value", style="green", justify="right")

        table.add_row("Sources", ", ".join(self.sources_processed) or "—")
        table.add_row("Movies found", str(self.movies_found))
        table.add_row("Movies processed", str(self.movies_processed))
        table.add_row("Movies skipped", str(self.movies_skipped))
        table.add_row("Movies failed", str(self.movies_failed))
        table.add_row("Episodes extracted", str(self.total_episodes))
        table.add_row("Streams extracted", str(self.total_streams))
        table.add_row("─" * 20, "─" * 10)
        table.add_row("KV created", str(self.kv_created))
        table.add_row("KV updated", str(self.kv_updated))
        table.add_row("KV unchanged", str(self.kv_unchanged))
        table.add_row("KV errors", str(self.kv_errors))
        table.add_row("─" * 20, "─" * 10)
        table.add_row("Duration", f"{self.elapsed:.1f}s")

        console.print(table)


# ---------------------------------------------------------------------------
# Core pipeline
# ---------------------------------------------------------------------------

async def scrape_source(
    source: SourceConfig,
    fetcher: FetcherCascade,
    kv: CloudflareKVClient,
    stats: ScrapeStats,
    *,
    max_pages: int = 3,
    dry_run: bool = False,
) -> None:
    """Scrape a single source: list pages → detail pages → KV.

    Args:
        source: Source configuration.
        fetcher: Fetcher cascade instance.
        kv: Cloudflare KV client.
        stats: Stats tracker.
        max_pages: Maximum number of list pages to crawl.
        dry_run: If True, don't write to KV.
    """
    logger = logging.getLogger(f"cinemax.{source.key}")
    logger.info("Starting scrape for source: %s (%s)", source.name, source.base_url)
    stats.sources_processed.append(source.name)

    # Override max_pages from source config if set
    effective_max_pages = source.max_pages if source.max_pages > 0 else max_pages

    # Collect all movie slugs from list pages
    all_slugs: list[dict[str, Any]] = []

    with Progress(
        SpinnerColumn(),
        TextColumn(f"[bold blue]{source.name}[/] — Fetching list pages..."),
        BarColumn(),
        TaskProgressColumn(),
        console=console,
    ) as progress:
        task = progress.add_task("pages", total=effective_max_pages)

        for page in range(1, effective_max_pages + 1):
            list_url = source.api.list.format(page=page)

            data, result = await fetcher.fetch_json(
                list_url,
                allowed_tiers=source.fetcher_tiers,
            )

            if data is None:
                logger.warning(
                    "Failed to fetch list page %d from %s: %s",
                    page, source.name, result.error,
                )
                progress.advance(task)
                continue

            movies = extract_movie_list(data)
            if not movies:
                logger.info("No movies found on page %d — stopping pagination", page)
                progress.advance(task)
                break

            all_slugs.extend(movies)
            progress.advance(task)

            # Rate limiting
            if source.rate_limit > 0:
                await asyncio.sleep(source.rate_limit)

    # Deduplicate by slug
    seen_slugs: set[str] = set()
    unique_movies: list[dict[str, Any]] = []
    for movie in all_slugs:
        slug = movie["slug"]
        if slug not in seen_slugs:
            seen_slugs.add(slug)
            unique_movies.append(movie)

    stats.movies_found += len(unique_movies)
    logger.info(
        "Found %d unique movies from %s (%d pages)",
        len(unique_movies), source.name, effective_max_pages,
    )

    # Process each movie
    with Progress(
        SpinnerColumn(),
        TextColumn(f"[bold blue]{source.name}[/] — Processing movies..."),
        BarColumn(),
        TaskProgressColumn(),
        TextColumn("[dim]{task.fields[slug]}[/]"),
        console=console,
    ) as progress:
        task = progress.add_task(
            "movies", total=len(unique_movies), slug="",
        )

        for movie_info in unique_movies:
            slug = movie_info["slug"]
            progress.update(task, slug=slug)

            try:
                await _process_movie(
                    slug=slug,
                    source=source,
                    fetcher=fetcher,
                    kv=kv,
                    stats=stats,
                    dry_run=dry_run,
                    logger=logger,
                )
            except Exception as exc:
                logger.error("Unexpected error processing %s: %s", slug, exc)
                stats.movies_failed += 1

            progress.advance(task)

            # Rate limiting
            if source.rate_limit > 0:
                await asyncio.sleep(source.rate_limit)


async def _process_movie(
    slug: str,
    source: SourceConfig,
    fetcher: FetcherCascade,
    kv: CloudflareKVClient,
    stats: ScrapeStats,
    dry_run: bool,
    logger: logging.Logger,
) -> None:
    """Process a single movie: fetch detail → extract → diff → write KV.

    Args:
        slug: Movie slug.
        source: Source configuration.
        fetcher: Fetcher cascade.
        kv: KV client.
        stats: Stats tracker.
        dry_run: If True, don't write to KV.
        logger: Logger instance.
    """
    detail_url = source.api.detail.format(slug=slug)

    data, result = await fetcher.fetch_json(
        detail_url,
        allowed_tiers=source.fetcher_tiers,
    )

    if data is None:
        logger.warning("Failed to fetch detail for %s: %s", slug, result.error)
        stats.movies_failed += 1
        return

    # Extract metadata and episodes
    metadata = extract_movie_metadata(data)
    episodes = extract_episodes(
        data,
        source_key=source.key,
        referer=source.referer,
        default_quality=source.default_quality,
    )

    if not episodes:
        logger.debug("No episodes found for %s — skipping", slug)
        stats.movies_skipped += 1
        return

    # Count streams
    stream_count = sum(len(ep.streams) for ep in episodes)
    stats.total_episodes += len(episodes)
    stats.total_streams += stream_count

    # Build KV value (merge with existing if any)
    existing_kv = None
    if kv.is_configured:
        existing_kv = await kv.get(slug)

    kv_value = build_kv_value(metadata, episodes, existing=existing_kv)

    # Diff check and write
    if kv.is_configured:
        was_written, reason = await kv.diff_and_write(
            slug, kv_value, dry_run=dry_run,
        )

        if reason == "created":
            stats.kv_created += 1
            logger.info("✅ Created KV: %s (%d eps, %d streams)", slug, len(episodes), stream_count)
        elif reason == "updated":
            stats.kv_updated += 1
            logger.info("🔄 Updated KV: %s (%d eps, %d streams)", slug, len(episodes), stream_count)
        elif reason == "unchanged":
            stats.kv_unchanged += 1
            logger.debug("⏭️  Unchanged: %s", slug)
        elif reason == "dry_run":
            logger.info("🏃 [DRY RUN] Would write: %s (%d eps, %d streams)", slug, len(episodes), stream_count)
        elif reason == "error":
            stats.kv_errors += 1
            logger.error("❌ KV write failed: %s", slug)
    else:
        logger.info(
            "📋 [NO KV] %s — %d eps, %d streams (KV not configured)",
            slug, len(episodes), stream_count,
        )

    stats.movies_processed += 1


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse command-line arguments.

    Args:
        argv: Argument list (defaults to sys.argv).

    Returns:
        Parsed arguments namespace.
    """
    parser = argparse.ArgumentParser(
        prog="cinemax-scraper",
        description="🕷️ Cinemax Movie Scraper Bot — crawl sources, extract streams, push to CF KV",
    )
    parser.add_argument(
        "--tier",
        choices=["a", "b", "c", "all"],
        default="all",
        help="Source tier to scrape: a (API), b (light anti-bot), c (heavy), all (default)",
    )
    parser.add_argument(
        "--pages",
        type=int,
        default=3,
        help="Number of list pages to crawl per source (default: 3)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and extract but don't write to KV",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose/debug logging",
    )
    parser.add_argument(
        "--sources",
        nargs="+",
        help="Only scrape specific sources by key (e.g. --sources ophim kkphim)",
    )
    parser.add_argument(
        "--config",
        type=Path,
        help="Path to sources.yaml (default: scraper/sources.yaml)",
    )
    return parser.parse_args(argv)


def setup_logging(verbose: bool = False) -> None:
    """Configure rich-based logging.

    Args:
        verbose: If True, set level to DEBUG.
    """
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    level = logging.DEBUG if verbose else logging.INFO

    # Console handler with rich
    rich_handler = RichHandler(
        console=console,
        rich_tracebacks=True,
        show_time=True,
        show_path=False,
    )
    rich_handler.setLevel(level)

    # File handler for persistent logs
    log_file = LOG_DIR / "scraper.log"
    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(
        logging.Formatter("%(asctime)s [%(name)s] %(levelname)s: %(message)s")
    )

    # Root logger
    root = logging.getLogger("cinemax")
    root.setLevel(logging.DEBUG)
    root.handlers.clear()
    root.addHandler(rich_handler)
    root.addHandler(file_handler)


def _filter_sources(
    config: AppConfig,
    tier: str,
    source_keys: list[str] | None,
) -> list[SourceConfig]:
    """Filter sources based on tier and explicit source keys.

    Args:
        config: App config with all sources.
        tier: Tier filter ("a", "b", "c", or "all").
        source_keys: Explicit source keys to include (overrides tier).

    Returns:
        Filtered list of source configs.
    """
    sources = list(config.sources.values())

    # Filter by enabled status
    sources = [s for s in sources if s.enabled]

    # Filter by explicit source keys if provided
    if source_keys:
        sources = [s for s in sources if s.key in source_keys]
        return sources

    # Filter by tier
    # Tier A: sources that only need httpx
    # Tier B: sources that need scrapling
    # Tier C: sources that need stealthy/camoufox
    if tier == "a":
        sources = [s for s in sources if s.fetcher_tiers[0] == "httpx"]
    elif tier == "b":
        sources = [s for s in sources if "scrapling" in s.fetcher_tiers and s.fetcher_tiers[0] != "httpx"]
    elif tier == "c":
        sources = [s for s in sources if "stealthy" in s.fetcher_tiers and s.fetcher_tiers[0] not in ("httpx", "scrapling")]

    return sources


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def async_main(args: argparse.Namespace) -> int:
    """Async entry point for the scraper pipeline.

    Args:
        args: Parsed CLI arguments.

    Returns:
        Exit code (0 = success, 1 = errors).
    """
    setup_logging(verbose=args.verbose)
    logger = logging.getLogger("cinemax.main")

    console.print(
        "\n[bold magenta]🕷️ Cinemax Scraper Bot[/bold magenta]",
        highlight=False,
    )
    console.print(
        f"  Tier: [cyan]{args.tier}[/] | Pages: [cyan]{args.pages}[/] | "
        f"Dry run: [cyan]{args.dry_run}[/]\n",
    )

    # Load config
    try:
        config = load_config(args.config)
    except (FileNotFoundError, ValueError) as exc:
        console.print(f"[red]Config error: {exc}[/red]")
        return 1

    # Filter sources
    sources = _filter_sources(config, args.tier, args.sources)
    if not sources:
        console.print("[yellow]No enabled sources match the filter — nothing to do.[/yellow]")
        return 0

    console.print(
        f"  Sources: [green]{', '.join(s.name for s in sources)}[/green]\n",
    )

    # Initialize KV client
    kv = CloudflareKVClient(config.kv)
    if not kv.is_configured:
        console.print(
            "[yellow]⚠️  Cloudflare KV not configured — running in extract-only mode[/yellow]\n"
        )

    # Initialize fetcher cascade
    fetcher = FetcherCascade(
        user_agent=config.user_agent,
        proxy_url=config.proxy_url,
    )

    # Run scraper for each source
    stats = ScrapeStats()

    for source in sources:
        try:
            await scrape_source(
                source=source,
                fetcher=fetcher,
                kv=kv,
                stats=stats,
                max_pages=args.pages,
                dry_run=args.dry_run,
            )
        except Exception as exc:
            logger.error("Source %s failed: %s", source.name, exc, exc_info=True)

    # Print summary
    console.print()
    stats.print_summary()

    # Log summary to file
    logger.info(
        "Run complete: %d found, %d processed, %d created, %d updated, "
        "%d unchanged, %d failed, %d errors in %.1fs",
        stats.movies_found, stats.movies_processed, stats.kv_created,
        stats.kv_updated, stats.kv_unchanged, stats.movies_failed,
        stats.kv_errors, stats.elapsed,
    )

    return 1 if stats.kv_errors > 0 else 0


def main() -> None:
    """Synchronous CLI entry point."""
    args = parse_args()
    exit_code = asyncio.run(async_main(args))
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
