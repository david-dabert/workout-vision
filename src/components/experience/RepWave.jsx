// The wave under the question (wave.js): the joint angle the counter measured over the whole set, one line,
// each counted rep lit over it as the count rises, its leaving phase in full lamp and its return at a lower
// weight, the same pair as the tempo strip (RepStrips.jsx). A cut or partial rep (tempo.js) is one quiet
// stroke. One hue; phases differ by weight, never by colour alone. A tap on the wave picks the rep under it,
// as a tap on the marks does. The line is the core's own smoothed angle, experimental (measures.js).
import { useMemo } from 'react';
import { repAt, repStrokes, waveGeometry } from './wave';
import { partialIn } from './tempo';

const W = 320, H = 72;

export default function RepWave({ angles, timestamps, reps, rest, first, sel, shown, fr, jointWord, onSelect }) {
  const geo = useMemo(() => waveGeometry({ angles, timestamps, rest, width: W, height: H }), [angles, timestamps, rest]);
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
      <span className="strip-key">{fr ? `trait plein${NB}: aller · léger${NB}: retour` : 'solid: out · light: back'}</span>
    </p>
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" onClick={tap}>
      {strokes.map(s => <rect key={`b${s.i}`} className={`w-band${s.i === sel ? ' sel' : ''}`} x={s.band.x} y="0" width={s.band.w} height={H} />)}
      <path className="w-line" d={geo.path()} />
      {strokes.map(s => <g key={s.i} className={`w-rep${s.i < shown ? ' lit' : ''}${s.i === sel ? ' sel' : ''}${s.whole ? '' : ' part'}`}>
        <path className="w-out" d={s.out} />
        {s.back && <path className="w-back" d={s.back} />}
      </g>)}
    </svg>
  </div>;
}
