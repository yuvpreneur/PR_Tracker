import { get, qs } from '../core/http.js';
import { state } from '../core/state.js';
import { badge, date, periodRange } from '../shared/ui.js';
import { renderTable, approveBtns, isReactOwned } from '../shared/table.js';
import { field } from '../shared/modals.js';
import { can, isMine, noActionsColumn } from '../shared/permissions.js';

function attRowGuard(row) {
  const mine = isMine(row, 'name');
  const pending = row.approval_status === 'Pending';
  return { noEdit: !(can('Attendance', 'edit') || (mine && pending)) };
}

function populateAttendanceEmployeeDropdown() {
  const sel = field('modal-attendance', 'employee');
  if (!sel || sel.tagName !== 'SELECT') return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">Select Employee</option>' +
    state.employees.map(e => `<option value="${e.emp_id}">${e.emp_id} - ${e.name}</option>`).join('');
  if (prev) sel.value = prev;
}

// Total Hours is derived, not picked — Check In/Check Out are 30-min-increment shift
// times (09:30-18:00), so their difference always lands on the same 30-min grid.
function computeTotalHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return '';
  const [ih, im] = checkIn.split(':').map(Number);
  const [oh, om] = checkOut.split(':').map(Number);
  const diff = (oh * 60 + om) - (ih * 60 + im);
  return diff > 0 ? String(diff / 60) : '';
}

function wireAttendanceTimeAutoCalc() {
  const checkInSel = field('modal-attendance', 'check in');
  const checkOutSel = field('modal-attendance', 'check out');
  const totalSel = field('modal-attendance', 'total hours');
  if (!checkInSel || !checkOutSel || !totalSel || checkInSel._autoCalcWired) return;
  checkInSel._autoCalcWired = true;
  const recompute = () => { totalSel.value = computeTotalHours(checkInSel.value, checkOutSel.value); };
  checkInSel.addEventListener('change', recompute);
  checkOutSel.addEventListener('change', recompute);
}

export async function loadAttendance() {
  const period = document.getElementById('att-period')?.value || 'today';
  const range  = periodRange(period);
  const params = { ...state.pf['page-attendance'], ...range };
  delete params.att_date;

  const rows = await get('/api/attendance' + qs(params)).catch(() => []);
  state.attendance = rows;
  populateAttendanceEmployeeDropdown();
  wireAttendanceTimeAutoCalc();

  const present = rows.filter(r => r.att_status === 'Present' || r.att_status === 'WFH').length;
  const absent  = rows.filter(r => r.att_status === 'Absent').length;
  const pending = rows.filter(r => r.approval_status === 'Pending').length;
  const wfh     = rows.filter(r => r.att_status === 'WFH').length;

  const labelSuffix = { today: ' Today', this_week: ' This Week', this_month: ' This Month' }[period] || '';

  const elPresent = document.getElementById('att-stat-present');
  const elAbsent  = document.getElementById('att-stat-absent');
  const elPending = document.getElementById('att-stat-pending');
  if (elPresent) elPresent.textContent = present;
  if (elAbsent)  elAbsent.textContent  = absent;
  if (elPending) elPending.textContent = pending;

  const labelOf = id => document.getElementById(id)?.closest('.stat-card')?.querySelector('.stat-label');
  const lPresent = labelOf('att-stat-present');
  const lAbsent  = labelOf('att-stat-absent');
  const lPending = labelOf('att-stat-pending');
  if (lPresent) lPresent.textContent = 'Present' + labelSuffix + (wfh ? ` (incl. ${wfh} WFH)` : '');
  if (lAbsent)  lAbsent.textContent  = 'Absent'  + labelSuffix;
  if (lPending) lPending.textContent = 'Pending Approval' + labelSuffix;

  populateAttStatusDropdown(rows);

  renderTable('page-attendance', rows, [
    { k: 'emp_id',          fn: r => `<strong>${r.emp_id}</strong>` },
    { k: 'name',            fn: r => r.name || r.emp_id },
    { k: 'att_date',        fn: r => date(r.att_date) },
    { k: 'check_in',        fn: r => r.check_in  || '—' },
    { k: 'check_out',       fn: r => r.check_out || '—' },
    { k: 'total_hours',     fn: r => `${r.total_hours || 0}h` },
    { k: 'att_status',      fn: r => badge(r.att_status) },
    { k: 'approval_status', fn: r => badge(r.approval_status) },
  ], r => r.id, approveBtns('Attendance', 'name'), null, {
    noDelete: true, rowGuard: attRowGuard, hideActionsColumn: noActionsColumn('attendance'),
  });
  // Lets the React-based AttendancePage (mounted as a portal into #page-attendance)
  // know to refetch — it doesn't read this legacy render pipeline's output directly.
  document.dispatchEvent(new CustomEvent('attendance:changed'));
}

function populateAttStatusDropdown(rows) {
  const page = document.getElementById('page-attendance');
  if (!page) return;
  const base     = ['Present', 'Absent', 'WFH', 'Late', 'Half Day', 'On Leave'];
  const inData   = [...new Set((rows || []).map(r => r.att_status).filter(Boolean))];
  const statuses = [...new Set([...base, ...inData])].sort();
  page.querySelectorAll('select').forEach(sel => {
    if (sel.id === 'att-period') return;
    if (sel.closest('[id^="modal"]') || sel.closest('.modal')) return;
    // AttendancePage.jsx (React) owns #page-attendance now, including its own
    // Status filter select — don't clobber it (see isReactOwned() in shared/table.js).
    if (isReactOwned(sel)) return;
    if (!(sel.options[0]?.text || '').toLowerCase().includes('all status')) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="">All Status</option>' +
      statuses.map(s => `<option value="${s}">${s}</option>`).join('');
    if (prev && prev !== 'All Status') sel.value = prev;
  });
}
