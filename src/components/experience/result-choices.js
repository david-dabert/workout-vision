// The short list the result screen can offer (David's order of 9 October 2026, pillar 2: "What a user needs is the
// right number recorded in one tap at most, not a perfect first guess ... the counter should offer a short list with an
// honest confidence, and be measured on that list"). A screen rule: it reads the counter's result and changes no count.
//
// The list is the number the screen shows (M) and its two neighbours, [M, M + 1, M - 1], each above 0. Rule
// 'neighbours-v1', chosen among five on 9 October 2026 (TRIED.md; test/real-phone/accuracy/choices.txt): putting the
// app's independent counts (PSC, SGC, motion) in the list instead of a neighbour added nothing measurable, and the
// direction of the error flips between datasets (public clips undercount, RepCount-A overcounts), so both neighbours
// stay. Source: test/real-phone/accuracy/choices.test.ts. Status: experimental on the public and RepCount-A sets;
// validated only in the sense of R9 on David's 20 stored sets and 14 videos (measured on our real clips).
//
// The state is the screen's own, from signals the app already has, no new threshold (R8):
//   'counted': a count shown as the app's, to confirm ("C'est bien N ?");
//   'check':   a number shown as one to verify: a refused set's proposal (psc.js), a count the body check flagged;
//   'ask':     no number shown: refused with no proposal, counted none, a set the app could not read, or a live count
//              the final reading did not find (the screen opens on "–", Result.jsx liveDiffers).
export const CHOICE_RULE = 'neighbours-v1';

/**
 * result: the counter's result (coreAnalysis.js). liveShown: for a live set, the last count the live screen showed.
 * Returns { main, alts, state, rule }: main the number the screen shows, or null; alts the neighbours in the order the
 * rule ranks them (M + 1 first).
 */
export function countChoices(result, { liveShown = null } = {}) {
  const pos = n => Number.isInteger(n) && n > 0;
  const refused = !!result?.refused;
  const liveDiffers = !refused && liveShown !== null && pos(result?.count) && liveShown !== result.count;
  let main = null;
  if (!result?.notRead && !liveDiffers) {
    if (!refused && pos(result?.count)) main = result.count;
    else if (refused && pos(result?.proposal?.count)) main = result.proposal.count;
  }
  if (main === null) return { main: null, alts: [], state: 'ask', rule: CHOICE_RULE };
  const flagged = !refused && result?.bodyCheck?.flagged === true;
  return { main, alts: [main + 1, main - 1].filter(pos), state: refused || flagged ? 'check' : 'counted', rule: CHOICE_RULE };
}

/** Whether n is in the list of the first k numbers: [main, ...alts] cut to k. */
export const inList = (choices, n, k = 3) => choices.main !== null && [choices.main, ...choices.alts].slice(0, k).includes(n);
