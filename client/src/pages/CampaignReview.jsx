import { useState, useEffect } from 'react';
import useStore from '../store';
import { gads } from '../auth';
import { callAI } from '../api';
import { PROMPTS } from '../constants';
import AiOutput from '../components/AiOutput';

function parseActions(text) {
  const actions = [];
  const regex = /```json\s*\n?([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.type && ['ADD_NEGATIVE', 'PAUSE_KEYWORD', 'ADD_KEYWORD', 'PAUSE_AD', 'UPDATE_BUDGET'].includes(parsed.type)) {
        actions.push({ ...parsed, checked: true, status: 'pending' });
      }
    } catch { /* skip non-parseable blocks */ }
  }
  return actions;
}

function describeAction(a) {
  switch (a.type) {
    case 'ADD_NEGATIVE': return `Add negative keyword: "${a.keyword}" (${a.matchType})`;
    case 'PAUSE_KEYWORD': return `Pause keyword: "${a.keyword}"`;
    case 'ADD_KEYWORD': return `Add keyword: "${a.keyword}" (${a.matchType})`;
    case 'PAUSE_AD': return `Pause ad`;
    case 'UPDATE_BUDGET': return `Update daily budget to $${a.newBudget}`;
    default: return a.type;
  }
}

const ACTION_ICONS = {
  ADD_NEGATIVE: '🚫', PAUSE_KEYWORD: '⏸️', ADD_KEYWORD: '➕', PAUSE_AD: '⏸️', UPDATE_BUDGET: '💰',
};
const STATUS_LABELS = {
  pending: '', executing: '⏳', done: '✅', failed: '❌',
};

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

  // Action checklist state
  const [actions, setActions] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [applying, setApplying] = useState(false);

  // Parse actions when AI review completes
  useEffect(() => {
    if (text && !reviewing) {
      const parsed = parseActions(text);
      if (parsed.length > 0) setActions(parsed);
    }
  }, [text, reviewing]);

  const fetchCampaigns = async () => {
    setLoading(true);
    setError(null);
    setSelected(null);
    setCampaignData(null);
    setActions([]);
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
            return `- [${r.adGroup.name}] ${r.adGroupCriterion.keyword.text} (${r.adGroupCriterion.keyword.matchType})${qs ? ` QS:${qs}` : ''} [resource: ${r.adGroupCriterion.resourceName}] [adGroup: ${r.adGroup.resourceName}]`;
          }).join('\n')
        : 'No keywords found.';

      const adsFormatted = adRows.length
        ? adRows.map((r) => {
            const ad = r.adGroupAd?.ad || {};
            const headlines = ad.responsiveSearchAd?.headlines?.map((h) => h.text).join(' | ') || 'N/A';
            const descs = ad.responsiveSearchAd?.descriptions?.map((d) => d.text).join(' | ') || 'N/A';
            const urls = ad.finalUrls?.join(', ') || 'N/A';
            return `- [${r.adGroup.name}] Headlines: ${headlines}\n  Descriptions: ${descs}\n  URLs: ${urls} | Strength: ${r.adGroupAd?.adStrength || 'N/A'} [resource: ${r.adGroupAd.resourceName}]`;
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

      setCampaignData({
        adGroups: agRows.length,
        keywords: kwRows.length,
        ads: adRows.length,
        searchTerms: stRows.length,
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
      const prompt = PROMPTS.campaignReview({
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
      const result = await callAI(prompt, (_, full) => setText(full));
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

  const executeAction = async (action) => {
    const cid = cr.cu || cr.mcc;
    switch (action.type) {
      case 'ADD_NEGATIVE':
        return gads('campaignCriteria:mutate', {
          operations: [{
            create: {
              campaign: selected.resourceName,
              criterion: { keyword: { text: action.keyword, matchType: action.matchType } },
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
        return gads('adGroupCriteria:mutate', {
          operations: [{
            create: {
              adGroup: action.adGroupResource,
              status: 'ENABLED',
              keyword: { text: action.keyword, matchType: action.matchType },
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
    const checkedIndexes = actions.map((a, i) => a.checked ? i : -1).filter((i) => i >= 0);

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

  const checkedCount = actions.filter((a) => a.checked).length;
  const statusColor = { ENABLED: 'tg', PAUSED: 'ty', REMOVED: 'tr' };

  return (
    <>
      <div className="card">
        <div className="ch">
          <div>
            <div className="ct">🔎 Campaign Review</div>
            <div className="cs">AI-powered expert audit of your Google Ads campaigns</div>
          </div>
          <button className="btn bs sm" onClick={fetchCampaigns} disabled={loading}>
            {loading ? <><span className="spin-dark" /> Loading...</> : '🔄 Load Campaigns'}
          </button>
        </div>

        {error && <div className="al ae">❌ {error}</div>}

        {campaigns.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {campaigns.map((c) => (
              <div
                key={c.id}
                className="camp-row"
                style={{
                  cursor: 'pointer',
                  background: selected?.id === c.id ? 'var(--primary-light, #eef2ff)' : undefined,
                  borderColor: selected?.id === c.id ? 'var(--primary, #6366f1)' : undefined,
                }}
                onClick={() => selectCampaign(c)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {c.budget} · {c.bidding}
                  </div>
                </div>
                <span className={`tag ${statusColor[c.status] || 'tb'}`}>{c.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="card card-gradient">
          <div className="ch">
            <div>
              <div className="ct">{selected.name}</div>
              <div className="cs">
                {fetching
                  ? 'Loading campaign data...'
                  : campaignData
                    ? `${campaignData.adGroups} ad groups · ${campaignData.keywords} keywords · ${campaignData.ads} ads · ${campaignData.searchTerms} search terms`
                    : 'Select a campaign above'}
              </div>
            </div>
            <button
              className="btn bp"
              onClick={reviewCampaign}
              disabled={!campaignData || reviewing}
            >
              {reviewing ? <><span className="spin" /> Reviewing...</> : '🤖 Review with AI'}
            </button>
          </div>

          {fetching && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)' }}>
              <span className="spin-dark" /> Fetching ad groups, keywords, and ads...
            </div>
          )}

          {campaignData && !fetching && (
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              <div className="stat-mini">
                <div style={{ fontSize: 20, fontWeight: 700 }}>{campaignData.adGroups}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Ad Groups</div>
              </div>
              <div className="stat-mini">
                <div style={{ fontSize: 20, fontWeight: 700 }}>{campaignData.keywords}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Keywords</div>
              </div>
              <div className="stat-mini">
                <div style={{ fontSize: 20, fontWeight: 700 }}>{campaignData.ads}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Ads</div>
              </div>
              <div className="stat-mini">
                <div style={{ fontSize: 20, fontWeight: 700 }}>{campaignData.searchTerms}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Search Terms</div>
              </div>
              <div className="stat-mini">
                <div style={{ fontSize: 14, fontWeight: 700 }}>{selected.budget}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Budget</div>
              </div>
              <div className="stat-mini">
                <div style={{ fontSize: 14, fontWeight: 700 }}>{selected.bidding}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Bidding</div>
              </div>
            </div>
          )}
        </div>
      )}

      {showResult && (
        <div className="card">
          <div className="ch">
            <div><div className="ct">📋 AI Expert Review</div></div>
          </div>
          <AiOutput text={text} id="cr-o" />
        </div>
      )}

      {actions.length > 0 && !reviewing && (
        <div className="card">
          <div className="ch">
            <div>
              <div className="ct">⚡ Recommended Actions</div>
              <div className="cs">{checkedCount} of {actions.length} selected</div>
            </div>
            <button
              className="btn bp"
              disabled={checkedCount === 0 || applying}
              onClick={() => setConfirming(true)}
            >
              {applying ? <><span className="spin" /> Applying...</> : `Apply ${checkedCount} Changes`}
            </button>
          </div>

          {confirming && (
            <div className="al aw" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <b>Confirm:</b> You are about to make <b>{checkedCount} changes</b> to your live Google Ads account. This will modify campaign data. Proceed?
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button className="btn bp sm" onClick={applyChanges}>Yes, Apply</button>
                <button className="btn bs sm" onClick={() => setConfirming(false)}>Cancel</button>
              </div>
            </div>
          )}

          <div style={{ marginTop: 8 }}>
            {actions.map((a, i) => (
              <div
                key={i}
                className="camp-row"
                style={{
                  opacity: a.status === 'done' ? 0.6 : 1,
                  cursor: applying ? 'default' : 'pointer',
                  background: a.status === 'failed' ? '#fef2f2' : a.status === 'done' ? '#f0fdf4' : undefined,
                }}
                onClick={() => !applying && toggleAction(i)}
              >
                <input
                  type="checkbox"
                  checked={a.checked}
                  onChange={() => toggleAction(i)}
                  disabled={applying || a.status === 'done'}
                  style={{ marginRight: 8, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 16, marginRight: 8 }}>{ACTION_ICONS[a.type] || '📌'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {describeAction(a)}
                    {a.status !== 'pending' && (
                      <span style={{ marginLeft: 8 }}>{STATUS_LABELS[a.status]}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {a.reason}
                    {a.status === 'failed' && a.error && (
                      <span style={{ color: '#ef4444', marginLeft: 8 }}>Error: {a.error}</span>
                    )}
                  </div>
                </div>
                <span className={`tag ${
                  a.type === 'ADD_NEGATIVE' ? 'tr' :
                  a.type === 'PAUSE_KEYWORD' || a.type === 'PAUSE_AD' ? 'ty' :
                  a.type === 'ADD_KEYWORD' ? 'tg' :
                  'tb'
                }`} style={{ fontSize: 10 }}>{a.type.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
