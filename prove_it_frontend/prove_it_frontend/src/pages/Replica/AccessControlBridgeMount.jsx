import { createPortal } from 'react-dom';
import useBridgeMount from './useBridgeMount.js';
import AccessControlPage from '../AccessControl/AccessControlPage.jsx';

// Same pattern as the other BridgeMount components. Full rebuild, same as
// Roles/Approvals — no legacy loader wired for this page at all (see
// bridge/index.js's loaders map comment).
export default function AccessControlBridgeMount() {
  const mountNode = useBridgeMount('page-access-control');
  if (!mountNode) return null;
  return createPortal(<AccessControlPage />, mountNode);
}
