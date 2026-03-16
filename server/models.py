"""
AdOptimizer AI — SQLAlchemy ORM Models
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
