import { createPortal } from 'react-dom';
import useBridgeMount from './useBridgeMount.js';
import ProjectCodesPage from '../ProjectCodes/ProjectCodesPage.jsx';

// Same pattern as ProjectsBridgeMount.jsx / CompaniesBridgeMount.jsx.
export default function ProjectCodesBridgeMount() {
  const mountNode = useBridgeMount('page-project-codes');
  if (!mountNode) return null;
  return createPortal(<ProjectCodesPage />, mountNode);
}
