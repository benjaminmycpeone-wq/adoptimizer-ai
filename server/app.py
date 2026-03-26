"""
AdOptimizer AI — Flask Application Factory
"""

import os
from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS
from .config import PORT, DATABASE_URL
from .db import init_db


def create_app():
    app = Flask(__name__, static_folder="static", static_url_path="")
    app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    CORS(app, origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:5055",
        "https://adoptimizer-ai-production.up.railway.app",
    ])

    # Initialize database
    init_db(app)

    # Register blueprints
    from .scraper import scraper_bp
    from .ai_proxy import ai_bp
    from .google_ads import google_ads_bp

    app.register_blueprint(scraper_bp)
    app.register_blueprint(ai_bp)
    app.register_blueprint(google_ads_bp)

    # Security headers
    @app.after_request
    def security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        return response

    # Health check
    @app.route("/health", methods=["GET"])
    def health():
        return jsonify({"status": "ok", "message": "AdOptimizer server is running"})

    # Serve React SPA in production
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_spa(path):
        if path and os.path.exists(os.path.join(app.static_folder or "", path)):
            return send_from_directory(app.static_folder, path)
        # For API routes that don't exist, return 404
        if path.startswith("api/"):
            return jsonify({"error": "Not found"}), 404
        # SPA fallback
        index_path = os.path.join(app.static_folder or "", "index.html")
        if os.path.exists(index_path):
            return send_from_directory(app.static_folder, "index.html")
        return jsonify({"message": "AdOptimizer API running. Frontend not built yet."}), 200

    return app


if __name__ == "__main__":
    app = create_app()
    print(f"\n  AdOptimizer server running on http://localhost:{PORT}")
    print("  -------------------------------------------------")
    print("  Scraper:  POST /scrape")
    print("  AI Proxy: POST /ai-proxy")
    print("  API:      /api/campaigns, /api/scrape-results")
    print("  Health:   GET  /health")
    print("  -------------------------------------------------\n")
    app.run(host="0.0.0.0", port=PORT, debug=False)
