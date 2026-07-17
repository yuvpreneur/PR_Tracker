import { useEffect, useState } from 'react';
import useLeads from './useLeads.js';
import { LEADS_DASHBOARD_TOP_HTML, LEADS_PIPELINE_BOARD_HTML } from './leadsDashboardStatic.js';
import Badge from '../../components/ui/Badge.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { date, num, toast } from '../../bridge/shared/ui.js';
import { get } from '../../bridge/core/http.js';
import { username } from '../../bridge/core/cache.js';
import { can, isMine } from '../../bridge/shared/permissions.js';

const STAGES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won / Project', 'Lost / Cold'];

const COLUMNS = [
  { key: 'lead_id', header: 'Lead', render: r => <strong>{r.lead_id}</strong> },
  { key: 'company', header: 'Company' },
  { key: 'value', header: 'Value', render: r => `₹${num(r.value)}` },
  { key: 'source', header: 'Source', render: r => r.source || '—' },
  { key: 'owner', header: 'Owner', render: r => <span className="owner-chip">{r.owner}</span> },
  { key: 'access', header: 'Access', render: () => '—' },
  { key: 'stage', header: 'Stage', render: r => <Badge status={r.stage} /> },
  { key: 'followup_date', header: 'Next Follow-up', render: r => r.followup_date ? date(r.followup_date) : '—' },
];

export default function LeadsPage() {
  const [stage, setStage] = useState('');
  const [assignedOwner, setAssignedOwner] = useState('');
  const [scope, setScope] = useState('My Assigned Leads');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    get('/api/employees').then(rows => setEmployees(rows || [])).catch(() => {});
  }, []);

  // The "My Assigned/Self Added Leads" scope and the explicit Owner dropdown both
  // ultimately drive the same server-side owner filter — mirrors the legacy page,
  // where wireLeadAssignmentFilter() and the generic wireFilters() owner-select
  // handler both write into the same state.pf['page-leads'].owner key.
  const ownerFilter = assignedOwner || (['My Assigned Leads', 'Self Added Leads'].includes(scope) ? username() : '');

  const { leads, loading, refresh } = useLeads({ stage, owner: ownerFilter, search });

  const handleRefresh = () => { refresh(); toast('Leads refreshed'); };

  const canEditRow = row => can('Lead Management', 'edit') || isMine(row, 'owner');
  const canDeleteRow = () => can('Lead Management', 'delete');

  return (
    <div>
      <div dangerouslySetInnerHTML={{ __html: LEADS_DASHBOARD_TOP_HTML }} />

      <div className="lead-controls">
        <select className="form-control" value={stage} onChange={e => setStage(e.target.value)}>
          <option value="">All Stages</option>
          {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="form-control" value={assignedOwner} onChange={e => setAssignedOwner(e.target.value)}>
          <option value="">All Owners</option>
          {employees.map(e => <option key={e.emp_id} value={e.name}>{e.name}</option>)}
        </select>
        <select className="form-control" value={scope} onChange={e => setScope(e.target.value)}>
          <option>My Assigned Leads</option>
          <option>All Accessible Leads</option>
          <option>Self Added Leads</option>
          <option>Team Leads</option>
        </select>
        <input
          className="form-control wide"
          placeholder="🔍 Search leads, company, owner, source..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
        />
        <button className="btn btn-ghost" onClick={handleRefresh}>Refresh</button>
      </div>

      <div dangerouslySetInnerHTML={{ __html: LEADS_PIPELINE_BOARD_HTML }} />

      <div className="card table-wrap">
        <div className="card-section-title">Lead Access and Ownership</div>
        <DataTable
          columns={COLUMNS}
          rows={leads}
          getRowId={r => r.lead_id}
          pageId="page-leads"
          canEdit={canEditRow}
          canDelete={canDeleteRow}
          emptyMessage={loading ? 'Loading…' : 'No records found'}
        />
      </div>
    </div>
  );
}
