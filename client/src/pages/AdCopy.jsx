import { useState } from 'react';
import AiOutput from '../components/AiOutput';
import { callAI } from '../api';
import { PROMPTS } from '../constants';

export default function AdCopy() {
  const [name, setName] = useState('');
  const [service, setService] = useState('');
  const [location, setLocation] = useState('');
  const [usp, setUsp] = useState('');
  const [format, setFormat] = useState('RSA');
  const [tone, setTone] = useState('Professional');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const generate = async () => {
    if (!name || !service) { alert('Enter business name and service'); return; }
    setLoading(true);
    setText('');
    setShowResult(true);
    const prompt = PROMPTS.adCopyStandalone({ format, name, service, location, usp, tone });
    try {
      const result = await callAI(prompt, (_, full) => setText(full));
      setText(result);
    } catch (e) { setText('❌ ' + e.message); }
    setLoading(false);
  };

  return (
    <>
      <div className="card card-gradient">
        <div className="ch"><div className="ct">✍️ Ad Copy Generator</div></div>
        <div className="fr">
          <div className="fg"><label>Business Name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Smith CPA" /></div>
          <div className="fg"><label>Service</label><input value={service} onChange={(e) => setService(e.target.value)} placeholder="tax preparation" /></div>
        </div>
        <div className="fr">
          <div className="fg"><label>Location</label><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Austin, TX" /></div>
          <div className="fg"><label>USP</label><input value={usp} onChange={(e) => setUsp(e.target.value)} placeholder="Free consult, 15+ yrs exp" /></div>
        </div>
        <div className="fr">
          <div className="fg">
            <label>Format</label>
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="RSA">RSA (15 headlines + 4 descs)</option>
              <option value="CALLOUTS">Callout Extensions</option>
              <option value="FULL">Full Package</option>
            </select>
          </div>
          <div className="fg">
            <label>Tone</label>
            <select value={tone} onChange={(e) => setTone(e.target.value)}>
              <option>Professional</option><option>Urgent</option><option>Friendly</option>
            </select>
          </div>
        </div>
        <button className="btn bp" onClick={generate} disabled={loading}>
          {loading ? <><span className="spin" /> Generating…</> : '✨ Generate Ad Copy'}
        </button>
      </div>
      {showResult && (
        <div className="card">
          <div className="ch"><div className="ct">Generated Copy</div></div>
          <AiOutput text={text} id="ac-o" />
        </div>
      )}
    </>
  );
}
