/**
 * A number drawn digit by digit, each in a cell of its own (design/SYSTEM.md, section 3, change 4):
 * a digit is keyed by its place and its value, so only the digit that changes is drawn anew and rolls
 * in (Entry.css .dg); a separator (":") keeps its natural width and never moves.
 */
export default function Digits({ text }) {
  return [...String(text)].map((ch, i) => (/\d/.test(ch)
    ? <span key={`${i}-${ch}`} className="dg">{ch}</span>
    : <span key={`${i}-sep`} className="dg is-sep">{ch}</span>));
}
