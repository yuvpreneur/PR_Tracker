import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Lock, Bell, EyeOff } from 'lucide-react';
import { NAV } from './nav.config.js';
import useAuth from '../hooks/useAuth.jsx';
import usePermissions from '../hooks/usePermissions.js';
import { state } from '../bridge/core/state.js';

// Real React sidebar/topbar/router, replacing appMarkup.js's injected shell as part of
// the bridge-removal migration (Phase 1) — see usePermissions.js/useReferenceData.jsx
// for the same pattern applied earlier to permissions/reference-data.
//
// The topbar's notif bell / role-switcher / view-as-exit / user-chip elements below
// keep their exact legacy ids (notif-btn, role-switcher, view-as-exit, active-avatar,
// active-user-name, active-user-role) — bridge/index.js's initApiBridge() still looks
// them up by id to wire real behavior (notifications, "view as role", session identity)
// that hasn't been ported to React yet (Phase 3). Same coexistence pattern DataTable.jsx
// already uses for its bridge-edit/bridge-delete buttons.
//
// Deliberately NOT using id="nav" on the <nav> below and not using the `.nav-icon` class
// without a matching data-lucide-icon: bridge/index.js's applyNavGating()/applyNavIcons()
// (still called from initApiBridge() for pages not yet ported) walk `.nav-item`/`.nav-icon`
// globally and would otherwise raw-DOM-mutate these React-owned nodes — the same class of
// corruption useBridgeMount.js's top comment warns about for legacy-vs-React DOM
// ownership collisions. Locking/gating is instead fully owned here via usePermissions().
//
// Also deliberately NOT using id="topbar-title" (bridge/index.js's applyTopbarTitleIcon()/
// watchTopbarTitle() would replaceChildren() it on every route change, fighting the
// {title} text this component already owns correctly) and preemptively stamping the same
// data-lucide-*/dataset markers applyStaticTopbarIcons()/applySidebarToggleIcon() check
// before mutating .sidebar-footer/#notif-btn/#role-switcher — real risk, not
// theoretical: role-switcher's legacy wrap re-parents it into a new <span>, which would
// desync React's fiber tree from the live DOM on this component's next re-render and
// throw the exact "removeChild ... not a child of this node" error bridge/index.js's own
// isReactOwned() comment (shared/table.js) says already happened once before.
export default function AppLayout() {
  const { user, logout } = useAuth();
  const { canViewPage } = usePermissions();
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const activeItem = NAV.flatMap(s => s.items).find(i => location.pathname === `/${i.id}`);
  const title = location.pathname === '/no-access' ? 'No Access' : (activeItem?.label || 'Dashboard');

  // A handful of remaining legacy call sites (e.g. bridge/index.js's audit-log
  // requester cross-link) still call window.navigate(pageId) directly instead of a
  // real link — appScript's own implementation only toggled .nav-item/.page classes
  // that no longer exist. Overriding it here means those call sites still actually
  // change the page instead of silently no-op'ing. initApiBridge() layers its own
  // gating wrapper on top of whatever window.navigate is at the time it runs (captured
  // as _origNavigate) — since that runs well after this effect, allowed-page calls
  // chain through to this; a locked-page call stops at that wrapper's showNoAccess()
  // (state.blockedPageId + the event, same as below, just without an actual route
  // change) — a known Phase 1 gap for this one indirect path, not the main nav click.
  useEffect(() => {
    window.navigate = pageId => navigate(`/${pageId}`);
    return () => { delete window.navigate; };
  }, [navigate]);

  // Mirrors showNoAccess()'s essential side effects (bridge/index.js) without its DOM
  // class-toggling, which targeted legacy .page/.nav-item divs that no longer exist —
  // navigation now happens for real, via the router. state.blockedPageId is read
  // directly by the reused submitPageAccessRequest() (bridge/pages/accesscontrol.js);
  // the 'no-access:shown' event is what NoAccessPage.jsx's useNoAccessRequest.js listens
  // for — same contract, just triggered from here instead of the legacy closure.
  const handleNavClick = (e, item, locked) => {
    if (!locked) return;
    e.preventDefault();
    state.blockedPageId = item.id;
    document.dispatchEvent(new CustomEvent('no-access:shown', { detail: { pageId: item.id, label: item.label } }));
    navigate('/no-access');
  };

  const initials = user?.name
    ? user.name.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase()
    : '';

  return (
    <div id="app" className="visible">
      <div id="sidebar" className={collapsed ? 'collapsed' : ''}>
        <div className="sidebar-logo">
          <div className="sico"><img className="brand-mark" src="/company-logo.png" alt="Prove IT Catalysts logo" /></div>
          <span>Prove IT</span>
        </div>
        <nav>
          {NAV.map(section => (
            <div key={section.group}>
              <div className="nav-group-label">{section.group}</div>
              {section.items.map(item => {
                const locked = !canViewPage(item.id);
                const Icon = locked ? Lock : item.icon;
                return (
                  <NavLink
                    key={item.id}
                    to={`/${item.id}`}
                    data-page={item.id}
                    title={locked ? 'No access. Click to request access.' : undefined}
                    className={({ isActive }) => `nav-item${isActive && !locked ? ' active' : ''}${locked ? ' is-locked' : ''}`}
                    onClick={e => handleNavClick(e, item, locked)}
                  >
                    <span className="nav-icon" data-lucide-icon={locked ? 'locked' : item.id}>
                      <Icon size={15} />
                    </span>
                    <span className="nav-label">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
        <button
          className="sidebar-footer"
          data-lucide-icon={collapsed ? 'collapsed' : 'expanded'}
          onClick={() => setCollapsed(c => !c)}
        >◀ Collapse</button>
      </div>

      <div id="main">
        <div id="topbar">
          <span className="topbar-title">{title}</span>
          <div className="topbar-right">
            <button className="btn btn-ghost btn-sm notif-btn" id="notif-btn" data-lucide-icon="1" style={{ position: 'relative' }}>
              <Bell size={15} /><span className="notif-dot" />
              <span
                id="notif-count"
                style={{
                  display: 'none', position: 'absolute', top: -6, right: -6, background: '#ef4444',
                  color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: 10,
                  fontWeight: 700, lineHeight: '18px', textAlign: 'center', pointerEvents: 'none',
                }}
              >0</span>
            </button>
            {/* Left disabled/hidden by default — bridge/index.js's initApiBridge() (Phase 3
                will port this to React) enables it for Admin/Manager and wires the real
                POST /api/auth/view-as flow; not wiring it here would leave it inert either way. */}
            <select
              id="role-switcher"
              className="form-control"
              data-lucide-wrapped="1"
              style={{ width: 'auto', fontSize: 12, padding: '6px 10px' }}
              title="Preview the app as another role (Admin/Manager only)"
              disabled
              defaultValue=""
            >
              <option value="">View as role…</option>
              <option value="Manager">Manager</option>
              <option value="Finance User">Finance User</option>
              <option value="Employee">Employee</option>
              <option value="Viewer">Viewer</option>
            </select>
            <button
              id="view-as-exit"
              className="btn btn-sm"
              type="button"
              data-lucide-icon="1"
              style={{ display: 'none', background: 'var(--amber-soft,#fef3c7)', color: '#b45309', border: '1px solid rgba(180,83,9,.25)' }}
            ><EyeOff size={14} /> Exit view</button>
            <div className="user-chip">
              <div className="user-avatar" id="active-avatar">{initials}</div>
              <span id="active-user-name">{user?.name}</span>
              <span id="active-user-role" style={{ color: 'var(--text3)', fontSize: 11 }}>{user?.role}</span>
            </div>
            <button
              className="btn btn-sm"
              style={{ background: 'var(--red-soft)', color: 'var(--red)', border: '1px solid rgba(239,68,68,.2)' }}
              onClick={logout}
            >Sign out</button>
          </div>
        </div>
        <div id="content">
          {/* AppRoutes.jsx's AllPages keeps every page mounted and owns the .page/
              .page.active toggling itself now (one wrapper per page, not one here) —
              this just hosts whichever route element is current (AllPages, or
              NoAccessPage which isn't part of that always-mounted set). */}
          <Outlet />
        </div>
      </div>
    </div>
  );
}
