import { useEffect, useState } from 'react';
import { get } from '../../bridge/core/http.js';

// showNoAccess() (bridge/index.js) still owns actually SHOWING this page (toggling
// .active on #page-no-access, exactly like every other page's nav-driven show/hide)
// and writes state.blockedPageId (read directly by the reused submitPageAccessRequest()).
// This hook just needs to know *which* page was blocked, for display — showNoAccess()
// dispatches 'no-access:shown' with that payload instead of writing into
// blocked-page-name/request-page-name, which this page doesn't render.
export default function useNoAccessRequest() {
  const [blockedLabel, setBlockedLabel] = useState('this page');
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    get('/api/projects').then(rows => setProjects(rows || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const onShown = e => setBlockedLabel(e.detail?.label || 'this page');
    document.addEventListener('no-access:shown', onShown);
    return () => document.removeEventListener('no-access:shown', onShown);
  }, []);

  return { blockedLabel, projects };
}
