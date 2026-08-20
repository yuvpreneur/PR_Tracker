import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ShieldCheck, LayoutGrid, Building2, CreditCard, Receipt, Gift, UserCog, Settings2, Wrench, LogOut } from 'lucide-react';
import useAuth from '../hooks/useAuth.jsx';

// `module` matches a PLATFORM_MODULES key (app/core/security.py) — a Sub Admin only
// sees links they've been granted. `superOnly` links never show for a Sub Admin no
// matter their permissions (managing Sub Admins is Super-Admin-exclusive, see
// app/routers/sub_admins.py).
const NAV = [
  { path: '/overview', label: 'Overview', icon: LayoutGrid, module: 'overview' },
  { path: '/organizations', label: 'Organizations', icon: Building2, module: 'organizations' },
  { path: '/plans', label: 'Plans', icon: CreditCard, module: 'plans' },
  { path: '/subscriptions', label: 'Subscriptions', icon: Receipt, module: 'subscriptions' },
  { path: '/free-access', label: 'Free Access', icon: Gift, module: 'free_access' },
  { path: '/sub-admins', label: 'Sub-Admins', icon: UserCog, superOnly: true },
  { path: '/platform-settings', label: 'Platform Settings', icon: Settings2, module: 'settings' },
  { path: '/operations', label: 'Operations', icon: Wrench, module: 'operations' },
];

// Deliberately not reusing AppLayout — this is a wholly separate shell for the
// platform-tier roles (Super Admin, Sub Admin) that never touch business data, so it
// skips AppLayout's legacy bridge/ DOM coupling entirely (see AppRoutes.jsx's
// AuthGate). Deliberately no company logo/branding here either — this shell oversees
// every organization on the platform, not just one of them.
export default function SuperAdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isSuperAdmin = user?.role === 'Super Admin';
  const permissions = user?.platform_permissions || [];
  const visibleNav = NAV.filter(item => (
    item.superOnly ? isSuperAdmin : (isSuperAdmin || permissions.includes(item.module))
  ));
  const current = NAV.find(item => location.pathname.startsWith(item.path))?.label || 'Platform';

  return (
    <div style={{ height: '100vh', display: 'flex', overflow: 'hidden' }}>
      <aside style={{
        width: 232, flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: 'var(--card)', borderRight: '1px solid var(--line)', padding: '18px 12px',
        height: '100vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 8px 18px' }}>
          <ShieldCheck size={22} color="var(--accent)" />
          <div>
            <strong style={{ fontSize: 14, display: 'block', lineHeight: 1.2 }}>Platform Admin</strong>
            <span style={{ fontSize: 10.5, color: 'var(--slate)' }}>Platform Control</span>
          </div>
        </div>

        <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', padding: '6px 10px' }}>
          Platform
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          {visibleNav.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
                borderRadius: 10, fontSize: 13.5, fontWeight: 600, textDecoration: 'none',
                color: isActive ? 'var(--accent)' : 'var(--ink)',
                background: isActive ? 'var(--soft)' : 'transparent',
              })}
            >
              <Icon size={17} strokeWidth={1.8} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px' }}>
            <span style={{
              width: 28, height: 28, borderRadius: '50%', background: 'var(--soft)', color: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
            }}>{user?.name?.[0] || 'A'}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
              <div style={{ fontSize: 10.5, color: 'var(--slate)' }}>{user?.role}</div>
            </div>
          </div>
          <button
            className="btn btn-sm"
            style={{ justifyContent: 'center', background: 'var(--red-soft)', color: 'var(--red)', border: '1px solid rgba(239,68,68,.2)' }}
            onClick={logout}
          >
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh' }}>
        <div style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 26px', background: 'var(--card)', borderBottom: '1px solid var(--line)',
        }}>
          <span style={{ fontSize: 12.5, color: 'var(--slate)' }}>Admin / {current}</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '26px', boxSizing: 'border-box' }}>
          <div style={{ maxWidth: 1100, width: '100%', margin: '0 auto' }}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
