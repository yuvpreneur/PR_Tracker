import { get, patch, qs } from '../core/http.js';
import { state } from '../core/state.js';
import { badge, date, num, statCard, toast } from '../shared/ui.js';
import { renderTable, isReactOwned } from '../shared/table.js';
import { refreshCaches } from '../core/cache.js';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { can, noActionsColumn } from '../shared/permissions.js';

export async function loadProjects() {
  const rows = await get('/api/projects' + qs(state.pf['page-projects'])).catch(() => []);
  if (rows.length) {
    state.projects = rows;
    populateClientsDropdown();
  }
  state.currentProjectRows = rows;
  populateManagerDropdown();
  populateProjectClientDropdown();
  renderProjectStats();
  renderTable('page-projects', rows, [
    { k: 'id',         fn: r => `<strong>${r.id}</strong>` },
    { k: 'name' },
    { k: 'client' },
    { k: 'manager' },
    { k: 'start_date', fn: r => date(r.start_date) },
    { k: 'end_date',   fn: r => date(r.end_date) },
    { k: 'status',     fn: r => badge(r.status) },
  ], r => r.id, () => '', null, {
    noEdit: !can('Projects', 'edit'), noDelete: !can('Projects', 'delete'),
    hideActionsColumn: noActionsColumn('projects'),
  });
  wireProjectExport();
  // Lets the React-based ProjectsPage (mounted as a portal into #page-projects)
  // know to refetch — it doesn't read this legacy render pipeline's output directly.
  document.dispatchEvent(new CustomEvent('projects:changed'));
}

async function renderProjectStats() {
  const el = document.getElementById('proj-stats');
  if (!el) return;
  const s = await get('/api/projects/summary').catch(() => null);
  if (!s) return;
  el.innerHTML =
    statCard('Total Projects',    String(s.total || 0),      'Across all clients', '#0086AD') +
    statCard('Active Now',        String(s.in_progress || 0), 'Currently in progress', '#16A36C') +
    statCard('On Hold',           String(s.on_hold || 0),     'Awaiting resumption', '#F59E0B') +
    statCard('Portfolio Budget',  '₹' + num(s.total_budget || 0), `${s.total || 0} project${s.total === 1 ? '' : 's'} total`, '#7357E5');
}

// Union of real Companies + any client string already used on an existing project (so
// editing an older project whose client isn't a registered Company still shows correctly
// instead of silently blanking — and losing that value — when the modal is saved).
export function populateProjectClientDropdown() {
  const modal = document.getElementById('modal-project');
  if (!modal) return;
  const sel = Array.from(modal.querySelectorAll('select')).find(s => (s.options[0]?.text || '').toLowerCase().includes('select client'));
  if (!sel) return;
  const companyNames = (Array.isArray(state.companies) ? state.companies : []).map(c => c.name);
  const existingClients = (Array.isArray(state.projects) ? state.projects : []).map(p => p.client).filter(Boolean);
  const names = [...new Set([...companyNames, ...existingClients])].sort();
  const prev = sel.value;
  sel.innerHTML = '<option value="">Select Client</option>' + names.map(n => `<option value="${n}">${n}</option>`).join('');
  if (prev) sel.value = prev;
}

export function populateManagerDropdown() {
  const modal = document.getElementById('modal-project');
  if (!modal) return;
  const sel = Array.from(modal.querySelectorAll('select')).find(s => (s.options[0]?.text || '').toLowerCase().includes('select manager'));
  if (!sel) return;
  const names = [...new Set((Array.isArray(state.employees) ? state.employees : []).map(e => e.name).filter(Boolean))].sort();
  const prev = sel.value;
  sel.innerHTML = '<option value="">Select Manager</option>' + names.map(n => `<option value="${n}">${n}</option>`).join('');
  if (prev) sel.value = prev;
}

export async function populateEmployeesForAssignmentDropdown() {
  const modal = document.getElementById('modal-project');
  if (!modal) return;
  const sel = document.getElementById('project-assign-employees');
  if (!sel) return;
  try {
    const employees = await get('/api/projects/employees-for-assignment');
    if (!employees) return;
    const prev = Array.from(sel.selectedOptions).map(o => o.value);
    sel.innerHTML = '<option value="">Select Employees</option>' + employees.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
    prev.forEach(p => { if (p) sel.querySelector(`option[value="${p}"]`)?.setAttribute('selected', 'selected'); });

    if (!sel._customized) {
      createCheckboxDropdown(sel, employees);
      sel._customized = true;
    }
  } catch (err) {
    console.error('Failed to load employees for assignment:', err);
  }
}

function createCheckboxDropdown(select, employees) {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position: relative; margin-bottom: 12px; display: block; width: 100%;';
  wrapper.id = 'project-assign-employees-wrapper';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'form-control';
  button.style.cssText = 'display: flex; align-items: center; justify-content: space-between; cursor: pointer; text-align: left; width: 100%;';

  const summary = document.createElement('span');
  summary.id = 'project-assign-employees-summary';
  summary.style.cssText = 'color: #94a3b8;';

  const chevron = document.createElement('span');
  chevron.style.cssText = 'color: #94a3b8; margin-left: 8px;';
  chevron.textContent = '▼';

  button.appendChild(summary);
  button.appendChild(chevron);

  const dropdown = document.createElement('div');
  dropdown.style.cssText = 'position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 20; background: #fff; border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,.14); padding: 8px; max-height: 260px; overflow-y: auto; display: none;';

  const prev = Array.from(select.selectedOptions).map(o => o.value);
  dropdown.innerHTML = employees.map(e => `
    <label style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px; font-size: 12px; font-weight: 700; color: var(--slate); cursor: pointer; margin: 0;">
      <input type="checkbox" value="${e.id}" ${prev.includes(e.id) ? 'checked' : ''} />
      ${e.name}
    </label>
  `).join('');

  dropdown.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const option = select.querySelector(`option[value="${checkbox.value}"]`);
      if (option) option.selected = checkbox.checked;
      updateSummary();
    });
  });

  button.addEventListener('click', e => {
    e.preventDefault();
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    chevron.textContent = dropdown.style.display === 'none' ? '▼' : '▲';
  });

  if (!document._assignEmpDropdownOutsideWired) {
    document.addEventListener('click', e => {
      if (!wrapper.contains(e.target) && dropdown.style.display === 'block') {
        dropdown.style.display = 'none';
        chevron.textContent = '▼';
      }
    });
    document._assignEmpDropdownOutsideWired = true;
  }

  function updateSummary() {
    const selected = Array.from(select.selectedOptions).filter(o => o.value).length;
    const total = employees.length;
    if (selected === 0) {
      summary.textContent = 'Select Employees';
      summary.style.color = '#94a3b8';
    } else if (selected === total) {
      summary.textContent = `All ${total} employees assigned`;
      summary.style.color = 'var(--ink)';
    } else {
      summary.textContent = `${selected} employees assigned`;
      summary.style.color = 'var(--ink)';
    }
  }

  select.style.display = 'none';
  wrapper.appendChild(button);
  wrapper.appendChild(dropdown);
  select.parentNode.insertBefore(wrapper, select);
  updateSummary();
}

export function populatePCodeProjectDropdown() {
  const modal = document.getElementById('modal-pcode');
  if (!modal) return;
  const sel = Array.from(modal.querySelectorAll('select')).find(s => (s.options[0]?.text || '').toLowerCase().includes('select project'));
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">Select Project</option>' +
    state.projects.map(p => `<option value="${p.id}">${p.id} · ${p.name}</option>`).join('');
  if (prev) sel.value = prev;
}

function populateClientsDropdown() {
  const page = document.getElementById('page-projects');
  if (!page) return;
  const clients = [...new Set(state.projects.map(p => p.client).filter(Boolean))].sort();
  page.querySelectorAll('select').forEach(sel => {
    if (sel.closest('[id^="modal"]') || sel.closest('.modal')) return;
    // ProjectsPage.jsx (React) owns #page-projects now, including its own "All
    // Clients" filter select — don't clobber it (see isReactOwned() in shared/table.js).
    if (isReactOwned(sel)) return;
    if ((sel.options[0]?.text || '').toLowerCase().includes('all clients')) {
      const prev = sel.value;
      sel.innerHTML = '<option value="">All Clients</option>' +
        clients.map(c => `<option value="${c}">${c}</option>`).join('');
      if (prev && prev !== 'All Clients') sel.value = prev;
    }
  });
}

function wireProjectExport() {
  const btn  = document.getElementById('proj-export-btn');
  const menu = document.getElementById('proj-export-menu');
  if (!btn || !menu) return;

  btn.onclick = e => {
    e.stopPropagation();
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  };

  menu.querySelectorAll('.proj-export-option').forEach(opt => {
    opt.onclick = () => {
      menu.style.display = 'none';
      const fmt = opt.dataset.format;
      if (fmt === 'csv')  exportProjectsCSV(state.currentProjectRows);
      if (fmt === 'xlsx') exportProjectsXLSX(state.currentProjectRows);
      if (fmt === 'pdf')  exportProjectsPDF(state.currentProjectRows);
    };
  });

  if (!document._projExportOutsideClickWired) {
    document._projExportOutsideClickWired = true;
    document.addEventListener('click', e => {
      const m = document.getElementById('proj-export-menu');
      if (m && m.style.display !== 'none' && !m.contains(e.target) && e.target.id !== 'proj-export-btn') {
        m.style.display = 'none';
      }
    });
  }
}

const EXPORT_HEADERS = ['Project Code', 'Project Name', 'Client', 'Manager', 'Status', 'Start Date', 'End Date', 'Budget (INR)', 'Est. Revenue (INR)', 'Est. Expense (INR)'];

function exportRowsAoA(rows) {
  return rows.map(r => [
    r.id, r.name, r.client, r.manager, r.status,
    r.start_date || '', r.end_date || '',
    r.budget || 0, r.est_revenue || 0, r.est_expense || 0,
  ]);
}

function exportProjectsCSV(rows) {
  if (!rows || !rows.length) { toast('No data to export', 'info'); return; }
  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csvRows = [
    EXPORT_HEADERS.map(escape).join(','),
    ...exportRowsAoA(rows).map(row => row.map(escape).join(',')),
  ];
  const blob = new Blob([csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url,
    download: `projects_${new Date().toISOString().slice(0, 10)}.csv`,
  });
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast(`Exported ${rows.length} project${rows.length > 1 ? 's' : ''} to CSV`);
}

function exportProjectsXLSX(rows) {
  if (!rows || !rows.length) { toast('No data to export', 'info'); return; }
  const ws = XLSX.utils.aoa_to_sheet([EXPORT_HEADERS, ...exportRowsAoA(rows)]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Projects');
  XLSX.writeFile(wb, `projects_${new Date().toISOString().slice(0, 10)}.xlsx`);
  toast(`Exported ${rows.length} project${rows.length > 1 ? 's' : ''} to Excel`);
}

function exportProjectsPDF(rows) {
  if (!rows || !rows.length) { toast('No data to export', 'info'); return; }
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(14);
  doc.text('Projects', 14, 14);
  autoTable(doc, {
    head: [EXPORT_HEADERS],
    body: exportRowsAoA(rows),
    startY: 20,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [0, 134, 173] },
  });
  doc.save(`projects_${new Date().toISOString().slice(0, 10)}.pdf`);
  toast(`Exported ${rows.length} project${rows.length > 1 ? 's' : ''} to PDF`);
}

export async function loadProjectCodes() {
  const rows = await get('/api/project-codes' + qs(state.pf['page-project-codes'])).catch(() => []);
  if (rows.length) state.pcodes = rows;
  populatePCodeProjectDropdown();
  renderTable('page-project-codes', rows, [
    { k: 'code',        fn: r => `<strong>${r.code}</strong>` },
    { k: 'project_id',  fn: r => { const p = state.projects.find(x => x.id === r.project_id); return p ? `${r.project_id} · ${p.name}` : r.project_id; } },
    { k: 'description', fn: r => r.description || '—' },
    { k: 'status',      fn: r => badge(r.status) },
  ], r => r.code, () => '', null, {
    noEdit: !can('Project Codes', 'edit'), noDelete: !can('Project Codes', 'delete'),
    hideActionsColumn: noActionsColumn('project-codes'),
  });
  // Lets the React-based ProjectCodesPage (mounted as a portal into #page-project-codes)
  // know to refetch — it doesn't read this legacy render pipeline's output directly.
  document.dispatchEvent(new CustomEvent('project-codes:changed'));
}
