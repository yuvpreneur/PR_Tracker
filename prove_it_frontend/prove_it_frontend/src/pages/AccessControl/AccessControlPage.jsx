import { useEffect, useRef, useState } from 'react';
import usePageAccess, { PAGES } from './usePageAccess.js';
import useProjectAccess from './useProjectAccess.js';
import Button from '../../components/ui/Button.jsx';
import { get, post } from '../../bridge/core/http.js';
import { toast } from '../../bridge/shared/ui.js';
import { openModal, set } from '../../bridge/shared/modals.js';

const LEAD_STAGES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won / Project'];

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

  // modal-page (legacy, unchanged) is shared with the "+ Add Page"/"Configure Page"
  // buttons — its own "Assign to Projects" checkbox list used to be populated by
  // the now-removed loadAccessControl()'s populateCustomPageProjectList(); this
  // page-access-control has no loader wired anymore (see bridge/index.js), so that
  // population is replicated here directly instead.
  useEffect(() => {
    const container = document.querySelector('#modal-page .project-list');
    if (container && projects.length) {
      container.innerHTML = projects.map(p => `<label><input type="checkbox" value="${p.id}"> ${p.name}</label>`).join('');
    }
  }, [projects]);

  const pageAccess = usePageAccess(empId);
  const projectAccess = useProjectAccess(empId);

  // ── Lead Management Projects ──
  const [leadProjectId, setLeadProjectId] = useState('');
  const [leadStage, setLeadStage] = useState('New');
  const [leadSettings, setLeadSettings] = useState([]);
  const refreshLeadSettings = () => get('/api/access-control/lead-project-settings').catch(() => []).then(rows => setLeadSettings(rows || []));
  useEffect(() => { refreshLeadSettings(); }, []);
  useEffect(() => { if (projects.length && !leadProjectId) setLeadProjectId(projects[0].id); }, [projects]);

  const addLeadProjectSetting = async () => {
    if (!leadProjectId) { toast('Select a project first', 'error'); return; }
    await post('/api/access-control/lead-project-settings', { project_id: leadProjectId, default_stage: leadStage });
    toast('Saved to Lead Management');
    refreshLeadSettings();
  };

  // ── Custom Pages ──
  const [customPages, setCustomPages] = useState([]);
  const [newPageName, setNewPageName] = useState('');
  const [newPageVisibility, setNewPageVisibility] = useState('Admin only');
  const refreshCustomPages = () => get('/api/access-control/custom-pages').catch(() => []).then(rows => setCustomPages(rows || []));
  useEffect(() => {
    refreshCustomPages();
    document.addEventListener('custom-pages:changed', refreshCustomPages);
    return () => document.removeEventListener('custom-pages:changed', refreshCustomPages);
  }, []);

  const configurePage = () => {
    if (newPageName.trim()) set('modal-page', 'page name', newPageName.trim());
    if (newPageVisibility) set('modal-page', 'default visibility', newPageVisibility);
    openModal('modal-page');
  };

  // ── Access Requests ── (approve/reject/audit reuse the existing document-level
  // delegation in bridge/index.js, which isn't scoped to any page id). That
  // delegation still calls the legacy loadAccessRequests() afterward, which looks
  // for #access-request-list — deliberately NOT reused as an id below, so that
  // call safely no-ops instead of clobbering this React-rendered list. This
  // effect refetches on the same clicks via its own listener instead.
  const [requests, setRequests] = useState([]);
  useEffect(() => {
    const refreshRequests = () => get('/api/access-control/requests').catch(() => []).then(rows => setRequests(rows || []));
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
          <Button variant="ghost" onClick={() => openModal('modal-page')}>+ Add Page</Button>
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
          <div className="access-list">
            {PAGES.map(p => (
              <label key={p}>
                <input
                  type="checkbox"
                  checked={!!pageAccess.allowed[p]}
                  onChange={ev => pageAccess.toggle(p, ev.target.checked)}
                />
                {' '}{p}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <Button variant="primary" onClick={pageAccess.save} disabled={pageAccess.saving}>
              {pageAccess.saving ? 'Saving…' : 'Save Page Access'}
            </Button>
          </div>
        </div>

        <div className="access-card" ref={projectCardRef}>
          <h4>Assigned Projects</h4>
          <p>Users only see project records assigned to them. Admins can assign or remove projects at any time.</p>
          <div className="project-list">
            {projects.map(p => (
              <label key={p.id}>
                <input
                  type="checkbox"
                  checked={!!projectAccess.allowed[p.id]}
                  onChange={ev => projectAccess.toggle(p.id, ev.target.checked)}
                />
                {' '}{p.name}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <Button variant="primary" onClick={() => projectAccess.save(projects)} disabled={projectAccess.saving}>
              {projectAccess.saving ? 'Saving…' : 'Update Projects'}
            </Button>
          </div>
        </div>

        <div className="access-card">
          <h4>Lead Management Projects</h4>
          <p>Admin can decide which projects are available inside Lead Management. These projects appear while adding or editing a lead.</p>
          <div className="lead-project-admin">
            <div className="form-group">
              <label className="form-label">Project</label>
              <select className="form-control" value={leadProjectId} onChange={e => setLeadProjectId(e.target.value)}>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Default Lead Stage</label>
              <select className="form-control" value={leadStage} onChange={e => setLeadStage(e.target.value)}>
                {LEAD_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            {leadSettings.map(r => {
              const proj = projects.find(p => p.id === r.project_id);
              return (
                <div className="lead-project-row" key={r.project_id}>
                  <div><strong>{proj ? proj.name : r.project_id}</strong><small>Default stage: {r.default_stage}</small></div>
                  <span className="badge badge-green">Active</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <Button variant="primary" onClick={addLeadProjectSetting}>Add to Lead Management</Button>
          </div>
        </div>

        <div className="access-card">
          <h4>Custom Pages</h4>
          <p>Admin can add new modules/pages and immediately decide who can access them.</p>
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label className="form-label">New Page Name</label>
            <input className="form-control" placeholder="e.g. Vendor Portal" value={newPageName} onChange={e => setNewPageName(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label className="form-label">Visible To</label>
            <select className="form-control" value={newPageVisibility} onChange={e => setNewPageVisibility(e.target.value)}>
              <option>Admin only</option>
              <option>Managers</option>
              <option>Finance Users</option>
              <option>Selected Employees</option>
            </select>
          </div>
          <Button variant="primary" onClick={configurePage}>Configure Page</Button>
          <div style={{ marginTop: 12 }}>
            {customPages.length === 0 && (
              <div style={{ textAlign: 'center', padding: 14, color: '#94a3b8', fontSize: 13 }}>No custom pages configured yet</div>
            )}
            {customPages.map(p => (
              <div className="lead-project-row" key={p.name}>
                <div>
                  <strong>{p.icon ? p.icon + ' ' : ''}{p.name}</strong>
                  <small>{(p.projects || []).length} project(s) · {(p.initial_access || []).length} role(s) granted</small>
                </div>
                <span className={`badge ${p.visibility === 'Admin only' ? 'badge-muted' : 'badge-green'}`}>{p.visibility}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-section-title">Page Access Requests</div>
          <div>
            {requests.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 13 }}>No access requests</div>
            )}
            {requests.map(r => (
              <div className="request-row" key={r.id}>
                <strong>{r.requester} requested {r.page}</strong>
                <span className={`badge ${requestBadgeClass(r.status)}`}>{r.status}</span>
                <span>{r.project || '—'}</span>
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
