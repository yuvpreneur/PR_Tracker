import { useMemo, useState } from 'react';
import useProjectCodes from './useProjectCodes.js';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { can, canCreateOnPage } from '../../bridge/shared/permissions.js';
import { openModal, startCreate } from '../../bridge/shared/modals.js';

export default function ProjectCodesPage() {
  const { pcodes, projects, loading } = useProjectCodes();
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const projectName = id => projects.find(p => p.id === id)?.name;

  const columns = useMemo(() => [
    { key: 'code', header: 'Project Code', render: r => <strong>{r.code}</strong> },
    { key: 'project_id', header: 'Project', render: r => { const n = projectName(r.project_id); return n ? `${r.project_id} · ${n}` : r.project_id; } },
    { key: 'description', header: 'Description', render: r => r.description || '—' },
    { key: 'status', header: 'Status', render: r => <Badge status={r.status} /> },
  ], [projects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pcodes.filter(c => {
      if (projectId && c.project_id !== projectId) return false;
      if (status && c.status !== status) return false;
      if (q && !`${c.code} ${projectName(c.project_id) || ''} ${c.description || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [pcodes, projects, projectId, status, search]);

  const handleNew = () => {
    startCreate('page-project-codes');
    openModal('modal-pcode');
  };

  return (
    <div>
      <div className="section-header">
        <h2>Project Codes</h2>
        {canCreateOnPage('project-codes') && (
          <Button variant="primary" onClick={handleNew}>+ New Project Code</Button>
        )}
      </div>

      <div className="filter-bar">
        <select className="form-control" value={projectId} onChange={e => setProjectId(e.target.value)}>
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.id} · {p.name}</option>)}
        </select>
        <select className="form-control" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All Status</option>
          <option>Active</option>
          <option>Inactive</option>
        </select>
        <input
          className="form-control"
          style={{ flex: 1, minWidth: 180 }}
          placeholder="🔍 Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="card table-wrap">
        <DataTable
          columns={columns}
          rows={filtered}
          getRowId={r => r.code}
          pageId="page-project-codes"
          canEdit={can('Project Codes', 'edit')}
          canDelete={can('Project Codes', 'delete')}
          emptyMessage={loading ? 'Loading…' : 'No records found'}
        />
      </div>
    </div>
  );
}
