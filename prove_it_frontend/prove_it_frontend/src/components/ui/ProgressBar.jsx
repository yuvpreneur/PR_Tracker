export default function ProgressBar({ value = 0, color = 'brand', label = null }) {
  const colorMap = {
    brand: 'linear-gradient(90deg, #0086AD, #00A6D4)',
    rose: '#E8607A',
    green: '#16A36C',
    amber: '#F59E0B',
    sky: '#0086AD',
    red: '#E14D56',
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
        background: color === 'rose' ? '#E8EFF7' : '#E7F0F4',
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
