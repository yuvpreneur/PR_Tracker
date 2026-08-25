export default function StatCard({ label, value, sub, color = 'var(--color-brand)', icon: Icon, trend }) {
  const getTintBg = (colorHex) => {
    const tintMap = {
      '#16A36C': 'var(--color-mint-tint)',
      '#F59E0B': 'var(--color-amber-tint)',
      '#E8607A': 'var(--color-rose-soft)',
      '#0086AD': 'var(--color-sky-tint)',
      '#7357E5': 'var(--color-violet-tint)',
      '#E14D56': 'var(--color-rose-soft)',
      'var(--color-brand)': 'var(--color-sky-tint)',
      'var(--color-green)': 'var(--color-mint-tint)',
      'var(--color-amber)': 'var(--color-amber-tint)',
    };
    return tintMap[colorHex] || 'var(--color-soft)';
  };

  return (
    <div className="relative min-w-0 overflow-hidden rounded-[22px] border border-[rgba(216,231,239,.95)] bg-white/90 p-5 shadow-soft-card">
      {Icon && (
        <div
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: getTintBg(color), color }}
        >
          <Icon size={18} strokeWidth={2.2} />
        </div>
      )}
      {trend && (
        <div
          className="absolute right-4 top-16 flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold"
          style={{
            background: trend.direction === 'up' ? 'var(--color-green-soft)' :
                       trend.direction === 'down' ? 'var(--color-rose-soft)' :
                       'rgba(124,146,161,.12)',
            color: trend.direction === 'up' ? 'var(--color-green)' :
                  trend.direction === 'down' ? 'var(--color-rose)' :
                  'var(--color-muted)',
          }}
        >
          {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'}
          <span>{trend.value}</span>
        </div>
      )}
      <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-muted pr-9">{label}</div>
      <div className="text-[31px] font-black tracking-tight text-ink">{value}</div>
      <div className="mt-1.5 text-[11px] text-muted">{sub}</div>
    </div>
  );
}
