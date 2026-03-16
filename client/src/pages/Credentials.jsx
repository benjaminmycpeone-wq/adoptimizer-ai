import { useState } from 'react';
import useStore from '../store';
import PasswordInput from '../components/PasswordInput';
import AlertBanner from '../components/AlertBanner';
import { getToken, gads } from '../auth';

export default function Credentials() {
  const { cr, setCr, log } = useStore();
  const [dt, setDt] = useState(cr.dt);
  const [mcc, setMcc] = useState(cr.mcc);
  const [cid, setCid] = useState(cr.cid);
  const [cs, setCs] = useState(cr.cs);
  const [rt, setRt] = useState(cr.rt);
  const [cu, setCu] = useState(cr.cu);
  const [status, setStatus] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedName, setSelectedName] = useState('');

  const save = () => {
    const newCr = {
      dt, cid, cs, rt,
      mcc: mcc.replace(/-/g, ''),
      cu: cu.replace(/-/g, ''),
    };
    setCr(newCr);
    const miss = ['dt', 'cid', 'cs', 'rt'].filter((k) => !newCr[k]);
    if (miss.length) {
      setStatus({ type: 'aw', msg: 'Missing fields: ' + miss.join(', ') });
    } else {
      setStatus({ type: 'as', msg: '✅ Saved! Click Test to verify.' });
      log('Google creds saved');
    }
  };

  const clear = () => {
    setDt(''); setMcc(''); setCid(''); setCs(''); setRt(''); setCu('');
    setCr({ dt: '', cid: '', cs: '', rt: '', mcc: '', cu: '' });
    useStore.getState().setTok(null, 0);
    setStatus(null);
  };

  const test = async () => {
    save();
    setStatus({ type: 'ai', msg: '⏳ Testing…' });
    try {
      await getToken();
      setStatus({ type: 'as', msg: '✅ OAuth success!' });
      log('Google Ads verified');
    } catch (e) {
      setStatus({ type: 'ae', msg: '❌ ' + e.message });
    }
  };

  const listAccts = async () => {
    setAccounts([]);
    try {
      const mccId = cr.mcc.replace(/-/g, '');
      if (!mccId) { setStatus({ type: 'ae', msg: '❌ MCC Account ID is required to list accounts' }); return; }
      const d = await gads('googleAds:searchStream', {
        query: 'SELECT customer_client.client_customer, customer_client.descriptive_name, customer_client.status FROM customer_client WHERE customer_client.level <= 1',
      }, 'POST', { customerId: mccId });
      const rows = d?.[0]?.results || d?.results || [];
      setAccounts(rows.map((x) => {
        const cc = x.customerClient;
        return {
          id: cc.clientCustomer.replace('customers/', ''),
          name: cc.descriptiveName || 'Unnamed',
          status: cc.status,
        };
      }));
    } catch (e) {
      setStatus({ type: 'ae', msg: '❌ ' + e.message });
    }
  };

  const pickAcct = (id, name) => {
    setCu(id);
    setCr({ cu: id });
    setSelectedName(name);
    log(`Selected account: ${name} (${id})`);
  };

  return (
    <>
      <div className="al aw">
        <span>🔒</span>
        <div>Credentials saved in your browser's local storage — sent only to Google's OAuth and Ads API.</div>
      </div>

      <div className="card card-gradient">
        <div className="ch">
          <div><div className="ct">🔑 Google Ads Credentials</div></div>
          <button className="btn bs sm" onClick={test}>🧪 Test Connection</button>
        </div>

        <div className="fr">
          <div className="fg">
            <label>Developer Token</label>
            <PasswordInput value={dt} onChange={setDt} placeholder="KHer4r9…" />
          </div>
          <div className="fg">
            <label>MCC Account ID</label>
            <input value={mcc} onChange={(e) => setMcc(e.target.value)} placeholder="123-456-7890" />
          </div>
        </div>

        <div className="fr">
          <div className="fg">
            <label>OAuth Client ID</label>
            <PasswordInput value={cid} onChange={setCid} placeholder="…googleusercontent.com" />
          </div>
          <div className="fg">
            <label>OAuth Client Secret</label>
            <PasswordInput value={cs} onChange={setCs} placeholder="GOCSPX-…" />
          </div>
        </div>

        <div className="fg">
          <label>Refresh Token</label>
          <PasswordInput value={rt} onChange={setRt} placeholder="1//04Qy…" style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }} />
        </div>

        {status && <AlertBanner type={status.type} message={status.msg} />}

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn bp" onClick={save}>💾 Save</button>
          <button className="btn bs" onClick={clear}>🗑 Clear</button>
        </div>
      </div>

      <div className="card">
        <div className="ch">
          <div><div className="ct">Select Ad Account</div></div>
          <button className="btn bs sm" onClick={listAccts}>📋 List Accounts</button>
        </div>

        {cu && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--primary-light, #eef2ff)', borderRadius: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>✅</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary, #6366f1)' }}>{selectedName || 'Selected Account'}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{cu}</div>
            </div>
            <button className="btn bs sm" onClick={() => { setCu(''); setCr({ cu: '' }); setSelectedName(''); }}>Change</button>
          </div>
        )}

        {!cu && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div className="fg" style={{ flex: 1, margin: 0 }}>
              <label>Customer Account ID</label>
              <input value={cu} onChange={(e) => { setCu(e.target.value); setCr({ cu: e.target.value.replace(/-/g, '') }); }} placeholder="987-654-3210 or click List Accounts" />
            </div>
          </div>
        )}

        {accounts.length > 0 && !cu && (
          <div style={{ marginTop: 12 }}>
            {accounts.map((a) => (
              <div key={a.id} className="camp-row" style={{ cursor: 'pointer' }} onClick={() => pickAcct(a.id, a.name)}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{a.id}</div>
                </div>
                <span className={`tag ${a.status === 'ENABLED' ? 'tg' : 'ty'}`}>{a.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
