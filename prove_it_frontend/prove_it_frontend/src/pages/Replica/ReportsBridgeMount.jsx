import { createPortal } from 'react-dom';
import useBridgeMount from './useBridgeMount.js';
import ReportsPage from '../Reports/ReportsPage.jsx';

// Same pattern as the other BridgeMount components. 'page-reports' is removed
// from bridge/index.js's loaders map since loadReports() only toggled visibility
// of legacy DOM rows this page no longer has — View/Export themselves still work
// via the existing document-level delegations (see ReportsPage.jsx).
export default function ReportsBridgeMount() {
  const mountNode = useBridgeMount('page-reports');
  if (!mountNode) return null;
  return createPortal(<ReportsPage />, mountNode);
}
