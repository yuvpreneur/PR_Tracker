export default function SectionTitle({ icon: Icon, children }) {
  return (
    <div className="card-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {Icon && <Icon size={14} />}
      {children}
    </div>
  );
}
