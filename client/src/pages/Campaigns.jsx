import { useState, useEffect } from 'react';
import useStore from '../store';
import { gads } from '../auth';
import { listCampaigns } from '../api';

function MetricCell({ label, value, sub }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 60 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text2)' }}>{sub}</div>}
    </div>
  );
}

export default function Campaigns() {
  const cr = useStore((s) => s.cr);
  const [campaigns, setCampaigns] = useState([]);
  const [dbCampaigns, setDbCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [adGroups, setAdGroups] = useState([]);
  const [agLoading, setAgLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateRange, setDateRange] = useState('LAST_30_DAYS');
  const [lastRefresh, setLastRefresh] = useState(null);

  useEffect(() => { listCampaigns().then(setDbCampaigns).catch(() => {}); }, []);

  const fetchFromGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await gads('googleAds:searchStream', {
        query: `SELECT campaign.id, campaign.name, campaign.status, campaign.resource_name, campaign_budget.amount_micros, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.all_conversions FROM campaign WHERE campaign.status != 'REMOVED' AND segments.date DURING ${dateRange} ORDER BY metrics.cost_micros DESC LIMIT 50`,
      });
      const rows = d?.[0]?.results || [];
      setCampaigns(rows.map(x => {
        const impr = Number(x.metrics?.impressions || 0);
        const clicks = Number(x.metrics?.clicks || 0);
        const cost = Number(x.metrics?.costMicros || 0) / 1e6;
        const conv = Number(x.metrics?.conversions || 0);
        return {
          id: x.campaign.id,
          name: x.campaign.name,
          status: x.campaign.status,
          resourceName: x.campaign.resourceName,
          budget: x.campaignBudget?.amountMicros ? (Number(x.campaignBudget.amountMicros) / 1e6) : 0,
          impressions: impr,
          clicks,
          cost,
          ctr: impr > 0 ? ((clicks / impr) * 100) : 0,
          conversions: conv,
          cpa: conv > 0 ? (cost / conv) : 0,
        };
      }));
      setLastRefresh(new Date());
      useStore.getState().addToast(`Loaded ${rows.length} campaigns`, 'as');
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const toggleStatus = async (campaign) => {
    const newStatus = campaign.status === 'ENABLED' ? 'PAUSED' : 'ENABLED';
    try {
      await gads('campaigns:mutate', {
        operations: [{ update: { resourceName: campaign.resourceName, status: newStatus }, updateMask: 'status' }],
      });
      setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, status: newStatus } : c));
      useStore.getState().addToast(`${campaign.name} → ${newStatus}`, 'as');
    } catch (e) {
      useStore.getState().addToast('Failed: ' + e.message, 'ae');
    }
  };

  const expandCampaign = async (campaignId) => {
    if (expandedId === campaignId) { setExpandedId(null); return; }
    setExpandedId(campaignId);
    setAgLoading(true);
    setAdGroups([]);
    try {
      const d = await gads('googleAds:searchStream', {
        query: `SELECT ad_group.id, ad_group.name, ad_group.status, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM ad_group WHERE campaign.id = ${campaignId} AND segments.date DURING ${dateRange} ORDER BY metrics.cost_micros DESC`,
      });
      const rows = d?.[0]?.results || [];
      setAdGroups(rows.map(x => ({
        id: x.adGroup.id,
        name: x.adGroup.name,
        status: x.adGroup.status,
        impressions: Number(x.metrics?.impressions || 0),
        clicks: Number(x.metrics?.clicks || 0),
        cost: Number(x.metrics?.costMicros || 0) / 1e6,
        conversions: Number(x.metrics?.conversions || 0),
      })));
    } catch { setAdGroups([]); }
    setAgLoading(false);
  };

  const statusColor = { ENABLED: 'tg', PAUSED: 'ty', REMOVED: 'tr', DRAFT: 'tb' };

  // Filter campaigns
  const filtered = campaigns.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    return true;
  });

  const totalCost = filtered.reduce((s, c) => s + c.cost, 0);
  const totalClicks = filtered.reduce((s, c) => s + c.clicks, 0);
  const totalConv = filtered.reduce((s, c) => s + c.conversions, 0);

  return (
    <>
      {/* Controls */}
      <div className="card">
        <div className="ch">
          <div>
            <div className="ct">📡 Live Campaigns</div>
            <div className="cs">
              {lastRefresh ? `Last refreshed: ${lastRefresh.toLocaleTimeString()}` : 'Connect your Google Ads account to view campaigns'}
            </div>
          </div>
          <button className="btn bp sm" onClick={fetchFromGoogle} disabled={loading}>
            {loading ? <><span className="spin" /> Loading…</> : '🔄 Load from Google Ads'}
          </button>
        </div>

        {campaigns.length > 0 && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search campaigns…" style={{ flex: 1, minWidth: 180, maxWidth: 300 }} />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 130 }}>
              <option value="ALL">All Status</option>
              <option value="ENABLED">Enabled</option>
              <option value="PAUSED">Paused</option>
            </select>
            <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} style={{ width: 150 }}>
              <option value="LAST_7_DAYS">Last 7 days</option>
              <option value="LAST_30_DAYS">Last 30 days</option>
              <option value="THIS_MONTH">This month</option>
              <option value="LAST_MONTH">Last month</option>
            </select>
          </div>
        )}

        {error && <div className="al ae">❌ {error}</div>}

        {/* Summary bar */}
        {campaigns.length > 0 && (
          <div style={{ display: 'flex', gap: 24, padding: '12px 16px', background: 'var(--surface2)', borderRadius: 12, marginBottom: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <MetricCell label="Campaigns" value={filtered.length} />
            <MetricCell label="Total Clicks" value={totalClicks.toLocaleString()} />
            <MetricCell label="Total Spend" value={'$' + totalCost.toFixed(2)} />
            <MetricCell label="Total Conv" value={totalConv.toFixed(1)} />
            <MetricCell label="Avg CPA" value={totalConv > 0 ? '$' + (totalCost / totalConv).toFixed(2) : '—'} />
          </div>
        )}

        {/* Campaign rows */}
        {filtered.length > 0 ? filtered.map(c => (
          <div key={c.id}>
            <div className="camp-row" style={{ cursor: 'pointer', borderColor: expandedId === c.id ? 'var(--accent-mid)' : undefined }} onClick={() => expandCampaign(c.id)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {expandedId === c.id ? '▾' : '▸'} {c.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  ID: {c.id} · ${c.budget.toFixed(0)}/day
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
                <MetricCell label="Impr" value={c.impressions.toLocaleString()} />
                <MetricCell label="Clicks" value={c.clicks.toLocaleString()} />
                <MetricCell label="CTR" value={c.ctr.toFixed(1) + '%'} />
                <MetricCell label="Cost" value={'$' + c.cost.toFixed(2)} />
                <MetricCell label="Conv" value={c.conversions.toFixed(1)} />
                <MetricCell label="CPA" value={c.cpa > 0 ? '$' + c.cpa.toFixed(2) : '—'} />
                <button
                  className={`btn sm ${c.status === 'ENABLED' ? 'bg' : 'bs'}`}
                  onClick={(e) => { e.stopPropagation(); toggleStatus(c); }}
                  style={{ minWidth: 80 }}
                >
                  {c.status === 'ENABLED' ? '⏸ Pause' : '▶ Enable'}
                </button>
                <span className={`tag ${statusColor[c.status] || 'tb'}`}>{c.status}</span>
              </div>
            </div>

            {/* Expanded: Ad group breakdown */}
            {expandedId === c.id && (
              <div style={{ marginLeft: 24, marginBottom: 12, padding: '12px 16px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                {agLoading ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--muted)', fontSize: 13 }}><span className="spin-dark" /> Loading ad groups…</div>
                ) : adGroups.length > 0 ? (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Ad Groups ({adGroups.length})</div>
                    {adGroups.map(ag => (
                      <div key={ag.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                        <div style={{ flex: 1, fontWeight: 600 }}>{ag.name}</div>
                        <span style={{ color: 'var(--muted)', minWidth: 60, textAlign: 'right' }}>{ag.impressions.toLocaleString()} impr</span>
                        <span style={{ color: 'var(--text2)', minWidth: 50, textAlign: 'right' }}>{ag.clicks} clicks</span>
                        <span style={{ color: 'var(--text)', minWidth: 60, textAlign: 'right' }}>${ag.cost.toFixed(2)}</span>
                        <span style={{ color: ag.conversions > 0 ? 'var(--green)' : 'var(--muted)', minWidth: 40, textAlign: 'right' }}>{ag.conversions.toFixed(1)} conv</span>
                        <span className={`tag ${statusColor[ag.status] || 'tb'}`} style={{ fontSize: 10 }}>{ag.status}</span>
                      </div>
                    ))}
                  </>
                ) : (
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>No ad groups found for this campaign.</div>
                )}
              </div>
            )}
          </div>
        )) : campaigns.length === 0 && dbCampaigns.length > 0 ? (
          <>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 8 }}>📋 Campaign History (from database)</div>
            {dbCampaigns.map(c => (
              <div key={c.id} className="camp-row">
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.googleCampaignId ? `ID: ${c.googleCampaignId} · ` : ''}${c.dailyBudget || '—'}/day · {c.biddingStrategy || '—'}</div>
                </div>
                <span className={`tag ${statusColor[c.status] || 'tb'}`}>{c.status}</span>
              </div>
            ))}
          </>
        ) : (
          <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '36px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📡</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>No campaigns loaded</div>
            <div style={{ fontSize: 12 }}>Click "Load from Google Ads" above or create a campaign via the Builder.</div>
          </div>
        )}
      </div>
    </>
  );
}
