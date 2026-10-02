// Whether the screens, the report and the exports show the measures the pose gives beyond the count:
// range in degrees and the bars drawn from it, rep and phase times, tempo, angular speeds and their
// change, time under tension, the short-rep marks and the slowdown. None is validated on real phone
// video yet, so each is shown under the experimental label below, as DIRECTIVES.md Phase 3.3 allows
// ("keep them in a section explicitly labelled experimental"); David's order of 1 October 2026 to restore
// the analysis. Set to false to hide them all again. Status: none validated.
export const MEASURES_SHOWN = true;

/** The words that stand beside every measure while none is validated. Copy for David's approval (R10). */
export const experimentalLabel = fr => (fr
  ? 'Mesures expérimentales\u00A0: estimées par l’app, pas encore validées.'
  : 'Experimental measures: estimated by the app, not yet validated.');

// Whether the speed change between the first and last reps is stated (account, opener, expert line, report).
// Off since 2 October 2026 (David's standing order, PLAN.md; design review): on 89 synthetic sets whose
// reps were built alike, the change read 15 % at the median, 72 % at the 90th percentile and up to 180 %
// (review of 7d30d29, from synth/out); David's sets read 0 to -33 %. Phase timing cannot tell a real
// change from that noise, so a sentence such as "6 % faster" stated noise as a finding (R8).
// Back on once a set's change can be told from that noise. Status: not validated.
export const SPEED_CHANGE_SHOWN = false;
