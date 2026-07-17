import { useEffect, useMemo, useRef, useState } from 'react';
import useProjects from './useProjects.js';
import { exportProjectsCSV, exportProjectsPDF, exportProjectsXLSX } from './exportProjects.js';
import StatCard from '../../components/ui/StatCard.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { date, num } from '../../bridge/shared/ui.js';
import { can, canCreateOnPage, canExportOnPage } from '../../bridge/shared/permissions.js';
import { openModal, startCreate } from '../../bridge/shared/modals.js';

const COLUMNS = [
  { key: 'id', header: 'Code', render: r => <strong>{r.id}</strong> },
  { key: 'name', header: 'Project Name' },
  { key: 'client', header: 'Client' },
  { key: 'manager', header: 'Manager' },
  { key: 'start_date', header: 'Start', render: r => date(r.start_date) },
  { key: 'end_date', header: 'End', render: r => date(r.end_date) },
  { key: 'status', header: 'Status', render: r => <Badge status={r.status} /> },
];

export default function ProjectsPage() {
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
    startCreate('page-projects');
    openModal('modal-project');
  };

  return (
    <div>
      <div className="section-header">
        <h2>Projects</h2>
        {canCreateOnPage('projects') && (
          <Button variant="primary" onClick={handleNewProject}>+ New Project</Button>
        )}
      </div>

      <div className="mb-5 grid grid-cols-4 gap-4 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
        <StatCard label="Total Projects" value={String(summary?.total ?? (loading ? '—' : 0))} sub="Across all clients" color="var(--color-brand)" />
        <StatCard label="Active Now" value={String(summary?.in_progress ?? (loading ? '—' : 0))} sub="Currently in progress" color="var(--color-green)" />
        <StatCard label="On Hold" value={String(summary?.on_hold ?? (loading ? '—' : 0))} sub="Awaiting resumption" color="var(--color-amber)" />
        <StatCard
          label="Portfolio Budget"
          value={loading ? '—' : `₹${num(summary?.total_budget || 0)}`}
          sub={`${summary?.total ?? 0} project${summary?.total === 1 ? '' : 's'} total`}
          color="var(--color-violet)"
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
        <input
          className="form-control"
          style={{ flex: 1, minWidth: 180 }}
          placeholder="🔍 Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {canExportOnPage('projects') && (
          <div className="relative" ref={exportRef}>
            <Button variant="ghost" onClick={() => setExportOpen(o => !o)}>Export ↓</Button>
            {exportOpen && (
              <div className="absolute right-0 top-full z-10 mt-1.5 w-40 rounded-xl border border-line bg-white py-1.5 shadow-card">
                {[
                  ['csv', '📄 CSV', exportProjectsCSV],
                  ['xlsx', '📊 Excel', exportProjectsXLSX],
                  ['pdf', '🧾 PDF', exportProjectsPDF],
                ].map(([key, label, fn]) => (
                  <button
                    key={key}
                    className="block w-full px-3.5 py-2 text-left text-[13px] hover:bg-page"
                    onClick={() => { setExportOpen(false); fn(filtered); }}
                  >
                    {label}
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
            <div className="text-xs text-text2">Client, manager, timeline, and status for every project.</div>
          </div>
          <span className="badge badge-accent">Live data</span>
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
