// Writes still under way, which the reload that installs a new version waits for (main.jsx). David's collected set
// (phoneCollect.js, collectThisSet) is hashed, compressed and written after "Garder" has closed the result and the
// address is back on the choice of lift, which is when the update reloads the page: the set was lost after each deploy,
// with only a console warning (live-app audit, 10 October 2026). Module state: one page, one count.

let underWay = 0;
const waiting = [];

/** Counts the write until it settles, success or failure, and returns it unchanged. */
export function holdWhile(write) {
  underWay += 1;
  const done = () => { underWay -= 1; if (underWay === 0) waiting.splice(0).forEach(go => go()); };
  Promise.resolve(write).then(done, done);
  return write;
}

/** Resolves once no write is under way: at once when none is. */
export const whenWritesDone = () => (underWay === 0 ? Promise.resolve() : new Promise(go => { waiting.push(go); }));
