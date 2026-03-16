import useStore from './store';

const API_BASE = '';  // Vite proxy handles /scrape, /ai-proxy, /api, /health

/**
 * Check if scraper server is online.
 */
export async function checkHealth() {
  try {
    const r = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    const d = await r.json();
    return d.status === 'ok';
  } catch {
    return false;
  }
}

/**
 * Scrape a client website.
 */
export async function scrapeUrl(url) {
  if (!url.startsWith('http')) url = 'https://' + url;
  const r = await fetch(`${API_BASE}/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const d = await r.json();
  if (d.error) throw new Error(d.error);
  if (d.firmName === 'ERROR' || (d.summary && (
    d.summary.includes('403') || d.summary.includes('could not be satisfied') ||
    d.summary.includes('Access Denied') || d.summary.includes('Cloudflare')
  ))) {
    throw new Error('Site blocked scraper (403/WAF). Use Manual Entry below or try a different URL.');
  }
  return d;
}

/**
 * Parse SSE stream from AI proxy.
 */
export async function sse(resp, onChunk) {
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const l of lines) {
      if (l.startsWith('data: ') && l !== 'data: [DONE]') {
        try { onChunk(JSON.parse(l.slice(6))); } catch {}
      }
    }
  }
}

/**
 * Call AI provider via proxy with SSE streaming.
 * Returns the full generated text.
 */
export async function callAI(prompt, onToken) {
  const { aiKey, aiProv, aiMod } = useStore.getState();
  if (!aiKey) throw new Error('No AI key set — go to AI API Key in the sidebar');

  const payload = {
    model: aiMod,
    max_tokens: 4000,
    stream: true,
    messages: [{ role: 'user', content: prompt }],
  };

  const r = await fetch(`${API_BASE}/ai-proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: aiProv, apiKey: aiKey, payload }),
  });

  if (!r.ok) {
    let msg = 'HTTP ' + r.status;
    try {
      const e = await r.json();
      msg = e?.error?.message || e?.error || e?.message || JSON.stringify(e);
    } catch {}
    throw new Error(msg);
  }

  let fullText = '';
  if (aiProv === 'anthropic') {
    await sse(r, (c) => {
      if (c.type === 'content_block_delta' && c.delta?.text) {
        fullText += c.delta.text;
        onToken?.(c.delta.text, fullText);
      }
    });
  } else {
    await sse(r, (c) => {
      const t = c.choices?.[0]?.delta?.content;
      if (t) {
        fullText += t;
        onToken?.(t, fullText);
      }
    });
  }
  return fullText;
}

/**
 * Save campaign to backend DB.
 */
export async function saveCampaign(data) {
  const r = await fetch(`${API_BASE}/api/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return r.json();
}

/**
 * List campaigns from DB.
 */
export async function listCampaigns() {
  const r = await fetch(`${API_BASE}/api/campaigns`);
  return r.json();
}

/**
 * Get single campaign.
 */
export async function getCampaign(id) {
  const r = await fetch(`${API_BASE}/api/campaigns/${id}`);
  return r.json();
}

/**
 * List past scrape results.
 */
export async function listScrapeResults() {
  const r = await fetch(`${API_BASE}/api/scrape-results`);
  return r.json();
}
