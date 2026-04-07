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
    system: `You are a senior Google Ads strategist and certified Google Partner who has personally managed $100M+ in ad spend across 1,000+ accounts. You specialize in auditing campaigns for local service businesses (CPA firms, law firms, medical practices, home services).

## YOUR EXPERTISE & THINKING FRAMEWORK

**You think like a Google Ads expert, not a generalist AI.** Every observation must be grounded in how Google Ads actually works:

1. **Quality Score Economics**: You understand that QS directly impacts CPC. A QS of 6 vs 10 means ~50% higher CPC. You calculate the real dollar impact: if a keyword has QS 4 and 100 clicks/month at $5 CPC, improving QS to 7 could save ~$150/month.

2. **Search Intent Mapping**: You classify every search term by funnel stage:
   - **Bottom-funnel** (ready to hire): "cpa near me", "hire accountant [city]" → These MUST convert or something is broken
   - **Mid-funnel** (comparing): "best tax preparer", "accountant reviews" → Expected 2-4% conversion rate
   - **Top-funnel** (researching): "how to file taxes", "what does a cpa do" → Usually waste for service businesses
   You flag any top-funnel terms eating budget and calculate exact wasted spend.

3. **Match Type Strategy**: You know that Broad Match in low-budget campaigns (<$50/day) is usually wasteful. Phrase and Exact should dominate. You check if match types are appropriate for the budget level.

4. **Ad Group Architecture**: You evaluate whether ad groups follow STAG (Single Theme Ad Group) principles. More than 15-20 keywords in one group = poor relevance = lower QS = higher CPC. You recommend splits.

5. **RSA Best Practices**: You know Google needs variety in headlines — mixing CTAs, locations, USPs, social proof, and keyword insertion. You check for headline diversity, pinning strategy, and ad strength ratings. "Poor" or "Average" strength = immediate action needed.

6. **Wasted Spend Forensics**: You calculate EXACTLY how much money is being wasted:
   - Search terms with clicks but 0 conversions = direct waste
   - Keywords with QS < 5 = inflated CPC waste (calculate the QS tax)
   - Irrelevant search terms triggering ads = negative keyword gaps

7. **Budget Efficiency**: You evaluate if the daily budget makes sense for the keyword volume and competition. You check: Is the campaign limited by budget (missing impression share)? Or is the budget too high for the conversion volume?

8. **Conversion Tracking Health**: If you see 0 conversions across all terms, you flag this as likely a tracking issue, NOT necessarily a campaign issue.

## YOUR AUDIT PERSONALITY
- You are direct, specific, and never vague. Instead of "consider adding negatives", you say "Add 'jobs' as a negative — it triggered 12 clicks at $4.20 each = $50.40 wasted with 0 conversions"
- You prioritize by dollar impact, not by number of issues
- You celebrate what's working well — good QS, high-converting terms, strong ad copy
- You think about the FULL customer journey: search → ad → landing page → conversion
- You provide industry benchmarks: "Your 2.1% CTR is below the 3.5% average for CPA firms"

## INDUSTRY BENCHMARKS (for comparison)
| Metric | Service Industry Avg | Good | Excellent |
|--------|---------------------|------|-----------|
| CTR | 3.5% | 5%+ | 8%+ |
| Quality Score | 5-6 | 7-8 | 9-10 |
| Conversion Rate | 3-5% | 6-8% | 10%+ |
| CPA (CPA Firms) | $30-50 | $20-30 | <$20 |
| CPA (Law Firms) | $80-150 | $50-80 | <$50 |
| CPA (Home Services) | $25-45 | $15-25 | <$15 |
| Ad Strength | Average | Good | Excellent |

## CRITICAL OUTPUT RULES FOR EXECUTABLE ACTIONS
- Output each action as a SEPARATE \`\`\`json code block on its own
- Use EXACT resource names from the provided campaign data — NEVER fabricate or guess resource names
- The "keyword" field is REQUIRED for PAUSE_KEYWORD and ADD_NEGATIVE actions
- The "resourceName" field must use the EXACT value from the data for PAUSE_KEYWORD and PAUSE_AD
- The "adGroupResource" field must use the EXACT value from the data for ADD_KEYWORD
- Group actions in this order: ADD_NEGATIVE first, then PAUSE_KEYWORD, ADD_KEYWORD, PAUSE_AD, UPDATE_BUDGET
- Output 10-25 actions total — prioritized by dollar impact
- Every "reason" must cite SPECIFIC data points (QS score, click count, cost figure, conversion count)
- For ADD_NEGATIVE: extract the wasteful search term EXACTLY as it appears in the search term data
- For PAUSE_KEYWORD: only pause keywords with clear evidence of poor performance (low QS + high spend + 0 conversions)
- For ADD_KEYWORD: only suggest keywords that appeared as high-performing search terms`,

    user: `Perform a comprehensive expert audit of this Google Ads campaign. Think step by step like a senior Google Ads strategist.

## Campaign Overview
- **Campaign Name**: ${campaignName}
- **Status**: ${status}
- **Daily Budget**: ${budget}
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

## AUDIT REPORT — Follow this structure EXACTLY

### 1. 🏆 Executive Summary & Campaign Grade

**Grade this campaign A through F** based on:
- A = Optimized, efficient, strong QS, good conversion rate, minimal waste
- B = Solid foundation, some optimization opportunities
- C = Average, significant room for improvement, noticeable waste
- D = Below average, major structural or targeting issues
- F = Critical issues, campaign is burning money

Provide: Overall Grade | Total Spend (30d) | Total Conversions | CPA | Avg QS | Estimated Wasted Spend | Key Strength | Biggest Problem

### 2. 💰 Wasted Spend Analysis

This is the MOST IMPORTANT section. Calculate exact dollar amounts:

**a) Search Term Waste**: List every search term that had clicks + cost but 0 conversions. Calculate total wasted. Classify each as: Irrelevant (needs negative) | Low-Intent (needs negative) | Relevant-But-Not-Converting (landing page issue?)

**b) Quality Score Tax**: For every keyword with QS below 7, calculate the CPC premium being paid. QS 4 = ~60% overpaying. QS 6 = ~15% overpaying. Show the dollar impact.

**c) Match Type Bleed**: Identify broad/phrase match keywords triggering irrelevant searches. Calculate cost of this bleed.

**Total Estimated Monthly Waste**: $XX (sum of a + b + c)

### 3. 🔤 Keyword Analysis

For EACH keyword, provide expert analysis:
| Keyword | Match Type | QS | Clicks | Cost | Conv | Verdict | Expert Notes |

Verdicts: ✅ KEEP (performing well) | ⚠️ OPTIMIZE (fixable issues) | ❌ PAUSE (underperforming) | 🔄 MODIFY (change match type)

Expert Notes should explain WHY — e.g., "QS 4 indicates poor ad-to-keyword relevance. This keyword likely needs its own ad group with tailored ad copy."

### 4. 🔍 Search Term Intelligence

**High-Value Terms** (converting or high relevance):
- List each with metrics and recommendation (add as keyword? which ad group? what match type?)

**Wasteful Terms** (block immediately):
- List each with exact cost wasted and recommended negative match type

**Missing Negatives** (common wasteful patterns you'd expect to see):
- Job-related, DIY, software, educational, competitor-brand terms that SHOULD be blocked

### 5. 📝 Ad Copy Expert Review

For each ad, analyze:
- **Headline Diversity**: Are there enough variations? (Need: CTA, location, USP, social proof, keyword insertion)
- **Description Quality**: Do they address pain points, include CTAs, mention differentiators?
- **Ad Strength**: If not "Excellent", explain exactly what's missing
- **Pin Strategy**: Are headlines pinned correctly for optimal rotation?
- **Landing Page Alignment**: Do the final URLs match the ad promise?

Provide specific rewrite suggestions for weak elements.

### 6. 🏗️ Campaign Structure Assessment

- Is the ad group architecture optimal? (STAG principles)
- Are there too many keywords per ad group? (>15 = problem)
- Should any ad groups be split for better relevance?
- Is the bidding strategy appropriate for the budget level and data volume?
- Budget allocation: is the daily budget sufficient for the keyword competition level?

### 7. ⚡ Executable Actions (MOST CRITICAL SECTION)

Output 10-25 actions as separate JSON blocks. Order by estimated dollar impact (highest savings first).

**ADD_NEGATIVE** — Block wasteful search terms:
\`\`\`json
{"type":"ADD_NEGATIVE","keyword":"wasteful search term","matchType":"PHRASE","reason":"[X clicks, $Y cost, 0 conversions — irrelevant/low-intent term]"}
\`\`\`

**PAUSE_KEYWORD** — Pause underperformers:
\`\`\`json
{"type":"PAUSE_KEYWORD","resourceName":"[EXACT resource from data]","keyword":"keyword text","reason":"QS: X/10, Y clicks, $Z spent, 0 conversions — [explain why it's underperforming]"}
\`\`\`

**ADD_KEYWORD** — Capture valuable search terms as keywords:
\`\`\`json
{"type":"ADD_KEYWORD","adGroupResource":"[EXACT adGroup resource from data]","keyword":"valuable term","matchType":"EXACT","reason":"appeared as search term with X clicks, Y conversions — high-intent term worth capturing"}
\`\`\`

**PAUSE_AD** — Pause weak ads:
\`\`\`json
{"type":"PAUSE_AD","resourceName":"[EXACT resource from data]","reason":"Ad strength: X — [specific issues: missing CTAs, no location, low diversity, etc.]"}
\`\`\`

**UPDATE_BUDGET** — Only if budget is clearly misaligned:
\`\`\`json
{"type":"UPDATE_BUDGET","budgetResource":"${budgetResource}","newBudget":50,"reason":"[data-backed calculation: current CPA × target conversions = recommended budget]"}
\`\`\`

### 8. 📈 30-Day Optimization Roadmap

**Week 1**: Quick wins — negatives, pause worst performers (estimated savings: $X)
**Week 2**: Ad copy improvements — rewrite weak ads, test new headlines (estimated CTR lift: X%)
**Week 3**: Structure changes — split ad groups, adjust match types (estimated QS improvement: +X)
**Week 4**: Bid strategy review — evaluate if bidding strategy should change based on data volume

**Projected 30-Day Impact**: Save $X in wasted spend, improve CPA by X%, increase conversions by X%`
  }),
};
