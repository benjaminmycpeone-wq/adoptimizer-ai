import { useState, useEffect, useCallback } from 'react';
import * as api from '../../monitorApi';

function fmtDate(d) {
  if (!d) return '--';
  try {
    const dt = new Date(d);
    const diff = Date.now() - dt.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (e) { return String(d); }
}

export default function Publisher() {
  const [sites, setSites] = useState([]);
  const [clients, setClients] = useState([]);
  const [posts, setPosts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkSiteId, setBulkSiteId] = useState('');
  const [showSiteModal, setShowSiteModal] = useState(false);
  const [editingSite, setEditingSite] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const [publishStatus, setPublishStatus] = useState({});
  const [testResults, setTestResults] = useState({});

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    loadClients();
    loadSites();
    loadPosts();
    loadLogs();
  }, []);

  const loadClients = async () => {
    try { const r = await api.getClients(); setClients(Array.isArray(r) ? r : []); } catch (e) { /* ignore */ }
  };

  const loadSites = async () => {
    try {
      const r = await api.getWordPressSites();
      setSites(Array.isArray(r) ? r : []);
    } catch (e) { setSites([]); }
  };

  const loadPosts = async () => {
    try {
      const data = await api.getPosts({ status: 'approved', limit: 100 });
      setPosts(Array.isArray(data) ? data : (data.posts || []));
    } catch (e) { setPosts([]); }
  };

  const loadLogs = async () => {
    try {
      const r = await api.getPublishLogs({ limit: 30 });
      setLogs(Array.isArray(r) ? r : []);
    } catch (e) { setLogs([]); }
  };

  const handleTestSite = async (id) => {
    setTestResults(prev => ({ ...prev, [id]: { testing: true } }));
    try {
      const d = await api.testWordPressSite(id);
      setTestResults(prev => ({ ...prev, [id]: { ok: d.success, message: d.message || (d.success ? 'Connected' : 'Failed') } }));
    } catch (e) {
      setTestResults(prev => ({ ...prev, [id]: { ok: false, message: 'Network error' } }));
    }
  };

  const handleDeleteSite = async (id) => {
    try {
      await api.deleteWordPressSite(id);
      showToast('Site deleted');
      setShowDeleteConfirm(null);
      loadSites();
    } catch (e) { showToast('Failed to delete', 'error'); }
  };

  const handleSaveSite = async (data) => {
    try {
      if (editingSite) {
        await api.updateWordPressSite(editingSite.id, data);
        showToast('Site updated');
      } else {
        await api.createWordPressSite(data);
        showToast('Site added');
      }
      setShowSiteModal(false);
      setEditingSite(null);
      loadSites();
    } catch (e) { showToast('Failed to save site', 'error'); }
  };

  const togglePost = (id, checked) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  const toggleAll = (checked) => {
    if (checked) setSelectedIds(new Set(posts.map(p => p.id)));
    else setSelectedIds(new Set());
  };

  const publishOne = async (postId, siteId) => {
    if (!siteId) { showToast('Select a site first', 'error'); return; }
    setPublishStatus(prev => ({ ...prev, [postId]: 'publishing' }));
    try {
      const d = await api.publishPost({ post_id: postId, site_id: parseInt(siteId) });
      if (d.success !== false) {
        setPublishStatus(prev => ({ ...prev, [postId]: 'ok' }));
        showToast('Published successfully');
      } else {
        setPublishStatus(prev => ({ ...prev, [postId]: 'fail' }));
        showToast(d.message || 'Publish failed', 'error');
      }
    } catch (e) {
      setPublishStatus(prev => ({ ...prev, [postId]: 'fail' }));
      showToast('Publish error', 'error');
    }
    loadLogs();
  };

  const handleBulkPublish = async () => {
    if (!bulkSiteId) { showToast('Select a site for bulk publish', 'error'); return; }
    if (selectedIds.size === 0) return;
    const ids = [...selectedIds];
    ids.forEach(id => setPublishStatus(prev => ({ ...prev, [id]: 'publishing' })));
    try {
      const d = await api.bulkPublish({ post_ids: ids, site_id: parseInt(bulkSiteId) });
      const results = d.results || [];
      let okN = 0, failN = 0;
      if (results.length) {
        results.forEach(r => {
          if (r.success) { okN++; setPublishStatus(prev => ({ ...prev, [r.post_id]: 'ok' })); }
          else { failN++; setPublishStatus(prev => ({ ...prev, [r.post_id]: 'fail' })); }
        });
      } else {
        ids.forEach(id => setPublishStatus(prev => ({ ...prev, [id]: 'ok' })));
        okN = ids.length;
      }
      showToast(`Bulk: ${okN} published, ${failN} failed`);
    } catch (e) {
      ids.forEach(id => setPublishStatus(prev => ({ ...prev, [id]: 'fail' })));
      showToast('Bulk publish failed', 'error');
    }
    setSelectedIds(new Set());
    loadLogs();
  };

  const [rowSites, setRowSites] = useState({});

  return (
    <div className="mon-pub-layout">
      {/* Sidebar */}
      <aside style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Sites */}
        <div style={{ flex: '1 1 55%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 12px', flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--muted)' }}>WordPress Sites</span>
            <button className="btn bp sm" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => { setEditingSite(null); setShowSiteModal(true); }}>+ Add Site</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
            {sites.length === 0 ? (
              <div className="mon-empty-state" style={{ padding: '32px 16px' }}>No sites configured</div>
            ) : sites.map(s => (
              <div key={s.id} className="mon-site-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{s.label}</span>
                  <span className={`mon-badge ${(s.publish_mode || s.mode) === 'publish' ? 'mon-badge-approved' : 'mon-badge-draft'}`}>
                    {(s.publish_mode || s.mode) === 'publish' ? 'Live' : 'Draft'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>API: {s.api_url || ''}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 3 }}>Client: {s.client_name || clients.find(c => c.id === s.client_id)?.name || '--'}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10, borderTop: '1px solid var(--surface3)', paddingTop: 10 }}>
                  <button className="btn bs sm" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => handleTestSite(s.id)}>Test</button>
                  <button className="btn bs sm" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => { setEditingSite(s); setShowSiteModal(true); }}>Edit</button>
                  <button className="btn bs sm" style={{ padding: '3px 8px', fontSize: 11, color: 'var(--red)' }} onClick={() => setShowDeleteConfirm(s)}>Delete</button>
                </div>
                {testResults[s.id] && (
                  <div style={{ fontSize: 11, marginTop: 6, color: testResults[s.id].testing ? 'var(--muted)' : testResults[s.id].ok ? 'var(--green)' : 'var(--red)' }}>
                    {testResults[s.id].testing ? 'Testing...' : (testResults[s.id].ok ? '\u2713 ' : '\u2717 ') + testResults[s.id].message}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Activity Log */}
        <div style={{ flex: '1 1 45%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 12px', flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--muted)' }}>Activity Log</span>
            <button className="btn bs sm" style={{ padding: '3px 8px', fontSize: 11 }} onClick={loadLogs}>Refresh</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
            {logs.length === 0 ? (
              <div className="mon-empty-state" style={{ padding: '32px 16px' }}>No activity yet</div>
            ) : logs.map((l, i) => {
              const ok = l.success || l.status === 'success';
              return (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--surface3)', fontSize: 12, alignItems: 'flex-start' }}>
                  <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: ok ? 'var(--green-soft)' : 'var(--red-soft)', color: ok ? 'var(--green)' : 'var(--red)' }}>
                    {ok ? '\u2713' : '\u2717'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.4 }}>{l.post_title || l.title || 'Post'}</div>
                    {l.site_label && <div style={{ color: 'var(--muted)', fontSize: 11 }}>{l.site_label}</div>}
                    {l.message && <div style={{ color: 'var(--muted)', marginTop: 2, fontSize: 11 }}>{l.message}</div>}
                  </div>
                  <span style={{ color: 'var(--muted)', fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtDate(l.attempted_at || l.created_at)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
          <h2 className="ct" style={{ fontSize: 20, marginBottom: 4 }}>WordPress Publisher</h2>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>Publish approved posts to your WordPress sites</p>
        </div>

        <div className="mon-toolbar" style={{ padding: '0 24px', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Approved Posts Queue</span>
          <button className="btn bs sm" onClick={loadPosts}>Refresh</button>
          <div style={{ flex: 1 }} />
          <select value={bulkSiteId} onChange={e => setBulkSiteId(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="">Select site for bulk</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <button className="btn bg sm" onClick={handleBulkPublish} disabled={selectedIds.size === 0}>
            Bulk Publish{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', margin: '0 24px 24px' }}>
          <div className="mon-table-card">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}><input type="checkbox" onChange={e => toggleAll(e.target.checked)} /></th>
                  <th>Post Title</th>
                  <th>Client</th>
                  <th>Words</th>
                  <th>Created</th>
                  <th>Publish To</th>
                  <th style={{ width: 110 }}></th>
                </tr>
              </thead>
              <tbody>
                {posts.length === 0 ? (
                  <tr><td colSpan="7" className="mon-empty-state">No approved posts in queue</td></tr>
                ) : posts.map(p => {
                  const title = p.topic_title || p.topic || p.title || 'Untitled';
                  const client = p.client_name || p.client || '--';
                  const wc = p.word_count || 0;
                  const status = publishStatus[p.id];
                  return (
                    <tr key={p.id}>
                      <td><input type="checkbox" checked={selectedIds.has(p.id)} onChange={e => togglePost(p.id, e.target.checked)} /></td>
                      <td style={{ fontWeight: 600, maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</td>
                      <td style={{ fontSize: 12, color: 'var(--muted)' }}>{client}</td>
                      <td style={{ fontSize: 12, fontWeight: 600 }}>{wc.toLocaleString()}</td>
                      <td style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{p.created_at ? fmtDate(p.created_at) : '--'}</td>
                      <td>
                        <select value={rowSites[p.id] || ''} onChange={e => setRowSites(prev => ({ ...prev, [p.id]: e.target.value }))} style={{ maxWidth: 160, fontSize: 12 }}>
                          <option value="">Choose site</option>
                          {sites.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </td>
                      <td>
                        {status === 'publishing' ? (
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Publishing...</span>
                        ) : status === 'ok' ? (
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)' }}>{'\u2713'} Published</span>
                        ) : status === 'fail' ? (
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--red)' }}>{'\u2717'} Failed</span>
                        ) : (
                          <button className="btn bg sm" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => publishOne(p.id, rowSites[p.id])}>Publish</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Site Modal */}
      {showSiteModal && (
        <SiteFormModal
          site={editingSite}
          clients={clients}
          onSave={handleSaveSite}
          onClose={() => { setShowSiteModal(false); setEditingSite(null); }}
        />
      )}

      {/* Delete Confirm */}
      {showDeleteConfirm && (
        <div className="mon-modal-overlay" onClick={e => e.target === e.currentTarget && setShowDeleteConfirm(null)}>
          <div className="mon-modal" style={{ maxWidth: 400 }}>
            <h3>Delete Site</h3>
            <p style={{ fontSize: 14, marginBottom: 16 }}>Delete "{showDeleteConfirm.label}"? This cannot be undone.</p>
            <div className="mon-modal-footer">
              <button className="btn bs" onClick={() => setShowDeleteConfirm(null)}>Cancel</button>
              <button className="btn bp" style={{ background: 'var(--red)' }} onClick={() => handleDeleteSite(showDeleteConfirm.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`mon-toast show mon-toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}

function SiteFormModal({ site, clients, onSave, onClose }) {
  const [form, setForm] = useState({
    label: site?.label || '', api_url: site?.api_url || '',
    username: site?.username || '', app_password: '',
    default_category: site?.default_category || site?.category_id || '1',
    publish_mode: site?.publish_mode || site?.mode || 'draft',
    client_id: site?.client_id || '',
  });
  const [testResult, setTestResult] = useState(null);

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const testConnection = async () => {
    setTestResult({ testing: true });
    if (site && !form.app_password) {
      try {
        const d = await api.testWordPressSite(site.id);
        setTestResult({ ok: d.success, message: d.message || (d.success ? 'Connected' : 'Failed') });
      } catch (e) { setTestResult({ ok: false, message: 'Network error' }); }
      return;
    }
    if (!form.api_url || !form.username || !form.app_password) {
      setTestResult({ ok: false, message: 'Fill in URL, username and password first' });
      return;
    }
    try {
      const d = await api.testWordPressConnection({ api_url: form.api_url, username: form.username, password: form.app_password, app_password: form.app_password });
      setTestResult({ ok: d.success, message: d.message || (d.success ? 'Connected' : 'Failed') });
    } catch (e) { setTestResult({ ok: false, message: 'Network error' }); }
  };

  const handleSave = () => {
    const payload = { ...form, mode: form.publish_mode, category_id: parseInt(form.default_category) || 1, client_id: form.client_id ? parseInt(form.client_id) : null };
    if (form.app_password) { payload.password = form.app_password; }
    onSave(payload);
  };

  return (
    <div className="mon-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="mon-modal">
        <h3>{site ? 'Edit WordPress Site' : 'Add WordPress Site'}</h3>
        <div className="fg" style={{ marginBottom: 14 }}><label>Label</label><input type="text" value={form.label} onChange={e => update('label', e.target.value)} placeholder="e.g. Anderson CPA Blog" /></div>
        <div className="fg" style={{ marginBottom: 14 }}><label>WordPress REST API URL</label><input type="text" value={form.api_url} onChange={e => update('api_url', e.target.value)} placeholder="https://example.com/wp-json/wp/v2" /></div>
        <div className="mon-field-row" style={{ marginBottom: 14 }}>
          <div className="fg"><label>Username</label><input type="text" value={form.username} onChange={e => update('username', e.target.value)} /></div>
          <div className="fg"><label>Application Password</label><input type="password" value={form.app_password} onChange={e => update('app_password', e.target.value)} placeholder={site ? '(leave blank to keep)' : ''} /></div>
        </div>
        <div className="mon-field-row" style={{ marginBottom: 14 }}>
          <div className="fg"><label>Default Category ID</label><input type="text" value={form.default_category} onChange={e => update('default_category', e.target.value)} /></div>
          <div className="fg"><label>Publish Mode</label>
            <select value={form.publish_mode} onChange={e => update('publish_mode', e.target.value)}>
              <option value="draft">Draft</option>
              <option value="publish">Live (Publish)</option>
            </select>
          </div>
        </div>
        <div className="fg" style={{ marginBottom: 14 }}><label>Linked Client</label>
          <select value={form.client_id} onChange={e => update('client_id', e.target.value)}>
            <option value="">-- None --</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 14 }}>
          <button className="btn bs sm" onClick={testConnection}>Test Connection</button>
          {testResult && (
            <div style={{ fontSize: 12, marginTop: 8, padding: '8px 12px', borderRadius: 6, background: testResult.testing ? 'var(--surface2)' : testResult.ok ? 'var(--green-soft)' : 'var(--red-soft)', color: testResult.testing ? 'var(--muted)' : testResult.ok ? 'var(--green)' : 'var(--red)' }}>
              {testResult.testing ? 'Testing...' : testResult.message}
            </div>
          )}
        </div>
        <div className="mon-modal-footer">
          <button className="btn bs" onClick={onClose}>Cancel</button>
          <button className="btn bp" onClick={handleSave}>Save Site</button>
        </div>
      </div>
    </div>
  );
}
