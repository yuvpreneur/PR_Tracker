import { Pencil, Trash2 } from 'lucide-react';

// Edit/Delete buttons intentionally render the legacy `bridge-edit`/`bridge-delete`
// classes + `data-page`/`data-id` attributes: bridge/index.js still owns a single
// document-level delegated click listener for these per page, so migrated pages
// don't need to re-implement that wiring — it works on any DOM node with a match,
// React-rendered or not.
export default function DataTable({ columns, rows, getRowId, pageId, canEdit, canDelete, renderExtraActions, hideActionsColumn = false, emptyMessage = 'No records found' }) {
  // canEdit/canDelete may be a flat boolean (same for every row) or a function of
  // the row (e.g. edit allowed if you have blanket edit permission OR own the row).
  const editAllowed = row => (typeof canEdit === 'function' ? canEdit(row) : !!canEdit);
  const deleteAllowed = row => (typeof canDelete === 'function' ? canDelete(row) : !!canDelete);
  // renderExtraActions(row) — e.g. Service Desk's status-dependent Resolve/Close
  // buttons (bridge-resolve/bridge-close), rendered alongside edit/delete.
  const showActions = !hideActionsColumn && (!!canEdit || !!canDelete || !!renderExtraActions);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} className="px-3.5 py-3 text-[11px] font-black uppercase tracking-wide text-ink" style={{ background: 'transparent', textAlign: col.align || 'left' }}>
                {col.header}
              </th>
            ))}
            {showActions && <th className="px-3.5 py-3 text-[11px] font-black uppercase tracking-wide text-ink" style={{ background: 'transparent', textAlign: 'center' }}>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length + (showActions ? 1 : 0)} className="p-8 text-center text-[13px] text-slate-400">
                {emptyMessage}
              </td>
            </tr>
          )}
          {rows.map(row => {
            const id = getRowId(row);
            return (
              <tr key={id} className="border-b border-slate-100">
                {columns.map(col => (
                  <td key={col.key} className="px-3 py-2.5" style={{ textAlign: col.align || 'left' }}>
                    {col.render ? col.render(row) : (row[col.key] ?? '—')}
                  </td>
                ))}
                {showActions && (
                  <td className="whitespace-nowrap px-3 py-2" style={{ textAlign: 'center' }}>
                    {editAllowed(row) && (
                      <button
                        className="bridge-edit mr-1 inline-flex items-center rounded-md px-2.5 py-1 text-[11px]"
                        data-page={pageId}
                        data-id={id}
                        title="Edit"
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                    {deleteAllowed(row) && (
                      <button
                        className="bridge-delete inline-flex items-center rounded-md px-2.5 py-1 text-[11px] text-red"
                        data-page={pageId}
                        data-id={id}
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                    {renderExtraActions && renderExtraActions(row)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
