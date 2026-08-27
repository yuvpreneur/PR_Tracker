export default function StatCard({ label, value, sub, color = '#D97A92', icon: Icon, trend }) {
  return (
    <div className="stat-card-layout">
      <div className="stat-card-top-row">
        <div className="stat-card-icon-col">
          {Icon && (
            <div className="stat-card-icon" style={{ color }}>
              <Icon size={20} strokeWidth={2} />
            </div>
          )}
        </div>
        <div className="stat-card-label-col">
          <div className="stat-label">{label}</div>
        </div>
      </div>
      <div className="stat-card-middle-row">
        <div className="stat-value">{value}</div>
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
      <div className="stat-sub">{sub}</div>
    </div>
  );
}
