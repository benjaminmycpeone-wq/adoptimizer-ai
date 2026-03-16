import useStore from './store';

/**
 * Get a valid Google OAuth access token (cached or refreshed).
 */
export async function getToken() {
  const { tok, tokExp, cr } = useStore.getState();
  if (tok && Date.now() < tokExp) return tok;

  const { cid, cs, rt } = cr;
  if (!cid || !cs || !rt) throw new Error('Google Ads credentials not set');

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cid,
      client_secret: cs,
      refresh_token: rt,
      grant_type: 'refresh_token',
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error_description || d.error || 'OAuth failed');

  const newTok = d.access_token;
  const newExp = Date.now() + (d.expires_in - 60) * 1000;
  useStore.getState().setTok(newTok, newExp);
  return newTok;
}

/**
 * Make a Google Ads API v17 call.
 */
export async function gads(endpoint, body, method = 'POST') {
  const tok = await getToken();
  const { cr } = useStore.getState();
  const cid = cr.cu || cr.mcc;
  if (!cid) throw new Error('Customer ID not set');

  const r = await fetch(`https://googleads.googleapis.com/v17/customers/${cid}/${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${tok}`,
      'developer-token': cr.dt,
      'Content-Type': 'application/json',
      'login-customer-id': cr.mcc,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok) {
    const m = d?.error?.details?.[0]?.errors?.[0]?.message || d?.error?.message || JSON.stringify(d);
    throw new Error(m);
  }
  return d;
}
