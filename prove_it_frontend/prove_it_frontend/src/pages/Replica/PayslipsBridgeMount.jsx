import { createPortal } from 'react-dom';
import useBridgeMount from './useBridgeMount.js';
import PayslipsPage from '../Payslips/PayslipsPage.jsx';

// Same pattern as the other BridgeMount components. No legacy loader/CustomEvent
// dispatch needed here — this page has no data-fetching pipeline at all (see
// PayslipsPage.jsx), so there's nothing to refetch and no 'payslips:changed' event.
export default function PayslipsBridgeMount() {
  const mountNode = useBridgeMount('page-payslips');
  if (!mountNode) return null;
  return createPortal(<PayslipsPage />, mountNode);
}
