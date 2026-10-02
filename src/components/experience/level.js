// The user's level, chosen once and changeable: it sets how much of the same measures the screens
// show, never what is measured (CLAUDE.md R8). Stored per phone in localStorage; a storage that
// throws (Safari's private mode, blocked site data) reads as no level, and today's app is shown.

export const LEVELS = ['beginner', 'intermediate', 'expert'];
export const LEVEL_KEY = 'wv_level';
const ASKED_KEY = 'wv_level_asked';
// The guide is shown before filming until this many sets are saved.
// Status: convention, UNSOURCED (the number of sets set in the feature brief, 30 September).
export const GUIDED_SETS = 3;

const local = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };

/** The stored level, or '' when none (or unreadable). */
export function readLevel(store = local()) {
  try { const v = store?.getItem(LEVEL_KEY); return LEVELS.includes(v) ? v : ''; } catch { return ''; }
}

/** Stores a level; a chosen level also counts as the question answered. false when not stored. */
export function writeLevel(level, store = local()) {
  if (!LEVELS.includes(level)) return false;
  try { store.setItem(LEVEL_KEY, level); store.setItem(ASKED_KEY, '1'); return true; } catch { return false; }
}

export function levelAsked(store = local()) {
  try { return store?.getItem(ASKED_KEY) === '1' || !!readLevel(store); } catch { return false; }
}

export function markLevelAsked(store = local()) {
  try { store?.setItem(ASKED_KEY, '1'); } catch { /* not stored: it may be offered again */ }
}

/** The question is offered once, after a saved set, when no level is stored. */
export const shouldAskLevel = ({ step, level, asked }) => step === 'saved' && !level && !asked;

/**
 * What a level shows. saved: the number of sets saved on this phone.
 * plainFirst: the account's words lead the result screen; notesOpen: "En savoir plus" starts open;
 * guideFirst: the guide opens before the filming screen; perRep: the per-rep table on the result screen.
 */
export function levelView(level, { saved = 0 } = {}) {
  const l = LEVELS.includes(level) ? level : 'intermediate';
  // A count not known yet (null: the sets still being read, or storage failing) is not 0 (review, 30 September).
  return { level: l, plainFirst: l === 'beginner', notesOpen: l === 'beginner', guideFirst: l === 'beginner' && Number.isFinite(saved) && saved < GUIDED_SETS, perRep: l === 'expert' };
}

/**
 * The order of the result screen's blocks under its head. count: the numeral; bars: the marks and their
 * line; wave: the measured angle over the set, each rep over it (RepWave.jsx); card: the question, the correction or the saved card; account: the account, the tip, the cheer and
 * the notes; plain: the account and the tip alone; more: the cheer and the notes; speed: the concentric
 * speed change; table: the per-rep table. The question stays within the first screen for every level.
 */
export function resultBlocks(level) {
  const { level: l } = levelView(level);
  if (l === 'beginner') return ['plain', 'count', 'card', 'bars', 'wave', 'more'];
  if (l === 'expert') return ['count', 'bars', 'speed', 'card', 'wave', 'strips', 'table', 'account'];
  return ['count', 'bars', 'card', 'wave', 'strips', 'account'];
}
