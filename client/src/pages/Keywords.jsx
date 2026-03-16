import { useState } from 'react';
import AiOutput from '../components/AiOutput';
import { callAI } from '../api';
import { PROMPTS } from '../constants';

export default function Keywords() {
  const [niche, setNiche] = useState('');
  const [focus, setFocus] = useState('');
  const [matchType, setMatchType] = useState('All Types');
  const [count, setCount] = useState('50');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const research = async () => {
    if (!niche) { alert('Enter a business or niche'); return; }
    setLoading(true);
    setText('');
    setShowResult(true);
    const prompt = PROMPTS.keywordResearch({ count, niche, focus, matchType });
    try {
      const result = await callAI(prompt, (_, full) => setText(full));
      setText(result);
    } catch (e) { setText('❌ ' + e.message); }
    setLoading(false);
  };

  return (
    <>
      <div className="card card-gradient">
        <div className="ch"><div className="ct">🔤 AI Keyword Research</div></div>
        <div className="fr">
          <div className="fg"><label>Business / Niche</label><input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="CPA firm Austin TX" /></div>
          <div className="fg"><label>Focus Service (optional)</label><input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="tax preparation" /></div>
        </div>
        <div className="fr">
          <div className="fg">
            <label>Match Type</label>
            <select value={matchType} onChange={(e) => setMatchType(e.target.value)}>
              <option>All Types</option><option>Phrase Match</option><option>Exact Match</option><option>Broad Match</option>
            </select>
          </div>
          <div className="fg">
            <label>Count</label>
            <select value={count} onChange={(e) => setCount(e.target.value)}>
              <option>25</option><option>50</option><option>100</option>
            </select>
          </div>
        </div>
        <button className="btn bp" onClick={research} disabled={loading}>
          {loading ? <><span className="spin" /> Researching…</> : '✨ Research Keywords'}
        </button>
      </div>
      {showResult && (
        <div className="card">
          <div className="ch"><div className="ct">Results</div></div>
          <AiOutput text={text} id="kp-o" />
        </div>
      )}
    </>
  );
}
