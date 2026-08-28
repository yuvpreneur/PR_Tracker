import { useMemo, useState } from 'react';
import { Tag, Plus, Search } from 'lucide-react';
import useProjectCodes from './useProjectCodes.js';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Dropdown from '../../components/ui/Dropdown.jsx';
import { openModal, startCreate, resetFields } from '../../bridge/shared/modals.js';
import usePermissions from '../../hooks/usePermissions.js';

export default function ProjectCodesPage() {
  const { can, canCreateOnPage } = usePermissions();
  const { pcodes, projects, loading } = useProjectCodes();
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const projectName = id => projects.find(p => p.id === id)?.name;

  const columns = useMemo(() => [
    { key: 'code', header: 'Project Code', render: r => <strong>{r.code}</strong> },
    { key: 'project_id', header: 'Project', align: 'center', render: r => { const n = projectName(r.project_id); return n ? `${r.project_id} · ${n}` : r.project_id; } },
    { key: 'description', header: 'Description', align: 'center', render: r => r.description || '—' },
    { key: 'status', header: 'Status', align: 'center', render: r => <Badge status={r.status} /> },
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
    resetFields('modal-pcode');
    startCreate('page-project-codes');
    openModal('modal-pcode');
  };

  return (
    <div>
      <div className="page-header">
        <h2><Tag size={22} /> Project Codes</h2>
        {canCreateOnPage('project-codes') && (
          <Button variant="primary" onClick={handleNew}><Plus size={15} /> New Project Code</Button>
        )}
      </div>

      <div className="filter-bar">
        <Dropdown
          value={projectId}
          onChange={setProjectId}
          options={[
            { value: '', label: 'All Projects' },
            ...projects.map(p => ({ value: p.id, label: `${p.id} · ${p.name}` }))
          ]}
          placeholder="All Projects"
          style={{ width: '200px' }}
        />
        <Dropdown
          value={status}
          onChange={setStatus}
          options={[
            { value: '', label: 'All Status' },
            { value: 'Active', label: 'Active' },
            { value: 'Inactive', label: 'Inactive' }
          ]}
          placeholder="All Status"
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
