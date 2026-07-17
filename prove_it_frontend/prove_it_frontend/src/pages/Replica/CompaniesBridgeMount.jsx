import { createPortal } from 'react-dom';
import useBridgeMount from './useBridgeMount.js';
import CompaniesPage from '../Companies/CompaniesPage.jsx';

// Same pattern as ProjectsBridgeMount.jsx — replaces the legacy #page-companies
// markup with the React/Tailwind CompaniesPage, leaving the div itself (and its
// "page"/"active" classes) alone so the legacy navigate()'s show/hide keeps working.
// modal-company is shared with the still-legacy Customers page — untouched here.
export default function CompaniesBridgeMount() {
  const mountNode = useBridgeMount('page-companies');
  if (!mountNode) return null;
  return createPortal(<CompaniesPage />, mountNode);
}
