import { createPortal } from 'react-dom';
import useBridgeMount from './useBridgeMount.js';
import TimesheetsPage from '../Timesheets/TimesheetsPage.jsx';

// Same pattern as the other BridgeMount components.
export default function TimesheetsBridgeMount() {
  const mountNode = useBridgeMount('page-timesheets');
  if (!mountNode) return null;
  return createPortal(<TimesheetsPage />, mountNode);
}
