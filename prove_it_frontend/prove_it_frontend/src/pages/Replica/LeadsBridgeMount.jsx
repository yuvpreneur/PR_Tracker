import { createPortal } from 'react-dom';
import useBridgeMount from './useBridgeMount.js';
import LeadsPage from '../Leads/LeadsPage.jsx';

// Same pattern as the other BridgeMount components. Leads is the first page where
// the legacy markup itself is mostly a static decorative dashboard (hardcoded demo
// stats/donut/kanban board) around one real feature (the table + filters + modals) —
// LeadsPage.jsx ports the decorative part verbatim (unchanged, still fake numbers)
// and rebuilds only the real, data-backed part in React.
export default function LeadsBridgeMount() {
  const mountNode = useBridgeMount('page-leads');
  if (!mountNode) return null;
  return createPortal(<LeadsPage />, mountNode);
}
