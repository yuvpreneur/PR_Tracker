import { useMemo, useState } from 'react';
import { Banknote, Plus, Search } from 'lucide-react';
import useHourlyCosts from './useHourlyCosts.js';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Dropdown from '../../components/ui/Dropdown.jsx';
import { date } from '../../utils/format.js';
import { openModal, startCreate, resetFields } from '../../bridge/shared/modals.js';
import usePermissions from '../../hooks/usePermissions.js';

const COLUMNS = [
  { key: 'emp_id', header: 'Emp ID', render: r => <strong>{r.emp_id}</strong> },
  { key: 'name', header: 'Name', render: r => r.name || r.emp_id, align: 'center' },
  { key: 'department', header: 'Department', render: r => r.department || '—', align: 'center' },
  { key: 'hourly_cost', header: 'Hourly Cost', render: r => <strong>₹{(r.hourly_cost || 0).toLocaleString('en-IN')}</strong>, align: 'center' },
  { key: 'effective_from', header: 'Effective From', render: r => date(r.effective_from), align: 'center' },
  {
    key: 'effective_to',
    header: 'Effective To',
    render: r => r.effective_to
      ? <span style={{ color: '#334155' }}>{date(r.effective_to)}</span>
      : <span style={{ color: '#16A36C', fontWeight: 600 }}>Current</span>,
    align: 'center',
  },
];

export default function HourlyCostsPage() {
  const { can, canCreateOnPage } = usePermissions();
  const { costs, loading } = useHourlyCosts();
  const [dept, setDept] = useState('');
  const [search, setSearch] = useState('');

  const depts = useMemo(() => [...new Set((Array.isArray(costs) ? costs : []).map(c => c.department).filter(Boolean))].sort(), [costs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (Array.isArray(costs) ? costs : []).filter(c => {
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
      <div className="page-header">
        <h2><Banknote size={22} /> Employee Hourly Cost</h2>
        {canCreateOnPage('hourly-cost') && (
          <Button variant="primary" onClick={handleNew}><Plus size={15} /> Set Hourly Cost</Button>
        )}
      </div>

      <div className="filter-bar">
        <Dropdown
          value={dept}
          onChange={setDept}
          options={[
            { value: '', label: 'All Depts' },
            ...depts.map(d => ({ value: d, label: d }))
          ]}
          placeholder="All Depts"
          style={{ width: '160px' }}
        />
        <div className="relative" style={{ flex: 1, minWidth: 180 }}>
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="form-control"
            style={{ width: '100%', paddingLeft: 32 }}
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
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
