import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../store';
import ChipList from '../components/ChipList';
import AlertBanner from '../components/AlertBanner';
import { checkHealth, scrapeUrl } from '../api';

export default function Scraper() {
  const { scraperOnline, setScraperOnline, setScrapeResult, incStat, log, setBuilder } = useStore();
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);

  // Manual entry fields
  const [mFn, setMFn] = useState('');
  const [mLoc, setMLoc] = useState('');
  const [mSvc, setMSvc] = useState('');
  const [mTc, setMTc] = useState('');
  const [mDf, setMDf] = useState('');
  const [mSum, setMSum] = useState('');

  // Local chip state
  const [services, setServices] = useState([]);
  const [clients, setClients] = useState([]);
  const [diffs, setDiffs] = useState([]);

  useEffect(() => {
    checkHealth().then(setScraperOnline);
    const id = setInterval(() => checkHealth().then(setScraperOnline), 30000);
    return () => clearInterval(id);
  }, [setScraperOnline]);

  const scrape = async () => {
    if (!url.trim()) { alert('Enter a URL'); return; }
    setLoading(true);
    setError(null);
    try {
      const d = await scrapeUrl(url);
      setResult(d);
      setServices(d.services || []);
      setClients(d.targetClients || []);
      setDiffs(d.differentiators || []);
      setScrapeResult(d);
      incStat('p');
      log('Scraped: ' + d.firmName);
    } catch (e) {
      setError(e.message);
      setResult({ firmName: '', summary: '', locations: [] });
      setManualOpen(true);
      log('Scrape failed: ' + e.message.slice(0, 60));
    }
    setLoading(false);
  };

  const sendToBuilder = () => {
    if (!result) return;
    const svcText = services.join(', ');
    const audText = clients.join(', ');
    const uspText = diffs.join(', ');
    const loc = result.locations?.join('; ') || '';
    setBuilder({
      name: result.firmName || '',
      loc: loc.split(';')[0]?.trim() || '',
      svc: svcText,
      aud: audText,
      usp: uspText,
      targetLocations: loc,
    });
    navigate('/builder');
  };

  const sendManualToBuilder = () => {
    setBuilder({
      name: mFn,
      loc: mLoc,
      svc: mSvc,
      aud: mTc,
      usp: mDf,
      targetLocations: mLoc,
    });
    navigate('/builder');
  };

  return (
    <>
      <div className="card card-gradient">
        <div className="ch">
          <div>
            <div className="ct">🔍 Website Scraper</div>
            <div className="cs">Auto-detect services, locations & USPs from any client site</div>
          </div>
          <span className={`tag ${scraperOnline ? 'tg' : 'tr'}`}>
            ● {scraperOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        {!scraperOnline && (
          <div className="scr-setup">
            <h4>💻 Start the server first</h4>
            <div className="steps">
              <div className="step"><span>1.</span><code>cd server && pip install -r requirements.txt</code></div>
              <div className="step"><span>2.</span><code>playwright install chromium</code></div>
              <div className="step"><span>3.</span><code>python -m server.app</code></div>
              <div className="step">
                <span style={{ color: 'var(--muted)' }}>→</span>
                <span style={{ color: 'var(--muted)' }}>Runs at http://localhost:5055</span>
              </div>
            </div>
          </div>
        )}

        <div className="sb" style={{ marginBottom: 10 }}>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.clientwebsite.com"
            onKeyDown={(e) => e.key === 'Enter' && scrape()}
          />
          <button className="btn bp" onClick={scrape} disabled={loading}>
            {loading ? <><span className="spin" /> Scraping…</> : '🔍 Scrape'}
          </button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          💡 If scraping fails (some sites block bots), use <b>Manual Entry</b> below to fill in details directly.
        </div>
      </div>

      {error && (
        <AlertBanner type="ae" message={`Scraping failed: ${error}\nMany sites (Cloudflare, protected pages) block automated scrapers. Use Manual Entry below instead.`} />
      )}

      {result && (
        <div className="card">
          <div className="ch">
            <div>
              <div className="ct">{error ? '⚠️ Scrape Failed' : (result.firmName || 'Results')}</div>
              <div className="cs">Review & edit, then send to Campaign Builder</div>
            </div>
            {!error && (
              <button className="btn bp" onClick={sendToBuilder}>→ Send to Builder</button>
            )}
          </div>
          {!error && (
            <div className="g2">
              <div>
                <div className="fg">
                  <label>Firm Name</label>
                  <input value={result.firmName || ''} onChange={(e) => setResult({ ...result, firmName: e.target.value })} />
                </div>
                <div className="fg">
                  <label>Summary / Description</label>
                  <textarea rows={3} value={result.summary || ''} onChange={(e) => setResult({ ...result, summary: e.target.value })} />
                </div>
                <div className="fg">
                  <label>Locations Detected</label>
                  <input value={result.locations?.join('; ') || ''} onChange={(e) => setResult({ ...result, locations: e.target.value.split(';').map(s => s.trim()) })} />
                </div>
              </div>
              <div>
                <div className="fg">
                  <label>Services <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(click × to remove)</span></label>
                  <ChipList items={services} onChange={setServices} />
                </div>
                <div className="fg" style={{ marginTop: 12 }}>
                  <label>Target Clients</label>
                  <ChipList items={clients} onChange={setClients} />
                </div>
                <div className="fg" style={{ marginTop: 12 }}>
                  <label>Differentiators / USPs</label>
                  <ChipList items={diffs} onChange={setDiffs} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="ch">
          <div>
            <div className="ct">✏️ Manual Entry</div>
            <div className="cs">Skip scraping — fill in client details directly</div>
          </div>
          <button className="btn bs sm" onClick={() => setManualOpen(!manualOpen)}>
            {manualOpen ? '▴ Collapse' : '▾ Expand'}
          </button>
        </div>
        {manualOpen && (
          <div>
            <div className="fr">
              <div className="fg"><label>Business Name</label><input value={mFn} onChange={(e) => setMFn(e.target.value)} placeholder="Smith CPA" /></div>
              <div className="fg"><label>Location</label><input value={mLoc} onChange={(e) => setMLoc(e.target.value)} placeholder="Austin, TX" /></div>
            </div>
            <div className="fg"><label>Services (comma-separated)</label><input value={mSvc} onChange={(e) => setMSvc(e.target.value)} placeholder="Tax Prep, Bookkeeping, Payroll, IRS Rep" /></div>
            <div className="fg"><label>Target Clients</label><input value={mTc} onChange={(e) => setMTc(e.target.value)} placeholder="Small businesses, Self-employed, Investors" /></div>
            <div className="fg"><label>USPs / Differentiators</label><input value={mDf} onChange={(e) => setMDf(e.target.value)} placeholder="Free consultation, 15+ years exp, Flat-fee pricing" /></div>
            <div className="fg"><label>Summary</label><textarea rows={2} value={mSum} onChange={(e) => setMSum(e.target.value)} placeholder="Brief description of the firm…" /></div>
            <button className="btn bp" onClick={sendManualToBuilder}>→ Send to Builder</button>
          </div>
        )}
      </div>
    </>
  );
}
