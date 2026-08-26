import { useNavigate } from 'react-router-dom';
import { Building2, Pencil, Plus, CheckCircle2, Ban, RotateCcw } from 'lucide-react';
import useOrganizations from './useOrganizations.js';
import OrgLogoThumb from './OrgLogoThumb.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import StatCard from '../../components/ui/StatCard.jsx';

export default function OrganizationsPage() {
  const { organizations, loading, setActive } = useOrganizations();
  const navigate = useNavigate();

  const activeCount = organizations.filter(o => o.is_active).length;
  const inactiveCount = organizations.length - activeCount;

  return (
    <div>
      <div className="page-header">
        <h2><Building2 size={22} /> Organizations</h2>
        <Button variant="primary" onClick={() => navigate('/organizations/new')}><Plus size={15} /> New Organization</Button>
      </div>

      {organizations.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 20 }}>
          <StatCard label="Total Organizations" value={String(organizations.length)} color="#7357E5" icon={Building2} />
          <StatCard label="Active" value={String(activeCount)} sub={`${inactiveCount} inactive`} color="#16A36C" icon={CheckCircle2} />
          <StatCard label="Inactive" value={String(inactiveCount)} sub={`${activeCount} active`} color="#94A3B8" icon={Ban} />
        </div>
      )}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {organizations.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
                  {loading ? 'Loading…' : 'No organizations yet'}
                </td>
              </tr>
            )}
            {organizations.map(org => (
              <tr key={org.id}>
                <td style={{ width: 46 }}><OrgLogoThumb orgId={org.id} hasLogo={!!org.logo_url} /></td>
                <td><strong>{org.name}</strong></td>
                <td><Badge status={org.is_active ? 'Active' : 'Inactive'} /></td>
                <td style={{ color: 'var(--muted)' }}>{org.created_at ? new Date(org.created_at).toLocaleDateString() : '—'}</td>
                <td style={{ whiteSpace: 'nowrap', display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-sm"
                    style={{ background: 'var(--rose-soft)', color: 'var(--rose)', border: '1px solid var(--line)' }}
                    onClick={() => navigate(`/organizations/${org.id}/edit`)}
                  >
                    <Pencil size={13} /> Edit
                  </button>
                  <button
                    className="btn btn-sm"
                    style={
                      org.is_active
                        ? { background: 'var(--red-soft)', color: 'var(--red)', border: '1px solid rgba(239,68,68,.2)' }
                        : { background: 'rgba(34,197,94,.12)', color: '#16a34a', border: '1px solid rgba(34,197,94,.25)' }
                    }
                    onClick={() => setActive(org.id, !org.is_active)}
                  >
                    {org.is_active ? <><Ban size={13} /> Deactivate</> : <><RotateCcw size={13} /> Activate</>}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
