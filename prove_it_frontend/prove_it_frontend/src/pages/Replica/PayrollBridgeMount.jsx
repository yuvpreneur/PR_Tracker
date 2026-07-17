import { createPortal } from 'react-dom';
import useBridgeMount from './useBridgeMount.js';
import PayrollPage from '../Payroll/PayrollPage.jsx';

// Same pattern as Payslips — no legacy loader/CustomEvent dispatch needed, this
// page has no data-fetching pipeline at all (see PayrollPage.jsx).
export default function PayrollBridgeMount() {
  const mountNode = useBridgeMount('page-payroll');
  if (!mountNode) return null;
  return createPortal(<PayrollPage />, mountNode);
}
