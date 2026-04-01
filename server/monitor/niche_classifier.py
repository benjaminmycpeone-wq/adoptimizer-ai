"""
Niche Classifier -- assigns an industry niche to each topic based on title keywords.
Falls back to the source firm's niche if no keyword match is found.
"""
import logging
import re
from sqlalchemy.orm import Session
from ..models import Topic, Source

logger = logging.getLogger(__name__)

# Keyword -> niche mapping (order matters -- first match wins for each keyword group)
NICHE_RULES = [
    ("Real Estate", [
        r"\breal\s*estate\b", r"\bproperty\b", r"\breit\b", r"\brental\b",
        r"\bland(?:lord)?\b", r"\btenant\b", r"\b1031\b", r"\blike.kind\b",
        r"\bqoz\b", r"\bopportunity\s*zone\b", r"\bcost\s*segregation\b",
        r"\bqbi\b.*(?:real|property)", r"\bmortgage\b", r"\bhousing\b",
        r"\bhomeowner\b", r"\bhome\s*(?:buyer|sale|purchase)\b",
    ]),
    ("Construction", [
        r"\bconstruction\b", r"\bcontractor\b", r"\bbuilder\b", r"\binfrastructure\b",
        r"\barchitect(?:ure)?\b",
    ]),
    ("Healthcare", [
        r"\bhealthcare\b", r"\bhealth\s*care\b", r"\bhospital\b", r"\bmedic(?:al|ine)\b",
        r"\bphysician\b", r"\bpatient\b", r"\bhipaa\b", r"\bcms\b.*(?:health|medic)",
        r"\bnurs(?:e|ing)\b", r"\bpharma(?:ceut)?\b", r"\bdrug\b.*(?:pric|cost)",
        r"\bmental\s*health\b", r"\btelehealth\b", r"\behr\b",
    ]),
    ("Dental", [
        r"\bdental\b", r"\bdentist\b", r"\borthodont\b",
    ]),
    ("Technology", [
        r"\btechnolog(?:y|ies)\b", r"\bsaas\b", r"\bsoftware\b", r"\bcyber\b",
        r"\bartificial\s*intelligence\b", r"\b(?:ai|ml)\b.*(?:tax|account|audit|business)",
        r"\bcloud\b", r"\bdigital\s*transform\b", r"\bfintech\b", r"\bautomation\b",
        r"\bdata\s*(?:analytics|privacy|breach|security)\b",
    ]),
    ("Cryptocurrency", [
        r"\bcrypto(?:currency|asset)?\b", r"\bbitcoin\b", r"\bblockchain\b",
        r"\bdigital\s*asset\b", r"\bnft\b", r"\bdefi\b", r"\bweb3\b", r"\btoken\b",
    ]),
    ("Financial Services", [
        r"\bfinancial\s*(?:service|institution|planning)\b", r"\bbanking\b", r"\bbank\b",
        r"\bcredit\s*union\b", r"\binvestment\s*(?:fund|manag|advis)\b",
        r"\bprivate\s*equity\b", r"\bhedge\s*fund\b", r"\bventure\s*capital\b",
        r"\basset\s*management\b", r"\binsurance\b(?!.*(?:health|life\s*science))",
    ]),
    ("Wealth Management", [
        r"\bwealth\b", r"\bhigh.net.worth\b", r"\bhnwi?\b", r"\bestate\s*plan\b",
        r"\btrust\b.*(?:plan|account|tax)", r"\binheritance\b", r"\bgift\s*tax\b",
        r"\bfamily\s*(?:office|wealth|business)\b", r"\bsuccession\b",
        r"\bgenerational\b", r"\bphilanthrop\b", r"\bcharitable\b",
    ]),
    ("Energy", [
        r"\benergy\b", r"\boil\b.*(?:gas|tax)", r"\bgas\b.*(?:oil|tax|industry)",
        r"\brenewable\b", r"\bsolar\b", r"\bwind\s*(?:energy|farm|power)\b",
        r"\belectric\s*vehicle\b", r"\bev\s*(?:tax|credit)\b", r"\bcarbon\b",
        r"\bsustainab(?:le|ility)\b", r"\besg\b", r"\bgreen\s*(?:energy|tax|credit)\b",
        r"\binflation\s*reduction\s*act\b", r"\bira\b.*(?:energy|credit|clean)",
    ]),
    ("Manufacturing", [
        r"\bmanufactur\b", r"\bsupply\s*chain\b", r"\binventory\b",
        r"\bproduction\b.*(?:tax|cost|industry)", r"\bindustrial\b",
    ]),
    ("Agriculture", [
        r"\bagricult\b", r"\bfarm(?:er|ing)?\b", r"\branch\b", r"\bcrop\b",
        r"\blivestock\b", r"\bagri-?business\b", r"\bwine\b", r"\bwinery\b",
    ]),
    ("Nonprofit", [
        r"\bnonprofit\b", r"\bnon-profit\b", r"\bnfp\b", r"\b501\s*\(?\s*c\b",
        r"\bcharity\b", r"\bfoundation\b.*(?:tax|grant|fund)", r"\btax.exempt\b",
        r"\bexempt\s*org\b",
    ]),
    ("Government", [
        r"\bgovernment\b", r"\bfederal\b.*(?:contract|grant|fund|agency)",
        r"\bstate\s*(?:tax|budget|fund|gov)\b", r"\bmunicipal\b", r"\bpublic\s*sector\b",
    ]),
    ("International", [
        r"\binternational\b", r"\bcross.border\b", r"\bglobal\b.*(?:tax|trade|business)",
        r"\btransfer\s*pric\b", r"\bforeign\b", r"\bexpat\b", r"\bfbar\b",
        r"\bfatca\b", r"\btreaty\b", r"\btariff\b", r"\btrade\s*(?:war|polic|agreement)\b",
        r"\bpillar\s*(?:one|two|1|2)\b", r"\bbeps\b", r"\boecd\b.*tax",
    ]),
    ("Hospitality", [
        r"\bhospitality\b", r"\bhotel\b", r"\brestaurant\b", r"\bfood\s*(?:service|industry)\b",
        r"\btravel\b.*(?:industry|tax)", r"\btourism\b",
    ]),
    ("Entertainment", [
        r"\bentertainment\b", r"\bmedia\b.*(?:industry|tax)", r"\bfilm\b",
        r"\bmusic\b.*(?:industry|tax)", r"\bsports\b", r"\bathlete\b",
        r"\bgaming\b",
    ]),
    ("Cannabis", [
        r"\bcannabis\b", r"\bmarijuana\b", r"\b280e\b", r"\bdispensary\b",
    ]),
    ("Education", [
        r"\beducation\b", r"\buniversity\b", r"\bcollege\b", r"\bstudent\b.*(?:loan|debt|tax)",
        r"\bschool\b.*(?:tax|fund|district)", r"\bhigher\s*ed\b",
    ]),
    ("Small Business", [
        r"\bsmall\s*business\b", r"\bstartup\b", r"\bstart-up\b",
        r"\bentrepreneur\b", r"\bsolopreneur\b", r"\bfreelance\b",
        r"\bgig\s*(?:economy|worker)\b", r"\bself.employ\b",
        r"\bpass.through\b", r"\bs.corp\b", r"\bllc\b.*tax",
    ]),
    ("Transportation", [
        r"\btransport\b", r"\btrucking\b", r"\blogistics\b",
        r"\bshipping\b.*(?:industry|tax)", r"\bautomotive\b",
    ]),
    ("Retail", [
        r"\bretail\b", r"\be-?commerce\b", r"\bonline\s*(?:sales|store|shop)\b",
        r"\bsales\s*tax\b", r"\bwayfair\b", r"\bnexus\b",
    ]),
]

_COMPILED_RULES = [
    (niche, [re.compile(p, re.IGNORECASE) for p in patterns])
    for niche, patterns in NICHE_RULES
]


def classify_topic_niche(title: str, source_niche: str = None) -> str:
    if not title:
        return source_niche or ""

    scores = {}
    for niche, patterns in _COMPILED_RULES:
        count = sum(1 for p in patterns if p.search(title))
        if count > 0:
            scores[niche] = count

    if scores:
        return max(scores, key=scores.get)

    if source_niche:
        primary = source_niche.split(",")[0].strip()
        if primary:
            return primary

    return ""


def classify_all_topics(db_session, force: bool = False):
    q = db_session.query(Topic)
    if not force:
        q = q.filter((Topic.niche == None) | (Topic.niche == ""))

    topics = q.all()
    classified = 0

    for topic in topics:
        source = db_session.query(Source).filter(Source.id == topic.source_id).first()
        source_niche = source.niche if source else None
        niche = classify_topic_niche(topic.title, source_niche)
        if niche:
            topic.niche = niche
            classified += 1

    db_session.commit()
    logger.info("Classified %d topics into niches (of %d checked)", classified, len(topics))
    return classified
