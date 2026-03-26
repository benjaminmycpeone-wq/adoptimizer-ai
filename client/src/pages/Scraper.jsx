import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../store';
import ChipList from '../components/ChipList';
import AlertBanner from '../components/AlertBanner';
import { checkHealth, scrapeUrl } from '../api';

function QualityBadge({ score }) {
  const level = score >= 7 ? 'tg' : score >= 4 ? 'ty' : 'tr';
  const label = score >= 7 ? 'Good' : score >= 4 ? 'Fair' : 'Poor';
  return <span className={`tag ${level}`}>{score}/10 — {label}</span>;
}

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

  // Editable chip state
  const [services, setServices] = useState([]);
  const [audience, setAudience] = useState([]);
  const [usps, setUsps] = useState([]);

  useEffect(() => {
    checkHealth().then(setScraperOnline);
    const id = setInterval(() => checkHealth().then(setScraperOnline), 30000);
    return () => clearInterval(id);
  }, [setScraperOnline]);

  const scrape = async () => {
    if (!url.trim()) { useStore.getState().addToast('Enter a URL first', 'aw'); return; }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const d = await scrapeUrl(url);
      setResult(d);
      setServices(d.services || []);
      setAudience(d.targetAudience || d.targetClients || []);
      setUsps(d.usps || d.differentiators || []);
      setScrapeResult(d);
      incStat('p');
      log('Scraped: ' + d.firmName);
      useStore.getState().addToast(`Analyzed ${d.firmName} — ${(d.services || []).length} services detected`, 'as');
    } catch (e) {
      setError(e.message);
      setManualOpen(true);
      log('Scrape failed: ' + e.message.slice(0, 60));
    }
    setLoading(false);
  };

  const sendToBuilder = () => {
    if (!result) return;
    // Pass full Google Ads Brief to builder
    setBuilder({
      name: result.firmName || '',
      loc: (result.locations || [])[0] || '',
      cat: result.category || '',
      svc: services.join(', '),
      aud: audience.join(', '),
      usp: usps.join(', '),
      website: result.websiteUrl || url,
      targetLocations: (result.locations || []).join('; '),
    });
    // Store the full scrape result for the AI strategist
    setScrapeResult({ ...result, services, targetAudience: audience, usps });
    navigate('/builder');
  };

  const sendManualToBuilder = () => {
    const manualResult = {
      firmName: mFn, category: 'Other', services: mSvc.split(',').map(s => s.trim()).filter(Boolean),
      targetAudience: mTc.split(',').map(s => s.trim()).filter(Boolean),
      usps: mDf.split(',').map(s => s.trim()).filter(Boolean),
      locations: mLoc ? [mLoc] : [], websiteUrl: '', summary: '', headings: [],
      ctaPatterns: [], pricingSignals: [], competitiveAngles: mDf.split(',').map(s => s.trim()).filter(Boolean),
      landingPageQuality: { score: 0, hasForm: false, hasPhone: false, hasCTA: false },
      rawText: `${mFn} offering ${mSvc} in ${mLoc}. USPs: ${mDf}. Target: ${mTc}.`,
    };
    setScrapeResult(manualResult);
    setBuilder({
      name: mFn, loc: mLoc, svc: mSvc, aud: mTc, usp: mDf,
      website: '', targetLocations: mLoc,
    });
    navigate('/builder');
  };

  const lpq = result?.landingPageQuality;

  return (
    <>
      {/* Scrape input */}
      <div className="card card-gradient">
        <div className="ch">
          <div>
            <div className="ct">🔍 Analyze Client Website</div>
            <div className="cs">Extract Google Ads-ready data: services, USPs, locations, landing page quality</div>
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
            </div>
          </div>
        )}

        <div className="sb" style={{ marginBottom: 10 }}>
          <input
            type="url" value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.clientwebsite.com"
            onKeyDown={(e) => e.key === 'Enter' && scrape()}
          />
          <button className="btn bp" onClick={scrape} disabled={loading}>
            {loading ? <><span className="spin" /> Analyzing…</> : '🔍 Analyze Site'}
          </button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          Extracts services, locations, USPs, CTAs, credentials, and landing page quality for Google Ads setup.
        </div>
      </div>

      {error && (
        <AlertBanner type="ae" message={`Analysis failed: ${error}\nUse Manual Entry below instead.`} />
      )}

      {/* Google Ads Brief */}
      {result && !error && (
        <>
          <div className="card" style={{ borderColor: 'var(--accent-mid)', borderWidth: 2 }}>
            <div className="ch">
              <div>
                <div className="ct">📊 Google Ads Brief — {result.firmName}</div>
                <div className="cs">Review the analysis, edit as needed, then build your campaign</div>
              </div>
              <button className="btn bp" onClick={sendToBuilder}>🚀 Build Campaign →</button>
            </div>

            {/* Summary row */}
            <div className="g3" style={{ marginBottom: 16, gap: 12 }}>
              <div className="sc">
                <div className="sl">Category</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{result.category || 'Other'}</div>
              </div>
              <div className="sc">
                <div className="sl">Landing Page Score</div>
                <div style={{ marginTop: 4 }}>{lpq ? <QualityBadge score={lpq.score} /> : '—'}</div>
              </div>
              <div className="sc">
                <div className="sl">Locations</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>
                  {(result.locations || []).join(', ') || 'Not detected'}
                </div>
              </div>
            </div>

            {/* Landing page quality breakdown */}
            {lpq && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                {[
                  ['📞 Phone', lpq.hasPhone], ['📋 Form', lpq.hasForm], ['🔘 CTA Buttons', lpq.hasCTA],
                  ['⭐ Testimonials', lpq.hasTestimonials], ['📄 Clear Services', lpq.hasClearServices],
                  ['🏆 Trust Signals', lpq.hasTrustSignals],
                ].map(([label, has]) => (
                  <span key={label} className={`tag ${has ? 'tg' : 'tr'}`} style={{ fontSize: 11 }}>
                    {has ? '✓' : '✗'} {label}
                  </span>
                ))}
              </div>
            )}

            {/* Editable fields */}
            <div className="g2" style={{ gap: 16 }}>
              <div>
                <div className="fg">
                  <label>Business Name</label>
                  <input value={result.firmName || ''} onChange={(e) => setResult({ ...result, firmName: e.target.value })} />
                </div>
                <div className="fg">
                  <label>Services (for keyword themes)</label>
                  <ChipList items={services} onChange={setServices} />
                </div>
                <div className="fg" style={{ marginTop: 12 }}>
                  <label>Target Audience</label>
                  <ChipList items={audience} onChange={setAudience} />
                </div>
                <div className="fg" style={{ marginTop: 12 }}>
                  <label>USPs & Differentiators (for ad copy)</label>
                  <ChipList items={usps} onChange={setUsps} />
                </div>
              </div>

              <div>
                <div className="fg">
                  <label>Locations (for geo-targeting)</label>
                  <input value={(result.locations || []).join('; ')} onChange={(e) => setResult({ ...result, locations: e.target.value.split(';').map(s => s.trim()).filter(Boolean) })} />
                </div>
                {(result.competitiveAngles || []).length > 0 && (
                  <div className="fg">
                    <label>Competitive Angles (credentials, experience)</label>
                    <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                      {result.competitiveAngles.map((a, i) => (
                        <span key={i} className="tag tb" style={{ marginRight: 6, marginBottom: 4, display: 'inline-flex' }}>{a}</span>
                      ))}
                    </div>
                  </div>
                )}
                {(result.ctaPatterns || []).length > 0 && (
                  <div className="fg">
                    <label>CTAs Found on Site (ad copy inspiration)</label>
                    <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                      {result.ctaPatterns.map((c, i) => (
                        <span key={i} className="tag tg" style={{ marginRight: 6, marginBottom: 4, display: 'inline-flex' }}>{c}</span>
                      ))}
                    </div>
                  </div>
                )}
                {(result.pricingSignals || []).length > 0 && (
                  <div className="fg">
                    <label>Pricing Signals</label>
                    <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                      {result.pricingSignals.join(' · ')}
                    </div>
                  </div>
                )}
                {result.phone && (
                  <div className="fg">
                    <label>Phone</label>
                    <div style={{ fontSize: 13, color: 'var(--text)' }}>{result.phone}</div>
                  </div>
                )}
                {result.summary && (
                  <div className="fg">
                    <label>Business Summary</label>
                    <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{result.summary}</div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
              <button className="btn bp" onClick={sendToBuilder}>🚀 Build Campaign with AI →</button>
              <button className="btn bs" onClick={() => { setResult(null); setError(null); }}>↻ Re-analyze</button>
            </div>
          </div>
        </>
      )}

      {/* Manual Entry */}
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
            <div className="fg"><label>USPs / Differentiators</label><input value={mDf} onChange={(e) => setMDf(e.target.value)} placeholder="Free consultation, 15+ years exp, CPA certified" /></div>
            <button className="btn bp" onClick={sendManualToBuilder}>🚀 Build Campaign →</button>
          </div>
        )}
      </div>
    </>
  );
}
