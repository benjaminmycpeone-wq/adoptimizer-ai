import { useState } from 'react';
import useStore from '../store';
import { MODELS } from '../constants';
import PasswordInput from '../components/PasswordInput';
import AlertBanner from '../components/AlertBanner';
import { callAI } from '../api';

export default function ApiKey() {
  const { aiKey, aiProv, aiMod, setAiKey, setAiProv, setAiMod, log } = useStore();
  const [localKey, setLocalKey] = useState(aiKey);
  const [prov, setProv] = useState(aiProv);
  const [mod, setMod] = useState(aiMod);
  const [status, setStatus] = useState(null);

  const handleProvChange = (p) => {
    setProv(p);
    setMod(MODELS[p]?.[0] || '');
  };

  const save = () => {
    if (!localKey) { setStatus({ type: 'aw', msg: 'Paste your API key first.' }); return; }
    setAiKey(localKey);
    setAiProv(prov);
    setAiMod(mod);
    setStatus({ type: 'as', msg: `✅ Saved! Provider: ${prov} / Model: ${mod}` });
    log('AI key set: ' + prov);
  };

  const test = async () => {
    setStatus({ type: 'ai', msg: '⏳ Testing…' });
    // Temporarily set the key so callAI can use it
    setAiKey(localKey);
    setAiProv(prov);
    setAiMod(mod);
    try {
      let result = '';
      await callAI('Say: "API key works!"', (_, full) => { result = full; });
      setStatus({ type: 'as', msg: '✅ Works! Response: ' + result.slice(0, 80) });
    } catch (e) {
      setStatus({ type: 'ae', msg: '❌ ' + e.message });
    }
  };

  const clear = () => {
    setLocalKey('');
    setAiKey('');
    setStatus({ type: 'ai', msg: 'Key cleared.' });
  };

  return (
    <div className="card card-gradient">
      <div className="ch">
        <div>
          <div className="ct">🤖 AI API Key</div>
          <div className="cs">Powers keyword research and ad copy generation</div>
        </div>
      </div>

      <div className="al aw">
        <span>🔒</span>
        <div>Key is saved in your browser's local storage — persists across sessions.</div>
      </div>

      <div className="fr">
        <div className="fg">
          <label>Provider</label>
          <select value={prov} onChange={(e) => handleProvChange(e.target.value)}>
            <option value="anthropic">Anthropic (Claude) — Recommended</option>
            <option value="openai">OpenAI (GPT-4o)</option>
            <option value="moonshot">Moonshot (Kimi)</option>
            <option value="openrouter">OpenRouter (Free models available)</option>
          </select>
        </div>
        <div className="fg">
          <label>Model</label>
          <select value={mod} onChange={(e) => setMod(e.target.value)}>
            {(MODELS[prov] || []).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="fg">
        <label>API Key</label>
        <PasswordInput value={localKey} onChange={setLocalKey} placeholder="Paste your API key here…" />
      </div>

      {status && <AlertBanner type={status.type} message={status.msg} />}

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn bp" onClick={save}>💾 Save Key</button>
        <button className="btn bs" onClick={test}>🧪 Test</button>
        <button className="btn bs" onClick={clear}>🗑 Clear</button>
      </div>

      <div className="divider" />

      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
        Get your key
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13, color: 'var(--text2)' }}>
        <div>🟣 <b>Anthropic:</b> <a href="https://console.anthropic.com" target="_blank" rel="noreferrer">console.anthropic.com</a> → API Keys</div>
        <div>🟢 <b>OpenAI:</b> <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">platform.openai.com/api-keys</a></div>
        <div>🔀 <b>OpenRouter:</b> <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">openrouter.ai/keys</a> (has free tiers)</div>
      </div>
    </div>
  );
}
