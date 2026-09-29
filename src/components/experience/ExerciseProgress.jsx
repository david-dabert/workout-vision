// The history's progress per exercise: the reps of the last sets as bars and the personal
// bests, from progress.js. Only stored numbers are shown (CLAUDE.md R8); the words are in
// test/real-phone/swarm/copy-A.md, for David's approval (R10).
import { bestLines } from './progress';

const NB = ' ';

// Bars from zero, so their heights compare as the counts do; the last set's bar is lit.
function Bars({ values }) {
  const max = Math.max(...values, 1), w = 6, gap = 4, h = 24;
  return <svg className="prog-bars" viewBox={`0 0 ${values.length * (w + gap) - gap} ${h}`} width={values.length * (w + gap) - gap} height={h} aria-hidden="true">
    {values.map((v, i) => {
      const bh = v > 0 ? Math.max(1, (v / max) * h) : 0; // a 0 draws no bar, not a small one
      return <rect key={i} x={i * (w + gap)} y={h - bh} width={w} height={bh} rx="1" className={i === values.length - 1 ? 'is-last' : undefined} />;
    })}
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
