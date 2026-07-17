import { useState } from 'react';
import useNoAccessRequest from './useNoAccessRequest.js';
import { submitPageAccessRequest } from '../../bridge/pages/accesscontrol.js';
import Button from '../../components/ui/Button.jsx';

// submitPageAccessRequest() (reused as-is) reads state.blockedPageId plus these two
// fields directly by id (#request-project-context/#request-access-reason) — kept on
// these controlled inputs since that's a plain .value read, not a structural DOM
// write, so it's safe regardless of React owning this page (same pattern as Reports'
// #reports-period).
export default function NoAccessPage() {
  const { blockedLabel, projects } = useNoAccessRequest();
  const [project, setProject] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await submitPageAccessRequest();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card no-access-card">
      <div className="no-access-icon">🔒</div>
      <h2 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-.8px', marginBottom: 8 }}>No access to this page</h2>
      <p style={{ color: 'var(--slate)', fontSize: 14, marginBottom: 18 }}>
        You do not currently have permission to view <strong>{blockedLabel}</strong>. Submit a request to Admin with the project context and reason.
      </p>
      <div className="form-grid" style={{ textAlign: 'left', marginBottom: 18 }}>
        <div className="form-group">
          <label className="form-label">Requested Page</label>
          <input className="form-control" readOnly value={blockedLabel} />
        </div>
        <div className="form-group">
          <label className="form-label">Project Context</label>
          <select id="request-project-context" className="form-control" value={project} onChange={e => setProject(e.target.value)}>
            <option value="">Select project…</option>
            {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        </div>
        <div className="form-group col-span-2">
          <label className="form-label">Reason</label>
          <input
            id="request-access-reason"
            className="form-control"
            placeholder="Why do you need access?"
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
        </div>
      </div>
      <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'Submitting…' : 'Request Access'}
      </Button>
      <Button variant="ghost" onClick={() => window.navigate?.('dashboard')} style={{ marginLeft: 10 }}>
        Back to Dashboard
      </Button>
    </div>
  );
}
