import { useState, useEffect } from 'react';
import useStore from '../store';
import { gads } from '../auth';
import { listCampaigns } from '../api';

export default function Campaigns() {
  const cr = useStore((s) => s.cr);
  const [campaigns, setCampaigns] = useState([]);
  const [dbCampaigns, setDbCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load DB campaigns on mount
  useEffect(() => {
    listCampaigns().then(setDbCampaigns).catch(() => {});
  }, []);

  const fetchFromGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await gads('googleAds:searchStream', {
        query: 'SELECT campaign.id, campaign.name, campaign.status, campaign_budget.amount_micros FROM campaign ORDER BY campaign.id DESC LIMIT 25',
      });
      const rows = d?.[0]?.results || [];
      setCampaigns(rows.map((x) => ({
        id: x.campaign.id,
        name: x.campaign.name,
        status: x.campaign.status,
        budget: x.campaignBudget?.amountMicros
          ? '$' + (parseInt(x.campaignBudget.amountMicros) / 1e6).toFixed(0) + '/day'
          : '—',
      })));
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const statusColor = { ENABLED: 'tg', PAUSED: 'ty', REMOVED: 'tr', DRAFT: 'tb' };

  return (
    <div className="card">
      <div className="ch">
        <div>
          <div className="ct">📡 Live Campaigns</div>
          <div className="cs">Campaigns from your connected Google Ads account</div>
        </div>
        <button className="btn bs sm" onClick={fetchFromGoogle} disabled={loading}>
          {loading ? <><span className="spin-dark" /> Loading…</> : '🔄 Load from Google Ads'}
        </button>
      </div>

      {error && (
        <div className="al ae">❌ {error}</div>
      )}

      {campaigns.length > 0 ? (
        campaigns.map((c) => (
          <div key={c.id} className="camp-row">
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>ID: {c.id} · {c.budget}</div>
            </div>
            <span className={`tag ${statusColor[c.status] || 'tb'}`}>{c.status}</span>
          </div>
        ))
      ) : dbCampaigns.length > 0 ? (
        <>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 8 }}>
            📋 Campaign History (from database)
          </div>
          {dbCampaigns.map((c) => (
            <div key={c.id} className="camp-row">
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {c.googleCampaignId ? `ID: ${c.googleCampaignId} · ` : ''}
                  ${c.dailyBudget || '—'}/day · {c.biddingStrategy || '—'}
                </div>
              </div>
              <span className={`tag ${statusColor[c.status] || 'tb'}`}>{c.status}</span>
            </div>
          ))}
        </>
      ) : (
        <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '36px 0' }}>
          No campaigns loaded. Click "Load from Google Ads" or create one via Campaign Builder.
        </div>
      )}
    </div>
  );
}
