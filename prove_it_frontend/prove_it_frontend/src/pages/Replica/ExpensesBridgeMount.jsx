import { createPortal } from 'react-dom';
import useBridgeMount from './useBridgeMount.js';
import ExpensesPage from '../Expenses/ExpensesPage.jsx';

// Same pattern as the other BridgeMount components.
export default function ExpensesBridgeMount() {
  const mountNode = useBridgeMount('page-expenses');
  if (!mountNode) return null;
  return createPortal(<ExpensesPage />, mountNode);
}
