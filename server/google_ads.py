"""
AdOptimizer AI — Google Ads API Helpers
Server-side helpers for complex multi-step Google Ads operations.
Credentials are passed per-request from the client (never stored server-side).
"""

import json
import requests as http_requests
from flask import Blueprint, request, jsonify
from .db import db
from .models import Campaign, Keyword, AdCopy

google_ads_bp = Blueprint("google_ads", __name__)

GOOGLE_ADS_API_VERSION = "v17"


@google_ads_bp.route("/api/google/token", methods=["POST"])
def refresh_token():
    """Proxy OAuth token refresh to avoid CORS issues."""
    data = request.get_json(force=True) or {}
    r = http_requests.post("https://oauth2.googleapis.com/token", data={
        "client_id": data.get("client_id"),
        "client_secret": data.get("client_secret"),
        "refresh_token": data.get("refresh_token"),
        "grant_type": "refresh_token",
    })
    return jsonify(r.json()), r.status_code


@google_ads_bp.route("/api/google/ads", methods=["POST"])
def proxy_gads():
    """Proxy Google Ads API calls to avoid CORS issues."""
    data = request.get_json(force=True) or {}
    url = data.get("url")
    headers = data.get("headers", {})
    body = data.get("body")
    method = data.get("method", "POST")

    r = http_requests.request(method, url, headers=headers, json=body if body else None)
    return jsonify(r.json()), r.status_code


def _gads_url(customer_id, endpoint):
    return f"https://googleads.googleapis.com/{GOOGLE_ADS_API_VERSION}/customers/{customer_id}/{endpoint}"


def _gads_headers(token, dev_token, mcc_id):
    return {
        "Authorization": f"Bearer {token}",
        "developer-token": dev_token,
        "Content-Type": "application/json",
        "login-customer-id": mcc_id,
    }


@google_ads_bp.route("/api/campaigns", methods=["GET"])
def list_campaigns():
    campaigns = Campaign.query.order_by(Campaign.created_at.desc()).limit(50).all()
    return jsonify([c.to_dict() for c in campaigns])


@google_ads_bp.route("/api/campaigns", methods=["POST"])
def save_campaign():
    data = request.get_json(force=True) or {}

    campaign = Campaign(
        name=data.get("name", "Untitled Campaign"),
        google_campaign_id=data.get("googleCampaignId"),
        status=data.get("status", "DRAFT"),
        business_name=data.get("businessName"),
        business_location=data.get("businessLocation"),
        business_category=data.get("businessCategory"),
        website=data.get("website"),
        services=data.get("services"),
        target_audience=data.get("targetAudience"),
        usps=data.get("usps"),
        campaign_goal=data.get("campaignGoal"),
        daily_budget=data.get("dailyBudget"),
        bidding_strategy=data.get("biddingStrategy"),
        target_locations=data.get("targetLocations"),
        radius_miles=data.get("radiusMiles"),
        keywords_raw=data.get("keywordsRaw"),
        ad_copy_raw=data.get("adCopyRaw"),
        negatives_raw=data.get("negativesRaw"),
    )

    # Save parsed keywords
    for kw in data.get("keywords", []):
        campaign.keywords.append(Keyword(
            text=kw["text"],
            match_type=kw.get("matchType", "BROAD"),
            ad_group_name=kw.get("adGroupName"),
            intent=kw.get("intent"),
            is_negative=kw.get("isNegative", False),
            google_criterion_id=kw.get("googleCriterionId"),
        ))

    # Save parsed ad copies
    for ad in data.get("adCopies", []):
        campaign.ad_copies.append(AdCopy(
            ad_type=ad.get("adType", "RSA"),
            headlines=json.dumps(ad.get("headlines", [])),
            descriptions=json.dumps(ad.get("descriptions", [])),
            pin_strategy=json.dumps(ad.get("pinStrategy", {})),
            google_ad_id=ad.get("googleAdId"),
        ))

    db.session.add(campaign)
    db.session.commit()
    return jsonify(campaign.to_dict()), 201


@google_ads_bp.route("/api/campaigns/<int:campaign_id>", methods=["GET"])
def get_campaign(campaign_id):
    campaign = Campaign.query.get_or_404(campaign_id)
    result = campaign.to_dict()
    result["keywords"] = [
        {
            "id": kw.id,
            "text": kw.text,
            "matchType": kw.match_type,
            "adGroupName": kw.ad_group_name,
            "intent": kw.intent,
            "isNegative": kw.is_negative,
        }
        for kw in campaign.keywords
    ]
    result["adCopies"] = [
        {
            "id": ad.id,
            "adType": ad.ad_type,
            "headlines": json.loads(ad.headlines) if ad.headlines else [],
            "descriptions": json.loads(ad.descriptions) if ad.descriptions else [],
            "pinStrategy": json.loads(ad.pin_strategy) if ad.pin_strategy else {},
        }
        for ad in campaign.ad_copies
    ]
    return jsonify(result)


@google_ads_bp.route("/api/campaigns/<int:campaign_id>", methods=["PUT"])
def update_campaign(campaign_id):
    campaign = Campaign.query.get_or_404(campaign_id)
    data = request.get_json(force=True) or {}

    for field in ["name", "google_campaign_id", "status", "business_name", "business_location",
                   "business_category", "website", "services", "target_audience", "usps",
                   "campaign_goal", "daily_budget", "bidding_strategy", "target_locations",
                   "radius_miles", "keywords_raw", "ad_copy_raw", "negatives_raw"]:
        camel = "".join(w.capitalize() if i else w for i, w in enumerate(field.split("_")))
        if camel in data:
            setattr(campaign, field, data[camel])

    db.session.commit()
    return jsonify(campaign.to_dict())
