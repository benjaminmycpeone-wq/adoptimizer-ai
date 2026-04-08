"""
AdOptimizer AI — Configuration & Constants
"""

import os

PORT = int(os.environ.get("PORT", 5055))
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///adoptimizer.db")

# Fix Railway Postgres URL (postgres:// → postgresql://)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# ── Browser Headers (anti-bot evasion) ──
BROWSER_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
}

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

# ── Block Detection Signals ──
BLOCK_SIGNALS = [
    ("cloudflare", "Blocked by Cloudflare protection"),
    ("access denied", "Site returned Access Denied"),
    ("403 forbidden", "Site returned 403 Forbidden"),
    ("just a moment", "Blocked by Cloudflare JS challenge"),
    ("enable javascript", "Site requires JavaScript challenge (Cloudflare)"),
    ("we can't connect to the server", "Site server connection failed"),
    ("request could not be satisfied", "CDN/WAF blocked the request (403)"),
    ("ray id", "Cloudflare Ray ID detected — request blocked"),
    ("ddos protection", "DDoS protection active — request blocked"),
    ("bot detection", "Bot detection triggered"),
]

# ── Service Detection Map ──
SERVICE_MAP = {
    "Tax Preparation": ["tax prep", "tax preparation", "tax return", "income tax", "file taxes", "tax filing"],
    "Tax Planning": ["tax planning", "tax strategy", "tax advisor", "tax minimization"],
    "Bookkeeping": ["bookkeeping", "bookkeeper", "accounts payable", "accounts receivable", "general ledger"],
    "Payroll Services": ["payroll", "payroll processing", "payroll services", "employee pay"],
    "Audit & Assurance": ["audit", "assurance", "financial statement", "compliance audit"],
    "IRS Representation": ["irs", "irs representation", "tax relief", "back taxes", "tax debt"],
    "Business Advisory": ["cfo", "advisory", "business consultant", "fractional cfo"],
    "Estate & Trust": ["estate", "trust", "estate planning", "estate tax", "inheritance"],
    "Nonprofit Accounting": ["nonprofit", "non-profit", "501c", "charity"],
    "Business Tax": ["business tax", "corporate tax", "s-corp", "llc tax", "partnership tax"],
    "QuickBooks Services": ["quickbooks", "qbo", "xero", "accounting software"],
    "Financial Reporting": ["financial report", "financial statements", "balance sheet", "profit and loss"],
}

# ── Target Client Detection Map ──
CLIENT_MAP = {
    "Small Businesses": ["small business", "entrepreneur", "startup", "self-employed"],
    "Individuals & Families": ["individual", "personal tax", "family", "families"],
    "Real Estate Investors": ["real estate", "property investor", "rental property", "landlord"],
    "Healthcare Professionals": ["medical", "healthcare", "physician", "dentist", "doctor"],
    "Restaurants & Hospitality": ["restaurant", "hospitality", "food service", "hotel", "retail"],
    "Construction & Contractors": ["construction", "contractor", "builder", "subcontractor"],
    "Nonprofits": ["nonprofit", "non-profit", "501c", "charity"],
}

# ── Differentiator Detection Map ──
DIFF_MAP = {
    "Certified Public Accountants": ["cpa", "certified public accountant"],
    "Experienced Team": ["years of experience", "decades", "since 19", "since 20"],
    "Free Consultation": ["free consultation", "free consult", "complimentary consultation"],
    "Fast Turnaround": ["same day", "fast turnaround", "24 hours", "48 hours"],
    "Virtual & Remote Services": ["remote", "virtual", "online", "cloud-based"],
    "Flat-Fee Pricing": ["flat fee", "flat-fee", "transparent pricing", "no hidden fees"],
    "Year-Round Support": ["year-round", "year round", "ongoing support"],
    "Bilingual Services": ["bilingual", "spanish", "espanol", "multilingual"],
}

# ── AI Provider Endpoints ──
AI_ENDPOINTS = {
    "anthropic": "https://api.anthropic.com/v1/messages",
    "qwen": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
    "moonshot": "https://api.moonshot.cn/v1/chat/completions",
    "openai": "https://api.openai.com/v1/chat/completions",
    "openrouter": "https://openrouter.ai/api/v1/chat/completions",
}
