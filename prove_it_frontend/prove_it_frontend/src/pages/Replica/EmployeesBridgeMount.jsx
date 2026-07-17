import { createPortal } from 'react-dom';
import useBridgeMount from './useBridgeMount.js';
import EmployeesPage from '../Employees/EmployeesPage.jsx';

// Same pattern as the other BridgeMount components.
export default function EmployeesBridgeMount() {
  const mountNode = useBridgeMount('page-employees');
  if (!mountNode) return null;
  return createPortal(<EmployeesPage />, mountNode);
}
