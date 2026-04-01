from sqlalchemy.orm import Session
from ..models import Post, Comment
from datetime import datetime

# Valid status transitions
TRANSITIONS = {
    "draft":     ["in_review"],
    "in_review": ["approved", "rejected"],
    "approved":  ["published", "in_review"],
    "rejected":  ["draft", "in_review"],
    "published": [],
}


def transition_post(post_id: int, new_status: str, db_session) -> tuple:
    post = db_session.query(Post).filter(Post.id == post_id).first()
    if not post:
        return None, "Post not found"

    allowed = TRANSITIONS.get(post.status, [])
    if new_status not in allowed:
        return post, f"Cannot transition from '{post.status}' to '{new_status}'. Allowed: {allowed}"

    post.status = new_status
    post.updated_at = datetime.utcnow()
    db_session.commit()
    db_session.refresh(post)
    return post, None


def add_comment(post_id: int, author: str, body: str, db_session) -> Comment | None:
    post = db_session.query(Post).filter(Post.id == post_id).first()
    if not post:
        return None
    comment = Comment(post_id=post_id, author=author, body=body)
    db_session.add(comment)
    db_session.commit()
    db_session.refresh(comment)
    return comment


def get_review_stats(db_session) -> dict:
    statuses = ["draft", "in_review", "approved", "rejected", "published"]
    stats = {}
    for s in statuses:
        stats[s] = db_session.query(Post).filter(Post.status == s).count()
    stats["total"] = db_session.query(Post).count()
    return stats
