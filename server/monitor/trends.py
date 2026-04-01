import json
import re
import logging
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models import Topic, Source, TrendSnapshot
from .scorer import HIGH_VALUE_KEYWORDS, MEDIUM_VALUE_KEYWORDS

logger = logging.getLogger(__name__)

STOP_WORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "to", "of", "in", "for",
    "on", "with", "at", "by", "from", "as", "into", "through", "during",
    "before", "after", "above", "below", "between", "under", "again",
    "further", "then", "once", "here", "there", "when", "where", "why",
    "how", "all", "each", "every", "both", "few", "more", "most", "other",
    "some", "such", "no", "nor", "not", "only", "own", "same", "so",
    "than", "too", "very", "and", "but", "or", "yet", "if", "it", "its",
    "this", "that", "these", "those", "what", "which", "who", "whom",
    "your", "new", "key", "top", "best", "need", "know", "about", "you",
    "our", "their", "they", "them", "his", "her", "she", "he", "we",
    "out", "just", "also", "now", "get", "got", "like", "make", "made",
    "many", "much", "must", "while", "over", "still", "any", "back",
    "even", "well", "way", "up", "down", "off", "first", "one", "two",
    "three", "year", "years", "firm", "firms", "company", "companies",
}

KNOWN_PHRASES = set(kw.lower() for kw in HIGH_VALUE_KEYWORDS + MEDIUM_VALUE_KEYWORDS)

CPA_PHRASES = {
    "tax reform", "tax planning", "tax credit", "tax deduction",
    "estate planning", "transfer pricing", "bonus depreciation",
    "capital gains", "sales tax", "income tax", "property tax",
    "corporate tax", "payroll tax", "tax compliance", "tax deadline",
    "financial reporting", "internal controls", "risk management",
    "due diligence", "private equity", "real estate", "digital assets",
    "opportunity zone", "retirement planning", "succession planning",
    "supply chain", "data analytics", "artificial intelligence",
    "climate risk", "esg reporting", "remote work",
}
KNOWN_PHRASES.update(CPA_PHRASES)


def extract_keywords(title: str) -> list[str]:
    cleaned = re.sub(r'[^\w\s&\-]', ' ', title.lower())
    words = cleaned.split()
    filtered = [w for w in words if w not in STOP_WORDS and len(w) >= 3]

    result = []
    bigrams = [f"{filtered[i]} {filtered[i+1]}" for i in range(len(filtered) - 1)]
    used_in_bigram = set()

    for bg in bigrams:
        if bg in KNOWN_PHRASES:
            result.append(bg)
            parts = bg.split()
            used_in_bigram.update(parts)

    for bg in bigrams:
        if bg not in result and len(bg) > 8:
            result.append(bg)

    for w in filtered:
        if w not in used_in_bigram:
            result.append(w)

    return list(dict.fromkeys(result))[:15]


def extract_and_store_keywords(db_session) -> int:
    topics = db_session.query(Topic).filter(
        (Topic.keywords_extracted == None) | (Topic.keywords_extracted == "")
    ).all()
    count = 0
    for topic in topics:
        kws = extract_keywords(topic.title)
        topic.keywords_extracted = json.dumps(kws)
        count += 1
    db_session.commit()
    return count


def compute_trends(db_session, days: int = 30, limit: int = 50) -> list[dict]:
    cutoff = datetime.utcnow() - timedelta(days=days)
    cutoff_prev = cutoff - timedelta(days=days)

    topics_current = db_session.query(Topic).filter(Topic.discovered_at >= cutoff).all()
    topics_prev = db_session.query(Topic).filter(
        Topic.discovered_at >= cutoff_prev,
        Topic.discovered_at < cutoff,
    ).all()

    current_counts = Counter()
    current_sources = defaultdict(set)
    current_categories = defaultdict(Counter)
    current_topics = defaultdict(list)

    for t in topics_current:
        kws = json.loads(t.keywords_extracted or "[]")
        for kw in kws:
            current_counts[kw] += 1
            current_sources[kw].add(t.source_id)
            if t.category:
                current_categories[kw][t.category] += 1
            if len(current_topics[kw]) < 5:
                current_topics[kw].append({
                    "id": t.id, "title": t.title,
                    "source_id": t.source_id,
                })

    prev_counts = Counter()
    for t in topics_prev:
        kws = json.loads(t.keywords_extracted or "[]")
        for kw in kws:
            prev_counts[kw] += 1

    total_sources = db_session.query(Source).filter(Source.active == True).count() or 1

    trends = []
    for kw, count in current_counts.most_common(200):
        if count < 2:
            continue
        prev = prev_counts.get(kw, 0)
        velocity = round((count - prev) / max(prev, 2), 2)
        breadth = round(len(current_sources[kw]) / total_sources, 3)

        cat_counts = current_categories.get(kw, Counter())
        primary_category = cat_counts.most_common(1)[0][0] if cat_counts else None
        is_emerging = prev == 0 and count >= 2

        trends.append({
            "keyword": kw,
            "count": count,
            "source_count": len(current_sources[kw]),
            "velocity": velocity,
            "breadth": breadth,
            "category": primary_category,
            "is_emerging": is_emerging,
            "sample_topics": current_topics[kw],
        })

    trends.sort(key=lambda t: (
        t["is_emerging"],
        t["count"] * (1 + max(t["velocity"], 0)),
    ), reverse=True)
    return trends[:limit]


def get_trending_topics(db_session, days: int = 7, limit: int = 20) -> list[dict]:
    cutoff = datetime.utcnow() - timedelta(days=days)
    trends = compute_trends(db_session, days=days, limit=10)
    trending_kws = {t["keyword"] for t in trends}

    topics = db_session.query(Topic).filter(Topic.discovered_at >= cutoff).order_by(
        Topic.composite_score.desc()
    ).limit(200).all()

    result = []
    seen = set()
    for topic in topics:
        kws = set(json.loads(topic.keywords_extracted or "[]"))
        overlap = kws & trending_kws
        if overlap and topic.id not in seen:
            seen.add(topic.id)
            result.append({
                "id": topic.id,
                "title": topic.title,
                "url": topic.url,
                "source_id": topic.source_id,
                "source_name": topic.source.name if topic.source else "",
                "composite_score": topic.composite_score,
                "category": topic.category,
                "trending_keywords": list(overlap),
                "discovered_at": topic.discovered_at.isoformat() if topic.discovered_at else None,
            })
            if len(result) >= limit:
                break

    return result


def get_category_distribution(db_session, days: int = 30) -> list[dict]:
    cutoff = datetime.utcnow() - timedelta(days=days)
    rows = db_session.query(
        Topic.category, func.count(Topic.id)
    ).filter(
        Topic.discovered_at >= cutoff,
        Topic.category != None,
    ).group_by(Topic.category).all()

    total = sum(r[1] for r in rows) or 1
    return [
        {"category": r[0] or "uncategorized", "count": r[1],
         "percentage": round(r[1] / total * 100, 1)}
        for r in sorted(rows, key=lambda r: r[1], reverse=True)
    ]


def save_trend_snapshot(db_session) -> int:
    trends = compute_trends(db_session, days=7, limit=100)
    count = 0
    for t in trends:
        snapshot = TrendSnapshot(
            snapshot_date=datetime.utcnow(),
            keyword=t["keyword"],
            occurrence_count=t["count"],
            source_count=t["source_count"],
            velocity=t["velocity"],
            category=t.get("category"),
        )
        db_session.add(snapshot)
        count += 1
    db_session.commit()
    logger.info("Saved %d trend snapshots", count)
    return count


def get_trend_history(db_session, keyword: str, days: int = 90) -> dict:
    cutoff = datetime.utcnow() - timedelta(days=days)
    snapshots = db_session.query(TrendSnapshot).filter(
        TrendSnapshot.keyword == keyword,
        TrendSnapshot.snapshot_date >= cutoff,
    ).order_by(TrendSnapshot.snapshot_date).all()

    weekly = defaultdict(lambda: {"count": 0, "source_count": 0, "velocity": 0, "n": 0})
    for s in snapshots:
        week_start = s.snapshot_date - timedelta(days=s.snapshot_date.weekday())
        key = week_start.strftime("%Y-%m-%d")
        weekly[key]["count"] = max(weekly[key]["count"], s.occurrence_count)
        weekly[key]["source_count"] = max(weekly[key]["source_count"], s.source_count)
        weekly[key]["velocity"] += s.velocity
        weekly[key]["n"] += 1

    history = []
    for week, data in sorted(weekly.items()):
        history.append({
            "week": week,
            "count": data["count"],
            "source_count": data["source_count"],
            "velocity": round(data["velocity"] / max(data["n"], 1), 2),
        })

    sample_topics = db_session.query(Topic).filter(
        Topic.discovered_at >= cutoff,
        Topic.keywords_extracted.ilike(f'%"{keyword}"%'),
    ).order_by(Topic.composite_score.desc()).limit(8).all()

    samples = [
        {
            "id": t.id,
            "title": t.title,
            "url": t.url,
            "source": t.source.name if t.source else "",
            "score": t.composite_score,
            "discovered_at": t.discovered_at.isoformat() if t.discovered_at else None,
        }
        for t in sample_topics
    ]

    return {"keyword": keyword, "history": history, "sample_articles": samples}
