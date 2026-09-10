import { useState } from 'react';
import { CreditCard, Check, Loader2, AlertCircle, Info } from 'lucide-react';
import useAuth from '../../hooks/useAuth.jsx';
import useMySubscription from './useMySubscription.js';
import useAvailablePlans from './useAvailablePlans.js';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import './SubscriptionPage.css';

const money = (value) => `$${Number(value || 0).toFixed(2).replace(/\.00$/, '')}`;

export default function SubscriptionPage() {
  const { user } = useAuth();
  const { plans, loading: plansLoading, error: plansError } = useAvailablePlans();
  const { subscription, loading: subsLoading } = useMySubscription();

  const [upgradeOpen, setUpgradeOpen] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [upgradeError, setUpgradeError] = useState('');
  const [upgrading, setUpgrading] = useState(false);

  const currentSub = subscription;
  const currentPlan = currentSub?.plan_id ? plans.find(p => p.id === currentSub.plan_id) : null;

  const handleUpgradeClick = (plan) => {
    setSelectedPlanId(plan.id);
    setUpgradeError('');
    setUpgradeOpen(true);
  };

  const handleConfirmUpgrade = async () => {
    if (!user?.org_id || !selectedPlanId) return;
    setUpgrading(true);
    setUpgradeError('');
    try {
      const { patch } = await import('../../services/httpClient.js');
      await patch(`/api/subscriptions/${user.org_id}`, { plan_id: selectedPlanId, is_active: true, note: null });
      setUpgradeOpen(false);
      setSelectedPlanId(null);
    } catch (err) {
      setUpgradeError(err.message || 'Could not update your subscription.');
    } finally {
      setUpgrading(false);
    }
  };

  const loading = plansLoading || subsLoading;

  if (!user?.org_id) {
    return (
      <div>
        <div className="page-header">
          <h2><CreditCard size={22} /> Subscription & Billing</h2>
        </div>
        <div className="subscription-empty">Unable to load subscription information.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h2><CreditCard size={22} /> Subscription & Billing</h2>
      </div>

      <div className="subscription-page">
        {/* Header Section */}
        <div className="subscription-header">
          <div className="subscription-eyebrow">ACCOUNT</div>
          <h1 className="subscription-main-title">Subscription & Billing</h1>
          <p className="subscription-description">
            See your plan, what it unlocks, and manage your subscription.
          </p>
        </div>

        {/* Info Card */}
        <div className="subscription-info-card">
          <div className="info-card-icon">
            <Info size={16} />
          </div>
          <div className="info-card-content">
            <h3>How your subscription works</h3>
            <p>
              Your organization's features and access are determined by your current plan.
              Change plans anytime to unlock or reduce features.
            </p>
          </div>
        </div>

        {/* Error Display */}
        {plansError && (
          <div className="subscription-error-banner">
            <AlertCircle size={16} />
            <span>Unable to load plans: {plansError}</span>
          </div>
        )}

        {/* Current Plan Section */}
        {currentPlan ? (
          <div className="subscription-section">
            <h2 className="section-title">Your Current Plan</h2>
            <div className="current-plan-card">
              <div className="current-plan-header">
                <div>
                  <h3 className="current-plan-name">{currentPlan.name}</h3>
                  <span className="current-plan-badge">Current Plan</span>
                </div>
                <div className="current-plan-price">
                  {currentPlan.is_free ? (
                    <span className="price-free">Free</span>
                  ) : (
                    <span className="price-amount">{money(currentPlan.price_monthly)}/mo</span>
                  )}
                </div>
              </div>
              <p className="current-plan-description">{currentPlan.description}</p>
              {currentPlan.features && currentPlan.features.length > 0 && (
                <div className="current-plan-features">
                  <h4>Included features:</h4>
                  <ul className="features-list">
                    {currentPlan.features.map(feature => (
                      <li key={feature} className="feature-item">
                        <Check size={16} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="subscription-section">
            <h2 className="section-title">Your Current Plan</h2>
            <div className="no-plan-state">
              <p>No active plan assigned. Choose a plan below to get started.</p>
            </div>
          </div>
        )}

        {/* Choose Plan Section */}
        <div className="subscription-section">
          <h2 className="section-title">Choose a Plan</h2>

          {loading && (
            <div className="loading-state">
              <Loader2 size={20} className="spin" />
              <span>Loading plans...</span>
            </div>
          )}

          {!loading && plans.length === 0 && (
            <div className="empty-state">No plans available.</div>
          )}

          {!loading && plans.length > 0 && (
            <div className="plans-grid">
              {plans.map(plan => {
                const isCurrent = currentPlan?.id === plan.id;
                return (
                  <div
                    key={plan.id}
                    className={`plan-card ${isCurrent ? 'plan-card-current' : ''}`}
                  >
                    <div className="plan-header">
                      <h3 className="plan-name">{plan.name}</h3>
                      <div className="plan-price-badge">
                        {plan.is_free ? 'Free' : money(plan.price_monthly)}
                      </div>
                    </div>

                    <p className="plan-description">{plan.description}</p>

                    {plan.features && plan.features.length > 0 && (
                      <div className="plan-features">
                        <ul className="features-list">
                          {plan.features.map(feature => (
                            <li key={feature} className="feature-item">
                              <Check size={14} />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {isCurrent ? (
                      <div className="plan-current-state">Current Plan</div>
                    ) : (
                      <Button
                        variant="primary"
                        className="plan-action-button"
                        onClick={() => handleUpgradeClick(plan)}
                      >
                        {currentPlan ? 'Switch to This Plan' : 'Choose This Plan'}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upgrade Modal */}
        {upgradeOpen && selectedPlanId && (
          <Modal
            title="Confirm Plan Change"
            onClose={() => {
              if (!upgrading) setUpgradeOpen(false);
            }}
          >
            {upgradeError && (
              <p style={{
                color: '#C24868',
                fontSize: 13,
                background: '#FEE8EA',
                padding: '8px 12px',
                borderRadius: 10,
                marginBottom: 12,
                border: '1px solid #F5B5C2',
              }}>
                {upgradeError}
              </p>
            )}
            <p style={{ marginBottom: 16, fontSize: 14, color: 'var(--ink)' }}>
              Are you sure you want to change your plan to <strong>{plans.find(p => p.id === selectedPlanId)?.name}</strong>?
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <Button
                type="button"
                variant="primary"
                disabled={upgrading}
                onClick={handleConfirmUpgrade}
              >
                {upgrading ? 'Confirming...' : 'Confirm'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={upgrading}
                onClick={() => setUpgradeOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}
