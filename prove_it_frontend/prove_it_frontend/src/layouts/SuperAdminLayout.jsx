import { Outlet } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import useAuth from '../hooks/useAuth.jsx';

// Deliberately not reusing AppLayout — this is a wholly separate shell for the one
// role (Super Admin) that never touches business data, so it skips AppLayout's
// sidebar/nav and its legacy bridge/ DOM coupling entirely (see AppRoutes.jsx's
// AuthGate, which renders this instead of AppLayout for Super Admin before any of
// that legacy wiring mounts). Deliberately no company logo/branding here either —
// Super Admin oversees every organization on the platform, not just one of them, so
// this shell stays neutral rather than wearing any single org's identity.
export default function SuperAdminLayout() {
  const { user, logout } = useAuth();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 26px', background: 'var(--card)', borderBottom: '1px solid var(--line)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldCheck size={22} color="var(--accent)" />
          <strong style={{ fontSize: 15 }}>Platform Admin</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ color: 'var(--slate)', fontSize: 12 }}>{user?.name} · Super Admin</span>
          <button
            className="btn btn-sm"
            style={{ background: 'var(--red-soft)', color: 'var(--red)', border: '1px solid rgba(239,68,68,.2)' }}
            onClick={logout}
          >Sign out</button>
        </div>
      </div>
      <div style={{ flex: 1, padding: '26px', maxWidth: 1100, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <Outlet />
      </div>
    </div>
  );
}
