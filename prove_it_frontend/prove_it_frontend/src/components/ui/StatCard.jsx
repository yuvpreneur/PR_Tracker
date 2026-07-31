export default function StatCard({ label, value, sub, color = 'var(--color-brand)', icon: Icon }) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-[22px] border border-[rgba(216,231,239,.95)] bg-white/90 p-5 shadow-soft-card">
      <span
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: 'linear-gradient(90deg, var(--color-brand), var(--color-brand-2), var(--color-violet))' }}
      />
      {Icon && (
        <div
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
        >
          <Icon size={18} strokeWidth={2.2} />
        </div>
      )}
      <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-muted pr-9">{label}</div>
      <div className="text-[31px] font-black tracking-tight" style={{ color }}>{value}</div>
      <div className="mt-1.5 text-[11px] text-muted">{sub}</div>
    </div>
  );
}
