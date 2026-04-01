const API = '';

// ─── Stats ───
export const getStats = () =>
  fetch(`${API}/api/monitor/stats`).then(r => r.json());

// ─── Sources ───
export const getSources = (params = {}) =>
  fetch(`${API}/api/monitor/sources?${new URLSearchParams(params)}`).then(r => r.json());

export const getSourceStats = () =>
  fetch(`${API}/api/monitor/sources/stats`).then(r => r.json());

export const createSource = (data) =>
  fetch(`${API}/api/monitor/sources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.json());

export const updateSource = (id, data) =>
  fetch(`${API}/api/monitor/sources/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.json());

export const deleteSource = (id) =>
  fetch(`${API}/api/monitor/sources/${id}`, { method: 'DELETE' });

export const importSourcesCsv = (formData) =>
  fetch(`${API}/api/monitor/sources/import-csv`, {
    method: 'POST',
    body: formData,
  }).then(r => r.json());

export const autoDiscoverSources = () =>
  fetch(`${API}/api/monitor/sources/auto-discover`, { method: 'POST' });

// ─── Topics ───
export const getTopics = (params = {}) =>
  fetch(`${API}/api/monitor/topics?${new URLSearchParams(params)}`).then(r => r.json());

export const updateTopic = (id, data) =>
  fetch(`${API}/api/monitor/topics/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.json());

export const classifyTopics = () =>
  fetch(`${API}/api/monitor/topics/classify`, { method: 'POST' }).then(r => r.json());

// ─── Clients ───
export const getClients = () =>
  fetch(`${API}/api/monitor/clients`).then(r => r.json());

export const getClient = (id) =>
  fetch(`${API}/api/monitor/clients/${id}`).then(r => r.json());

export const createClient = (data) =>
  fetch(`${API}/api/monitor/clients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.json());

export const updateClient = (id, data) =>
  fetch(`${API}/api/monitor/clients/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.json());

export const deleteClient = (id) =>
  fetch(`${API}/api/monitor/clients/${id}`, { method: 'DELETE' });

// ─── Assignments ───
export const getAssignments = (params = {}) =>
  fetch(`${API}/api/monitor/assignments?${new URLSearchParams(params)}`).then(r => r.json());

export const createAssignment = (data) =>
  fetch(`${API}/api/monitor/assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.json());

export const bulkAssign = (data) =>
  fetch(`${API}/api/monitor/assignments/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.json());

// ─── Posts ───
export const getPosts = (params = {}) =>
  fetch(`${API}/api/monitor/posts?${new URLSearchParams(params)}`).then(r => r.json());

export const getPost = (id) =>
  fetch(`${API}/api/monitor/posts/${id}`).then(r => r.json());

export const updatePost = (id, data) =>
  fetch(`${API}/api/monitor/posts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.json());

export const transitionPost = (id, status) =>
  fetch(`${API}/api/monitor/posts/${id}/transition`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  }).then(r => r.json());

export const addComment = (postId, data) =>
  fetch(`${API}/api/monitor/posts/${postId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.json());

export const getReviewStats = () =>
  fetch(`${API}/api/monitor/review/stats`).then(r => r.json());

// ─── Generation (SSE) ───
export function streamGeneration(assignmentId, onChunk, onDone, onError) {
  const controller = new AbortController();

  fetch(`${API}/api/monitor/generate/${assignmentId}`, {
    method: 'POST',
    signal: controller.signal,
  })
    .then(async (resp) => {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') {
            if (onDone) onDone();
            return;
          }
          if (data.startsWith('ERROR:')) {
            if (onError) onError(data.slice(7));
            return;
          }
          const text = data.replace(/\\n/g, '\n');
          if (onChunk) onChunk(text);
        }
      }
      if (onDone) onDone();
    })
    .catch((e) => {
      if (e.name !== 'AbortError' && onError) onError(e.message);
    });

  return controller;
}

// ─── Scrape ───
export const runScrape = () =>
  fetch(`${API}/api/monitor/scrape/run`, { method: 'POST' }).then(r => r.json());

// ─── Trends ───
export const getTrendingKeywords = (params = {}) =>
  fetch(`${API}/api/monitor/trends/keywords?${new URLSearchParams(params)}`).then(r => r.json());

export const getKeywordHistory = (keyword, params = {}) =>
  fetch(`${API}/api/monitor/trends/keywords/${encodeURIComponent(keyword)}/history?${new URLSearchParams(params)}`).then(r => r.json());

export const getTrendingTopics = (params = {}) =>
  fetch(`${API}/api/monitor/trends/topics?${new URLSearchParams(params)}`).then(r => r.json());

export const getCategories = (params = {}) =>
  fetch(`${API}/api/monitor/trends/categories?${new URLSearchParams(params)}`).then(r => r.json());

export const takeSnapshot = () =>
  fetch(`${API}/api/monitor/trends/snapshot`, { method: 'POST' }).then(r => r.json());

// ─── Matching ───
export const getMatchingSuggestions = (clientId, params = {}) =>
  fetch(`${API}/api/monitor/matching/suggestions/${clientId}?${new URLSearchParams(params)}`).then(r => r.json());

export const getTopicMatches = (topicId) =>
  fetch(`${API}/api/monitor/matching/topic/${topicId}`).then(r => r.json());

export const recomputeMatches = () =>
  fetch(`${API}/api/monitor/matching/recompute`, { method: 'POST' }).then(r => r.json());

// ─── WordPress ───
export const getWordPressSites = () =>
  fetch(`${API}/api/monitor/wordpress/sites`).then(r => r.json());

export const createWordPressSite = (data) =>
  fetch(`${API}/api/monitor/wordpress/sites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.json());

export const updateWordPressSite = (id, data) =>
  fetch(`${API}/api/monitor/wordpress/sites/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.json());

export const deleteWordPressSite = (id) =>
  fetch(`${API}/api/monitor/wordpress/sites/${id}`, { method: 'DELETE' });

export const testWordPressSite = (id) =>
  fetch(`${API}/api/monitor/wordpress/sites/${id}/test`, { method: 'POST' }).then(r => r.json());

export const testWordPressConnection = (data) =>
  fetch(`${API}/api/monitor/wordpress/sites/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.json());

// ─── Publishing ───
export const publishPost = (data) =>
  fetch(`${API}/api/monitor/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.json());

export const bulkPublish = (data) =>
  fetch(`${API}/api/monitor/publish/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.json());

export const getPublishLogs = (params = {}) =>
  fetch(`${API}/api/monitor/publish/logs?${new URLSearchParams(params)}`).then(r => r.json());
