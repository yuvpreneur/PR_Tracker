import { createPortal } from 'react-dom';
import useBridgeMount from './useBridgeMount.js';
import AttendancePage from '../Attendance/AttendancePage.jsx';

// Same pattern as the other BridgeMount components.
export default function AttendanceBridgeMount() {
  const mountNode = useBridgeMount('page-attendance');
  if (!mountNode) return null;
  return createPortal(<AttendancePage />, mountNode);
}
