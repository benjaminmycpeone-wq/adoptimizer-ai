const ICONS = { ai: 'ℹ️', as: '✅', aw: '⚠️', ae: '❌' };

export default function AlertBanner({ type, message, style }) {
  if (!message) return null;
  return (
    <div className={`al ${type}`} style={style}>
      <span>{ICONS[type] || 'ℹ️'}</span>
      <div style={{ whiteSpace: 'pre-wrap' }}>{message}</div>
    </div>
  );
}
