import { createPortal } from 'react-dom';
import useBridgeMount from './useBridgeMount.js';
import RolesPage from '../Roles/RolesPage.jsx';

// Same pattern as the other BridgeMount components. Unlike most pages, this one is
// a full rebuild rather than "real table + reused legacy modal" — see
// useRolePermissions.js for why the legacy loadRoles() needs no CustomEvent hookup.
export default function RolesBridgeMount() {
  const mountNode = useBridgeMount('page-roles');
  if (!mountNode) return null;
  return createPortal(<RolesPage />, mountNode);
}
