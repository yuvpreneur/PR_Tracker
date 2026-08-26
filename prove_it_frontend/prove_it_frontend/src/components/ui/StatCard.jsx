export default function StatCard({ label, value, sub, color = 'var(--color-brand)', icon: Icon, trend }) {
  const getTintBg = (colorHex) => {
    const tintMap = {
      '#16A36C': 'var(--mint-tint)',
      '#F59E0B': 'var(--amber-tint)',
      '#E8607A': 'var(--rose-soft)',
      '#0086AD': 'var(--sky-tint)',
      '#7357E5': 'var(--violet-tint)',
      '#E14D56': 'var(--rose-soft)',
      'var(--color-brand)': 'var(--sky-tint)',
      'var(--color-green)': 'var(--mint-tint)',
      'var(--color-amber)': 'var(--amber-tint)',
    };
    return tintMap[colorHex] || 'var(--soft)';
  };

  return (
    <div className="relative min-w-0 overflow-hidden rounded-[22px] border border-[rgba(216,231,239,.95)] bg-white/90 p-5 shadow-soft-card">
      <div className="flex items-center gap-2 mb-1">
        {Icon && (
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: getTintBg(color), color }}
          >
            <Icon size={16} strokeWidth={2.2} />
          </div>
        )}
        <div className="text-[12px] text-ink">{label}</div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[28px] tracking-tight text-ink">{value}</div>
        {trend && (
          <div
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0"
            style={{
              background: trend.direction === 'up' ? 'var(--green-soft)' :
                         trend.direction === 'down' ? 'var(--rose-soft)' :
                         'rgba(124,146,161,.12)',
              color: trend.direction === 'up' ? 'var(--green)' :
                    trend.direction === 'down' ? 'var(--rose)' :
                    'var(--muted)',
            }}
          >
            {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'}
            <span>{trend.value}</span>
          </div>
        )}
      </div>
      <div className="text-[11px] text-muted mt-1">{sub}</div>
    </div>
  );
}
