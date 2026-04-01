"""
CPA Monitor — Flask Blueprints
All CPA Monitor endpoints under /api/monitor/ prefix.
"""

import asyncio
import logging
from datetime import datetime
from flask import Blueprint, request, jsonify, Response, stream_with_context

from ..db import db
from ..models import (
    Source, Topic, MonitorClient, Assignment, Post, Comment,
    WordPressSite, PublishLog, TrendSnapshot, ClientTopicRelevance,
)
# Alias for convenience in this module
Client = MonitorClient

from .scraper_v2 import scrape_all_sources
from .scorer import rescore_all, score_topic
from .generator import stream_generate
from .review import transition_post, add_comment, get_review_stats
from .wordpress import test_connection, publish_post
from .source_import import import_sources_from_csv, auto_discover_blog_urls, compute_source_authority
from .trends import (
    extract_and_store_keywords, compute_trends, get_trending_topics,
    get_category_distribution, save_trend_snapshot, get_trend_history,
)
from .matcher import (
    compute_all_relevances, get_top_suggestions, get_topic_client_matches,
)
from .niche_classifier import classify_all_topics, classify_topic_niche

logger = logging.getLogger(__name__)

monitor_bp = Blueprint("monitor", __name__)


def _run_async(coro):
    """Run an async coroutine from sync Flask context."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, coro)
                return future.result()
        else:
            return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


# ── Stats ───────────────────────────────────────────────────────────────────

@monitor_bp.route("/api/monitor/stats", methods=["GET"])
def api_stats():
    return jsonify({
        "topics": db.session.query(Topic).count(),
        "topics_new": db.session.query(Topic).filter(Topic.status == "new").count(),
        "clients": db.session.query(Client).filter(Client.active == True).count(),
        "assignments": db.session.query(Assignment).count(),
        "posts": db.session.query(Post).count(),
        "posts_approved": db.session.query(Post).filter(Post.status == "approved").count(),
        "posts_published": db.session.query(Post).filter(Post.status == "published").count(),
        "sources_active": db.session.query(Source).filter(Source.active == True).count(),
        "sources_total": db.session.query(Source).count(),
    })


# ── Sources Management ──────────────────────────────────────────────────────

@monitor_bp.route("/api/monitor/sources", methods=["GET"])
def list_sources():
    firm_size = request.args.get("firm_size")
    active = request.args.get("active")
    search = request.args.get("search")
    niche = request.args.get("niche")
    state = request.args.get("state")
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)

    if limit > 500:
        limit = 500

    q = db.session.query(Source)
    if firm_size:
        q = q.filter(Source.firm_size == firm_size)
    if active is not None:
        q = q.filter(Source.active == (active.lower() == "true"))
    if search:
        q = q.filter(Source.name.ilike(f"%{search}%"))
    if niche:
        q = q.filter(Source.niche.ilike(f"%{niche}%"))
    if state:
        q = q.filter(Source.state == state)
    total = q.count()

    from sqlalchemy import case
    sources = q.order_by(
        case((Source.ipa_rank == None, 1), else_=0),
        Source.ipa_rank.asc(),
        Source.name.asc(),
    ).offset(offset).limit(limit).all()

    return jsonify({
        "total": total,
        "sources": [
            {
                "id": s.id,
                "name": s.name,
                "url": s.url,
                "blog_url": s.blog_url,
                "rss_url": s.rss_url,
                "linkedin_url": s.linkedin_url,
                "active": s.active,
                "ipa_rank": s.ipa_rank,
                "firm_size": s.firm_size,
                "state": s.state,
                "niche": s.niche,
                "services": s.services,
                "post_frequency": s.post_frequency,
                "specialties": s.specialties,
                "source_authority": s.source_authority,
                "last_scraped": s.last_scraped.isoformat() if s.last_scraped else None,
                "scrape_error": s.scrape_error,
                "scrape_fail_count": s.scrape_fail_count or 0,
                "scrape_success_count": s.scrape_success_count or 0,
                "topic_count": len(s.topics),
            }
            for s in sources
        ],
    })


@monitor_bp.route("/api/monitor/sources", methods=["POST"])
def create_source():
    body = request.get_json()
    if not body or not body.get("name"):
        return jsonify({"error": "name is required"}), 400

    authority = compute_source_authority(body.get("ipa_rank"), body.get("firm_size", "regional"))
    source = Source(
        name=body["name"],
        url=body.get("url") or body.get("blog_url") or "",
        blog_url=body.get("blog_url"),
        rss_url=body.get("rss_url"),
        linkedin_url=body.get("linkedin_url"),
        ipa_rank=body.get("ipa_rank"),
        firm_size=body.get("firm_size", "regional"),
        state=body.get("state"),
        niche=body.get("niche"),
        services=body.get("services"),
        post_frequency=body.get("post_frequency"),
        specialties=body.get("specialties"),
        selector_config=body.get("selector_config"),
        source_authority=authority,
    )
    db.session.add(source)
    db.session.commit()
    db.session.refresh(source)
    return jsonify({"id": source.id, "name": source.name}), 201


@monitor_bp.route("/api/monitor/sources/import-csv", methods=["POST"])
def import_csv():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files["file"]
    content = file.read().decode("utf-8-sig")
    result = import_sources_from_csv(db.session, content)
    return jsonify(result)


@monitor_bp.route("/api/monitor/sources/auto-discover", methods=["POST"])
def auto_discover():
    result = _run_async(auto_discover_blog_urls(db.session))
    return jsonify(result)


@monitor_bp.route("/api/monitor/sources/stats", methods=["GET"])
def source_stats():
    from sqlalchemy import func
    total = db.session.query(Source).count()
    active = db.session.query(Source).filter(Source.active == True).count()
    tiers = db.session.query(Source.firm_size, func.count(Source.id)).filter(
        Source.active == True
    ).group_by(Source.firm_size).all()
    healthy = db.session.query(Source).filter(
        Source.active == True,
        (Source.scrape_fail_count == 0) | (Source.scrape_fail_count == None),
    ).count()
    return jsonify({
        "total": total,
        "active": active,
        "healthy": healthy,
        "health_pct": round(healthy / active * 100, 1) if active else 0,
        "tiers": {tier: count for tier, count in tiers},
    })


@monitor_bp.route("/api/monitor/sources/<int:source_id>", methods=["GET"])
def get_source(source_id):
    s = db.session.query(Source).filter(Source.id == source_id).first()
    if not s:
        return jsonify({"error": "Source not found"}), 404
    return jsonify({
        "id": s.id, "name": s.name, "url": s.url, "blog_url": s.blog_url,
        "rss_url": s.rss_url, "linkedin_url": s.linkedin_url,
        "active": s.active, "ipa_rank": s.ipa_rank, "firm_size": s.firm_size,
        "state": s.state, "niche": s.niche, "services": s.services,
        "post_frequency": s.post_frequency,
        "specialties": s.specialties, "selector_config": s.selector_config,
        "source_authority": s.source_authority,
        "last_scraped": s.last_scraped.isoformat() if s.last_scraped else None,
        "scrape_error": s.scrape_error,
        "scrape_fail_count": s.scrape_fail_count or 0,
        "scrape_success_count": s.scrape_success_count or 0,
    })


@monitor_bp.route("/api/monitor/sources/<int:source_id>", methods=["PATCH"])
def update_source(source_id):
    s = db.session.query(Source).filter(Source.id == source_id).first()
    if not s:
        return jsonify({"error": "Source not found"}), 404
    body = request.get_json()
    if not body:
        return jsonify({"error": "No data provided"}), 400
    for field, value in body.items():
        if hasattr(s, field):
            setattr(s, field, value)
    if "ipa_rank" in body or "firm_size" in body:
        s.source_authority = compute_source_authority(s.ipa_rank, s.firm_size)
    db.session.commit()
    return jsonify({"ok": True})


@monitor_bp.route("/api/monitor/sources/<int:source_id>", methods=["DELETE"])
def delete_source(source_id):
    s = db.session.query(Source).filter(Source.id == source_id).first()
    if not s:
        return jsonify({"error": "Source not found"}), 404
    s.active = False
    db.session.commit()
    return jsonify({"ok": True})


# ── Topics ──────────────────────────────────────────────────────────────────

@monitor_bp.route("/api/monitor/topics", methods=["GET"])
def list_topics():
    status = request.args.get("status")
    search = request.args.get("search")
    source_id = request.args.get("source_id", type=int)
    category = request.args.get("category")
    niche = request.args.get("niche")
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)

    if limit > 200:
        limit = 200

    q = db.session.query(Topic)
    if status:
        q = q.filter(Topic.status == status)
    if search:
        q = q.filter(Topic.title.ilike(f"%{search}%"))
    if source_id:
        q = q.filter(Topic.source_id == source_id)
    if category:
        q = q.filter(Topic.category == category)
    if niche:
        q = q.filter(Topic.niche.ilike(f"%{niche}%"))
    total = q.count()
    topics = q.order_by(Topic.composite_score.desc(), Topic.discovered_at.desc()).offset(offset).limit(limit).all()

    result = []
    for t in topics:
        top_matches = db.session.query(ClientTopicRelevance, Client).join(
            Client, ClientTopicRelevance.client_id == Client.id
        ).filter(
            ClientTopicRelevance.topic_id == t.id,
            Client.active == True,
        ).order_by(
            ClientTopicRelevance.relevance_score.desc()
        ).limit(3).all()

        relevance_matches = [
            {
                "client_id": client.id,
                "client_name": client.name,
                "score": round(rel.relevance_score, 2),
            }
            for rel, client in top_matches
        ] if top_matches else []

        result.append({
            "id": t.id,
            "title": t.title,
            "url": t.url,
            "status": t.status,
            "source": t.source.name if t.source else "",
            "source_id": t.source_id,
            "niche": t.niche or (t.source.niche if t.source else "") or "",
            "category": t.category,
            "discovered_at": t.discovered_at.isoformat() if t.discovered_at else None,
            "recency_score": t.recency_score,
            "coverage_score": t.coverage_score,
            "seo_score": t.seo_score,
            "composite_score": t.composite_score,
            "assignment_count": len(t.assignments),
            "relevance_matches": relevance_matches,
        })
    return jsonify({"total": total, "topics": result})


@monitor_bp.route("/api/monitor/topics/classify-niches", methods=["POST"])
def classify_niches():
    force = request.args.get("force", "false").lower() == "true"
    count = classify_all_topics(db.session, force=force)
    return jsonify({"classified": count})


@monitor_bp.route("/api/monitor/topics/<int:topic_id>", methods=["PATCH"])
def update_topic_status(topic_id):
    topic = db.session.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        return jsonify({"error": "Topic not found"}), 404
    body = request.get_json()
    if body and "status" in body:
        topic.status = body["status"]
    db.session.commit()
    return jsonify({"ok": True})


# ── Scrape ──────────────────────────────────────────────────────────────────

@monitor_bp.route("/api/monitor/scrape/run", methods=["POST"])
def manual_scrape():
    result = _run_async(scrape_all_sources(db.session))
    rescore_all(db.session)
    classify_all_topics(db.session)
    extract_and_store_keywords(db.session)
    compute_all_relevances(db.session)
    return jsonify(result)


# ── Trends ──────────────────────────────────────────────────────────────────

@monitor_bp.route("/api/monitor/trends/keywords", methods=["GET"])
def trending_keywords():
    days = request.args.get("days", 30, type=int)
    limit = request.args.get("limit", 50, type=int)
    days = max(1, min(365, days))
    limit = max(1, min(200, limit))
    return jsonify(compute_trends(db.session, days=days, limit=limit))


@monitor_bp.route("/api/monitor/trends/keywords/<keyword>/history", methods=["GET"])
def keyword_history(keyword):
    days = request.args.get("days", 90, type=int)
    days = max(7, min(365, days))
    return jsonify(get_trend_history(db.session, keyword, days=days))


@monitor_bp.route("/api/monitor/trends/topics", methods=["GET"])
def trending_topics_api():
    days = request.args.get("days", 7, type=int)
    limit = request.args.get("limit", 20, type=int)
    days = max(1, min(90, days))
    limit = max(1, min(100, limit))
    return jsonify(get_trending_topics(db.session, days=days, limit=limit))


@monitor_bp.route("/api/monitor/trends/categories", methods=["GET"])
def trend_categories():
    days = request.args.get("days", 30, type=int)
    days = max(1, min(365, days))
    return jsonify(get_category_distribution(db.session, days=days))


@monitor_bp.route("/api/monitor/trends/snapshot", methods=["POST"])
def manual_trend_snapshot():
    extract_and_store_keywords(db.session)
    count = save_trend_snapshot(db.session)
    return jsonify({"snapshots_saved": count})


# ── Matching ────────────────────────────────────────────────────────────────

@monitor_bp.route("/api/monitor/matching/suggestions/<int:client_id>", methods=["GET"])
def client_suggestions(client_id):
    limit = request.args.get("limit", 10, type=int)
    limit = max(1, min(50, limit))
    return jsonify(get_top_suggestions(db.session, client_id, limit=limit))


@monitor_bp.route("/api/monitor/matching/topic/<int:topic_id>", methods=["GET"])
def topic_matches(topic_id):
    return jsonify(get_topic_client_matches(db.session, topic_id))


@monitor_bp.route("/api/monitor/matching/recompute", methods=["POST"])
def recompute_relevances():
    days = request.args.get("days", 30, type=int)
    days = max(1, min(365, days))
    count = compute_all_relevances(db.session, days=days)
    return jsonify({"computed": count})


# ── Clients ─────────────────────────────────────────────────────────────────

@monitor_bp.route("/api/monitor/clients", methods=["GET"])
def list_clients():
    clients = db.session.query(Client).order_by(Client.name).all()
    return jsonify([
        {
            "id": c.id,
            "name": c.name,
            "audience": c.audience,
            "tone": c.tone,
            "keywords": c.keywords,
            "wp_url": c.wp_url,
            "active": c.active,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in clients
    ])


@monitor_bp.route("/api/monitor/clients", methods=["POST"])
def create_client():
    body = request.get_json()
    if not body or not body.get("name"):
        return jsonify({"error": "name is required"}), 400
    client = Client(
        name=body["name"],
        audience=body.get("audience", "small business owners"),
        tone=body.get("tone", "conversational"),
        keywords=body.get("keywords", ""),
        wp_url=body.get("wp_url"),
    )
    db.session.add(client)
    db.session.commit()
    db.session.refresh(client)
    return jsonify({"id": client.id, "name": client.name}), 201


@monitor_bp.route("/api/monitor/clients/<int:client_id>", methods=["GET"])
def get_client(client_id):
    c = db.session.query(Client).filter(Client.id == client_id).first()
    if not c:
        return jsonify({"error": "Client not found"}), 404
    return jsonify({
        "id": c.id, "name": c.name, "audience": c.audience,
        "tone": c.tone, "keywords": c.keywords, "wp_url": c.wp_url,
        "active": c.active,
    })


@monitor_bp.route("/api/monitor/clients/<int:client_id>", methods=["PATCH"])
def update_client(client_id):
    c = db.session.query(Client).filter(Client.id == client_id).first()
    if not c:
        return jsonify({"error": "Client not found"}), 404
    body = request.get_json()
    if not body:
        return jsonify({"error": "No data provided"}), 400
    for field in ["name", "audience", "tone", "keywords", "wp_url", "active"]:
        if field in body:
            setattr(c, field, body[field])
    db.session.commit()
    return jsonify({"ok": True})


@monitor_bp.route("/api/monitor/clients/<int:client_id>", methods=["DELETE"])
def delete_client(client_id):
    c = db.session.query(Client).filter(Client.id == client_id).first()
    if not c:
        return jsonify({"error": "Client not found"}), 404
    c.active = False
    db.session.commit()
    return jsonify({"ok": True})


# ── Assignments ──────────────────────────────────────────────────────────────

@monitor_bp.route("/api/monitor/assignments", methods=["POST"])
def create_assignments():
    body = request.get_json()
    if not body:
        return jsonify({"error": "No data provided"}), 400

    topic_id = body.get("topic_id")
    client_ids = body.get("client_ids", [])

    topic = db.session.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        return jsonify({"error": "Topic not found"}), 404

    created = []
    for cid in client_ids:
        exists = db.session.query(Assignment).filter(
            Assignment.topic_id == topic_id,
            Assignment.client_id == cid,
        ).first()
        if not exists:
            a = Assignment(topic_id=topic_id, client_id=cid)
            db.session.add(a)
            created.append(cid)

    topic.status = "seen"
    db.session.commit()
    return jsonify({"created": len(created), "client_ids": created}), 201


@monitor_bp.route("/api/monitor/assignments/bulk", methods=["POST"])
def bulk_create_assignments():
    body = request.get_json()
    if not body:
        return jsonify({"error": "No data provided"}), 400

    topic_ids = body.get("topic_ids", [])
    client_ids = body.get("client_ids", [])

    total_created = 0
    for topic_id in topic_ids:
        topic = db.session.query(Topic).filter(Topic.id == topic_id).first()
        if not topic:
            continue
        for cid in client_ids:
            exists = db.session.query(Assignment).filter(
                Assignment.topic_id == topic_id,
                Assignment.client_id == cid,
            ).first()
            if not exists:
                db.session.add(Assignment(topic_id=topic_id, client_id=cid))
                total_created += 1
        topic.status = "seen"
    db.session.commit()
    return jsonify({"created": total_created}), 201


@monitor_bp.route("/api/monitor/assignments", methods=["GET"])
def list_assignments():
    client_id = request.args.get("client_id", type=int)
    status = request.args.get("status")

    q = db.session.query(Assignment)
    if client_id:
        q = q.filter(Assignment.client_id == client_id)
    if status:
        q = q.filter(Assignment.status == status)
    assignments = q.order_by(Assignment.assigned_at.desc()).all()

    result = []
    for a in assignments:
        result.append({
            "id": a.id,
            "topic_id": a.topic_id,
            "topic_title": a.topic.title if a.topic else "",
            "client_id": a.client_id,
            "client_name": a.client.name if a.client else "",
            "status": a.status,
            "assigned_at": a.assigned_at.isoformat() if a.assigned_at else None,
            "post_id": a.posts[-1].id if a.posts else None,
            "post_status": a.posts[-1].status if a.posts else None,
        })
    return jsonify(result)


# ── Generate (SSE) ───────────────────────────────────────────────────────────

@monitor_bp.route("/api/monitor/generate/<int:assignment_id>", methods=["POST"])
def generate(assignment_id):
    assignment = db.session.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        return jsonify({"error": "Assignment not found"}), 404

    def event_gen():
        # We need to run the async generator synchronously
        loop = asyncio.new_event_loop()
        try:
            agen = stream_generate(assignment_id, db.session)
            while True:
                try:
                    chunk = loop.run_until_complete(agen.__anext__())
                    yield chunk
                except StopAsyncIteration:
                    break
        finally:
            loop.close()

    return Response(
        stream_with_context(event_gen()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── Posts ────────────────────────────────────────────────────────────────────

@monitor_bp.route("/api/monitor/posts", methods=["GET"])
def list_posts():
    status = request.args.get("status")
    client_id = request.args.get("client_id", type=int)
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)

    if limit > 200:
        limit = 200

    q = db.session.query(Post)
    if status:
        q = q.filter(Post.status == status)
    if client_id:
        q = q.join(Assignment).filter(Assignment.client_id == client_id)
    total = q.count()
    posts = q.order_by(Post.updated_at.desc()).offset(offset).limit(limit).all()

    result = []
    for p in posts:
        a = p.assignment
        result.append({
            "id": p.id,
            "status": p.status,
            "word_count": p.word_count,
            "topic": a.topic.title if a and a.topic else "",
            "client": a.client.name if a and a.client else "",
            "client_id": a.client_id if a else None,
            "reviewer_notes": p.reviewer_notes,
            "wp_post_url": p.wp_post_url,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        })
    return jsonify({"total": total, "posts": result})


@monitor_bp.route("/api/monitor/posts/<int:post_id>", methods=["GET"])
def get_post(post_id):
    p = db.session.query(Post).filter(Post.id == post_id).first()
    if not p:
        return jsonify({"error": "Post not found"}), 404
    a = p.assignment
    return jsonify({
        "id": p.id,
        "body": p.body,
        "status": p.status,
        "word_count": p.word_count,
        "reviewer_notes": p.reviewer_notes,
        "wp_post_id": p.wp_post_id,
        "wp_post_url": p.wp_post_url,
        "topic": a.topic.title if a and a.topic else "",
        "client": a.client.name if a and a.client else "",
        "client_id": a.client_id if a else None,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        "comments": [
            {
                "id": c.id,
                "author": c.author,
                "body": c.body,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in p.comments
        ],
    })


@monitor_bp.route("/api/monitor/posts/<int:post_id>", methods=["PATCH"])
def update_post(post_id):
    p = db.session.query(Post).filter(Post.id == post_id).first()
    if not p:
        return jsonify({"error": "Post not found"}), 404
    body = request.get_json()
    if not body:
        return jsonify({"error": "No data provided"}), 400
    if "body" in body and body["body"] is not None:
        p.body = body["body"]
        p.word_count = len(body["body"].split())
    if "reviewer_notes" in body and body["reviewer_notes"] is not None:
        p.reviewer_notes = body["reviewer_notes"]
    p.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"ok": True, "word_count": p.word_count})


@monitor_bp.route("/api/monitor/posts/<int:post_id>/transition", methods=["POST"])
def post_transition(post_id):
    body = request.get_json()
    if not body or "status" not in body:
        return jsonify({"error": "status is required"}), 400
    post, error = transition_post(post_id, body["status"], db.session)
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"ok": True, "status": post.status})


@monitor_bp.route("/api/monitor/posts/<int:post_id>/comments", methods=["POST"])
def post_comment(post_id):
    body = request.get_json()
    if not body or not body.get("body"):
        return jsonify({"error": "body is required"}), 400
    comment = add_comment(post_id, body.get("author", "Reviewer"), body["body"], db.session)
    if not comment:
        return jsonify({"error": "Post not found"}), 404
    return jsonify({
        "id": comment.id,
        "author": comment.author,
        "body": comment.body,
        "created_at": comment.created_at.isoformat(),
    }), 201


# ── Review stats ─────────────────────────────────────────────────────────────

@monitor_bp.route("/api/monitor/review/stats", methods=["GET"])
def review_stats():
    return jsonify(get_review_stats(db.session))


# ── WordPress Sites ───────────────────────────────────────────────────────────

@monitor_bp.route("/api/monitor/wordpress/sites", methods=["GET"])
def list_wp_sites():
    sites = db.session.query(WordPressSite).filter(WordPressSite.active == True).all()
    return jsonify([
        {
            "id": s.id,
            "client_id": s.client_id,
            "client_name": s.client.name if s.client else None,
            "label": s.label,
            "api_url": s.api_url,
            "username": s.username,
            "default_category": s.default_category,
            "publish_mode": s.publish_mode,
        }
        for s in sites
    ])


@monitor_bp.route("/api/monitor/wordpress/sites", methods=["POST"])
def create_wp_site():
    body = request.get_json()
    if not body:
        return jsonify({"error": "No data provided"}), 400
    required = ["label", "api_url", "username", "app_password"]
    for field in required:
        if not body.get(field):
            return jsonify({"error": f"{field} is required"}), 400
    site = WordPressSite(
        client_id=body.get("client_id"),
        label=body["label"],
        api_url=body["api_url"],
        username=body["username"],
        app_password=body["app_password"],
        default_category=body.get("default_category", 1),
        publish_mode=body.get("publish_mode", "draft"),
    )
    db.session.add(site)
    db.session.commit()
    db.session.refresh(site)
    return jsonify({"id": site.id, "label": site.label}), 201


@monitor_bp.route("/api/monitor/wordpress/sites/<int:site_id>", methods=["PATCH"])
def update_wp_site(site_id):
    site = db.session.query(WordPressSite).filter(WordPressSite.id == site_id).first()
    if not site:
        return jsonify({"error": "Site not found"}), 404
    body = request.get_json()
    if not body:
        return jsonify({"error": "No data provided"}), 400
    for field in ["label", "api_url", "username", "app_password", "default_category", "publish_mode"]:
        if field in body and body[field] is not None:
            setattr(site, field, body[field])
    db.session.commit()
    return jsonify({"ok": True})


@monitor_bp.route("/api/monitor/wordpress/sites/<int:site_id>", methods=["DELETE"])
def delete_wp_site(site_id):
    site = db.session.query(WordPressSite).filter(WordPressSite.id == site_id).first()
    if not site:
        return jsonify({"error": "Site not found"}), 404
    site.active = False
    db.session.commit()
    return jsonify({"ok": True})


@monitor_bp.route("/api/monitor/wordpress/sites/<int:site_id>/test", methods=["POST"])
def test_wp_site(site_id):
    site = db.session.query(WordPressSite).filter(WordPressSite.id == site_id).first()
    if not site:
        return jsonify({"error": "Site not found"}), 404
    success, message = _run_async(test_connection(site))
    return jsonify({"success": success, "message": message})


# ── Publish ───────────────────────────────────────────────────────────────────

@monitor_bp.route("/api/monitor/publish", methods=["POST"])
def publish():
    body = request.get_json()
    if not body:
        return jsonify({"error": "No data provided"}), 400
    post_id = body.get("post_id")
    site_id = body.get("site_id")
    if not post_id or not site_id:
        return jsonify({"error": "post_id and site_id are required"}), 400
    result = _run_async(publish_post(post_id, site_id, db.session))
    if not result["success"]:
        return jsonify(result), 400
    return jsonify(result)


@monitor_bp.route("/api/monitor/publish/bulk", methods=["POST"])
def bulk_publish():
    body = request.get_json()
    if not body:
        return jsonify({"error": "No data provided"}), 400
    post_ids = body.get("post_ids", [])
    site_id = body.get("site_id")
    if not post_ids or not site_id:
        return jsonify({"error": "post_ids and site_id are required"}), 400

    results = []
    for pid in post_ids:
        result = _run_async(publish_post(pid, site_id, db.session))
        results.append({"post_id": pid, **result})
    succeeded = sum(1 for r in results if r["success"])
    return jsonify({"total": len(results), "succeeded": succeeded, "results": results})


@monitor_bp.route("/api/monitor/publish/logs", methods=["GET"])
def publish_logs():
    limit = request.args.get("limit", 50, type=int)
    if limit > 200:
        limit = 200
    logs = db.session.query(PublishLog).order_by(PublishLog.attempted_at.desc()).limit(limit).all()
    return jsonify([
        {
            "id": l.id,
            "post_id": l.post_id,
            "site_label": l.site.label if l.site else "",
            "success": l.success,
            "wp_post_id": l.wp_post_id,
            "wp_post_url": l.wp_post_url,
            "message": l.message,
            "attempted_at": l.attempted_at.isoformat() if l.attempted_at else None,
        }
        for l in logs
    ])
