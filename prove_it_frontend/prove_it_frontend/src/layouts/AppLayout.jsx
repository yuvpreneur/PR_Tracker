import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Lock, Bell } from 'lucide-react';
import { NAV } from './nav.config.js';
import useAuth from '../hooks/useAuth.jsx';
import usePermissions from '../hooks/usePermissions.js';
import useMyOrganization from '../hooks/useMyOrganization.js';
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
  const { name: orgName, logoUrl: orgLogoUrl } = useMyOrganization();
  const [collapsed, setCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
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
          <div className="sico"><img className="brand-mark" src={orgLogoUrl || '/company-logo.png'} alt={orgName ? `${orgName} logo` : 'Organization logo'} /></div>
        </div>
        <nav>
          {NAV.map(section => (
            <div key={section.group}>
              <div className="nav-group-label">{section.group}</div>
              {section.items.map(item => {
                const locked = !canViewPage(item.id);
                const Icon = locked ? Lock : item.icon;
                if (item.external) {
                  return (
                    <a
                      key={item.id}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-page={item.id}
                      className="nav-item"
                    >
                      <span className="nav-icon" data-lucide-icon={item.id}>
                        <Icon size={15} />
                      </span>
                      <span className="nav-label">{item.label}</span>
                    </a>
                  );
                }
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
        >{collapsed ? '▶' : '◀ Collapse'}</button>
        <div className="sidebar-wave">
          <svg
            viewBox="0 0 276 180"
            style={{ width: '100%', height: 140, pointerEvents: 'none', display: 'block' }}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="wave-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F4C0D1" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#F4C0D1" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            <path
              d="M0,80 C50,40 80,50 130,90 C160,115 190,50 230,80 C250,95 270,70 276,60 L276,180 L0,180 Z"
              fill="#F4C0D1"
              opacity="0.4"
            />
            <path
              d="M0,110 C40,85 70,95 120,125 C150,145 180,90 220,115 C240,128 260,105 276,100 L276,180 L0,180 Z"
              fill="#ED93B1"
              opacity="0.3"
            />
          </svg>
        </div>
      </div>

      <div id="main">
        <div id="topbar" style={{ position: 'relative', zIndex: 100 }}>
          <span className="topbar-title">{title}</span>
          <div className="topbar-right">
            <button className="btn btn-ghost btn-sm notif-btn" id="notif-btn" data-lucide-icon="1" style={{ position: 'relative' }}>
              <Bell size={20} /><span className="notif-dot" />
              <span
                id="notif-count"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'absolute', top: -6, right: -6, background: '#ef4444',
                  color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: 10,
                  fontWeight: 700, pointerEvents: 'none', lineHeight: 1, padding: 0, margin: 0,
                }}
              >0</span>
            </button>
            {/* Left disabled/hidden by default — bridge/index.js's initApiBridge() (Phase 3
                will port this to React) enables it for Admin/Manager and wires the real
                POST /api/auth/view-as flow; not wiring it here would leave it inert either way. */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <div
                className="user-chip"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                style={{ cursor: 'pointer' }}
              >
                <div className="user-avatar" id="active-avatar">{initials}</div>
                <span id="active-user-name">{user?.name}</span>
                <span id="active-user-role" style={{ color: 'var(--text3)', fontSize: 11 }}>{user?.role}</span>
              </div>
              {userMenuOpen && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 50 }}
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      background: '#fff',
                      border: '1px solid var(--line)',
                      borderRadius: 16,
                      boxShadow: 'var(--shadow-soft)',
                      zIndex: 200,
                      width: 280,
                      marginTop: 8,
                    }}
                  >
                    <div style={{ padding: '18px 16px', textAlign: 'center', borderBottom: '1px solid var(--line)' }}>
                      <div
                        style={{
                          width: 56,
                          height: 56,
                          margin: '0 auto 12px',
                          background: 'linear-gradient(135deg, var(--rose), var(--rose-2))',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 20,
                          fontWeight: 800,
                          color: '#fff',
                        }}
                      >
                        {initials}
                      </div>
                      <div style={{ fontWeight: 900, fontSize: 14, color: 'var(--ink)', marginBottom: 4 }}>
                        {user?.name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {user?.email || user?.role}
                      </div>
                    </div>
                    <div style={{ padding: '8px 0' }}>
                      <button
                        style={{
                          width: '100%',
                          padding: '10px 16px',
                          background: 'transparent',
                          color: 'var(--slate)',
                          border: 'none',
                          fontSize: 13,
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontFamily: 'inherit',
                          transition: 'background .15s ease',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--soft)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        onClick={() => {
                          setUserMenuOpen(false);
                          navigate('/settings');
                        }}
                      >
                        <span style={{ fontSize: 16 }}>⚙️</span> Profile & Settings
                      </button>
                      <button
                        style={{
                          width: '100%',
                          padding: '10px 16px',
                          background: 'transparent',
                          color: 'var(--rose)',
                          border: 'none',
                          fontSize: 13,
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontFamily: 'inherit',
                          transition: 'background .15s ease',
                          fontWeight: 700,
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(232,96,122,.08)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        onClick={() => {
                          setUserMenuOpen(false);
                          logout();
                        }}
                      >
                        <span style={{ fontSize: 16 }}>→</span> Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
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
