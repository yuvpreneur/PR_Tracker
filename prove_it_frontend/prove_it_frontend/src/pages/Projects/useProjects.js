import { useCallback, useEffect, useState } from 'react';
import { get } from '../../services/httpClient.js';
import { state } from '../../bridge/core/state.js';
import { populateProjectClientDropdown, populatePCodeProjectDropdown, populateEmployeesForAssignmentDropdown } from '../../bridge/pages/projects.js';
import { populateReceivableModalDropdowns } from '../../bridge/pages/billing.js';
import { populateExpenseModalDropdowns } from '../../bridge/pages/expenses.js';
import { populateTimesheetModalDropdowns } from '../../bridge/pages/timesheets.js';
import { populateTicketProjectDropdown } from '../../bridge/pages/servicedesk.js';

// The legacy bridge/pages/projects.js loadProjects() still runs too (nav clicks,
// modal save/delete all trigger it) and dispatches 'projects:changed' once it's done —
// that's how this hook knows to refetch after a create/edit/delete made through the
// still-legacy modal-project modal.
export default function useProjects() {
  const [projects, setProjects] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [rows, s] = await Promise.all([
      get('/api/projects').catch(() => []),
      get('/api/projects/summary').catch(() => null),
    ]);
    setProjects(rows || []);
    setSummary(s);
    // Keeps the legacy `.bridge-edit`/`.bridge-delete` delegation's row lookup
    // (bridge/index.js, reads state.projects) in sync with what's actually on screen.
    state.projects = rows || [];
    // Every page (and its modal) mounts immediately on login regardless of which
    // route is active (see AllPages in AppRoutes.jsx) — refreshing every Project
    // dropdown here, rather than only when the legacy nav-click loader happens to
    // run, is what keeps them from ever showing stale/fake data.
    populateProjectClientDropdown();
    populatePCodeProjectDropdown();
    populateEmployeesForAssignmentDropdown();
    populateReceivableModalDropdowns();
    populateExpenseModalDropdowns();
    populateTimesheetModalDropdowns();
    populateTicketProjectDropdown();
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    document.addEventListener('projects:changed', refresh);
    return () => document.removeEventListener('projects:changed', refresh);
  }, [refresh]);

  return { projects, summary, loading, refresh };
}
