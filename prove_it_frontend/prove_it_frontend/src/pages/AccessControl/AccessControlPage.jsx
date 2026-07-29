import { useEffect, useRef, useState } from 'react';
import usePageAccess, { PAGES } from './usePageAccess.js';
import useProjectAccess from './useProjectAccess.js';
import Button from '../../components/ui/Button.jsx';
import CheckboxDropdown from '../../components/ui/CheckboxDropdown.jsx';
import { get } from '../../services/httpClient.js';
import { setNavBadge } from '../../bridge/shared/ui.js';

export default function AccessControlPage() {
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [empId, setEmpId] = useState('');
  const empSelectRef = useRef(null);
  const projectCardRef = useRef(null);

  useEffect(() => {
    get('/api/employees').then(rows => {
      setEmployees(rows || []);
      if (rows?.length) setEmpId(rows[0].emp_id);
    }).catch(() => {});
    get('/api/projects').then(rows => setProjects(rows || [])).catch(() => {});
  }, []);

  const pageAccess = usePageAccess(empId);
  const projectAccess = useProjectAccess(empId);

  // ── Access Requests ── (approve/reject/audit reuse the existing document-level
  // delegation in bridge/index.js, which isn't scoped to any page id). That
  // delegation still calls the legacy loadAccessRequests() afterward, which looks
  // for #access-request-list — deliberately NOT reused as an id below, so that
  // call safely no-ops instead of clobbering this React-rendered list. This
  // effect refetches on the same clicks via its own listener instead.
  const [requests, setRequests] = useState([]);
  useEffect(() => {
    const refreshRequests = () => get('/api/access-control/requests').catch(() => []).then(rows => {
      setRequests(rows || []);
      setNavBadge('access-control', (rows || []).filter(r => r.status === 'Pending').length);
    });
    refreshRequests();
    const onClick = e => {
      if (e.target.closest('.bridge-req-approve, .bridge-req-reject')) setTimeout(refreshRequests, 500);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const requestBadgeClass = status => (status === 'Approved' ? 'badge-green' : status === 'Rejected' ? 'badge-red' : 'badge-amber');

  return (
    <div>
      <div className="section-header">
        <h2>Access Control &amp; Project Assignment</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button
            variant="primary"
            onClick={() => { projectCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); empSelectRef.current?.focus(); }}
          >
            + Assign Project
          </Button>
        </div>
      </div>

      <div className="access-grid">
        <div className="access-card">
          <h4>Employee Page Access</h4>
          <p>Select the pages an employee can open. Pages without permission show a No Access screen with a request button.</p>
          <select
            ref={empSelectRef}
            className="form-control"
            style={{ marginBottom: 12 }}
            value={empId}
            onChange={e => setEmpId(e.target.value)}
          >
            {employees.map(e => (
              <option key={e.emp_id} value={e.emp_id}>{e.name} · {e.designation || e.role || e.department || ''}</option>
            ))}
          </select>
          <CheckboxDropdown
            options={PAGES}
            selected={pageAccess.allowed}
            onToggle={pageAccess.toggle}
            staticLabel="Page Access"
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <Button variant="primary" onClick={pageAccess.save} disabled={pageAccess.saving}>
              {pageAccess.saving ? 'Saving…' : 'Save Page Access'}
            </Button>
          </div>
        </div>

        <div className="access-card" ref={projectCardRef}>
          <h4>Assigned Projects</h4>
          <p>Users only see project records assigned to them. Admins can assign or remove projects at any time.</p>
          <CheckboxDropdown
            options={projects}
            selected={projectAccess.allowed}
            onToggle={projectAccess.toggle}
            placeholder="Select projects…"
            noun="projects"
            getKey={p => p.id}
            getLabel={p => p.name}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <Button variant="primary" onClick={() => projectAccess.save(projects)} disabled={projectAccess.saving}>
              {projectAccess.saving ? 'Saving…' : 'Update Projects'}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-section-title">Access Requests</div>
          <div>
            {requests.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 13 }}>No access requests</div>
            )}
            {requests.map(r => (
              <div className="request-row" key={r.id}>
                <strong>
                  {r.requester} requested {r.request_type === 'project'
                    ? `project access — ${r.project_name || r.project_id}`
                    : r.page}
                </strong>
                <span className={`badge ${requestBadgeClass(r.status)}`}>{r.status}</span>
                <span>{r.request_type === 'project' ? (r.reason || '—') : (r.project || '—')}</span>
                <div>
                  {r.status === 'Pending' ? (
                    <>
                      <button className="btn btn-success btn-sm bridge-req-approve" data-id={r.id}>Approve</button>{' '}
                      <button className="btn btn-danger btn-sm bridge-req-reject" data-id={r.id}>Reject</button>
                    </>
                  ) : (
                    <button className="btn btn-ghost btn-sm bridge-req-audit" data-requester={r.requester}>Audit</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Static reference copy — no code ever populated this dynamically in the legacy
           version either; it's documentation, not live data. */}
        <div className="card">
          <div className="card-section-title">Access Rules Summary</div>
          <div className="perm-row"><span>Admin</span><span className="badge badge-green">All pages · All projects</span></div>
          <div className="perm-row"><span>Manager</span><span className="badge badge-accent">Approved pages · Assigned projects</span></div>
          <div className="perm-row"><span>Employee</span><span className="badge badge-accent">Limited pages · Own projects</span></div>
          <div className="perm-row"><span>Finance</span><span className="badge badge-amber">Finance pages · Assigned/all finance projects</span></div>
        </div>
      </div>
    </div>
  );
}
