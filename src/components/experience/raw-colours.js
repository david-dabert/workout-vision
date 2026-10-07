// The raw colour literals of the experience's styles and drawing code (C8, design review of 7 October 2026): a hex
// (#rgb to #rrggbbaa) or an rgb(), rgba(), hsl() or hsla() call written with numbers (or a template's ${}), not
// the palette's rgba(RGB.x, a) helper; comments left out. Read by the check that no new one
// is written outside the token blocks and the palette (__tests__/raw-colours.test.js, raw-colours-allowlist.json).
const LITERAL = /#[0-9a-fA-F]{3,8}(?![0-9a-zA-Z_-])|\b(?:rgba?|hsla?)\(\s*(?:[\d.]|\$\{)[^)]*\)/g;

export function stripComments(text, css) {
  const block = text.replace(/\/\*[\s\S]*?\*\//g, '');
  // In JS, a // comment runs to the end of the line; a URL inside a string (https://) is kept.
  return css ? block : block.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
}

/** { literal: occurrences } for one file's text. */
export function colourLiterals(text, css) {
  const out = {};
  for (const m of stripComments(text, css).matchAll(LITERAL)) {
    const key = m[0].replace(/\s+/g, ' ');
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}
