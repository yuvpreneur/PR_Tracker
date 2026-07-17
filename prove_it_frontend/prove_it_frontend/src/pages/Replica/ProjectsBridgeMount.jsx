import { createPortal } from 'react-dom';
import useBridgeMount from './useBridgeMount.js';
import ProjectsPage from '../Projects/ProjectsPage.jsx';

// Replaces the legacy #page-projects markup with the React/Tailwind ProjectsPage,
// while leaving the div itself (and its "page"/"active" classes) alone so the
// legacy navigate()'s show/hide-by-class-toggle keeps working untouched. The
// legacy loadProjects() pipeline keeps running too (nav clicks, modal save/delete
// still call it) — its DOM writes just become no-ops since their targets are gone;
// what survives is the state.projects population and the modal-project dropdown
// population it does along the way.
export default function ProjectsBridgeMount() {
  const mountNode = useBridgeMount('page-projects');
  if (!mountNode) return null;
  return createPortal(<ProjectsPage />, mountNode);
}
