import json
import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from ..models import MonitorClient as Client, Topic, ClientTopicRelevance

logger = logging.getLogger(__name__)

# Audience type signal words
AUDIENCE_SIGNALS = {
    "small_business": [
        "small business", "entrepreneur", "startup", "self-employed",
        "sole proprietor", "llc", "pass-through", "schedule c", "s-corp",
        "freelance", "1099", "independent contractor", "owner",
    ],
    "corporate": [
        "corporate", "enterprise", "fortune 500", "multinational", "cfo",
        "c-suite", "publicly traded", "sec filing", "public company",
        "board", "shareholder", "ipo", "large company",
    ],
    "hnw_individual": [
        "estate", "wealth", "trust", "family office", "inheritance",
        "gift tax", "high-net-worth", "individual", "personal",
        "retirement", "succession", "hnw",
    ],
    "nonprofit": [
        "nonprofit", "non-profit", "exempt", "501c", "foundation",
        "charitable", "donor", "endowment", "501(c)",
    ],
    "midmarket": [
        "mid-size", "middle market", "growth company", "private equity",
        "private company", "closely held", "mid-market",
    ],
    "international": [
        "international", "global", "multinational", "cross-border",
        "foreign", "expatriate", "expat",
    ],
}

CATEGORY_RELATED = {
    "tax": ["tax", "irs", "deduction", "filing", "compliance", "credit", "income",
            "depreciation", "payroll", "withholding", "nexus", "salt"],
    "audit": ["audit", "assurance", "financial reporting", "gaap", "fasb",
              "internal controls", "sox", "pcaob"],
    "advisory": ["advisory", "consulting", "strategy", "risk", "m&a",
                 "merger", "acquisition", "valuation", "forensic", "transaction"],
    "accounting": ["accounting", "bookkeeping", "gaap", "erp", "outsourcing",
                   "controller", "financial statement"],
    "wealth": ["wealth", "estate", "trust", "investment", "retirement",
               "succession", "family office", "philanthropy"],
    "technology": ["technology", "digital", "ai", "automation", "cyber",
                   "cloud", "data", "blockchain", "cryptocurrency"],
    "international": ["international", "foreign", "global", "cross-border",
                      "transfer pricing", "expatriate", "beps"],
}


def _keyword_overlap_score(client: Client, topic: Topic) -> float:
    client_kws = [kw.strip().lower() for kw in (client.keywords or "").split(",") if kw.strip()]
    if not client_kws:
        return 0.3

    title_lower = topic.title.lower()
    topic_kws = set()
    if topic.keywords_extracted:
        try:
            topic_kws = set(json.loads(topic.keywords_extracted))
        except (json.JSONDecodeError, TypeError):
            pass

    matches = 0
    for kw in client_kws:
        if kw in title_lower:
            matches += 1.0
        elif any(kw in tk for tk in topic_kws):
            matches += 0.6

    threshold = max(len(client_kws) * 0.25, 1)
    return min(1.0, matches / threshold)


def _audience_alignment_score(client: Client, topic: Topic) -> float:
    client_audience = (client.audience or "").lower()
    title_lower = topic.title.lower()
    topic_text = title_lower
    if topic.summary:
        topic_text += " " + topic.summary.lower()

    client_types = set()
    for atype, signals in AUDIENCE_SIGNALS.items():
        if any(s in client_audience for s in signals):
            client_types.add(atype)

    if not client_types:
        return 0.5

    topic_types = set()
    for atype, signals in AUDIENCE_SIGNALS.items():
        if any(s in topic_text for s in signals):
            topic_types.add(atype)

    if not topic_types:
        return 0.5

    overlap = client_types & topic_types
    if overlap:
        return 1.0
    return 0.2


def _category_alignment_score(client: Client, topic_category: str | None) -> float:
    if not topic_category:
        return 0.5
    client_kws = (client.keywords or "").lower()

    if topic_category.lower() in client_kws:
        return 1.0

    related_kws = CATEGORY_RELATED.get(topic_category.lower(), [])
    match_count = sum(1 for rk in related_kws if rk in client_kws)
    if match_count >= 2:
        return 0.9
    if match_count >= 1:
        return 0.7
    return 0.3


def _topic_quality_boost(topic: Topic) -> float:
    if topic.composite_score and topic.composite_score > 0.6:
        return 0.05
    return 0.0


def compute_client_topic_relevance(client: Client, topic: Topic) -> dict:
    kw_score = _keyword_overlap_score(client, topic)
    audience_score = _audience_alignment_score(client, topic)
    category_score = _category_alignment_score(client, topic.category)
    quality_boost = _topic_quality_boost(topic)

    relevance = round(
        0.45 * kw_score + 0.30 * audience_score + 0.25 * category_score + quality_boost,
        3,
    )
    relevance = min(1.0, relevance)

    return {
        "relevance_score": relevance,
        "keyword_overlap": round(kw_score, 3),
        "audience_alignment": round(audience_score, 3),
    }


def compute_all_relevances(db_session, days: int = 30) -> int:
    clients = db_session.query(Client).filter(Client.active == True).all()
    cutoff = datetime.utcnow() - timedelta(days=days)
    topics = db_session.query(Topic).filter(Topic.discovered_at >= cutoff).all()

    if not clients or not topics:
        return 0

    existing = {}
    for rel in db_session.query(ClientTopicRelevance).filter(
        ClientTopicRelevance.topic_id.in_([t.id for t in topics])
    ).all():
        existing[(rel.client_id, rel.topic_id)] = rel

    count = 0
    for client in clients:
        for topic in topics:
            scores = compute_client_topic_relevance(client, topic)
            key = (client.id, topic.id)

            if key in existing:
                rel = existing[key]
                rel.relevance_score = scores["relevance_score"]
                rel.keyword_overlap = scores["keyword_overlap"]
                rel.audience_alignment = scores["audience_alignment"]
                rel.computed_at = datetime.utcnow()
            else:
                rel = ClientTopicRelevance(
                    client_id=client.id,
                    topic_id=topic.id,
                    relevance_score=scores["relevance_score"],
                    keyword_overlap=scores["keyword_overlap"],
                    audience_alignment=scores["audience_alignment"],
                )
                db_session.add(rel)
                existing[key] = rel
            count += 1

    db_session.commit()
    logger.info("Computed %d client-topic relevances", count)
    return count


def get_top_suggestions(db_session, client_id: int, limit: int = 10) -> list[dict]:
    rows = db_session.query(ClientTopicRelevance, Topic).join(
        Topic, ClientTopicRelevance.topic_id == Topic.id
    ).filter(
        ClientTopicRelevance.client_id == client_id,
        ClientTopicRelevance.relevance_score > 0.3,
    ).order_by(
        ClientTopicRelevance.relevance_score.desc()
    ).limit(limit).all()

    return [
        {
            "topic_id": topic.id,
            "title": topic.title,
            "url": topic.url,
            "category": topic.category,
            "composite_score": topic.composite_score,
            "relevance_score": rel.relevance_score,
            "keyword_overlap": rel.keyword_overlap,
            "audience_alignment": rel.audience_alignment,
            "source_id": topic.source_id,
            "source_name": topic.source.name if topic.source else "",
            "discovered_at": topic.discovered_at.isoformat() if topic.discovered_at else None,
        }
        for rel, topic in rows
    ]


def get_topic_client_matches(db_session, topic_id: int) -> list[dict]:
    rows = db_session.query(ClientTopicRelevance, Client).join(
        Client, ClientTopicRelevance.client_id == Client.id
    ).filter(
        ClientTopicRelevance.topic_id == topic_id,
        Client.active == True,
    ).order_by(
        ClientTopicRelevance.relevance_score.desc()
    ).all()

    return [
        {
            "client_id": client.id,
            "client_name": client.name,
            "relevance_score": rel.relevance_score,
            "keyword_overlap": rel.keyword_overlap,
            "audience_alignment": rel.audience_alignment,
        }
        for rel, client in rows
    ]
