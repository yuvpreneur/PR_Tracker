import { createPortal } from 'react-dom';
import useBridgeMount from './useBridgeMount.js';
import DashboardPage from '../Dashboard/DashboardPage.jsx';

// Same pattern as the other BridgeMount components. 'page-dashboard' is removed
// from bridge/index.js's loaders map (and its dash-content wrapper setup, now
// unnecessary) since DashboardPage.jsx owns all fetching itself — see
// useDashboardData.js.
export default function DashboardBridgeMount() {
  const mountNode = useBridgeMount('page-dashboard');
  if (!mountNode) return null;
  return createPortal(<DashboardPage />, mountNode);
}
