import { get, qs } from '../core/http.js';
import { state } from '../core/state.js';
import { badge, date, periodRange } from '../shared/ui.js';
import { renderTable } from '../shared/table.js';
import { noActionsColumn } from '../shared/permissions.js';

export async function loadAudit() {
  const userSel = document.getElementById('audit-user-filter');
  if (userSel && userSel.options.length <= 1) {
    const users = await get('/api/users').catch(() => []);
    users.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.name; opt.textContent = u.name;
      userSel.appendChild(opt);
    });
  }

  const period = document.getElementById('audit-period')?.value || '';
  const params = { ...state.pf['page-audit'] };
  if (period) {
    const { date_from, date_to } = periodRange(period);
    params.date_from = date_from; params.date_to = date_to;
  }

  const data = await get('/api/audit-log/' + qs(params)).catch(() => null);
  const rows = data?.logs || data || [];
  state.auditLogs = rows;

  renderTable('page-audit', rows, [
    { k: 'timestamp', fn: r => date(r.timestamp || r.created_at) },
    { k: 'user',      fn: r => r.user || '—' },
    { k: 'module',    fn: r => badge(r.module || '—') },
    { k: 'action',    fn: r => r.action || '—' },
    { k: 'detail',    fn: r => r.detail || '—' },
  ], r => r.id, () => '', null, {
    noEdit: state.currentUser?.role !== 'Admin', noDelete: state.currentUser?.role !== 'Admin',
    hideActionsColumn: noActionsColumn('audit'),
  });

  const exportBtn = document.getElementById('audit-export-btn');
  if (exportBtn) {
    exportBtn.onclick = () => {
      if (!rows.length) return;
      const cols = ['timestamp', 'user', 'module', 'action', 'detail'];
      const csv = [cols.join(','), ...rows.map(r => cols.map(c => JSON.stringify(r[c] ?? '')).join(','))].join('\n');
      const a = document.createElement('a');
      a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
      a.download = 'audit_log.csv'; a.click();
    };
  }

  document.dispatchEvent(new CustomEvent('audit:changed'));
}
