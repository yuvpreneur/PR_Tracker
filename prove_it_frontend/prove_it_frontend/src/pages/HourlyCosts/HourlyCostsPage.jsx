import { useMemo, useState } from 'react';
import { Banknote, History, Plus, Search } from 'lucide-react';
import useHourlyCosts from './useHourlyCosts.js';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Dropdown from '../../components/ui/Dropdown.jsx';
import Modal from '../../components/ui/Modal.jsx';
import ReadOnlyField from '../../components/ui/ReadOnlyField.jsx';
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
  // The hourly-cost row currently shown in the read-only View modal (row click) — same
  // pattern as the other pages: a separate look-only surface, not the Edit form
  // (modal-cost, still reachable only from the kebab menu's Edit item).
  const [viewingCost, setViewingCost] = useState(null);

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

  // Styled to match KebabMenu's own Edit/Delete items exactly (flat row, icon + label,
  // same hover) rather than the small bordered pill it used to be as a standalone
  // button next to them — this now lands inside that same popover as `extra` (see
  // DataTable), so it needs to read as one more row in that list, not a separate control.
  const renderExtraActions = row => (
    <button
      className="bridge-cost-history"
      data-empid={row.emp_id}
      title="History"
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        padding: '7px 10px', border: 'none', background: 'transparent',
        cursor: 'pointer', fontSize: 12, fontWeight: 600, borderRadius: 6,
        color: 'var(--ink)', textAlign: 'left',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--soft)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <History size={13} />
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
          actionsAsKebab
          onRowClick={setViewingCost}
          emptyMessage={loading ? 'Loading…' : 'No records found'}
        />
      </div>

      {viewingCost && (
        <Modal title={viewingCost.name || viewingCost.emp_id} onClose={() => setViewingCost(null)}>
          {/* modal-cost's own Create/Edit form is a plain single-column stack (no
              .form-grid — like modal-pcode), so this matches that rather than forcing
              a two-column layout it doesn't have. Skips its "Remarks" input, which
              CostCreate/_out() never actually had a field for (dead markup, not real
              data — same situation as Service Desk's "Category"/"Description"). No
              "Employee" field either — the modal title already shows it. Appends
              Employee ID/Department at the end, same as other View modals append real,
              table-visible fields their own Edit form doesn't ask for directly. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <ReadOnlyField label="Hourly Cost (₹)" value={`₹${(viewingCost.hourly_cost || 0).toLocaleString('en-IN')}`} />
            <ReadOnlyField label="Effective From" value={date(viewingCost.effective_from)} />
            <ReadOnlyField label="Effective To" value={viewingCost.effective_to ? date(viewingCost.effective_to) : <span style={{ color: '#16A36C', fontWeight: 600 }}>Current</span>} />
            <ReadOnlyField label="Employee ID" value={viewingCost.emp_id} />
            <ReadOnlyField label="Department" value={viewingCost.department} />
          </div>
        </Modal>
      )}
    </div>
  );
}
