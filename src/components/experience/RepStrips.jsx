// Per-rep strips under the question (David, 1 October 2026: the V1 charts, on the current engine). Each strip
// keeps the marks' columns, so a rep reads straight down from its mark: its concentric time (up) and
// eccentric time (down) from a midline, and, for a set filmed from the front, its gap between the two sides
// (up when the right moved further, down when the left did). One hue throughout; series differ by direction
// and fill, never by colour alone (the two-tone pair fails the palette check: dataviz validator,
// normal-vision dE 14.8). Scales are fixed, so the same height means the same value on every set, and no
// axis number is printed beside the set's own numbers; every gap bar has one weight, so no rep is singled
// out (no verdict: R8, EU MDR Rule 11). A tapped rep's values appear under the strips. Every value is
// experimental (measures.js).
import { decimal } from './report-sheet';

// The time a phase bar reaches full height; a longer phase is drawn full, with a flat cap. Source: chosen
// from David's labelled sets, whose phases run about 0.4-1.9 s, so a usual rep fills a third of the strip
// or more. Status: experimental.
export const TEMPO_FULL_SEC = 1.5;
// The gap between sides a bar reaches full height; larger gaps are drawn full, with a flat cap. Source:
// chosen from front.txt, whose middle 80 % of public front clips lies within about -21 % to +24 %, so
// those fill about half the strip. Status: experimental.
export const GAP_FULL = 40;
// Smaller per-rep gaps draw no bar and read "sides equal": below a degree's worth of difference on a 90°
// rep. Source: UNSOURCED. Status: experimental.
const GAP_NONE = 1;

const TEMPO_H = 34, GAP_H = 28; // px each side of the midline

/** Each rep's gap, (R - L) / mean x 100, the index of the set's line. */
export const repGap = s => ((s.right - s.left) / ((s.left + s.right) / 2)) * 100;

/** Whether the strips draw anything for these reps and sides. */
export const hasStrips = (reps, sides) => reps.some(r => !r.clipped) || (sides || []).length > 0;

export default function RepStrips({ reps, sel, shown, sides, fr, onPick, markName = null }) {
  const whole = reps.filter(r => !r.clipped);
  const byAt = new Map((sides || []).map(s => [s.at, s]));
  const hasSides = (sides || []).length > 0;
  if (!hasStrips(reps, sides)) return null;
  const cls = i => `strip-col${i < shown ? ' lit' : ''}${i === sel ? ' sel' : ''}`;
  const width = { width: `min(100%, ${reps.length * 36}px)` };
  const h = (t, H) => Math.max(2, Math.min(H, (H * t) / TEMPO_FULL_SEC));
  const NB = ' ';
  return <div className={`strips${sel >= 0 ? ' has-sel' : ''}`} data-testid="rep-strips" onClick={onPick}>
    {whole.length > 0 && <div className="strip" aria-hidden="true" data-testid="strip-tempo">
      <p className="strip-head"><span className="strip-label">Tempo</span><span className="strip-key">{fr ? `↑${NB}concentrique · ↓${NB}excentrique` : `↑${NB}concentric · ↓${NB}eccentric`}</span></p>
      <div className="strip-cols mid" style={{ ...width, height: 2 * TEMPO_H + 2 }}>
        {reps.map((r, i) => <div key={r.index} className={cls(i)}>
          {r.clipped
            ? <b className="t-gap" />
            : <>
              <span className="t-half"><i className={`t-up${r.concentricSec > TEMPO_FULL_SEC ? ' capped' : ''}`} style={{ height: h(r.concentricSec || 0, TEMPO_H) }} /></span>
              <span className="t-half low"><i className={`t-down${r.eccentricSec > TEMPO_FULL_SEC ? ' capped' : ''}`} style={{ height: h(r.eccentricSec || 0, TEMPO_H) }} /></span>
            </>}
        </div>)}
      </div>
    </div>}
    {hasSides && <div className="strip" aria-hidden="true" data-testid="strip-sides">
      <p className="strip-head"><span className="strip-label">{fr ? 'Gauche, droite' : 'Left, right'}</span><span className="strip-key">{fr ? `↑${NB}droite plus ample · ↓${NB}gauche` : `↑${NB}right wider · ↓${NB}left`}</span></p>
      <div className="strip-cols mid sides" style={{ ...width, height: 2 * GAP_H + 2 }}>
        {reps.map((r, i) => {
          const s = byAt.get(i);
          if (!s) return <div key={r.index} className={cls(i)} />;
          const g = repGap(s), mag = Math.min(Math.abs(g), GAP_FULL);
          const bar = mag < GAP_NONE ? null
            : <i className={`g-bar ${g > 0 ? 'up' : 'down'}${Math.abs(g) > GAP_FULL ? ' capped' : ''}`} style={{ height: Math.max(2, (GAP_H * mag) / GAP_FULL) }} />;
          return <div key={r.index} className={cls(i)}>
            <span className="t-half">{g > 0 && bar}</span>
            <span className="t-half low">{g < 0 && bar}</span>
          </div>;
        })}
      </div>
    </div>}
    {/* Always present, so a tap moves nothing below; not live: the detail line under the marks already announces the rep. */}
    <p className="strip-caption" data-testid="strip-caption">{sel >= 0 && reps[sel] ? caption(reps[sel], byAt.get(sel), sel, fr, markName) : ''}</p>
  </div>;
}

// The chosen rep's values, under the strips, where the tap was made: its phase times and its gap between sides.
// After a corrected count the columns are the app's marks, not the saved reps: markName names them so
// (replay-labels.js), with "filmé" agreeing with "Repère".
function caption(r, s, i, fr, markName) {
  const NB = '\u00A0', sec = x => `${decimal(x, fr)}${NB}s`;
  const parts = [markName ? markName(i) : `${fr ? 'Rép.' : 'Rep'}${NB}${i + 1}`];
  if (r.clipped) parts.push(fr ? (markName ? 'filmé en partie' : 'filmée en partie') : 'partly filmed');
  else parts.push(`conc.${NB}${sec(r.concentricSec)}`, `${fr ? 'exc.' : 'ecc.'}${NB}${sec(r.eccentricSec)}`);
  if (s) {
    const raw = repGap(s), g = Math.round(raw);
    parts.push(Math.abs(raw) < GAP_NONE ? (fr ? `côtés${NB}égaux` : `sides${NB}equal`) : fr ? `${g > 0 ? 'droite' : 'gauche'}${NB}+${Math.abs(g)}${NB}%` : `${g > 0 ? 'right' : 'left'}${NB}+${Math.abs(g)}%`);
  }
  return parts.join(`${NB}· `);
}
