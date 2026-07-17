import { get, patch } from '../core/http.js';
import { toast } from '../shared/ui.js';
import { field, val, set } from '../shared/modals.js';
import { API_BASE_URL } from '../../utils/constants.js';

const _tok = () => localStorage.getItem('token');

// ── Company Profile ───────────────────────────────────────────────────────────

async function loadProfile() {
  const data = await get('/api/settings/profile').catch(() => null);
  if (!data) return;
  set('settings-profile-card', 'company name', data.company_name || '');
  set('settings-profile-card', 'gst number', data.gst_number || '');
  set('settings-profile-card', 'default currency', data.default_currency || '');
  set('settings-profile-card', 'financial year start', data.financial_year_start || '');
}

async function saveProfile() {
  const body = {
    company_name: val('settings-profile-card', 'company name'),
    gst_number: val('settings-profile-card', 'gst number'),
    default_currency: val('settings-profile-card', 'default currency') || 'INR',
    financial_year_start: val('settings-profile-card', 'financial year start') || 'April (India)',
  };
  await patch('/api/settings/profile', body);
  toast('Company profile saved');
}

// ── Notifications (auto-saves on toggle — this card has no Save button) ──────

async function loadNotificationPrefs() {
  const rows = Array.from(document.querySelectorAll('#notif-rows .notif-row'));
  if (!rows.length) return; // buildNotifRows() hasn't rendered yet
  const items = await get('/api/settings/notifications').catch(() => null);
  if (!items) return;
  rows.forEach((row, i) => {
    const item = items[i];
    if (!item) return;
    const boxes = row.querySelectorAll('input[type="checkbox"]');
    if (boxes[0]) boxes[0].checked = !!item.in_app;
    if (boxes[1]) boxes[1].checked = !!item.email;
    if (boxes[0] && !boxes[0]._wired) {
      boxes[0]._wired = true;
      boxes[1]._wired = true;
      boxes[0].addEventListener('change', saveNotificationPrefs);
      boxes[1].addEventListener('change', saveNotificationPrefs);
    }
  });
}

async function saveNotificationPrefs() {
  const rows = Array.from(document.querySelectorAll('#notif-rows .notif-row'));
  const items = rows.map(row => {
    const boxes = row.querySelectorAll('input[type="checkbox"]');
    return {
      label: row.querySelector('span')?.textContent?.trim() || '',
      in_app: !!boxes[0]?.checked,
      email: !!boxes[1]?.checked,
    };
  });
  await patch('/api/settings/notifications', { items });
  toast('Notification preferences saved');
}

// ── Approval Workflow ─────────────────────────────────────────────────────────

async function loadApprovalWorkflow() {
  const data = await get('/api/settings/approval-workflow').catch(() => null);
  if (!data) return;
  set('settings-workflow-card', 'timesheet approval levels', data.timesheet_approval_levels || '');
  set('settings-workflow-card', 'expense approval levels', data.expense_approval_levels || '');
  set('settings-workflow-card', 'auto-lock approved records', data.auto_lock || '');
}

async function saveApprovalWorkflow() {
  const body = {
    timesheet_approval_levels: val('settings-workflow-card', 'timesheet approval levels'),
    expense_approval_levels: val('settings-workflow-card', 'expense approval levels'),
    auto_lock: val('settings-workflow-card', 'auto-lock approved records'),
  };
  await patch('/api/settings/approval-workflow', body);
  toast('Approval workflow saved');
}

// ── Backup & Data ──────────────────────────────────────────────────────────────

async function loadBackupConfig() {
  const data = await get('/api/settings/backup-config').catch(() => null);
  if (!data) return;
  set('settings-backup-card', 'auto backup frequency', data.auto_backup_frequency || '');
  set('settings-backup-card', 'backup retention', String(data.retention_days ?? ''));
}

async function saveBackupConfig() {
  const body = {
    auto_backup_frequency: val('settings-backup-card', 'auto backup frequency'),
    retention_days: parseInt(val('settings-backup-card', 'backup retention'), 10) || 90,
  };
  await patch('/api/settings/backup-config', body);
  toast('Backup configuration saved');
}

async function downloadBackup() {
  const btn = document.getElementById('settings-download-backup-btn');
  if (btn) btn.disabled = true;
  try {
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
  } finally {
    if (btn) btn.disabled = false;
  }
}

function _ensureRestoreFileInput() {
  let input = document.getElementById('settings-restore-file-input');
  if (input) return input;
  input = document.createElement('input');
  input.type = 'file';
  input.id = 'settings-restore-file-input';
  input.accept = 'application/json';
  input.style.display = 'none';
  document.body.appendChild(input);
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!confirm(
      'This will REPLACE all data in the database with the contents of the selected backup file. ' +
      'This cannot be undone. Continue?'
    )) return;
    const form = new FormData();
    form.append('file', file);
    const btn = document.getElementById('settings-restore-backup-btn');
    if (btn) btn.disabled = true;
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
      if (btn) btn.disabled = false;
    }
  });
  return input;
}

// ── Wiring ─────────────────────────────────────────────────────────────────────

function wireCard(cardId, btnLabel, handler) {
  const card = document.getElementById(cardId);
  if (!card) return;
  const btn = Array.from(card.querySelectorAll('.btn-primary')).find(b => b.textContent.trim() === btnLabel);
  if (btn && !btn._wired) {
    btn._wired = true;
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try { await handler(); } finally { btn.disabled = false; }
    });
  }
}

function wireBackupButtons() {
  const card = document.getElementById('settings-backup-card');
  if (!card) return;
  const [downloadBtn, restoreBtn] = card.querySelectorAll('.btn-ghost');
  if (downloadBtn && !downloadBtn._wired) {
    downloadBtn._wired = true;
    downloadBtn.id = 'settings-download-backup-btn';
    downloadBtn.addEventListener('click', downloadBackup);
  }
  if (restoreBtn && !restoreBtn._wired) {
    restoreBtn._wired = true;
    restoreBtn.id = 'settings-restore-backup-btn';
    restoreBtn.addEventListener('click', () => _ensureRestoreFileInput().click());
  }
}

export async function loadSettings() {
  await Promise.all([loadProfile(), loadNotificationPrefs(), loadApprovalWorkflow(), loadBackupConfig()]);
  wireCard('settings-profile-card', 'Save Profile', saveProfile);
  wireCard('settings-workflow-card', 'Save Workflow', saveApprovalWorkflow);
  wireBackupButtons();
}
