import { useState, useEffect } from 'react';
import useStore from '../store';
import { gads } from '../auth';
import { callAI } from '../api';
import { PROMPTS } from '../constants';
import AiOutput from '../components/AiOutput';

function parseActions(text, campaignData) {
  const actions = [];
  // Build sets of valid resource names and keyword texts from actual campaign data
  const validResources = new Set();
  const validAdGroups = new Set();
  const validKeywordTexts = new Set();
  if (campaignData) {
    // Extract all resource names from campaign data
    const allData = [
      campaignData.keywordsFormatted || '',
      campaignData.adsFormatted || '',
      campaignData.adGroupsFormatted || '',
    ].join('\n');
    for (const m of allData.matchAll(/\[resource: (customers\/\d+\/[^\]]+)\]/g)) {
      validResources.add(m[1]);
    }
    for (const m of (campaignData.keywordsFormatted || '').matchAll(/\[adGroup: (customers\/\d+\/adGroups\/\d+)\]/g)) {
      validAdGroups.add(m[1]);
    }
    // Extract actual keyword texts from the keywords data
    for (const m of (campaignData.keywordsFormatted || '').matchAll(/\] (.+?) \((BROAD|PHRASE|EXACT)\)/g)) {
      validKeywordTexts.add(m[1].toLowerCase());
    }
    console.log('Valid resources:', validResources.size, 'Valid keywords:', [...validKeywordTexts]);
  }

  // Match ```json blocks
  const patterns = [
    /```json\s*\n?([\s\S]*?)```/g,
    /```JSON\s*\n?([\s\S]*?)```/g,
    /```\s*\n?(\{[\s\S]*?"type"\s*:[\s\S]*?\})\s*\n?```/g,
  ];
  const seen = new Set();
  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      try {
        const raw = match[1].trim();
        const parsed = JSON.parse(raw);
        if (!parsed.type || !['ADD_NEGATIVE', 'PAUSE_KEYWORD', 'ADD_KEYWORD', 'PAUSE_AD', 'UPDATE_BUDGET'].includes(parsed.type)) continue;

        // Validate resource names — reject fabricated ones
        if (parsed.type === 'PAUSE_KEYWORD') {
          const hasValidResource = parsed.resourceName && validResources.has(parsed.resourceName);
          const hasValidKeyword = parsed.keyword && validKeywordTexts.has(parsed.keyword.toLowerCase());
          if (!hasValidResource && !hasValidKeyword) {
            console.warn(`Skipping PAUSE_KEYWORD: "${parsed.keyword}" not found in account keywords, resource "${parsed.resourceName}" not valid`);
            continue;
          }
          // If keyword text doesn't match any real keyword, it should be ADD_NEGATIVE instead
          if (!hasValidKeyword) {
            console.warn(`Skipping PAUSE_KEYWORD: "${parsed.keyword}" not in account — should be ADD_NEGATIVE`);
            continue;
          }
        }
        if (parsed.type === 'PAUSE_AD') {
          if (!parsed.resourceName || !validResources.has(parsed.resourceName)) {
            console.warn(`Skipping PAUSE_AD: invalid resource "${parsed.resourceName}"`);
            continue;
          }
        }
        if (parsed.type === 'ADD_KEYWORD') {
          if (!parsed.adGroupResource || !validAdGroups.has(parsed.adGroupResource)) {
            console.warn(`Skipping ADD_KEYWORD: invalid adGroup "${parsed.adGroupResource}"`);
            continue;
          }
        }

        const key = `${parsed.type}|${parsed.keyword || ''}|${parsed.resourceName || ''}|${parsed.newBudget || ''}`;
        if (!seen.has(key)) {
          seen.add(key);
          actions.push({ ...parsed, checked: true, status: 'pending' });
        }
      } catch { /* skip */ }
    }
  }
  return actions;
}

function describeAction(a) {
  switch (a.type) {
    case 'ADD_NEGATIVE': return `Add negative: "${a.keyword || '?'}" (${a.matchType || 'PHRASE'})`;
    case 'PAUSE_KEYWORD': return `Pause: "${a.keyword || a.resourceName?.split('~').pop() || '?'}"`;
    case 'ADD_KEYWORD': return `Add keyword: "${a.keyword || '?'}" (${a.matchType || 'PHRASE'})`;
    case 'PAUSE_AD': return `Pause ad (${a.resourceName?.split('~').pop() || 'weak ad'})`;
    case 'UPDATE_BUDGET': return `Change budget → $${a.newBudget}/day`;
    default: return a.type;
  }
}

const ACTION_META = {
  ADD_NEGATIVE: { icon: '🚫', label: 'NEGATIVE', color: 'tr', group: 'Block Wasteful Spend' },
  PAUSE_KEYWORD: { icon: '⏸️', label: 'PAUSE KW', color: 'ty', group: 'Pause Underperformers' },
  ADD_KEYWORD: { icon: '➕', label: 'ADD KW', color: 'tg', group: 'Add Missing Keywords' },
  PAUSE_AD: { icon: '⏸️', label: 'PAUSE AD', color: 'ty', group: 'Pause Weak Ads' },
  UPDATE_BUDGET: { icon: '💰', label: 'BUDGET', color: 'tb', group: 'Budget Changes' },
};

const ACTION_ORDER = ['ADD_NEGATIVE', 'PAUSE_KEYWORD', 'ADD_KEYWORD', 'PAUSE_AD', 'UPDATE_BUDGET'];

const STATUS_ICON = { pending: '', executing: '⏳', done: '✅', failed: '❌' };

export default function CampaignReview() {
  const cr = useStore((s) => s.cr);
  const log = useStore((s) => s.log);
  const [campaigns, setCampaigns] = useState([]);
  const [selected, setSelected] = useState(null);
  const [campaignData, setCampaignData] = useState(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [error, setError] = useState(null);
  const [actions, setActions] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (text && !reviewing) {
      const parsed = parseActions(text, campaignData);
      if (parsed.length > 0) setActions(parsed);
    }
  }, [text, reviewing]);

  const fetchCampaigns = async () => {
    setLoading(true);
    setError(null);
    setSelected(null);
    setCampaignData(null);
    setActions([]);
    setText('');
    setShowResult(false);
    try {
      const d = await gads('googleAds:searchStream', {
        query: `SELECT campaign.id, campaign.name, campaign.status, campaign.bidding_strategy_type, campaign.resource_name, campaign_budget.amount_micros, campaign_budget.resource_name FROM campaign WHERE campaign.status != 'REMOVED' ORDER BY campaign.name LIMIT 50`,
      });
      const rows = d?.[0]?.results || [];
      setCampaigns(rows.map((r) => ({
        id: r.campaign.id,
        name: r.campaign.name,
        status: r.campaign.status,
        bidding: r.campaign.biddingStrategyType || 'N/A',
        resourceName: r.campaign.resourceName,
        budgetResource: r.campaignBudget?.resourceName || '',
        budgetRaw: r.campaignBudget?.amountMicros ? parseInt(r.campaignBudget.amountMicros) / 1e6 : 0,
        budget: r.campaignBudget?.amountMicros
          ? '$' + (parseInt(r.campaignBudget.amountMicros) / 1e6).toFixed(0) + '/day'
          : 'N/A',
      })));
      if (rows.length === 0) setError('No campaigns found in this account.');
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const selectCampaign = async (campaign) => {
    setSelected(campaign);
    setCampaignData(null);
    setFetching(true);
    setError(null);
    setText('');
    setShowResult(false);
    setActions([]);

    try {
      const [agRes, kwRes, adRes, stRes] = await Promise.all([
        gads('googleAds:searchStream', {
          query: `SELECT ad_group.id, ad_group.name, ad_group.status, ad_group.type, ad_group.resource_name FROM ad_group WHERE campaign.id = ${campaign.id} AND ad_group.status != 'REMOVED'`,
        }),
        gads('googleAds:searchStream', {
          query: `SELECT ad_group.name, ad_group.resource_name, ad_group_criterion.resource_name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.status, ad_group_criterion.quality_info.quality_score FROM ad_group_criterion WHERE campaign.id = ${campaign.id} AND ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.status != 'REMOVED' LIMIT 200`,
        }),
        gads('googleAds:searchStream', {
          query: `SELECT ad_group.name, ad_group_ad.resource_name, ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions, ad_group_ad.ad.final_urls, ad_group_ad.status, ad_group_ad.ad_strength FROM ad_group_ad WHERE campaign.id = ${campaign.id} AND ad_group_ad.status != 'REMOVED'`,
        }),
        gads('googleAds:searchStream', {
          query: `SELECT search_term_view.search_term, search_term_view.status, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, ad_group.name FROM search_term_view WHERE campaign.id = ${campaign.id} AND segments.date DURING LAST_30_DAYS ORDER BY metrics.impressions DESC LIMIT 100`,
        }).catch(() => ({ 0: { results: [] } })),
      ]);

      const agRows = agRes?.[0]?.results || [];
      const kwRows = kwRes?.[0]?.results || [];
      const adRows = adRes?.[0]?.results || [];
      const stRows = stRes?.[0]?.results || [];

      const adGroupsFormatted = agRows.length
        ? agRows.map((r) => `- ${r.adGroup.name} (${r.adGroup.status}, type: ${r.adGroup.type}) [resource: ${r.adGroup.resourceName}]`).join('\n')
        : 'No ad groups found.';

      const keywordsFormatted = kwRows.length
        ? kwRows.map((r) => {
            const qs = r.adGroupCriterion?.qualityInfo?.qualityScore;
            return `- [${r.adGroup.name}] ${r.adGroupCriterion.keyword.text} (${r.adGroupCriterion.keyword.matchType})${qs ? ` QS:${qs}` : ''} status:${r.adGroupCriterion.status} [resource: ${r.adGroupCriterion.resourceName}] [adGroup: ${r.adGroup.resourceName}]`;
          }).join('\n')
        : 'No keywords found.';

      const adsFormatted = adRows.length
        ? adRows.map((r) => {
            const ad = r.adGroupAd?.ad || {};
            const headlines = ad.responsiveSearchAd?.headlines?.map((h) => h.text).join(' | ') || 'N/A';
            const descs = ad.responsiveSearchAd?.descriptions?.map((d) => d.text).join(' | ') || 'N/A';
            const urls = ad.finalUrls?.join(', ') || 'N/A';
            return `- [${r.adGroup.name}] Headlines: ${headlines}\n  Descriptions: ${descs}\n  URLs: ${urls} | Strength: ${r.adGroupAd?.adStrength || 'N/A'} | Status: ${r.adGroupAd?.status || 'N/A'} [resource: ${r.adGroupAd.resourceName}]`;
          }).join('\n')
        : 'No ads found.';

      const searchTermsFormatted = stRows.length
        ? stRows.map((r) => {
            const st = r.searchTermView || {};
            const m = r.metrics || {};
            const cost = m.costMicros ? '$' + (parseInt(m.costMicros) / 1e6).toFixed(2) : '$0';
            return `- "${st.searchTerm}" [${r.adGroup?.name || 'N/A'}] ${st.status || ''} | Impr: ${m.impressions || 0} | Clicks: ${m.clicks || 0} | Cost: ${cost} | Conv: ${m.conversions || 0}`;
          }).join('\n')
        : 'No search term data available (may require more campaign history).';

      // Compute summary stats (API returns strings — must parseInt/parseFloat)
      const totalClicks = stRows.reduce((s, r) => s + Number(r.metrics?.clicks || 0), 0);
      const totalCost = stRows.reduce((s, r) => s + (Number(r.metrics?.costMicros || 0) / 1e6), 0);
      const totalConv = stRows.reduce((s, r) => s + Number(r.metrics?.conversions || 0), 0);
      const avgQs = kwRows.filter(r => r.adGroupCriterion?.qualityInfo?.qualityScore).reduce((acc, r, _, arr) => acc + Number(r.adGroupCriterion.qualityInfo.qualityScore) / arr.length, 0);

      setCampaignData({
        adGroups: agRows.length,
        keywords: kwRows.length,
        ads: adRows.length,
        searchTerms: stRows.length,
        totalClicks,
        totalCost: totalCost.toFixed(2),
        totalConv,
        avgQs: avgQs ? avgQs.toFixed(1) : null,
        adGroupsFormatted,
        keywordsFormatted,
        adsFormatted,
        searchTermsFormatted,
      });
      log(`Loaded campaign data: ${campaign.name}`);
    } catch (e) {
      setError('Failed to load campaign details: ' + e.message);
      setSelected(null);
    }
    setFetching(false);
  };

  const reviewCampaign = async () => {
    setReviewing(true);
    setText('');
    setShowResult(true);
    setActions([]);
    try {
      const { system, user } = PROMPTS.campaignReview({
        campaignName: selected.name,
        status: selected.status,
        budget: selected.budget,
        bidding: selected.bidding,
        campaignResource: selected.resourceName,
        budgetResource: selected.budgetResource,
        adGroups: campaignData.adGroupsFormatted,
        keywords: campaignData.keywordsFormatted,
        ads: campaignData.adsFormatted,
        searchTerms: campaignData.searchTermsFormatted,
      });
      const result = await callAI(user, (_, full) => setText(full), { maxTokens: 16000, system });
      setText(result);
      log(`AI review complete: ${selected.name}`);
    } catch (e) {
      setText('Error: ' + e.message);
    }
    setReviewing(false);
  };

  const toggleAction = (idx) => {
    setActions((prev) => prev.map((a, i) => i === idx ? { ...a, checked: !a.checked } : a));
  };

  const selectAllActions = (val) => {
    setActions((prev) => prev.map((a) => a.status !== 'done' ? { ...a, checked: val } : a));
  };

  const executeAction = async (action) => {
    switch (action.type) {
      case 'ADD_NEGATIVE':
        return gads('campaignCriteria:mutate', {
          operations: [{
            create: {
              campaign: selected.resourceName,
              keyword: { text: action.keyword, matchType: action.matchType || 'PHRASE' },
              negative: true,
            },
          }],
        });
      case 'PAUSE_KEYWORD':
        return gads('adGroupCriteria:mutate', {
          operations: [{
            update: { resourceName: action.resourceName, status: 'PAUSED' },
            updateMask: 'status',
          }],
        });
      case 'ADD_KEYWORD':
        console.log('ADD_KEYWORD payload:', JSON.stringify({
          adGroup: action.adGroupResource,
          keyword: action.keyword,
          matchType: action.matchType,
        }));
        return gads('adGroupCriteria:mutate', {
          operations: [{
            create: {
              adGroup: action.adGroupResource,
              status: 'ENABLED',
              keyword: { text: action.keyword, matchType: action.matchType || 'PHRASE' },
              cpcBidMicros: '1000000',
            },
          }],
        });
      case 'PAUSE_AD':
        return gads('adGroupAds:mutate', {
          operations: [{
            update: { resourceName: action.resourceName, status: 'PAUSED' },
            updateMask: 'status',
          }],
        });
      case 'UPDATE_BUDGET':
        return gads('campaignBudgets:mutate', {
          operations: [{
            update: {
              resourceName: action.budgetResource || selected.budgetResource,
              amountMicros: String(action.newBudget * 1e6),
            },
            updateMask: 'amount_micros',
          }],
        });
      default:
        throw new Error('Unknown action type: ' + action.type);
    }
  };

  const applyChanges = async () => {
    setConfirming(false);
    setApplying(true);
    const checkedIndexes = actions.map((a, i) => (a.checked && a.status !== 'done') ? i : -1).filter((i) => i >= 0);

    for (const idx of checkedIndexes) {
      setActions((prev) => prev.map((a, i) => i === idx ? { ...a, status: 'executing' } : a));
      try {
        await executeAction(actions[idx]);
        setActions((prev) => prev.map((a, i) => i === idx ? { ...a, status: 'done' } : a));
        log(`Applied: ${describeAction(actions[idx])}`);
      } catch (e) {
        setActions((prev) => prev.map((a, i) => i === idx ? { ...a, status: 'failed', error: e.message } : a));
      }
    }
    setApplying(false);
    log('Finished applying changes');
  };

  const checkedCount = actions.filter((a) => a.checked && (a.status === 'pending' || a.status === 'failed')).length;
  const doneCount = actions.filter((a) => a.status === 'done').length;
  const failedCount = actions.filter((a) => a.status === 'failed').length;
  const statusColor = { ENABLED: 'tg', PAUSED: 'ty', REMOVED: 'tr' };

  return (
    <>
      {/* Campaign list */}
      <div className="card">
        <div className="ch">
          <div>
            <div className="ct">🔎 Campaign Review</div>
            <div className="cs">Select a campaign to run an AI-powered expert audit</div>
          </div>
          <button className="btn bp" onClick={fetchCampaigns} disabled={loading}>
            {loading ? <><span className="spin" /> Loading...</> : '🔄 Load Campaigns'}
          </button>
        </div>

        {error && <div className="al ae">❌ {error}</div>}

        {campaigns.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            {campaigns.map((c) => {
              const isSelected = selected?.id === c.id;
              return (
                <div
                  key={c.id}
                  className="camp-row"
                  style={{
                    cursor: 'pointer',
                    background: isSelected ? 'var(--accent-soft)' : undefined,
                    borderColor: isSelected ? 'var(--accent)' : undefined,
                    borderWidth: isSelected ? '2px' : undefined,
                  }}
                  onClick={() => selectCampaign(c)}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: isSelected ? 'var(--accent)' : 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 16, filter: isSelected ? 'brightness(10)' : 'none' }}>📢</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? 'var(--accent)' : 'var(--text)' }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 12 }}>
                      <span>{c.budget}</span>
                      <span>{c.bidding?.replace('MAXIMIZE_', 'Max ').replace('TARGET_', 'Target ').replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                  <span className={`tag ${statusColor[c.status] || 'tb'}`}>{c.status}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Campaign data + review trigger */}
      {selected && (
        <div className="card card-gradient">
          <div className="ch">
            <div>
              <div className="ct" style={{ fontSize: 16 }}>{selected.name}</div>
              <div className="cs">
                {fetching
                  ? '⏳ Loading campaign data...'
                  : campaignData
                    ? 'Campaign data loaded — ready for AI review'
                    : 'Error loading data'}
              </div>
            </div>
            <button
              className="btn bp"
              onClick={reviewCampaign}
              disabled={!campaignData || reviewing}
              style={{ fontSize: 14, padding: '10px 20px' }}
            >
              {reviewing ? <><span className="spin" /> Analyzing...</> : '🤖 Review with AI Expert'}
            </button>
          </div>

          {fetching && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted)' }}>
              <span className="spin-dark" style={{ marginRight: 8 }} />
              Fetching ad groups, keywords, ads, and search terms...
            </div>
          )}

          {campaignData && !fetching && (
            <div className="g3" style={{ gap: 10 }}>
              <StatCard label="Ad Groups" value={campaignData.adGroups} icon="📁" />
              <StatCard label="Keywords" value={campaignData.keywords} icon="🔤" />
              <StatCard label="Ads" value={campaignData.ads} icon="📝" />
              <StatCard label="Search Terms" value={campaignData.searchTerms} sub="Last 30 days" icon="🔍" />
              <StatCard label="Clicks (30d)" value={campaignData.totalClicks} sub={`$${campaignData.totalCost} spent`} icon="👆" />
              {campaignData.avgQs ? (
                <StatCard label="Avg Quality Score" value={campaignData.avgQs} sub={parseFloat(campaignData.avgQs) < 5 ? '⚠️ Below average' : '✅ Healthy'} icon="⭐" />
              ) : (
                <StatCard label="Conversions (30d)" value={campaignData.totalConv} icon="🎯" />
              )}
            </div>
          )}
        </div>
      )}

      {/* AI Review output */}
      {showResult && (
        <div className="card">
          <div className="ch">
            <div>
              <div className="ct">📋 AI Expert Audit Report</div>
              <div className="cs">{reviewing ? 'Analyzing your campaign...' : 'Review complete'}</div>
            </div>
            {!reviewing && text && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn bs sm" onClick={() => { setText(''); setShowResult(false); setActions([]); }}>✕ Close</button>
              </div>
            )}
          </div>
          <AiOutput text={text} id="cr-o" streaming={reviewing} />
        </div>
      )}

      {/* Action checklist */}
      {actions.length > 0 && !reviewing && (
        <div className="card" style={{ borderColor: 'var(--accent-mid)', borderWidth: 2 }}>
          <div className="ch">
            <div>
              <div className="ct">⚡ Recommended Actions ({actions.length})</div>
              <div className="cs">
                {doneCount > 0 || failedCount > 0
                  ? `${doneCount} applied, ${failedCount} failed, ${checkedCount} remaining`
                  : `${checkedCount} of ${actions.length} selected`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button className="btn bs sm" onClick={() => selectAllActions(true)}>Select All</button>
              <button className="btn bs sm" onClick={() => selectAllActions(false)}>Deselect</button>
              <button
                className="btn bp"
                disabled={checkedCount === 0 || applying}
                onClick={() => setConfirming(true)}
              >
                {applying ? <><span className="spin" /> Applying...</> : `Apply ${checkedCount} Changes`}
              </button>
            </div>
          </div>

          {confirming && (
            <div className="al aw" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderWidth: 2 }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>⚠️ Confirm Changes</div>
                <div>You are about to make <b>{checkedCount} changes</b> to your <b>live Google Ads account</b>. This will modify real campaign data and may affect ad delivery.</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button className="btn bp sm" onClick={applyChanges}>Yes, Apply All</button>
                <button className="btn bs sm" onClick={() => setConfirming(false)}>Cancel</button>
              </div>
            </div>
          )}

          <div style={{ marginTop: 4 }}>
            {ACTION_ORDER.map((actionType) => {
              const groupActions = actions.filter((a) => a.type === actionType);
              if (groupActions.length === 0) return null;
              const meta = ACTION_META[actionType];
              return (
                <div key={actionType} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', padding: '8px 0 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{meta.icon}</span> {meta.group} ({groupActions.length})
                  </div>
                  {groupActions.map((a) => {
                    const idx = actions.indexOf(a);
                    const isDone = a.status === 'done';
                    const isFailed = a.status === 'failed';
                    const isExec = a.status === 'executing';
                    return (
                      <div
                        key={idx}
                        className="camp-row"
                        style={{
                          cursor: applying || isDone ? 'default' : 'pointer',
                          opacity: isDone ? 0.6 : 1,
                          background: isFailed ? 'var(--red-soft)' : isDone ? 'var(--green-soft)' : isExec ? 'var(--accent-soft)' : undefined,
                          borderColor: isFailed ? 'var(--red)' : isDone ? '#b2eed9' : isExec ? 'var(--accent-mid)' : undefined,
                        }}
                        onClick={() => !applying && !isDone && toggleAction(idx)}
                      >
                        <input
                          type="checkbox"
                          checked={a.checked}
                          onChange={() => toggleAction(idx)}
                          disabled={applying || isDone}
                          onClick={(e) => e.stopPropagation()}
                          style={{ cursor: 'pointer', accentColor: 'var(--accent)', flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>
                            {describeAction(a)}
                            {a.status !== 'pending' && <span style={{ marginLeft: 6 }}>{STATUS_ICON[a.status]}</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{a.reason}</div>
                          {isFailed && a.error && (
                            <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 2 }}>Error: {a.error}</div>
                          )}
                        </div>
                        <span className={`tag ${meta.color}`} style={{ fontSize: 10 }}>{meta.label}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {doneCount > 0 && !applying && (
            <div className="al as" style={{ marginTop: 12, marginBottom: 0 }}>
              ✅ {doneCount} change{doneCount > 1 ? 's' : ''} applied successfully.
              {failedCount > 0 && ` ${failedCount} failed — check errors above.`}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function StatCard({ label, value, sub, icon }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
      overflow: 'hidden', minWidth: 0,
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ minWidth: 0, overflow: 'hidden' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}
