import { createPortal } from 'react-dom';
import useBridgeMount from './useBridgeMount.js';
import NoAccessPage from '../NoAccess/NoAccessPage.jsx';

// Same pattern as the other BridgeMount components. Not a nav page (no data-page
// entry), so bridge/index.js's showNoAccess() still directly toggles .active on
// this div (same as it does for every real page's container) — nothing to remove
// from any loaders map, since this was never wired to one.
export default function NoAccessBridgeMount() {
  const mountNode = useBridgeMount('page-no-access');
  if (!mountNode) return null;
  return createPortal(<NoAccessPage />, mountNode);
}
