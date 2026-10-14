// The words and numbers of the showcase screens as French and English set them (Showcase.jsx): presentation only.
// Status: convention (French typography: decimal comma, no-break space before a unit and before % ; no measurement).

export const NBSP = '\u00A0';
export const NNBSP = '\u202F';

/** A number as French or English write it: the decimal comma in French (report-sheet.js, decimal). */
export const num = (v, fr) => (fr ? String(v).replace('.', ',') : String(v));

/** A value or sentence written in the code as text ('43.1°', '89% (Élite)'): in French, the decimal comma and a narrow
 *  no-break space before %, as a French page sets them. English is left as written. */
export const frText = (s, fr) => (fr
  ? String(s).replace(/(\d)\.(\d)/g, '$1,$2').replace(/(\d) ?%/g, `$1${NNBSP}%`)
  : String(s));

/** Reduce Motion asks for no video that plays on its own (read once; false where there is no window). */
export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
