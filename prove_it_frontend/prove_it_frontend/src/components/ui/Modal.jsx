import { X } from 'lucide-react';

// First React-native modal in the app — existing pages (Employees, HourlyCosts) still
// open a persistent legacy HTML form via bridge/shared/modals.js, but that system is
// being phased out (see usePermissions.js's "bridge-removal migration" note) and its
// flat small forms don't fit Payroll's grouped, multi-field editing anyway. This is a
// plain, self-contained overlay — no portal, no legacy DOM wiring.
export default function Modal({ title, onClose, children, width = 480 }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card max-h-[90vh] w-full overflow-y-auto" style={{ maxWidth: width, padding: 20 }}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[15px] font-bold">{title}</h3>
          <button type="button" className="text-muted" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
