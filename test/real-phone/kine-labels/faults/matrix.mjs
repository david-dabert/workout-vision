// node test/real-phone/kine-labels/faults/matrix.mjs > matrix.json
// Card 063, track C (plan.md beside this file): the renders, fixed before any is made. Per model, exercise and view:
// one reference, two correct attempts (other seeds: the body's natural variation), and one attempt per planted fault.
const PEAK = { bicep_curl: 130, lateral_raise: 90, overhead_press: 170, squat: 100 };
export const FAULTS = {
  range70: e => ({ peakL: 0.7 * PEAK[e], peakR: 0.7 * PEAK[e] }),
  lateRight: () => ({ lagR: 0.5 }),
  lean20: () => ({ leanDeg: 20 }),
  pause2s: () => ({ pauseSec: 2 }),
};
const out = [];
let seed = 6300;
for (const model of ['michelle', 'soldier']) for (const exercise of Object.keys(PEAK)) for (const view of [0, 30]) {
  const base = { model, exercise, view, reps: 3, peakL: PEAK[exercise], peakR: PEAK[exercise], shot: false };
  const cell = `${model}-${exercise}-v${view}`;
  out.push({ ...base, id: `${cell}-reference`, seed: seed++, role: 'reference' });
  for (const k of [1, 2]) out.push({ ...base, id: `${cell}-correct${k}`, seed: seed++, role: 'correct' });
  for (const [fault, f] of Object.entries(FAULTS)) out.push({ ...base, ...f(exercise), id: `${cell}-${fault}`, seed: seed++, role: fault });
}
process.stdout.write(JSON.stringify(out, null, 1) + '\n');
