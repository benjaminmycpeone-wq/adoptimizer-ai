"""
AdOptimizer AI — SQLAlchemy ORM Models
(includes CPA Monitor models, prefixed with monitor_ table names)
"""

from datetime import datetime, timezone
from .db import db


class Campaign(db.Model):
    __tablename__ = "campaigns"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    google_campaign_id = db.Column(db.String(100))
    status = db.Column(db.String(50), default="DRAFT")
    business_name = db.Column(db.String(255))
    business_location = db.Column(db.String(255))
    business_category = db.Column(db.String(100))
    website = db.Column(db.String(500))
    services = db.Column(db.Text)
    target_audience = db.Column(db.Text)
    usps = db.Column(db.Text)
    campaign_goal = db.Column(db.String(50))
    daily_budget = db.Column(db.Float)
    bidding_strategy = db.Column(db.String(50))
    target_locations = db.Column(db.Text)
    radius_miles = db.Column(db.Integer)
    keywords_raw = db.Column(db.Text)
    ad_copy_raw = db.Column(db.Text)
    negatives_raw = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, onupdate=lambda: datetime.now(timezone.utc))

    keywords = db.relationship("Keyword", backref="campaign", cascade="all, delete-orphan")
    ad_copies = db.relationship("AdCopy", backref="campaign", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "googleCampaignId": self.google_campaign_id,
            "status": self.status,
            "businessName": self.business_name,
            "businessLocation": self.business_location,
            "businessCategory": self.business_category,
            "website": self.website,
            "services": self.services,
            "targetAudience": self.target_audience,
            "usps": self.usps,
            "campaignGoal": self.campaign_goal,
            "dailyBudget": self.daily_budget,
            "biddingStrategy": self.bidding_strategy,
            "targetLocations": self.target_locations,
            "radiusMiles": self.radius_miles,
            "keywordsRaw": self.keywords_raw,
            "adCopyRaw": self.ad_copy_raw,
            "negativesRaw": self.negatives_raw,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }


class Keyword(db.Model):
    __tablename__ = "keywords"

    id = db.Column(db.Integer, primary_key=True)
    campaign_id = db.Column(db.Integer, db.ForeignKey("campaigns.id"), nullable=False)
    text = db.Column(db.String(255), nullable=False)
    match_type = db.Column(db.String(20))
    ad_group_name = db.Column(db.String(255))
    intent = db.Column(db.String(20))
    is_negative = db.Column(db.Boolean, default=False)
    google_criterion_id = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))


class AdCopy(db.Model):
    __tablename__ = "ad_copies"

    id = db.Column(db.Integer, primary_key=True)
    campaign_id = db.Column(db.Integer, db.ForeignKey("campaigns.id"), nullable=False)
    ad_type = db.Column(db.String(20))
    headlines = db.Column(db.Text)
    descriptions = db.Column(db.Text)
    pin_strategy = db.Column(db.Text)
    google_ad_id = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))


class ScrapeResult(db.Model):
    __tablename__ = "scrape_results"

    id = db.Column(db.Integer, primary_key=True)
    url = db.Column(db.String(500), nullable=False)
    firm_name = db.Column(db.String(255))
    services = db.Column(db.Text)
    target_clients = db.Column(db.Text)
    differentiators = db.Column(db.Text)
    locations = db.Column(db.Text)
    summary = db.Column(db.Text)
    raw_data = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "url": self.url,
            "firmName": self.firm_name,
            "services": self.services,
            "targetClients": self.target_clients,
            "differentiators": self.differentiators,
            "locations": self.locations,
            "summary": self.summary,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


# ── CPA Monitor Models ──────────────────────────────────────────────────────


class Source(db.Model):
    __tablename__ = "monitor_sources"
    id = db.Column(db.Integer, primary_key=True, index=True)
    name = db.Column(db.String, nullable=False)
    url = db.Column(db.String, nullable=False)
    blog_url = db.Column(db.String, nullable=True)
    rss_url = db.Column(db.String, nullable=True)
    linkedin_url = db.Column(db.String, nullable=True)
    active = db.Column(db.Boolean, default=True)
    last_scraped = db.Column(db.DateTime, nullable=True)
    ipa_rank = db.Column(db.Integer, nullable=True)
    firm_size = db.Column(db.String, default="regional")
    state = db.Column(db.String, nullable=True)
    niche = db.Column(db.String, nullable=True)
    services = db.Column(db.String, nullable=True)
    post_frequency = db.Column(db.String, nullable=True)
    selector_config = db.Column(db.Text, nullable=True)
    specialties = db.Column(db.Text, nullable=True)
    source_authority = db.Column(db.Float, default=0.5)
    scrape_error = db.Column(db.Text, nullable=True)
    scrape_fail_count = db.Column(db.Integer, default=0)
    scrape_success_count = db.Column(db.Integer, default=0)
    topics = db.relationship("Topic", back_populates="source")


class Topic(db.Model):
    __tablename__ = "monitor_topics"
    id = db.Column(db.Integer, primary_key=True, index=True)
    source_id = db.Column(db.Integer, db.ForeignKey("monitor_sources.id"), nullable=False)
    title = db.Column(db.String, nullable=False)
    url = db.Column(db.String, nullable=True)
    discovered_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String, default="new")
    recency_score = db.Column(db.Float, default=0.0)
    coverage_score = db.Column(db.Float, default=0.0)
    seo_score = db.Column(db.Float, default=0.0)
    composite_score = db.Column(db.Float, default=0.0)
    summary = db.Column(db.Text, nullable=True)
    author = db.Column(db.String, nullable=True)
    published_at = db.Column(db.DateTime, nullable=True)
    category = db.Column(db.String, nullable=True)
    niche = db.Column(db.String, nullable=True)
    keywords_extracted = db.Column(db.Text, nullable=True)
    source = db.relationship("Source", back_populates="topics")
    assignments = db.relationship("Assignment", back_populates="topic")
    relevances = db.relationship("ClientTopicRelevance", back_populates="topic")


class MonitorClient(db.Model):
    __tablename__ = "monitor_clients"
    id = db.Column(db.Integer, primary_key=True, index=True)
    name = db.Column(db.String, nullable=False)
    audience = db.Column(db.String, default="small business owners")
    tone = db.Column(db.String, default="conversational")
    keywords = db.Column(db.Text, default="")
    wp_url = db.Column(db.String, nullable=True)
    active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    assignments = db.relationship("Assignment", back_populates="client")
    wordpress_sites = db.relationship("WordPressSite", back_populates="client")
    relevances = db.relationship("ClientTopicRelevance", back_populates="client")


# Alias so business logic modules can import Client
Client = MonitorClient


class Assignment(db.Model):
    __tablename__ = "monitor_assignments"
    id = db.Column(db.Integer, primary_key=True, index=True)
    topic_id = db.Column(db.Integer, db.ForeignKey("monitor_topics.id"), nullable=False)
    client_id = db.Column(db.Integer, db.ForeignKey("monitor_clients.id"), nullable=False)
    status = db.Column(db.String, default="pending")
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow)
    topic = db.relationship("Topic", back_populates="assignments")
    client = db.relationship("MonitorClient", back_populates="assignments")
    posts = db.relationship("Post", back_populates="assignment")


class Post(db.Model):
    __tablename__ = "monitor_posts"
    id = db.Column(db.Integer, primary_key=True, index=True)
    assignment_id = db.Column(db.Integer, db.ForeignKey("monitor_assignments.id"), nullable=False)
    body = db.Column(db.Text, default="")
    word_count = db.Column(db.Integer, default=0)
    status = db.Column(db.String, default="draft")
    reviewer_notes = db.Column(db.Text, default="")
    wp_post_id = db.Column(db.Integer, nullable=True)
    wp_post_url = db.Column(db.String, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    assignment = db.relationship("Assignment", back_populates="posts")
    comments = db.relationship("Comment", back_populates="post")
    publish_logs = db.relationship("PublishLog", back_populates="post")


class Comment(db.Model):
    __tablename__ = "monitor_comments"
    id = db.Column(db.Integer, primary_key=True, index=True)
    post_id = db.Column(db.Integer, db.ForeignKey("monitor_posts.id"), nullable=False)
    author = db.Column(db.String, default="Reviewer")
    body = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    post = db.relationship("Post", back_populates="comments")


class WordPressSite(db.Model):
    __tablename__ = "monitor_wordpress_sites"
    id = db.Column(db.Integer, primary_key=True, index=True)
    client_id = db.Column(db.Integer, db.ForeignKey("monitor_clients.id"), nullable=True)
    label = db.Column(db.String, nullable=False)
    api_url = db.Column(db.String, nullable=False)
    username = db.Column(db.String, nullable=False)
    app_password = db.Column(db.String, nullable=False)
    default_category = db.Column(db.Integer, default=1)
    publish_mode = db.Column(db.String, default="draft")
    active = db.Column(db.Boolean, default=True)
    client = db.relationship("MonitorClient", back_populates="wordpress_sites")
    publish_logs = db.relationship("PublishLog", back_populates="site")


class PublishLog(db.Model):
    __tablename__ = "monitor_publish_logs"
    id = db.Column(db.Integer, primary_key=True, index=True)
    post_id = db.Column(db.Integer, db.ForeignKey("monitor_posts.id"), nullable=False)
    site_id = db.Column(db.Integer, db.ForeignKey("monitor_wordpress_sites.id"), nullable=False)
    success = db.Column(db.Boolean, default=False)
    wp_post_id = db.Column(db.Integer, nullable=True)
    wp_post_url = db.Column(db.String, nullable=True)
    message = db.Column(db.Text, default="")
    attempted_at = db.Column(db.DateTime, default=datetime.utcnow)
    post = db.relationship("Post", back_populates="publish_logs")
    site = db.relationship("WordPressSite", back_populates="publish_logs")


class TrendSnapshot(db.Model):
    __tablename__ = "monitor_trend_snapshots"
    id = db.Column(db.Integer, primary_key=True, index=True)
    snapshot_date = db.Column(db.DateTime, default=datetime.utcnow)
    keyword = db.Column(db.String, nullable=False, index=True)
    occurrence_count = db.Column(db.Integer, default=0)
    source_count = db.Column(db.Integer, default=0)
    velocity = db.Column(db.Float, default=0.0)
    category = db.Column(db.String, nullable=True)


class ClientTopicRelevance(db.Model):
    __tablename__ = "monitor_client_topic_relevances"
    id = db.Column(db.Integer, primary_key=True, index=True)
    client_id = db.Column(db.Integer, db.ForeignKey("monitor_clients.id"), nullable=False)
    topic_id = db.Column(db.Integer, db.ForeignKey("monitor_topics.id"), nullable=False)
    relevance_score = db.Column(db.Float, default=0.0)
    keyword_overlap = db.Column(db.Float, default=0.0)
    audience_alignment = db.Column(db.Float, default=0.0)
    computed_at = db.Column(db.DateTime, default=datetime.utcnow)
    client = db.relationship("MonitorClient", back_populates="relevances")
    topic = db.relationship("Topic", back_populates="relevances")
