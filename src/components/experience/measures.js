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
// Off since 2 October 2026 (David's standing order, PLAN.md; design review): on David's sets and the
// synthetic ones the change moves by 5-15 % with no change in the movement, within the noise of phase
// timing (test/real-phone/synth/synth.txt), so a sentence such as "6 % faster" stated noise as a finding (R8).
// Back on once a set's change can be told from that noise. Status: not validated.
export const SPEED_CHANGE_SHOWN = false;
