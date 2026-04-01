import { useState, useEffect, useCallback } from 'react';
import * as api from '../../monitorApi';

const CAT_CLASSES = ['tax','audit','advisory','accounting','wealth','technology','international'];

export default function Trends() {
  const [days, setDays] = useState(7);
  const [keywords, setKeywords] = useState([]);
  const [categories, setCategories] = useState([]);
  const [topics, setTopics] = useState([]);
  const [selectedKw, setSelectedKw] = useState(null);
  const [kwDetail, setKwDetail] = useState(null);
  const [history, setHistory] = useState([]);
  const [samples, setSamples] = useState([]);
  const [hasData, setHasData] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const loadAll = useCallback(() => {
    loadKeywords();
    loadCategories();
    loadTopics();
  }, [days]);

  useEffect(() => { loadAll(); }, [days]);

  const loadKeywords = async () => {
    try {
      const data = await api.getTrendingKeywords({ days, limit: 50 });
      const kws = Array.isArray(data) ? data : (data.keywords || []);
      setKeywords(kws);
      setHasData(kws.length > 0);
    } catch (e) { setHasData(false); }
  };

  const loadCategories = async () => {
    try {
      const data = await api.getCategories({ days });
      setCategories(Array.isArray(data) ? data : (data.categories || []));
    } catch (e) { setCategories([]); }
  };

  const loadTopics = async () => {
    try {
      const data = await api.getTrendingTopics({ days: 7, limit: 20 });
      setTopics(Array.isArray(data) ? data : (data.topics || []));
    } catch (e) { setTopics([]); }
  };

  const selectKeyword = async (kw) => {
    setSelectedKw(kw.keyword);
    setKwDetail(kw);
    try {
      const h = await api.getKeywordHistory(kw.keyword, { days });
      setHistory(h.history || h.weeks || h.data || []);
      setSamples(h.sample_articles || h.sample_topics || h.samples || []);
    } catch (e) {
      setHistory([]);
      setSamples([]);
    }
  };

  const handleSnapshot = async () => {
    try {
      const data = await api.takeSnapshot();
      showToast(`Snapshot complete${data.keywords_found ? ' - ' + data.keywords_found + ' keywords found' : ''}`);
      loadAll();
    } catch (e) { showToast('Snapshot failed', 'error'); }
  };

  const handleRecompute = async () => {
    try {
      await api.recomputeMatches();
      showToast('Recompute complete');
      loadAll();
    } catch (e) { showToast('Recompute failed', 'error'); }
  };

  const maxCat = categories.length > 0 ? Math.max(...categories.map(c => c.count || c.value || 0), 1) : 1;
  const catTotal = categories.reduce((s, c) => s + (c.count || c.value || 0), 0) || 1;
  const maxHist = history.length > 0 ? Math.max(...history.map(w => w.count || w.value || 0), 1) : 1;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 className="ct" style={{ fontSize: 20, marginBottom: 4 }}>Trends & Keywords</h2>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Analyze trending keywords, category distribution, and topic velocity</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="mon-pill-group">
            {[7, 30, 90].map(d => (
              <button key={d} className={`mon-pill${days === d ? ' active' : ''}`} onClick={() => { setDays(d); setSelectedKw(null); }}>{d}d</button>
            ))}
          </div>
          <button className="btn bs" onClick={handleSnapshot}>Take Snapshot</button>
          <button className="btn bp" onClick={handleRecompute}>Recompute</button>
        </div>
      </div>

      {!hasData ? (
        <div className="card">
          <div className="mon-empty-state">
            <div className="mon-empty-icon" style={{ fontSize: 48 }}>&#128200;</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>No trends data yet</div>
            <div className="mon-empty-text">Click "Take Snapshot" to analyze current topics.</div>
          </div>
        </div>
      ) : (
        <div className="mon-columns">
          {/* Left Column */}
          <div>
            {/* Keywords Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="ct">Trending Keywords</span>
                <span style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--surface2)', padding: '2px 10px', borderRadius: 20 }}>{keywords.length} keywords</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, width: 36 }}>#</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Keyword</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Count</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Velocity</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Breadth</th>
                  </tr>
                </thead>
                <tbody>
                  {keywords.map((kw, i) => {
                    const vel = kw.velocity || 0;
                    const breadth = kw.breadth ?? (kw.source_breadth != null ? Math.round(kw.source_breadth * 100) : 0);
                    return (
                      <tr key={kw.keyword} style={{ cursor: 'pointer', background: selectedKw === kw.keyword ? 'var(--accent-soft)' : undefined }} onClick={() => selectKeyword(kw)}>
                        <td style={{ padding: '10px 14px', borderTop: '1px solid var(--surface3)', color: 'var(--muted)', fontWeight: 600, fontSize: 12 }}>{i + 1}</td>
                        <td style={{ padding: '10px 14px', borderTop: '1px solid var(--surface3)', fontWeight: 600 }}>{kw.keyword}</td>
                        <td style={{ padding: '10px 14px', borderTop: '1px solid var(--surface3)', fontVariantNumeric: 'tabular-nums' }}>{kw.count || 0}</td>
                        <td style={{ padding: '10px 14px', borderTop: '1px solid var(--surface3)' }}>
                          <span className={`mon-vel ${vel > 0 ? 'up' : vel < 0 ? 'down' : 'flat'}`}>
                            {vel > 0 ? '+' : ''}{vel.toFixed(1)}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', borderTop: '1px solid var(--surface3)' }}>
                          <div className="mon-breadth-wrap">
                            <div className="mon-breadth-bar"><div className="mon-breadth-fill" style={{ width: `${breadth}%` }} /></div>
                            <span className="mon-breadth-pct">{breadth}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Category Distribution */}
            <div className="card">
              <div className="ch"><span className="ct">Category Distribution</span></div>
              <div className="mon-cat-rows">
                {categories.map(c => {
                  const name = (c.category || c.name || 'other').toLowerCase();
                  const count = c.count || c.value || 0;
                  const barPct = (count / maxCat * 100);
                  const barClass = CAT_CLASSES.includes(name) ? name : 'tax';
                  return (
                    <div key={name} className="mon-cat-row">
                      <div className="mon-cat-label">{name}</div>
                      <div className="mon-cat-bar-track"><div className={`mon-cat-bar-fill ${barClass}`} style={{ width: `${barPct}%` }}>{barPct > 15 ? count : ''}</div></div>
                      <div className="mon-cat-count">{count} ({(count / catTotal * 100).toFixed(0)}%)</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div>
            {/* Keyword Detail */}
            <div className="card">
              <div className="ch"><span className="ct">Keyword Detail</span></div>
              {!selectedKw ? (
                <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Click a keyword row to see details</p>
              ) : (
                <>
                  <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>{selectedKw}</div>
                  <div className="g2" style={{ marginBottom: 20 }}>
                    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{kwDetail?.count || 0}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Total Mentions</div>
                    </div>
                    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: (kwDetail?.velocity || 0) > 0 ? 'var(--green)' : (kwDetail?.velocity || 0) < 0 ? 'var(--red)' : 'var(--muted)' }}>
                        {(kwDetail?.velocity || 0) > 0 ? '+' : ''}{(kwDetail?.velocity || 0).toFixed(1)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Velocity</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Weekly Frequency</div>
                  {history.length > 0 ? (
                    <div className="mon-weekly-chart">
                      {history.map((w, i) => {
                        const val = w.count || w.value || 0;
                        const h = Math.max((val / maxHist) * 80, 2);
                        return (
                          <div key={i} className="mon-weekly-bar-wrap">
                            <div className="mon-weekly-bar" style={{ height: h }} title={`${val} mentions`} />
                            <span className="mon-weekly-label">{w.week || w.label || w.date || ''}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : <p style={{ fontSize: 12, color: 'var(--muted)' }}>No history available</p>}

                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Sample Articles</div>
                  {samples.length > 0 ? (
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                      {samples.slice(0, 8).map((s, i) => (
                        <li key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--surface3)' }}>
                          <a href={s.url || s.link || '#'} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', display: 'block', marginBottom: 4, lineHeight: 1.4 }}>{s.title || 'Untitled'}</a>
                          <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--muted)' }}>
                            <span>{s.source || s.source_name || ''}</span>
                            <span style={{ fontWeight: 700, color: 'var(--yellow)' }}>Score {s.score ?? '--'}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : <p style={{ fontSize: 12, color: 'var(--muted)' }}>No sample articles</p>}
                </>
              )}
            </div>

            {/* Trending Topics */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="ct">Trending Topics</span>
                <span style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--surface2)', padding: '2px 10px', borderRadius: 20 }}>{topics.length} topics</span>
              </div>
              {topics.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: 30 }}>No trending topics</p>
              ) : topics.map((t, i) => {
                const cat = (t.category || '').toLowerCase();
                const kws = t.matching_keywords || t.keywords || t.trending_keywords || [];
                return (
                  <div key={i} style={{ padding: '14px 20px', borderBottom: '1px solid var(--surface3)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, lineHeight: 1.4 }}>{t.title}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4, fontSize: 11, color: 'var(--muted)' }}>
                        <span>{t.source || ''}</span>
                        <span style={{ fontWeight: 700, color: 'var(--yellow)' }}>Score {t.composite_score || t.score || 0}</span>
                        {cat && <span className="mon-badge" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{cat}</span>}
                      </div>
                      {kws.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {kws.slice(0, 4).map((k, j) => <span key={j} className="mon-niche-tag">{typeof k === 'string' ? k : k.keyword}</span>)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`mon-toast show mon-toast-${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
