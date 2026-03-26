export const MODELS = {
  anthropic: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-4-5-20251001'],
  moonshot: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  openrouter: [
    'openrouter/auto',
    'google/gemini-2.0-flash-exp:free',
    'google/gemma-3-27b-it:free',
    'mistralai/mistral-small-3.1-24b-instruct:free',
    'moonshotai/kimi-k2:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'deepseek/deepseek-r1:free',
  ],
};

export const TITLES = {
  dashboard: 'Dashboard',
  apikey: 'AI API Key',
  credentials: 'Google Ads Credentials',
  scraper: '1. Scrape Client Site',
  builder: '2. Build Campaign',
  keywords: 'Keyword Research',
  adcopy: 'Ad Copy Generator',
  campaigns: '3. Live Campaigns',
  campaignReview: 'Campaign Review',
};

export const CATEGORIES = [
  'Accounting & CPA Firm', 'Tax Preparation', 'Bookkeeping',
  'Financial Advisory', 'Law Firm', 'Medical Practice',
  'Dental Office', 'Insurance Agency', 'Real Estate Agency',
  'Home Services', 'Restaurant', 'Other',
];

// ── Google Ads Expert System Prompt ──
// Used as the system prompt for ALL Google Ads AI calls to establish deep expertise

const GOOGLE_ADS_EXPERT_SYSTEM = `You are an elite Google Ads strategist and certified Google Partner with 15+ years managing $50M+ in annual ad spend across 500+ accounts. You specialize in local service businesses (accounting, legal, medical, home services).

Your expertise includes:
- Quality Score optimization (you consistently achieve 8-10 QS across accounts)
- STAG/SKAG campaign architecture for maximum relevance
- Search term mining and negative keyword sculpting
- RSA copywriting that achieves 15%+ CTR in competitive verticals
- Bid strategy selection and CPA optimization
- Landing page relevance and conversion rate optimization

Your analysis style:
- You are data-driven and specific — never vague or generic
- You cite exact numbers, percentages, and metrics to support every recommendation
- You prioritize actions by expected ROI impact
- You think about the full funnel: impression → click → landing page → conversion
- You always consider match type strategy, negative keyword coverage, and ad group granularity
- When you recommend changes, you explain the expected impact with projected numbers

You output clean, well-structured markdown with tables, bold emphasis on key metrics, and clear section headers.`;

// ── Budget & Bidding Suggestions by Category ──
export const BUDGET_SUGGESTIONS = {
  'Accounting & CPA Firm': { budget: 50, bidding: 'MAXIMIZE_CONVERSIONS', cpa: '$20-45', note: 'CPA firms see $20-45 CPA typically. Start conservative.' },
  'Tax Preparation': { budget: 60, bidding: 'MAXIMIZE_CONVERSIONS', cpa: '$15-35', note: 'Seasonal — ramp up Jan-Apr, reduce May-Dec.' },
  'Bookkeeping': { budget: 40, bidding: 'MAXIMIZE_CONVERSIONS', cpa: '$18-40', note: 'Lower CPC than tax, steady year-round demand.' },
  'Financial Advisory': { budget: 75, bidding: 'TARGET_CPA', cpa: '$40-80', note: 'High client value justifies higher CPA.' },
  'Law Firm': { budget: 100, bidding: 'TARGET_CPA', cpa: '$50-150', note: 'Legal keywords are very competitive. High CPC.' },
  'Medical Practice': { budget: 75, bidding: 'MAXIMIZE_CONVERSIONS', cpa: '$30-70', note: 'Location targeting critical for medical.' },
  'Dental Office': { budget: 60, bidding: 'MAXIMIZE_CONVERSIONS', cpa: '$25-60', note: 'Strong "near me" intent. Focus on local.' },
  'Insurance Agency': { budget: 80, bidding: 'TARGET_CPA', cpa: '$35-80', note: 'Competitive vertical. Niche down by product.' },
  'Real Estate Agency': { budget: 80, bidding: 'MAXIMIZE_CONVERSIONS', cpa: '$40-100', note: 'Location + property type targeting key.' },
  'Home Services': { budget: 50, bidding: 'MAXIMIZE_CONVERSIONS', cpa: '$20-50', note: 'Strong local intent. Emergency keywords convert well.' },
  'Restaurant': { budget: 30, bidding: 'MAXIMIZE_CLICKS', cpa: '$5-15', note: 'Lower CPC. Focus on location + cuisine type.' },
  'Other': { budget: 50, bidding: 'MAXIMIZE_CONVERSIONS', cpa: '$20-60', note: 'Start with maximize conversions, optimize from data.' },
};

// ── Expert AI Prompt Templates ──
// Each prompt returns { system, user } for optimal Claude performance

export const PROMPTS = {
  // ── One-Shot Campaign Strategist ──
  // Takes full scraper output and produces a complete campaign plan
  campaignStrategy: (scrapeData) => ({
    system: `You are an elite Google Ads campaign architect. You build complete, launch-ready Google Ads campaigns from website analysis data. You specialize in local service businesses.

Your output is a COMPLETE campaign plan that can be directly launched in Google Ads. Every piece of data must be actionable — no filler, no generic advice.

CRITICAL RULES:
- Headlines MUST be ≤30 characters each. Count carefully.
- Descriptions MUST be ≤90 characters each. Count carefully.
- Keywords must be relevant, specific, and use proper match type notation
- Output structured JSON blocks for each component so the frontend can parse them
- Base everything on the ACTUAL website data provided — don't invent services or locations not found on the site
- Think about what a real customer would search to find this specific business`,

    user: `Analyze this business website data and create a COMPLETE Google Ads campaign plan.

## Website Analysis Data
- **Business**: ${scrapeData.firmName}
- **Category**: ${scrapeData.category}
- **Website**: ${scrapeData.websiteUrl}
- **Locations**: ${(scrapeData.locations || []).join(', ') || 'Not detected'}
- **Services Found**: ${(scrapeData.services || []).join(', ')}
- **Target Audience**: ${(scrapeData.targetAudience || []).join(', ')}
- **USPs/Differentiators**: ${(scrapeData.usps || []).join(', ')}
- **Competitive Angles**: ${(scrapeData.competitiveAngles || []).join(', ')}
- **CTAs on Site**: ${(scrapeData.ctaPatterns || []).join(', ') || 'None detected'}
- **Pricing Signals**: ${(scrapeData.pricingSignals || []).join(', ') || 'None detected'}
- **Landing Page Quality**: ${scrapeData.landingPageQuality?.score || '?'}/10 (Form: ${scrapeData.landingPageQuality?.hasForm ? 'Yes' : 'No'}, Phone: ${scrapeData.landingPageQuality?.hasPhone ? 'Yes' : 'No'}, CTA: ${scrapeData.landingPageQuality?.hasCTA ? 'Yes' : 'No'})
- **Business Summary**: ${scrapeData.summary || 'N/A'}

## Page Content (for keyword ideas)
${(scrapeData.headings || []).map(h => `- ${h}`).join('\n')}

${(scrapeData.rawText || '').slice(0, 3000)}

---

## OUTPUT FORMAT — Follow this EXACTLY

### 1. Campaign Strategy
Write 2-3 sentences about the recommended approach.

Then output the campaign settings as JSON:
\`\`\`json
{"type":"CAMPAIGN_SETTINGS","campaignName":"...","dailyBudget":50,"biddingStrategy":"MAXIMIZE_CONVERSIONS","locations":["City, ST"],"category":"..."}
\`\`\`

### 2. Ad Groups & Keywords
Create 3-6 tightly-themed ad groups. For EACH ad group, output:

\`\`\`json
{"type":"AD_GROUP","name":"Ad Group Name","theme":"what this group targets","keywords":[{"text":"keyword here","matchType":"PHRASE"},{"text":"another keyword","matchType":"EXACT"}]}
\`\`\`

Include 8-15 keywords per group. Use PHRASE for most, EXACT for high-intent, BROAD for discovery.

### 3. Ad Copy (per ad group)
For EACH ad group, output ONE ad copy block:

\`\`\`json
{"type":"AD_COPY","adGroup":"Ad Group Name","headlines":["Headline 1","Headline 2","...up to 15"],"descriptions":["Description 1 up to 90 chars","Description 2","Description 3","Description 4"]}
\`\`\`

Headlines MUST be ≤30 chars. Descriptions MUST be ≤90 chars. Include location, CTA, USP variety.

### 4. Negative Keywords
Output ONE block with all campaign-level negatives:

\`\`\`json
{"type":"NEGATIVES","keywords":[{"text":"negative term","matchType":"PHRASE"},{"text":"another","matchType":"EXACT"}]}
\`\`\`

Include 30-60 negatives covering: jobs/careers, DIY, software, academic, unrelated services, low-intent.

### 5. Extensions
\`\`\`json
{"type":"EXTENSIONS","callouts":["Callout 1","Callout 2","...6 total"],"sitelinks":[{"title":"Sitelink Title","description":"Description text"}],"snippets":["Snippet 1","Snippet 2","...4 total"]}
\`\`\`

### 6. Budget & Bidding Rationale
Explain why you chose this budget and bidding strategy. Include expected CPA range.`
  }),
  keywords: ({ count, name, loc, cat, svc, aud, usp, matchType }) => ({
    system: GOOGLE_ADS_EXPERT_SYSTEM,
    user: `Generate ${count} high-performance Google Ads keywords for this business. Think step by step about what this business's ideal customer would search.

## Business Profile
- **Business**: ${name}
- **Location**: ${loc}
- **Category**: ${cat}
- **Services**: ${svc}
- **Target Audience**: ${aud}
- **Unique Selling Points**: ${usp}
- **Match Type Focus**: ${matchType}

## Keyword Strategy Requirements

**Ad Group Architecture** — Organize into tightly-themed Single Theme Ad Groups (STAGs). Each group: 5-15 keywords sharing one theme. Name each group descriptively.

**Match Type Format**:
- Broad Match: keyword phrase
- "Phrase Match": "keyword phrase"
- [Exact Match]: [keyword phrase]
${matchType === 'ALL' ? '- Include all three match types for high-intent keywords.' : `- Focus on ${matchType} match.`}

**Search Intent Mix** (aim for 70%+ commercial/transactional):
- **TRANSACTIONAL** (ready to hire): "hire accountant ${loc}", [cpa near me]
- **COMMERCIAL** (comparing options): "best tax preparer ${loc}", [top rated cpa firms]
- **INFORMATIONAL** (researching): "how much does tax prep cost"

**Keyword Types to Include**:
- Location + service combos (city, neighborhood, "near me" variants)
- Problem-aware queries ("owe irs back taxes help", "late filing penalty")
- Long-tail phrases (4+ words) for lower CPC and higher conversion
- Competitor-alternative keywords ("affordable [service] [location]")
- Seasonal/timely variants where applicable

**Per-Keyword Metrics** (estimate based on your experience):
| Keyword | Match | Intent | Volume | Competition | Est. CPC |
Use: HIGH/MED/LOW for volume and competition, $X-$Y for CPC.

**Negative Keywords**: For each ad group, suggest 3-5 negatives to prevent cannibalization between groups.

**Quality Score Notes**: Flag keywords that may need dedicated landing pages for QS optimization.`
  }),

  adCopy: ({ format, name, loc, svc, usp, tone }) => ({
    system: GOOGLE_ADS_EXPERT_SYSTEM,
    user: `Create ${format} Google Ads copy that will achieve maximum CTR and conversions.

## Business Profile
- **Business**: ${name}
- **Location**: ${loc}
- **Services**: ${svc}
- **USPs**: ${usp}
- **Tone**: ${tone}

## RSA Requirements (Responsive Search Ads)

Generate **15 Headlines** (each MUST be ≤30 characters) and **4 Descriptions** (each MUST be ≤90 characters).

**Headline Mix** (15 total, diversified for Google's ML rotation):
- 3× Value proposition headlines (what makes them the best choice)
- 2× Strong CTA headlines ("Get Quote Today", "Call Now", "Book Free Consult")
- 2× Location headlines ("${loc}", "Local ${loc} Expert", "Serving ${loc}")
- 2× Social proof/numbers ("15+ Years Exp", "500+ Clients Served", "5-Star Rated")
- 2× Dynamic Keyword Insertion: {KeyWord:Default Text}
- 1× Urgency/scarcity ("Limited Spots", "Tax Deadline Approaching")
- 1× Problem-solution ("Stressed About Taxes?", "IRS Notice? We Help")
- 2× Brand/authority headlines

**Pin Strategy**:
- Pin 1 (Position 1): Brand or primary value prop
- Pin 2 (Position 2): Key differentiator or CTA
- Pin 3 (Position 3): Location or trust signal
- Mark each headline: [PIN 1], [PIN 2], [PIN 3], or [UNPIN]

**Description Requirements**:
- D1: Primary value proposition + main CTA + differentiator
- D2: Specific services overview + trust signal (years, reviews, certs)
- D3: Special offer or promotion + urgency element
- D4: Problem-solution angle + secondary CTA

**Character Count**: Show [XX/30] for headlines, [XX/90] for descriptions. STRICTLY enforce limits.

## Ad Extensions
- **6 Callout Extensions** (≤25 chars): Key benefits and features
- **4 Sitelink Extensions**: Title (≤25 chars) + Description (≤35 chars each, 2 lines)
- **4 Structured Snippets**: Service types, specialties, or offerings

## Quality Checklist
At the end, score each ad against: Relevance, CTA Strength, Emotional Trigger, Differentiation, Compliance (1-5 each).`
  }),

  negatives: ({ cat, svc, loc }) => ({
    system: GOOGLE_ADS_EXPERT_SYSTEM,
    user: `Generate a comprehensive negative keyword list (80+ keywords) for this business.

## Business Context
- **Category**: ${cat || 'professional services'}
- **Services**: ${svc}
- **Location**: ${loc}

## Negative Keyword Categories

Generate negatives for each category (8-12 per category):

1. **Job/Career Seekers**: job, career, salary, hiring, resume, interview, internship, volunteer, glassdoor, indeed, linkedin, work from home
2. **DIY/Self-Service**: DIY, how to, template, free, tutorial, course, learn, training, certification, exam, study guide
3. **Software/Tools**: software, app, tool, download, plugin, excel, quickbooks, spreadsheet, calculator (unless the business sells these)
4. **Academic/Research**: research, study, thesis, academic, university, college, professor, paper, journal
5. **Unrelated Services**: services NOT offered — think about what searches share keywords but have different intent
6. **Geographic Exclusions**: far-away cities, states, countries that share service keywords
7. **Low-Intent Modifiers**: what is, definition, meaning, history, wiki, reddit, forum, blog, article, news
8. **Price Shoppers** (optional): free, cheap, cheapest, discount, coupon, bargain, lowest price
9. **Complaints/Reviews**: complaint, lawsuit, scam, review, BBB, yelp, rating

## Format
Output in two match types per keyword:
- [exact match] — for precise blocking
- "phrase match" — for broader pattern blocking

Group by category with clear headers. Include rationale for each category (1 sentence explaining why these would waste budget).`
  }),

  keywordResearch: ({ count, niche, focus, matchType }) => ({
    system: GOOGLE_ADS_EXPERT_SYSTEM,
    user: `Generate ${count} high-performance keywords for: **${niche}**${focus ? `\nFocus area: **${focus}**` : ''}

## Requirements
- **Match Type**: ${matchType}
- **Organize by theme clusters** — group related keywords into potential ad groups

For each keyword provide:
| Keyword | Match Type | Intent | Competition | Est. CPC | Volume Tier | Notes |

**Intent**: Commercial / Transactional / Informational / Navigational
**Competition**: HIGH / MED / LOW
**CPC Range**: $X - $Y (based on typical industry rates)
**Volume Tier**: HIGH (10K+) / MED (1K-10K) / LOW (<1K)

**Include**:
- Long-tail variations (4+ words) — these convert 2-3× better
- Question-based keywords ("how much does...", "best way to...", "who offers...")
- "Near me" and location-intent variants
- Problem-aware queries that signal purchase intent

**Flag** high-opportunity keywords (low competition + high intent) with a ⭐ marker.
**Flag** keywords requiring dedicated landing pages with a 🔗 marker.`
  }),

  adCopyStandalone: ({ format, name, service, location, usp, tone }) => ({
    system: GOOGLE_ADS_EXPERT_SYSTEM,
    user: `Create ${format} Google Ads copy for **${name}** offering **${service}** in **${location}**.
USP: ${usp}. Tone: ${tone}.

Follow all character limits strictly. Show character count [XX/30] or [XX/90] for each element.
Include Dynamic Keyword Insertion variants: {KeyWord:Default Text}

For RSA: 15 Headlines (≤30 chars) + 4 Descriptions (≤90 chars) with pin recommendations.
Include: 6 callout extensions (≤25 chars) + 4 sitelink titles with descriptions + 4 structured snippets.`
  }),

  bidStrategy: ({ goal, budget, industry }) => ({
    system: GOOGLE_ADS_EXPERT_SYSTEM,
    user: `Recommend the optimal bidding strategy for this campaign.

## Campaign Context
- **Goal**: ${goal}
- **Daily Budget**: $${budget}
- **Industry**: ${industry}

## Provide a Complete Bidding Plan

### 1. Recommended Strategy
Name the strategy and explain why it's optimal for this specific budget + goal + industry combination. Compare against 2 alternatives with pros/cons.

### 2. Initial Settings
Specific numbers: target CPA, target ROAS, max CPC caps, bid adjustments for device/location/time.

### 3. Learning Phase Plan (Days 1-14)
Week-by-week guidance. What to expect, what NOT to change, minimum conversion thresholds.

### 4. Optimization Milestones
At 50 conversions → do X. At 100 conversions → do Y. When CPA exceeds target by 20% → do Z.

### 5. Warning Signs & Fixes
Table: Warning Sign | Threshold | Action to Take

### 6. Budget Allocation
If running multiple campaigns, how to split the $${budget}/day for maximum impact.`
  }),

  landingPage: ({ url, services, keywords }) => ({
    system: GOOGLE_ADS_EXPERT_SYSTEM,
    user: `Analyze this landing page and provide Quality Score optimization recommendations.

## Landing Page: ${url}
## Services Advertised: ${services}
## Target Keywords: ${keywords}

## Analysis Framework

### 1. Keyword-to-Page Relevance (Score 1-10)
For each target keyword, assess: Does the page contain the keyword? In the H1? In the first 100 words? In meta title?

### 2. Above-the-Fold Audit
- Headline: Does it match search intent? Is the value prop clear in <3 seconds?
- CTA: Is there a clear, contrasting CTA button? What does it say?
- Trust signals: Phone number, reviews, certifications visible above fold?
- Form: Is there a lead capture form visible without scrolling?

### 3. Content Gap Analysis
What content is missing that would improve Quality Score? Map each keyword to expected page content.

### 4. Technical Factors
Page speed estimate, mobile responsiveness, HTTPS, structured data, Core Web Vitals.

### 5. Conversion Optimization
- CTA placement and copy improvements
- Form optimization (reduce fields, add social proof near form)
- Trust element additions (testimonials, badges, guarantees)

### 6. Priority Action List
Table: Priority (1-5) | Change | Expected QS Impact | Difficulty`
  }),

  campaignReview: ({ campaignName, status, budget, bidding, campaignResource, budgetResource, adGroups, keywords, ads, searchTerms }) => ({
    system: `You are an elite Google Ads account auditor. You have 15+ years of experience managing $50M+ in annual ad spend. You audit campaigns for Fortune 500 agencies.

Your audit style:
- You grade campaigns on a clear A-F scale with specific criteria
- You cite exact metrics from the data (QS scores, click counts, cost figures, conversion rates)
- You calculate wasted spend and projected savings
- Every recommendation includes a projected ROI impact
- You produce actionable JSON code blocks that can be directly applied to the Google Ads API

CRITICAL INSTRUCTIONS FOR EXECUTABLE ACTIONS:
- Output each action as a separate \`\`\`json code block
- Use EXACT resource names from the campaign data — never fabricate them
- The "keyword" field is REQUIRED for PAUSE_KEYWORD and ADD_NEGATIVE actions
- Group actions: ADD_NEGATIVE first, then PAUSE_KEYWORD, ADD_KEYWORD, PAUSE_AD, UPDATE_BUDGET
- Output 10-20 actions total
- Every "reason" must cite specific data points (QS, clicks, cost, conversions)`,

    user: `Audit this Google Ads campaign and produce a detailed report with executable recommendations.

## Campaign Overview
- **Name**: ${campaignName}
- **Status**: ${status}
- **Budget**: ${budget}
- **Bidding Strategy**: ${bidding}
- **Campaign Resource**: ${campaignResource}
- **Budget Resource**: ${budgetResource}

## Ad Groups
${adGroups || 'None found'}

## Keywords (with Quality Scores)
${keywords || 'None found'}

## Ads (Headlines, Descriptions, Strength)
${ads || 'None found'}

## Search Terms (Last 30 Days — with impressions, clicks, cost, conversions)
${searchTerms || 'None found'}

---

## Report Structure

### 1. Executive Summary
Grade: A/B/C/D/F with one-sentence justification. Key stats: total spend, total conversions, avg CPA, avg QS, wasted spend estimate.

### 2. Keyword Deep-Dive
Table of all keywords with: Keyword | Match Type | QS | Status | Verdict (Keep/Pause/Modify) | Reason

### 3. Search Term Forensics
**Wasteful terms** (clicks + cost but 0 conversions): list each with cost wasted
**Valuable terms** (conversions or high relevance not yet captured as keywords): list each with recommendation

### 4. Ad Copy Assessment
For each ad: Strength rating, missing elements, specific improvement suggestions.

### 5. Priority Actions (Top 10)
| # | Action | Expected Impact | Priority |

### 6. Executable Actions
Output each as a separate \`\`\`json code block.

**ADD_NEGATIVE** (block wasteful search terms):
\`\`\`json
{"type":"ADD_NEGATIVE","keyword":"term to block","matchType":"PHRASE","reason":"data-backed reason"}
\`\`\`

**PAUSE_KEYWORD** (pause underperformers):
\`\`\`json
{"type":"PAUSE_KEYWORD","resourceName":"customers/xxx/adGroupCriteria/xxx~xxx","keyword":"keyword text","reason":"QS: X/10, Y clicks, $Z spent, 0 conversions"}
\`\`\`

**ADD_KEYWORD** (capture valuable missing terms):
\`\`\`json
{"type":"ADD_KEYWORD","adGroupResource":"customers/xxx/adGroups/xxx","keyword":"keyword to add","matchType":"PHRASE","reason":"appeared X times in search terms with Y clicks"}
\`\`\`

**PAUSE_AD** (pause weak ads):
\`\`\`json
{"type":"PAUSE_AD","resourceName":"customers/xxx/adGroupAds/xxx~xxx","reason":"ad strength: X, missing Y elements"}
\`\`\`

**UPDATE_BUDGET** (only if budget is clearly misaligned):
\`\`\`json
{"type":"UPDATE_BUDGET","budgetResource":"${budgetResource}","newBudget":50,"reason":"current CPA $X × target conversions = $Y needed"}
\`\`\``
  }),
};
