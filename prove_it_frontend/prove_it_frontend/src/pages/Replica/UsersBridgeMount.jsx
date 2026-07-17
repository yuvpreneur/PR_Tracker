import { createPortal } from 'react-dom';
import useBridgeMount from './useBridgeMount.js';
import UsersPage from '../Users/UsersPage.jsx';

// Same pattern as the other BridgeMount components.
export default function UsersBridgeMount() {
  const mountNode = useBridgeMount('page-users');
  if (!mountNode) return null;
  return createPortal(<UsersPage />, mountNode);
}
