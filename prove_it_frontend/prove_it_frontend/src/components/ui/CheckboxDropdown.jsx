import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

// A single form-control-styled trigger that opens a checkbox list, instead of always
// showing every option inline. `options` can be plain strings (getKey/getLabel default to
// identity) or objects like {id, name} (pass getKey/getLabel accordingly).
// The trigger's own label is either a fixed `staticLabel` (never changes as boxes inside
// are checked/unchecked — e.g. always just "Page Access") or, when staticLabel is omitted,
// a live "N of M selected" summary that updates as selections change.
export default function CheckboxDropdown({
  options, selected, onToggle, placeholder = 'Select…', noun = 'items', staticLabel,
  getKey = o => o, getLabel = o => o,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDocClick = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const selectedCount = options.filter(o => selected[getKey(o)]).length;
  const summary = staticLabel ?? (
    selectedCount === 0 ? placeholder :
    selectedCount === options.length ? `All ${noun} selected (${options.length})` :
    `${selectedCount} of ${options.length} ${noun} selected`
  );

  return (
    <div ref={wrapRef} style={{ position: 'relative', marginBottom: 12 }}>
      <button
        type="button"
        className="form-control"
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ color: !staticLabel && selectedCount === 0 ? '#94a3b8' : 'var(--ink)' }}>{summary}</span>
        <span style={{ color: '#94a3b8', marginLeft: 8, display: 'inline-flex' }}>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 20,
            background: '#fff', border: '1px solid var(--line)', borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,.14)', padding: 8, maxHeight: 260, overflowY: 'auto',
          }}
        >
          {options.map(opt => {
            const key = getKey(opt);
            return (
              <label
                key={key}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                  borderRadius: 8, fontSize: 12, fontWeight: 700, color: 'var(--slate)', cursor: 'pointer',
                }}
              >
                <input type="checkbox" checked={!!selected[key]} onChange={e => onToggle(key, e.target.checked)} />
                {getLabel(opt)}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
