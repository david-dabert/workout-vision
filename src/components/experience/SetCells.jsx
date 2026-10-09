/**
 * Planned against counted, for one exercise: one cell per planned set, the reps of each set done (Programme.jsx on the
 * client's phone, Results.jsx on the coach's). A number the app did not count on its own, typed, corrected, or its
 * proposal confirmed (programme.js, keptLetter), is underlined and never gold, as on the result screen (R8).
 * kinds: one letter per set done; none in a results link made before 9 October 2026, read as the app's counts.
 */
export default function SetCells({ name, sets, reps, done, kinds = null, c, testId }) {
  return <ul className="programme-sets" aria-label={name} data-testid={testId}>{Array.from({ length: Math.max(sets, done.length) }, (_, k) => {
    const n = done[k];
    if (n === undefined) return <li key={k} className="is-todo" aria-label={c.setTodo(k + 1)} />;
    const kind = kinds?.[k] || 'a';
    const label = kind === 't' ? c.setTyped : kind === 'c' ? c.setCorrected : kind === 'p' ? c.setProposed : c.setDone;
    return <li key={k} className={kind !== 'a' ? 'is-hand' : n >= reps ? 'is-met' : 'is-short'} data-kind={kind} aria-label={label(k + 1, n, reps)}>
      <span aria-hidden="true">{n}</span>
    </li>;
  })}</ul>;
}
