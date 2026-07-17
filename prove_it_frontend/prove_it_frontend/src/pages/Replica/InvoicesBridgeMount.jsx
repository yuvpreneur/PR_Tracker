import { createPortal } from 'react-dom';
import useBridgeMount from './useBridgeMount.js';
import InvoicesPage from '../Invoices/InvoicesPage.jsx';

// Same pattern as the other BridgeMount components. The "View" modal is built
// on-the-fly by openInvoiceView() (bridge/pages/invoices.js), appended to
// document.body the first time it's used — lives outside #page-invoices entirely,
// untouched.
export default function InvoicesBridgeMount() {
  const mountNode = useBridgeMount('page-invoices');
  if (!mountNode) return null;
  return createPortal(<InvoicesPage />, mountNode);
}
