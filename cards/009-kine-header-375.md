# 009. The kiné workspace fits a 375 px phone
Status: ready
Executor: fast
Claim: a physiotherapist on a small iPhone sees the four tabs and the whole title.
Reference: David's screenshot of 11 November 2026 on his iPhone (375 px wide): the fourth tab reads "Mon cabine", cut by the edge, and the condensed header reads "Vos patients, suivis entre deux..." .
Eval: a browser test at 375x667: the four tabs lie inside the viewport without scrolling, and the condensed title is not truncated (its scrollWidth does not exceed its clientWidth).
Baseline: fits at 390 px, not at 375.
Scope: `Kine.css`, `KineWorkspace.jsx`, the condensed title's copy in `kine-copy.js` (a shorter title is allowed).
Stop: none.
Needs from David: nothing.
