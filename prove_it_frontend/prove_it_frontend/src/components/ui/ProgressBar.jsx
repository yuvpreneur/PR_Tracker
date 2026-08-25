export default function ProgressBar({ value = 0, color = 'brand', label = null }) {
  const colorMap = {
    brand: 'linear-gradient(90deg, var(--color-brand), var(--color-brand-2))',
    rose: 'var(--color-rose)',
    green: 'var(--color-green)',
    amber: 'var(--color-amber)',
    sky: 'var(--color-brand)',
    red: 'var(--color-red)',
  };

  const bgColor = colorMap[color] || colorMap.brand;

  return (
    <div>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
          <span style={{ color: 'var(--muted)' }}>{label}</span>
          <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{value}%</span>
        </div>
      )}
      <div style={{
        background: '#E7F0F4',
        borderRadius: '99px',
        height: '8px',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          borderRadius: '99px',
          background: bgColor,
          width: `${Math.max(0, Math.min(100, value))}%`,
          transition: 'width .3s ease',
        }} />
      </div>
    </div>
  );
}
