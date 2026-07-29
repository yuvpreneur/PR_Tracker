import { get, post } from '../core/http.js';
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

// Legacy page id each personal notification navigates to on click.
const NAV_BY_MODULE = {
  Timesheets: 'timesheets', Expenses: 'expenses',
  Leave: 'leave', 'Access Control': 'dashboard',
};

// Two independent sources, two different audiences:
//  - "pending" = still-Pending items across every request-driven module, derived live
//    from each module's own status field (app/routers/approvals.py) — the
//    Admin/Manager/Finance "needs my action" queue. It needs no read/unread state: an
//    item keeps showing until someone actually approves/rejects it (self-correcting),
//    and vanishes for everyone the instant that happens, not just for whoever looked.
//  - "personal" = this user's own submitted requests that were just decided
//    (GET /api/notifications/) — the "what happened to my request" feed. This one DOES
//    need persisted read/unread state, since "have I seen this decision yet" isn't
//    derivable from the request's status alone.
async function fetchAll() {
  const [pendingData, personal] = await Promise.all([
    get('/api/approvals/pending').catch(() => null),
    get('/api/notifications/').catch(() => []),
  ]);

  const pendingItems = pendingData ? [
    ...(pendingData.timesheets      || []).map(r => ({ type: 'Timesheet',  color: '#8b5cf6', nav: 'timesheets',
        msg: (r.name || r.emp_id) + ' · ' + r.project_id + ' · ' + r.hours + 'h',
        time: r.entry_date,  key: 'ts-' + (r.id || (r.emp_id + r.entry_date)) })),
    ...(pendingData.expenses        || []).map(r => ({ type: 'Expense',    color: '#f59e0b', nav: 'expenses',
        msg: r.submitted_by + ' · ' + r.category,
        time: r.expense_date, key: 'ex-' + (r.id || (r.submitted_by + r.expense_date)) })),
    ...(pendingData.leave           || []).map(r => ({ type: 'Leave',      color: '#0ea5e9', nav: 'leave',
        msg: r.name + ' · ' + r.leave_type + ' · ' + r.days + 'd',
        time: r.from_date,   key: 'lv-' + (r.id || (r.emp_id + r.from_date)) })),
    ...(pendingData.access_requests || []).map(r => ({ type: 'Access',     color: '#ef4444', nav: 'access-control',
        msg: r.requester + ' → ' + r.page,
        time: '',            key: 'ac-' + (r.id || (r.requester + r.page)) })),
  ] : [];

  const personalItems = (personal || []).map(n => ({
    type: n.status === 'Approved' ? n.module + ' approved' : n.module + ' rejected',
    color: n.status === 'Approved' ? '#16a34a' : '#ef4444',
    nav: NAV_BY_MODULE[n.module] || 'dashboard',
    msg: n.message,
    time: n.created_at,
    key: 'pn-' + n.id,
  }));

  // Personal items first — a decision on your own request is more relevant to you than
  // someone else's item still waiting on your action.
  return { pendingItems, personalItems, all: [...personalItems, ...pendingItems] };
}

// Badge-only refresh — safe to call anytime (app init, dashboard load, ...) without
// disturbing personal-notification read state. Callers that used to compute their own
// badge count from a single source (e.g. `pending_approvals`) should call this instead,
// so the badge always reflects both sources together.
export async function refreshNotifBadge() {
  const { all } = await fetchAll();
  updateNotifBadge(all.length);
}

// Timesheets/Leave each have a "my records" page a non-Admin/Manager can visit — called
// once when that page mounts, so seeing your own entry there is what dismisses its
// approved/rejected notification, rather than requiring a trip to the bell. Access Control
// and Expenses have no such page-mount trigger (Expenses used to have one, but that meant
// an employee simply checking their own expense list — the single most natural way to look
// for an approval — would silently dismiss the notification before they ever opened the
// bell to read it); both are only dismissed via loadNotifications()'s bell-open handling
// below, which requires the bell to have actually been opened first.
export async function markModuleNotificationsRead(module) {
  await post('/api/notifications/read-by-module', { module }).catch(() => {});
  refreshNotifBadge();
}

export async function loadNotifications(markPersonalRead = false) {
  ensureNotifPanel();
  const list = document.getElementById('notif-list');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px">Loading…</div>';

  const { personalItems, all } = await fetchAll();
  updateNotifBadge(all.length);
  if (!all.length) {
    list.innerHTML = '<div style="text-align:center;padding:32px;color:#94a3b8;font-size:13px">No notifications</div>';
  } else {
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

  // Opening the panel dismisses Access Control's and Expenses' personal notifications —
  // the two modules with no page-mount trigger to dismiss them instead (see
  // markModuleNotificationsRead() above, which handles Timesheets/Leave on their own
  // pages). Pending items are untouched by this either way (see fetchAll()).
  if (markPersonalRead) {
    for (const module of ['Access Control', 'Expenses']) {
      if (personalItems.some(n => n.type.startsWith(module))) {
        post('/api/notifications/read-by-module', { module }).catch(() => {});
      }
    }
  }
}
