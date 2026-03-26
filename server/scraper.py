"""
AdOptimizer AI — Website Scraper (Google Ads-focused extraction)
Extracts data specifically useful for setting up Google Ads campaigns:
services, USPs, locations, target audience, CTA patterns, landing page quality.
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

# US state name → abbreviation for location detection
US_STATES = {
    "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA",
    "colorado": "CO", "connecticut": "CT", "delaware": "DE", "florida": "FL", "georgia": "GA",
    "hawaii": "HI", "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA",
    "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
    "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS",
    "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV", "new hampshire": "NH",
    "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC",
    "north dakota": "ND", "ohio": "OH", "oklahoma": "OK", "oregon": "OR", "pennsylvania": "PA",
    "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", "tennessee": "TN",
    "texas": "TX", "utah": "UT", "vermont": "VT", "virginia": "VA", "washington": "WA",
    "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY",
}

# Credential/certification patterns for ad copy angles
CREDENTIAL_PATTERNS = [
    (r'\bcpa\b', 'CPA'),
    (r'\bcertified public accountant\b', 'CPA'),
    (r'\benrolled agent\b', 'Enrolled Agent'),
    (r'\bea\b', 'Enrolled Agent'),
    (r'\bcfp\b', 'CFP'),
    (r'\bcertified financial planner\b', 'CFP'),
    (r'\blicensed\b', 'Licensed Professional'),
    (r'\baccredited\b', 'Accredited'),
    (r'\bboard certified\b', 'Board Certified'),
    (r'\bregistered\b', 'Registered Professional'),
]

# CTA patterns found on websites — useful for ad copy inspiration
CTA_PATTERNS_LIST = [
    "free consultation", "free consult", "free quote", "get a quote", "request a quote",
    "schedule today", "schedule now", "book now", "book online", "book appointment",
    "call now", "call today", "call us", "contact us", "get started",
    "learn more", "request info", "free estimate", "free assessment", "free review",
    "sign up", "get in touch", "speak to an expert", "talk to us",
]


def check_blocked(html_content: str, status_code: int) -> str | None:
    if status_code in (403, 429, 503):
        return f"Site returned HTTP {status_code} — protected by WAF/Cloudflare."
    lc = html_content.lower()
    for signal, msg in BLOCK_SIGNALS:
        if signal in lc:
            return msg
    return None


async def try_fetch_with_playwright(url: str, browser, stealth: bool = False):
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
        body_text = (await page.inner_text("body"))[:8000]
    except Exception:
        body_text = ""

    await context.close()
    return body_text, body_html, status_code, title


async def scrape_subpage(browser, url: str) -> str:
    context = await browser.new_context(user_agent=USER_AGENT, extra_http_headers=BROWSER_HEADERS)
    page = await context.new_page()
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=12000)
        text = (await page.inner_text("body"))[:3000]
    except Exception:
        text = ""
    finally:
        await context.close()
    return text


def discover_subpages(body_html: str, base_url: str) -> list:
    """Find internal links relevant for Google Ads data extraction."""
    base = base_url.rstrip("/")
    # Extract relative links
    links = re.findall(r'href=["\'](/[^"\'#?]*)["\']', body_html)
    # Filter to Google Ads-relevant pages
    relevant = set()
    keywords = ['service', 'about', 'contact', 'team', 'staff', 'pricing', 'price',
                'testimonial', 'review', 'practice-area', 'what-we-do', 'our-work', 'solutions']
    for link in links:
        path = link.lower().strip('/')
        if any(kw in path for kw in keywords) and len(path) < 60:
            relevant.add(base + link)
    # Always try common paths
    for path in ['/services', '/about', '/about-us', '/contact', '/contact-us']:
        relevant.add(base + path)
    return list(relevant)[:6]


def extract_phones(text: str) -> list:
    """Extract US phone numbers from text."""
    pattern = r'(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}'
    phones = list(dict.fromkeys(re.findall(pattern, text)))
    return [p.strip() for p in phones if len(re.sub(r'\D', '', p)) >= 10][:3]


def extract_emails(text: str) -> list:
    """Extract email addresses, filtering false positives."""
    pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    emails = list(dict.fromkeys(re.findall(pattern, text)))
    bad_ext = ('.png', '.jpg', '.gif', '.svg', '.css', '.js')
    return [e for e in emails if not e.lower().endswith(bad_ext) and 'example' not in e.lower()][:3]


def extract_social_links(html: str) -> dict:
    """Extract social media profile links."""
    social = {}
    patterns = {
        'facebook': r'href=["\']([^"\']*facebook\.com/[^"\']*)["\']',
        'linkedin': r'href=["\']([^"\']*linkedin\.com/[^"\']*)["\']',
        'instagram': r'href=["\']([^"\']*instagram\.com/[^"\']*)["\']',
        'google': r'href=["\']([^"\']*(?:google\.com/maps|g\.page|goo\.gl/maps)[^"\']*)["\']',
    }
    for platform, pattern in patterns.items():
        m = re.search(pattern, html, re.I)
        if m:
            social[platform] = m.group(1)
    return social


def extract_credentials(text: str) -> list:
    """Extract professional credentials/certifications mentioned on the site."""
    found = []
    lower = text.lower()
    seen = set()
    for pattern, name in CREDENTIAL_PATTERNS:
        if re.search(pattern, lower) and name not in seen:
            found.append(name)
            seen.add(name)
    # Extract "X years" experience claims
    years_match = re.findall(r'(\d{1,2})\+?\s*(?:years?|yrs?)\s*(?:of\s+)?experience', lower)
    if years_match:
        found.append(f"{max(int(y) for y in years_match)}+ Years Experience")
    return found[:8]


def extract_cta_patterns(text: str) -> list:
    """Find call-to-action patterns — useful for ad copy inspiration."""
    lower = text.lower()
    found = []
    for cta in CTA_PATTERNS_LIST:
        if cta in lower:
            found.append(cta.title())
    return list(dict.fromkeys(found))[:8]


def extract_structured_services(html: str) -> list:
    """Extract services from structured HTML lists near service-related headings."""
    services = []
    # Find headings containing "service" and grab nearby <li> items
    blocks = re.findall(
        r'<h[2-4][^>]*>[^<]*(?:service|practice|solution|what we (?:do|offer)|our (?:service|expertise))[^<]*</h[2-4]>'
        r'[\s\S]{0,500}?<ul[^>]*>([\s\S]*?)</ul>',
        html, re.I
    )
    for block in blocks:
        items = re.findall(r'<li[^>]*>(.*?)</li>', block, re.I | re.S)
        for item in items:
            clean = re.sub(r'<[^>]+>', '', item).strip()
            if 3 < len(clean) < 80:
                services.append(clean)
    return list(dict.fromkeys(services))[:20]


def extract_pricing_signals(text: str) -> list:
    """Detect pricing-related text that could inform ad copy."""
    signals = []
    lower = text.lower()
    # Dollar amounts
    prices = re.findall(r'\$\d[\d,]*(?:\.\d{2})?', text)
    if prices:
        signals.extend(prices[:3])
    # Free offers
    free_patterns = ['free consultation', 'free estimate', 'free quote', 'free review',
                     'free assessment', 'complimentary', 'no obligation', 'no hidden fees',
                     'flat fee', 'affordable', 'competitive pricing']
    for p in free_patterns:
        if p in lower:
            signals.append(p.title())
    return list(dict.fromkeys(signals))[:6]


def extract_locations(title: str, meta_desc: str, body_text: str, html: str) -> list:
    """Extract locations from multiple sources — for geo-targeting."""
    locations = []
    search_text = " ".join([title, meta_desc, body_text[:2000]])

    # Pattern 1: "City, ST" (US abbreviation)
    matches = re.findall(r'\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*),\s*([A-Z]{2})\b', search_text)
    for city, state in matches:
        locations.append(f"{city}, {state}")

    # Pattern 2: "City, Full State Name"
    for state_name, abbr in US_STATES.items():
        pattern = rf'\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*),\s*{state_name}\b'
        for m in re.finditer(pattern, search_text, re.I):
            locations.append(f"{m.group(1)}, {abbr}")

    # Pattern 3: <address> tags
    addr_blocks = re.findall(r'<address[^>]*>([\s\S]*?)</address>', html, re.I)
    for addr in addr_blocks:
        clean = re.sub(r'<[^>]+>', ' ', addr).strip()
        loc_m = re.findall(r'\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*),\s*([A-Z]{2})\b', clean)
        for city, state in loc_m:
            locations.append(f"{city}, {state}")

    # Pattern 4: Schema.org / og:locality
    og_loc = re.search(r'<meta[^>]+property=["\']og:locality["\'][^>]+content=["\']([^"\']+)', html, re.I)
    og_reg = re.search(r'<meta[^>]+property=["\']og:region["\'][^>]+content=["\']([^"\']+)', html, re.I)
    if og_loc and og_reg:
        locations.append(f"{og_loc.group(1)}, {og_reg.group(1)}")

    return list(dict.fromkeys(locations))[:5]


def score_landing_page(html: str, text: str, phones: list) -> dict:
    """Score the website's landing page quality for Google Ads (affects Quality Score)."""
    lower_html = html.lower()
    lower_text = text.lower()

    has_phone = len(phones) > 0
    has_form = '<form' in lower_html
    has_cta = bool(re.search(
        r'<(?:button|a)[^>]*>(?:[^<]*(?:call|contact|schedule|book|quote|consult|get started|free)[^<]*)</(?:button|a)>',
        lower_html, re.I
    ))
    has_testimonials = any(w in lower_text for w in ['testimonial', 'review', 'client says', 'what our clients', 'stars'])
    has_ssl = True  # We already fetch via HTTPS
    has_clear_services = any(w in lower_text for w in ['our services', 'what we do', 'practice areas', 'how we help'])
    has_trust_signals = any(w in lower_text for w in ['certified', 'licensed', 'accredited', 'years of experience', 'bbb'])

    score = sum([has_phone * 2, has_form * 2, has_cta * 2, has_testimonials, has_ssl, has_clear_services, has_trust_signals])
    score = min(score, 10)

    return {
        "hasPhone": has_phone,
        "hasForm": has_form,
        "hasCTA": has_cta,
        "hasTestimonials": has_testimonials,
        "hasClearServices": has_clear_services,
        "hasTrustSignals": has_trust_signals,
        "score": score,
    }


def detect_category(services: list, text: str) -> str:
    """Auto-detect business category from services and text content."""
    lower = text.lower()
    categories = {
        'Accounting & CPA Firm': ['cpa', 'accountant', 'accounting', 'tax preparation', 'bookkeeping'],
        'Tax Preparation': ['tax prep', 'tax return', 'tax filing', 'tax season'],
        'Bookkeeping': ['bookkeeping', 'bookkeeper'],
        'Financial Advisory': ['financial advisor', 'financial planning', 'wealth management', 'investment'],
        'Law Firm': ['attorney', 'lawyer', 'law firm', 'legal', 'litigation'],
        'Medical Practice': ['doctor', 'physician', 'medical', 'healthcare', 'clinic'],
        'Dental Office': ['dentist', 'dental', 'orthodont'],
        'Insurance Agency': ['insurance', 'coverage', 'policy'],
        'Real Estate Agency': ['real estate', 'realtor', 'property', 'homes for sale'],
        'Home Services': ['plumbing', 'hvac', 'electrical', 'roofing', 'landscaping', 'cleaning'],
        'Restaurant': ['restaurant', 'dining', 'menu', 'catering'],
    }
    scores = {}
    for cat, keywords in categories.items():
        scores[cat] = sum(1 for kw in keywords if kw in lower)
    best = max(scores, key=scores.get) if max(scores.values()) > 0 else 'Other'
    return best


async def scrape_site(url: str) -> dict:
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled",
                  "--disable-infobars", "--disable-dev-shm-usage"]
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

        if block_reason:
            await browser.close()
            raise ValueError(
                f"{block_reason}\n\nThis site uses bot protection. "
                "Please use the Manual Entry section below to fill in client details directly."
            )

        # ── Extract metadata ──
        meta_desc = ""
        m = re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)', body_html, re.I)
        if not m:
            m = re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']description["\']', body_html, re.I)
        if m:
            meta_desc = m.group(1)[:300]

        def extract_headings(html, tag):
            return list(dict.fromkeys([
                re.sub(r'<[^>]+>', '', h).strip()
                for h in re.findall(rf'<{tag}[^>]*>(.*?)</{tag}>', html, re.I | re.S)
                if 4 < len(re.sub(r'<[^>]+>', '', h).strip()) < 80
            ]))[:8]

        h1s = extract_headings(body_html, 'h1')
        h2s = extract_headings(body_html, 'h2')
        h3s = extract_headings(body_html, 'h3')

        # ── Dynamic subpage discovery ──
        base = url.rstrip("/")
        subpage_urls = discover_subpages(body_html, base)
        subpage_texts = []
        for sub_url in subpage_urls:
            text = await scrape_subpage(browser, sub_url)
            if text:
                subpage_texts.append(text)

        await browser.close()

    # ── Google Ads-Focused Analysis ──
    all_text = " ".join([title, meta_desc, body_text] + subpage_texts + [" ".join(h1s + h2s + h3s)])
    all_text_lower = all_text.lower()

    # Firm name
    firm_name = title
    for sep in ["|", "-", "—", "–", ":"]:
        if sep in firm_name:
            firm_name = firm_name.split(sep)[0].strip()
            break

    # Services (keyword map + structured HTML extraction)
    detected_services = [s for s, kws in SERVICE_MAP.items() if any(k in all_text_lower for k in kws)]
    structured_services = extract_structured_services(body_html)
    # Merge and deduplicate
    all_services = list(dict.fromkeys(detected_services + structured_services))
    if not all_services:
        all_services = ["Tax Services", "Accounting & Bookkeeping"]

    # Locations
    locations = extract_locations(title, meta_desc, body_text, body_html)

    # Target audience
    target_audience = [c for c, kws in CLIENT_MAP.items() if any(k in all_text_lower for k in kws)]
    if not target_audience:
        target_audience = ["Small Businesses", "Individuals"]

    # USPs / differentiators
    differentiators = [d for d, kws in DIFF_MAP.items() if any(k in all_text_lower for k in kws)]
    if not differentiators:
        differentiators = ["Professional Team"]

    # Credentials (for ad copy angles)
    credentials = extract_credentials(all_text)

    # CTA patterns found on site
    cta_patterns = extract_cta_patterns(all_text)

    # Pricing signals
    pricing_signals = extract_pricing_signals(all_text)

    # Phone & email
    phones = extract_phones(all_text)
    emails = extract_emails(all_text)

    # Social links
    social_links = extract_social_links(body_html)

    # Landing page quality score
    page_quality = score_landing_page(body_html, all_text, phones)

    # Auto-detect category
    category = detect_category(all_services, all_text_lower)

    # Specialties from headings (filtered)
    specialties = [
        h for h in (h1s + h2s + h3s)
        if 4 < len(h) < 60 and not any(
            skip in h.lower()
            for skip in ["home", "menu", "contact", "about us", "click", "navigation", "cookie", "privacy", "toggle"]
        )
    ][:8]

    # Summary
    summary = meta_desc[:300] if meta_desc else (
        ". ".join([s.strip() for s in body_text.replace("\n", " ").split(".") if len(s.strip()) > 30][:2]) + "."
    )

    # Competitive angles (combine credentials + differentiators + USPs)
    competitive_angles = list(dict.fromkeys(credentials + differentiators))[:10]

    # Build the "Google Ads Brief" — everything the AI strategist needs
    return {
        "firmName": firm_name or "Business",
        "category": category,
        "services": all_services,
        "targetAudience": target_audience,
        "usps": differentiators,
        "locations": locations,
        "specialties": specialties,
        "summary": summary[:300],
        "ctaPatterns": cta_patterns,
        "pricingSignals": pricing_signals,
        "competitiveAngles": competitive_angles,
        "phone": phones[0] if phones else "",
        "email": emails[0] if emails else "",
        "socialLinks": social_links,
        "landingPageQuality": page_quality,
        "websiteUrl": url,
        # Raw data for AI context (full text for the strategist prompt)
        "rawText": all_text[:6000],
        "headings": h1s + h2s + h3s,
        # Legacy fields (backward compat)
        "targetClients": target_audience,
        "differentiators": differentiators,
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
        print(f"  Done: {result['firmName']} | {len(result['services'])} services | Category: {result['category']} | LPQ: {result['landingPageQuality']['score']}/10")

        sr = ScrapeResult(
            url=url,
            firm_name=result["firmName"],
            services=json.dumps(result["services"]),
            target_clients=json.dumps(result["targetAudience"]),
            differentiators=json.dumps(result["usps"]),
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
