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
};

export const CATEGORIES = [
  'Accounting & CPA Firm', 'Tax Preparation', 'Bookkeeping',
  'Financial Advisory', 'Law Firm', 'Medical Practice',
  'Dental Office', 'Insurance Agency', 'Real Estate Agency',
  'Home Services', 'Restaurant', 'Other',
];

// ── Expert AI Prompt Templates ──

export const PROMPTS = {
  keywords: ({ count, name, loc, cat, svc, aud, usp, matchType }) =>
`You are a Google Ads expert with 10+ years managing search campaigns. Generate ${count} high-performance Google Ads keywords.

## Business Context
- Business: ${name}
- Location: ${loc}
- Category: ${cat}
- Services: ${svc}
- Target Audience: ${aud}
- USPs: ${usp}
- Match Type: ${matchType}

## Requirements
1. **Keyword Structure**: Organize into tightly-themed ad groups (STAG structure — Single Theme Ad Groups) for optimal Quality Score. Each group should have 5-15 keywords sharing a common theme.

2. **Match Type Format**: Output each keyword with its match type:
   - Broad Match: keyword phrase
   - "Phrase Match": "keyword phrase"
   - [Exact Match]: [keyword phrase]
   ${matchType === 'ALL' ? 'Include all three match types for high-intent keywords.' : `Focus on ${matchType} match.`}

3. **Search Intent Tiers** — Mark each keyword:
   - **TRANSACTIONAL** (ready to buy/hire): "hire accountant austin", [cpa near me]
   - **COMMERCIAL** (comparing options): "best tax preparer austin tx", [top rated cpa firms]
   - **INFORMATIONAL** (researching): "how much does tax prep cost"
   - Prioritize TRANSACTIONAL and COMMERCIAL keywords (70%+ of output)

4. **Keyword Types to Include**:
   - Location-specific combos (city + service, neighborhood + service)
   - "Near me" variants
   - Competitor-alternative keywords (e.g., "affordable [service] [location]")
   - Long-tail phrases (4+ words) for lower CPC
   - Seasonal/timely variants if applicable
   - Problem-aware keywords (e.g., "owe irs back taxes help")

5. **Quality Score Optimization**:
   - Each ad group's keywords should tightly match a single landing page topic
   - Include the primary keyword in suggested ad group name
   - Flag any keywords that might need their own dedicated landing page

6. **Estimated Metrics** (per keyword):
   - Search Volume: HIGH / MED / LOW
   - Competition: HIGH / MED / LOW
   - Est. CPC Range: $X - $Y
   - Intent: TRANSACTIONAL / COMMERCIAL / INFORMATIONAL

7. **Negative Keyword Suggestions**: For each ad group, suggest 3-5 negative keywords to prevent overlap with sibling groups.

## Output Format
Group by ad group theme. For each group:
### [Ad Group Name]
- keyword (Match Type) | Intent: X | Vol: X | Comp: X | CPC: $X-$Y
- Suggested negatives for this group: [list]`,

  adCopy: ({ format, name, loc, svc, usp, tone }) =>
`You are a Google Ads copywriting expert specializing in high-CTR search ads. Create ${format} Google Ads copy.

## Business Context
- Business: ${name}
- Location: ${loc}
- Services: ${svc}
- USPs: ${usp}
- Tone: ${tone}

## RSA Requirements (Responsive Search Ads)
Generate **15 Headlines** (each ≤30 characters) and **4 Descriptions** (each ≤90 characters).

### Headline Diversity Rules (CRITICAL):
- 3+ headlines with unique value propositions
- 2+ headlines with strong CTAs ("Get Quote Today", "Call Now", "Book Free Consult")
- 2+ headlines with location ("${loc}", "Local ${loc} Expert")
- 2+ headlines with numbers/stats ("15+ Years Exp", "500+ Clients")
- 2+ headlines using Dynamic Keyword Insertion: {KeyWord:Default Text}
- 1+ headline with urgency/scarcity ("Limited Spots", "Tax Deadline Approaching")
- 1+ headline with social proof ("Top-Rated", "5-Star Reviews")

### Pin Strategy Recommendations:
- Mark which headlines to pin to Position 1 (brand/main value prop)
- Mark which headlines to pin to Position 2 (differentiator/CTA)
- Mark which headlines to pin to Position 3 (location/trust signal)
- Leave remaining headlines unpinned for Google's optimization

### Description Requirements:
- D1: Primary value prop + CTA + differentiator
- D2: Services overview + trust signal
- D3: Specific offer/promotion + urgency
- D4: Problem-solution angle + CTA

### Character Count:
Show [XX/30] for each headline, [XX/90] for each description.

## Ad Extensions
- **6 Callout Extensions** (≤25 chars each): Key benefits/features
- **4 Sitelink Titles** (≤25 chars) + Descriptions (≤35 chars): Link to specific pages
- **4 Structured Snippets**: Service types, amenities, or offerings

## Emotional Triggers to Incorporate:
- Trust: credentials, years in business, reviews
- Urgency: deadlines, limited availability
- Value: free consultation, no hidden fees
- Authority: certifications, awards, specializations`,

  negatives: ({ cat, svc, loc }) =>
`You are a Google Ads negative keyword specialist. Generate 80 negative keywords for a ${cat || 'professional services'} business offering ${svc} in ${loc}.

## Categories to Cover:
1. **Job/Career seekers**: job, career, salary, hiring, resume, interview, internship, volunteer
2. **DIY/Self-service**: DIY, how to, template, free, tutorial, course, learn, training
3. **Software/Tools**: software, app, tool, download, plugin, excel, quickbooks (unless it's a service)
4. **Academic/Research**: research, study, thesis, academic, university, college, professor
5. **Unrelated services**: services not offered by this business
6. **Competitor brands**: specific competitor names (mark as optional — client should review)
7. **Geographic exclusions**: cities/states far from service area
8. **Low-intent modifiers**: what is, definition, meaning, history, wiki, reddit, forum

## Format:
Output in two match types:
- [exact match] — for precise terms
- "phrase match" — for broader patterns

## Organization:
Group by category with clear headers. Include 8-12 keywords per category.`,

  keywordResearch: ({ count, niche, focus, matchType }) =>
`You are a Google Ads keyword research expert. Generate ${count} keywords for: ${niche}${focus ? ` — focus: ${focus}` : ''}.

## Requirements:
- Match type: ${matchType}
- Include for each keyword:
  - Search Intent: Commercial / Transactional / Informational / Navigational
  - Competition Level: HIGH / MED / LOW
  - Estimated CPC Range: $X - $Y
  - Search Volume Tier: HIGH (10K+) / MED (1K-10K) / LOW (<1K)
  - Seasonal Trend: Evergreen / Q1-Peak / Q4-Peak / Summer-Peak (if applicable)
- Group by theme/topic cluster
- Include long-tail variations (4+ words)
- Include question-based keywords ("how much does...", "best way to...")
- Flag high-opportunity keywords (low competition + high intent)`,

  adCopyStandalone: ({ format, name, service, location, usp, tone }) =>
`Create ${format} Google Ads copy for ${name} offering ${service} in ${location}.
USP: ${usp}. Tone: ${tone}.

Follow all character limits strictly. Show character count for each element.
Include Dynamic Keyword Insertion variants where appropriate: {KeyWord:Default Text}

For RSA: 15 Headlines (≤30 chars) + 4 Descriptions (≤90 chars) with pin recommendations.
Include: 6 callout extensions (≤25 chars) + 4 sitelink titles with descriptions.`,

  bidStrategy: ({ goal, budget, industry }) =>
`You are a Google Ads bidding strategy expert. Recommend the optimal bidding strategy.

## Context:
- Campaign Goal: ${goal}
- Daily Budget: $${budget}
- Industry: ${industry}

## Provide:
1. **Recommended Strategy** with reasoning
2. **Initial Settings** (target CPA, target ROAS, max CPC, etc.)
3. **Ramp-up Plan** (how to transition from learning phase to optimization)
4. **Warning Signs** to watch for (overspending, low conversion rate, etc.)
5. **When to Switch** strategies based on data thresholds`,

  landingPage: ({ url, services, keywords }) =>
`You are a Google Ads Quality Score optimization expert. Analyze this landing page context and suggest improvements.

## Landing Page: ${url}
## Services Advertised: ${services}
## Target Keywords: ${keywords}

## Provide:
1. **Keyword-to-page relevance** assessment
2. **Above-the-fold** recommendations (headline, CTA, trust signals)
3. **Content gaps** that hurt Quality Score
4. **Technical suggestions** (page speed, mobile optimization)
5. **CTA optimization** recommendations`,
};
