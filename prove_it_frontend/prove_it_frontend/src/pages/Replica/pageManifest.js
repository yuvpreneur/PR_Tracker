import { lazy } from 'react';

// Bare page id (same ids used throughout: bridge/shared/permissions.js's
// PAGE_MODULE_MAP, bridge/index.js's NAV_ICON_MAP, the nav's data-page attributes,
// and appMarkup.js's onclick="navigate('id')") -> lazily-loaded BridgeMount.
// ReplicaPage.jsx renders only the entry matching the current URL, instead of
// mounting every page (and firing every page's data fetch) at once.
export const PAGE_COMPONENTS = {
  dashboard: lazy(() => import('./DashboardBridgeMount.jsx')),
  reports: lazy(() => import('./ReportsBridgeMount.jsx')),
  companies: lazy(() => import('./CompaniesBridgeMount.jsx')),
  projects: lazy(() => import('./ProjectsBridgeMount.jsx')),
  'project-codes': lazy(() => import('./ProjectCodesBridgeMount.jsx')),
  'billing-codes': lazy(() => import('./BillingCodesBridgeMount.jsx')),
  'service-desk': lazy(() => import('./ServiceDeskBridgeMount.jsx')),
  employees: lazy(() => import('./EmployeesBridgeMount.jsx')),
  'hourly-cost': lazy(() => import('./HourlyCostsBridgeMount.jsx')),
  timesheets: lazy(() => import('./TimesheetsBridgeMount.jsx')),
  leave: lazy(() => import('./LeaveBridgeMount.jsx')),
  payroll: lazy(() => import('./PayrollBridgeMount.jsx')),
  payslips: lazy(() => import('./PayslipsBridgeMount.jsx')),
  expenses: lazy(() => import('./ExpensesBridgeMount.jsx')),
  invoices: lazy(() => import('./InvoicesBridgeMount.jsx')),
  customers: lazy(() => import('./CustomersBridgeMount.jsx')),
  receivables: lazy(() => import('./ReceivablesBridgeMount.jsx')),
  approvals: lazy(() => import('./ApprovalsBridgeMount.jsx')),
  users: lazy(() => import('./UsersBridgeMount.jsx')),
  roles: lazy(() => import('./RolesBridgeMount.jsx')),
  'access-control': lazy(() => import('./AccessControlBridgeMount.jsx')),
  audit: lazy(() => import('./AuditLogBridgeMount.jsx')),
  settings: lazy(() => import('./SettingsBridgeMount.jsx')),
};
