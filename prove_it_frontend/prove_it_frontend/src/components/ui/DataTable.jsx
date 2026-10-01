import { Pencil, Trash2 } from 'lucide-react';

// Edit/Delete buttons intentionally render the legacy `bridge-edit`/`bridge-delete`
// classes + `data-page`/`data-id` attributes: bridge/index.js still owns a single
// document-level delegated click listener for these per page, so migrated pages
// don't need to re-implement that wiring — it works on any DOM node with a match,
// React-rendered or not.
export default function DataTable({ columns: columnsProp, rows: rowsProp, getRowId, pageId, canEdit, canDelete, renderExtraActions, hideActionsColumn = false, emptyMessage = 'No records found' }) {
  // Every list page feeds `rows` straight from a fetch, and several hooks still hand
  // over `rows || []` — which only catches null/undefined, so an object (an error body,
  // or a 2xx whose payload didn't parse as JSON) reaches us intact and `rows.map` takes
  // down the entire page instead of rendering an empty table. Guard once, here, rather
  // than trusting all ~20 call sites.
  const columns = Array.isArray(columnsProp) ? columnsProp : [];
  const rows = Array.isArray(rowsProp) ? rowsProp : [];
  // canEdit/canDelete may be a flat boolean (same for every row) or a function of
  // the row (e.g. edit allowed if you have blanket edit permission OR own the row).
  const editAllowed = row => (typeof canEdit === 'function' ? canEdit(row) : !!canEdit);
  const deleteAllowed = row => (typeof canDelete === 'function' ? canDelete(row) : !!canDelete);
  // renderExtraActions(row) — e.g. Service Desk's status-dependent Resolve/Close
  // buttons (bridge-resolve/bridge-close), rendered alongside edit/delete.
  const showActions = !hideActionsColumn && (!!canEdit || !!canDelete || !!renderExtraActions);

  return (
    <table>
      <thead>
        <tr>
          {columns.map(col => (
            <th key={col.key} style={{ textAlign: col.align || 'left' }}>
              {col.header}
            </th>
          ))}
          {showActions && <th style={{ textAlign: 'center' }}>Actions</th>}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={columns.length + (showActions ? 1 : 0)} style={{ textAlign: 'center', padding: '28px 12px', color: '#6F7D70' }}>
              {emptyMessage}
            </td>
          </tr>
        )}
        {rows.map(row => {
          const id = getRowId(row);
          return (
            <tr key={id}>
              {columns.map(col => (
                <td key={col.key} style={{ textAlign: col.align || 'left' }}>
                  {col.render ? col.render(row) : (row[col.key] ?? '—')}
                </td>
              ))}
              {showActions && (
                <td style={{ textAlign: 'center' }}>
                  {editAllowed(row) && (
                    <button
                      className="bridge-edit inline-flex items-center gap-1 rounded-md px-2.5 py-1"
                      data-page={pageId}
                      data-id={id}
                      title="Edit"
                      style={{ fontSize: '12px', background: 'var(--card)', border: '1px solid #DFE5D3', color: '#33523C', cursor: 'pointer' }}
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                  {deleteAllowed(row) && (
                    <button
                      className="bridge-delete inline-flex items-center gap-1 rounded-md px-2.5 py-1"
                      data-page={pageId}
                      data-id={id}
                      title="Delete"
                      style={{ fontSize: '12px', background: 'var(--card)', border: '1px solid #DFE5D3', color: '#C4574A', cursor: 'pointer', marginLeft: '6px' }}
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
  );
}
