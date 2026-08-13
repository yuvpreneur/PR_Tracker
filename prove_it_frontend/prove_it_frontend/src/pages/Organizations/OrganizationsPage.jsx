import { useNavigate } from 'react-router-dom';
import { Building2, Pencil, Plus } from 'lucide-react';
import useOrganizations from './useOrganizations.js';
import OrgLogoThumb from './OrgLogoThumb.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';

export default function OrganizationsPage() {
  const { organizations, loading, setActive } = useOrganizations();
  const navigate = useNavigate();

  return (
    <div>
      <div className="section-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Building2 size={22} /> Organizations</h2>
        <Button variant="primary" onClick={() => navigate('/organizations/new')}><Plus size={15} /> New Organization</Button>
      </div>

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
                <td>{org.created_at ? new Date(org.created_at).toLocaleDateString() : '—'}</td>
                <td style={{ whiteSpace: 'nowrap', display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-sm"
                    style={{ background: 'var(--soft)', color: 'var(--accent)', border: '1px solid var(--line)' }}
                    onClick={() => navigate(`/organizations/${org.id}/edit`)}
                  >
                    <Pencil size={13} /> Edit
                  </button>
                  <button
                    className="btn btn-sm"
                    style={{ background: 'var(--soft)', color: 'var(--accent)', border: '1px solid var(--line)' }}
                    onClick={() => setActive(org.id, !org.is_active)}
                  >
                    {org.is_active ? 'Deactivate' : 'Activate'}
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
