"""
AdOptimizer AI — AI Provider Proxy with SSE Streaming
Proxies requests to Anthropic, OpenAI, Moonshot, OpenRouter to fix CORS.
"""

import requests
from flask import Blueprint, request, jsonify, Response, stream_with_context
from .config import AI_ENDPOINTS

ai_bp = Blueprint("ai_proxy", __name__)


@ai_bp.route("/ai-proxy", methods=["POST"])
def ai_proxy():
    body = request.get_json(force=True) or {}
    provider = body.get("provider", "anthropic")
    api_key = body.get("apiKey", "")
    payload = body.get("payload", {})

    url = AI_ENDPOINTS.get(provider)
    if not url:
        return jsonify({"error": f"Unknown provider: {provider}"}), 400
    if not api_key:
        return jsonify({"error": "No API key provided"}), 400

    if provider == "anthropic":
        headers = {
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        }
    else:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        }

    is_stream = payload.get("stream", False)

    try:
        if is_stream:
            upstream = requests.post(url, headers=headers, json=payload, stream=True, timeout=120)

            def generate():
                for chunk in upstream.iter_content(chunk_size=None):
                    yield chunk

            return Response(
                stream_with_context(generate()),
                status=upstream.status_code,
                content_type=upstream.headers.get("Content-Type", "text/event-stream"),
            )
        else:
            resp = requests.post(url, headers=headers, json=payload, timeout=60)
            return Response(resp.content, status=resp.status_code, content_type="application/json")

    except Exception as e:
        return jsonify({"error": str(e), "message": str(e)}), 500
