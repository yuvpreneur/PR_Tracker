import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2 } from 'lucide-react';
import useOrganizations, { getOrganization } from './useOrganizations.js';
import OrgLogoThumb from './OrgLogoThumb.jsx';
import Button from '../../components/ui/Button.jsx';

export default function EditOrganizationPage() {
  const { id } = useParams();
  const { updateOrganization } = useOrganizations();
  const navigate = useNavigate();

  const [org, setOrg] = useState(null);
  const [name, setName] = useState('');
  const [logo, setLogo] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getOrganization(id).then(o => { setOrg(o); setName(o.name); }).catch(() => setError('Could not load this organization.'));
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await updateOrganization(id, { name: name !== org.name ? name : null, logo });
      navigate('/organizations');
    } catch (err) {
      setError(err.message || 'Could not update the organization.');
    } finally {
      setSaving(false);
    }
  };

  if (!org) {
    return <div>{error || 'Loading…'}</div>;
  }

  return (
    <div>
      <div className="section-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Building2 size={22} /> Edit Organization</h2>
      </div>

      <div className="card" style={{ maxWidth: 520 }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-group">
            <label className="form-label">Organization name</label>
            <input className="form-control" type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus />
          </div>

          <div className="form-group">
            <label className="form-label">Logo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <OrgLogoThumb orgId={org.id} hasLogo={!!org.logo_url} size={60} />
              <input className="form-control" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={e => setLogo(e.target.files?.[0] || null)} />
            </div>
          </div>

          {error && (
            <p style={{ color: 'var(--red)', fontSize: '13px', margin: 0, background: 'var(--red-soft)', padding: '8px 12px', borderRadius: '10px' }}>
              {error}
            </p>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate('/organizations')}>
              <ArrowLeft size={14} /> Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
