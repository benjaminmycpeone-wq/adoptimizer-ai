import { useRef, useEffect } from 'react';

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

  return (
    <div>
      <div ref={ref} className="aio" id={id}>
        {text || ''}
      </div>
      <div style={{ display: 'flex', gap: 7, marginTop: 8 }}>
        <button className="btn bs sm" onClick={handleCopy}>📋 Copy</button>
      </div>
    </div>
  );
}
