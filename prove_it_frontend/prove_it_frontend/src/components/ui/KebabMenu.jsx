import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';

// Three ways to use this:
//  - <KebabMenu onClick={fn} />           — bare icon button, fires onClick directly
//    (the original behaviour; still used where nothing more than the icon is wanted).
//  - <KebabMenu items={[{label, icon, onClick, className, dataPage, dataId, danger}]} />
//    — the icon becomes a dropdown trigger showing those items as a small popover menu.
//    `className`/`dataPage`/`dataId` are passed through as `className`/`data-page`/`data-id`
//    on the item's own <button>, so callers that key off those (e.g. DataTable's
//    Edit/Delete, which the legacy delegated click-listener in bridge/index.js reads by
//    class + data-id) keep working unchanged, just triggered from inside this menu.
//  - <KebabMenu extra={<jsx/>} />         — arbitrary extra content (e.g. a page's own
//    status-dependent Approve/Reject/Resolve/Close/History buttons) rendered inside the
//    same popover below `items`, completely as-authored — DataTable uses this to fold a
//    page's renderExtraActions(row) output into the menu instead of leaving it as
//    separate buttons next to the kebab. `items` and `extra` can combine freely.
//
// The popover is rendered through a portal into document.body as `position: fixed`,
// positioned from the trigger button's own getBoundingClientRect() — not nested inside
// this component's own DOM subtree as `position: absolute`. Every table using this sits
// inside a `.table-wrap` with `overflow-x: auto` (for narrow-screen horizontal scroll),
// which clips any absolutely-positioned popover that opens near its right/bottom edge —
// exactly what a plain in-place dropdown looked like before this. Escaping into a portal
// sidesteps that clipping entirely, at the cost of closing (rather than following) the
// menu on scroll/resize, since a fixed position doesn't track the button's movement.
export default function KebabMenu({ onClick = null, items = null, extra = null }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const isMenu = !!items || !!extra;

  useEffect(() => {
    if (!isMenu || !open) return;
    const close = () => setOpen(false);
    const onDocClick = e => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      close();
    };
    // Capture phase, not bubble: DataTable's own row-click handling calls
    // stopPropagation() on the actions cell (so clicking Edit/Delete/the kebab doesn't
    // also fire a row's onRowClick), and React's stopPropagation() also halts the
    // underlying native event — which would stop this from ever reaching `document`
    // during the bubble phase. A capture listener runs first, top-down, before any of
    // that, so a click opening one row's menu reliably still closes every other row's
    // already-open one, instead of leaving them all open.
    document.addEventListener('click', onDocClick, true);
    // `capture: true` because an ancestor's own scroll (e.g. .table-wrap) doesn't bubble
    // a 'scroll' event to window otherwise.
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('click', onDocClick, true);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [isMenu, open]);

  const handleTriggerClick = () => {
    if (!isMenu) { onClick?.(); return; }
    if (!open) {
      const rect = btnRef.current.getBoundingClientRect();
      // Right-aligned to the button (menu's right edge = button's right edge), opening
      // downward — the same placement the old position:absolute version had, just in
      // viewport coordinates instead of relative to an offset parent.
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen(o => !o);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleTriggerClick}
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

      {isMenu && open && pos && createPortal(
        <div
          ref={menuRef}
          role="menu"
          // Lets a row-click handler (DataTable's onRowClick) recognize a click landing
          // here as belonging to the actions area, even though this popover is portaled
          // to document.body — e.target.closest() only sees genuine DOM ancestry, and
          // this div IS one for its own items regardless of where the portal mounts it,
          // so the same marker used on the actions <td> works here too.
          data-row-click-ignore
          // A click anywhere inside — a structured item or a raw `extra` button alike —
          // closes the menu. `extra` content keeps whatever click behaviour it already
          // had (e.g. the bridge's delegated listener); this only ever adds "and also
          // close the popover", via bubbling, so no page's button needs to know it's
          // now inside a menu.
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', top: pos.top, right: pos.right, zIndex: 1000,
            background: '#fff', border: '1px solid var(--line)', borderRadius: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,.14)', padding: 4, minWidth: 130,
          }}
        >
          {items && items.map((it, i) => (
            <button
              key={i}
              type="button"
              className={it.className}
              data-page={it.dataPage}
              data-id={it.dataId}
              title={it.label}
              onClick={e => it.onClick?.(e)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '7px 10px', border: 'none', background: 'transparent',
                cursor: 'pointer', fontSize: 12, fontWeight: 600, borderRadius: 6,
                color: it.danger ? '#C4574A' : 'var(--ink)', textAlign: 'left',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--soft)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
          {extra}
        </div>,
        document.body
      )}
    </>
  );
}
