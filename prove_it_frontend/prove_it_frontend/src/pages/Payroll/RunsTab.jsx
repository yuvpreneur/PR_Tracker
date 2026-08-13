import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import usePayrollRuns from './usePayrollRuns.js';
import RunEditor from './RunEditor.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { formatMoney } from '../../utils/format.js';
import { toast } from '../../utils/toast.js';
import usePermissions from '../../hooks/usePermissions.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function NewRunForm({ onCreate, onCancel }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try { await onCreate({ period_month: Number(month), period_year: Number(year) }); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">Month</label>
          <select className="form-control" value={month} onChange={e => setMonth(e.target.value)}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Year</label>
          <input type="number" className="form-control" value={year} onChange={e => setYear(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving && <Loader2 size={15} className="animate-spin" />} Create Run</Button>
      </div>
    </form>
  );
}

export default function RunsTab() {
  const { can } = usePermissions();
  const { runs, loading, createRun, getRun, updateLine, finalizeRun, voidRun, deleteRun, refresh } = usePayrollRuns();
  const [modalOpen, setModalOpen] = useState(false);
  const [activeRun, setActiveRun] = useState(null);
  const canCreate = can('Payroll', 'create');

  const openRun = async row => {
    try { setActiveRun(await getRun(row.id)); } catch { /* toasted */ }
  };

  const handleCreate = async payload => {
    try {
      const created = await createRun(payload);
      toast('Payroll run created');
      setModalOpen(false);
      setActiveRun(created);
    } catch { /* httpClient already toasted */ }
  };

  if (activeRun) {
    return (
      <RunEditor
        run={activeRun}
        setRun={setActiveRun}
        updateLine={updateLine}
        finalizeRun={finalizeRun}
        voidRun={voidRun}
        deleteRun={deleteRun}
        onBack={() => { setActiveRun(null); refresh(); }}
      />
    );
  }

  const columns = [
    { key: 'period', header: 'Period', render: r => `${MONTHS[r.period_month - 1]} ${r.period_year}` },
    { key: 'status', header: 'Status', render: r => <Badge status={r.status} /> },
    { key: 'employee_count', header: 'Employees' },
    { key: 'total_gross_earning', header: 'Gross Earning', render: r => formatMoney(r.total_gross_earning) },
    { key: 'total_net_payable', header: 'Net Payable', render: r => <strong>{formatMoney(r.total_net_payable)}</strong> },
  ];

  const renderExtraActions = row => (
    <button className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px]" onClick={() => openRun(row)} title="Open">
      Open
    </button>
  );

  return (
    <div>
      <div className="section-header">
        <h3 className="text-[14px] font-bold">Payroll Runs</h3>
        {canCreate && <Button variant="primary" onClick={() => setModalOpen(true)}><Plus size={15} /> New Run</Button>}
      </div>

      <div className="card table-wrap">
        <DataTable
          columns={columns}
          rows={runs}
          getRowId={r => r.id}
          canEdit={false}
          canDelete={false}
          renderExtraActions={renderExtraActions}
          hideActionsColumn={false}
          emptyMessage={loading ? 'Loading…' : 'No payroll runs yet'}
        />
      </div>

      {modalOpen && (
        <Modal title="New Payroll Run" onClose={() => setModalOpen(false)}>
          <NewRunForm onCreate={handleCreate} onCancel={() => setModalOpen(false)} />
        </Modal>
      )}
    </div>
  );
}
