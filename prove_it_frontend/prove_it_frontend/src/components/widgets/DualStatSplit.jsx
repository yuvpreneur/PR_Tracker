import ProgressBar from '../ui/ProgressBar.jsx';

export default function DualStatSplit({ stats = [], percentage = 0 }) {
  if (stats.length < 2) return null;

  const [stat1, stat2] = stats;

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div
            style={{
              color: stat1.color || 'var(--color-green)',
              fontSize: 28,
            }}
          >
            {typeof stat1.value === 'number' ? stat1.value.toLocaleString('en-IN') : stat1.value}
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>
            {stat1.label}
          </div>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div
            style={{
              color: stat2.color || 'var(--color-amber)',
              fontSize: 28,
            }}
          >
            {typeof stat2.value === 'number' ? stat2.value.toLocaleString('en-IN') : stat2.value}
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>
            {stat2.label}
          </div>
        </div>
      </div>
      <ProgressBar value={percentage} color="rose" />
      <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 6, textAlign: 'center' }}>
        {percentage}% {stat1.label}
      </div>
    </div>
  );
}
