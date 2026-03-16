import { useState } from 'react';

export default function PasswordInput({ id, value, onChange, placeholder, style }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="cw">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={style}
      />
      <button className="ct2" onClick={() => setVisible(!visible)}>
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
