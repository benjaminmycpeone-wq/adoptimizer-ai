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

  campaignReview: ({ campaignName, status, budget, bidding, campaignResource, budgetResource, adGroups, keywords, ads, searchTerms }) =>
`You are a senior Google Ads strategist and certified Google Ads expert with 15+ years managing multi-million dollar search campaigns across competitive industries. You have deep expertise in Quality Score optimization, SKAG/STAG ad group architecture, RSA best practices, bid strategy selection, and negative keyword sculpting.

Perform a comprehensive, data-driven audit of this campaign. Every recommendation must reference specific data from the campaign below — no generic advice.

## Campaign Data
- Campaign: ${campaignName}
- Resource: ${campaignResource}
- Budget Resource: ${budgetResource}
- Status: ${status}
- Daily Budget: ${budget}
- Bidding Strategy: ${bidding}

## Ad Groups (${adGroups.split('\n').filter(l => l.startsWith('-')).length} total)
${adGroups || 'No ad groups found.'}

## Keywords
${keywords || 'No keywords found.'}

## Ads
${ads || 'No ads found.'}

## Search Terms (Last 30 Days)
${searchTerms || 'No search term data available.'}

## Audit Sections — Provide ALL of these:

### 1. Campaign Structure Assessment
- Budget adequacy for the industry/competition level
- Bidding strategy appropriateness for the campaign goal
- Campaign settings red flags or missed opportunities

### 2. Ad Group Architecture
- Theme cohesion — are keywords tightly grouped by theme?
- Number of keywords per ad group (ideal: 5-20)
- Missing ad group opportunities
- STAG/SKAG structure assessment

### 3. Keyword Analysis
- Match type distribution and recommendations
- Negative keyword gaps — suggest 10+ negatives they should add
- Search intent coverage (transactional vs informational ratio)
- Quality Score drivers and issues
- Missing high-intent keyword opportunities
- Keyword cannibalization between ad groups

### 4. Search Term Analysis
- Irrelevant search terms wasting budget — flag any that should be added as negatives
- High-performing search terms not yet added as keywords — recommend adding them
- Search term to keyword match quality — are broad match keywords triggering too many irrelevant queries?
- Cost analysis — identify search terms with high cost but zero conversions
- Search intent patterns — what are users actually searching for vs what you're targeting?

### 5. Ad Copy Review
- RSA headline diversity (value props, CTAs, locations, numbers, DKI)
- Description quality and CTA strength
- Character limit utilization
- Pin strategy assessment
- Ad strength indicators and how to improve

### 6. Extension Audit
- Missing extension types (callouts, sitelinks, structured snippets, call extensions)
- Extension quality and relevance recommendations

### 7. Priority Action Items
List the top 10 recommendations ranked by expected impact:
| # | Action | Impact | Effort | Expected Result |
|---|--------|--------|--------|-----------------|
Use HIGH/MED/LOW for Impact and Effort columns.

### 8. Executable Actions
CRITICAL: After your analysis, output specific executable changes as JSON code blocks. These will be parsed by the system and presented to the user as a checklist they can apply directly to their Google Ads account.

Each action MUST be a separate fenced code block with the language tag \`json\`. Use ONLY these action types:

**ADD_NEGATIVE** — Add a negative keyword to the campaign:
\`\`\`json
{"type":"ADD_NEGATIVE","keyword":"free tax software","matchType":"PHRASE","reason":"Attracts DIY users, wastes budget on non-buyers"}
\`\`\`

**PAUSE_KEYWORD** — Pause an underperforming keyword (use exact resourceName from the data above):
\`\`\`json
{"type":"PAUSE_KEYWORD","resourceName":"customers/1234/adGroupCriteria/5678~9012","keyword":"cheap accounting","reason":"Low intent, likely poor Quality Score"}
\`\`\`

**ADD_KEYWORD** — Add a new keyword to an existing ad group (use exact adGroupResource from the data above):
\`\`\`json
{"type":"ADD_KEYWORD","adGroupResource":"customers/1234/adGroups/5678","keyword":"cpa firm near me","matchType":"PHRASE","reason":"High-intent local keyword missing from account"}
\`\`\`

**PAUSE_AD** — Pause a weak ad (use exact resourceName from the data above):
\`\`\`json
{"type":"PAUSE_AD","resourceName":"customers/1234/adGroupAds/5678~9012","reason":"Ad strength is POOR, dragging down ad group performance"}
\`\`\`

**UPDATE_BUDGET** — Change the daily budget (use exact budgetResource from data above):
\`\`\`json
{"type":"UPDATE_BUDGET","budgetResource":"${budgetResource}","newBudget":75,"reason":"Current budget too low for competitive CPA market"}
\`\`\`

Rules for executable actions:
- Output 5-15 actions, prioritized by impact
- Use EXACT resource names from the campaign data above — do not make up resource names
- matchType must be one of: BROAD, PHRASE, EXACT
- newBudget is in dollars (not micros)
- Every action must have a clear "reason" explaining why`,
};
