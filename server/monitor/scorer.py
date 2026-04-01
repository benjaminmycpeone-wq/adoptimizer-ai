"""Topic scoring engine -- evaluates relevance and quality of scraped articles."""

import math
import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from ..models import Topic, Source

logger = logging.getLogger(__name__)

# High-value SEO keywords for CPA content
HIGH_VALUE_KEYWORDS = [
    "tax planning", "tax strategy", "irs", "tax deduction", "tax credit",
    "estate tax", "corporate tax", "small business tax", "tax compliance",
    "r&d credit", "section 179", "bonus depreciation", "tax reform",
    "international tax", "transfer pricing", "payroll tax", "sales tax",
    "audit", "tax deadline", "quarterly estimated tax",
    "estate planning", "retirement planning", "capital gains",
    "1031 exchange", "opportunity zone", "salt deduction", "qbi",
    "crypto tax", "digital assets", "succession planning", "m&a tax",
    "esg reporting", "ai in accounting", "year-end planning",
    "tax season", "secure act", "camt", "pillar two",
]

MEDIUM_VALUE_KEYWORDS = [
    "accounting", "financial", "revenue", "income", "fiscal", "depreciation",
    "amortization", "withholding", "nexus", "state tax",
    "federal tax", "tax bracket", "filing", "return",
    "advisory", "consulting", "valuation", "risk management", "cybersecurity",
    "nonprofit", "healthcare", "real estate", "manufacturing",
    "technology", "construction", "energy", "private equity",
    "gaap", "fasb", "asc 842", "asc 606", "pcaob",
]

DEPTH_SIGNALS = [
    "guide", "explained", "how to", "what is", "strategies", "checklist",
    "comprehensive", "complete", "ultimate", "step-by-step",
    "what you need to know", "best practices", "tips",
    "changes for 2025", "changes for 2026", "new rules",
    "impact of", "implications", "analysis", "deep dive",
    "update", "deadline", "alert",
]


def compute_recency_score(topic: Topic) -> float:
    ref = topic.published_at or topic.discovered_at
    if not ref:
        return 0.2
    now = datetime.utcnow()
    if ref.tzinfo is not None:
        now = datetime.now(timezone.utc)
    age_hours = max(0, (now - ref).total_seconds() / 3600)
    score = math.exp(-0.693 * age_hours / 168)
    return round(max(0.05, score), 3)


def compute_seo_score(title: str) -> float:
    lower = title.lower()
    score = 0.0

    high_matches = sum(1 for kw in HIGH_VALUE_KEYWORDS if kw in lower)
    medium_matches = sum(1 for kw in MEDIUM_VALUE_KEYWORDS if kw in lower)
    score += min(0.50, high_matches * 0.15)
    score += min(0.25, medium_matches * 0.07)

    length = len(title)
    if 50 <= length <= 90:
        score += 0.12
    elif 40 <= length <= 100:
        score += 0.06
    elif length < 25 or length > 150:
        score -= 0.03

    depth_matches = sum(1 for sig in DEPTH_SIGNALS if sig in lower)
    score += min(0.15, depth_matches * 0.08)

    return round(min(1.0, max(0.0, score)), 3)


def compute_coverage_score(topic: Topic, source_authority: float) -> float:
    score = source_authority * 0.5

    if topic.category:
        score += 0.08
    if topic.summary:
        score += 0.08
    if topic.author:
        score += 0.06
    if topic.published_at:
        score += 0.06
    if topic.url:
        score += 0.04

    lower = topic.title.lower()
    depth_matches = sum(1 for sig in DEPTH_SIGNALS if sig in lower)
    score += min(0.18, depth_matches * 0.09)

    return round(min(1.0, score), 3)


def score_topic(topic: Topic, source_authority: float = 0.5) -> dict:
    recency = compute_recency_score(topic)
    seo = compute_seo_score(topic.title)
    coverage = compute_coverage_score(topic, source_authority)
    composite = round(seo * 0.40 + recency * 0.30 + coverage * 0.30, 3)

    return {
        "recency_score": recency,
        "seo_score": seo,
        "coverage_score": coverage,
        "composite_score": composite,
    }


def rescore_all(db_session) -> int:
    topics = db_session.query(Topic).all()
    source_map = {s.id: s for s in db_session.query(Source).all()}
    count = 0
    for topic in topics:
        source = source_map.get(topic.source_id)
        authority = source.source_authority if source else 0.5
        scores = score_topic(topic, authority)
        topic.recency_score = scores["recency_score"]
        topic.seo_score = scores["seo_score"]
        topic.coverage_score = scores["coverage_score"]
        topic.composite_score = scores["composite_score"]
        count += 1
    db_session.commit()
    logger.info("Rescored %d topics", count)
    return count
