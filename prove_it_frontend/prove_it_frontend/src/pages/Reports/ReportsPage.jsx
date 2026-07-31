import { useEffect, useState } from 'react';
import { ChartColumn, Search, Download, FileSpreadsheet, FileType, FolderKanban, Users, Wallet, ClipboardList } from 'lucide-react';
import { REPORTS } from '../../bridge/pages/reports.js';
import { get } from '../../services/httpClient.js';
import { state } from '../../bridge/core/state.js';
import usePermissions from '../../hooks/usePermissions.js';
import SectionTitle from '../../components/ui/SectionTitle.jsx';

const CATEGORY_ICONS = { 'Project Reports': FolderKanban, 'Employee Reports': Users, 'Financial Reports': Wallet, 'Audit Reports': ClipboardList };

// Report rows keep the exact legacy classes/data-attributes (.perm-row[data-report-key],
// .report-view-btn, .report-export-wrap > .report-export-btn + .report-export-menu >
// .report-export-option[data-format]) so the existing document-level delegations —
// bridge/index.js's View/Export click handler and appScript's own export-menu
// open/close toggle — keep driving them unchanged; this page only needs to render
// matching markup and keep state.pf['page-reports']/#reports-period in sync (the
// same values openReportView()/handleReportExport()'s buildParams() already reads),
// not reimplement fetch/modal/export logic that's already correct and tested.
const CATEGORIES = [
  { title: 'Project Reports', keys: ['project-revenue', 'project-expenses', 'project-employee-cost', 'project-profitability', 'billing-code-report'] },
  { title: 'Employee Reports', keys: ['employee-hours', 'employee-cost', 'billable-nonbillable', 'timesheet-approval'] },
  { title: 'Financial Reports', keys: ['receivables-aging', 'outstanding-payments', 'expense-approval'] },
  { title: 'Audit Reports', keys: ['audit-log-report'] },
];

function ReportRow({ reportKey, exportAllowed }) {
  const cfg = REPORTS[reportKey];
  return (
    <div className="perm-row" data-report-key={reportKey}>
      <span>{cfg.title}</span>
      <div className="report-export-wrap">
        <button className="btn btn-ghost btn-sm report-view-btn"><ChartColumn size={14} /> View</button>
        {exportAllowed && (
          <>
            <button className="btn btn-ghost btn-sm report-export-btn"><Download size={15} /> Export</button>
            <div className="report-export-menu">
              <button className="report-export-option" data-format="excel"><FileSpreadsheet size={14} /> Excel</button>
              <button className="report-export-option" data-format="pdf"><FileType size={14} /> PDF</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { canExportOnPage, role } = usePermissions();
  const [projectId, setProjectId] = useState('');
  const [empId, setEmpId] = useState('');
  const [period, setPeriod] = useState('this_month');
  const [search, setSearch] = useState('');
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    get('/api/projects').then(rows => setProjects(rows || [])).catch(() => {});
    get('/api/employees').then(rows => setEmployees(rows || [])).catch(() => {});
  }, []);

  useEffect(() => {
    state.pf['page-reports'] = { ...state.pf['page-reports'], project_id: projectId || undefined, emp_id: empId || undefined };
  }, [projectId, empId]);

  const exportAllowed = canExportOnPage('reports');
  const q = search.trim().toLowerCase();
  // Employee Reports (hours/cost/utilization, timesheet-approval) is HR-flavored
  // and outside Finance User's money-side remit — see app/routers/reports.py's matching
  // backend restriction on /employee-utilization for the two reports that actually expose it.
  // Audit Reports is hidden too — Finance User has no access to Audit Log (its
  // 'audit-log-report' hits an Admin/Manager-only endpoint and would just 403).
  const categories = role === 'Finance User'
    ? CATEGORIES.filter(cat => cat.title !== 'Employee Reports' && cat.title !== 'Audit Reports')
    : CATEGORIES;

  return (
    <div>
      <div className="section-header"><h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><ChartColumn size={22} /> Reports</h2></div>

      <div className="filter-bar">
        <select className="form-control" value={projectId} onChange={e => setProjectId(e.target.value)}>
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.id} - {p.name}</option>)}
        </select>
        <select className="form-control" value={empId} onChange={e => setEmpId(e.target.value)}>
          <option value="">All Employees</option>
          {employees.map(e => <option key={e.emp_id} value={e.emp_id}>{e.emp_id} - {e.name}</option>)}
        </select>
        <select id="reports-period" className="form-control" value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="this_month">This Month</option>
          <option value="last_month">Last Month</option>
          <option value="q1_2026">Q1</option>
          <option value="fy_2025_26">FY 2025-26</option>
        </select>
        <div className="relative" style={{ flex: 1, minWidth: 180 }}>
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="form-control"
            style={{ width: '100%', paddingLeft: 32 }}
            placeholder="Search reports…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid-2">
        {categories.map(cat => (
          <div className="card" key={cat.title}>
            <SectionTitle icon={CATEGORY_ICONS[cat.title]}>{cat.title}</SectionTitle>
            {cat.keys
              .filter(k => !q || REPORTS[k].title.toLowerCase().includes(q))
              .map(k => <ReportRow key={k} reportKey={k} exportAllowed={exportAllowed} />)}
          </div>
        ))}
      </div>
    </div>
  );
}
