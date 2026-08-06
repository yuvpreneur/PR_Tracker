import React, { useEffect, useRef } from 'react';
import { appHtml, appScript } from './appMarkup.js';
import { initApiBridge } from '../../bridge/index.js';
import useAuth from '../../hooks/useAuth.jsx';
import DashboardBridgeMount from './DashboardBridgeMount.jsx';
import ReportsBridgeMount from './ReportsBridgeMount.jsx';
import ProjectsBridgeMount from './ProjectsBridgeMount.jsx';
import CompaniesBridgeMount from './CompaniesBridgeMount.jsx';
import ProjectCodesBridgeMount from './ProjectCodesBridgeMount.jsx';
import BillingCodesBridgeMount from './BillingCodesBridgeMount.jsx';
import ServiceDeskBridgeMount from './ServiceDeskBridgeMount.jsx';
import EmployeesBridgeMount from './EmployeesBridgeMount.jsx';
import HourlyCostsBridgeMount from './HourlyCostsBridgeMount.jsx';
import TimesheetsBridgeMount from './TimesheetsBridgeMount.jsx';
import LeaveBridgeMount from './LeaveBridgeMount.jsx';
import PayrollBridgeMount from './PayrollBridgeMount.jsx';
import PayslipsBridgeMount from './PayslipsBridgeMount.jsx';
import ExpensesBridgeMount from './ExpensesBridgeMount.jsx';
import InvoicesBridgeMount from './InvoicesBridgeMount.jsx';
import CustomersBridgeMount from './CustomersBridgeMount.jsx';
import ReceivablesBridgeMount from './ReceivablesBridgeMount.jsx';
import ApprovalsBridgeMount from './ApprovalsBridgeMount.jsx';
import UsersBridgeMount from './UsersBridgeMount.jsx';
import RolesBridgeMount from './RolesBridgeMount.jsx';
import AccessControlBridgeMount from './AccessControlBridgeMount.jsx';
import AuditLogBridgeMount from './AuditLogBridgeMount.jsx';
import SettingsBridgeMount from './SettingsBridgeMount.jsx';
import NoAccessBridgeMount from './NoAccessBridgeMount.jsx';

export default function ReplicaPage() {
  const { logout } = useAuth();
  // Survives React 18 StrictMode's dev-only double-invoke of this effect (mount →
  // cleanup → remount, same component instance) without surviving a genuine
  // unmount+remount (e.g. logout then log back in creates a fresh ref). Without
  // this guard, StrictMode caused appScript's <script> tag to be recreated and
  // re-executed a second time, double-registering every one of its top-level
  // (not deferred behind doLogin()) document.addEventListener calls — harmless
  // for ones that just .remove() a class, but broke the report-export menu's
  // classList.toggle('open') (two toggles on the same click net out to nothing).
  const scriptInjectedRef = useRef(false);

  useEffect(() => {
    if (!scriptInjectedRef.current) {
      scriptInjectedRef.current = true;
      const existing = document.getElementById('prove-it-catalysts-runtime');
      if (existing) existing.remove();

      const script = document.createElement('script');
      script.id = 'prove-it-catalysts-runtime';
      script.text = appScript;
      document.body.appendChild(script);
    }

    // Skip the appMarkup login screen — user is already authenticated via React
    const timer = setTimeout(() => {
      const loginScreen = document.getElementById('login-screen');
      if (loginScreen) loginScreen.style.display = 'none';
      if (typeof window.doLogin === 'function') window.doLogin();
      // Init API bridge after appScript has defined all window.* functions
      setTimeout(() => initApiBridge(), 200);
    }, 50);

    // Override doLogout so the Sign out button clears the JWT and returns to React login
    window.doLogout = () => {
      logout();
    };

    return () => {
      clearTimeout(timer);
      const runtime = document.getElementById('prove-it-catalysts-runtime');
      if (runtime) runtime.remove();
      delete window.doLogout;
      // Restore original navigate/openModal if overridden by bridge
      if (window._origCloseModal) { window.closeModal = window._origCloseModal; delete window._origCloseModal; }
    };
  }, [logout]);

  return (
    <>
      <div
        className="prove-it-replica-root"
        dangerouslySetInnerHTML={{ __html: appHtml }}
      />
      <DashboardBridgeMount />
      <ReportsBridgeMount />
      <ProjectsBridgeMount />
      <CompaniesBridgeMount />
      <ProjectCodesBridgeMount />
      <BillingCodesBridgeMount />
      <ServiceDeskBridgeMount />
      <EmployeesBridgeMount />
      <HourlyCostsBridgeMount />
      <TimesheetsBridgeMount />
      <LeaveBridgeMount />
      <PayrollBridgeMount />
      <PayslipsBridgeMount />
      <ExpensesBridgeMount />
      <InvoicesBridgeMount />
      <CustomersBridgeMount />
      <ReceivablesBridgeMount />
      <ApprovalsBridgeMount />
      <UsersBridgeMount />
      <RolesBridgeMount />
      <AccessControlBridgeMount />
      <AuditLogBridgeMount />
      <SettingsBridgeMount />
      <NoAccessBridgeMount />
    </>
  );
}
