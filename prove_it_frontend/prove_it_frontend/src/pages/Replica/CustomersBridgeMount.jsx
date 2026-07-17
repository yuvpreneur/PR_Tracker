import { createPortal } from 'react-dom';
import useBridgeMount from './useBridgeMount.js';
import CustomersPage from '../Customers/CustomersPage.jsx';

// Same pattern as the other BridgeMount components. Shares modal-company and the
// /api/companies backend with CompaniesBridgeMount — both stay independently
// mounted and refetch on their own CustomEvent ('companies:changed' /
// 'customers:changed'), matching the legacy behavior where only the currently
// active page's loader ran after a shared-modal save.
export default function CustomersBridgeMount() {
  const mountNode = useBridgeMount('page-customers');
  if (!mountNode) return null;
  return createPortal(<CustomersPage />, mountNode);
}
