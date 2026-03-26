import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../store';
import { CATEGORIES, PROMPTS, BUDGET_SUGGESTIONS } from '../constants';
import WizardSteps from '../components/WizardSteps';
import TabPanel from '../components/TabPanel';
import AiOutput from '../components/AiOutput';
import AlertBanner from '../components/AlertBanner';
import { callAI, saveCampaign } from '../api';
import { getToken, gads } from '../auth';

// ── Parse JSON blocks from AI strategy output ──
function parsePlanBlocks(text) {
  const blocks = [];
  const regex = /```json\s*\n?([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.type) blocks.push(parsed);
    } catch { /* skip malformed */ }
  }
  return blocks;
}

function buildPlanFromBlocks(blocks) {
  const plan = {
    settings: null,
    adGroups: [],
    adCopies: [],
    negatives: null,
    extensions: null,
  };
  for (const b of blocks) {
    switch (b.type) {
      case 'CAMPAIGN_SETTINGS': plan.settings = b; break;
      case 'AD_GROUP': plan.adGroups.push(b); break;
      case 'AD_COPY': plan.adCopies.push(b); break;
      case 'NEGATIVES': plan.negatives = b; break;
      case 'EXTENSIONS': plan.extensions = b; break;
    }
  }
  return plan;
}

export default function Builder() {
  const { builder, setBuilder, scrapeResult, incStat, log } = useStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // AI strategy state
  const [strategyText, setStrategyText] = useState('');
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [plan, setPlan] = useState(null);

  // Legacy AI generation (still available as tabs)
  const [kwText, setKwText] = useState('');
  const [adText, setAdText] = useState('');
  const [negText, setNegText] = useState('');
  const [kwLoading, setKwLoading] = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const [negLoading, setNegLoading] = useState(false);
  const [matchType, setMatchType] = useState('ALL');
  const [kwCount, setKwCount] = useState('40');
  const [adFormat, setAdFormat] = useState('RSA');
  const [adTone, setAdTone] = useState('Professional');

  // Launch state
  const [launchStatus, setLaunchStatus] = useState(null);
  const [launching, setLaunching] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const b = builder;
  const setB = (field, val) => setBuilder({ [field]: val });
  const suggestion = BUDGET_SUGGESTIONS[b.cat] || null;

  // ── AI Campaign Strategist (one-shot) ──
  const generateStrategy = async () => {
    setStrategyLoading(true);
    setStrategyText('');
    setPlan(null);

    // Build scrape data from whatever we have
    const scrapeData = scrapeResult || {
      firmName: b.name, category: b.cat, websiteUrl: b.website,
      locations: b.targetLocations ? b.targetLocations.split(';').map(s => s.trim()) : [b.loc],
      services: b.svc ? b.svc.split(',').map(s => s.trim()) : [],
      targetAudience: b.aud ? b.aud.split(',').map(s => s.trim()) : [],
      usps: b.usp ? b.usp.split(',').map(s => s.trim()) : [],
      competitiveAngles: b.usp ? b.usp.split(',').map(s => s.trim()) : [],
      ctaPatterns: [], pricingSignals: [],
      landingPageQuality: { score: 0, hasForm: false, hasPhone: false, hasCTA: false },
      summary: '', headings: [], rawText: `${b.name} offering ${b.svc} in ${b.loc}.`,
    };

    const { system, user } = PROMPTS.campaignStrategy(scrapeData);
    try {
      const result = await callAI(user, (_, full) => {
        setStrategyText(full);
        // Live-parse plan as AI streams
        const blocks = parsePlanBlocks(full);
        if (blocks.length > 0) setPlan(buildPlanFromBlocks(blocks));
      }, { maxTokens: 12000, system });
      setStrategyText(result);
      const blocks = parsePlanBlocks(result);
      const finalPlan = buildPlanFromBlocks(blocks);
      setPlan(finalPlan);
      // Auto-fill campaign settings from AI — but NEVER override user-set budget/bidding
      if (finalPlan.settings) {
        const s = finalPlan.settings;
        setBuilder({
          campaignName: s.campaignName || b.campaignName,
          // Only fill locations/name — keep user's budget and bidding choices
          targetLocations: (s.locations || []).join(', ') || b.targetLocations,
        });
      }
      log('AI campaign strategy generated');
      useStore.getState().addToast('Campaign plan generated!', 'as');
    } catch (e) {
      setStrategyText('❌ ' + e.message);
    }
    setStrategyLoading(false);
  };

  // ── Legacy AI Generation (individual) ──
  const genKw = async () => {
    setKwLoading(true); setKwText('');
    const { system, user } = PROMPTS.keywords({ count: kwCount, name: b.name, loc: b.loc, cat: b.cat, svc: b.svc, aud: b.aud, usp: b.usp, matchType });
    try { const r = await callAI(user, (_, f) => setKwText(f), { system }); setKwText(r); incStat('k', parseInt(kwCount)); log('Keywords: ' + b.name); }
    catch (e) { setKwText('❌ ' + e.message); }
    setKwLoading(false);
  };
  const genAd = async () => {
    setAdLoading(true); setAdText('');
    const { system, user } = PROMPTS.adCopy({ format: adFormat, name: b.name, loc: b.loc, svc: b.svc, usp: b.usp, tone: adTone });
    try { const r = await callAI(user, (_, f) => setAdText(f), { system }); setAdText(r); incStat('a', 3); log('Ad copy: ' + b.name); }
    catch (e) { setAdText('❌ ' + e.message); }
    setAdLoading(false);
  };
  const genNeg = async () => {
    setNegLoading(true); setNegText('');
    const { system, user } = PROMPTS.negatives({ cat: b.cat, svc: b.svc, loc: b.loc });
    try { const r = await callAI(user, (_, f) => setNegText(f), { system }); setNegText(r); }
    catch (e) { setNegText('❌ ' + e.message); }
    setNegLoading(false);
  };

  // ── Parsing functions ──
  function parseKeywords(text) {
    return text.split('\n')
      .map(l => l.replace(/^\d+[.)]\s*/, '').replace(/^[-*•]\s*/, '').replace(/\*\*/g, ''))
      .filter(l => l.trim() && !l.match(/^[=#—►]/))
      .slice(0, 50)
      .map(line => {
        const txt = line.replace(/\[|\]|"/g, '').replace(/\(.*?\)/g, '')
          .replace(/HIGH|MED|LOW|TRANSACTIONAL|COMMERCIAL|INFORMATIONAL|intent|Vol:|Comp:|CPC:/gi, '')
          .split('|')[0].split('–')[0].split('—')[0]
          .trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').slice(0, 80);
        let mt = 'BROAD';
        if (line.trim().startsWith('[')) mt = 'EXACT';
        else if (line.trim().startsWith('"')) mt = 'PHRASE';
        return { text: txt, matchType: mt };
      })
      .filter(kw => kw.text.replace(/\s/g, '').length > 2);
  }

  function parseAdCopy(text) {
    const headlines = [], descriptions = [];
    for (const line of text.split('\n')) {
      const hl = line.match(/^(?:H\d+|Headline\s*#?\d*)[:\s]+(.+)/i);
      if (hl) { const h = hl[1].replace(/\[.*?\]/g, '').trim().slice(0, 30); if (h.length >= 3) headlines.push(h); }
      const dl = line.match(/^(?:D\d+|Description\s*#?\d*)[:\s]+(.+)/i);
      if (dl) { const d = dl[1].replace(/\[.*?\]/g, '').trim().slice(0, 90); if (d.length >= 10) descriptions.push(d); }
    }
    return { headlines: headlines.slice(0, 15), descriptions: descriptions.slice(0, 4) };
  }

  function parseNegatives(text) {
    return text.split('\n')
      .filter(l => l.trim() && (l.includes('[') || l.includes('"')))
      .slice(0, 100)
      .map(line => {
        const txt = line.replace(/\[|\]|"/g, '').replace(/\(.*?\)/g, '').trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').slice(0, 80);
        let mt = 'BROAD';
        if (line.trim().startsWith('[')) mt = 'EXACT';
        else if (line.trim().startsWith('"')) mt = 'PHRASE';
        return { text: txt, matchType: mt, isNegative: true };
      })
      .filter(kw => kw.text.replace(/\s/g, '').length > 2);
  }

  function groupKeywordsByTheme(keywords, text) {
    const groups = {};
    let currentGroup = 'General';
    for (const line of text.split('\n')) {
      const header = line.match(/^#{1,3}\s+(.+)/);
      if (header) { currentGroup = header[1].replace(/keywords?|ad\s*group/gi, '').trim() || 'General'; continue; }
      if (line.trim() && !line.match(/^[=#—►•\-\*]/) && !line.match(/^Suggested negative/i)) {
        if (!groups[currentGroup]) groups[currentGroup] = [];
        const kw = parseKeywords(line);
        if (kw.length) groups[currentGroup].push(...kw);
      }
    }
    if (Object.keys(groups).length === 0 || Object.values(groups).every(g => g.length === 0)) return { 'Main Keywords': keywords };
    return groups;
  }

  // ── Launch Campaign (supports both AI plan and legacy text) ──
  const launch = async () => {
    setLaunching(true);
    setShowConfirm(false);
    try {
      setLaunchStatus({ type: 'ai', msg: '⏳ Authenticating…' });
      await getToken();

      const name = b.campaignName || 'AdOptimizer Campaign';
      const budget = parseFloat(b.budget) || 50;
      const bidding = b.bidding;

      // 1. Create budget
      setLaunchStatus({ type: 'ai', msg: '⏳ Creating budget ($' + budget + '/day)…' });
      const br = await gads('campaignBudgets:mutate', {
        operations: [{ create: { name: `Budget-${name}-${Date.now()}`, amountMicros: String(Math.round(budget * 1e6)), deliveryMethod: 'STANDARD', explicitlyShared: false } }],
      });
      const budRN = br.results?.[0]?.resourceName;
      if (!budRN) throw new Error('Budget creation failed');

      // 2. Create campaign
      setLaunchStatus({ type: 'ai', msg: '⏳ Creating campaign…' });
      const cb = { name, status: 'PAUSED', advertisingChannelType: 'SEARCH', campaignBudget: budRN, networkSettings: { targetGoogleSearch: true, targetSearchNetwork: true, targetContentNetwork: false } };
      if (bidding === 'MAXIMIZE_CONVERSIONS') cb.maximizeConversions = {};
      else if (bidding === 'MAXIMIZE_CLICKS') cb.maximizeClicks = {};
      else if (bidding === 'MANUAL_CPC') cb.manualCpc = { enhancedCpcEnabled: true };
      else if (bidding === 'TARGET_CPA') cb.targetCpa = { targetCpaMicros: String(Math.round((parseFloat(b.targetCpa) || 5) * 1e6)) };
      const cr = await gads('campaigns:mutate', { operations: [{ create: cb }] });
      const campRN = cr.results?.[0]?.resourceName;
      if (!campRN) throw new Error('Campaign creation failed');

      // 3. Location targeting
      if (b.targetLocations) {
        setLaunchStatus({ type: 'ai', msg: '⏳ Setting location targets…' });
        try {
          const locs = b.targetLocations.split(/[,;]/).map(l => l.trim()).filter(Boolean);
          for (const loc of locs) {
            const suggestResp = await gads('geoTargetConstants:suggest', { locale: 'en', countryCode: 'US', locationNames: { names: [loc] } }, 'POST');
            const geoConst = suggestResp?.geoTargetConstantSuggestions?.[0]?.geoTargetConstant?.resourceName;
            if (geoConst) await gads('campaignCriteria:mutate', { operations: [{ create: { campaign: campRN, criterion: { location: { geoTargetConstant: geoConst } } } }] });
          }
        } catch (e) { console.warn('Geo targeting:', e.message); }
      }

      // 4. Determine keyword source: AI plan or legacy text
      let adGroupsToCreate = [];
      let adCopiesMap = {};
      let negKws = [];

      if (plan && plan.adGroups.length > 0) {
        // Use structured AI plan
        adGroupsToCreate = plan.adGroups.map(ag => ({
          name: ag.name,
          keywords: (ag.keywords || []).map(k => ({ text: k.text, matchType: k.matchType || 'PHRASE' })),
        }));
        for (const ac of (plan.adCopies || [])) {
          adCopiesMap[ac.adGroup] = { headlines: ac.headlines || [], descriptions: ac.descriptions || [] };
        }
        if (plan.negatives?.keywords) {
          negKws = plan.negatives.keywords.map(k => ({ text: k.text, matchType: k.matchType || 'PHRASE', isNegative: true }));
        }
      } else {
        // Fallback: legacy text parsing
        const allKw = parseKeywords(kwText);
        const kwGroups = groupKeywordsByTheme(allKw, kwText);
        for (const [gName, kws] of Object.entries(kwGroups)) {
          adGroupsToCreate.push({ name: gName, keywords: kws });
        }
        if (adText) {
          const parsed = parseAdCopy(adText);
          adGroupsToCreate.forEach(ag => { adCopiesMap[ag.name] = parsed; });
        }
        if (negText) negKws = parseNegatives(negText);
      }

      // 5. Create ad groups
      setLaunchStatus({ type: 'ai', msg: `⏳ Creating ${adGroupsToCreate.length} ad groups…` });
      const adGroupRNs = {};
      for (const ag of adGroupsToCreate.slice(0, 10)) {
        const agr = await gads('adGroups:mutate', {
          operations: [{ create: { name: `${name} - ${ag.name}`, campaign: campRN, status: 'ENABLED', type: 'SEARCH_STANDARD', cpcBidMicros: String(Math.round((parseFloat(b.cpcBid) || 2) * 1e6)) } }],
        });
        const agRN = agr.results?.[0]?.resourceName;
        if (agRN) adGroupRNs[ag.name] = { rn: agRN, keywords: ag.keywords };
      }

      // 6. Add keywords
      setLaunchStatus({ type: 'ai', msg: '⏳ Adding keywords…' });
      for (const [gName, { rn, keywords }] of Object.entries(adGroupRNs)) {
        const kwOps = keywords.slice(0, 25).map(kw => ({ create: { adGroup: rn, status: 'ENABLED', keyword: { text: kw.text, matchType: kw.matchType } } }));
        if (kwOps.length) await gads('adGroupCriteria:mutate', { operations: kwOps }).catch(e => console.warn('KW:', e.message));
      }

      // 7. Upload RSA ads
      setLaunchStatus({ type: 'ai', msg: '⏳ Uploading ad copy…' });
      for (const [gName, { rn }] of Object.entries(adGroupRNs)) {
        const copy = adCopiesMap[gName] || Object.values(adCopiesMap)[0];
        if (copy && copy.headlines?.length >= 3 && copy.descriptions?.length >= 1) {
          try {
            await gads('adGroupAds:mutate', {
              operations: [{ create: { adGroup: rn, status: 'ENABLED', ad: {
                responsiveSearchAd: {
                  headlines: copy.headlines.slice(0, 15).map((h, i) => ({ text: h.slice(0, 30), ...(i === 0 ? { pinnedField: 'HEADLINE_1' } : {}) })),
                  descriptions: copy.descriptions.slice(0, 4).map(d => ({ text: d.slice(0, 90) })),
                },
                finalUrls: [b.website || `https://${b.name.toLowerCase().replace(/\s/g, '')}.com`],
              } } }],
            });
          } catch (e) { console.warn('Ad upload:', e.message); }
        }
      }

      // 8. Negative keywords
      if (negKws.length) {
        setLaunchStatus({ type: 'ai', msg: '⏳ Adding negative keywords…' });
        const negOps = negKws.map(kw => ({ create: { campaign: campRN, keyword: { text: kw.text, matchType: kw.matchType }, negative: true } }));
        await gads('campaignCriteria:mutate', { operations: negOps }).catch(e => console.warn('Neg KW:', e.message));
      }

      // 9. Save to DB
      const campId = campRN?.split('/')?.[3] || '';
      await saveCampaign({
        name, googleCampaignId: campId, status: 'PAUSED',
        businessName: b.name, businessLocation: b.loc, businessCategory: b.cat,
        website: b.website, services: b.svc, targetAudience: b.aud, usps: b.usp,
        campaignGoal: b.goal, dailyBudget: budget, biddingStrategy: bidding,
        targetLocations: b.targetLocations, radiusMiles: b.radius,
        keywordsRaw: kwText || strategyText, adCopyRaw: adText || '', negativesRaw: negText || '',
      }).catch(() => {});

      const totalKws = Object.values(adGroupRNs).reduce((s, { keywords }) => s + keywords.length, 0);
      setLaunchStatus({
        type: 'as',
        msg: `✅ Campaign "${name}" created!\n\nID: ${campId} · Status: PAUSED\n` +
          `${Object.keys(adGroupRNs).length} ad groups · ${totalKws} keywords · Ads uploaded\n` +
          `Budget: $${budget}/day · Bidding: ${bidding}\nReview in Google Ads before enabling.`,
      });
      incStat('c');
      log('Launched: ' + name);
    } catch (e) {
      setLaunchStatus({ type: 'ae', msg: '❌ ' + e.message });
    }
    setLaunching(false);
  };

  const exportJSON = () => {
    const d = { business: { name: b.name, loc: b.loc, cat: b.cat, svc: b.svc, aud: b.aud, usp: b.usp }, campaign: { name: b.campaignName, goal: b.goal, budget: b.budget, bidding: b.bidding, locations: b.targetLocations }, plan, keywords: kwText, adCopy: adText, negatives: negText, exportedAt: new Date().toISOString() };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }));
    a.download = `campaign-${(b.name || 'export').replace(/\s/g, '-').toLowerCase()}-${Date.now()}.json`;
    a.click();
  };

  // Plan summary counts
  const planKwCount = plan ? plan.adGroups.reduce((s, ag) => s + (ag.keywords || []).length, 0) : 0;
  const planAdCount = plan ? plan.adCopies.length : 0;
  const planNegCount = plan?.negatives?.keywords?.length || 0;

  return (
    <>
      <WizardSteps current={step} onStep={setStep} />

      {/* ═══ Step 1: Business Info + Campaign Settings ═══ */}
      {step === 1 && (
        <div className="card card-gradient">
          <div className="ch">
            <div><div className="ct">Business & Campaign Setup</div><div className="cs">Auto-filled from scraper or enter manually</div></div>
            <button className="btn bs sm" onClick={() => navigate('/scraper')}>🔍 Analyze a Site</button>
          </div>

          <div className="fr">
            <div className="fg"><label>Business Name</label><input value={b.name} onChange={(e) => setB('name', e.target.value)} placeholder="Smith & Associates CPA" /></div>
            <div className="fg"><label>Location</label><input value={b.loc} onChange={(e) => setB('loc', e.target.value)} placeholder="Austin, TX" /></div>
          </div>
          <div className="fr">
            <div className="fg">
              <label>Category</label>
              <select value={b.cat} onChange={(e) => setB('cat', e.target.value)}>
                <option value="">Select category…</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="fg"><label>Website</label><input type="url" value={b.website} onChange={(e) => setB('website', e.target.value)} placeholder="https://smithcpa.com" /></div>
          </div>
          <div className="fg"><label>Services</label><input value={b.svc} onChange={(e) => setB('svc', e.target.value)} placeholder="Tax Prep, Bookkeeping, Payroll, IRS Representation" /></div>
          <div className="fg"><label>Target Audience</label><input value={b.aud} onChange={(e) => setB('aud', e.target.value)} placeholder="Small businesses, self-employed, real estate investors" /></div>
          <div className="fg"><label>USPs</label><textarea rows={2} value={b.usp} onChange={(e) => setB('usp', e.target.value)} placeholder="15+ years, free consultation, flat-fee pricing…" /></div>

          <div className="divider" />

          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 12 }}>Campaign Settings</div>

          <div className="fr">
            <div className="fg"><label>Campaign Name</label><input value={b.campaignName} onChange={(e) => setB('campaignName', e.target.value)} placeholder="Smith CPA – Tax Season 2025" /></div>
            <div className="fg">
              <label>Goal</label>
              <select value={b.goal} onChange={(e) => setB('goal', e.target.value)}>
                <option value="LEADS">Lead Generation</option>
                <option value="WEBSITE_TRAFFIC">Website Traffic</option>
                <option value="SALES">Sales / Conversions</option>
              </select>
            </div>
          </div>
          <div className="fr">
            <div className="fg">
              <label>Daily Budget</label>
              <div className="pfx"><span>$</span><input type="number" value={b.budget} onChange={(e) => setB('budget', e.target.value)} min="1" /></div>
            </div>
            <div className="fg">
              <label>Bidding Strategy</label>
              <select value={b.bidding} onChange={(e) => setB('bidding', e.target.value)}>
                <option value="MAXIMIZE_CONVERSIONS">Maximize Conversions</option>
                <option value="TARGET_CPA">Target CPA</option>
                <option value="MAXIMIZE_CLICKS">Maximize Clicks</option>
                <option value="MANUAL_CPC">Manual CPC</option>
              </select>
            </div>
          </div>

          {suggestion && (
            <div className="al ai" style={{ fontSize: 12 }}>
              💡 <b>{b.cat}</b>: Suggested ${suggestion.budget}/day with {suggestion.bidding.replace(/_/g, ' ')}. Typical CPA: {suggestion.cpa}.
              <button className="btn bs sm" style={{ marginLeft: 8 }} onClick={() => { setB('budget', suggestion.budget); setB('bidding', suggestion.bidding); }}>Use Suggestion</button>
            </div>
          )}

          <div className="fr">
            <div className="fg"><label>Target Locations</label><input value={b.targetLocations} onChange={(e) => setB('targetLocations', e.target.value)} placeholder="Austin TX, Round Rock TX" /></div>
            <div className="fg"><label>Radius (miles)</label><input type="number" value={b.radius} onChange={(e) => setB('radius', e.target.value)} min="1" max="500" /></div>
          </div>

          <button className="btn bp" onClick={() => setStep(2)}>Next: Generate Campaign Plan →</button>
        </div>
      )}

      {/* ═══ Step 2: AI Campaign Plan ═══ */}
      {step === 2 && (
        <div className="card">
          <div className="ch">
            <div><div className="ct">🤖 AI Campaign Strategist</div><div className="cs">One-click: generates complete campaign plan from your business data</div></div>
          </div>

          <button className="btn bp" onClick={generateStrategy} disabled={strategyLoading} style={{ marginBottom: 14 }}>
            {strategyLoading ? <><span className="spin" /> Generating campaign plan…</> : '⚡ Generate Complete Campaign Plan'}
          </button>

          {/* Show AI strategy output */}
          {(strategyText || strategyLoading) && (
            <AiOutput text={strategyText} id="strategy-o" streaming={strategyLoading} />
          )}

          {/* Show parsed plan summary */}
          {plan && plan.adGroups.length > 0 && !strategyLoading && (
            <div className="al as" style={{ marginTop: 14 }}>
              ✅ Plan parsed: <b>{plan.adGroups.length}</b> ad groups · <b>{planKwCount}</b> keywords · <b>{planAdCount}</b> ad copies · <b>{planNegCount}</b> negatives
              {plan.settings && <> · Budget: <b>${plan.settings.dailyBudget}/day</b></>}
            </div>
          )}

          <div className="divider" />

          {/* Individual generation tabs (advanced/alternative) */}
          <details style={{ marginTop: 0 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--muted)', padding: '8px 0' }}>
              Advanced: Generate keywords, ad copy & negatives individually
            </summary>
            <div style={{ marginTop: 12 }}>
              <TabPanel tabs={['🔑 Keywords', '📝 Ad Copy', '🚫 Negatives']}>
                <div>
                  <div className="fr" style={{ marginBottom: 12 }}>
                    <div className="fg" style={{ margin: 0 }}><label>Match Type</label><select value={matchType} onChange={(e) => setMatchType(e.target.value)}><option value="ALL">All Types</option><option value="PHRASE">Phrase</option><option value="EXACT">Exact</option></select></div>
                    <div className="fg" style={{ margin: 0 }}><label>Count</label><select value={kwCount} onChange={(e) => setKwCount(e.target.value)}><option>20</option><option>40</option><option>60</option><option>100</option></select></div>
                  </div>
                  <button className="btn bp" onClick={genKw} disabled={kwLoading} style={{ marginBottom: 12 }}>{kwLoading ? <><span className="spin" /> Generating…</> : '✨ Generate Keywords'}</button>
                  <AiOutput text={kwText} id="kw-o" streaming={kwLoading} />
                </div>
                <div>
                  <div className="fr" style={{ marginBottom: 12 }}>
                    <div className="fg" style={{ margin: 0 }}><label>Format</label><select value={adFormat} onChange={(e) => setAdFormat(e.target.value)}><option value="RSA">RSA</option><option value="ETA">ETA</option><option value="BOTH">Both</option></select></div>
                    <div className="fg" style={{ margin: 0 }}><label>Tone</label><select value={adTone} onChange={(e) => setAdTone(e.target.value)}><option>Professional</option><option>Urgent</option><option>Friendly</option><option>Authoritative</option></select></div>
                  </div>
                  <button className="btn bp" onClick={genAd} disabled={adLoading} style={{ marginBottom: 12 }}>{adLoading ? <><span className="spin" /> Generating…</> : '✨ Generate Ad Copy'}</button>
                  <AiOutput text={adText} id="ad-o" streaming={adLoading} />
                </div>
                <div>
                  <button className="btn bp" onClick={genNeg} disabled={negLoading} style={{ marginBottom: 12 }}>{negLoading ? <><span className="spin" /> Generating…</> : '✨ Generate Negatives'}</button>
                  <AiOutput text={negText} id="neg-o" streaming={negLoading} />
                </div>
              </TabPanel>
            </div>
          </details>

          <div style={{ display: 'flex', gap: 8, marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <button className="btn bs" onClick={() => setStep(1)}>← Back</button>
            <button className="btn bp" onClick={() => setStep(3)} disabled={!plan && !kwText}>Next: Preview & Launch →</button>
          </div>
        </div>
      )}

      {/* ═══ Step 3: Preview & Launch ═══ */}
      {step === 3 && (
        <div className="card card-gradient">
          <div className="ch"><div className="ct">🚀 Preview & Launch</div></div>

          {/* Campaign summary */}
          <div className="g2" style={{ marginBottom: 14 }}>
            <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Business</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{b.name || '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>{b.loc || '—'} · {b.cat || '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{b.svc || '—'}</div>
            </div>
            <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Campaign</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{b.campaignName || 'AdOptimizer Campaign'}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>Goal: {b.goal} · ${b.budget || 50}/day · {b.bidding?.replace(/_/g, ' ')}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Locations: {b.targetLocations || '—'}</div>
            </div>
          </div>

          {/* Plan details */}
          {plan && plan.adGroups.length > 0 && (
            <div className="al ai" style={{ marginBottom: 14 }}>
              📋 <b>Launching:</b> {plan.adGroups.length} ad groups · {planKwCount} keywords · {planAdCount} ad copy sets · {planNegCount} negatives · Status: <b>PAUSED</b>
            </div>
          )}

          <div className="al aw">
            <span>⚠️</span>
            <div>This creates a <b>real campaign</b> in your Google Ads account set to <b>PAUSED</b>. Review it in Google Ads UI before enabling traffic.</div>
          </div>

          {launchStatus && <AlertBanner type={launchStatus.type} message={launchStatus.msg} />}

          {/* Confirmation overlay */}
          {showConfirm && (
            <div className="al" style={{ background: '#1e1b4b', color: '#fff', borderColor: 'var(--accent)', borderWidth: 2, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>⚡ Confirm Campaign Launch</div>
              <div style={{ fontSize: 13, opacity: 0.9 }}>
                Creating "<b>{b.campaignName || 'AdOptimizer Campaign'}</b>" with ${b.budget || 50}/day budget.
                {plan && <> {plan.adGroups.length} ad groups, {planKwCount} keywords.</>}
                Campaign starts <b>PAUSED</b>.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn bp" onClick={launch}>✅ Confirm & Launch</button>
                <button className="btn" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }} onClick={() => setShowConfirm(false)}>Cancel</button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button className="btn bs" onClick={() => setStep(2)}>← Back</button>
            {!showConfirm && (
              <button className="btn bp" onClick={() => setShowConfirm(true)} disabled={launching}>
                {launching ? <><span className="spin" /> Launching…</> : '🚀 Launch Campaign'}
              </button>
            )}
            <button className="btn bs" onClick={exportJSON}>📥 Export JSON</button>
          </div>
        </div>
      )}
    </>
  );
}
