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
  // Always call the hook (React rules) but prefer the context value if available
  const fallback = useSubscriptionInternal();
  return ctx || fallback;
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

// ---------------------------------------------------------------------------
// Stripe Payment Links
// Replace with real Stripe Payment Links from your Stripe Dashboard
// ---------------------------------------------------------------------------

const STRIPE_MONTHLY_LINK = 'https://buy.stripe.com/placeholder-monthly';
const STRIPE_ANNUAL_LINK = 'https://buy.stripe.com/placeholder-annual';

// ---------------------------------------------------------------------------
// Upgrade modal — bioluminescent design system
// ---------------------------------------------------------------------------

function UpgradeModal({ limitStatus, onClose }) {
  const dailyLimit = PLAN_LIMITS[PLANS.FREE].analysesPerDay;
  const usedToday = limitStatus
    ? Math.max(0, dailyLimit - (limitStatus.remaining ?? 0))
    : dailyLimit;

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>

        {/* Header glow icon */}
        <div style={iconWrapStyle}>
          <span style={{ fontSize: 28 }}>⚡</span>
        </div>

        <h3 style={headingStyle}>Daily limit reached</h3>

        {/* Usage indicator */}
        <div style={usageBadgeStyle}>
          <span style={{ color: 'rgba(240,240,245,0.5)', fontSize: '0.78rem' }}>
            {usedToday} of {dailyLimit} free analyses used today
          </span>
          <div style={usageBarTrackStyle}>
            <div style={{ ...usageBarFillStyle, width: `${(usedToday / dailyLimit) * 100}%` }} />
          </div>
        </div>

        {/* What Pro includes */}
        <ul style={featureListStyle}>
          {[
            'Unlimited daily analyses',
            'Advanced joint angle charts',
            'PDF workout reports',
            'Form baseline tracking',
            'Priority AI model access',
          ].map((feat) => (
            <li key={feat} style={featureItemStyle}>
              <span style={featureDotStyle} />
              <span style={{ fontSize: '0.82rem', color: 'rgba(240,240,245,0.85)' }}>{feat}</span>
            </li>
          ))}
        </ul>

        {/* Pricing buttons — link to Stripe Payment Links */}
        {/* Replace with real Stripe Payment Links from your Stripe Dashboard */}
        <a
          href={STRIPE_MONTHLY_LINK}
          target="_blank"
          rel="noopener noreferrer"
          style={btnPrimaryStyle}
        >
          <span style={{ fontWeight: 700 }}>€3.99 / month</span>
          <span style={{ fontSize: '0.72rem', opacity: 0.75, display: 'block', marginTop: 2 }}>
            Start today, cancel anytime
          </span>
        </a>

        <a
          href={STRIPE_ANNUAL_LINK}
          target="_blank"
          rel="noopener noreferrer"
          style={btnSecondaryStyle}
        >
          <span style={{ fontWeight: 700 }}>€29.99 / year</span>
          <span style={saveBadgeStyle}>Save 37%</span>
          <span style={{ fontSize: '0.72rem', opacity: 0.7, display: 'block', marginTop: 2 }}>
            Best value — €2.50/month
          </span>
        </a>

        {/* Privacy note */}
        <p style={privacyNoteStyle}>
          Everything stays on-device. No video ever leaves your phone.
        </p>

        <button style={btnGhostStyle} onClick={onClose}>Maybe later</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SubscriptionGate component
// ---------------------------------------------------------------------------

export default function SubscriptionGate({ onAllowed, children }) {
  const { limitStatus, loading, record } = useSubscription();
  const [showModal, setShowModal] = useState(false);

  const handleClick = useCallback(async () => {
    // Re-check limit fresh at click time (date may have rolled over)
    const status = await checkAnalysisLimit();
    if (status.allowed) {
      await record();
      if (onAllowed) onAllowed();
    } else {
      setShowModal(true);
    }
  }, [record, onAllowed]);

  if (loading) return null;

  return (
    <>
      <div onClick={handleClick} style={{ cursor: 'pointer', display: 'contents' }}>
        {children}
      </div>
      {showModal && (
        <UpgradeModal
          limitStatus={limitStatus}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Inline styles — bioluminescent design system
// ---------------------------------------------------------------------------

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.82)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  padding: '0 16px',
};

const modalStyle = {
  background: 'linear-gradient(160deg, #0c0c12 0%, #07070a 100%)',
  border: '1px solid rgba(0,245,212,0.18)',
  borderRadius: 20,
  padding: '28px 24px 24px',
  maxWidth: 360,
  width: '100%',
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  boxShadow: '0 0 60px rgba(0,245,212,0.08), 0 24px 48px rgba(0,0,0,0.6)',
};

const iconWrapStyle = {
  width: 56,
  height: 56,
  borderRadius: '50%',
  background: 'rgba(0,245,212,0.1)',
  border: '1.5px solid rgba(0,245,212,0.3)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: '0 auto 4px',
  boxShadow: '0 0 24px rgba(0,245,212,0.15)',
};

const headingStyle = {
  margin: 0,
  fontSize: '1.15rem',
  fontWeight: 800,
  color: '#f0f0f5',
  letterSpacing: '-0.02em',
};

const usageBadgeStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 10,
  padding: '10px 14px',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  textAlign: 'left',
};

const usageBarTrackStyle = {
  height: 4,
  background: 'rgba(255,255,255,0.08)',
  borderRadius: 2,
  overflow: 'hidden',
};

const usageBarFillStyle = {
  height: '100%',
  background: 'linear-gradient(90deg, #00f5d4, #ff3b5c)',
  borderRadius: 2,
  transition: 'width 0.4s ease',
};

const featureListStyle = {
  listStyle: 'none',
  margin: 0,
  padding: '4px 0',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  textAlign: 'left',
};

const featureItemStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
};

const featureDotStyle = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: '#00f5d4',
  boxShadow: '0 0 8px #00f5d4',
  flexShrink: 0,
  marginTop: 6,
};

const btnPrimaryStyle = {
  display: 'block',
  padding: '14px 16px',
  borderRadius: 12,
  background: 'linear-gradient(135deg, #00f5d4 0%, #00e676 100%)',
  color: '#000',
  fontWeight: 700,
  fontSize: '0.95rem',
  textDecoration: 'none',
  cursor: 'pointer',
  boxShadow: '0 0 24px rgba(0,245,212,0.3)',
  letterSpacing: '-0.01em',
};

const btnSecondaryStyle = {
  display: 'block',
  padding: '14px 16px',
  borderRadius: 12,
  background: 'rgba(0,245,212,0.07)',
  border: '1.5px solid rgba(0,245,212,0.35)',
  color: '#00f5d4',
  fontWeight: 700,
  fontSize: '0.95rem',
  textDecoration: 'none',
  cursor: 'pointer',
  position: 'relative',
  letterSpacing: '-0.01em',
};

const saveBadgeStyle = {
  display: 'inline-block',
  marginLeft: 8,
  padding: '2px 8px',
  background: 'rgba(0,245,212,0.15)',
  border: '1px solid rgba(0,245,212,0.3)',
  borderRadius: 20,
  fontSize: '0.68rem',
  fontWeight: 700,
  letterSpacing: '0.02em',
  verticalAlign: 'middle',
};

const privacyNoteStyle = {
  margin: 0,
  fontSize: '0.7rem',
  color: 'rgba(240,240,245,0.35)',
  lineHeight: 1.5,
};

const btnGhostStyle = {
  padding: '8px 16px',
  border: 'none',
  background: 'transparent',
  color: 'rgba(240,240,245,0.35)',
  fontSize: '0.82rem',
  cursor: 'pointer',
  letterSpacing: '-0.01em',
};
