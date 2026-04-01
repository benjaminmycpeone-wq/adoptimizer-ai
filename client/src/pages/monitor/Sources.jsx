import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '../../monitorApi';

const TIERS = ['big4','top10','top25','top50','top100','regional','local'];
const TIER_LABELS = { big4:'Big 4', top10:'Top 10', top25:'Top 25', top50:'Top 50', top100:'Top 100', regional:'Regional', local:'Local' };

export default function Sources() {
  const [sources, setSources] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [search, setSearch] = useState('');
  const [filterTier, setFilterTier] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [stats, setStats] = useState({});
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDiscoverModal, setShowDiscoverModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [editingSource, setEditingSource] = useState(null);
  const [toast, setToast] = useState(null);
  const searchTimer = useRef(null);
  const PAGE_SIZE = 50;

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadStats = useCallback(async () => {
    try { setStats(await api.getSourceStats()); } catch (e) { /* ignore */ }
  }, []);

  const loadSources = useCallback(async () => {
    const params = { limit: PAGE_SIZE, offset: currentPage * PAGE_SIZE };
    if (search) params.search = search;
    if (filterTier) params.firm_size = filterTier;
    if (filterActive) params.active = filterActive;
    try {
      const data = await api.getSources(params);
      setSources(data.sources || []);
      setTotalCount(data.total ?? 0);
    } catch (e) {
      setSources([]);
    }
  }, [currentPage, search, filterTier, filterActive]);

  useEffect(() => { loadStats(); }, []);
  useEffect(() => { loadSources(); }, [currentPage, filterTier, filterActive]);

  const handleSearch = (val) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setCurrentPage(0); loadSources(); }, 300);
  };

  const handleSave = async (data) => {
    try {
      if (editingSource) {
        await api.updateSource(editingSource.id, data);
        showToast('Source updated');
      } else {
        await api.createSource(data);
        showToast('Source created');
      }
      setShowSourceModal(false);
      setEditingSource(null);
      loadSources();
      loadStats();
    } catch (e) {
      showToast('Failed to save', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteSource(id);
      showToast('Source deleted');
      setShowDeleteModal(null);
      loadSources();
      loadStats();
    } catch (e) {
      showToast('Delete failed', 'error');
    }
  };

  const healthClass = (s) => {
    const fails = s.scrape_fail_count || s.consecutive_failures || 0;
    return fails === 0 ? 'mon-health-good' : fails <= 2 ? 'mon-health-warn' : 'mon-health-bad';
  };

  return (
    <>
      <h2 className="ct" style={{ fontSize: 20, marginBottom: 4 }}>Sources Management</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>Manage CPA firm blog sources for topic monitoring</p>

      {/* Stats */}
      <div className="mon-stats-bar" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="mon-stat-card"><div className="mon-stat-label">Total Sources</div><div className="mon-stat-value" style={{ color: 'var(--accent)' }}>{stats.total ?? '--'}</div></div>
        <div className="mon-stat-card"><div className="mon-stat-label">Active Sources</div><div className="mon-stat-value" style={{ color: 'var(--green)' }}>{stats.active ?? '--'}</div></div>
        <div className="mon-stat-card">
          <div className="mon-stat-label">Scrape Health</div>
          <div className="mon-stat-value" style={{ color: (stats.scrape_health ?? 0) >= 90 ? 'var(--green)' : (stats.scrape_health ?? 0) >= 70 ? 'var(--yellow)' : 'var(--red)' }}>
            {stats.scrape_health != null ? Math.round(stats.scrape_health) + '%' : '--%'}
          </div>
        </div>
        <div className="mon-stat-card"><div className="mon-stat-label">Tier Breakdown</div><div className="mon-stat-value">{(stats.big4 || 0) + (stats.top10 || 0)}</div><div className="mon-stat-sub">{stats.big4 || 0} Big 4, {stats.top10 || 0} Top 10</div></div>
      </div>

      {/* Toolbar */}
      <div className="mon-toolbar">
        <input type="text" value={search} onChange={e => handleSearch(e.target.value)} placeholder="Search sources..." style={{ minWidth: 200 }} />
        <select value={filterTier} onChange={e => { setFilterTier(e.target.value); setCurrentPage(0); }}>
          <option value="">All Tiers</option>
          {TIERS.map(t => <option key={t} value={t}>{TIER_LABELS[t]}</option>)}
        </select>
        <select value={filterActive} onChange={e => { setFilterActive(e.target.value); setCurrentPage(0); }}>
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn bs" onClick={() => setShowImportModal(true)}>Import CSV</button>
        <button className="btn bs" onClick={() => setShowDiscoverModal(true)}>Auto-Discover</button>
        <button className="btn bp" onClick={() => { setEditingSource(null); setShowSourceModal(true); }}>+ Add Source</button>
      </div>

      {/* Table */}
      <div className="mon-table-card">
        <table>
          <thead>
            <tr>
              <th>Firm Name</th>
              <th style={{ width: 90 }}>Tier</th>
              <th style={{ width: 80 }}>State</th>
              <th style={{ width: 170 }}>Niche</th>
              <th style={{ width: 200 }}>Blog URL</th>
              <th style={{ width: 55, textAlign: 'center' }}>Health</th>
              <th style={{ width: 60, textAlign: 'center' }}>Topics</th>
              <th style={{ width: 100 }}>Authority</th>
              <th style={{ width: 110 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sources.length === 0 ? (
              <tr><td colSpan="9" className="mon-empty-state">No sources found</td></tr>
            ) : sources.map(s => (
              <tr key={s.id}>
                <td style={{ fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</td>
                <td><span className={`mon-tier-badge mon-tier-${(s.firm_size || '').toLowerCase().replace(/\s+/g,'')}`}>{TIER_LABELS[(s.firm_size || '').toLowerCase().replace(/\s+/g,'')] || s.firm_size || '--'}</span></td>
                <td style={{ fontSize: 12, color: 'var(--muted)' }}>{s.state || '--'}</td>
                <td>
                  <div className="mon-niche-tags">
                    {(s.niche || '').split(',').filter(Boolean).slice(0, 3).map((n, i) => <span key={i} className="mon-niche-tag">{n.trim()}</span>)}
                  </div>
                </td>
                <td style={{ fontSize: 12 }}>
                  {s.blog_url ? <a href={s.blog_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>{s.blog_url.replace(/^https?:\/\/(www\.)?/, '').substring(0, 35)}</a> : '--'}
                </td>
                <td style={{ textAlign: 'center' }}><span className={`mon-health-dot ${healthClass(s)}`} /></td>
                <td style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>{s.topic_count || 0}</td>
                <td>
                  {s.source_authority ? (
                    <div className="mon-authority-bar">
                      <div className="mon-authority-track"><div className="mon-authority-fill" style={{ width: `${Math.min(s.source_authority, 100)}%` }} /></div>
                      <span className="mon-authority-val">{s.source_authority}</span>
                    </div>
                  ) : '--'}
                </td>
                <td>
                  <button className="btn bs sm" style={{ marginRight: 4 }} onClick={() => { setEditingSource(s); setShowSourceModal(true); }}>Edit</button>
                  <button className="btn bs sm" style={{ color: 'var(--red)' }} onClick={() => setShowDeleteModal(s)}>Del</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mon-pagination">
        <button className="btn bs sm" disabled={currentPage === 0} onClick={() => setCurrentPage(p => p - 1)}>Prev</button>
        <span className="mon-page-info">{totalCount > 0 ? `${currentPage * PAGE_SIZE + 1}-${Math.min((currentPage + 1) * PAGE_SIZE, totalCount)} of ${totalCount}` : 'No results'}</span>
        <div className="mon-page-spacer" />
        <button className="btn bs sm" disabled={(currentPage + 1) * PAGE_SIZE >= totalCount} onClick={() => setCurrentPage(p => p + 1)}>Next</button>
      </div>

      {/* Source Modal */}
      {showSourceModal && (
        <SourceFormModal
          source={editingSource}
          onSave={handleSave}
          onClose={() => { setShowSourceModal(false); setEditingSource(null); }}
        />
      )}

      {/* Import Modal */}
      {showImportModal && <ImportModal onClose={() => setShowImportModal(false)} onDone={() => { loadSources(); loadStats(); }} showToast={showToast} />}

      {/* Discover Modal */}
      {showDiscoverModal && <DiscoverModal onClose={() => setShowDiscoverModal(false)} onDone={() => { loadSources(); loadStats(); }} showToast={showToast} />}

      {/* Delete Confirm */}
      {showDeleteModal && (
        <div className="mon-modal-overlay" onClick={e => e.target === e.currentTarget && setShowDeleteModal(null)}>
          <div className="mon-modal" style={{ maxWidth: 420 }}>
            <h3>Delete Source</h3>
            <p style={{ fontSize: 14, marginBottom: 6 }}>Are you sure you want to delete <strong>{showDeleteModal.name}</strong>?</p>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>This action cannot be undone.</p>
            <div className="mon-modal-footer">
              <button className="btn bs" onClick={() => setShowDeleteModal(null)}>Cancel</button>
              <button className="btn bp" style={{ background: 'var(--red)' }} onClick={() => handleDelete(showDeleteModal.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`mon-toast show mon-toast-${toast.type}`}>{toast.msg}</div>}
    </>
  );
}

function SourceFormModal({ source, onSave, onClose }) {
  const [form, setForm] = useState({
    name: source?.name || '', url: source?.url || '', blog_url: source?.blog_url || '',
    rss_url: source?.rss_url || '', linkedin_url: source?.linkedin_url || '',
    firm_size: source?.firm_size || '', state: source?.state || '',
    post_frequency: source?.post_frequency || '', niche: source?.niche || '',
    services: source?.services || '', specialties: source?.specialties || '',
  });

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="mon-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="mon-modal">
        <h3>{source ? 'Edit Source' : 'Add New Source'}</h3>
        <div className="fg" style={{ marginBottom: 14 }}><label>Firm Name *</label><input type="text" value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g. Deloitte" /></div>
        <div className="mon-field-row" style={{ marginBottom: 14 }}>
          <div className="fg"><label>Main URL</label><input type="url" value={form.url} onChange={e => update('url', e.target.value)} /></div>
          <div className="fg"><label>Blog URL *</label><input type="url" value={form.blog_url} onChange={e => update('blog_url', e.target.value)} /></div>
        </div>
        <div className="mon-field-row" style={{ marginBottom: 14 }}>
          <div className="fg"><label>RSS URL</label><input type="url" value={form.rss_url} onChange={e => update('rss_url', e.target.value)} /></div>
          <div className="fg"><label>LinkedIn URL</label><input type="url" value={form.linkedin_url} onChange={e => update('linkedin_url', e.target.value)} /></div>
        </div>
        <div className="mon-field-row-3" style={{ marginBottom: 14 }}>
          <div className="fg"><label>Firm Size *</label>
            <select value={form.firm_size} onChange={e => update('firm_size', e.target.value)}>
              <option value="">Select tier...</option>
              {TIERS.map(t => <option key={t} value={t}>{TIER_LABELS[t]}</option>)}
            </select>
          </div>
          <div className="fg"><label>State</label><input type="text" value={form.state} onChange={e => update('state', e.target.value)} /></div>
          <div className="fg"><label>Frequency</label><input type="text" value={form.post_frequency} onChange={e => update('post_frequency', e.target.value)} /></div>
        </div>
        <div className="mon-field-row" style={{ marginBottom: 14 }}>
          <div className="fg"><label>Niche</label><input type="text" value={form.niche} onChange={e => update('niche', e.target.value)} placeholder="Tax, Audit" /></div>
          <div className="fg"><label>Specialties</label><input type="text" value={form.specialties} onChange={e => update('specialties', e.target.value)} /></div>
        </div>
        <div className="mon-modal-footer">
          <button className="btn bs" onClick={onClose}>Cancel</button>
          <button className="btn bp" onClick={() => onSave(form)}>{source ? 'Update' : 'Save'} Source</button>
        </div>
      </div>
    </div>
  );
}

function ImportModal({ onClose, onDone, showToast }) {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api.importSourcesCsv(fd);
      setResult(res);
      showToast('CSV import complete');
      onDone();
    } catch (e) {
      showToast('Import failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mon-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="mon-modal" style={{ maxWidth: 520 }}>
        <h3>Import Sources from CSV</h3>
        <div className="mon-drop-zone" onClick={() => document.getElementById('csvFileInput').click()}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>&#128196;</div>
          <div>{file ? file.name : 'Drop CSV file here or click to browse'}</div>
          <input id="csvFileInput" type="file" accept=".csv" style={{ display: 'none' }} onChange={e => e.target.files[0] && setFile(e.target.files[0])} />
        </div>
        {result && (
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7, padding: 14, marginTop: 14, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>Created</span><strong style={{ color: 'var(--green)' }}>{result.created || result.imported || 0}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>Updated</span><strong style={{ color: 'var(--accent)' }}>{result.updated || 0}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>Skipped</span><strong style={{ color: 'var(--yellow)' }}>{result.skipped || 0}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>Errors</span><strong style={{ color: 'var(--red)' }}>{result.errors || 0}</strong></div>
          </div>
        )}
        <div className="mon-modal-footer">
          <button className="btn bs" onClick={onClose}>Cancel</button>
          <button className="btn bg" onClick={handleUpload} disabled={!file || uploading}>{uploading ? 'Importing...' : 'Import'}</button>
        </div>
      </div>
    </div>
  );
}

function DiscoverModal({ onClose, onDone, showToast }) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [logs, setLogs] = useState([]);
  const [found, setFound] = useState(0);
  const [skipped, setSkipped] = useState(0);

  const handleRun = async () => {
    setRunning(true);
    setLogs([]);
    try {
      const resp = await api.autoDiscoverSources();
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('text/event-stream') || ct.includes('ndjson')) {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let f = 0, s = 0;
        while (true) {
          const { done: rd, value } = await reader.read();
          if (rd) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();
          for (const line of lines) {
            const cleaned = line.replace(/^data:\s*/, '').trim();
            if (!cleaned) continue;
            try {
              const evt = JSON.parse(cleaned);
              if (evt.source) {
                if (evt.found) f++; else s++;
                setLogs(prev => [...prev, { text: evt.found ? `Found: ${evt.source} -> ${evt.blog_url}` : `Skipped: ${evt.source}`, ok: !!evt.found }]);
              }
              if (evt.done) {
                f = evt.found_count ?? f;
                s = evt.skipped_count ?? s;
              }
            } catch (pe) { /* ignore */ }
          }
        }
        setFound(f); setSkipped(s);
      } else {
        const result = await resp.json();
        setFound(result.discovered || result.found || 0);
        setSkipped(result.skipped || 0);
      }
      setDone(true);
      onDone();
    } catch (e) {
      showToast('Discovery failed', 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="mon-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="mon-modal" style={{ maxWidth: 560 }}>
        <h3>Auto-Discover Blog URLs</h3>
        {!running && !done && (
          <button className="btn bp" onClick={handleRun} style={{ width: '100%', justifyContent: 'center', padding: 12 }}>Start Auto-Discovery</button>
        )}
        {running && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Discovering...</p>}
        {logs.length > 0 && (
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px', maxHeight: 200, overflowY: 'auto', fontSize: 12, fontFamily: 'monospace', marginTop: 10 }}>
            {logs.map((l, i) => <div key={i} style={{ color: l.ok ? 'var(--green)' : 'var(--red)', padding: '2px 0' }}>{l.text}</div>)}
          </div>
        )}
        {done && (
          <div style={{ display: 'flex', gap: 24, marginTop: 12, fontSize: 13 }}>
            <span><strong style={{ color: 'var(--green)' }}>{found}</strong> discovered</span>
            <span><strong style={{ color: 'var(--muted)' }}>{skipped}</strong> skipped</span>
          </div>
        )}
        <div className="mon-modal-footer">
          <button className="btn bs" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
