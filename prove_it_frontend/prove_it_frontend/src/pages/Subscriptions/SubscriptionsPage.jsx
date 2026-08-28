import { useState } from 'react';
import { Building2 } from 'lucide-react';
import useSubscriptions from './useSubscriptions.js';
import usePlans from '../Plans/usePlans.js';
import useOrganizations from '../Organizations/useOrganizations.js';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Dropdown from '../../components/ui/Dropdown.jsx';

const money = (value) => `$${Number(value || 0).toFixed(2).replace(/\.00$/, '')}`;

export default function SubscriptionsPage() {
  const { loading: subsLoading, assignSubscription, subscriptionFor } = useSubscriptions();
  const { plans } = usePlans();
  const { organizations, loading: orgsLoading } = useOrganizations();

  const [assigning, setAssigning] = useState(null);
  const [assignError, setAssignError] = useState('');
  const [savingAssign, setSavingAssign] = useState(false);

  const openAssign = (org) => {
    const sub = subscriptionFor(org.id);
    setAssignError('');
    setAssigning({
      orgId: org.id,
      orgName: org.name,
      planId: sub?.plan_id || '',
      isActive: sub ? sub.is_active : true,
      note: sub?.note || '',
    });
  };

  const saveAssign = async () => {
    setSavingAssign(true);
    setAssignError('');
    try {
      await assignSubscription(assigning.orgId, {
        planId: assigning.planId || null,
        isActive: assigning.isActive,
        note: assigning.note || null,
      });
      setAssigning(null);
    } catch (err) {
      setAssignError(err.message || 'Could not update this subscription.');
    } finally {
      setSavingAssign(false);
    }
  };

  const planName = (planId) => plans.find(p => p.id === planId)?.name || '—';

  return (
    <div>
      <div className="page-header">
        <h2><Building2 size={22} /> Subscriptions</h2>
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>Organization</th><th>Plan</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {organizations.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
                  {orgsLoading ? 'Loading…' : 'No organizations yet.'}
                </td>
              </tr>
            )}
            {organizations.map(org => {
              const sub = subscriptionFor(org.id);
              return (
                <tr key={org.id}>
                  <td><strong>{org.name}</strong></td>
                  <td>{sub?.plan_id ? planName(sub.plan_id) : '—'}</td>
                  <td><Badge status={sub?.is_active ? 'Active' : 'Inactive'} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      className="btn btn-sm"
                      style={{ background: 'var(--rose-soft)', color: 'var(--rose)', border: '1px solid var(--line)' }}
                      onClick={() => openAssign(org)}
                      disabled={subsLoading}
                    >
                      {sub?.plan_id ? 'Change Plan' : 'Assign Plan'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {assigning && (
        <Modal title={`Subscription for ${assigning.orgName}`} onClose={() => setAssigning(null)}>
          {assignError && (
            <p style={{ color: 'var(--red)', fontSize: 13, background: 'var(--red-soft)', padding: '8px 12px', borderRadius: 10, marginBottom: 12 }}>
              {assignError}
            </p>
          )}
          <div className="form-group">
            <label className="form-label">Plan</label>
            <Dropdown
              value={assigning.planId}
              onChange={planId => setAssigning({ ...assigning, planId })}
              options={[
                { value: '', label: 'No plan' },
                ...plans.filter(p => p.is_active).map(p => ({
                  value: p.id,
                  label: `${p.name}${p.is_free ? ' (Free)' : ` (${money(p.price_monthly)}/mo)`}`
                }))
              ]}
              placeholder="No plan"
              style={{ width: '100%' }}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0', fontSize: 13 }}>
            <input type="checkbox" checked={assigning.isActive} onChange={e => setAssigning({ ...assigning, isActive: e.target.checked })} />
            Active
          </label>
          <div className="form-group">
            <label className="form-label">Note (optional)</label>
            <input
              className="form-control" value={assigning.note}
              onChange={e => setAssigning({ ...assigning, note: e.target.value })}
              placeholder="Why this plan/status"
            />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <Button type="button" variant="primary" disabled={savingAssign} onClick={saveAssign}>
              {savingAssign ? 'Saving…' : 'Save'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAssigning(null)}>Cancel</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
