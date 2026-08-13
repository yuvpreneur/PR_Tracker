import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2 } from 'lucide-react';
import useOrganizations from './useOrganizations.js';
import Button from '../../components/ui/Button.jsx';

export default function CreateOrganizationPage() {
  const { createOrganization } = useOrganizations();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [logo, setLogo] = useState(null);
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await createOrganization({ name, logo, adminUsername, adminPassword, adminName, adminEmail });
      navigate('/organizations');
    } catch (err) {
      setError(err.message || 'Could not create the organization.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="section-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Building2 size={22} /> New Organization</h2>
      </div>

      <div className="card" style={{ maxWidth: 520 }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-group">
            <label className="form-label">Organization name</label>
            <input className="form-control" type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus />
          </div>

          <div className="form-group">
            <label className="form-label">Logo (optional)</label>
            <input className="form-control" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={e => setLogo(e.target.files?.[0] || null)} />
          </div>

          <p style={{ fontSize: '12px', color: 'var(--slate)', margin: '4px 0 0', fontWeight: 600 }}>Initial Admin account</p>

          <div className="form-group">
            <label className="form-label">Full name</label>
            <input className="form-control" type="text" value={adminName} onChange={e => setAdminName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-control" type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input className="form-control" type="text" value={adminUsername} onChange={e => setAdminUsername(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-control" type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} required />
          </div>

          {error && (
            <p style={{ color: 'var(--red)', fontSize: '13px', margin: 0, background: 'var(--red-soft)', padding: '8px 12px', borderRadius: '10px' }}>
              {error}
            </p>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create Organization'}
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
