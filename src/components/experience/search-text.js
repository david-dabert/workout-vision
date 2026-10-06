// The guide's search compares text without accents or case ("Élévations" finds "elevations"). Kept apart
// from Guide.jsx, which draws, so tests can search the catalogue as the screen does.
export const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// The search is by words (audit of 6 October: "fentes", "pompes", "développé haltères" and "curl pupitre" found
// nothing, the whole query being looked for as one piece of text). Text and query are cut into words at anything
// but a letter or a digit, a final plural s or x is dropped from each word longer than three letters on both
// sides ("fentes" finds "Fente avant", "pompe" finds "Pompes lestées"), and every word of the query must begin
// a word of the text, in any order ("curl pupitre" finds "Curl au pupitre").
const stem = w => (w.length > 3 && /[sx]$/.test(w) ? w.slice(0, -1) : w);
export const searchWords = s => (norm(s).match(/[\p{L}\p{N}]+/gu) || []).map(stem);

/** Whether `query` finds `text`: an empty query finds everything. `text` may be given as its searchWords. */
export function searchMatch(text, query) {
  const q = searchWords(query);
  if (!q.length) return true;
  const words = Array.isArray(text) ? text : searchWords(text);
  return q.every(t => words.some(w => w.startsWith(t)));
}
