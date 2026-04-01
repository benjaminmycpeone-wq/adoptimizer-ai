import asyncio
import json
import logging
import re
from datetime import datetime
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from ..models import Source, Topic

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

TAX_KEYWORDS = [
    "tax", "accounting", "audit", "irs", "deduction", "credit", "income",
    "estate", "corporate", "compliance", "filing", "revenue", "fiscal",
    "depreciation", "amortization", "capital gains", "withholding", "payroll",
    "nexus", "transfer pricing", "r&d", "section 199a", "section 179",
    "advisory", "assurance", "gaap", "fasb", "sec", "financial reporting",
    "bookkeeping", "cfp", "cpa", "wealth", "trust", "nonprofit",
    "m&a", "merger", "acquisition", "valuation", "ebitda", "due diligence",
    "succession", "private equity", "ipo", "sarbanes", "sox",
    "cryptocurrency", "digital asset", "blockchain", "ai", "automation",
    "esg", "sustainability", "climate", "dei",
    "401k", "retirement", "pension", "ira", "roth",
    "real estate", "1031", "opportunity zone", "reit",
    "international", "foreign", "expatriate", "global mobility",
    "state and local", "salt", "property tax", "sales tax",
]

ARTICLE_SELECTORS = [
    "article",
    "[class*='post']", "[class*='article']", "[class*='blog']",
    "[class*='insight']", "[class*='entry']", "[class*='news-item']",
    "[class*='card']", "[class*='result']", "[class*='listing']",
    "[class*='content-item']", "[class*='media-object']",
    "li[class*='item']",
]

TITLE_SELECTORS = [
    "h2 a", "h3 a", "h2", "h3",
    "a[class*='title']", "a[class*='heading']", "a[class*='link']",
    "h4 a", "h4", "h1 a",
    "[class*='title'] a", "[class*='headline'] a",
]

CATEGORY_KEYWORDS = {
    "tax": ["tax", "irs", "deduction", "credit", "filing", "income", "withholding",
            "payroll", "estate tax", "corporate tax", "sales tax", "nexus",
            "transfer pricing", "section 199a", "section 179", "salt",
            "property tax", "opportunity zone", "1031", "bonus depreciation",
            "r&d credit", "qbi", "tcja", "secure act", "camt"],
    "audit": ["audit", "assurance", "gaap", "fasb", "sec", "financial reporting",
              "internal controls", "sarbanes", "sox", "pcaob", "aicpa",
              "revenue recognition", "lease accounting", "asc 842", "asc 606"],
    "advisory": ["advisory", "consulting", "strategy", "merger", "acquisition",
                 "valuation", "forensic", "risk", "cybersecurity", "m&a",
                 "due diligence", "transaction", "restructuring", "litigation",
                 "private equity", "ipo", "succession planning"],
    "accounting": ["accounting", "bookkeeping", "revenue recognition", "lease",
                   "depreciation", "amortization", "financial statement",
                   "consolidation", "erp", "outsourcing", "controller"],
    "wealth": ["wealth", "estate planning", "trust", "family office",
               "investment", "retirement", "cfp", "401k", "ira",
               "pension", "roth", "philanthropy", "charitable"],
    "technology": ["technology", "digital", "ai", "automation", "blockchain",
                   "cryptocurrency", "digital asset", "cybersecurity", "cloud",
                   "data analytics", "machine learning"],
    "international": ["international", "foreign", "expatriate", "global",
                      "cross-border", "transfer pricing", "beps", "pillar two",
                      "gilti", "fdii", "subpart f"],
}


def _is_relevant(text: str) -> bool:
    lower = text.lower()
    return any(kw in lower for kw in TAX_KEYWORDS)


def _infer_category(title: str) -> str | None:
    lower = title.lower()
    best_cat = None
    best_count = 0
    for cat, keywords in CATEGORY_KEYWORDS.items():
        count = sum(1 for kw in keywords if kw in lower)
        if count > best_count:
            best_count = count
            best_cat = cat
    return best_cat if best_count > 0 else None


def _extract_link(el, base_url: str) -> str | None:
    if el.name == "a" and el.get("href"):
        href = el["href"]
        if href.startswith(("#", "javascript:", "mailto:")):
            return None
        return href if href.startswith("http") else urljoin(base_url, href)
    anchor = el.find("a", href=True)
    if anchor:
        href = anchor["href"]
        if href.startswith(("#", "javascript:", "mailto:")):
            return None
        return href if href.startswith("http") else urljoin(base_url, href)
    parent = el.find_parent("a", href=True)
    if parent:
        href = parent["href"]
        if href.startswith(("#", "javascript:", "mailto:")):
            return None
        return href if href.startswith("http") else urljoin(base_url, href)
    return None


def _extract_date(el, soup) -> datetime | None:
    container = el.parent or el
    time_el = container.find("time")
    if time_el and time_el.get("datetime"):
        try:
            return datetime.fromisoformat(time_el["datetime"].replace("Z", "+00:00"))
        except ValueError:
            pass
    for meta_name in ["article:published_time", "datePublished", "DC.date"]:
        meta = soup.find("meta", attrs={"property": meta_name}) or soup.find("meta", attrs={"name": meta_name})
        if meta and meta.get("content"):
            try:
                return datetime.fromisoformat(meta["content"].replace("Z", "+00:00"))
            except ValueError:
                pass
    for cls_pattern in ["date", "time", "published"]:
        date_el = container.find(class_=re.compile(cls_pattern, re.I))
        if date_el:
            text = date_el.get_text(strip=True)
            for fmt in ["%B %d, %Y", "%b %d, %Y", "%m/%d/%Y", "%Y-%m-%d"]:
                try:
                    return datetime.strptime(text, fmt)
                except ValueError:
                    continue
    return None


def _extract_summary(el, soup) -> str | None:
    container = el.parent or el
    p = container.find("p")
    if p:
        text = p.get_text(strip=True)
        if len(text) > 30:
            return text[:300]
    if el.next_sibling:
        sib = el.next_sibling
        if hasattr(sib, 'get_text'):
            text = sib.get_text(strip=True)
            if len(text) > 30:
                return text[:300]
    meta = soup.find("meta", attrs={"name": "description"})
    if meta and meta.get("content"):
        return meta["content"][:300]
    return None


def _extract_author(el) -> str | None:
    container = el.parent or el
    for cls_pattern in ["author", "byline", "writer", "contributor"]:
        author_el = container.find(class_=re.compile(cls_pattern, re.I))
        if author_el:
            text = author_el.get_text(strip=True)
            if 3 < len(text) < 80:
                return text
    return None


def extract_articles(html: str, source: Source) -> list[dict]:
    """Extract articles using a multi-layer strategy."""
    base_url = source.blog_url or source.url
    soup = BeautifulSoup(html, "html.parser")
    articles = []
    seen_titles = set()

    custom_selectors = []
    if source.selector_config:
        try:
            config = json.loads(source.selector_config)
            custom_selectors = config.get("selectors", [])
        except (json.JSONDecodeError, TypeError):
            pass

    all_title_selectors = custom_selectors + TITLE_SELECTORS

    containers = []
    for sel in ARTICLE_SELECTORS:
        containers.extend(soup.select(sel))

    if containers:
        for container in containers[:60]:
            for sel in all_title_selectors:
                for el in container.select(sel):
                    title = el.get_text(strip=True)
                    if not title or len(title) < 15 or len(title) > 300:
                        continue
                    title_key = title.lower().strip()
                    if title_key in seen_titles:
                        continue
                    if not _is_relevant(title):
                        continue
                    seen_titles.add(title_key)
                    articles.append({
                        "title": title,
                        "url": _extract_link(el, base_url),
                        "published_at": _extract_date(el, soup),
                        "summary": _extract_summary(el, soup),
                        "author": _extract_author(el),
                        "category": _infer_category(title),
                    })
                    if len(articles) >= 40:
                        return articles
                if articles:
                    break

    if len(articles) < 5:
        for sel in all_title_selectors:
            for el in soup.select(sel):
                title = el.get_text(strip=True)
                if not title or len(title) < 15 or len(title) > 300:
                    continue
                title_key = title.lower().strip()
                if title_key in seen_titles:
                    continue
                if not _is_relevant(title):
                    continue
                seen_titles.add(title_key)
                articles.append({
                    "title": title,
                    "url": _extract_link(el, base_url),
                    "published_at": _extract_date(el, soup),
                    "summary": _extract_summary(el, soup),
                    "author": _extract_author(el),
                    "category": _infer_category(title),
                })
                if len(articles) >= 40:
                    return articles

    return articles


async def _scrape_one(source: Source, client: httpx.AsyncClient, retry: int = 2) -> dict:
    """Scrape a single source with retry logic."""
    url = source.blog_url or source.url
    if not url:
        return {"source_id": source.id, "name": source.name, "found": 0, "new": 0, "error": "No URL configured"}

    last_error = None
    for attempt in range(retry + 1):
        try:
            resp = await client.get(url, headers=HEADERS)
            resp.raise_for_status()
            articles = extract_articles(resp.text, source)
            return {
                "source_id": source.id, "name": source.name,
                "found": len(articles), "articles": articles, "error": None,
            }
        except httpx.HTTPStatusError as exc:
            last_error = f"HTTP {exc.response.status_code}"
            if exc.response.status_code in (429, 503):
                await asyncio.sleep(2 ** attempt)
                continue
            break
        except (httpx.TimeoutException, httpx.ConnectError) as exc:
            last_error = str(exc)
            if attempt < retry:
                await asyncio.sleep(1.5 ** attempt)
                continue
            break
        except Exception as exc:
            last_error = str(exc)
            break

    return {
        "source_id": source.id, "name": source.name,
        "found": 0, "articles": [], "error": last_error,
    }


async def scrape_all_sources(db_session, concurrency: int = 15) -> dict:
    """Scrape all active sources in parallel with rate limiting."""
    sources = db_session.query(Source).filter(Source.active == True).all()
    if not sources:
        return {"total_new": 0, "sources": []}

    semaphore = asyncio.Semaphore(concurrency)
    results = []

    async def _bounded_scrape(source):
        async with semaphore:
            result = await _scrape_one(source, client)
            await asyncio.sleep(0.3)
            return result

    async with httpx.AsyncClient(timeout=25, follow_redirects=True) as client:
        tasks = [_bounded_scrape(s) for s in sources]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    source_map = {s.id: s for s in sources}
    total_new = 0
    output = []

    for result in results:
        if isinstance(result, Exception):
            continue

        source = source_map.get(result["source_id"])
        if not source:
            continue

        if result["error"]:
            source.scrape_error = result["error"][:500]
            source.scrape_fail_count = (source.scrape_fail_count or 0) + 1
            if (source.scrape_fail_count or 0) >= 5:
                source.active = False
                logger.warning("Auto-deactivated source %s after 5 failures", source.name)
        else:
            source.scrape_error = None
            source.scrape_fail_count = 0
            source.scrape_success_count = (source.scrape_success_count or 0) + 1

        source.last_scraped = datetime.utcnow()

        new_count = 0
        for art in result.get("articles", []):
            exists = db_session.query(Topic).filter(
                Topic.source_id == source.id,
                Topic.title == art["title"],
            ).first()
            if not exists:
                topic = Topic(
                    source_id=source.id,
                    title=art["title"],
                    url=art.get("url"),
                    discovered_at=datetime.utcnow(),
                    published_at=art.get("published_at"),
                    summary=art.get("summary"),
                    author=art.get("author"),
                    category=art.get("category"),
                    status="new",
                )
                db_session.add(topic)
                new_count += 1

        total_new += new_count
        output.append({
            "source": source.name,
            "found": result["found"],
            "new": new_count,
            "error": result.get("error"),
        })

    db_session.commit()
    logger.info("Scraped %d sources: %d new topics", len(sources), total_new)
    return {"total_new": total_new, "sources": output}
