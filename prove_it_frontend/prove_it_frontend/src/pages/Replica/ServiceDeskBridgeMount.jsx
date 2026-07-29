import { createPortal } from 'react-dom';
import useBridgeMount from './useBridgeMount.js';
import ServiceDeskPage from '../ServiceDesk/ServiceDeskPage.jsx';

// Same pattern as the other BridgeMount components. Most of this page's
// legacy markup (hero, fake stats, workflow-grid, integration-grid) is a static
// decorative dashboard — ported verbatim, unchanged — around one real feature (the
// ticket table + edit/resolve/close actions), which ServiceDeskPage.jsx rebuilds
// in React against live data.
export default function ServiceDeskBridgeMount() {
  const mountNode = useBridgeMount('page-service-desk');
  if (!mountNode) return null;
  return createPortal(<ServiceDeskPage />, mountNode);
}
