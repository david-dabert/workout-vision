// The key to the measures, under the per-rep table (report-sheet.js, measureGuide): a short glossary whose terms are
// the table's own headings, and the tempo shown as its four phases. The report's paper and the result screen's dark
// ground each style it (Report.css, Level.css); the PDF draws the same thing (report-pdf.js).
export function MeasureGuide({ guide, tut = true }) {
  const items = guide.items.filter(i => tut || !i.tut);
  return <section className="mg" data-testid="measure-guide">
    <h4 className="mg-title">{guide.title}</h4>
    <dl className="mg-list">
      <div className="mg-row"><dt>{guide.tempo.term}</dt><dd>{guide.tempo.text}
        <span className="mg-tempo" role="img" aria-label={guide.tempo.example.map(([n, l]) => `${n} ${l}`).join(', ')}>
          {guide.tempo.example.map(([n, l], i) => <span key={i} className="mg-ph" aria-hidden="true"><b>{n}</b><small>{l}</small></span>)}
        </span></dd></div>
      {items.map(i => <div className="mg-row" key={i.term}><dt>{i.term}</dt><dd>{i.text}</dd></div>)}
    </dl>
  </section>;
}
