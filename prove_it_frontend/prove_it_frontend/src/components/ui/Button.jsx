const VARIANTS = {
  primary: 'text-white shadow-[0_12px_24px_rgba(0,134,173,.22)]',
  ghost: 'bg-white/80 text-brand-3 border border-line',
  danger: 'bg-red/10 text-red border border-red/20',
};

const VARIANT_STYLE = {
  primary: { background: 'linear-gradient(135deg, var(--color-brand), var(--color-brand-2))' },
};

export default function Button({ variant = 'primary', className = '', style, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant] || ''} ${className}`}
      style={{ ...VARIANT_STYLE[variant], ...style }}
      {...props}
    />
  );
}
