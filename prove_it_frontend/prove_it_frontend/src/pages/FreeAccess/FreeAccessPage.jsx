import { useState } from 'react';
import { Gift } from 'lucide-react';
import useFreeAccess from './useFreeAccess.js';
import usePlans from '../Plans/usePlans.js';
import useOrganizations from '../Organizations/useOrganizations.js';
import Button from '../../components/ui/Button.jsx';
import Dropdown from '../../components/ui/Dropdown.jsx';

const money = (value) => `$${Number(value || 0).toFixed(2).replace(/\.00$/, '')}`;

export default function FreeAccessPage() {
  const { grants, loading, grantAccess, revokeAccess } = useFreeAccess();
  const { plans } = usePlans();
  const { organizations } = useOrganizations();

  const [orgId, setOrgId] = useState('');
  const [planId, setPlanId] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [revokingId, setRevokingId] = useState(null);

  const grantedOrgIds = new Set(grants.map(g => g.org_id));
  const eligibleOrgs = organizations.filter(o => !grantedOrgIds.has(o.id));

  const submit = async () => {
    if (!orgId || !planId) { setError('Choose an organization and a plan.'); return; }
    setSaving(true);
    setError('');
    try {
      await grantAccess({ orgId, planId, note });
      setOrgId(''); setPlanId(''); setNote('');
    } catch (err) {
      setError(err.message || 'Could not grant access.');
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (orgIdToRevoke) => {
    setRevokingId(orgIdToRevoke);
    try {
      await revokeAccess(orgIdToRevoke);
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2><Gift size={22} /> Free Access</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, alignItems: 'start' }}>
        <div className="card table-wrap">
          <table>
            <thead>
              <tr><th>Organization</th><th>Plan</th><th>Granted By</th><th>Note</th><th></th></tr>
            </thead>
            <tbody>
              {grants.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
                    {loading ? 'Loading…' : 'No active free-access grants.'}
                  </td>
                </tr>
              )}
              {grants.map(g => (
                <tr key={g.org_id}>
                  <td><strong>{g.org_name}</strong></td>
                  <td>{g.plan_name}</td>
                  <td>{g.granted_by || '—'}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 12.5 }}>{g.note || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      className="btn btn-sm"
                      style={{ background: 'var(--red-soft)', color: 'var(--red)', border: '1px solid rgba(239,68,68,.2)' }}
                      onClick={() => revoke(g.org_id)}
                      disabled={revokingId === g.org_id}
                    >
                      {revokingId === g.org_id ? 'Revoking…' : 'Revoke'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <Gift size={16} /> Grant Free Access
          </h3>
          {error && (
            <p style={{ color: 'var(--red)', fontSize: 13, background: 'var(--red-soft)', padding: '8px 12px', borderRadius: 10, margin: 0 }}>
              {error}
            </p>
          )}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Organization</label>
            <Dropdown
              value={orgId}
              onChange={setOrgId}
              options={[
                { value: '', label: 'Choose an organization…' },
                ...eligibleOrgs.map(o => ({ value: o.id, label: o.name }))
              ]}
              placeholder="Choose an organization…"
              style={{ width: '100%' }}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Plan</label>
            <Dropdown
              value={planId}
              onChange={setPlanId}
              options={[
                { value: '', label: 'Choose a plan…' },
                ...plans.filter(p => p.is_active).map(p => ({
                  value: p.id,
                  label: `${p.name}${p.is_free ? ' (Free)' : ` (${money(p.price_monthly)}/mo)`}`
                }))
              ]}
              placeholder="Choose a plan…"
              style={{ width: '100%' }}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Note (optional)</label>
            <input
              className="form-control" value={note} onChange={e => setNote(e.target.value)}
              placeholder="Why this grant exists"
            />
          </div>
          <Button type="button" variant="primary" disabled={saving} onClick={submit} style={{ width: '100%', justifyContent: 'center' }}>
            {saving ? 'Granting…' : 'Grant Access'}
          </Button>
          <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: 0 }}>
            Granting a plan already assigned elsewhere replaces that organization's current subscription.
          </p>
        </div>
      </div>
    </div>
  );
}
