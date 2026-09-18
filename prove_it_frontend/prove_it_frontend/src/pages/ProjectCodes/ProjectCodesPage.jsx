import { useMemo, useState } from 'react';
import { Tag, Plus, Search } from 'lucide-react';
import useProjectCodes from './useProjectCodes.js';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Dropdown from '../../components/ui/Dropdown.jsx';
import Modal from '../../components/ui/Modal.jsx';
import ReadOnlyField from '../../components/ui/ReadOnlyField.jsx';
import { openModal, startCreate, resetFields } from '../../bridge/shared/modals.js';
import { populatePCodeProjectDropdown } from '../../bridge/pages/projects.js';
import usePermissions from '../../hooks/usePermissions.js';

export default function ProjectCodesPage() {
  const { can, canCreateOnPage } = usePermissions();
  const { pcodes, projects, loading } = useProjectCodes();
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  // The project code currently shown in the read-only View modal (row click) — same
  // pattern as Clients/Projects: a separate look-only surface, not the Edit form
  // (modal-pcode, still reachable only from the kebab menu's Edit item).
  const [viewingCode, setViewingCode] = useState(null);

  const projectName = id => projects.find(p => p.id === id)?.name;

  const columns = useMemo(() => [
    { key: 'code', header: 'Project Code', render: r => <strong>{r.code}</strong> },
    // Just the name — project_id is now an opaque internal id (see app/routers/projects.py),
    // not a human-facing code, so showing it alongside the name is noise, not context.
    // Falls back to the raw id only if the project can't be resolved (e.g. deleted).
    { key: 'project_id', header: 'Project', align: 'center', render: r => projectName(r.project_id) || r.project_id },
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
    // Drops the project left selectable by the last Edit, and picks up any project
    // claimed since this page loaded, so Create never offers a taken one.
    populatePCodeProjectDropdown();
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
            ...projects.map(p => ({ value: p.id, label: p.name }))
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
          actionsAsKebab
          onRowClick={setViewingCode}
          emptyMessage={loading ? 'Loading…' : 'No records found'}
        />
      </div>

      {viewingCode && (
        <Modal title={viewingCode.code} onClose={() => setViewingCode(null)}>
          {/* modal-pcode's own Create/Edit form is a plain single-column stack (no
              .form-grid — unlike modal-company/modal-project), so this matches that
              exactly rather than forcing a two-column layout it doesn't have. No
              "Project Code" field — the modal title already shows it. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <ReadOnlyField label="Project" value={projectName(viewingCode.project_id) || viewingCode.project_id} />
            <ReadOnlyField label="Description" value={viewingCode.description} />
            <ReadOnlyField label="Status" value={<Badge status={viewingCode.status} />} />
          </div>
        </Modal>
      )}
    </div>
  );
}
