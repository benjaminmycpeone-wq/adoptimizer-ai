import { useState, useEffect, useRef } from 'react';
import * as api from '../../monitorApi';

export default function MonitorClients() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsClient, setSuggestionsClient] = useState(null);
  const [toast, setToast] = useState(null);
  const searchTimer = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => { loadClients(); }, []);

  const loadClients = async () => {
    try {
      const r = await api.getClients();
      setClients(Array.isArray(r) ? r : []);
    } catch (e) {
      setClients([]);
      showToast('Failed to load clients', 'error');
    }
  };

  const getFiltered = () => {
    let filtered = [...clients];
    if (search) filtered = filtered.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
    if (statusFilter === 'active') filtered = filtered.filter(c => c.active);
    else if (statusFilter === 'inactive') filtered = filtered.filter(c => !c.active);
    if (sortBy === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'date') filtered.sort((a, b) => (b.id || 0) - (a.id || 0));
    return filtered;
  };

  const handleSave = async (data) => {
    try {
      if (editingClient) {
        await api.updateClient(editingClient.id, data);
        showToast('Client updated');
      } else {
        await api.createClient(data);
        showToast('Client added');
      }
      setShowModal(false);
      setEditingClient(null);
      loadClients();
    } catch (e) {
      showToast('Failed to save client', 'error');
    }
  };

  const toggleActive = async (id, currentActive) => {
    try {
      if (currentActive) {
        await api.deleteClient(id);
      } else {
        await api.updateClient(id, { active: true });
      }
      showToast(currentActive ? 'Client deactivated' : 'Client reactivated');
      loadClients();
    } catch (e) {
      showToast('Failed to update status', 'error');
    }
  };

  const showSuggestions = async (clientId) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    setSuggestionsClient(client);
    setSuggestions([]);
    try {
      const r = await api.getMatchingSuggestions(clientId, { limit: 5 });
      setSuggestions(Array.isArray(r) ? r : []);
    } catch (e) {
      setSuggestions([]);
    }
  };

  const filtered = getFiltered();
  const activeCount = clients.filter(c => c.active).length;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 className="ct" style={{ fontSize: 22, marginBottom: 6 }}>Client Management</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
            {activeCount} active client{activeCount !== 1 ? 's' : ''}
          </div>
        </div>
        <button className="btn bp" onClick={() => { setEditingClient(null); setShowModal(true); }}>+ Add Client</button>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center', background: 'var(--surface)', padding: '14px 18px', borderRadius: 'var(--r)', boxShadow: 'var(--shadow)', border: '1px solid var(--border)' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); }} placeholder="Search clients by name..." />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Clients</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="name">Sort by Name</option>
          <option value="date">Sort by Date Added</option>
        </select>
      </div>

      {/* Client Grid */}
      <div className="mon-client-grid">
        {filtered.length === 0 ? (
          <div className="mon-empty-state" style={{ gridColumn: '1 / -1' }}>
            <div style={{ width: 64, height: 64, background: 'var(--accent-soft)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 32 }}>&#128101;</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{search || statusFilter !== 'all' ? 'No clients match your filters' : 'No clients yet'}</div>
            <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 20 }}>{search || statusFilter !== 'all' ? 'Try adjusting your search' : 'Add your first client to start'}</div>
            {!(search || statusFilter !== 'all') && <button className="btn bp" onClick={() => { setEditingClient(null); setShowModal(true); }}>Add Your First Client</button>}
          </div>
        ) : filtered.map(c => {
          const keywords = (c.keywords || '').split(',').map(k => k.trim()).filter(Boolean);
          const toneClass = (c.tone || 'conversational').toLowerCase() === 'formal' ? 'formal' : 'conversational';
          return (
            <div key={c.id} className={`mon-client-card${c.active ? '' : ' inactive'}`} style={{ opacity: c.active ? 1 : 0.6 }} onClick={() => showSuggestions(c.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{c.name}</div>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.active ? 'var(--green)' : 'var(--border2)', boxShadow: c.active ? '0 0 0 3px rgba(16,185,129,0.2)' : 'none' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10, fontSize: 13.5 }}>
                <span style={{ color: 'var(--muted)', flexShrink: 0 }}>&#128101;</span>
                <span style={{ color: 'var(--text2)' }}>{c.audience || 'Not specified'}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontSize: 13.5 }}>
                <span style={{ color: 'var(--muted)', flexShrink: 0 }}>&#128172;</span>
                <span className={`mon-badge`} style={{ background: toneClass === 'formal' ? '#ede9fe' : 'var(--accent-soft)', color: toneClass === 'formal' ? '#7c3aed' : 'var(--accent)', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                  {(c.tone || 'conversational').charAt(0).toUpperCase() + (c.tone || 'conversational').slice(1)}
                </span>
              </div>

              {c.wp_url && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontSize: 13.5 }}>
                  <span style={{ color: 'var(--muted)', flexShrink: 0 }}>&#128279;</span>
                  <a href={c.wp_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--accent)', textDecoration: 'none', wordBreak: 'break-all' }}>{c.wp_url.replace(/^https?:\/\//, '')}</a>
                </div>
              )}

              {keywords.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                  <span style={{ color: 'var(--muted)', flexShrink: 0, marginTop: 3 }}>&#127991;</span>
                  <div className="mon-kw-tags">
                    {keywords.slice(0, 6).map((k, i) => <span key={i} className="mon-kw-tag">{k}</span>)}
                    {keywords.length > 6 && <span style={{ background: 'var(--surface3)', color: 'var(--muted)', padding: '3px 10px', borderRadius: 20, fontSize: 11 }}>+{keywords.length - 6} more</span>}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', fontSize: 12.5, color: 'var(--muted)' }}>
                <span><strong style={{ color: 'var(--text)' }}>{c.posts_generated || 0}</strong> posts</span>
                <span><strong style={{ color: 'var(--text)' }}>{c.assignments_count || 0}</strong> assignments</span>
              </div>

              <div style={{ display: 'flex', gap: 6, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                <button className="btn bs sm" onClick={() => { setEditingClient(c); setShowModal(true); }}>Edit</button>
                <button className="btn bs sm" style={{ color: c.active ? 'var(--yellow)' : 'var(--green)', borderColor: c.active ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)' }} onClick={() => toggleActive(c.id, c.active)}>
                  {c.active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Suggestions Panel */}
      {suggestionsClient && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 22, marginTop: 24, boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>Suggested Topics for {suggestionsClient.name}</span>
            <button className="btn bs sm" onClick={() => setSuggestionsClient(null)}>Close</button>
          </div>
          {suggestions.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: 24 }}>No matching topics found. Try running a scrape first.</p>
          ) : suggestions.map((s, i) => {
            const score = s.relevance_score || s.score || 0;
            const pct = Math.round(score * 100);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8 }}>
                <div style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, background: pct >= 70 ? 'var(--green-soft)' : pct >= 40 ? 'var(--yellow-soft)' : 'var(--surface3)', color: pct >= 70 ? 'var(--green)' : pct >= 40 ? 'var(--yellow)' : 'var(--muted)' }}>
                  {pct}%
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text)', textDecoration: 'none' }}>{s.title || s.topic_title || 'Untitled'}</a> : (s.title || s.topic_title || 'Untitled')}</div>
                  {(s.source || s.source_name) && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{s.source || s.source_name}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <ClientFormModal
          client={editingClient}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingClient(null); }}
        />
      )}

      {toast && <div className={`mon-toast show mon-toast-${toast.type}`}>{toast.msg}</div>}
    </>
  );
}

function ClientFormModal({ client, onSave, onClose }) {
  const [form, setForm] = useState({
    name: client?.name || '',
    audience: client?.audience || '',
    tone: client?.tone || 'conversational',
    wp_url: client?.wp_url || '',
    keywords: client?.keywords || '',
  });

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="mon-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="mon-modal">
        <h3>{client ? 'Edit Client' : 'Add New Client'}</h3>
        <div className="fg" style={{ marginBottom: 16 }}>
          <label>Client / Company Name *</label>
          <input type="text" value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g. Anderson CPA Group" autoFocus />
        </div>
        <div className="fg" style={{ marginBottom: 16 }}>
          <label>Target Audience</label>
          <textarea value={form.audience} onChange={e => update('audience', e.target.value)} rows={2} placeholder="e.g. Small business owners..." />
        </div>
        <div className="mon-field-row" style={{ marginBottom: 16 }}>
          <div className="fg">
            <label>Writing Tone</label>
            <select value={form.tone} onChange={e => update('tone', e.target.value)}>
              <option value="conversational">Conversational</option>
              <option value="formal">Formal</option>
            </select>
          </div>
          <div className="fg">
            <label>WordPress URL</label>
            <input type="url" value={form.wp_url} onChange={e => update('wp_url', e.target.value)} placeholder="https://client-site.com" />
          </div>
        </div>
        <div className="fg" style={{ marginBottom: 16 }}>
          <label>SEO Keywords</label>
          <textarea value={form.keywords} onChange={e => update('keywords', e.target.value)} rows={3} placeholder="tax planning, small business tax, IRS compliance..." />
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>Enter keywords separated by commas. Used for topic matching and content generation.</div>
        </div>
        <div className="mon-modal-footer">
          <button className="btn bs" onClick={onClose}>Cancel</button>
          <button className="btn bp" onClick={() => onSave(form)}>{client ? 'Update' : 'Save'} Client</button>
        </div>
      </div>
    </div>
  );
}
