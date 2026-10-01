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
