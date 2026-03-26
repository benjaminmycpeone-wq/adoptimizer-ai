export default function PageSkeleton() {
  return (
    <div style={{ padding: '24px 28px' }}>
      <div className="skel skel-title" />
      <div className="skel skel-card" />
      <div className="skel skel-card" style={{ height: 120 }} />
    </div>
  );
}
