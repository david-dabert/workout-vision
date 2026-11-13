// Whether the screens, the report and the exports show the measures the pose gives beyond the count:
// range in degrees and the bars drawn from it, rep and phase times, tempo, angular speeds and their
// change, time under tension, the short-rep marks and the slowdown. None is validated on real phone
// video yet, so each is shown under the experimental label below, as DIRECTIVES.md Phase 3.3 allows
// ("keep them in a section explicitly labelled experimental"); David's order of 1 October 2026 to restore
// the analysis. Set to false to hide them all again. Status: none validated.
// Held against a known truth on 13 November 2026 (card 019, test/real-phone/synth/measures-error.test.ts): on the 24
// synthetic sets filmed at the view the filming guide asks for, the absolute error is range 19 degrees at the median and 36 at the 90th percentile; lifting time 0.5 s and 0.8 s; lowering time 0.5 s and 0.7 s.
// The error is one-sided: the app reads less range and shorter phases than the truth (pose model and phase bands,
// TRIED.md 6 October). Rendered bodies are not people: this bounds the error in clean conditions and validates nothing.
// Whether the screens keep these numbers is David's decision (card 020; his order of 1 October restored them).
export const MEASURES_SHOWN = true;

/** The words that stand beside every measure while none is validated. Copy approved by David on 9 October 2026 (R10). */
export const experimentalLabel = fr => (fr
  ? 'Mesures expérimentales\u00A0: estimées par l’appli, pas encore validées.'
  : 'Experimental measures: estimated by the app, not yet validated.');

// Whether the speed change between the first and last reps is stated (account, opener, expert line, report).
// Off since 2 October 2026 (David's standing order, PLAN.md; design review): on 89 synthetic sets whose
// reps were built alike, the change read 15 % at the median, 72 % at the 90th percentile and up to 180 %
// (review of 7d30d29, from synth/out); David's sets read 0 to -33 %. Phase timing cannot tell a real
// change from that noise, so a sentence such as "6 % faster" stated noise as a finding (R8).
// Back on once a set's change can be told from that noise. Status: not validated.
export const SPEED_CHANGE_SHOWN = false;

// Whether the screens show the biomechanical readings added from 10 to 11 November 2026 (PR #354 to #363): the replay's
// fault banners, target-angle HUD and inflection pins; on the result card the velocity decline, bilateral symmetry,
// knee valgus, kinetic chain, lumbopelvic, bar and scapular indices, the bar path efficiency and the height-derived
// "morpho" banner; the fatigue horizon badge. Off since 11 November 2026 (David: "fix this garbage", his iPhone
// screenshots of the replay). Measured that day on David's 20 stored sets with the screens' own calls: scapular
// stability reads "critical" on 20 of 20 (hip thrusts and leg press included), the bar index "critical tilt" on 16
// (curls and machines with no bar), "butt wink" on 13, "hip shoot" on 12, knee valgus 140.3 and 128.8 degrees on
// side views, velocity decline 0 to 82 % (median 40 %), the signal SPEED_CHANGE_SHOWN above records as noise.
// The engines and their tests stay in the repository, unchanged. Back on, reading by reading, once each one is
// held against a labelled reference (R8, R16). Status: none validated.
export const UNVALIDATED_BIOMECHANICS_SHOWN = false;

// Card 011, lab lane: today's set beside the person's best set of the same exercise on the saved result (BestSet.jsx).
// Off in production until card 001 has passed (cards/README.md): it rests on the same engine and on range and tempo,
// which are not validated. Status: experimental.
export const BEST_SET_SHOWN = false;

// Card 015 (docs/FLAWS-2026-11.md #6): whether the kiné follow-up shows the clinical trend of clinicalTrendAnalysis.ts.
// The engine takes the mean share of each session's measures within tolerance, compares the first session with the
// last, and names a trajectory from that one difference (10 points or more « accélérée », 3 « progression », -3 to 3
// « plateau », below « vigilance compensation »), with a cause it does not measure (« fatigue neuromusculaire »,
// « contrôle moteur »). Its thresholds carry no source and no eval holds it against a physiotherapist's judgment
// (R9, R16). The follow-up keeps what is measured: each session's share within tolerance and the change from the first
// dated session to the last. Off in production until the trend has its eval. Status: experimental.
export const CLINICAL_TREND_SHOWN = false;
