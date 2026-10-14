import { GroupHead } from '../experience/Showcase';
import { num } from '../experience/showcase-text';

// "Le calcul" of the NIOSH calculator (Ergonomics.jsx): the equation, one row per multiplier (its name, what set it,
// its value), then the limit. A lift outside the equation's domain gives no limit, here as in the result above it
// (second review of 14 October 2026: this card printed "= 0 kg", a 0,00 multiplier and "le coefficient le plus bas"
// under "aucune limite ni indice"): each factor out of range reads "hors domaine" and the total names the bound passed.
// Presentation only; the numbers are niosh.ts's (Waters et al. 1993, status literature).
export default function NioshProduct({ r, rows, c, fr }) {
  const outside = r.riskCategory === 'outside';
  const out = new Set(r.outside);
  const n2 = v => num(v.toFixed(2), fr);
  return (
    <section className="sc-section ergo-product" data-testid="ergo-product">
      <GroupHead title={c.product} />
      <div className="sc-card">
        {/* Two groups that stay whole: on a narrow phone the line breaks between them, never before "× CM" alone. */}
        <p className="ergo-equation"><span>RWL = 23{' '}kg × HM × VM × DM</span> <span>× AM × FM × CM</span></p>
        <ul className="ergo-factors">
          {rows.map(([f, v, why]) => (
            <li key={f} className={out.has(f) ? 'is-outside' : !outside && f === r.lowest ? 'is-lowest' : ''}>
              <span className="ergo-factor-name"><b>{f}</b> {c.factors[f]}</span>
              <span className="ergo-factor-why">{why}</span>
              <span className="ergo-factor-val">{out.has(f) ? c.outsideFactor : n2(v)}</span>
            </li>
          ))}
        </ul>
        {outside ? (
          <p className="ergo-equation is-total is-outside" data-testid="ergo-total">{c.outsideTotal(r.outside.map(f => c.limits[f]).join(', '))}</p>
        ) : (
          <>
            <p className="ergo-equation is-total" data-testid="ergo-total">= {num(r.recommendedWeightLimitKg, fr)}{' '}kg</p>
            <p className="sc-caption">{c.lowest(c.factors[r.lowest])}</p>
          </>
        )}
      </div>
    </section>
  );
}
