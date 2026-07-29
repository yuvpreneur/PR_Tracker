import { useMemo, useState } from 'react';
import useHourlyCosts from './useHourlyCosts.js';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { date } from '../../utils/format.js';
import { openModal, startCreate, resetFields } from '../../bridge/shared/modals.js';
import usePermissions from '../../hooks/usePermissions.js';

const COLUMNS = [
  { key: 'emp_id', header: 'Emp ID', render: r => <strong>{r.emp_id}</strong> },
  { key: 'name', header: 'Name', render: r => r.name || r.emp_id },
  { key: 'department', header: 'Department', render: r => r.department || '—' },
  { key: 'hourly_cost', header: 'Hourly Cost', render: r => <strong>₹{(r.hourly_cost || 0).toLocaleString('en-IN')}</strong> },
  { key: 'effective_from', header: 'Effective From', render: r => date(r.effective_from) },
  {
    key: 'effective_to',
    header: 'Effective To',
    render: r => r.effective_to
      ? <span style={{ color: '#334155' }}>{date(r.effective_to)}</span>
      : <span style={{ color: '#16A36C', fontWeight: 600 }}>Current</span>,
  },
];

export default function HourlyCostsPage() {
  const { can, canCreateOnPage } = usePermissions();
  const { costs, loading } = useHourlyCosts();
  const [dept, setDept] = useState('');
  const [search, setSearch] = useState('');

  const depts = useMemo(() => [...new Set(costs.map(c => c.department).filter(Boolean))].sort(), [costs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return costs.filter(c => {
      if (dept && c.department !== dept) return false;
      if (q && !`${c.emp_id} ${c.name || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [costs, dept, search]);

  const handleNew = () => {
    resetFields('modal-cost');
    startCreate('page-hourly-cost');
    openModal('modal-cost');
  };

  const renderExtraActions = row => (
    <button className="bridge-cost-history ml-1 rounded-md px-2.5 py-0.5 text-[11px]" data-empid={row.emp_id} title="History">
      History
    </button>
  );

  return (
    <div>
      <div className="section-header">
        <h2>Employee Hourly Cost</h2>
        {canCreateOnPage('hourly-cost') && (
          <Button variant="primary" onClick={handleNew}>+ Set Hourly Cost</Button>
        )}
      </div>

      <div className="filter-bar">
        <select className="form-control" value={dept} onChange={e => setDept(e.target.value)}>
          <option value="">All Depts</option>
          {depts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <input
          className="form-control"
          style={{ flex: 1 }}
          placeholder="🔍 Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="card table-wrap">
        <DataTable
          columns={COLUMNS}
          rows={filtered}
          getRowId={r => r.id}
          pageId="page-hourly-cost"
          canEdit={can('Hourly Costs', 'edit')}
          canDelete={can('Hourly Costs', 'delete')}
          renderExtraActions={renderExtraActions}
          emptyMessage={loading ? 'Loading…' : 'No records found'}
        />
      </div>
    </div>
  );
}
