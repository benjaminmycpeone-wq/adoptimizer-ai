import { useState, useEffect, useCallback } from 'react';
import * as api from '../../monitorApi';

function fmtStatus(s) {
  return (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function countWords(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

const STATUSES = ['', 'draft', 'in_review', 'approved', 'rejected', 'published'];
const STATUS_LABELS = { '': 'All', draft: 'Draft', in_review: 'In Review', approved: 'Approved', rejected: 'Rejected', published: 'Published' };

export default function MonitorReview() {
  const [currentFilter, setCurrentFilter] = useState('');
  const [posts, setPosts] = useState([]);
  const [currentPost, setCurrentPost] = useState(null);
  const [stats, setStats] = useState({});
  const [editorBody, setEditorBody] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('Reviewer');
  const [commentBody, setCommentBody] = useState('');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadStats = useCallback(async () => {
    try { setStats(await api.getReviewStats()); } catch (e) { /* ignore */ }
  }, []);

  const loadPosts = useCallback(async () => {
    try {
      const params = { limit: 100 };
      if (currentFilter) params.status = currentFilter;
      const data = await api.getPosts(params);
      setPosts(data.posts || []);
    } catch (e) { setPosts([]); }
  }, [currentFilter]);

  useEffect(() => { loadStats(); loadPosts(); }, []);
  useEffect(() => { loadPosts(); }, [currentFilter]);

  const loadPost = async (id) => {
    try {
      const post = await api.getPost(id);
      setCurrentPost(post);
      setEditorBody(post.body || '');
      setReviewerNotes(post.reviewer_notes || '');
    } catch (e) { showToast('Failed to load post', 'error'); }
  };

  const saveBody = async () => {
    if (!currentPost) return;
    try {
      await api.updatePost(currentPost.id, { body: editorBody });
      showToast('Post saved');
    } catch (e) { showToast('Failed to save', 'error'); }
  };

  const saveNotes = async () => {
    if (!currentPost) return;
    try { await api.updatePost(currentPost.id, { reviewer_notes: reviewerNotes }); } catch (e) { /* ignore */ }
  };

  const doTransition = async (status) => {
    if (!currentPost) return;
    await saveBody();
    try {
      await api.transitionPost(currentPost.id, status);
      showToast('Status changed to ' + fmtStatus(status));
      loadStats();
      loadPost(currentPost.id);
      loadPosts();
    } catch (e) { showToast('Transition failed', 'error'); }
  };

  const postComment = async () => {
    if (!currentPost || !commentBody.trim()) return;
    try {
      await api.addComment(currentPost.id, { author: commentAuthor || 'Reviewer', body: commentBody });
      setCommentBody('');
      loadPost(currentPost.id);
    } catch (e) { showToast('Failed to post comment', 'error'); }
  };

  const transitions = {
    draft: [{ label: 'Submit for Review', status: 'in_review', cls: 'bp' }],
    in_review: [
      { label: 'Approve', status: 'approved', cls: 'bg' },
      { label: 'Reject', status: 'rejected', cls: 'btn', style: { background: 'var(--red)', color: '#fff' } },
    ],
    rejected: [
      { label: 'Revise', status: 'draft', cls: 'bs' },
      { label: 'Resubmit', status: 'in_review', cls: 'bp' },
    ],
  };

  const actions = currentPost ? (transitions[currentPost.status] || []) : [];

  return (
    <>
      <h2 className="ct" style={{ fontSize: 20, marginBottom: 2 }}>Review & Approval Queue</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>Review generated posts, leave feedback, and manage approval workflow</p>

      {/* Status Pills */}
      <div className="mon-status-bar">
        {STATUSES.map(s => (
          <button key={s} className={`mon-stat-pill${currentFilter === s ? ' active' : ''}`} onClick={() => setCurrentFilter(s)}>
            {STATUS_LABELS[s]}
            <span className="count">{s === '' ? (stats.total ?? 0) : (stats[s] ?? 0)}</span>
          </button>
        ))}
      </div>

      <div className="mon-review-layout">
        {/* Post List */}
        <div className="mon-post-list">
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0, display: 'flex', justifyContent: 'space-between', background: 'var(--surface2)' }}>
            <span>Posts</span>
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--muted)' }}>{posts.length} results</span>
          </div>
          {posts.length === 0 ? (
            <div className="mon-empty-state" style={{ flex: 1 }}>No posts found</div>
          ) : posts.map(p => (
            <div key={p.id} className={`mon-post-item${currentPost?.id === p.id ? ' selected' : ''}`} onClick={() => loadPost(p.id)}>
              <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.topic}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--muted)', flexWrap: 'wrap' }}>
                <span className={`mon-badge mon-badge-${p.status}`}>{fmtStatus(p.status)}</span>
                <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.client || 'No client'}</span>
                <span>{p.word_count ?? 0} words</span>
              </div>
            </div>
          ))}
        </div>

        {/* Detail Panel */}
        <div className="mon-detail-panel">
          {!currentPost ? (
            <div className="mon-empty-state" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div className="mon-empty-icon">&#128196;</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text2)' }}>No post selected</div>
              <div className="mon-empty-text">Select a post from the list to review</div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, lineHeight: 1.3 }}>{currentPost.topic}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className={`mon-badge mon-badge-${currentPost.status}`}>{fmtStatus(currentPost.status)}</span>
                  <span>{currentPost.client || 'No client'}</span>
                  <span>{currentPost.word_count ?? 0} words</span>
                  {currentPost.wp_post_url && <a href={currentPost.wp_post_url} target="_blank" rel="noopener noreferrer" style={{ color: '#a855f7', textDecoration: 'none', fontWeight: 600 }}>View on WordPress</a>}
                </div>
              </div>

              {/* Split: Editor + Comments */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', flex: 1, overflow: 'hidden' }}>
                {/* Editor */}
                <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', overflow: 'hidden' }}>
                  <div style={{ padding: '8px 20px', fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--surface2)' }}>Post Body</div>
                  <textarea value={editorBody} onChange={e => setEditorBody(e.target.value)} placeholder="Post content..." style={{ flex: 1, border: 'none', padding: 20, fontFamily: 'Georgia, serif', fontSize: 15, lineHeight: 1.85, resize: 'none', outline: 'none', background: 'var(--surface)', color: 'var(--text)' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 20px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)', background: 'var(--surface2)' }}>
                    <span>{countWords(editorBody)} words</span>
                  </div>
                </div>

                {/* Comments */}
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface2)' }}>
                  <div style={{ padding: '8px 16px', fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Comments</span>
                    <span>{(currentPost.comments || []).length}</span>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(currentPost.comments || []).length === 0 ? (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>No comments yet</div>
                    ) : (currentPost.comments || []).map((c, i) => (
                      <div key={i} className="mon-comment-box">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-soft)', padding: '1px 6px', borderRadius: 4 }}>{c.author}</span>
                          <span style={{ fontSize: 10, color: 'var(--muted)' }}>{fmtTime(c.created_at)}</span>
                        </div>
                        <div style={{ fontSize: 13, lineHeight: 1.5 }}>{c.body}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ borderTop: '1px solid var(--border)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, background: 'var(--surface)' }}>
                    <input type="text" value={commentAuthor} onChange={e => setCommentAuthor(e.target.value)} placeholder="Your name" style={{ padding: '7px 10px', fontSize: 13 }} />
                    <textarea value={commentBody} onChange={e => setCommentBody(e.target.value)} placeholder="Write a comment..." rows={3} style={{ padding: '7px 10px', fontSize: 13, resize: 'none' }} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); postComment(); } }} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button className="btn bp sm" onClick={postComment}>Post Comment</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0, background: 'var(--surface2)', alignItems: 'center' }}>
                <button className="btn bs" onClick={saveBody}>Save</button>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ fontSize: 11, whiteSpace: 'nowrap', margin: 0 }}>NOTES</label>
                  <input type="text" value={reviewerNotes} onChange={e => setReviewerNotes(e.target.value)} onBlur={saveNotes} placeholder="Reviewer notes..." style={{ flex: 1, fontSize: 13 }} />
                </div>
                {currentPost.status === 'approved' && (
                  <a href="/monitor/publisher" className="btn bp" style={{ textDecoration: 'none', background: '#a855f7' }}>Publish</a>
                )}
                {actions.map((a, i) => (
                  <button key={i} className={`btn ${a.cls}`} style={a.style} onClick={() => doTransition(a.status)}>{a.label}</button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {toast && <div className={`mon-toast show mon-toast-${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
