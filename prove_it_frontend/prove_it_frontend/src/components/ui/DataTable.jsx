import { Pencil, Trash2 } from 'lucide-react';
import KebabMenu from './KebabMenu.jsx';

// Edit/Delete buttons intentionally render the legacy `bridge-edit`/`bridge-delete`
// classes + `data-page`/`data-id` attributes: bridge/index.js still owns a single
// document-level delegated click listener for these per page, so migrated pages
// don't need to re-implement that wiring — it works on any DOM node with a match,
// React-rendered or not. `actionsAsKebab` renders that same Edit/Delete pair — plus
// whatever renderExtraActions(row) returns (Approve/Reject, Resolve/Close, History, ...)
// — inside one KebabMenu popover instead of as separate always-visible buttons; opt-in
// per page (Clients, Projects, Project Codes, Billing Codes, Employees, Hourly Costs,
// Timesheets, Leave, Service Desk) so every other table's Actions column is unaffected.
export default function DataTable({ columns: columnsProp, rows: rowsProp, getRowId, pageId, canEdit, canDelete, renderExtraActions, hideActionsColumn = false, actionsAsKebab = false, onRowClick = null, emptyMessage = 'No records found' }) {
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
          {showActions && (
            // A lone kebab column doesn't need a text label the way a row of
            // always-visible Edit/Delete icons did — the ⋮ already reads as "actions".
            // Narrowed to content width too, so it stops reserving as much room as the
            // word "Actions" did and the other columns can breathe.
            <th style={{ textAlign: 'center', width: actionsAsKebab ? '1%' : undefined, whiteSpace: 'nowrap' }}>
              {actionsAsKebab ? '' : 'Actions'}
            </th>
          )}
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
          // Called once per row regardless of mode — same as the old unconditional
          // `renderExtraActions && renderExtraActions(row)` did — so a page's own
          // status-dependent logic (Pending-only Approve/Reject, open-vs-resolved
          // Resolve/Close, ...) is untouched; only *where* the result lands differs.
          const extra = renderExtraActions ? renderExtraActions(row) : null;
          return (
            <tr
              key={id}
              // Declines rather than stopPropagation()-ing: a click on Edit/Delete/the
              // kebab (or anything inside its portaled popover, marked the same way —
              // see KebabMenu.jsx) is recognized here and simply not treated as a row
              // click, instead of being blocked from bubbling further. stopPropagation()
              // used to sit on the actions <td> for this, but it also halts the
              // underlying native event before it can reach `document` — which broke
              // both a sibling kebab's own "close on outside click" listener and the
              // legacy bridge-edit/bridge-delete click delegation, both of which listen
              // on `document` in the bubble phase.
              onClick={onRowClick ? (e => { if (!e.target.closest('[data-row-click-ignore]')) onRowClick(row); }) : undefined}
              style={onRowClick ? { cursor: 'pointer' } : undefined}
            >
              {columns.map(col => (
                <td key={col.key} style={{ textAlign: col.align || 'left' }}>
                  {col.render ? col.render(row) : (row[col.key] ?? '—')}
                </td>
              ))}
              {showActions && (
                <td style={{ textAlign: 'center' }} data-row-click-ignore>
                  {actionsAsKebab ? (
                    // Folds `extra` into the same popover instead of leaving it as
                    // separate buttons next to the kebab — otherwise a page like
                    // Service Desk would show a kebab AND a loose Resolve/Close button,
                    // defeating the point of collapsing Actions to one icon. Still shows
                    // the kebab on rows with only `extra` and no Edit/Delete at all
                    // (e.g. Leave, which never allows either).
                    (editAllowed(row) || deleteAllowed(row) || !!extra) && (
                      <KebabMenu
                        items={[
                          editAllowed(row) && {
                            label: 'Edit', icon: <Pencil size={13} />,
                            className: 'bridge-edit', dataPage: pageId, dataId: id,
                          },
                          deleteAllowed(row) && {
                            label: 'Delete', icon: <Trash2 size={13} />,
                            className: 'bridge-delete', dataPage: pageId, dataId: id, danger: true,
                          },
                        ].filter(Boolean)}
                        extra={extra}
                      />
                    )
                  ) : (
                    <>
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
                      {extra}
                    </>
                  )}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
