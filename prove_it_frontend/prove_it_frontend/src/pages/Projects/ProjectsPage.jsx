import { useEffect, useMemo, useRef, useState } from 'react';
import { FolderKanban, Plus, Search, KeyRound, Download, FileText, FileSpreadsheet, FileType, Activity, PauseCircle, Wallet, FolderOpen, X } from 'lucide-react';
import useProjects from './useProjects.js';
import { exportProjectsCSV, exportProjectsPDF, exportProjectsXLSX } from './exportProjects.js';
import StatCard from '../../components/ui/StatCard.jsx';
import SectionTitle from '../../components/ui/SectionTitle.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { date, num } from '../../utils/format.js';
import { toast } from '../../utils/toast.js';
import usePermissions from '../../hooks/usePermissions.js';
import { openModal, startCreate, resetFields } from '../../bridge/shared/modals.js';
import { get, post } from '../../services/httpClient.js';

const COLUMNS = [
  { key: 'id', header: 'Code', render: r => <strong>{r.id}</strong> },
  { key: 'name', header: 'Project Name' },
  { key: 'client', header: 'Client', align: 'center' },
  { key: 'manager', header: 'Manager', align: 'center' },
  { key: 'start_date', header: 'Start', align: 'center', render: r => date(r.start_date) },
  { key: 'end_date', header: 'End', align: 'center', render: r => date(r.end_date) },
  { key: 'status', header: 'Status', align: 'center', render: r => <Badge status={r.status} /> },
  {
    key: 'pm_sync_status', header: 'PR Manager', align: 'center',
    render: r => (
      <span title={r.pm_missing_fields?.length ? `Needs: ${r.pm_missing_fields.join(', ')}` : undefined}>
        <Badge status={r.pm_sync_status} />
      </span>
    ),
  },
];

export default function ProjectsPage() {
  const { can, canCreateOnPage, canExportOnPage, role } = usePermissions();
  const { projects, summary, loading } = useProjects();
  const [status, setStatus] = useState('');
  const [client, setClient] = useState('');
  const [search, setSearch] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);

  useEffect(() => {
    if (!exportOpen) return;
    const onClick = e => { if (!exportRef.current?.contains(e.target)) setExportOpen(false); };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [exportOpen]);

  const clients = useMemo(() => [...new Set(projects.map(p => p.client).filter(Boolean))].sort(), [projects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter(p => {
      if (status && p.status !== status) return false;
      if (client && p.client !== client) return false;
      if (q && !`${p.id} ${p.name} ${p.client} ${p.manager}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [projects, status, client, search]);

  const handleNewProject = () => {
    resetFields('modal-project');
    startCreate('page-projects');
    openModal('modal-project');
  };

  // Request access to a project not currently in this user's Assigned Projects (Access
  // Control) — Admin/Manager already see every project, so this is only offered to
  // everyone else. Picks from the full, unfiltered project list (see
  // requestable-projects in access_control.py) since a scoped user can't otherwise even
  // know a project they need exists.
  const canRequestProjectAccess = role && role !== 'Admin' && role !== 'Manager';
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestableProjects, setRequestableProjects] = useState([]);
  const [requestProjectId, setRequestProjectId] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const openRequestPanel = () => {
    setRequestOpen(true);
    get('/api/access-control/requestable-projects').then(rows => setRequestableProjects(rows || [])).catch(() => {});
  };

  const submitProjectAccessRequest = async () => {
    if (!requestProjectId) { toast('Choose a project first', 'error'); return; }
    setSubmittingRequest(true);
    try {
      await post('/api/access-control/requests', {
        request_type: 'project', project_id: requestProjectId, reason: requestReason || null,
      });
      toast('Project access request submitted — an Admin will review it');
      setRequestOpen(false);
      setRequestProjectId('');
      setRequestReason('');
    } finally {
      setSubmittingRequest(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2><FolderKanban size={22} /> Projects</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {canRequestProjectAccess && (
            <Button variant="ghost" onClick={openRequestPanel}><KeyRound size={15} /> Request Project Access</Button>
          )}
          {canCreateOnPage('projects') && (
            <Button variant="primary" onClick={handleNewProject}><Plus size={15} /> New Project</Button>
          )}
        </div>
      </div>

      {requestOpen && (
        <div className="card" style={{ marginBottom: 20 }}>
          <SectionTitle icon={KeyRound}>Request Project Access</SectionTitle>
          <p style={{ color: 'var(--slate)', fontSize: 13, marginBottom: 12 }}>
            Don't see a project you need? Pick it here and submit a request — an Admin will review and grant it.
          </p>
          <div className="form-grid" style={{ marginBottom: 12 }}>
            <div className="form-group">
              <label className="form-label">Project</label>
              <select className="form-control" value={requestProjectId} onChange={e => setRequestProjectId(e.target.value)}>
                <option value="">Select project…</option>
                {requestableProjects.map(p => <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
              </select>
            </div>
            <div className="form-group col-span-2">
              <label className="form-label">Reason</label>
              <input
                className="form-control"
                placeholder="Why do you need access?"
                value={requestReason}
                onChange={e => setRequestReason(e.target.value)}
              />
            </div>
          </div>
          <Button variant="primary" onClick={submitProjectAccessRequest} disabled={submittingRequest}>
            {submittingRequest ? 'Submitting…' : 'Submit Request'}
          </Button>
          <Button variant="ghost" onClick={() => setRequestOpen(false)} style={{ marginLeft: 10 }}><X size={15} /> Cancel</Button>
        </div>
      )}

      <div className="mb-5 grid grid-cols-4 gap-4 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
        <StatCard label="Total Projects" value={String(summary?.total ?? (loading ? '—' : 0))} sub="Across all clients" color="var(--color-brand)" icon={FolderOpen} />
        <StatCard label="Active Now" value={String(summary?.in_progress ?? (loading ? '—' : 0))} sub="Currently in progress" color="var(--color-green)" icon={Activity} />
        <StatCard label="On Hold" value={String(summary?.on_hold ?? (loading ? '—' : 0))} sub="Awaiting resumption" color="var(--color-amber)" icon={PauseCircle} />
        <StatCard
          label="Portfolio Budget"
          value={loading ? '—' : `₹${num(summary?.total_budget || 0)}`}
          sub={`${summary?.total ?? 0} project${summary?.total === 1 ? '' : 's'} total`}
          color="var(--color-violet)"
          icon={Wallet}
        />
      </div>

      <div className="filter-bar">
        <select className="form-control" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All Status</option>
          <option>In Progress</option>
          <option>On Hold</option>
          <option>Completed</option>
          <option>Not Started</option>
        </select>
        <select className="form-control" value={client} onChange={e => setClient(e.target.value)}>
          <option value="">All Clients</option>
          {clients.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
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
        {canExportOnPage('projects') && (
          <div className="relative" ref={exportRef}>
            <Button variant="ghost" onClick={() => setExportOpen(o => !o)} style={{ color: 'var(--rose)', borderColor: 'var(--rose-soft)' }}><Download size={15} /> Export</Button>
            {exportOpen && (
              <div className="absolute right-0 top-full z-10 mt-1.5 w-40 rounded-xl border border-line bg-white py-1.5 shadow-card">
                {[
                  ['csv', FileText, 'CSV', exportProjectsCSV],
                  ['xlsx', FileSpreadsheet, 'Excel', exportProjectsXLSX],
                  ['pdf', FileType, 'PDF', exportProjectsPDF],
                ].map(([key, Icon, label, fn]) => (
                  <button
                    key={key}
                    className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[13px] hover:bg-page"
                    onClick={() => { setExportOpen(false); fn(filtered); }}
                  >
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card table-wrap">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[15px] font-bold">Project Register</div>
          </div>
        </div>
        <DataTable
          columns={COLUMNS}
          rows={filtered}
          getRowId={r => r.id}
          pageId="page-projects"
          canEdit={can('Projects', 'edit')}
          canDelete={can('Projects', 'delete')}
          emptyMessage={loading ? 'Loading…' : 'No records found'}
        />
      </div>
    </div>
  );
}
