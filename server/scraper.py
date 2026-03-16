"""
AdOptimizer AI — Website Scraper with anti-bot evasion
"""

import re
import asyncio
import json
from flask import Blueprint, request, jsonify
from playwright.async_api import async_playwright
from .config import BROWSER_HEADERS, USER_AGENT, BLOCK_SIGNALS, SERVICE_MAP, CLIENT_MAP, DIFF_MAP
from .db import db
from .models import ScrapeResult

scraper_bp = Blueprint("scraper", __name__)


def check_blocked(html_content: str, status_code: int) -> str | None:
    """Returns an error message if the page appears to be blocked, else None."""
    if status_code in (403, 429, 503):
        return f"Site returned HTTP {status_code} — protected by WAF/Cloudflare."
    lc = html_content.lower()
    for signal, msg in BLOCK_SIGNALS:
        if signal in lc:
            return msg
    return None


async def try_fetch_with_playwright(url: str, browser, stealth: bool = False):
    """
    Attempt to fetch a page with Playwright.
    If stealth=True, uses extra evasion (randomized viewport, slow typing, etc.)
    Returns (page_content, status_code, title)
    """
    context_args = {
        "user_agent": USER_AGENT,
        "viewport": {"width": 1366, "height": 768} if not stealth else {"width": 1440, "height": 900},
        "locale": "en-US",
        "timezone_id": "America/New_York",
        "extra_http_headers": BROWSER_HEADERS,
    }
    context = await browser.new_context(**context_args)

    if stealth:
        await context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        """)

    page = await context.new_page()
    status_code = 200

    def capture_status(response):
        nonlocal status_code
        if response.url == url or response.url == url + '/':
            status_code = response.status

    page.on("response", capture_status)

    try:
        await page.goto(url, wait_until="networkidle", timeout=25000)
    except Exception:
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=20000)
        except Exception:
            pass

    if stealth:
        await page.wait_for_timeout(2000)

    title = await page.title()
    try:
        body_html = await page.content()
    except Exception:
        body_html = ""
    try:
        body_text = (await page.inner_text("body"))[:5000]
    except Exception:
        body_text = ""

    await context.close()
    return body_text, body_html, status_code, title


async def scrape_subpage(browser, url: str) -> str:
    """Fetch a sub-page and return its text, silently failing."""
    context = await browser.new_context(
        user_agent=USER_AGENT,
        extra_http_headers=BROWSER_HEADERS,
    )
    page = await context.new_page()
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=12000)
        text = (await page.inner_text("body"))[:2000]
    except Exception:
        text = ""
    finally:
        await context.close()
    return text


async def scrape_site(url: str) -> dict:
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--disable-infobars",
                "--disable-dev-shm-usage",
            ]
        )

        # Attempt 1: Normal fetch
        print("  Attempt 1: Normal headless fetch…")
        body_text, body_html, status_code, title = await try_fetch_with_playwright(url, browser, stealth=False)
        block_reason = check_blocked(body_html, status_code)

        # Attempt 2: Stealth mode if blocked
        if block_reason:
            print(f"  Blocked ({block_reason}), trying stealth mode…")
            body_text, body_html, status_code, title = await try_fetch_with_playwright(url, browser, stealth=True)
            block_reason = check_blocked(body_html, status_code)

        # Still blocked
        if block_reason:
            await browser.close()
            raise ValueError(
                f"{block_reason}\n\n"
                "This site uses bot protection (Cloudflare/WAF) that blocks automated scrapers. "
                "Please use the Manual Entry section below to fill in client details directly."
            )

        # Extract headings & metadata
        try:
            meta_desc = ""
            m = re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)', body_html, re.I)
            if not m:
                m = re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']description["\']', body_html, re.I)
            if m:
                meta_desc = m.group(1)[:300]
        except Exception:
            meta_desc = ""

        def extract_headings(html, tag):
            return list(dict.fromkeys([
                re.sub(r'<[^>]+>', '', h).strip()
                for h in re.findall(rf'<{tag}[^>]*>(.*?)</{tag}>', html, re.I | re.S)
                if 4 < len(re.sub(r'<[^>]+>', '', h).strip()) < 80
            ]))[:8]

        h1s = extract_headings(body_html, 'h1')
        h2s = extract_headings(body_html, 'h2')
        h3s = extract_headings(body_html, 'h3')

        # Fetch sub-pages
        base = url.rstrip("/")
        services_text = await scrape_subpage(browser, base + "/services")
        about_text = await scrape_subpage(browser, base + "/about")

        await browser.close()

    # Analysis
    all_text = " ".join([
        title, meta_desc, body_text,
        services_text, about_text,
        " ".join(h1s + h2s + h3s)
    ]).lower()

    detected_services = [s for s, kws in SERVICE_MAP.items() if any(k in all_text for k in kws)]
    if not detected_services:
        detected_services = ["Tax Services", "Accounting & Bookkeeping"]

    loc_matches = re.findall(r'\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*),\s*([A-Z]{2})\b',
                             " ".join([title, meta_desc, body_text[:1500]]))
    locations = list(dict.fromkeys([f"{c}, {s}" for c, s in loc_matches]))[:5]

    target_clients = [c for c, kws in CLIENT_MAP.items() if any(k in all_text for k in kws)]
    if not target_clients:
        target_clients = ["Small Businesses", "Individuals"]

    differentiators = [d for d, kws in DIFF_MAP.items() if any(k in all_text for k in kws)]
    if not differentiators:
        differentiators = ["Certified Public Accountants", "Professional Team"]

    specialties = [
        h for h in (h2s + h3s)
        if 4 < len(h) < 60 and not any(
            skip in h.lower()
            for skip in ["home", "menu", "contact", "about us", "click", "navigation", "cookie", "privacy"]
        )
    ][:5]

    summary = meta_desc[:300] if meta_desc else (
        ". ".join([s.strip() for s in body_text.replace("\n", " ").split(".") if len(s.strip()) > 30][:2]) + "."
    )

    firm_name = title
    for sep in ["|", "-", "—", "–", ":"]:
        if sep in firm_name:
            firm_name = firm_name.split(sep)[0].strip()
            break

    return {
        "firmName": firm_name or "CPA Firm",
        "services": detected_services,
        "targetClients": target_clients,
        "differentiators": differentiators,
        "locations": locations,
        "specialties": specialties,
        "summary": summary[:300],
    }


@scraper_bp.route("/scrape", methods=["POST"])
def scrape_endpoint():
    body = request.get_json(force=True)
    url = (body or {}).get("url", "").strip()
    if not url:
        return jsonify({"error": "No URL provided"}), 400
    if not url.startswith("http"):
        url = "https://" + url
    print(f"\n  Scraping: {url}")
    try:
        result = asyncio.run(scrape_site(url))
        print(f"  Done: {result['firmName']} | {len(result['services'])} services detected")

        # Persist to DB
        sr = ScrapeResult(
            url=url,
            firm_name=result["firmName"],
            services=json.dumps(result["services"]),
            target_clients=json.dumps(result["targetClients"]),
            differentiators=json.dumps(result["differentiators"]),
            locations=json.dumps(result["locations"]),
            summary=result["summary"],
            raw_data=json.dumps(result),
        )
        db.session.add(sr)
        db.session.commit()

        return jsonify(result)
    except ValueError as e:
        msg = str(e)
        print(f"  Blocked/error: {msg[:120]}")
        return jsonify({"error": msg}), 200
    except Exception as e:
        print(f"  Unexpected error: {e}")
        return jsonify({"error": str(e)}), 500


@scraper_bp.route("/api/scrape-results", methods=["GET"])
def list_scrape_results():
    results = ScrapeResult.query.order_by(ScrapeResult.created_at.desc()).limit(50).all()
    return jsonify([r.to_dict() for r in results])
