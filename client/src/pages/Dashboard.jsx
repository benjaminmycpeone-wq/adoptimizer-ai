import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../store';
import StatCard from '../components/StatCard';
import { checkHealth } from '../api';

export default function Dashboard() {
  const stats = useStore((s) => s.stats);
  const acts = useStore((s) => s.acts);
  const setScraperOnline = useStore((s) => s.setScraperOnline);
  const navigate = useNavigate();

  useEffect(() => {
    checkHealth().then(setScraperOnline);
    const id = setInterval(() => checkHealth().then(setScraperOnline), 30000);
    return () => clearInterval(id);
  }, [setScraperOnline]);

  return (
    <>
      <div className="hero">
        <h2>Welcome to AdOptimizer AI ⚡</h2>
        <p>Scrape a client site → AI generates keywords & ad copy → launch straight to Google Ads.</p>
      </div>

      <div className="g4" style={{ marginBottom: 18 }}>
        <StatCard label="Campaigns" value={stats.c} />
        <StatCard label="Keywords" value={stats.k} />
        <StatCard label="Ad Copies" value={stats.a} />
        <StatCard label="Sites Scraped" value={stats.p} />
      </div>

      <div className="g2">
        <div className="card">
          <div className="ch"><div className="ct">🚀 3-Step Workflow</div></div>
          <div className="qa">
            <div className="qa-item" onClick={() => navigate('/scraper')}>
              <div className="qa-num">1</div>
              <div className="qa-text"><h4>Scrape Client Site</h4><p>Auto-detect services, USPs & locations</p></div>
            </div>
            <div className="qa-item" onClick={() => navigate('/builder')}>
              <div className="qa-num">2</div>
              <div className="qa-text"><h4>Build Campaign</h4><p>AI keywords, ad copy & settings</p></div>
            </div>
            <div className="qa-item" onClick={() => navigate('/api-key')}>
              <div className="qa-num" style={{ background: 'var(--muted)' }}>A</div>
              <div className="qa-text"><h4>Set AI Key</h4><p>Anthropic, OpenAI or OpenRouter</p></div>
            </div>
            <div className="qa-item" onClick={() => navigate('/credentials')}>
              <div className="qa-num" style={{ background: 'var(--muted)' }}>B</div>
              <div className="qa-text"><h4>Google Ads Creds</h4><p>Dev token, OAuth & refresh token</p></div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="ch"><div className="ct">🕐 Recent Activity</div></div>
          {acts.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>
              No activity yet.
            </div>
          ) : (
            acts.slice(0, 8).map((a, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', padding: '8px 0',
                borderBottom: '1px solid var(--border)', fontSize: '12.5px'
              }}>
                <span style={{ color: 'var(--text2)' }}>{a.msg}</span>
                <span style={{ color: 'var(--muted)', flexShrink: 0, marginLeft: 12 }}>{a.t}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
