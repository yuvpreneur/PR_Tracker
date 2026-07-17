import { createPortal } from 'react-dom';
import useBridgeMount from './useBridgeMount.js';
import ReceivablesPage from '../Receivables/ReceivablesPage.jsx';

// Same pattern as the other BridgeMount components. Shares modal-recv and the
// /api/receivables backend with InvoicesBridgeMount.
export default function ReceivablesBridgeMount() {
  const mountNode = useBridgeMount('page-receivables');
  if (!mountNode) return null;
  return createPortal(<ReceivablesPage />, mountNode);
}
