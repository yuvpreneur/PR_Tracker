import { createPortal } from 'react-dom';
import useBridgeMount from './useBridgeMount.js';
import ApprovalsPage from '../Approvals/ApprovalsPage.jsx';

// Same pattern as the other BridgeMount components. The "View" modal is built
// on-the-fly by openApprovalView() (bridge/pages/approvals.js), appended to
// document.body on demand — lives outside #page-approvals entirely, untouched.
export default function ApprovalsBridgeMount() {
  const mountNode = useBridgeMount('page-approvals');
  if (!mountNode) return null;
  return createPortal(<ApprovalsPage />, mountNode);
}
