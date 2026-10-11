/**
 * Which public sets may serve as build data. MM-Fit: both wrists and both ankles seen together in at least
 * 90% of the samples (PLAN.md, the rule of 27 September for MM-Fit). RepCount-A has no rule in PLAN.md: its
 * sets are admitted, and their visible share is recorded and shown beside every result.
 */
export const admitted = (dataset, visibleShare) => (dataset === 'mmfit' ? visibleShare >= 0.9 : true);
