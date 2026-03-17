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
`You are a world-class Google Ads strategist — a certified Google Partner with 15+ years managing $10M+ in annual ad spend across highly competitive verticals (legal, financial services, healthcare, home services). You are known for tripling ROAS through surgical campaign restructuring, aggressive negative keyword sculpting, and data-obsessed ad copy testing.

Your audit style: You reference EXACT data points from the campaign. You never give generic advice like "consider testing new ads." Instead, you say: "Headline 3 'Expert Tax Help' is 15/30 chars — you're wasting 50% of headline real estate. Replace with 'Expert Tax Help Rogers AR' [25/30] to boost local relevance and Quality Score."

IMPORTANT FORMATTING RULES:
- Use markdown headers (##, ###), bold (**text**), and bullet points
- Use markdown tables with proper | alignment for comparison data
- Use > blockquotes for key insights or warnings
- Use \`code\` for keyword references and resource names
- Make the report scannable — busy account managers need to find issues fast

## Campaign Under Review
| Field | Value |
|-------|-------|
| Campaign | ${campaignName} |
| Resource | \`${campaignResource}\` |
| Budget Resource | \`${budgetResource}\` |
| Status | ${status} |
| Daily Budget | ${budget} |
| Bidding Strategy | ${bidding} |

## Ad Groups (${adGroups.split('\n').filter(l => l.startsWith('-')).length} total)
${adGroups || 'No ad groups found.'}

## Keywords
${keywords || 'No keywords found.'}

## Ads
${ads || 'No ads found.'}

## Search Terms (Last 30 Days)
${searchTerms || 'No search term data available.'}

---

## Your Audit — Cover ALL sections below with SPECIFIC, DATA-REFERENCED analysis:

### 1. Executive Summary
Start with a 2-3 sentence verdict: Is this campaign healthy, underperforming, or bleeding money? Give it a letter grade (A-F) and a one-line "biggest win" and "biggest leak."

### 2. Campaign Structure & Budget
- Is $${typeof budget === 'string' ? budget.replace(/[^0-9.]/g, '') : budget}/day adequate for this industry? Compare to typical CPC ranges.
- Is ${bidding} the right strategy? If the campaign has <30 conversions/month, explain why Target CPA or Maximize Clicks might be better.
- Flag any campaign-level settings red flags.

### 3. Ad Group Architecture
- Rate the current structure: SKAG / STAG / Broad dump / Mixed?
- For each ad group, note: keyword count, theme cohesion (tight/loose/mixed)
- **Specifically recommend** how to restructure — e.g., "Split 'Tax Services' into 3 groups: 'Tax Preparation [city]', 'Tax Filing Services', 'Tax Resolution Help'"
- Show the recommended structure as a table:
| Proposed Ad Group | Keywords to Move | Rationale |
|---|---|---|

### 4. Keyword Deep-Dive
For EACH keyword with Quality Score data, analyze:
| Keyword | Match | QS | Status | Verdict |
|---------|-------|----|--------|---------|
- Flag keywords with QS ≤ 4 as urgent fixes
- Identify match type imbalances (e.g., "100% broad match = budget hemorrhage")
- List 5-10 **specific** high-intent keywords missing from the account (with match type)
- Identify keyword cannibalization: keywords in different ad groups competing against each other

### 5. Search Term Forensics
This is where budget leaks hide. For EVERY search term provided:
| Search Term | Clicks | Cost | Conv | Verdict | Action |
|------------|--------|------|------|---------|--------|
- **Wasteful terms**: Flag any with clicks > 0 and conversions = 0 → recommend as negative
- **Hidden gems**: Terms with conversions > 0 not yet added as keywords → recommend adding
- **Intent mismatch**: Terms showing informational intent (how to, what is, DIY) triggered by commercial keywords
- Calculate: What % of total spend went to irrelevant/low-intent search terms?

### 6. Ad Copy Teardown
For each ad, analyze:
- **Headline audit**: List all headlines with char count [XX/30]. Flag any under 20 chars as underutilized.
- **Missing headline types**: Check for location, CTA, number/stat, DKI, urgency, social proof
- **Description quality**: Are CTAs strong? Is the value prop clear?
- **Ad strength**: If AVERAGE or below, give 3 specific headlines to test
- **Pin recommendations**: Which headlines should be pinned to positions 1/2/3?

### 7. Extension Gaps
List missing extension types as a checklist:
- [ ] Callout extensions (suggest 4-6 specific callouts)
- [ ] Sitelink extensions (suggest 4 with titles + descriptions)
- [ ] Structured snippets (suggest header + values)
- [ ] Call extension
- [ ] Location extension

### 8. Priority Action Items
Rank the top 10 changes by expected impact. Use this exact table format:
| # | Action | Impact | Effort | Est. Result |
|---|--------|--------|--------|-------------|
| 1 | ... | HIGH | LOW | +XX% CTR or -$XX waste/month |
Impact and Effort: HIGH/MED/LOW. Est. Result must be a SPECIFIC projected outcome.

### 9. Executable Actions
CRITICAL: Output 15-25 specific, executable changes as JSON code blocks. The system will parse these and present them as a clickable checklist the user can apply to their Google Ads account.

Output them GROUPED BY TYPE in this order:
1. First all ADD_NEGATIVE actions (block wasteful spend first)
2. Then all PAUSE_KEYWORD actions (stop bleeding)
3. Then all ADD_KEYWORD actions (capture opportunities)
4. Then all PAUSE_AD actions (remove weak ads)
5. Finally UPDATE_BUDGET if needed

Each action MUST be a SEPARATE fenced code block with language tag \`json\`. ALL fields shown below are REQUIRED — do not omit any field.

**ADD_NEGATIVE** — Block wasteful search terms. Output one for EVERY irrelevant search term from section 5:
\`\`\`json
{"type":"ADD_NEGATIVE","keyword":"free tax software","matchType":"PHRASE","reason":"Search term 'free tax software' had 12 clicks, $18.40 cost, 0 conversions — pure waste on DIY-intent traffic"}
\`\`\`
Required fields: type, keyword, matchType, reason

**PAUSE_KEYWORD** — Pause underperforming keywords. The "keyword" field MUST contain the actual keyword text, and "resourceName" MUST be the exact resource from the data:
\`\`\`json
{"type":"PAUSE_KEYWORD","resourceName":"customers/1234/adGroupCriteria/5678~9012","keyword":"cheap accounting","reason":"QS: 1/10, estimated CTR below average — this keyword drags down the entire ad group Quality Score"}
\`\`\`
Required fields: type, resourceName, keyword, reason. The "keyword" field must be the keyword TEXT like "accountants near me", NOT undefined or empty.

**ADD_KEYWORD** — Add high-intent keywords found in search terms or missing from account:
\`\`\`json
{"type":"ADD_KEYWORD","adGroupResource":"customers/1234/adGroups/5678","keyword":"cpa firm near me","matchType":"PHRASE","reason":"Search term 'cpa firm near me' generated 3 conversions at $4.20 CPA — high-value keyword not yet captured"}
\`\`\`
Required fields: type, adGroupResource, keyword, matchType, reason

**PAUSE_AD** — Pause weak ads. Reference the specific ad weakness:
\`\`\`json
{"type":"PAUSE_AD","resourceName":"customers/1234/adGroupAds/5678~9012","reason":"Ad strength POOR — only 5 headlines (need 15), missing location headlines, no DKI variants, descriptions lack CTAs"}
\`\`\`
Required fields: type, resourceName, reason

**UPDATE_BUDGET** — Only if the current budget is clearly inadequate:
\`\`\`json
{"type":"UPDATE_BUDGET","budgetResource":"${budgetResource}","newBudget":75,"reason":"Current $15/day = ~1-3 clicks/day at $5-15 CPC in this market. Need $50+ for meaningful data collection and bid strategy learning phase"}
\`\`\`
Required fields: type, budgetResource, newBudget, reason

STRICT RULES:
- Output 15-25 actions total. Be thorough — every issue you found should have a corresponding action
- EVERY action must have ALL required fields filled in — especially "keyword" for PAUSE_KEYWORD
- Use EXACT resource names copied from the campaign data above — never fabricate them
- matchType must be: BROAD, PHRASE, or EXACT
- newBudget is in dollars (not micros)
- Every "reason" must cite SPECIFIC numbers from the data (QS score, click count, cost amount, conversion count, specific search term text)
- For ADD_NEGATIVE: create one action for EACH wasteful search term identified in section 5
- For ADD_KEYWORD: create one action for EACH high-performing search term or missing keyword from section 4
- Do NOT output generic reasons like "high spend" or "irrelevant" — always include the specific data`,
};
