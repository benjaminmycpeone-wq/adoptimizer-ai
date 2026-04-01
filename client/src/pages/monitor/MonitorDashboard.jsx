import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '../../monitorApi';

function scoreColor(v) {
  if (v > 0.6) return 'var(--green)';
  if (v > 0.3) return 'var(--yellow)';
  return 'var(--red)';
}

function relativeDate(iso) {
  if (!iso) return '--';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  if (days < 30) return days + 'd ago';
  return Math.floor(days / 30) + 'mo ago';
}

export default function MonitorDashboard() {
  const [stats, setStats] = useState({});
  const [topics, setTopics] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sources, setSources] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [toast, setToast] = useState(null);
  const searchTimer = useRef(null);
  const pageSize = 30;

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadStats = useCallback(async () => {
    try {
      const r = await api.getStats();
      setStats(r);
    } catch (e) { /* ignore */ }
  }, []);

  const loadSources = useCallback(async () => {
    try {
      const data = await api.getSources({ limit: 500, active: true });
      setSources((data.sources || []).filter(s => s.active !== false));
    } catch (e) { /* ignore */ }
  }, []);

  const loadClients = useCallback(async () => {
    try {
      const r = await api.getClients();
      setClients(Array.isArray(r) ? r : []);
    } catch (e) { /* ignore */ }
  }, []);

  const loadTopics = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    const params = { limit: pageSize, offset: page * pageSize };
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    if (sourceFilter) params.source_id = sourceFilter;
    if (categoryFilter) params.category = categoryFilter;
    try {
      const data = await api.getTopics(params);
      setTopics(data.topics || []);
      setTotal(data.total || 0);
    } catch (e) {
      setTopics([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, sourceFilter, categoryFilter, loading]);

  useEffect(() => {
    loadStats();
    loadSources();
    loadClients();
  }, []);

  useEffect(() => { loadTopics(); }, [page, statusFilter, sourceFilter, categoryFilter]);

  const handleSearch = (val) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(0); loadTopics(); }, 350);
  };

  const handleScrape = async () => {
    setScraping(true);
    try {
      const r = await api.runScrape();
      showToast(`Scrape complete: ${r.total_new || 0} new topics`, 'success');
      loadTopics();
      loadStats();
    } catch (e) {
      showToast('Scrape failed', 'error');
    } finally {
      setScraping(false);
    }
  };

  const toggleSelection = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = (checked) => {
    if (checked) {
      setSelectedIds(new Set(topics.map(t => t.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleAssign = async (clientIds) => {
    const topicIds = [...selectedIds];
    try {
      if (topicIds.length > 1) {
        await api.bulkAssign({ topic_ids: topicIds, client_ids: clientIds });
      } else {
        await api.createAssignment({ topic_id: topicIds[0], client_ids: clientIds });
      }
      showToast('Assignment created', 'success');
      setSelectedIds(new Set());
      setShowModal(false);
      loadTopics();
    } catch (e) {
      showToast('Assignment failed', 'error');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <h2 className="ct" style={{ fontSize: 20, marginBottom: 4 }}>Topic Monitor</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
        Scraped articles from top CPA sources, scored and ranked for content potential.
      </p>

      {/* Stats */}
      <div className="mon-stats-bar">
        <div className="mon-stat-card"><div className="mon-stat-label">Total Topics</div><div className="mon-stat-value" style={{ color: 'var(--text)' }}>{stats.topics || 0}</div></div>
        <div className="mon-stat-card"><div className="mon-stat-label">New Topics</div><div className="mon-stat-value" style={{ color: 'var(--accent)' }}>{stats.topics_new || 0}</div></div>
        <div className="mon-stat-card"><div className="mon-stat-label">Active Sources</div><div className="mon-stat-value" style={{ color: 'var(--green)' }}>{stats.sources_active || 0}</div></div>
        <div className="mon-stat-card"><div className="mon-stat-label">Active Clients</div><div className="mon-stat-value" style={{ color: 'var(--yellow)' }}>{stats.clients || 0}</div></div>
        <div className="mon-stat-card"><div className="mon-stat-label">Posts Generated</div><div className="mon-stat-value" style={{ color: 'var(--accent)' }}>{stats.posts || 0}</div></div>
      </div>

      {/* Toolbar */}
      <div className="mon-toolbar">
        <div className="search-wrap" style={{ flex: 1, minWidth: 200 }}>
          <input type="text" value={search} onChange={e => handleSearch(e.target.value)} placeholder="Search topics..." />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}>
          <option value="">All Statuses</option>
          <option value="new">New</option>
          <option value="seen">Seen</option>
        </select>
        <select value={sourceFilter} onChange={e => { setSourceFilter(e.target.value); setPage(0); }}>
          <option value="">All Sources</option>
          {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(0); }}>
          <option value="">All Categories</option>
          <option value="tax">Tax</option>
          <option value="audit">Audit</option>
          <option value="advisory">Advisory</option>
          <option value="accounting">Accounting</option>
          <option value="wealth">Wealth</option>
        </select>
        <button className="btn bs" onClick={() => loadTopics()}>Refresh</button>
        <button className="btn bp" onClick={handleScrape} disabled={scraping}>
          {scraping ? 'Scraping...' : 'Run Scrape'}
        </button>
        <button className="btn bg" onClick={() => setShowModal(true)} disabled={selectedIds.size === 0}>
          Assign Selected ({selectedIds.size})
        </button>
      </div>

      {/* Table */}
      <div className="mon-table-card">
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}><input type="checkbox" checked={topics.length > 0 && topics.every(t => selectedIds.has(t.id))} onChange={e => toggleAll(e.target.checked)} /></th>
              <th>Title / Source</th>
              <th style={{ width: 120 }}>Composite</th>
              <th style={{ width: 100 }}>SEO</th>
              <th style={{ width: 68 }}>Status</th>
              <th style={{ width: 140 }}>Best Match</th>
              <th style={{ width: 90 }}>Discovered</th>
              <th style={{ width: 72 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {topics.length === 0 ? (
              <tr><td colSpan="8" className="mon-empty-state">{loading ? 'Loading...' : 'No topics found'}</td></tr>
            ) : topics.map(t => (
              <tr key={t.id} className={selectedIds.has(t.id) ? 'selected' : ''}>
                <td><input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleSelection(t.id)} /></td>
                <td>
                  {t.url ? <a href={t.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}>{t.title}</a> : <span style={{ fontWeight: 600 }}>{t.title}</span>}
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {t.source || ''} {t.category && <span className="mon-badge" style={{ marginLeft: 4, background: 'var(--accent-soft)', color: 'var(--accent)' }}>{t.category}</span>}
                  </div>
                </td>
                <td>
                  <div className="mon-score-cell">
                    <div className="mon-score-track"><div className="mon-score-fill" style={{ width: `${Math.round((t.composite_score || 0) * 100)}%`, background: scoreColor(t.composite_score || 0) }} /></div>
                    <span className="mon-score-num" style={{ color: scoreColor(t.composite_score || 0) }}>{Math.round((t.composite_score || 0) * 100)}</span>
                  </div>
                </td>
                <td>
                  <div className="mon-score-cell">
                    <div className="mon-score-track"><div className="mon-score-fill" style={{ width: `${Math.round((t.seo_score || 0) * 100)}%`, background: scoreColor(t.seo_score || 0) }} /></div>
                    <span className="mon-score-num" style={{ color: scoreColor(t.seo_score || 0) }}>{Math.round((t.seo_score || 0) * 100)}</span>
                  </div>
                </td>
                <td><span className={`mon-badge mon-badge-${t.status || 'new'}`}>{t.status === 'new' ? 'New' : 'Seen'}</span></td>
                <td>
                  {t.relevance_matches?.length > 0 ? (
                    <span className="mon-badge" style={{ background: t.relevance_matches[0].score >= 0.7 ? 'var(--green-soft)' : t.relevance_matches[0].score >= 0.4 ? 'var(--yellow-soft)' : 'var(--surface3)', color: t.relevance_matches[0].score >= 0.7 ? 'var(--green)' : t.relevance_matches[0].score >= 0.4 ? 'var(--yellow)' : 'var(--muted)' }}>
                      {(t.relevance_matches[0].client_name || '').split(' ')[0]} {Math.round(t.relevance_matches[0].score * 100)}%
                    </span>
                  ) : '--'}
                </td>
                <td style={{ fontSize: 12, color: 'var(--muted)' }}>{relativeDate(t.discovered_at)}</td>
                <td>
                  <button className="btn bs sm" onClick={() => { setSelectedIds(new Set([t.id])); setShowModal(true); }}>Assign</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mon-pagination">
        <button className="btn bs sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button>
        <span className="mon-page-info">Page {page + 1} of {totalPages}</span>
        <div className="mon-page-spacer" />
        <span className="mon-page-info">{total} topic{total !== 1 ? 's' : ''}</span>
        <button className="btn bs sm" disabled={(page + 1) * pageSize >= total} onClick={() => setPage(p => p + 1)}>Next</button>
      </div>

      {/* Assign Modal */}
      {showModal && (
        <AssignModal
          clients={clients.filter(c => c.active)}
          topicIds={[...selectedIds]}
          onAssign={handleAssign}
          onClose={() => setShowModal(false)}
        />
      )}

      {toast && <div className={`mon-toast show mon-toast-${toast.type}`}>{toast.msg}</div>}
    </>
  );
}

function AssignModal({ clients, topicIds, onAssign, onClose }) {
  const [checked, setChecked] = useState(new Set());
  const [matches, setMatches] = useState({});

  useEffect(() => {
    if (topicIds.length === 1) {
      api.getTopicMatches(topicIds[0]).then(m => {
        const map = {};
        (m || []).forEach(x => { map[x.client_id] = x.relevance_score; });
        setMatches(map);
      }).catch(() => {});
    }
  }, [topicIds]);

  const toggle = (id) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const sorted = [...clients].sort((a, b) => (matches[b.id] || 0) - (matches[a.id] || 0));

  return (
    <div className="mon-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="mon-modal">
        <h3>Assign to Clients</h3>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
          Select clients for the <strong>{topicIds.length}</strong> selected topic(s).
        </p>
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {sorted.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--muted)' }}>No active clients found.</p>
          ) : sorted.map(c => {
            const rel = matches[c.id];
            return (
              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: `1.5px solid ${checked.has(c.id) ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', marginBottom: 8, background: checked.has(c.id) ? 'var(--accent-soft)' : 'var(--surface)' }}>
                <input type="checkbox" checked={checked.has(c.id)} onChange={() => toggle(c.id)} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{c.name}</span>
                    {rel !== undefined && (
                      <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: rel >= 0.7 ? 'var(--green-soft)' : rel >= 0.4 ? 'var(--yellow-soft)' : 'var(--surface3)', color: rel >= 0.7 ? 'var(--green)' : rel >= 0.4 ? 'var(--yellow)' : 'var(--muted)' }}>
                        {Math.round(rel * 100)}% match
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{c.audience || ''}{c.tone ? ` \u00b7 ${c.tone}` : ''}</div>
                </div>
              </label>
            );
          })}
        </div>
        <div className="mon-modal-footer">
          <button className="btn bs" onClick={onClose}>Cancel</button>
          <button className="btn bp" onClick={() => onAssign([...checked])} disabled={checked.size === 0}>Assign</button>
        </div>
      </div>
    </div>
  );
}
