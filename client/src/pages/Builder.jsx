import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../store';
import { CATEGORIES, PROMPTS } from '../constants';
import WizardSteps from '../components/WizardSteps';
import TabPanel from '../components/TabPanel';
import AiOutput from '../components/AiOutput';
import AlertBanner from '../components/AlertBanner';
import { callAI, saveCampaign } from '../api';
import { getToken, gads } from '../auth';

export default function Builder() {
  const { builder, setBuilder, incStat, log } = useStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // AI generation state
  const [kwText, setKwText] = useState('');
  const [adText, setAdText] = useState('');
  const [negText, setNegText] = useState('');
  const [kwLoading, setKwLoading] = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const [negLoading, setNegLoading] = useState(false);

  // AI options
  const [matchType, setMatchType] = useState('ALL');
  const [kwCount, setKwCount] = useState('40');
  const [adFormat, setAdFormat] = useState('RSA');
  const [adTone, setAdTone] = useState('Professional');

  // Launch state
  const [launchStatus, setLaunchStatus] = useState(null);
  const [launching, setLaunching] = useState(false);

  const b = builder;
  const setB = (field, val) => setBuilder({ [field]: val });

  // ── AI Generation ──
  const genKw = async () => {
    setKwLoading(true);
    setKwText('');
    const { system, user } = PROMPTS.keywords({
      count: kwCount, name: b.name, loc: b.loc, cat: b.cat,
      svc: b.svc, aud: b.aud, usp: b.usp, matchType,
    });
    try {
      const result = await callAI(user, (_, full) => setKwText(full), { system });
      setKwText(result);
      incStat('k', parseInt(kwCount));
      log('Keywords generated: ' + b.name);
    } catch (e) { setKwText('❌ ' + e.message); }
    setKwLoading(false);
  };

  const genAd = async () => {
    setAdLoading(true);
    setAdText('');
    const { system, user } = PROMPTS.adCopy({
      format: adFormat, name: b.name, loc: b.loc,
      svc: b.svc, usp: b.usp, tone: adTone,
    });
    try {
      const result = await callAI(user, (_, full) => setAdText(full), { system });
      setAdText(result);
      incStat('a', 3);
      log('Ad copy: ' + b.name);
    } catch (e) { setAdText('❌ ' + e.message); }
    setAdLoading(false);
  };

  const genNeg = async () => {
    setNegLoading(true);
    setNegText('');
    const { system, user } = PROMPTS.negatives({ cat: b.cat, svc: b.svc, loc: b.loc });
    try {
      const result = await callAI(user, (_, full) => setNegText(full), { system });
      setNegText(result);
    } catch (e) { setNegText('❌ ' + e.message); }
    setNegLoading(false);
  };

  // ── Keyword Parsing ──
  function parseKeywords(text) {
    return text.split('\n')
      .filter((l) => l.trim() && !l.match(/^[=#—►•\-\*]/))
      .slice(0, 50)
      .map((line) => {
        const txt = line
          .replace(/\[|\]|"/g, '')
          .replace(/\(.*?\)/g, '')
          .replace(/HIGH|MED|LOW|TRANSACTIONAL|COMMERCIAL|INFORMATIONAL|intent|Vol:|Comp:|CPC:/gi, '')
          .split('|')[0].split('–')[0].split('—')[0]
          .trim().toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .slice(0, 80);
        let mt = 'BROAD';
        if (line.trim().startsWith('[')) mt = 'EXACT';
        else if (line.trim().startsWith('"')) mt = 'PHRASE';
        return { text: txt, matchType: mt };
      })
      .filter((kw) => kw.text.replace(/\s/g, '').length > 2);
  }

  // ── Ad Copy Parsing ──
  function parseAdCopy(text) {
    const headlines = [];
    const descriptions = [];
    for (const line of text.split('\n')) {
      const hl = line.match(/^(?:H\d+|Headline\s*\d*)[:\s]+(.+)/i);
      if (hl) {
        const h = hl[1].replace(/\[.*?\]/g, '').trim().slice(0, 30);
        if (h.length >= 3) headlines.push(h);
      }
      const dl = line.match(/^(?:D\d+|Description\s*\d*)[:\s]+(.+)/i);
      if (dl) {
        const d = dl[1].replace(/\[.*?\]/g, '').trim().slice(0, 90);
        if (d.length >= 10) descriptions.push(d);
      }
    }
    return { headlines: headlines.slice(0, 15), descriptions: descriptions.slice(0, 4) };
  }

  // ── Negative Keyword Parsing ──
  function parseNegatives(text) {
    return text.split('\n')
      .filter((l) => l.trim() && (l.includes('[') || l.includes('"')))
      .slice(0, 100)
      .map((line) => {
        const txt = line.replace(/\[|\]|"/g, '').replace(/\(.*?\)/g, '').trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').slice(0, 80);
        let mt = 'BROAD';
        if (line.trim().startsWith('[')) mt = 'EXACT';
        else if (line.trim().startsWith('"')) mt = 'PHRASE';
        return { text: txt, matchType: mt, isNegative: true };
      })
      .filter((kw) => kw.text.replace(/\s/g, '').length > 2);
  }

  // ── Ad Group Theme Parsing ──
  function groupKeywordsByTheme(keywords, text) {
    const groups = {};
    let currentGroup = 'General';
    for (const line of text.split('\n')) {
      const header = line.match(/^#{1,3}\s+(.+)/);
      if (header) {
        currentGroup = header[1].replace(/keywords?|ad\s*group/gi, '').trim() || 'General';
        continue;
      }
      if (line.trim() && !line.match(/^[=#—►•\-\*]/) && !line.match(/^Suggested negative/i)) {
        if (!groups[currentGroup]) groups[currentGroup] = [];
        const kw = parseKeywords(line);
        if (kw.length) groups[currentGroup].push(...kw);
      }
    }
    // If parsing found no groups, put all in one
    if (Object.keys(groups).length === 0 || Object.values(groups).every(g => g.length === 0)) {
      return { 'Main Keywords': keywords };
    }
    return groups;
  }

  // ── Launch Campaign ──
  const launch = async () => {
    setLaunching(true);
    try {
      setLaunchStatus({ type: 'ai', msg: '⏳ Authenticating…' });
      await getToken();

      const name = b.campaignName || 'AdOptimizer Campaign';
      const budget = parseFloat(b.budget) || 50;
      const bidding = b.bidding;

      // 1. Create budget
      setLaunchStatus({ type: 'ai', msg: '⏳ Creating budget…' });
      const br = await gads('campaignBudgets:mutate', {
        operations: [{
          create: {
            name: `Budget-${name}-${Date.now()}`,
            amountMicros: String(Math.round(budget * 1e6)),
            deliveryMethod: 'STANDARD',
          },
        }],
      });
      const budRN = br.results?.[0]?.resourceName;
      if (!budRN) throw new Error('Budget creation failed');

      // 2. Create campaign
      setLaunchStatus({ type: 'ai', msg: '⏳ Creating campaign…' });
      const cb = {
        name,
        status: 'PAUSED',
        advertisingChannelType: 'SEARCH',
        campaignBudget: budRN,
        networkSettings: { targetGoogleSearch: true, targetSearchNetwork: true, targetContentNetwork: false },
      };
      if (bidding === 'MAXIMIZE_CONVERSIONS') cb.maximizeConversions = {};
      else if (bidding === 'MAXIMIZE_CLICKS') cb.maximizeClicks = {};
      else if (bidding === 'MANUAL_CPC') cb.manualCpc = { enhancedCpcEnabled: true };
      else if (bidding === 'TARGET_CPA') cb.targetCpa = { targetCpaMicros: '5000000' };
      const cr = await gads('campaigns:mutate', { operations: [{ create: cb }] });
      const campRN = cr.results?.[0]?.resourceName;
      if (!campRN) throw new Error('Campaign failed');

      // 3. Location targeting
      if (b.targetLocations) {
        setLaunchStatus({ type: 'ai', msg: '⏳ Setting location targets…' });
        try {
          const locs = b.targetLocations.split(',').map((l) => l.trim()).filter(Boolean);
          for (const loc of locs) {
            // Suggest geo target constant
            const suggestResp = await gads('geoTargetConstants:suggest', {
              locale: 'en',
              countryCode: 'US',
              locationNames: { names: [loc] },
            }, 'POST');
            const geoConst = suggestResp?.geoTargetConstantSuggestions?.[0]?.geoTargetConstant?.resourceName;
            if (geoConst) {
              await gads('campaignCriteria:mutate', {
                operations: [{
                  create: {
                    campaign: campRN,
                    criterion: { location: { geoTargetConstant: geoConst } },
                  },
                }],
              });
            }
          }
        } catch (e) { console.warn('Geo targeting:', e.message); }
      }

      // 4. Create ad groups by theme
      setLaunchStatus({ type: 'ai', msg: '⏳ Creating ad groups…' });
      const allKeywords = parseKeywords(kwText);
      const kwGroups = groupKeywordsByTheme(allKeywords, kwText);
      const groupNames = Object.keys(kwGroups).slice(0, 10);

      const adGroupRNs = {};
      for (const groupName of groupNames) {
        const agr = await gads('adGroups:mutate', {
          operations: [{
            create: {
              name: `${name} - ${groupName}`,
              campaign: campRN,
              status: 'ENABLED',
              type: 'SEARCH_STANDARD',
              cpcBidMicros: '2000000',
            },
          }],
        });
        const agRN = agr.results?.[0]?.resourceName;
        if (agRN) adGroupRNs[groupName] = agRN;
      }

      // 5. Add keywords to ad groups
      setLaunchStatus({ type: 'ai', msg: '⏳ Adding keywords…' });
      for (const [groupName, agRN] of Object.entries(adGroupRNs)) {
        const groupKws = kwGroups[groupName] || allKeywords;
        const kwOps = groupKws.slice(0, 25).map((kw) => ({
          create: { adGroup: agRN, status: 'ENABLED', keyword: { text: kw.text, matchType: kw.matchType } },
        }));
        if (kwOps.length) {
          await gads('adGroupCriteria:mutate', { operations: kwOps }).catch((e) => console.warn('KW:', e.message));
        }
      }

      // 6. Upload RSA ads
      if (adText) {
        setLaunchStatus({ type: 'ai', msg: '⏳ Uploading ad copy…' });
        const { headlines, descriptions } = parseAdCopy(adText);
        if (headlines.length >= 3 && descriptions.length >= 1) {
          for (const agRN of Object.values(adGroupRNs)) {
            try {
              await gads('adGroupAds:mutate', {
                operations: [{
                  create: {
                    adGroup: agRN,
                    status: 'ENABLED',
                    ad: {
                      responsiveSearchAd: {
                        headlines: headlines.map((h, i) => ({
                          text: h,
                          ...(i === 0 ? { pinnedField: 'HEADLINE_1' } : {}),
                        })),
                        descriptions: descriptions.map((d) => ({ text: d })),
                      },
                      finalUrls: [b.website || `https://${b.name.toLowerCase().replace(/\s/g, '')}.com`],
                    },
                  },
                }],
              });
            } catch (e) { console.warn('Ad upload:', e.message); }
          }
        }
      }

      // 7. Upload negative keywords
      if (negText) {
        setLaunchStatus({ type: 'ai', msg: '⏳ Adding negative keywords…' });
        const negKws = parseNegatives(negText);
        if (negKws.length) {
          const negOps = negKws.map((kw) => ({
            create: {
              campaign: campRN,
              criterion: { keyword: { text: kw.text, matchType: kw.matchType } },
              negative: true,
            },
          }));
          await gads('campaignCriteria:mutate', { operations: negOps }).catch((e) => console.warn('Neg KW:', e.message));
        }
      }

      // 8. Save to DB
      const campId = campRN?.split('/')?.[3] || '';
      await saveCampaign({
        name,
        googleCampaignId: campId,
        status: 'PAUSED',
        businessName: b.name,
        businessLocation: b.loc,
        businessCategory: b.cat,
        website: b.website,
        services: b.svc,
        targetAudience: b.aud,
        usps: b.usp,
        campaignGoal: b.goal,
        dailyBudget: budget,
        biddingStrategy: bidding,
        targetLocations: b.targetLocations,
        radiusMiles: b.radius,
        keywordsRaw: kwText,
        adCopyRaw: adText,
        negativesRaw: negText,
      }).catch(() => {});

      setLaunchStatus({
        type: 'as',
        msg: `✅ Campaign "${name}" created!\n\nID: ${campId} · Status: PAUSED\n` +
          `Ad Groups: ${Object.keys(adGroupRNs).length} · Keywords uploaded · Ads uploaded\n` +
          `Review in Google Ads before enabling.`,
      });
      incStat('c');
      log('Launched: ' + name);

    } catch (e) {
      setLaunchStatus({ type: 'ae', msg: '❌ ' + e.message });
    }
    setLaunching(false);
  };

  const exportJSON = () => {
    const d = {
      business: { name: b.name, loc: b.loc, cat: b.cat, svc: b.svc, aud: b.aud, usp: b.usp },
      campaign: { name: b.campaignName, goal: b.goal, budget: b.budget, bidding: b.bidding, locations: b.targetLocations },
      keywords: kwText, adCopy: adText, negatives: negText,
      exportedAt: new Date().toISOString(),
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }));
    a.download = `campaign-${(b.name || 'export').replace(/\s/g, '-').toLowerCase()}-${Date.now()}.json`;
    a.click();
  };

  return (
    <>
      <WizardSteps current={step} onStep={setStep} />

      {/* Step 1: Business */}
      {step === 1 && (
        <div className="card card-gradient">
          <div className="ch">
            <div><div className="ct">Business Info</div><div className="cs">Auto-filled from scraper or enter manually</div></div>
            <button className="btn bs sm" onClick={() => navigate('/scraper')}>🔍 Scrape Site</button>
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
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="fg"><label>Website (optional)</label><input type="url" value={b.website} onChange={(e) => setB('website', e.target.value)} placeholder="https://smithcpa.com" /></div>
          </div>
          <div className="fg"><label>Services</label><input value={b.svc} onChange={(e) => setB('svc', e.target.value)} placeholder="Tax Prep, Bookkeeping, Payroll, IRS Representation" /></div>
          <div className="fg"><label>Target Audience</label><input value={b.aud} onChange={(e) => setB('aud', e.target.value)} placeholder="Small businesses, self-employed, real estate investors" /></div>
          <div className="fg"><label>Unique Selling Points (USPs)</label><textarea rows={2} value={b.usp} onChange={(e) => setB('usp', e.target.value)} placeholder="15+ years experience, free consultation, flat-fee pricing, bilingual…" /></div>
          <button className="btn bp" onClick={() => setStep(2)}>Next: Campaign Settings →</button>
        </div>
      )}

      {/* Step 2: Campaign Settings */}
      {step === 2 && (
        <div className="card card-gradient">
          <div className="ch"><div className="ct">Campaign Settings</div></div>
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
          <div className="fr">
            <div className="fg"><label>Target Locations</label><input value={b.targetLocations} onChange={(e) => setB('targetLocations', e.target.value)} placeholder="Austin TX, Round Rock TX, Cedar Park TX" /></div>
            <div className="fg"><label>Radius (miles)</label><input type="number" value={b.radius} onChange={(e) => setB('radius', e.target.value)} min="1" max="500" /></div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn bs" onClick={() => setStep(1)}>← Back</button>
            <button className="btn bp" onClick={() => setStep(3)}>Next: Generate Content →</button>
          </div>
        </div>
      )}

      {/* Step 3: AI Generate */}
      {step === 3 && (
        <div className="card">
          <div className="ch">
            <div><div className="ct">🤖 AI Content Generation</div><div className="cs">Keywords, ad copy & negatives — generated with your AI key</div></div>
          </div>
          <TabPanel tabs={['🔑 Keywords', '📝 Ad Copy', '🚫 Negatives']}>
            {/* Keywords tab */}
            <div>
              <div className="fr" style={{ marginBottom: 12 }}>
                <div className="fg" style={{ margin: 0 }}>
                  <label>Match Type</label>
                  <select value={matchType} onChange={(e) => setMatchType(e.target.value)}>
                    <option value="ALL">All Types (Broad, Phrase, Exact)</option>
                    <option value="PHRASE">Phrase Match</option>
                    <option value="EXACT">Exact Match</option>
                  </select>
                </div>
                <div className="fg" style={{ margin: 0 }}>
                  <label>Count</label>
                  <select value={kwCount} onChange={(e) => setKwCount(e.target.value)}>
                    <option>20</option><option>40</option><option>60</option><option>100</option>
                  </select>
                </div>
              </div>
              <button className="btn bp" onClick={genKw} disabled={kwLoading} style={{ marginBottom: 12 }}>
                {kwLoading ? <><span className="spin" /> Generating…</> : '✨ Generate Keywords'}
              </button>
              <AiOutput text={kwText} id="kw-o" />
            </div>

            {/* Ad Copy tab */}
            <div>
              <div className="fr" style={{ marginBottom: 12 }}>
                <div className="fg" style={{ margin: 0 }}>
                  <label>Format</label>
                  <select value={adFormat} onChange={(e) => setAdFormat(e.target.value)}>
                    <option value="RSA">RSA (15 Headlines + 4 Descs)</option>
                    <option value="ETA">Expanded Text Ads</option>
                    <option value="BOTH">Both Formats</option>
                  </select>
                </div>
                <div className="fg" style={{ margin: 0 }}>
                  <label>Tone</label>
                  <select value={adTone} onChange={(e) => setAdTone(e.target.value)}>
                    <option>Professional</option><option>Urgent</option><option>Friendly</option><option>Authoritative</option>
                  </select>
                </div>
              </div>
              <button className="btn bp" onClick={genAd} disabled={adLoading} style={{ marginBottom: 12 }}>
                {adLoading ? <><span className="spin" /> Generating…</> : '✨ Generate Ad Copy'}
              </button>
              <AiOutput text={adText} id="ad-o" />
            </div>

            {/* Negatives tab */}
            <div>
              <button className="btn bp" onClick={genNeg} disabled={negLoading} style={{ marginBottom: 12 }}>
                {negLoading ? <><span className="spin" /> Generating…</> : '✨ Generate Negative Keywords'}
              </button>
              <AiOutput text={negText} id="neg-o" />
            </div>
          </TabPanel>

          <div style={{ display: 'flex', gap: 8, marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <button className="btn bs" onClick={() => setStep(2)}>← Back</button>
            <button className="btn bp" onClick={() => setStep(4)}>Next: Review & Launch →</button>
          </div>
        </div>
      )}

      {/* Step 4: Launch */}
      {step === 4 && (
        <div className="card card-gradient">
          <div className="ch"><div className="ct">🚀 Review & Launch</div></div>

          <div className="g2">
            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: 14, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Business</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{b.name || '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>{b.loc || '—'} · {b.cat || '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{b.svc || '—'}</div>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: 14, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Campaign</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{b.campaignName || '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>Goal: {b.goal || '—'} · ${b.budget || '—'}/day</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Bidding: {b.bidding || '—'} · {b.targetLocations || '—'}</div>
            </div>
          </div>

          <div className="al aw" style={{ marginTop: 14 }}>
            <span>⚠️</span>
            <div>This creates a <b>real campaign</b> in Google Ads set to <b>PAUSED</b>. Review it in Google Ads UI before enabling traffic.</div>
          </div>

          {launchStatus && <AlertBanner type={launchStatus.type} message={launchStatus.msg} />}

          <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <button className="btn bs" onClick={() => setStep(3)}>← Back</button>
            <button className="btn bp" onClick={launch} disabled={launching}>
              {launching ? <><span className="spin" /> Launching…</> : '🚀 Launch Campaign'}
            </button>
            <button className="btn bs" onClick={exportJSON}>📥 Export JSON</button>
          </div>
        </div>
      )}
    </>
  );
}
