export default function StatCard({ label, value, sub, color = 'var(--color-brand)' }) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-[22px] border border-[rgba(216,231,239,.95)] bg-white/90 p-5 shadow-soft-card">
      <span
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: 'linear-gradient(90deg, var(--color-brand), var(--color-brand-2), var(--color-violet))' }}
      />
      <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-muted">{label}</div>
      <div className="text-[31px] font-black tracking-tight" style={{ color }}>{value}</div>
      <div className="mt-1.5 text-[11px] text-muted">{sub}</div>
    </div>
  );
}
