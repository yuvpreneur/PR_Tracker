import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { get } from '../services/httpClient.js';
import useAuth from './useAuth.jsx';

// Replaces src/bridge/core/cache.js's refreshCaches() as part of the bridge-removal
// migration — cross-page reference-data lookups (e.g. "show this project's name next to
// a project_id column") that many pages need read-only, regardless of who owns the
// dedicated CRUD page for that entity. Each entity's own CRUD page keeps its existing
// dedicated hook (useProjects.js, useEmployees.js, etc.) for its own list/create/edit —
// this context is only for other pages borrowing the data for a lookup/dropdown.
const ReferenceDataContext = createContext(null);

const EMPTY = { companies: [], projects: [], employees: [], pcodes: [], bcodes: [] };

export function ReferenceDataProvider({ children }) {
  const { user } = useAuth();
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [companies, projects, employees, pcodes, bcodes] = await Promise.allSettled([
      get('/api/companies'),
      get('/api/projects'),
      get('/api/employees'),
      get('/api/project-codes'),
      get('/api/billing-codes'),
    ]).then(rs => rs.map(r => r.value || []));
    setData({ companies, projects, employees, pcodes, bcodes });
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

  return (
    <ReferenceDataContext.Provider value={{ ...data, loading, refresh }}>
      {children}
    </ReferenceDataContext.Provider>
  );
}

export default function useReferenceData() {
  return useContext(ReferenceDataContext);
}
