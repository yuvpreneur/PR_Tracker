import { Receipt, Eye, Loader2 } from 'lucide-react';
import usePayslips from './usePayslips.js';
import Button from '../../components/ui/Button.jsx';
import { payPeriodLabel } from '../../utils/format.js';

export default function PayslipsPage() {
  const { periods, period, setPeriod, loading, opening, view } = usePayslips();

  return (
    <div>
      <div className="section-header">
        <h2 className="flex items-center gap-2"><Receipt size={22} /> My Payslips</h2>
      </div>

      {loading ? (
        <p className="text-[13px] text-muted">Loading…</p>
      ) : periods.length === 0 ? (
        <div className="card" style={{ padding: 24 }}>
          <p className="text-[13px] text-muted">No payslips are available for you yet.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 20 }}>
          <div className="flex items-end gap-3">
            <div className="form-group" style={{ marginBottom: 0, minWidth: 200 }}>
              <label className="form-label">Period</label>
              <select className="form-control" value={period || ''} onChange={e => setPeriod(e.target.value)}>
                {periods.map(p => <option key={p} value={p}>{payPeriodLabel(p)}</option>)}
              </select>
            </div>
            <Button variant="primary" onClick={view} disabled={opening}>
              {opening ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />}
              {opening ? 'Opening…' : 'View Payslip'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
