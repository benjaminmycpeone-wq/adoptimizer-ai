import httpx
import base64
import logging
import re
from ..models import Post, WordPressSite, PublishLog, Assignment
from datetime import datetime

logger = logging.getLogger(__name__)


def _basic_auth_header(username: str, password: str) -> str:
    token = base64.b64encode(f"{username}:{password}".encode()).decode()
    return f"Basic {token}"


def _inline_markdown(text: str) -> str:
    """Convert inline markdown to HTML: **bold**, *italic*, [link](url), `code`."""
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'__(.+?)__', r'<strong>\1</strong>', text)
    text = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'<em>\1</em>', text)
    text = re.sub(r'`(.+?)`', r'<code>\1</code>', text)
    text = re.sub(r'\[(.+?)\]\((.+?)\)', r'<a href="\2">\1</a>', text)
    return text


def _text_to_wp_blocks(body: str) -> str:
    """Convert markdown text to WordPress block editor HTML."""
    lines = body.split("\n")
    html_parts = []
    current_paragraph = []

    def flush_paragraph():
        if current_paragraph:
            text = " ".join(current_paragraph).strip()
            if text:
                text = _inline_markdown(text)
                html_parts.append(f'<!-- wp:paragraph -->\n<p>{text}</p>\n<!-- /wp:paragraph -->')
            current_paragraph.clear()

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        if not line:
            flush_paragraph()
            i += 1
            continue

        if line.startswith("## "):
            flush_paragraph()
            text = _inline_markdown(line[3:].strip())
            html_parts.append(
                f'<!-- wp:heading -->\n<h2 class="wp-block-heading">{text}</h2>\n<!-- /wp:heading -->'
            )
            i += 1
            continue

        if line.startswith("### "):
            flush_paragraph()
            text = _inline_markdown(line[4:].strip())
            html_parts.append(
                f'<!-- wp:heading {{"level":3}} -->\n<h3 class="wp-block-heading">{text}</h3>\n<!-- /wp:heading -->'
            )
            i += 1
            continue

        if re.match(r'^\d+\.\s', line):
            flush_paragraph()
            items = []
            while i < len(lines) and re.match(r'^\d+\.\s', lines[i].strip()):
                item_text = re.sub(r'^\d+\.\s', '', lines[i].strip())
                items.append(f"<li>{_inline_markdown(item_text)}</li>")
                i += 1
            html_parts.append(
                '<!-- wp:list {"ordered":true} -->\n<ol>' + "".join(items) + "</ol>\n<!-- /wp:list -->"
            )
            continue

        if line.startswith("- ") or line.startswith("* "):
            flush_paragraph()
            items = []
            while i < len(lines) and (lines[i].strip().startswith("- ") or lines[i].strip().startswith("* ")):
                item_text = lines[i].strip()[2:]
                items.append(f"<li>{_inline_markdown(item_text)}</li>")
                i += 1
            html_parts.append(
                "<!-- wp:list -->\n<ul>" + "".join(items) + "</ul>\n<!-- /wp:list -->"
            )
            continue

        if line.startswith("> "):
            flush_paragraph()
            quote_lines = []
            while i < len(lines) and lines[i].strip().startswith("> "):
                quote_lines.append(lines[i].strip()[2:])
                i += 1
            quote_text = _inline_markdown(" ".join(quote_lines))
            html_parts.append(
                f'<!-- wp:quote -->\n<blockquote class="wp-block-quote"><p>{quote_text}</p></blockquote>\n<!-- /wp:quote -->'
            )
            continue

        if line in ("---", "***", "___"):
            flush_paragraph()
            html_parts.append('<!-- wp:separator -->\n<hr class="wp-block-separator"/>\n<!-- /wp:separator -->')
            i += 1
            continue

        current_paragraph.append(line)
        i += 1

    flush_paragraph()
    return "\n\n".join(html_parts)


async def test_connection(site: WordPressSite) -> tuple[bool, str]:
    url = site.api_url.rstrip("/") + "/wp/v2/users/me"
    headers = {"Authorization": _basic_auth_header(site.username, site.app_password)}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, headers=headers)
        if resp.status_code == 200:
            data = resp.json()
            return True, f"Connected as: {data.get('name', site.username)}"
        return False, f"HTTP {resp.status_code}: {resp.text[:200]}"
    except Exception as exc:
        return False, str(exc)


async def publish_post(post_id: int, site_id: int, db_session, retries: int = 2) -> dict:
    post = db_session.query(Post).filter(Post.id == post_id).first()
    site = db_session.query(WordPressSite).filter(WordPressSite.id == site_id).first()

    if not post:
        return {"success": False, "message": "Post not found"}
    if not site:
        return {"success": False, "message": "WordPress site not found"}
    if post.status not in ("approved", "published"):
        return {"success": False, "message": f"Post status is '{post.status}', must be 'approved' or 'published'"}

    title = "Untitled Post"
    if post.assignment and post.assignment.topic:
        title = post.assignment.topic.title

    wp_content = _text_to_wp_blocks(post.body)
    payload = {
        "title": title,
        "content": wp_content,
        "status": site.publish_mode,
        "categories": [site.default_category],
    }

    url = site.api_url.rstrip("/") + "/wp/v2/posts"
    headers = {
        "Authorization": _basic_auth_header(site.username, site.app_password),
        "Content-Type": "application/json",
    }

    log = PublishLog(post_id=post_id, site_id=site_id, attempted_at=datetime.utcnow())

    last_error = None
    for attempt in range(retries + 1):
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(url, json=payload, headers=headers)

            if resp.status_code in (200, 201):
                data = resp.json()
                log.success = True
                log.wp_post_id = data.get("id")
                log.wp_post_url = data.get("link", "")
                log.message = f"Published successfully as '{site.publish_mode}'"

                post.wp_post_id = log.wp_post_id
                post.wp_post_url = log.wp_post_url
                post.status = "published"
                post.updated_at = datetime.utcnow()
                break
            elif resp.status_code in (429, 500, 502, 503):
                last_error = f"HTTP {resp.status_code}: {resp.text[:300]}"
                if attempt < retries:
                    import asyncio
                    await asyncio.sleep(2 ** attempt)
                    continue
                log.success = False
                log.message = last_error
            else:
                log.success = False
                log.message = f"HTTP {resp.status_code}: {resp.text[:500]}"
                break

        except Exception as exc:
            last_error = str(exc)
            if attempt < retries:
                import asyncio
                await asyncio.sleep(2 ** attempt)
                continue
            log.success = False
            log.message = last_error

    db_session.add(log)
    db_session.commit()
    db_session.refresh(log)

    return {
        "success": log.success,
        "message": log.message,
        "wp_post_id": log.wp_post_id,
        "wp_post_url": log.wp_post_url,
    }
