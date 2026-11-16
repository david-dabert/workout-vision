// The stock labels' book (test/real-phone/stock/labels.json): appended from label.html's exports, never changed (R1).

/** Adds an export's labels to the book: only from named people, a person's first label of a clip kept. */
export function mergeLabels(book, exported, names) {
  if (exported?.kind !== 'wv-stock-labels' || !Array.isArray(exported.labels)) throw new Error('not a label.html export');
  const named = new Set(names.map(n => n.toLowerCase()));
  const out = { ...book, labels: [...(book.labels || [])] };
  const have = new Set(out.labels.map(l => `${l.id}|${l.who.toLowerCase()}`));
  let added = 0, kept = 0;
  const refusedWho = new Set();
  for (const l of exported.labels) {
    if (!l?.id || !l.who || !named.has(String(l.who).toLowerCase())) { refusedWho.add(l?.who || '(no name)'); continue; }
    const key = `${l.id}|${l.who.toLowerCase()}`;
    if (have.has(key)) { kept += 1; continue; }
    have.add(key);
    out.labels.push({ id: l.id, lift: l.lift, verdict: l.verdict, count: l.count, taps: l.taps, who: l.who, at: l.at, file: l.file });
    added += 1;
  }
  return { book: out, added, kept, refused: [...refusedWho].join(', ') };
}

/** Clips two people labelled differently: a different verdict or a different count. */
export function disagreements(book) {
  const by = new Map();
  for (const l of book.labels || []) (by.get(l.id) ?? by.set(l.id, []).get(l.id)).push(l);
  return [...by.entries()].filter(([, ls]) => ls.length > 1 && new Set(ls.map(l => `${l.verdict}:${l.count}`)).size > 1)
    .map(([id, ls]) => ({ id, counts: ls.map(l => ({ who: l.who, verdict: l.verdict, count: l.count })) }));
}

/** The labels a scoreboard may use: counted, and agreed by everyone who labelled the clip. */
export function agreedCounts(book) {
  const bad = new Set(disagreements(book).map(d => d.id));
  const seen = new Map();
  for (const l of book.labels || []) if (l.verdict === 'counted' && !bad.has(l.id) && !seen.has(l.id)) seen.set(l.id, l);
  return [...seen.values()];
}
