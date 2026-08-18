import { Receipt, Eye, Download, Printer, X, Loader2 } from 'lucide-react';
import usePayslips from './usePayslips.js';
import PayslipViewer from './PayslipViewer.jsx';
import Button from '../../components/ui/Button.jsx';
import { payPeriodLabel } from '../../utils/format.js';

export default function PayslipsPage() {
  const {
    periods, period, setPeriod, loading,
    opening, view, downloading, download, printing, print,
    viewBytes, closeView,
  } = usePayslips();

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
            <Button variant="ghost" onClick={download} disabled={downloading}>
              {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              {downloading ? 'Downloading…' : 'Download'}
            </Button>
            <Button variant="ghost" onClick={print} disabled={printing}>
              {printing ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
              {printing ? 'Preparing…' : 'Print'}
            </Button>
          </div>

          {viewBytes && (
            <div style={{ marginTop: 16 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                <span className="text-[13px] font-semibold">{payPeriodLabel(period)}</span>
                <Button variant="ghost" onClick={closeView}><X size={15} /> Close</Button>
              </div>
              <div style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 12, background: '#f8fafc' }}>
                <PayslipViewer bytes={viewBytes} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
