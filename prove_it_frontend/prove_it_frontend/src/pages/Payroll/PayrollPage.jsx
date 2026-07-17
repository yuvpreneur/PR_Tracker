import { PAYROLL_HTML } from './payrollStatic.js';

// Fully static, ported verbatim (same technique as Leads/Service Desk/My Payslips'
// decorative markup) — Payroll's backend + data model are deliberately reverted
// (see project memory), and the "+ Run Payroll" button has no onclick handler in
// the legacy markup either, so there is nothing live to wire up. This just moves
// the demo markup out of the appMarkup.js blob unchanged.
export default function PayrollPage() {
  return <div dangerouslySetInnerHTML={{ __html: PAYROLL_HTML }} />;
}
