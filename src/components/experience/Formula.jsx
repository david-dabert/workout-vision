// A formula of the manifesto, kept in its copy as LaTeX (manifesto-copy.js), drawn as math rather than shown as source:
// fractions stacked, subscripts lowered, the commands replaced by their signs. Only the subset the copy uses is read:
// \text{}, \frac{}{}, _ and _{}, \int, \cdot, \quad, \approx, \times, \eta, \max, \%. Presentation only: the copy and
// its meaning are unchanged. Status: convention (typesetting; no measurement involved).

const SIGNS = { int: '∫', cdot: '·', quad: ' ', approx: '≈', times: '×', eta: 'η', max: 'max' };

/** The formula's source as a tree: strings, { frac: [num, den] } and { sub: [...] }. */
function parseFormula(src) {
  let i = 0;
  const textUntilBrace = () => {
    let depth = 0, out = '';
    for (i += 1; i < src.length; i += 1) {
      const ch = src[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') { if (depth === 0) { i += 1; break; } depth -= 1; }
      out += ch;
    }
    return out.replace(/--/g, '–');
  };
  const group = () => { i += 1; const nodes = seq('}'); i += 1; return nodes; };
  function seq(end) {
    const out = [];
    while (i < src.length && src[i] !== end) {
      const ch = src[i];
      if (ch === '\\') {
        const name = /^\\([a-zA-Z]+|.)/.exec(src.slice(i))[1];
        i += name.length + 1;
        if (name === 'text') out.push(textUntilBrace());
        else if (name === 'frac') { const num = group(); const den = group(); out.push({ frac: [num, den] }); }
        else out.push(SIGNS[name] ?? name);
      } else if (ch === '{') out.push(...group());
      else if (ch === '_') {
        i += 1;
        out.push({ sub: src[i] === '{' ? group() : [src[i++]] });
      } else { out.push(ch); i += 1; }
    }
    return out;
  }
  return seq(undefined);
}

function draw(nodes, fr, key = 'f') {
  return nodes.map((n, k) => {
    const id = `${key}-${k}`;
    if (typeof n === 'string') return n === '%' && fr ? ` %` : n;
    if (n.frac) return <span key={id} className="mf-frac"><span className="mf-num">{draw(n.frac[0], fr, `${id}n`)}</span><span className="mf-den">{draw(n.frac[1], fr, `${id}d`)}</span></span>;
    return <sub key={id}>{draw(n.sub, fr, `${id}s`)}</sub>;
  });
}

/** The formula, drawn; its source stays readable to screen readers through the label. */
export default function Formula({ tex, fr }) {
  return <span className="mf" role="math" aria-label={tex}>{draw(parseFormula(tex), fr)}</span>;
}
