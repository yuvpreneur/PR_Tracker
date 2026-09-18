// One read-only row inside a "View" modal (Clients, Projects, ...) — the display-only
// counterpart to a `.form-group` in an editable form, same tinted-panel treatment the
// Approvals page's own legacy read-only fields use. Meant to sit inside a `.form-grid`
// wrapper — the same shared 2-column grid an Edit form's own modal-* uses (global.css)
// — so a page's View and Edit modals read as the same layout, just one editable and one
// not. `wide` spans both columns for longer values (an address, a sync-status badge),
// matching how those forms use `.col-span-2` for the same kind of field.
export default function ReadOnlyField({ label, value, wide = false }) {
  return (
    <div className={wide ? 'form-group col-span-2' : 'form-group'}>
      <label className="form-label">{label}</label>
      <div style={{ padding: '9px 12px', background: 'rgba(232,96,122,.08)', borderRadius: 8, fontSize: 14 }}>
        {value ?? '—'}
      </div>
    </div>
  );
}
