import { PAYSLIPS_HTML } from './payslipsStatic.js';

// This entire page is static/hardcoded — there's no backend endpoint for payslip
// records (Payroll's data model is reverted/static, see project memory), and the
// one real feature — the "↓ Download" button generating a client-side PDF via
// downloadPayslip() in bridge/pages/payslips.js — works by reading the clicked
// <tr>'s own cell text directly from the DOM, not from fetched data. So there's
// nothing to convert to a real React data flow here; this just gets the markup out
// of the appMarkup.js blob, ported verbatim (same technique as Leads/Service Desk's
// decorative dashboards) so the download wiring's DOM-scraping keeps working
// unchanged — the column order (Month, Gross, Deductions, Net) is load-bearing.
export default function PayslipsPage() {
  return <div dangerouslySetInnerHTML={{ __html: PAYSLIPS_HTML }} />;
}
