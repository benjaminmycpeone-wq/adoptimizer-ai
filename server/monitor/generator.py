import os
import logging
from anthropic import AsyncAnthropic
from ..models import Assignment, Post, Topic, MonitorClient as Client
from .prompt_builder import build_prompt

logger = logging.getLogger(__name__)

MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514")
MAX_TOKENS = int(os.getenv("CLAUDE_MAX_TOKENS", "4096"))

client_ai = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))


async def stream_generate(assignment_id: int, db_session):
    """
    Generator that yields SSE-formatted chunks for a blog post.
    Saves the completed post to the database when done.
    """
    assignment = db_session.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        yield f"data: ERROR: Assignment {assignment_id} not found\n\n"
        return

    topic: Topic = assignment.topic
    client_obj: Client = assignment.client

    if not topic or not client_obj:
        yield f"data: ERROR: Missing topic or client data\n\n"
        return

    # Mark as generating
    assignment.status = "generating"
    db_session.commit()

    # Create or reuse post record
    post = db_session.query(Post).filter(Post.assignment_id == assignment_id).first()
    if not post:
        post = Post(assignment_id=assignment_id, status="draft")
        db_session.add(post)
        db_session.commit()
        db_session.refresh(post)

    prompt = build_prompt(topic, client_obj)
    full_text = []

    try:
        async with client_ai.messages.stream(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            async for text in stream.text_stream:
                full_text.append(text)
                escaped = text.replace("\n", "\\n")
                yield f"data: {escaped}\n\n"

        body = "".join(full_text)
        post.body = body
        post.word_count = len(body.split())
        post.status = "draft"
        assignment.status = "done"
        from datetime import datetime
        post.updated_at = datetime.utcnow()
        db_session.commit()

        yield f"data: [DONE]\n\n"
        logger.info("Generated post for assignment %d (%d words)", assignment_id, post.word_count)

    except Exception as exc:
        logger.error("Generation failed for assignment %d: %s", assignment_id, exc)
        assignment.status = "pending"
        db_session.commit()
        yield f"data: ERROR: {str(exc)}\n\n"
