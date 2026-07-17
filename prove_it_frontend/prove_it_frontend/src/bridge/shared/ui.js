// Formatting helpers, toast, badge — no HTTP dependencies

export function toast(msg, type = 'success') {
  const bg = { success: '#22c55e', error: '#ef4444', info: '#3b82f6' }[type] || '#3b82f6';
  const el = Object.assign(document.createElement('div'), {
    textContent: msg,
    style: `position:fixed;top:24px;right:24px;z-index:99999;padding:12px 22px;border-radius:10px;` +
           `font-size:14px;font-weight:500;color:#fff;background:${bg};` +
           `box-shadow:0 4px 24px rgba(0,0,0,.18);pointer-events:none;` +
           `max-width:380px;white-space:normal;line-height:1.45;`,
  });
  document.body.appendChild(el);
  // Longer messages (e.g. detailed validation errors) get more time on screen to read.
  const duration = Math.min(7000, Math.max(3500, msg.length * 60));
  setTimeout(() => el.remove(), duration);
}

export const date = d => d ? String(d).slice(0, 10) : '—';

export const num = n => {
  if (!n) return '0';
  if (n >= 10000000) return (n / 10000000).toFixed(1) + 'Cr';
  if (n >= 100000)   return (n / 100000).toFixed(1)   + 'L';
  if (n >= 1000)     return (n / 1000).toFixed(1)     + 'K';
  return String(Math.round(n));
};

export function badge(s, extra = {}) {
  const c = {
    Active: '#22c55e', Inactive: '#94a3b8', Pending: '#f59e0b', Approved: '#22c55e',
    Rejected: '#ef4444', Open: '#3b82f6', 'In Progress': '#8b5cf6', Resolved: '#22c55e',
    Closed: '#94a3b8', Cancelled: '#ef4444', 'Won / Project': '#22c55e', 'Lost / Cold': '#ef4444',
    New: '#3b82f6', Contacted: '#8b5cf6', Qualified: '#f59e0b', Proposal: '#f97316',
    Billable: '#22c55e', 'Non-Billable': '#94a3b8', High: '#ef4444', Critical: '#7c2222',
    Medium: '#f59e0b', Low: '#22c55e', 'T&M': '#8b5cf6', Fixed: '#3b82f6',
    Milestone: '#f97316', Present: '#22c55e', Absent: '#ef4444', WFH: '#3b82f6',
    Paid: '#22c55e', Partial: '#f59e0b', Overdue: '#ef4444', 'Not Started': '#94a3b8',
    Completed: '#22c55e', 'On Hold': '#f59e0b', 'Waiting Approval': '#f97316',
    ...extra,
  }[s] || '#64748b';
  return `<span style="background:${c}20;color:${c};padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap">${s || '—'}</span>`;
}

export function setText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}

const ROLE_KEY_MAP = { Admin: 'admin', Manager: 'manager', 'Finance User': 'finance', Employee: 'employee' };

export function activeRole() {
  try {
    const payload = JSON.parse(atob(localStorage.getItem('token').split('.')[1]));
    return ROLE_KEY_MAP[payload.role] || 'admin';
  } catch { return 'admin'; }
}

export function statCard(label, value, sub, color) {
  return `<div class="stat-card">` +
    `<div class="stat-label">${label}</div>` +
    `<div class="stat-value" style="color:${color}">${value}</div>` +
    `<div class="stat-sub">${sub}</div>` +
  `</div>`;
}

// Generic period -> {date_from, date_to} — used by attendance, audit, timesheets
export function periodRange(period) {
  const today = new Date();
  const fmt = d => d.toISOString().slice(0, 10);
  if (period === 'today' || !period) {
    const t = fmt(today); return { date_from: t, date_to: t };
  }
  if (period === 'this_week') {
    const dow = today.getDay();
    const mon = new Date(today); mon.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
    const sun = new Date(mon);   sun.setDate(mon.getDate() + 6);
    return { date_from: fmt(mon), date_to: fmt(sun) };
  }
  if (period === 'last_week') {
    const dow = today.getDay();
    const mon = new Date(today); mon.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) - 7);
    const sun = new Date(mon);   sun.setDate(mon.getDate() + 6);
    return { date_from: fmt(mon), date_to: fmt(sun) };
  }
  if (period === 'this_month') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    const to   = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { date_from: fmt(from), date_to: fmt(to) };
  }
  if (period === 'last_month') {
    const to   = new Date(today.getFullYear(), today.getMonth(), 0);
    const from = new Date(to.getFullYear(), to.getMonth(), 1);
    return { date_from: fmt(from), date_to: fmt(to) };
  }
  if (period === 'q1_2026')    return { date_from: '2026-01-01', date_to: '2026-03-31' };
  if (period === 'fy_2025_26') return { date_from: '2025-04-01', date_to: '2026-03-31' };
  return {};
}
