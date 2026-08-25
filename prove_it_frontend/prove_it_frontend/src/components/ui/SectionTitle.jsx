export default function SectionTitle({ icon: Icon, children, subdued = true, right }) {
  return (
    <div className={subdued ? 'card-section-title' : ''} style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      justifyContent: 'space-between',
      fontSize: subdued ? '11px' : '14px',
      fontWeight: subdued ? 900 : 800,
      color: subdued ? 'var(--muted)' : 'var(--ink)',
      letterSpacing: subdued ? '.8px' : '0',
      textTransform: subdued ? 'uppercase' : 'none',
      marginBottom: subdued ? '16px' : '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {Icon && <Icon size={subdued ? 14 : 16} />}
        {children}
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}
