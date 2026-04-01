"""
AdOptimizer AI — Database initialization
"""

import logging
from flask_sqlalchemy import SQLAlchemy

logger = logging.getLogger(__name__)

db = SQLAlchemy()


def init_db(app):
    """Initialize database with Flask app."""
    db.init_app(app)
    with app.app_context():
        from . import models  # noqa: F401

        # Always run create_all so new tables (e.g. CPA Monitor) are created
        db.create_all()

        # Seed CPA Monitor data if monitor_sources table is empty
        _seed_monitor_data()


def _seed_monitor_data():
    """Seed CPA Monitor starter data (Big 4 firms + sample clients)."""
    from .models import Source, MonitorClient

    if db.session.query(Source).count() > 0:
        return

    logger.info("Seeding CPA Monitor sources and clients...")

    sources = [
        Source(name="Deloitte", url="https://www2.deloitte.com",
               blog_url="https://www2.deloitte.com/us/en/insights/topics/tax.html",
               ipa_rank=1, firm_size="big4", specialties="tax,audit,advisory", source_authority=1.0),
        Source(name="PwC", url="https://www.pwc.com",
               blog_url="https://www.pwc.com/us/en/services/tax/library.html",
               ipa_rank=2, firm_size="big4", specialties="tax,consulting", source_authority=1.0),
        Source(name="EY", url="https://www.ey.com",
               blog_url="https://www.ey.com/en_us/tax",
               ipa_rank=3, firm_size="big4", specialties="tax,audit,advisory", source_authority=1.0),
        Source(name="KPMG", url="https://kpmg.com",
               blog_url="https://kpmg.com/us/en/home/insights/tax.html",
               ipa_rank=4, firm_size="big4", specialties="tax,audit", source_authority=0.98),
        Source(name="RSM US", url="https://rsmus.com",
               blog_url="https://rsmus.com/insights/tax-alerts.html",
               ipa_rank=5, firm_size="top10", specialties="tax,audit", source_authority=0.95),
        Source(name="Grant Thornton", url="https://www.grantthornton.com",
               blog_url="https://www.grantthornton.com/insights/articles/tax",
               ipa_rank=6, firm_size="top10", specialties="tax,audit,advisory", source_authority=0.94),
        Source(name="BDO USA", url="https://www.bdo.com",
               blog_url="https://www.bdo.com/insights/tax",
               ipa_rank=7, firm_size="top10", specialties="tax,audit", source_authority=0.93),
        Source(name="Crowe", url="https://www.crowe.com",
               blog_url="https://www.crowe.com/insights/tax",
               ipa_rank=8, firm_size="top10", specialties="tax,audit", source_authority=0.92),
        Source(name="CLA (CliftonLarsonAllen)", url="https://www.claconnect.com",
               blog_url="https://www.claconnect.com/en/resources?type=article&topic=tax",
               ipa_rank=9, firm_size="top10", specialties="tax,audit,advisory", source_authority=0.91),
        Source(name="CBIZ", url="https://www.cbiz.com",
               blog_url="https://www.cbiz.com/insights",
               ipa_rank=10, firm_size="top10", specialties="tax,advisory", source_authority=0.90),
        Source(name="Marcum", url="https://www.marcumllp.com",
               blog_url="https://www.marcumllp.com/insights",
               ipa_rank=11, firm_size="top25", specialties="tax,audit", source_authority=0.88),
        Source(name="Cherry Bekaert", url="https://www.cbh.com",
               blog_url="https://www.cbh.com/insights",
               ipa_rank=12, firm_size="top25", specialties="tax,audit", source_authority=0.87),
        Source(name="Moss Adams", url="https://www.mossadams.com",
               blog_url="https://www.mossadams.com/articles",
               ipa_rank=13, firm_size="top25", specialties="tax,audit,advisory", source_authority=0.86),
        Source(name="Plante Moran", url="https://www.plantemoran.com",
               blog_url="https://www.plantemoran.com/explore-our-thinking/insight",
               ipa_rank=14, firm_size="top25", specialties="tax,audit,advisory", source_authority=0.85),
        Source(name="Forvis Mazars", url="https://www.forvismazars.us",
               blog_url="https://www.forvismazars.us/forsights",
               ipa_rank=15, firm_size="top25", specialties="tax,audit", source_authority=0.85),
    ]
    db.session.add_all(sources)

    if db.session.query(MonitorClient).count() == 0:
        clients = [
            MonitorClient(
                name="Anderson CPA Group",
                audience="small business owners and entrepreneurs",
                tone="conversational",
                keywords="tax planning, small business tax, deductions, IRS compliance",
                wp_url="https://andersoncpa.example.com",
            ),
            MonitorClient(
                name="Miller & Associates",
                audience="high-net-worth individuals and families",
                tone="formal",
                keywords="estate planning, wealth management, investment tax, trust accounting",
                wp_url="https://millerassoc.example.com",
            ),
            MonitorClient(
                name="Summit Tax Advisors",
                audience="mid-size corporations and CFOs",
                tone="formal",
                keywords="corporate tax, R&D credits, transfer pricing, international tax",
                wp_url="https://summittax.example.com",
            ),
        ]
        db.session.add_all(clients)

    db.session.commit()
    logger.info("CPA Monitor seed data created")
