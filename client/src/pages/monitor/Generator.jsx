import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '../../monitorApi';

export default function Generator() {
  const [clients, setClients] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [clientFilter, setClientFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [postBody, setPostBody] = useState('');
  const [currentPostId, setCurrentPostId] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState('idle');
  const [profile, setProfile] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [toast, setToast] = useState(null);
  const controllerRef = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    loadClients();
    loadAssignments();
  }, []);

  const loadClients = async () => {
    try {
      const r = await api.getClients();
      setClients(Array.isArray(r) ? r.filter(c => c.active) : []);
    } catch (e) { /* ignore */ }
  };

  const loadAssignments = useCallback(async () => {
    const params = {};
    if (clientFilter) params.client_id = clientFilter;
    if (statusFilter) params.status = statusFilter;
    try {
      const r = await api.getAssignments(params);
      setAssignments(Array.isArray(r) ? r : (r.assignments || []));
    } catch (e) { setAssignments([]); }
  }, [clientFilter, statusFilter]);

  useEffect(() => { loadAssignments(); }, [clientFilter, statusFilter]);

  const selectAssignment = async (a) => {
    setSelected(a);
    setCurrentPostId(a.post_id || null);
    setStreamStatus('idle');

    if (a.post_id) {
      try {
        const post = await api.getPost(a.post_id);
        setPostBody(post.body || '');
      } catch (e) { setPostBody(''); }
    } else {
      setPostBody('');
    }

    try {
      const client = await api.getClient(a.client_id);
      setProfile(client);
    } catch (e) { setProfile(null); }

    try {
      const sugs = await api.getMatchingSuggestions(a.client_id, { limit: 5 });
      setSuggestions(Array.isArray(sugs) ? sugs : []);
    } catch (e) { setSuggestions([]); }
  };

  const startGenerate = () => {
    if (!selected || isStreaming) return;
    setIsStreaming(true);
    setStreamStatus('streaming');
    setPostBody('');

    controllerRef.current = api.streamGeneration(
      selected.id,
      (chunk) => { setPostBody(prev => prev + chunk); },
      () => {
        setStreamStatus('done');
        setIsStreaming(false);
        showToast('Post generated successfully');
        loadAssignments();
      },
      (err) => {
        setStreamStatus('error');
        setIsStreaming(false);
        showToast('Generation error: ' + err, 'error');
      }
    );
  };

  const stopGenerate = () => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
    setIsStreaming(false);
    setStreamStatus('idle');
    showToast('Generation stopped', 'info');
  };

  const savePost = async () => {
    if (!currentPostId) {
      showToast('No post to save yet. Generate first.', 'error');
      return;
    }
    try {
      await api.updatePost(currentPostId, { body: postBody });
      showToast('Draft saved');
    } catch (e) { showToast('Failed to save', 'error'); }
  };

  const sendToReview = async () => {
    if (!currentPostId) return;
    try {
      await api.updatePost(currentPostId, { body: postBody });
      await api.transitionPost(currentPostId, 'in_review');
      showToast('Sent to review queue');
      loadAssignments();
    } catch (e) { showToast('Failed to send to review', 'error'); }
  };

  const wordCount = postBody.trim() ? postBody.trim().split(/\s+/).length : 0;

  const badgeClass = (status) => {
    const map = { pending: 'mon-badge-pending', generating: 'mon-badge-generating', done: 'mon-badge-done', draft: 'mon-badge-draft' };
    return map[status] || 'mon-badge-pending';
  };

  return (
    <div className="mon-gen-layout">
      {/* Sidebar */}
      <div className="mon-gen-sidebar">
        {/* Filters */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--muted)', marginBottom: 10 }}>Filters</div>
          <div className="fg" style={{ marginBottom: 10 }}>
            <label>Client</label>
            <select value={clientFilter} onChange={e => { setClientFilter(e.target.value); }}>
              <option value="">All Clients</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="fg">
            <label>Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="generating">Generating</option>
              <option value="done">Done</option>
            </select>
          </div>
        </div>

        {/* Assignments */}
        <div className="card" style={{ marginBottom: 0, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--muted)' }}>Assignments</span>
            <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--surface2)', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>{assignments.length}</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {assignments.length === 0 ? (
              <div className="mon-empty-state" style={{ padding: 28 }}>No assignments found</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr style={{ background: 'var(--surface2)' }}>
                  <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Topic</th>
                  <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Client</th>
                  <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Status</th>
                </tr></thead>
                <tbody>
                  {assignments.map(a => (
                    <tr key={a.id} style={{ cursor: 'pointer', background: selected?.id === a.id ? 'rgba(124,58,237,0.08)' : undefined }} onClick={() => selectAssignment(a)}>
                      <td style={{ padding: '8px 10px', borderTop: '1px solid var(--surface3)', maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>{a.topic_title}</td>
                      <td style={{ padding: '8px 10px', borderTop: '1px solid var(--surface3)', color: 'var(--muted)' }}>{a.client_name}</td>
                      <td style={{ padding: '8px 10px', borderTop: '1px solid var(--surface3)' }}><span className={`mon-badge ${badgeClass(a.status)}`}>{a.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Client Profile */}
        {profile && (
          <div className="card" style={{ marginBottom: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--muted)', marginBottom: 8 }}>Client Profile</div>
            <div style={{ fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--surface3)' }}><span style={{ color: 'var(--muted)' }}>Audience</span><span>{profile.audience || 'General'}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--surface3)' }}><span style={{ color: 'var(--muted)' }}>Tone</span><span>{profile.tone || 'Professional'}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--muted)' }}>Keywords</span>
                <div className="mon-kw-tags" style={{ justifyContent: 'flex-end', maxWidth: 190 }}>
                  {(profile.keywords || '').split(',').map(k => k.trim()).filter(Boolean).map((k, i) => <span key={i} className="mon-kw-tag">{k}</span>)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="card" style={{ marginBottom: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--muted)', marginBottom: 8 }}>Suggested Topics</div>
            {suggestions.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', borderRadius: 6, fontSize: 12, marginBottom: 4, background: 'var(--surface2)' }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--surface3)', color: 'var(--muted)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                <div style={{ lineHeight: 1.4 }}>{s.title || s.topic_title || 'Untitled'}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editor */}
      <div className="mon-gen-editor">
        <div className="mon-gen-editor-toolbar">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {selected ? selected.topic_title : 'AI Blog Generator'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>
              {selected ? selected.client_name : 'Select an assignment to begin'}
            </div>
          </div>
          <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', background: 'var(--surface2)', padding: '4px 10px', borderRadius: 6 }}>{wordCount} words</span>
          <span className={`mon-badge ${streamStatus === 'streaming' ? 'mon-badge-generating' : streamStatus === 'done' ? 'mon-badge-done' : streamStatus === 'error' ? 'mon-badge-rejected' : 'mon-badge-draft'}`} style={{ padding: '4px 14px', borderRadius: 20, fontSize: 12 }}>
            {streamStatus === 'streaming' ? 'Streaming...' : streamStatus === 'done' ? 'Done' : streamStatus === 'error' ? 'Error' : 'Idle'}
          </span>
        </div>

        {!selected ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', gap: 12, padding: 40 }}>
            <div style={{ fontSize: 48, opacity: 0.25 }}>&#9998;</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text2)' }}>No assignment selected</div>
            <div style={{ fontSize: 13, textAlign: 'center', maxWidth: 300 }}>Choose an assignment from the sidebar to start generating content</div>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
              <textarea
                value={postBody}
                onChange={e => setPostBody(e.target.value)}
                placeholder="Your AI-generated article will appear here..."
                style={{ width: '100%', height: '100%', border: '1px solid var(--border)', padding: '28px 32px', fontFamily: 'Georgia, serif', fontSize: 16, lineHeight: 1.8, resize: 'none', outline: 'none', margin: 16, borderRadius: 'var(--r)', background: 'var(--surface)', color: 'var(--text)' }}
              />
              <div className={`mon-stream-bar${isStreaming ? ' active' : ''}`} style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }} />
            </div>
            <div className="mon-gen-editor-footer">
              {!isStreaming ? (
                <button className="btn bp" onClick={startGenerate} disabled={!selected}>Generate Post</button>
              ) : (
                <button className="btn bs" style={{ color: 'var(--red)', borderColor: 'rgba(239,68,68,0.3)' }} onClick={stopGenerate}>Stop</button>
              )}
              <div style={{ flex: 1 }} />
              {currentPostId && (
                <>
                  <button className="btn bs" onClick={savePost}>Save Draft</button>
                  <button className="btn bg" onClick={sendToReview}>Send to Review</button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {toast && <div className={`mon-toast show mon-toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
