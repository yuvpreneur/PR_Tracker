import { useCallback, useEffect, useState } from 'react';
import { get, post } from '../../services/httpClient.js';
import { toast } from '../../utils/toast.js';

// Unlike every other migrated page, this one has no shared DOM/state to interop
// with — the legacy loadRoles() drives role-tab clicks via a `window.selectRole`
// override tied to inline onclick attributes on the (now-replaced) tab buttons, so
// there's nothing left for it to do once this page owns the DOM; it becomes an
// inert no-op automatically (querySelector('#page-roles ...') finds nothing). This
// hook and RolesPage.jsx fully own fetch/edit/save for the permission matrix.
export default function useRolePermissions(role) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await get(`/api/role-permissions/${encodeURIComponent(role)}`).catch(() => []);
    setRows(data || []);
    setLoading(false);
  }, [role]);

  useEffect(() => { refresh(); }, [refresh]);

  const toggle = (module, action, checked) => {
    setRows(prev => prev.map(r => (r.module === module ? { ...r, [action]: checked } : r)));
  };

  const save = async () => {
    setSaving(true);
    try {
      await post('/api/role-permissions/', { role, permissions: rows });
      toast('Permissions saved');
    } finally {
      setSaving(false);
    }
  };

  return { rows, loading, saving, toggle, save };
}
