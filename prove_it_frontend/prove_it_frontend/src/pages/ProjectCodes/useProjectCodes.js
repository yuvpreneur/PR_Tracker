import { useCallback, useEffect, useState } from 'react';
import { get } from '../../services/httpClient.js';
import { state } from '../../bridge/core/state.js';
import { populateBCodeProjectCodeDropdown } from '../../bridge/pages/billing.js';
import { populateExpenseModalDropdowns } from '../../bridge/pages/expenses.js';
import { populateTimesheetModalDropdowns } from '../../bridge/pages/timesheets.js';

// Same pattern as useProjects.js/useCompanies.js. Project codes only carry a
// project_id foreign key, so this also fetches /api/projects (same as the legacy
// loadProjectCodes()'s reliance on state.projects) to join in the project name.
export default function useProjectCodes() {
  const [pcodes, setPcodes] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [codes, projs] = await Promise.all([
      get('/api/project-codes').catch(() => []),
      get('/api/projects').catch(() => []),
    ]);
    // `|| []` only catches null/undefined — an object (an error body, or a 2xx whose
    // payload didn't parse as JSON) slips straight through and blows up .map downstream.
    const rows = Array.isArray(codes) ? codes : [];
    setPcodes(rows);
    setProjects(Array.isArray(projs) ? projs : []);
    // Keeps the legacy `.bridge-edit`/`.bridge-delete` delegation's row lookup
    // (bridge/index.js, reads state.pcodes) in sync with what's actually on screen.
    state.pcodes = rows;
    // Every page (and its modal) mounts immediately on login regardless of which
    // route is active (see AllPages in AppRoutes.jsx) — refreshing these dropdowns
    // here, rather than only when the legacy nav-click loader happens to run, is
    // what keeps them from ever showing stale/fake data.
    populateBCodeProjectCodeDropdown();
    populateExpenseModalDropdowns();
    populateTimesheetModalDropdowns();
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    document.addEventListener('project-codes:changed', refresh);
    return () => document.removeEventListener('project-codes:changed', refresh);
  }, [refresh]);

  return { pcodes, projects, loading, refresh };
}
