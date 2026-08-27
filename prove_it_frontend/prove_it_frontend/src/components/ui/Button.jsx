const VARIANTS = {
  primary: '',
  modal: '',
  ghost: 'bg-white/80 text-brand-3 border border-line',
  danger: 'bg-red/10 text-red border border-red/20',
};

const VARIANT_STYLE = {
  primary: {
    background: 'linear-gradient(180deg, #E8A0B0, #D97A92)',
    color: '#ffffff',
    boxShadow: '0 10px 18px -10px rgba(232, 96, 122, .35)',
    border: 'none',
  },
  modal: {
    background: 'linear-gradient(180deg, #E8A0B0, #D97A92)',
    color: '#ffffff',
    boxShadow: '0 10px 18px -10px rgba(232, 96, 122, .35)',
    border: 'none',
  },
};

export default function Button({ variant = 'primary', className = '', style, ...props }) {
  return (
    <button
      className={`btn btn-${variant} inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-[13px] font-semibold transition-all hover:-translate-y-0.5 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant] || ''} ${className}`}
      style={{ ...VARIANT_STYLE[variant], ...style }}
      {...props}
    />
  );
}
