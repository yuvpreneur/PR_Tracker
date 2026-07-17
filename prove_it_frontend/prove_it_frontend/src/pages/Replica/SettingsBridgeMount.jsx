import { createPortal } from 'react-dom';
import useBridgeMount from './useBridgeMount.js';
import SettingsPage from '../Settings/SettingsPage.jsx';

// Same pattern as Roles/Approvals/Access Control — a full rebuild, so
// 'page-settings' is removed from bridge/index.js's loaders map entirely (see
// the comment there) rather than guarded, since nothing on this page needs the
// legacy loadSettings()/saveX() functions to keep running.
export default function SettingsBridgeMount() {
  const mountNode = useBridgeMount('page-settings');
  if (!mountNode) return null;
  return createPortal(<SettingsPage />, mountNode);
}
