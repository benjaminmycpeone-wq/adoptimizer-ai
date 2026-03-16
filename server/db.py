"""
AdOptimizer AI — Database initialization
"""

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import inspect

db = SQLAlchemy()


def init_db(app):
    """Initialize database with Flask app."""
    db.init_app(app)
    with app.app_context():
        from . import models  # noqa: F401
        inspector = inspect(db.engine)
        existing = inspector.get_table_names()
        if not existing:
            db.create_all()
