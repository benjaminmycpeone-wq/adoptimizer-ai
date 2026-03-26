import { useEffect } from 'react';
import useStore from '../store';

export default function ToastContainer() {
  const toasts = useStore((s) => s.toasts);
  const removeToast = useStore((s) => s.removeToast);

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const iconMap = { as: '✅', ae: '❌', aw: '⚠️', ai: 'ℹ️' };

  return (
    <div className={`toast al ${toast.type}`}>
      <span>{iconMap[toast.type] || 'ℹ️'}</span>
      <span style={{ flex: 1 }}>{toast.msg}</span>
      <button className="toast-close" onClick={onClose}>×</button>
    </div>
  );
}
