import { useRef, useEffect } from 'react';
import Markdown from 'react-markdown';

export default function AiOutput({ text, id }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [text]);

  const handleCopy = () => {
    navigator.clipboard.writeText(text || '');
  };

  // Strip JSON action blocks from display text (they're shown in the action checklist)
  const displayText = (text || '').replace(/```json\s*\n?\{[\s\S]*?\}\s*\n?```/g, '').trim();

  return (
    <div>
      <div ref={ref} className="aio-md" id={id}>
        {displayText ? <Markdown>{displayText}</Markdown> : <span className="aio-placeholder">AI output will appear here…</span>}
      </div>
      <div style={{ display: 'flex', gap: 7, marginTop: 8 }}>
        <button className="btn bs sm" onClick={handleCopy}>📋 Copy Full Report</button>
      </div>
    </div>
  );
}
