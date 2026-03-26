import { useState } from 'react';

export default function ChipList({ items: initialItems, onChange }) {
  const [items, setItems] = useState(initialItems || []);

  const remove = (index) => {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
    onChange?.(updated);
  };

  return (
    <div className="cl">
      {items.map((item, i) => (
        <div key={i} className="chip">
          <span>{item}</span>
          <span
            className="x"
            role="button"
            tabIndex={0}
            aria-label={`Remove ${item}`}
            onClick={() => remove(i)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && remove(i)}
          >×</span>
        </div>
      ))}
    </div>
  );
}

export function getChipText(items) {
  return (items || []).join(', ');
}
