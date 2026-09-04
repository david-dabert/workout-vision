/**
 * Freemium subscription state management.
 * Persists plan and daily usage counters in IndexedDB via localforage.
 * No real payment integration yet; upgradePlan() is a stub.
 */

import localforage from 'localforage';

const subscriptionStore = localforage.createInstance({
  name: 'workoutVision',
  storeName: 'subscription',
});

// ---------------------------------------------------------------------------
// Plan definitions
// ---------------------------------------------------------------------------

export const PLANS = {
  FREE: 'free',
  PRO: 'pro',
  COACH: 'coach',
};

export const PLAN_LIMITS = {
  [PLANS.FREE]: { analysesPerDay: 3, exportEnabled: false },
  [PLANS.PRO]: { analysesPerDay: Infinity, exportEnabled: false },
  [PLANS.COACH]: { analysesPerDay: Infinity, exportEnabled: true },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayDateString() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function defaultSubscription() {
  return {
    plan: PLANS.FREE,
    expiresAt: null,
    analysesUsedToday: 0,
    lastResetDate: todayDateString(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read the current subscription state from IndexedDB.
 * Auto-resets the daily counter when the calendar date has changed.
 */
export async function getSubscription() {
  let sub = await subscriptionStore.getItem('current');
  if (!sub) {
    sub = defaultSubscription();
    await subscriptionStore.setItem('current', sub);
  }

  // Auto-reset daily counter at midnight
  const today = todayDateString();
  if (sub.lastResetDate !== today) {
    sub.analysesUsedToday = 0;
    sub.lastResetDate = today;
    await subscriptionStore.setItem('current', sub);
  }

  return sub;
}

/**
 * Check whether the user is allowed to run another analysis right now.
 * Returns { allowed, remaining, plan }.
 */
export async function checkAnalysisLimit() {
  const sub = await getSubscription();
  const limit = PLAN_LIMITS[sub.plan]?.analysesPerDay ?? 3;
  const allowed = sub.analysesUsedToday < limit;
  const remaining = Math.max(0, limit === Infinity ? Infinity : limit - sub.analysesUsedToday);

  return { allowed, remaining, plan: sub.plan };
}

/**
 * Increment the daily analysis counter by one.
 * Automatically resets if the date has rolled over.
 */
export async function recordAnalysis() {
  const sub = await getSubscription(); // handles date reset
  sub.analysesUsedToday += 1;
  await subscriptionStore.setItem('current', sub);
  return sub;
}

/**
 * Stub: set the user's plan in localforage.
 * In production this would be called after a successful Stripe/RevenueCat
 * payment confirmation webhook or client-side receipt validation.
 *
 * @param {string} plan - One of PLANS.PRO or PLANS.COACH
 * @param {string|null} expiresAt - ISO date string, or null for lifetime
 */
export async function upgradePlan(plan, expiresAt = null) {
  // TODO: Replace with real payment verification.
  //       - Stripe Checkout: create session server-side, confirm here after redirect.
  //       - RevenueCat (mobile): validate receipt, then write plan.
  //       - Never trust client-side plan assignment in production.
  if (!Object.values(PLANS).includes(plan)) {
    throw new Error(`Unknown plan: ${plan}`);
  }

  const sub = await getSubscription();
  sub.plan = plan;
  sub.expiresAt = expiresAt;
  await subscriptionStore.setItem('current', sub);
  return sub;
}
