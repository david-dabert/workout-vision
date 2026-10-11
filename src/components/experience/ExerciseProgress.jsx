// The history's progress per exercise: the reps of the last sets as bars and the personal
// bests, from progress.js. Only stored numbers are shown (CLAUDE.md R8); the words are in
// test/real-phone/swarm/copy-A.md, for David's approval (R10).
import { bestLines } from './progress';

const NB = ' ';

// Bars from zero, so their heights compare as the counts do; the last set's bar is lit.
function Bars({ values }) {
  // Read at a glance on the bench (design pass, 29 September); the last set's count stands over its bar,
  // so the lit bar says what it is (critic, 30 September).
  const max = Math.max(...values, 1), w = 10, gap = 6, h = 40, head = 14, W = values.length * (w + gap) - gap;
  const last = values.length - 1, lastBar = values[last] > 0 ? Math.max(1, (values[last] / max) * h) : 0;
  return <svg className="prog-bars" viewBox={`0 0 ${W} ${h + head}`} width={W} height={h + head} aria-hidden="true">
    {values.map((v, i) => {
      const bh = v > 0 ? Math.max(1, (v / max) * h) : 0; // a 0 draws no bar, not a small one
      return <rect key={i} x={i * (w + gap)} y={head + h - bh} width={w} height={bh} rx="1" className={i === last ? 'is-last' : undefined} />;
    })}
    <text className="prog-last" x={last * (w + gap) + w / 2} y={head + h - lastBar - 4} textAnchor="middle">{values[last]}</text>
  </svg>;
}

export default function ExerciseProgress({ progress, name, fr, style }) {
  if (!progress.length) return null;
  return <section className="hist-day hist-prog" data-reveal style={style}>
    <h2 className="hist-head">{fr ? 'Vos progrès' : 'Your progress'}</h2>
    <ul className="hist-list">{progress.map(e => <li key={e.key} className="hist-item prog-item">
      <span className="prog-name">{name(e.sets.at(-1))}</span>
      {e.first
        ? <span className="prog-meta">{fr ? 'Première série de cet exercice.' : 'First set of this exercise.'}</span>
        : <>
          <span className="prog-line">
            <Bars values={e.trend} />
            <span className="sr">{fr ? `Répétitions de vos ${e.trend.length} dernières séries${NB}: ${e.trend.join(', ')}.` : `Reps in your last ${e.trend.length} sets: ${e.trend.join(', ')}.`}</span>
          </span>
          <span className="prog-meta">{bestLines(e.bests, fr).map((line, i) => <span key={i}>{line}</span>)}</span>
        </>}
    </li>)}</ul>
  </section>;
}
