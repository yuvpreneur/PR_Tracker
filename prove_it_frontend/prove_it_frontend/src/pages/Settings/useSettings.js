import { useCallback, useEffect, useState } from 'react';
import { get, patch } from '../../bridge/core/http.js';
import { toast } from '../../bridge/shared/ui.js';
import { API_BASE_URL } from '../../utils/constants.js';

const _tok = () => localStorage.getItem('token');

const DEFAULT_PROFILE = { company_name: '', gst_number: '', default_currency: 'INR', financial_year_start: 'April (India)' };
const DEFAULT_WORKFLOW = { timesheet_approval_levels: '1 Level (Manager)', expense_approval_levels: '2 Levels (Manager → Finance)', auto_lock: 'Yes – lock immediately' };
const DEFAULT_BACKUP_CONFIG = { auto_backup_frequency: 'Daily', retention_days: 90 };

// Full rebuild (like Roles/Approvals/Access Control) — this page has no table/filter
// shape at all, just 4 independent form cards, so there's no `renderTable()`/bespoke
// dropdown-populator risk to guard against. See `bridge/pages/settings.js`'s own
// loadSettings()/saveX() functions, which become fully dead code once
// 'page-settings' is removed from bridge/index.js's loaders map (nothing else calls
// them) — left in place rather than deleted, same precedent as Access Control's dead
// `loadAccessControl()` internals.
export default function useSettings() {
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [notifications, setNotifications] = useState([]);
  const [workflow, setWorkflow] = useState(DEFAULT_WORKFLOW);
  const [backupConfig, setBackupConfig] = useState(DEFAULT_BACKUP_CONFIG);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    Promise.all([
      get('/api/settings/profile').catch(() => DEFAULT_PROFILE),
      get('/api/settings/notifications').catch(() => []),
      get('/api/settings/approval-workflow').catch(() => DEFAULT_WORKFLOW),
      get('/api/settings/backup-config').catch(() => DEFAULT_BACKUP_CONFIG),
    ]).then(([p, n, w, b]) => {
      setProfile(p || DEFAULT_PROFILE);
      setNotifications(n || []);
      setWorkflow(w || DEFAULT_WORKFLOW);
      setBackupConfig(b || DEFAULT_BACKUP_CONFIG);
      setLoading(false);
    });
  }, []);

  const saveProfile = async () => {
    await patch('/api/settings/profile', profile);
    toast('Company profile saved');
  };

  // Notifications auto-save on every toggle — no Save button, matches legacy.
  const toggleNotification = async (index, field, checked) => {
    const next = notifications.map((item, i) => (i === index ? { ...item, [field]: checked } : item));
    setNotifications(next);
    await patch('/api/settings/notifications', { items: next });
    toast('Notification preferences saved');
  };

  const saveWorkflow = async () => {
    await patch('/api/settings/approval-workflow', workflow);
    toast('Approval workflow saved');
  };

  const downloadBackup = useCallback(async () => {
    const r = await fetch(`${API_BASE_URL}/api/settings/backup/export`, {
      headers: { Authorization: `Bearer ${_tok()}` },
    });
    if (!r.ok) { toast('Backup export failed', 'error'); return; }
    const blob = await r.blob();
    const cd = r.headers.get('Content-Disposition') || '';
    const match = /filename="([^"]+)"/.exec(cd);
    const filename = match ? match[1] : `prove_it_backup_${new Date().toISOString().slice(0, 10)}.json`;
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast('Database backup downloaded');
  }, []);

  const restoreBackup = useCallback(async file => {
    if (!confirm(
      'This will REPLACE all data in the database with the contents of the selected backup file. ' +
      'This cannot be undone. Continue?'
    )) return;
    const form = new FormData();
    form.append('file', file);
    setRestoring(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/settings/backup/restore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${_tok()}` },
        body: form,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { toast(data.detail || 'Restore failed', 'error'); return; }
      toast('Database restored from backup — reloading…');
      setTimeout(() => location.reload(), 1200);
    } finally {
      setRestoring(false);
    }
  }, []);

  return {
    profile, setProfile, saveProfile,
    notifications, toggleNotification,
    workflow, setWorkflow, saveWorkflow,
    backupConfig, setBackupConfig,
    downloadBackup, restoreBackup, restoring,
    loading,
  };
}
