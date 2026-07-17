import { get } from '../core/http.js';
import { date } from './ui.js';

export function updateNotifBadge(count) {
  const badge = document.getElementById('notif-count');
  const dot   = document.querySelector('.notif-dot');
  if (badge) { badge.textContent = count > 99 ? '99+' : String(count); badge.style.display = count > 0 ? 'flex' : 'none'; }
  if (dot)   { dot.style.background = count > 0 ? '#ef4444' : ''; }
}

export function ensureNotifPanel() {
  if (document.getElementById('notif-panel')) return;
  const panel = document.createElement('div');
  panel.id = 'notif-panel';
  panel.style.cssText = 'display:none;position:fixed;top:58px;right:16px;width:340px;max-height:480px;overflow-y:auto;background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.15);z-index:9999;border:1px solid #e2e8f0;';
  panel.innerHTML =
    `<div style="padding:14px 16px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center">` +
      `<div style="font-weight:600;font-size:14px;color:#0A2431">Notifications</div>` +
      `<button onclick="document.getElementById('notif-panel').style.display='none'" style="background:none;border:none;cursor:pointer;font-size:20px;color:#94a3b8;line-height:1">×</button>` +
    `</div>` +
    `<div id="notif-list" style="padding:8px"><div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px">Loading…</div></div>`;
  document.body.appendChild(panel);
  document.addEventListener('click', e => {
    const p = document.getElementById('notif-panel');
    if (p && p.style.display !== 'none' && !p.contains(e.target) && !e.target.closest('#notif-btn')) p.style.display = 'none';
  });
}

export async function loadNotifications() {
  ensureNotifPanel();
  const list = document.getElementById('notif-list');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px">Loading…</div>';
  const data = await get('/api/approvals/pending').catch(() => null);
  if (!data) {
    list.innerHTML = '<div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px">Unable to load</div>';
    return;
  }
  const all = [
    ...(data.timesheets      || []).map(r => ({ type: 'Timesheet',  color: '#8b5cf6', nav: 'timesheets',
        msg: (r.name || r.emp_id) + ' · ' + r.project_id + ' · ' + r.hours + 'h',
        time: r.entry_date,  key: 'ts-' + (r.id || (r.emp_id + r.entry_date)) })),
    ...(data.expenses        || []).map(r => ({ type: 'Expense',    color: '#f59e0b', nav: 'expenses',
        msg: r.submitted_by + ' · ' + r.category,
        time: r.expense_date, key: 'ex-' + (r.id || (r.submitted_by + r.expense_date)) })),
    ...(data.attendance      || []).map(r => ({ type: 'Attendance', color: '#3b82f6', nav: 'attendance',
        msg: (r.name || r.emp_id) + ' · ' + r.att_status,
        time: r.att_date,    key: 'at-' + (r.id || (r.emp_id + r.att_date)) })),
    ...(data.access_requests || []).map(r => ({ type: 'Access',     color: '#ef4444', nav: 'approvals',
        msg: r.requester + ' → ' + r.page,
        time: '',            key: 'ac-' + (r.id || (r.requester + r.page)) })),
  ];
  // Every entry here is a still-pending approval (timesheet/expense/attendance/access request).
  // It must keep showing until an Admin/Manager actually approves or rejects it on its own page —
  // never dismissed just because the panel was opened/viewed.
  updateNotifBadge(all.length);
  if (!all.length) {
    list.innerHTML = '<div style="text-align:center;padding:32px;color:#94a3b8;font-size:13px">No notifications</div>';
    return;
  }
  list.innerHTML = all.slice(0, 15).map(n => {
    const closeAndNav = "document.getElementById('notif-panel').style.display='none';navigate&&navigate('" + n.nav + "')";
    return '<div style="padding:11px 14px;border-bottom:1px solid #f8fafc;cursor:pointer;transition:background .15s" ' +
      'onmouseenter="this.style.background=\'#f8fafc\'" onmouseleave="this.style.background=\'\'" ' +
      'onclick="' + closeAndNav + '">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">' +
        '<span style="background:' + n.color + '20;color:' + n.color + ';padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600">' + n.type + '</span>' +
        (n.time ? '<span style="color:#94a3b8;font-size:10px">' + date(n.time) + '</span>' : '') +
      '</div>' +
      '<div style="font-size:13px;color:#334155">' + n.msg + '</div>' +
      '</div>';
  }).join('');
}
