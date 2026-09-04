/**
 * SubscriptionGate — freemium paywall skeleton.
 *
 * Wraps an analysis trigger and checks daily limits before allowing it.
 * Shows an upgrade modal when the free tier is exhausted.
 *
 * NOT wired into the main analysis flow yet. Import and wrap when ready:
 *
 *   <SubscriptionGate onAllowed={startAnalysis}>
 *     <button>Analyze</button>
 *   </SubscriptionGate>
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import {
  PLANS,
  PLAN_LIMITS,
  getSubscription,
  checkAnalysisLimit,
  recordAnalysis,
  upgradePlan,
} from '../lib/subscription';

// ---------------------------------------------------------------------------
// useSubscription hook
// ---------------------------------------------------------------------------

const SubscriptionContext = createContext(null);

export function SubscriptionProvider({ children }) {
  const value = useSubscriptionInternal();
  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (ctx) return ctx;
  // Fallback: use the hook directly when no provider is present
  return useSubscriptionInternal();
}

function useSubscriptionInternal() {
  const [subscription, setSubscription] = useState(null);
  const [limitStatus, setLimitStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [sub, limit] = await Promise.all([getSubscription(), checkAnalysisLimit()]);
    setSubscription(sub);
    setLimitStatus(limit);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const record = useCallback(async () => {
    await recordAnalysis();
    await refresh();
  }, [refresh]);

  const upgrade = useCallback(async (plan) => {
    await upgradePlan(plan);
    await refresh();
  }, [refresh]);

  return { subscription, limitStatus, loading, refresh, record, upgrade };
}

// ---------------------------------------------------------------------------
// Upgrade modal (inline, no external dependencies)
// ---------------------------------------------------------------------------

function UpgradeModal({ limitStatus, onUpgrade, onClose }) {
  const used = PLAN_LIMITS[PLANS.FREE].analysesPerDay;

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h3 style={{ margin: '0 0 8px' }}>Daily limit reached</h3>
        <p style={{ margin: '0 0 16px', color: '#666' }}>
          You&rsquo;ve used {used}/{used} free analyses today.
          Upgrade for unlimited access.
        </p>

        {/* TODO: Replace these stubs with real Stripe Checkout or RevenueCat purchase flow.
            - PRO: Stripe price ID → create checkout session → redirect
            - COACH: same, different price ID
            - Mobile: RevenueCat offering → present paywall → validate receipt */}
        <button style={btnPrimary} onClick={() => onUpgrade(PLANS.PRO)}>
          Upgrade to Pro &mdash; Unlimited analyses
        </button>
        <button style={btnSecondary} onClick={() => onUpgrade(PLANS.COACH)}>
          Upgrade to Coach &mdash; Unlimited + Export
        </button>

        <button style={btnGhost} onClick={onClose}>Maybe later</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SubscriptionGate component
// ---------------------------------------------------------------------------

export default function SubscriptionGate({ onAllowed, children }) {
  const { limitStatus, loading, record, upgrade, refresh } = useSubscription();
  const [showModal, setShowModal] = useState(false);

  const handleClick = useCallback(async () => {
    const status = await checkAnalysisLimit();
    if (status.allowed) {
      await record();
      if (onAllowed) onAllowed();
    } else {
      setShowModal(true);
    }
  }, [record, onAllowed]);

  const handleUpgrade = useCallback(async (plan) => {
    await upgrade(plan);
    setShowModal(false);
    // After upgrading, allow the analysis immediately
    if (onAllowed) onAllowed();
  }, [upgrade, onAllowed]);

  if (loading) return null;

  return (
    <>
      <div onClick={handleClick} style={{ cursor: 'pointer' }}>
        {children}
      </div>
      {showModal && (
        <UpgradeModal
          limitStatus={limitStatus}
          onUpgrade={handleUpgrade}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Inline styles (keeps the skeleton dependency-free)
// ---------------------------------------------------------------------------

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
};

const modalStyle = {
  background: '#fff',
  borderRadius: 16,
  padding: 24,
  maxWidth: 340,
  width: '90%',
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const btnPrimary = {
  padding: '12px 16px',
  border: 'none',
  borderRadius: 10,
  background: '#4f46e5',
  color: '#fff',
  fontWeight: 600,
  fontSize: 15,
  cursor: 'pointer',
};

const btnSecondary = {
  padding: '12px 16px',
  border: '2px solid #4f46e5',
  borderRadius: 10,
  background: 'transparent',
  color: '#4f46e5',
  fontWeight: 600,
  fontSize: 15,
  cursor: 'pointer',
};

const btnGhost = {
  padding: '8px 16px',
  border: 'none',
  background: 'transparent',
  color: '#999',
  fontSize: 14,
  cursor: 'pointer',
};
