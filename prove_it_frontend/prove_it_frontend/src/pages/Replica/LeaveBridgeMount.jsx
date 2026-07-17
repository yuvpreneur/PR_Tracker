import { createPortal } from 'react-dom';
import useBridgeMount from './useBridgeMount.js';
import LeavePage from '../Leave/LeavePage.jsx';

// Same pattern as the other BridgeMount components.
export default function LeaveBridgeMount() {
  const mountNode = useBridgeMount('page-leave');
  if (!mountNode) return null;
  return createPortal(<LeavePage />, mountNode);
}
