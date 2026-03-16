export default function StatCard({ label, value }) {
  return (
    <div className="sc">
      <div className="sl">{label}</div>
      <div className="sv">{value}</div>
    </div>
  );
}
