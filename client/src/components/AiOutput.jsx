import { useRef, useEffect, useCallback } from 'react';
import Markdown from 'react-markdown';
import useStore from '../store';

export default function AiOutput({ text, id, streaming }) {
  const ref = useRef(null);
  const scrollTimer = useRef(null);

  // Debounced auto-scroll (100ms throttle)
  useEffect(() => {
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
    }, 100);
    return () => clearTimeout(scrollTimer.current);
  }, [text]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text || '');
    useStore.getState().addToast('Copied to clipboard!', 'as');
  }, [text]);

  // Strip JSON action blocks from display text
  const displayText = (text || '').replace(/```json\s*\n?\{[\s\S]*?\}\s*\n?```/g, '').trim();

  return (
    <div>
      <div ref={ref} className="aio-md" id={id}>
        {displayText ? (
          <>
            <Markdown>{displayText}</Markdown>
            {streaming && <span className="streaming-cursor" />}
          </>
        ) : streaming ? (
          <div className="streaming-placeholder">
            <span className="spin-dark" />
            <span>AI is analyzing your data...</span>
          </div>
        ) : (
          <span className="aio-placeholder">AI output will appear here…</span>
        )}
      </div>
      {text && !streaming && (
        <div style={{ display: 'flex', gap: 7, marginTop: 8 }}>
          <button className="btn bs sm" onClick={handleCopy}>📋 Copy Full Report</button>
        </div>
      )}
    </div>
  );
}
