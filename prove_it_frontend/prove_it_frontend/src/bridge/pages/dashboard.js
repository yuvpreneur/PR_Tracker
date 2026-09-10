import { get } from '../core/http.js';
import { state } from '../core/state.js';
import { date, num, badge, statCard, activeRole } from '../shared/ui.js';
import { updateNotifBadge } from '../shared/notifications.js';

let cachedMe = null;
async function currentUser() {
  if (cachedMe) return cachedMe;
  cachedMe = await get('/api/auth/me').catch(() => null);
  return cachedMe;
}

// ── Interactive bar chart ─────────────────────────────────────────────────────
export function lineChart(monthlyData, containerId) {
  const el = document.getElementById(containerId || 'bar-chart-1');
  if (!el || !monthlyData || !monthlyData.length) return;

  const MTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const W = 540, H = 210;
  const PAD = { t: 20, r: 20, b: 44, l: 68 };
  const CW = W - PAD.l - PAD.r;
  const CH = H - PAD.t - PAD.b;
  const n  = monthlyData.length;

  const rev  = monthlyData.map(d => d.revenue || 0);
  const cost = monthlyData.map(d => d.cost    || 0);
  const maxV = Math.max(...rev, ...cost, 1);

  const mag     = Math.pow(10, Math.floor(Math.log10(maxV)));
  const niceMax = Math.ceil(maxV / mag) * mag || 1;

  const fmt = v =>
      v >= 1e7 ? '₹' + (v / 1e7).toFixed(2) + ' Cr'
    : v >= 1e5 ? '₹' + (v / 1e5).toFixed(2) + ' L'
    : v >= 1e3 ? '₹' + (v / 1e3).toFixed(1) + ' K'
    : '₹' + Math.round(v);

  const yP    = v => PAD.t + CH * (1 - v / niceMax);
  const slotW = CW / n;
  const barW  = Math.max(6, Math.min(22, slotW * 0.38));
  const gap   = Math.max(3, barW * 0.3);
  const grpW  = barW * 2 + gap;
  const xGrp  = i => PAD.l + slotW * i + (slotW - grpW) / 2;

  const TICKS = 5;
  const grids = Array.from({ length: TICKS + 1 }, (_, i) => {
    const v = niceMax * i / TICKS;
    const y = yP(v);
    return `<line x1='${PAD.l}' y1='${y}' x2='${PAD.l + CW}' y2='${y}'`
         + ` stroke='${i === 0 ? '#cbd5e1' : '#e2e8f0'}' stroke-width='${i === 0 ? 1.5 : 0.7}'`
         + ` stroke-dasharray='${i > 0 ? '4,3' : ''}'/>`
         + `<text x='${PAD.l - 8}' y='${y + 4}' font-size='9' fill='#94a3b8' text-anchor='end'`
         + ` font-family='sans-serif'>${fmt(v)}</text>`;
  }).join('');

  const yLabel = `<text x='${14}' y='${PAD.t + CH / 2}' font-size='10' fill='#94a3b8'`
               + ` text-anchor='middle' font-family='sans-serif'`
               + ` transform='rotate(-90,14,${PAD.t + CH / 2})'>Amount (₹)</text>`;

  const monthLabel = d => MTHS[(d.month || 1) - 1] + (d.year ? `'${String(d.year).slice(-2)}` : '');

  const xlabels = monthlyData.map((d, i) =>
      `<text x='${xGrp(i) + grpW / 2}' y='${PAD.t + CH + 18}'`
    + ` font-size='9' fill='#64748b' text-anchor='middle' font-family='sans-serif'>${monthLabel(d)}</text>`
  ).join('');

  const xLabel = `<text x='${PAD.l + CW / 2}' y='${H - 3}' font-size='10' fill='#94a3b8'`
               + ` text-anchor='middle' font-family='sans-serif'>Month</text>`;

  const ttId = (containerId || 'bar-chart-1') + '-tt';

  const makeBar = (x, y, h, color, label, val_, month) => {
    const info   = month + ' | ' + label + ': ' + fmt(val_);
    const colHov = label === 'Revenue' ? '#1dc97e' : '#fbbf24';
    return `<rect x='${x}' y='${y}' width='${barW}' height='${h}' rx='3' ry='3'`
         + ` fill='${color}' cursor='pointer'`
         + ` onmouseover='(function(e){var t=document.getElementById("${ttId}");t.textContent="${info}";t.style.display="block";t.style.left=(e.pageX+12)+"px";t.style.top=(e.pageY-36)+"px";e.target.setAttribute("fill","${colHov}");})(event)'`
         + ` onmousemove='(function(e){var t=document.getElementById("${ttId}");t.style.left=(e.pageX+12)+"px";t.style.top=(e.pageY-36)+"px";})(event)'`
         + ` onmouseout='(function(e){document.getElementById("${ttId}").style.display="none";e.target.setAttribute("fill","${color}");})(event)'>`
         + `<animate attributeName='height' from='0' to='${h}' dur='0.55s' fill='freeze' calcMode='spline' keySplines='0.25,0.1,0.25,1'/>`
         + `<animate attributeName='y' from='${PAD.t + CH}' to='${y}' dur='0.55s' fill='freeze' calcMode='spline' keySplines='0.25,0.1,0.25,1'/>`
         + `</rect>`;
  };

  const bars = monthlyData.map((d, i) => {
    const rv = rev[i], co = cost[i];
    const rh = rv ? Math.max(3, CH * rv / niceMax) : 0;
    const ch = co ? Math.max(3, CH * co / niceMax) : 0;
    const bx = xGrp(i);
    const lbl = monthLabel(d);
    return makeBar(bx, yP(rv), rh, '#16A36C', 'Revenue', rv, lbl)
         + makeBar(bx + barW + gap, yP(co), ch, '#F59E0B', 'Cost', co, lbl);
  }).join('');

  const legend =
      `<div style='display:flex;gap:20px;margin-top:10px;padding-left:${PAD.l}px'>`
    + `<div style='display:flex;align-items:center;gap:6px;font-size:11px;color:#64748b'><div style='width:12px;height:12px;border-radius:3px;background:#16A36C'></div>Revenue</div>`
    + `<div style='display:flex;align-items:center;gap:6px;font-size:11px;color:#64748b'><div style='width:12px;height:12px;border-radius:3px;background:#F59E0B'></div>Cost</div>`
    + `</div>`;

  el.style.cssText = 'display:block;padding:0;position:relative;';
  el.innerHTML =
      `<div id='${ttId}' style='display:none;position:fixed;z-index:9999;background:#1e293b;color:#f1f5f9;font-size:12px;font-family:sans-serif;padding:6px 11px;border-radius:7px;pointer-events:none;white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,.35);border:1px solid #334155'></div>`
    + `<svg width='100%' viewBox='0 0 ${W} ${H}' style='overflow:visible;display:block'><defs></defs>${grids}${yLabel}${xlabels}${xLabel}${bars}</svg>`
    + legend;
}

// ── Project rows for dashboard overview ───────────────────────────────────────
// Exported so the React DashboardPage can reuse this string-builder directly
// (framework-agnostic, no DOM writes of its own) instead of reimplementing the
// same progress-bar-row markup. filterRole's USER_ACCESS-based scoping for
// non-admin/finance roles is legacy dead code (USER_ACCESS no longer exists —
// real project scoping now lives in the Access Control module) and silently
// no-ops via the try/catch, same as it currently would if this ran at all.
export function projRows(profitData, filterRole) {
  let rows = profitData || [];
  try {
    if (filterRole && filterRole !== 'admin' && filterRole !== 'finance') {
      const ua = typeof USER_ACCESS !== 'undefined' ? USER_ACCESS : null;
      if (ua && ua[filterRole] && ua[filterRole].projects !== 'all') {
        const allowed = ua[filterRole].projects;
        rows = rows.filter(p => allowed.some(a =>
          (p.project_name || '').toLowerCase().includes(a.toLowerCase()) || String(p.project_id) === String(a)
        ));
      }
    }
  } catch (_) {}
  if (!rows.length) return `<div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px">No projects for this view</div>`;
  return rows.slice(0, 6).map(p => {
    const pct = p.status === 'Completed' ? 100 : p.status === 'Not Started' ? 0 :
      (p.revenue_received > 0 ? Math.min(94, Math.round(p.revenue_received / Math.max(p.total_cost || 1, 1) * 100)) : 8);
    const barColor = pct >= 80 ? '#16A36C' : pct >= 40 ? '#0086AD' : '#94a3b8';
    const pc = p.gross_profit >= 0 ? '#0086AD' : '#E14D56';
    return `<div class="proj-row">` +
      `<div style="flex:2"><div style="font-weight:600;margin-bottom:5px">${p.project_name || p.project_id}</div>` +
      `<div class="progress"><div class="progress-bar" style="width:${pct}%;background:${barColor}"></div></div>` +
      `<div style="color:#7C92A1;font-size:11px;margin-top:3px">${pct}% · ${p.client || '—'}</div></div>` +
      `<div style="flex:1;text-align:right"><div style="color:#16A36C;font-weight:600">₹${num(p.revenue_received)}</div><div style="color:#7C92A1;font-size:11px">Revenue</div></div>` +
      `<div style="flex:1;text-align:right"><div style="color:#F59E0B;font-weight:600">₹${num(p.total_cost)}</div><div style="color:#7C92A1;font-size:11px">Cost</div></div>` +
      `<div style="flex:1;text-align:right"><div style="color:${pc};font-weight:600">₹${num(Math.abs(p.gross_profit))}</div><div style="color:#7C92A1;font-size:11px">Profit</div></div>` +
      badge(p.status) +
    `</div>`;
  }).join('');
}

// ── Role-specific dashboard renderers ─────────────────────────────────────────
function dashAdmin(data, monthly, profit) {
  const { financials: f = {}, timesheets: ts = {}, projects: pr = {}, pending_approvals: pa = 0 } = data;
  const rev = f.total_revenue_received || 0, exp = f.total_approved_expenses || 0;
  const net = f.net_profit ?? (rev - exp);
  const margin = rev > 0 ? ((net / rev) * 100).toFixed(1) : '0.0';
  const bHrs = ts.billable_hours || 0, tHrs = ts.approved_hours || 0;
  const nbHrs = Math.max(0, tHrs - bHrs), bPct = tHrs > 0 ? Math.round(bHrs / tHrs * 100) : 0;

  const content = document.getElementById('dash-content');
  if (!content) return;
  content.innerHTML =
    `<div class="stats-row">` +
      statCard('Total Revenue',     '₹' + num(rev), (pr.in_progress || 0) + ' active projects', '#16A36C') +
      statCard('Total Expenses',    '₹' + num(exp), (pr.in_progress || 0) + ' projects active', '#F59E0B') +
      statCard('Net Profit',        '₹' + num(Math.abs(net)), 'Margin ' + margin + '%' + (net < 0 ? ' (loss)' : ''), '#0086AD') +
      statCard('Pending Approvals', String(pa), (ts.pending || 0) + ' timesheets pending', '#E14D56') +
    `</div>` +
    `<div class="grid-2" style="margin-bottom:16px">` +
      `<div class="card"><div class="card-section-title">Monthly Revenue vs Cost</div><div id="bar-chart-1" class="bar-chart"></div></div>` +
      `<div class="card"><div class="card-section-title">Billable vs Non-Billable Hours</div>` +
        `<div style="display:flex;gap:10px;margin-bottom:16px">` +
          `<div style="flex:1;text-align:center"><div style="color:#16A36C;font-size:28px;font-weight:700">${bHrs.toLocaleString('en-IN')}</div><div style="color:#7C92A1;font-size:11px">Billable hrs</div></div>` +
          `<div style="flex:1;text-align:center"><div style="color:#F59E0B;font-size:28px;font-weight:700">${nbHrs.toLocaleString('en-IN')}</div><div style="color:#7C92A1;font-size:11px">Non-billable hrs</div></div>` +
        `</div>` +
        `<div class="progress"><div class="progress-bar" id="dash-billable-bar" style="width:${bPct}%;background:#16A36C"></div></div>` +
        `<div style="color:#7C92A1;font-size:11px;margin-top:6px">${bPct}% billable utilisation</div>` +
      `</div>` +
    `</div>` +
    `<div class="card"><div class="card-section-title">Project Overview — All Projects</div><div id="dash-proj-overview"></div></div>`;

  lineChart(monthly, 'bar-chart-1');
  document.getElementById('dash-proj-overview').innerHTML = projRows(profit, 'admin');
}

function dashManager(data, monthly, profit, utilData) {
  const { timesheets: ts = {}, projects: pr = {}, pending_approvals: pa = 0 } = data;
  const bHrs = ts.billable_hours || 0, tHrs = ts.approved_hours || 0;
  const bPct = tHrs > 0 ? Math.round(bHrs / tHrs * 100) : 0;
  const topUtil = (utilData || []).slice(0, 5);

  const content = document.getElementById('dash-content');
  if (!content) return;
  content.innerHTML =
    `<div class="stats-row">` +
      statCard('Active Projects',   String(pr.in_progress || 0), (pr.total || 0) + ' total projects', '#0086AD') +
      statCard('Approved Hours',    tHrs.toLocaleString('en-IN') + 'h', 'Across all team members', '#16A36C') +
      statCard('Team Utilisation',  bPct + '%', bHrs + 'h billable of ' + tHrs + 'h total', '#7357E5') +
      statCard('Pending Approvals', String(pa), (ts.pending || 0) + ' timesheets awaiting', '#E14D56') +
    `</div>` +
    `<div class="grid-2" style="margin-bottom:16px">` +
      `<div class="card"><div class="card-section-title">Monthly Revenue vs Cost</div><div id="bar-chart-1" class="bar-chart"></div></div>` +
      `<div class="card"><div class="card-section-title">Team Utilisation by Member</div>` +
        (topUtil.length ? topUtil.map(e =>
          `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">` +
            `<div style="width:90px;font-size:12px;font-weight:500;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.name}</div>` +
            `<div style="flex:1"><div class="progress"><div class="progress-bar" style="width:${e.utilization_pct}%;background:${e.utilization_pct >= 80 ? '#16A36C' : e.utilization_pct >= 50 ? '#0086AD' : '#F59E0B'}"></div></div></div>` +
            `<div style="font-size:12px;color:#7C92A1;width:36px;text-align:right">${e.utilization_pct}%</div>` +
          `</div>`
        ).join('') : '<div style="color:#94a3b8;font-size:13px;text-align:center;padding:16px">No utilisation data</div>') +
      `</div>` +
    `</div>` +
    `<div class="card"><div class="card-section-title">My Projects</div><div id="dash-proj-overview"></div></div>`;

  lineChart(monthly, 'bar-chart-1');
  document.getElementById('dash-proj-overview').innerHTML = projRows(profit, 'manager');
}

async function dashEmployee(data, period) {
  const content = document.getElementById('dash-content');
  if (!content) return;

  const me = await currentUser();
  const empIds = (Array.isArray(state.employees) ? state.employees : []).filter(e => e.name === me?.name).map(e => e.emp_id);

  const [myTsRows, allExpenses, allTickets] = await Promise.all([
    Promise.all(empIds.map(id => get('/api/timesheets?emp_id=' + id).catch(() => []))).then(rs => rs.flat()),
    get('/api/expenses').catch(() => []),
    get('/api/tickets').catch(() => []),
  ]);

  const myExpRows = (allExpenses || []).filter(r => r.submitted_by === me?.name);
  const myTixRows = (allTickets  || []).filter(r => r.requester === me?.name);

  const myHrs     = myTsRows.reduce((s, r) => s + (r.hours || 0), 0);
  const myExpAmt  = myExpRows.reduce((s, r) => s + (r.amount || 0), 0);
  const pendingTs = myTsRows.filter(r => r.status === 'Pending').length;
  const openTix   = myTixRows.filter(r => ['Open', 'In Progress'].includes(r.status)).length;

  content.innerHTML =
    `<div class="stats-row">` +
      statCard('My Hours (All Time)', myHrs + 'h', myTsRows.filter(r => r.billable).reduce((s, r) => s + (r.hours || 0), 0) + 'h billable', '#16A36C') +
      statCard('My Expenses',         '₹' + num(myExpAmt), myExpRows.length + ' submissions', '#F59E0B') +
      statCard('Pending Approvals',   String(pendingTs), 'timesheets awaiting review', '#7357E5') +
      statCard('Open Tickets',        String(openTix), myTixRows.length + ' raised total', '#0086AD') +
    `</div>` +
    `<div class="grid-2" style="margin-bottom:16px">` +
      `<div class="card"><div class="card-section-title">My Recent Timesheets</div>` +
        (myTsRows.length ? `<table style="width:100%;font-size:12px;border-collapse:collapse">` +
          `<thead><tr style="color:#7C92A1;font-size:11px"><th style="text-align:left;padding:6px 8px;border-bottom:1px solid #f1f5f9">Date</th><th style="text-align:left;padding:6px 8px;border-bottom:1px solid #f1f5f9">Project</th><th style="text-align:right;padding:6px 8px;border-bottom:1px solid #f1f5f9">Hours</th><th style="text-align:center;padding:6px 8px;border-bottom:1px solid #f1f5f9">Status</th></tr></thead><tbody>` +
          myTsRows.slice(0, 6).map(r =>
            `<tr style="border-bottom:1px solid #f8fafc"><td style="padding:7px 8px">${date(r.entry_date)}</td><td style="padding:7px 8px">${r.project_id}</td><td style="padding:7px 8px;text-align:right;font-weight:600">${r.hours}h</td><td style="padding:7px 8px;text-align:center">${badge(r.status)}</td></tr>`
          ).join('') + `</tbody></table>`
        : '<div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px">No timesheets found</div>') +
      `</div>` +
      `<div class="card"><div class="card-section-title">My Expenses</div>` +
        (myExpRows.length ? `<table style="width:100%;font-size:12px;border-collapse:collapse">` +
          `<thead><tr style="color:#7C92A1;font-size:11px"><th style="text-align:left;padding:6px 8px;border-bottom:1px solid #f1f5f9">Date</th><th style="text-align:left;padding:6px 8px;border-bottom:1px solid #f1f5f9">Category</th><th style="text-align:right;padding:6px 8px;border-bottom:1px solid #f1f5f9">Amount</th><th style="text-align:center;padding:6px 8px;border-bottom:1px solid #f1f5f9">Status</th></tr></thead><tbody>` +
          myExpRows.slice(0, 6).map(r =>
            `<tr style="border-bottom:1px solid #f8fafc"><td style="padding:7px 8px">${date(r.expense_date)}</td><td style="padding:7px 8px">${r.category}</td><td style="padding:7px 8px;text-align:right;font-weight:600">₹${num(r.amount)}</td><td style="padding:7px 8px;text-align:center">${badge(r.status)}</td></tr>`
          ).join('') + `</tbody></table>`
        : '<div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px">No expenses found</div>') +
      `</div>` +
    `</div>`;
}

function dashFinance(data, monthly, profit) {
  const { financials: f = {}, pending_approvals: pa = 0 } = data;
  const billed = f.total_revenue_billed || 0, received = f.total_revenue_received || 0;
  const outstanding = f.outstanding || 0, expenses = f.total_approved_expenses || 0;

  const content = document.getElementById('dash-content');
  if (!content) return;
  content.innerHTML =
    `<div class="stats-row">` +
      statCard('Total Billed',   '₹' + num(billed),      'Invoice amounts raised', '#0086AD') +
      statCard('Total Received', '₹' + num(received),    'Cash collected', '#16A36C') +
      statCard('Outstanding',    '₹' + num(outstanding), 'Unpaid balance', '#E14D56') +
      statCard('Total Expenses', '₹' + num(expenses),    'Approved expenses', '#F59E0B') +
    `</div>` +
    `<div class="grid-2" style="margin-bottom:16px">` +
      `<div class="card"><div class="card-section-title">Monthly Revenue vs Cost</div><div id="bar-chart-1" class="bar-chart"></div></div>` +
      `<div class="card"><div class="card-section-title">Revenue Collection Summary</div>` +
        `<div style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px"><span style="color:#7C92A1">Collection Rate</span><span style="font-weight:600;color:#334155">${billed > 0 ? Math.round(received / billed * 100) : 0}%</span></div><div class="progress"><div class="progress-bar" style="width:${billed > 0 ? Math.round(received / billed * 100) : 0}%;background:#16A36C"></div></div></div>` +
        `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">` +
          `<div style="background:#f8fafc;border-radius:8px;padding:12px;text-align:center"><div style="font-size:11px;color:#7C92A1;margin-bottom:4px">Billed</div><div style="font-weight:700;color:#0086AD">₹${num(billed)}</div></div>` +
          `<div style="background:#f8fafc;border-radius:8px;padding:12px;text-align:center"><div style="font-size:11px;color:#7C92A1;margin-bottom:4px">Received</div><div style="font-weight:700;color:#16A36C">₹${num(received)}</div></div>` +
          `<div style="background:#f8fafc;border-radius:8px;padding:12px;text-align:center"><div style="font-size:11px;color:#7C92A1;margin-bottom:4px">Outstanding</div><div style="font-weight:700;color:#E14D56">₹${num(outstanding)}</div></div>` +
          `<div style="background:#f8fafc;border-radius:8px;padding:12px;text-align:center"><div style="font-size:11px;color:#7C92A1;margin-bottom:4px">Expenses</div><div style="font-weight:700;color:#F59E0B">₹${num(expenses)}</div></div>` +
        `</div>` +
      `</div>` +
    `</div>` +
    `<div class="card"><div class="card-section-title">Project Profitability</div><div id="dash-proj-overview"></div></div>`;

  lineChart(monthly, 'bar-chart-1');
  document.getElementById('dash-proj-overview').innerHTML = projRows(profit, 'finance');
}

// ── Main dashboard loader ─────────────────────────────────────────────────────
export async function loadDashboard() {
  const period = document.getElementById('dash-period')?.value || 'last_month';
  const role   = activeRole();

  if (role === 'employee') { await dashEmployee(null, period); return; }

  const fetches = [
    get('/api/reports/dashboard?period=' + period).catch(() => null),
    get('/api/reports/monthly-revenue?period=' + period).catch(() => null),
    get('/api/reports/project-profitability').catch(() => null),
  ];
  if (role === 'manager') fetches.push(get('/api/reports/employee-utilization').catch(() => null));

  const [data, monthly, profit, utilData] = await Promise.all(fetches);
  if (!data) return;
  updateNotifBadge(data.pending_approvals || 0);

  if (role === 'manager')      dashManager(data, monthly, profit, utilData);
  else if (role === 'finance') dashFinance(data, monthly, profit);
  else                         dashAdmin(data, monthly, profit);
}
