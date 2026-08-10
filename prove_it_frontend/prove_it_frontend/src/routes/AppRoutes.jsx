import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth.jsx';
import usePermissions from '../hooks/usePermissions.js';
import { state } from '../bridge/core/state.js';
import Login from '../pages/Login/Login.jsx';
import ReplicaPage from '../pages/Replica/ReplicaPage.jsx';
import AppLayout from '../layouts/AppLayout.jsx';
import DashboardPage from '../pages/Dashboard/DashboardPage.jsx';
import ReportsPage from '../pages/Reports/ReportsPage.jsx';
import CompaniesPage from '../pages/Companies/CompaniesPage.jsx';
import ProjectsPage from '../pages/Projects/ProjectsPage.jsx';
import ProjectCodesPage from '../pages/ProjectCodes/ProjectCodesPage.jsx';
import BillingCodesPage from '../pages/BillingCodes/BillingCodesPage.jsx';
import ServiceDeskPage from '../pages/ServiceDesk/ServiceDeskPage.jsx';
import EmployeesPage from '../pages/Employees/EmployeesPage.jsx';
import HourlyCostsPage from '../pages/HourlyCosts/HourlyCostsPage.jsx';
import TimesheetsPage from '../pages/Timesheets/TimesheetsPage.jsx';
import LeavePage from '../pages/Leave/LeavePage.jsx';
import PayrollPage from '../pages/Payroll/PayrollPage.jsx';
import PayslipsPage from '../pages/Payslips/PayslipsPage.jsx';
import ExpensesPage from '../pages/Expenses/ExpensesPage.jsx';
import InvoicesPage from '../pages/Invoices/InvoicesPage.jsx';
import CustomersPage from '../pages/Customers/CustomersPage.jsx';
import ReceivablesPage from '../pages/Receivables/ReceivablesPage.jsx';
import ApprovalsPage from '../pages/Approvals/ApprovalsPage.jsx';
import UsersPage from '../pages/Users/UsersPage.jsx';
import RolesPage from '../pages/Roles/RolesPage.jsx';
import AccessControlPage from '../pages/AccessControl/AccessControlPage.jsx';
import AuditLogPage from '../pages/AuditLog/AuditLogPage.jsx';
import SettingsPage from '../pages/Settings/SettingsPage.jsx';
import NoAccessPage from '../pages/NoAccess/NoAccessPage.jsx';

// Direct URL navigation (typed/bookmarked) didn't exist before real routing — nav-click
// was the only way to reach a page, and locked items were intercepted there. Now that
// every page has a real path, this guard replicates the same canViewPage() check for
// that entry point, using the same state.blockedPageId/'no-access:shown' contract
// AppLayout.jsx's locked-nav-click handler and NoAccessPage.jsx already share.
//
// `active` distinguishes "this is the page currently being viewed" from "this page is
// mounted in the background, hidden" (see AllPages below — every page mounts
// immediately on login and stays mounted, so switching pages doesn't re-fetch and
// flash a loading state every time). Gating must only redirect for the active page —
// a locked page sitting mounted-but-hidden in the background must not force-navigate
// the user away from whatever they're actually looking at.
function PageGate({ id, label, active, children }) {
  const { canViewPage } = usePermissions();
  const navigate = useNavigate();
  const allowed = canViewPage(id);

  useEffect(() => {
    if (!active || allowed) return;
    state.blockedPageId = id;
    document.dispatchEvent(new CustomEvent('no-access:shown', { detail: { pageId: id, label } }));
    navigate('/no-access', { replace: true });
  }, [active, allowed, id, label, navigate]);

  if (active && !allowed) return null;
  return children;
}

// Every page mounts immediately on login and stays mounted for the rest of the
// session — the .page/.page.active CSS classes (global.css, unchanged from the legacy
// shell) just toggle which one is visible. This means every page's data fetch starts
// right away instead of waiting for its first visit, so by the time you click a nav
// item its data is already loaded (or loading) rather than starting from scratch.
const PAGES = [
  { id: 'dashboard', label: 'Dashboard', Component: DashboardPage },
  { id: 'reports', label: 'Reports', Component: ReportsPage },
  { id: 'companies', label: 'Companies', Component: CompaniesPage },
  { id: 'projects', label: 'Projects', Component: ProjectsPage },
  { id: 'project-codes', label: 'Project Codes', Component: ProjectCodesPage },
  { id: 'billing-codes', label: 'Billing Codes', Component: BillingCodesPage },
  { id: 'service-desk', label: 'Service Desk', Component: ServiceDeskPage },
  { id: 'employees', label: 'Employees', Component: EmployeesPage },
  { id: 'hourly-cost', label: 'Hourly Cost', Component: HourlyCostsPage },
  { id: 'timesheets', label: 'Timesheets', Component: TimesheetsPage },
  { id: 'leave', label: 'Leave', Component: LeavePage },
  { id: 'payroll', label: 'Payroll', Component: PayrollPage },
  { id: 'payslips', label: 'My Payslips', Component: PayslipsPage },
  { id: 'expenses', label: 'Expenses', Component: ExpensesPage },
  { id: 'invoices', label: 'Invoices', Component: InvoicesPage },
  { id: 'customers', label: 'Customers', Component: CustomersPage },
  { id: 'receivables', label: 'Receivables', Component: ReceivablesPage },
  { id: 'approvals', label: 'Approvals', Component: ApprovalsPage },
  { id: 'users', label: 'Users', Component: UsersPage },
  { id: 'roles', label: 'Roles & Perms', Component: RolesPage },
  { id: 'access-control', label: 'Access Control', Component: AccessControlPage },
  { id: 'audit', label: 'Audit Log', Component: AuditLogPage },
  { id: 'settings', label: 'Settings', Component: SettingsPage },
];
const PAGE_IDS = new Set(PAGES.map(p => p.id));

function AllPages() {
  const location = useLocation();
  const activeId = location.pathname.replace(/^\//, '');

  if (!PAGE_IDS.has(activeId)) return <Navigate to="/dashboard" replace />;

  return (
    <>
      {PAGES.map(({ id, label, Component }) => (
        <div key={id} id={`page-${id}`} className={`page${id === activeId ? ' active' : ''}`}>
          <PageGate id={id} label={label} active={id === activeId}>
            <Component />
          </PageGate>
        </div>
      ))}
    </>
  );
}

function LoadingScreen() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter, sans-serif', color: '#516B7A' }}>
      Loading…
    </div>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  // A password-reset link may be opened in a browser that still has a session for a
  // different account — always show the reset form in that case instead of the
  // authenticated app, otherwise the token would be silently dropped.
  const hasResetToken = new URLSearchParams(window.location.search).has('token');
  if (!user || hasResetToken) return <Login />;

  return (
    <>
      {/* Trimmed to a hidden modal host + wireSubmits()/table-action bridge runtime —
          sidebar/topbar/nav/page shell now live in AppLayout + the routes below. */}
      <ReplicaPage />
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="no-access" element={<NoAccessPage />} />
          <Route path="*" element={<AllPages />} />
        </Route>
      </Routes>
    </>
  );
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<AuthGate />} />
      </Routes>
    </BrowserRouter>
  );
}
