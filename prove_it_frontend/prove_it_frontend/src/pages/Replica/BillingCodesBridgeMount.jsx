import { createPortal } from 'react-dom';
import useBridgeMount from './useBridgeMount.js';
import BillingCodesPage from '../BillingCodes/BillingCodesPage.jsx';

// Same pattern as ProjectsBridgeMount.jsx / CompaniesBridgeMount.jsx / ProjectCodesBridgeMount.jsx.
export default function BillingCodesBridgeMount() {
  const mountNode = useBridgeMount('page-billing-codes');
  if (!mountNode) return null;
  return createPortal(<BillingCodesPage />, mountNode);
}
