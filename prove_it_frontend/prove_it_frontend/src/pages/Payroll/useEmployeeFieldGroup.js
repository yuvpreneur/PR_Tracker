import { useCallback, useEffect, useState } from 'react';
import { get, patch } from '../../services/httpClient.js';

// Shared by Bank & Statutory / Job Details / Employee Details tabs — each is "list
// employees with these fields, edit one via PATCH", differing only in which API path
// and fields. See EmployeeFieldGroupTab.jsx for the matching UI.
export default function useEmployeeFieldGroup(basePath) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await get(basePath).catch(() => []);
    setEmployees(rows || []);
    setLoading(false);
  }, [basePath]);

  useEffect(() => { refresh(); }, [refresh]);

  const updateFields = (empId, payload) =>
    patch(`${basePath}/${empId}`, payload).then(r => { refresh(); return r; });

  return { employees, loading, updateFields };
}
