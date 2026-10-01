import { MoreVertical } from 'lucide-react';

export default function KebabMenu({ onClick = null }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '4px 8px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '6px',
        transition: 'background .15s ease',
        color: 'var(--muted)',
      }}
      onMouseEnter={(e) => (e.target.style.background = 'var(--soft)')}
      onMouseLeave={(e) => (e.target.style.background = 'transparent')}
      title="More options"
    >
      <MoreVertical size={16} strokeWidth={2} />
    </button>
  );
}
