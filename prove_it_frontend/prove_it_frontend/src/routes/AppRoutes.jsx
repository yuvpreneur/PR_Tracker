import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
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
function PageGate({ id, label, children }) {
  const { canViewPage } = usePermissions();
  const navigate = useNavigate();
  const allowed = canViewPage(id);

  useEffect(() => {
    if (allowed) return;
    state.blockedPageId = id;
    document.dispatchEvent(new CustomEvent('no-access:shown', { detail: { pageId: id, label } }));
    navigate('/no-access', { replace: true });
  }, [allowed, id, label, navigate]);

  return allowed ? children : null;
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
          <Route path="dashboard" element={<PageGate id="dashboard" label="Dashboard"><DashboardPage /></PageGate>} />
          <Route path="reports" element={<PageGate id="reports" label="Reports"><ReportsPage /></PageGate>} />
          <Route path="companies" element={<PageGate id="companies" label="Companies"><CompaniesPage /></PageGate>} />
          <Route path="projects" element={<PageGate id="projects" label="Projects"><ProjectsPage /></PageGate>} />
          <Route path="project-codes" element={<PageGate id="project-codes" label="Project Codes"><ProjectCodesPage /></PageGate>} />
          <Route path="billing-codes" element={<PageGate id="billing-codes" label="Billing Codes"><BillingCodesPage /></PageGate>} />
          <Route path="service-desk" element={<PageGate id="service-desk" label="Service Desk"><ServiceDeskPage /></PageGate>} />
          <Route path="employees" element={<PageGate id="employees" label="Employees"><EmployeesPage /></PageGate>} />
          <Route path="hourly-cost" element={<PageGate id="hourly-cost" label="Hourly Cost"><HourlyCostsPage /></PageGate>} />
          <Route path="timesheets" element={<PageGate id="timesheets" label="Timesheets"><TimesheetsPage /></PageGate>} />
          <Route path="leave" element={<PageGate id="leave" label="Leave"><LeavePage /></PageGate>} />
          <Route path="payroll" element={<PageGate id="payroll" label="Payroll"><PayrollPage /></PageGate>} />
          <Route path="payslips" element={<PageGate id="payslips" label="My Payslips"><PayslipsPage /></PageGate>} />
          <Route path="expenses" element={<PageGate id="expenses" label="Expenses"><ExpensesPage /></PageGate>} />
          <Route path="invoices" element={<PageGate id="invoices" label="Invoices"><InvoicesPage /></PageGate>} />
          <Route path="customers" element={<PageGate id="customers" label="Customers"><CustomersPage /></PageGate>} />
          <Route path="receivables" element={<PageGate id="receivables" label="Receivables"><ReceivablesPage /></PageGate>} />
          <Route path="approvals" element={<PageGate id="approvals" label="Approvals"><ApprovalsPage /></PageGate>} />
          <Route path="users" element={<PageGate id="users" label="Users"><UsersPage /></PageGate>} />
          <Route path="roles" element={<PageGate id="roles" label="Roles & Perms"><RolesPage /></PageGate>} />
          <Route path="access-control" element={<PageGate id="access-control" label="Access Control"><AccessControlPage /></PageGate>} />
          <Route path="audit" element={<PageGate id="audit" label="Audit Log"><AuditLogPage /></PageGate>} />
          <Route path="settings" element={<PageGate id="settings" label="Settings"><SettingsPage /></PageGate>} />
          <Route path="no-access" element={<NoAccessPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
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
