import { createPortal } from 'react-dom';
import useBridgeMount from './useBridgeMount.js';
import HourlyCostsPage from '../HourlyCosts/HourlyCostsPage.jsx';

// Same pattern as the other BridgeMount components. The "History" button opens a
// legacy fixed-position panel (showCostHistory() in bridge/pages/employees.js) that
// lives outside #page-hourly-cost entirely (appended to document.body on demand) —
// untouched, still works via the existing .bridge-cost-history delegation.
export default function HourlyCostsBridgeMount() {
  const mountNode = useBridgeMount('page-hourly-cost');
  if (!mountNode) return null;
  return createPortal(<HourlyCostsPage />, mountNode);
}
