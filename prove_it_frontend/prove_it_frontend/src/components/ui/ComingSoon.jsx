// Reuses the No Access page's centered-card styling (.no-access-card/.no-access-icon
// in global.css) for any page that has no real feature behind it yet.
export default function ComingSoon({ title, message }) {
  return (
    <div className="card no-access-card">
      <div className="no-access-icon">🚧</div>
      <h2 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-.8px', marginBottom: 8 }}>{title}</h2>
      <p style={{ color: 'var(--slate)', fontSize: 14 }}>{message}</p>
    </div>
  );
}
