import { useState } from 'react';

export default function TabPanel({ tabs, children }) {
  const [active, setActive] = useState(0);

  return (
    <div>
      <div className="tabs">
        {tabs.map((tab, i) => (
          <div
            key={i}
            className={`tab${i === active ? ' active' : ''}`}
            onClick={() => setActive(i)}
          >
            {tab}
          </div>
        ))}
      </div>
      {children.map((child, i) => (
        <div key={i} className={`tp${i === active ? ' active' : ''}`}>
          {child}
        </div>
      ))}
    </div>
  );
}
