// Per-rep strips under the marks (David, 1 October 2026: the V1 charts, on the current engine). Each strip
// shares the marks' columns, so a rep reads straight down: its range (the marks above), its concentric time
// (up) and eccentric time (down) from a midline, and, for a set filmed from the front, its gap between the
// two sides (up when the right moved further, down when the left did). One hue throughout; series differ by
// direction and fill, never by colour alone (the two-tone pair fails the palette check: dataviz validator,
// normal-vision dE 14.8). Each strip's scale end is printed in its legend.
// Every value is experimental (measures.js); the screen's label says so. Tapping a column selects that rep
// in every strip, as tapping a mark does.
import { decimal } from './report-sheet';

const TEMPO_H = 26;  // px each side of the midline
const SIDES_H = 22;  // px each side of the midline

export default function RepStrips({ reps, sel, shown, sides, fr, onPick }) {
  const whole = reps.filter(r => !r.clipped);
  const maxPhase = Math.max(0.1, ...whole.flatMap(r => [r.concentricSec || 0, r.eccentricSec || 0]));
  const byAt = new Map((sides || []).map(s => [s.at, s]));
  // Each rep's gap, (R - L) / mean x 100, the index of the line below; the scale's end is the largest gap
  // rounded up to 10 %, at least 20 %, so a small gap stays small.
  const gap = s => ((s.right - s.left) / ((s.left + s.right) / 2)) * 100;
  const span = Math.max(20, Math.ceil(Math.max(0, ...(sides || []).map(s => Math.abs(gap(s)))) / 10) * 10);
  const cls = i => `strip-col${i < shown ? ' lit' : ''}${i === sel ? ' sel' : ''}`;
  const NB = '\u00A0', pc = fr ? `${NB}%` : '%';
  return <div className={`strips${sel >= 0 ? ' has-sel' : ''}`} data-testid="rep-strips" onClick={onPick}>
    <div className="strip" aria-hidden="true">
      <p className="strip-head"><span>Tempo</span><span>{`↑${NB}conc. · ↓${NB}${fr ? 'exc.' : 'ecc.'} · ${decimal(maxPhase, fr)}${NB}s`}</span></p>
      <div className="strip-cols mid" style={{ height: 2 * TEMPO_H + 2 }}>
        {reps.map((r, i) => <div key={r.index} className={cls(i)}>
          {r.clipped
            ? <b className="t-gap" />
            : <>
              <span className="t-half"><i className="t-up" style={{ height: Math.max(2, (TEMPO_H * r.concentricSec) / maxPhase) }} /></span>
              <span className="t-half low"><i className="t-down" style={{ height: Math.max(2, (TEMPO_H * r.eccentricSec) / maxPhase) }} /></span>
            </>}
        </div>)}
      </div>
    </div>
    {sides?.length > 0 && <div className="strip" aria-hidden="true" data-testid="strip-sides">
      <p className="strip-head"><span>{fr ? 'Gauche · droite' : 'Left · right'}</span><span>{fr ? `↑${NB}droite · ↓${NB}gauche · ${span}${pc}` : `↑${NB}right · ↓${NB}left · ${span}${pc}`}</span></p>
      <div className="strip-cols mid" style={{ height: 2 * SIDES_H + 2 }}>
        {reps.map((r, i) => {
          const s = byAt.get(i);
          if (!s) return <div key={r.index} className={cls(i)}><b className="t-gap" /></div>;
          const g = gap(s), h = Math.max(2, (SIDES_H * Math.min(Math.abs(g), span)) / span);
          return <div key={r.index} className={cls(i)}>
            <span className="t-half">{g >= 0 && <i className="g-bar up" style={{ height: h }} />}</span>
            <span className="t-half low">{g < 0 && <i className="g-bar down" style={{ height: h }} />}</span>
          </div>;
        })}
      </div>
    </div>}
  </div>;
}
