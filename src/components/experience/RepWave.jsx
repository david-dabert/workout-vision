// The wave under the question (wave.js): the joint angle the counter measured over the whole set, one line,
// each counted rep lit over it as the count rises, its leaving phase in full lamp and its return at a lower
// weight, the same pair as the tempo strip (RepStrips.jsx). A cut or partial rep (tempo.js) is one quiet
// stroke. One hue; phases differ by weight, never by colour alone. A tap on the wave picks the rep under it,
// as a tap on the marks does. The line is the core's own smoothed angle, experimental (measures.js).
import { useMemo } from 'react';
import { repAt, repStrokes, waveGeometry } from './wave';
import { partialIn } from './tempo';
import { HEX } from './palette';

const W = 320, H = 72;

// reference: a band { lo, hi } in degrees (reference-ranges.js), drawn faint behind the wave and unlabelled until
// David approves its words (copy-reference-band.md); null draws nothing and leaves the scale as it was.
export default function RepWave({ angles, timestamps, reps, rest, first, sel, shown, fr, jointWord, onSelect, reference = null }) {
  const refLo = reference?.lo ?? null, refHi = reference?.hi ?? null;
  const geo = useMemo(() => waveGeometry({ angles, timestamps, rest, width: W, height: H, include: refLo != null ? [refLo, refHi] : null }), [angles, timestamps, rest, refLo, refHi]);
  const strokes = useMemo(() => repStrokes(geo, reps, { first, isPartial: partialIn(reps) }), [geo, reps, first]);
  if (!geo || !reps?.length) return null;
  const NB = ' ';
  const tap = e => {
    const box = e.currentTarget.getBoundingClientRect();
    const i = repAt(geo, reps, ((e.clientX - box.left) / box.width) * W);
    if (i >= 0) onSelect(s => (s === i ? -1 : i));
  };
  return <div className={`wave${sel >= 0 ? ' has-sel' : ''}`} data-testid="rep-wave">
    <p className="strip-head">
      <span className="strip-label">{fr ? `Angle ${jointWord}` : `${jointWord[0].toUpperCase()}${jointWord.slice(1)} angle`}</span>
      {/* The key shows the two strokes themselves (David's iPhone, 5 October: "solid: out" said less than the colour). */}
      <span className="strip-key"><i className="sw sw-out" aria-hidden="true" />{fr ? 'aller' : 'out'}<i className="sw sw-back" aria-hidden="true" />{fr ? 'retour' : 'back'}</span>
    </p>
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" onClick={tap}>
      {reference && (() => { const a = geo.y(reference.lo), b = geo.y(reference.hi); return <rect className="w-ref" data-testid="wave-reference" fill={HEX.lamp} fillOpacity="0.08" x="0" y={Math.min(a, b)} width={W} height={Math.abs(b - a)} />; })()}
      {strokes.map(s => <rect key={`b${s.i}`} className={`w-band${s.i === sel ? ' sel' : ''}`} x={s.band.x} y="0" width={s.band.w} height={H} />)}
      <path className="w-line" d={geo.path()} />
      {strokes.map(s => <g key={s.i} className={`w-rep${s.i < shown ? ' lit' : ''}${s.i === sel ? ' sel' : ''}${s.whole ? '' : ' part'}`}>
        <path className="w-out" d={s.out} />
        {s.back && <path className="w-back" d={s.back} />}
      </g>)}
    </svg>
  </div>;
}
