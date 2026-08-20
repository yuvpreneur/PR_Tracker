import { useState } from 'react';
import { CreditCard, Plus, Pencil, Archive, RotateCcw } from 'lucide-react';
import usePlans from './usePlans.js';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Modal from '../../components/ui/Modal.jsx';

const blankPlan = { name: '', description: '', price_monthly: 0, is_free: false, features: [] };

const money = (value) => `$${Number(value || 0).toFixed(2).replace(/\.00$/, '')}`;

// Must stay in sync with MODULES in app/core/permissions.py — these are the modules
// get_effective_permissions() actually gates by an org's plan (see permissions.py's
// get_org_plan_features()), not a decorative list.
const FEATURE_MODULES = [
  'Companies', 'Projects', 'Project Codes', 'Billing Codes', 'Employees', 'Hourly Costs',
  'Timesheets', 'Expenses', 'Leave', 'Service Desk', 'Receivables', 'Invoices',
  'Reports', 'Approvals', 'Payroll',
];

export default function PlansPage() {
  const { plans, loading, createPlan, updatePlan } = usePlans();

  const [editingPlan, setEditingPlan] = useState(null);
  const [planError, setPlanError] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);

  const savePlan = async () => {
    if (!editingPlan.name.trim()) { setPlanError('Plan name is required.'); return; }
    setSavingPlan(true);
    setPlanError('');
    try {
      const body = {
        name: editingPlan.name.trim(),
        description: editingPlan.description,
        price_monthly: editingPlan.is_free ? 0 : Math.max(0, Number(editingPlan.price_monthly) || 0),
        is_free: editingPlan.is_free,
        features: editingPlan.features,
      };
      if (editingPlan.id) await updatePlan(editingPlan.id, body);
      else await createPlan(body);
      setEditingPlan(null);
    } catch (err) {
      setPlanError(err.message || 'Could not save this plan.');
    } finally {
      setSavingPlan(false);
    }
  };

  const toggleArchived = (plan) => updatePlan(plan.id, { is_active: !plan.is_active });

  const toggleFeature = (key) => {
    const has = editingPlan.features.includes(key);
    setEditingPlan({
      ...editingPlan,
      features: has ? editingPlan.features.filter(f => f !== key) : [...editingPlan.features, key],
    });
  };

  return (
    <div>
      <div className="section-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><CreditCard size={22} /> Plans</h2>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ margin: 0 }}>Plan catalog</h3>
        <Button variant="primary" onClick={() => { setEditingPlan({ ...blankPlan }); setPlanError(''); }}>
          <Plus size={14} /> New Plan
        </Button>
      </div>

      {plans.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
          {loading ? 'Loading…' : 'No plans yet — create the first one.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {plans.map(plan => (
            <div key={plan.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: plan.is_active ? 1 : 0.65 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <strong style={{ fontSize: 15 }}>{plan.name}</strong>
                <Badge status={plan.is_active ? 'Active' : 'Inactive'} />
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>
                {plan.is_free ? 'Free' : `${money(plan.price_monthly)}/mo`}
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted)', minHeight: 32, margin: 0 }}>{plan.description || '—'}</p>
              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{(plan.features || []).length} of {FEATURE_MODULES.length} features enabled</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                <button
                  className="btn btn-sm"
                  style={{ background: 'var(--soft)', color: 'var(--accent)', border: '1px solid var(--line)' }}
                  onClick={() => { setEditingPlan({ ...blankPlan, ...plan }); setPlanError(''); }}
                >
                  <Pencil size={13} /> Edit
                </button>
                <button
                  className="btn btn-sm"
                  style={{ background: 'var(--soft)', color: 'var(--accent)', border: '1px solid var(--line)' }}
                  onClick={() => toggleArchived(plan)}
                >
                  {plan.is_active ? <><Archive size={13} /> Archive</> : <><RotateCcw size={13} /> Restore</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingPlan && (
        <Modal title={editingPlan.id ? `Edit ${editingPlan.name}` : 'New Plan'} onClose={() => setEditingPlan(null)}>
          {planError && (
            <p style={{ color: 'var(--red)', fontSize: 13, background: 'var(--red-soft)', padding: '8px 12px', borderRadius: 10, marginBottom: 12 }}>
              {planError}
            </p>
          )}
          <div className="form-group">
            <label className="form-label">Plan name</label>
            <input className="form-control" value={editingPlan.name} onChange={e => setEditingPlan({ ...editingPlan, name: e.target.value })} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-control" value={editingPlan.description} onChange={e => setEditingPlan({ ...editingPlan, description: e.target.value })} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0', fontSize: 13 }}>
            <input type="checkbox" checked={editingPlan.is_free} onChange={e => setEditingPlan({ ...editingPlan, is_free: e.target.checked })} />
            Free plan
          </label>
          {!editingPlan.is_free && (
            <div className="form-group">
              <label className="form-label">Price / month (USD)</label>
              <input
                className="form-control" type="number" min="0" step="0.01"
                value={editingPlan.price_monthly}
                onChange={e => setEditingPlan({ ...editingPlan, price_monthly: e.target.value })}
              />
            </div>
          )}
          <label className="form-label" style={{ marginTop: 6, display: 'block' }}>
            Features included <span style={{ fontWeight: 400, textTransform: 'none' }}>— what this plan's organizations can actually access</span>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 16, maxHeight: 220, overflowY: 'auto' }}>
            {FEATURE_MODULES.map(mod => (
              <label key={mod} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                <input type="checkbox" checked={editingPlan.features.includes(mod)} onChange={() => toggleFeature(mod)} />
                {mod}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <Button type="button" variant="primary" disabled={savingPlan} onClick={savePlan}>
              {savingPlan ? 'Saving…' : editingPlan.id ? 'Save Plan' : 'Create Plan'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditingPlan(null)}>Cancel</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
