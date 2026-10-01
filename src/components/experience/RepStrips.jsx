// Per-rep strips under the question (David, 1 October 2026: the V1 charts, on the current engine). Each strip
// keeps the marks' columns, so a rep reads straight down from its mark: its concentric time (up) and
// eccentric time (down) from a midline, and, for a set filmed from the front, its gap between the two sides
// (up when the right moved further, down when the left did). One hue throughout; series differ by direction
// and fill, never by colour alone (the two-tone pair fails the palette check: dataviz validator,
// normal-vision dE 14.8). Scales are fixed, so the same height means the same value on every set, and no
// axis number is printed beside the set's own numbers. Every value is experimental (measures.js).
import { GAP_SI } from '../../lib/counting/symmetry';

// The time a phase bar reaches full height; a longer phase is drawn full, with a flat cap. Source: UNSOURCED,
// chosen from David's sets, whose phases run 0.5-1.6 s, so a usual rep fills half the strip or more.
// Status: convention.
export const TEMPO_FULL_SEC = 2;
// The gap between sides a bar reaches full height; larger gaps are drawn full. Source: UNSOURCED (80 % of
// public front clips lie within about ±30 %, front.txt). Status: convention.
export const GAP_FULL = 40;
// Smaller per-rep gaps draw no bar: below a degree's worth of difference on a 90° rep. Status: convention.
const GAP_NONE = 1;

const TEMPO_H = 34, GAP_H = 28; // px each side of the midline

/** Each rep's gap, (R - L) / mean x 100, the index of the set's line. */
export const repGap = s => ((s.right - s.left) / ((s.left + s.right) / 2)) * 100;

export default function RepStrips({ reps, sel, shown, sides, fr, onPick }) {
  const whole = reps.filter(r => !r.clipped);
  const byAt = new Map((sides || []).map(s => [s.at, s]));
  const hasSides = (sides || []).length > 0;
  if (!whole.length && !hasSides) return null;
  const cls = i => `strip-col${i < shown ? ' lit' : ''}${i === sel ? ' sel' : ''}`;
  const width = { width: `min(100%, ${reps.length * 36}px)` };
  const h = (t, H) => Math.max(2, Math.min(H, (H * t) / TEMPO_FULL_SEC));
  const NB = ' ';
  return <div className={`strips${sel >= 0 ? ' has-sel' : ''}`} data-testid="rep-strips" onClick={onPick}>
    {whole.length > 0 && <div className="strip" aria-hidden="true" data-testid="strip-tempo">
      <p className="strip-head"><span className="strip-label">Tempo</span><span className="strip-key">{fr ? `concentrique en haut, excentrique en bas` : `concentric above, eccentric below`}</span></p>
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
      <p className="strip-head"><span className="strip-label">{fr ? 'Gauche, droite' : 'Left, right'}</span><span className="strip-key">{fr ? `droite plus ample en haut, gauche en bas, bande grisée ±${GAP_SI}${NB}%` : `right wider above, left below, shaded band ±${GAP_SI}%`}</span></p>
      <div className="strip-cols mid sides" style={{ ...width, height: 2 * GAP_H + 2, '--band': `${(GAP_H * GAP_SI) / GAP_FULL}px` }}>
        {reps.map((r, i) => {
          const s = byAt.get(i);
          if (!s) return <div key={r.index} className={cls(i)} />;
          const g = repGap(s), mag = Math.min(Math.abs(g), GAP_FULL);
          const bar = mag < GAP_NONE ? null
            : <i className={`g-bar ${g > 0 ? 'up' : 'down'}${mag < GAP_SI ? ' in-band' : ''}${Math.abs(g) > GAP_FULL ? ' capped' : ''}`} style={{ height: Math.max(2, (GAP_H * mag) / GAP_FULL) }} />;
          return <div key={r.index} className={cls(i)}>
            <span className="t-half">{g > 0 && bar}</span>
            <span className="t-half low">{g < 0 && bar}</span>
          </div>;
        })}
      </div>
    </div>}
  </div>;
}
