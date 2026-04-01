import csv
import io
import logging
import httpx
from urllib.parse import urljoin, urlparse
from ..models import Source

logger = logging.getLogger(__name__)

BLOG_PATH_CANDIDATES = [
    "/blog", "/insights", "/resources", "/articles", "/news",
    "/thought-leadership", "/knowledge-center", "/tax-insights",
    "/perspectives", "/publications", "/alerts", "/updates",
]

FIRM_SIZE_FROM_RANK = [
    (4, "big4"), (10, "top10"), (25, "top25"), (50, "top50"),
    (100, "top100"), (300, "regional"), (500, "local"),
]


def classify_firm_size(rank: int | None) -> str:
    if rank is None:
        return "regional"
    for threshold, size in FIRM_SIZE_FROM_RANK:
        if rank <= threshold:
            return size
    return "local"


def compute_source_authority(ipa_rank: int | None, firm_size: str) -> float:
    """Compute authority score from IPA rank and firm size tier."""
    tier_base = {
        "big4": 1.0, "top10": 0.93, "top25": 0.87, "top50": 0.82,
        "top100": 0.76, "regional": 0.65, "local": 0.55,
    }.get(firm_size, 0.5)
    if ipa_rank and ipa_rank > 0:
        rank_bonus = 0.05 * (1 - ipa_rank / 500)
        return min(1.0, round(tier_base + rank_bonus, 3))
    return tier_base


TIER_MAP = {
    "big 4 (tier 1)": "big4",
    "big4 (tier 1)": "big4",
    "national (tier 2)": "national",
    "regional (tier 3)": "regional",
    "boutique niche": "boutique",
}


def normalize_tier(tier_str: str) -> str:
    return TIER_MAP.get(tier_str.strip().lower(), "regional")


def import_sources_from_csv(db_session, csv_content: str) -> dict:
    """Import sources from CSV string content."""
    reader = csv.DictReader(io.StringIO(csv_content))
    imported = 0
    skipped = 0
    updated = 0
    errors = []

    for i, row in enumerate(reader, start=2):
        try:
            name = (row.get("Name") or row.get("name") or "").strip()
            if not name:
                errors.append(f"Row {i}: missing name")
                continue

            exists = db_session.query(Source).filter(Source.name == name).first()

            rank_str = (row.get("rank") or "").strip()
            rank = int(rank_str) if rank_str.isdigit() else None

            tier = (row.get("Tier") or row.get("firm_size") or "").strip()
            firm_size = normalize_tier(tier) if tier else (classify_firm_size(rank) if rank else "regional")

            main_url = (row.get("main_url") or "").strip()
            blog_url = (row.get("Blog URL") or row.get("blog_url") or "").strip()
            rss_url = (row.get("RSS URL") or "").strip()
            linkedin_url = (row.get("LinkedIn URL") or "").strip()
            state = (row.get("State") or "").strip()
            niche = (row.get("Primary Niche") or "").strip()
            services = (row.get("Services") or "").strip()
            specialties = (row.get("specialties") or services or "").strip()
            post_frequency = (row.get("Post Frequency") or "").strip()
            active_str = (row.get("Active") or "Yes").strip().lower()
            active = active_str in ("yes", "true", "1", "")

            authority = compute_source_authority(rank, firm_size)

            if exists:
                if blog_url and not exists.blog_url:
                    exists.blog_url = blog_url
                if rss_url:
                    exists.rss_url = rss_url
                if linkedin_url:
                    exists.linkedin_url = linkedin_url
                if state:
                    exists.state = state
                if niche:
                    exists.niche = niche
                if services:
                    exists.services = services
                if post_frequency:
                    exists.post_frequency = post_frequency
                if tier:
                    exists.firm_size = firm_size
                    exists.source_authority = authority
                updated += 1
                continue

            source = Source(
                name=name,
                url=main_url or blog_url or "",
                blog_url=blog_url or None,
                rss_url=rss_url or None,
                linkedin_url=linkedin_url or None,
                ipa_rank=rank,
                firm_size=firm_size,
                state=state or None,
                niche=niche or None,
                services=services or None,
                post_frequency=post_frequency or None,
                specialties=specialties or None,
                source_authority=authority,
                active=active,
            )
            db_session.add(source)
            imported += 1

        except Exception as exc:
            errors.append(f"Row {i}: {str(exc)}")

    db_session.commit()
    return {"imported": imported, "skipped": skipped, "updated": updated, "errors": errors}


def guess_blog_url(main_url: str) -> list[str]:
    if not main_url:
        return []
    parsed = urlparse(main_url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    return [base + path for path in BLOG_PATH_CANDIDATES]


async def auto_discover_blog_urls(db_session, timeout: float = 8.0) -> dict:
    """For sources missing blog_url, try common paths and save the first that works."""
    sources = db_session.query(Source).filter(
        Source.active == True,
        (Source.blog_url == None) | (Source.blog_url == ""),
    ).all()

    discovered = 0
    failed = 0

    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        for source in sources:
            candidates = guess_blog_url(source.url)
            found = False
            for url in candidates:
                try:
                    resp = await client.head(url)
                    if resp.status_code < 400:
                        source.blog_url = url
                        discovered += 1
                        found = True
                        logger.info("Discovered blog URL for %s: %s", source.name, url)
                        break
                except Exception:
                    continue
            if not found:
                failed += 1

    db_session.commit()
    return {"discovered": discovered, "failed": failed, "checked": len(sources)}
