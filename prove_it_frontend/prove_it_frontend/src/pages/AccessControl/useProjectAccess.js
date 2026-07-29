import { useCallback, useEffect, useState } from 'react';
import { get, post } from '../../services/httpClient.js';
import { toast } from '../../utils/toast.js';

export default function useProjectAccess(empId) {
  const [allowed, setAllowed] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!empId) { setAllowed({}); return; }
    setLoading(true);
    const rows = await get(`/api/access-control/projects/${empId}`).catch(() => []);
    setAllowed(Object.fromEntries(rows.map(r => [r.project_id, r.allowed])));
    setLoading(false);
  }, [empId]);

  useEffect(() => { refresh(); }, [refresh]);

  const toggle = (projectId, checked) => setAllowed(prev => ({ ...prev, [projectId]: checked }));

  const save = async projects => {
    if (!empId) { toast('Select an employee first', 'error'); return; }
    setSaving(true);
    try {
      const permissions = projects.map(p => ({ project_id: p.id, allowed: !!allowed[p.id] }));
      await post('/api/access-control/projects', { emp_id: empId, permissions });
      toast('Project access saved');
    } finally {
      setSaving(false);
    }
  };

  return { allowed, loading, saving, toggle, save };
}
