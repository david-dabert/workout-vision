import { useState } from 'react';
import { BLIND } from './blind-copy';
import { BLIND_MAX, parseBlind } from '../../lib/blind';

// The blind question on the analysis screen (blind.js): the person's count, asked while the video is read and before
// the app shows its own. No number of the app's, no plan and no previous set is shown or used as a starting point, so
// nothing leans the answer (R8; anchoring, blind.js). The number starts at "–"; − and + or the number pad set it, as on
// the result screen's field (Result.jsx hero), whose styles it reuses; every digit deleted is no number again (unlike the
// result screen, where the app's count stands behind the field). "Je ne sais pas" is always one tap away.
// onAnswer(n): the count given, or null for "Je ne sais pas".
export default function BlindAsk({ fr, onAnswer }) {
  const c = BLIND[fr ? 'fr' : 'en'];
  const [n, setN] = useState(0); // 0: no number chosen yet
  const [typed, setTyped] = useState(null); // the digits while the number pad is open, else null
  const set = v => { setTyped(null); setN(Math.max(0, Math.min(BLIND_MAX, v))); };
  const minus = <svg viewBox="0 0 22 22" aria-hidden="true"><path d="M3 11H19" /></svg>;
  const plus = <svg viewBox="0 0 22 22" aria-hidden="true"><path d="M3 11H19M11 3V19" /></svg>;
  return <div className="blind-ask" role="group" aria-labelledby="blind-q" data-testid="blind-ask">
    <p className="ask-q" id="blind-q">{c.question}</p>
    <div className="res-hero">
      <button type="button" className="res-step press" disabled={n <= 0} onClick={() => set(n - 1)} aria-label={c.fewer}>{minus}</button>
      <span className={`res-slot${typed !== null ? ' is-typing' : ''}`}>
        {n > 0
          ? <span key={n} className="res-typed" data-testid="blind-n" aria-hidden="true">{n}</span>
          : <span className="res-empty" data-testid="blind-empty" aria-hidden="true"><i /></span>}
        <input className="stepper-in" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" enterKeyHint="done"
          aria-label={c.field} value={typed ?? (n ? String(n) : '')} data-testid="blind-field"
          onFocus={() => setTyped('')}
          onBlur={() => setTyped(null)}
          onChange={e => { const d = e.target.value.replace(/\D/g, '').slice(0, 2); setTyped(d); setN(parseBlind(d) ?? 0); }}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
      </span>
      <button type="button" className="res-step press" disabled={n >= BLIND_MAX} onClick={() => set(n + 1)} aria-label={c.more}>{plus}</button>
    </div>
    <p className="sr" aria-live="polite" aria-atomic="true">{n > 0 ? n : c.empty}</p>
    <p className="res-hint blind-after">{c.after}</p>
    <div className="blind-keys">
      <button type="button" className="res-key is-primary press" disabled={n === 0} onClick={() => { if (n > 0) onAnswer(n); }} data-testid="blind-ok">{c.ok}</button>
      <button type="button" className="res-key press" onClick={() => onAnswer(null)} data-testid="blind-unsure">{c.unsure}</button>
    </div>
  </div>;
}
