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
          <span className="x" onClick={() => remove(i)}>×</span>
        </div>
      ))}
    </div>
  );
}

export function getChipText(items) {
  return (items || []).join(', ');
}
