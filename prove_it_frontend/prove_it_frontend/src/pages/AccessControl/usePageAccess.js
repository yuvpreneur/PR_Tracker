import { useCallback, useEffect, useState } from 'react';
import { get, post } from '../../services/httpClient.js';
import { toast } from '../../utils/toast.js';

// Mirrors app.core.permissions.MODULES exactly — every module the dynamic Roles &
// Permissions matrix knows about is individually grantable/deniable here per employee.
// (Dashboard/Users/Roles/Access Control/Audit/Settings are deliberately not part of this
// list — they're always-visible or hardcoded-Admin-only regardless of Page Access.)
export const PAGES = [
  'Companies', 'Projects', 'Project Codes', 'Billing Codes', 'Employees', 'Hourly Costs',
  'Timesheets', 'Expenses', 'Leave', 'Service Desk', 'Receivables',
  'Reports', 'Approvals',
];

export default function usePageAccess(empId) {
  const [allowed, setAllowed] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!empId) { setAllowed({}); return; }
    setLoading(true);
    const rows = await get(`/api/access-control/pages/${empId}`).catch(() => []);
    setAllowed(Object.fromEntries(rows.map(r => [r.page, r.allowed])));
    setLoading(false);
  }, [empId]);

  useEffect(() => { refresh(); }, [refresh]);

  const toggle = (page, checked) => setAllowed(prev => ({ ...prev, [page]: checked }));

  const save = async () => {
    if (!empId) { toast('Select an employee first', 'error'); return; }
    setSaving(true);
    try {
      const permissions = PAGES.map(page => ({ page, allowed: !!allowed[page] }));
      await post('/api/access-control/pages', { emp_id: empId, permissions });
      toast('Page access saved');
    } finally {
      setSaving(false);
    }
  };

  return { allowed, loading, saving, toggle, save };
}
