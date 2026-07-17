import { createPortal } from 'react-dom';
import useBridgeMount from './useBridgeMount.js';
import AuditLogPage from '../AuditLog/AuditLogPage.jsx';

// Same pattern as the other BridgeMount components. Deliberately does NOT reuse
// the legacy `audit-user-filter`/`audit-period`/`audit-export-btn` ids on its own
// filter selects/button — once useBridgeMount clears+claims #page-audit, those ids
// no longer exist in the DOM, so loadAudit()'s own dropdown-populate block and
// bridge/index.js's EXPORT_BTN_ID gating both no-op harmlessly (element not found)
// instead of writing into/duplicating React-owned nodes.
export default function AuditLogBridgeMount() {
  const mountNode = useBridgeMount('page-audit');
  if (!mountNode) return null;
  return createPortal(<AuditLogPage />, mountNode);
}
