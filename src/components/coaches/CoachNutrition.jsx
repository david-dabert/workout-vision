import { useMemo, useState } from 'react';
import { estimateDailyNeeds, roundKcal, ACTIVITY_MULTIPLIERS } from '../../lib/nutrition';
import { offLookup, forGrams } from '../../lib/openFoodFacts';
import { localIsoDate, paperDate } from '../../lib/accounting';
import { hapticLight, hapticTap } from '../../lib/haptics';
import { Metric } from '../experience/Showcase';
import { num } from '../experience/showcase-text';
import { OFFICE } from './office-copy';
import { legacyMeal, bodyToCheck, bodyAsShown, shownBodyValue } from './office-legacy';

// Nutrition (honesty pass of 14 October 2026, NUT-1 to NUT-7). Needs: Mifflin-St Jeor with the activity level the
// coach chooses, the goal as computed, protein as a range (nutrition.js, sources there); nothing when the client's age,
// sex, weight or height is missing, which the coach can type here. Plate photo: not available, and no number (the RGB
// sorting into food groups and its grams formula are gone). Barcode: Open Food Facts, per 100 g, credited (ODbL);
// a quantity eaten is typed by the coach. No adherence score: what makes a day "respected" has no source yet.
// Second review of 14 October 2026: a barcode meal logged before this pass came from the hand-written cache (invented
// values, three of its six barcodes not even valid); like an old photo meal, it is kept and shown with no number. A
// client file saved before this pass may hold the sex, weight and height the old form filled in by itself (Homme,
// 75 kg, 175 cm): the coach checks them before any estimate. The energy is shown to the nearest 50 kcal (roundKcal,
// nutrition.js, with its source).

const SvgCamera = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>;
const SvgBarcode = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5v14M8 5v14M12 5v14M17 5v14M21 5v14" /></svg>;
const SvgTarget = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>;

export default function CoachNutrition({ fr, client, meals, onLogMeal, onUpdateClient, initialMode = 'targets' }) {
  const t = OFFICE[fr ? 'fr' : 'en'];
  const [mode, setMode] = useState(initialMode);
  return (
    <div className="suite-content-section" data-testid="section-nutrition">
      <div className="section-header-row">
        <div>
          <h3>{t.nutTitle}</h3>
          <p className="section-subtext">{t.nutSub}</p>
        </div>
        <div className="nutrition-mode-switcher" role="group" aria-label={t.nutTitle}>
          <button type="button" className={`mode-btn ${mode === 'targets' ? 'active' : ''}`} aria-pressed={mode === 'targets'} onClick={() => { hapticLight(); setMode('targets'); }}><SvgTarget />{t.modeTargets}</button>
          <button type="button" className={`mode-btn ${mode === 'photo' ? 'active' : ''}`} aria-pressed={mode === 'photo'} onClick={() => { hapticLight(); setMode('photo'); }} data-testid="btn-mode-vision"><SvgCamera />{t.modePhoto}</button>
          <button type="button" className={`mode-btn ${mode === 'barcode' ? 'active' : ''}`} aria-pressed={mode === 'barcode'} onClick={() => { hapticLight(); setMode('barcode'); }} data-testid="btn-mode-barcode"><SvgBarcode />{t.modeBarcode}</button>
        </div>
      </div>

      {mode === 'targets' && <Needs key={client?.id || 'none'} fr={fr} t={t} client={client} onUpdateClient={onUpdateClient} />}
      {mode === 'photo' && (
        <div className="vision-plate-workbench" data-testid="section-vision-plate">
          <div className="card-top-row">
            <b>{t.photoHead}</b>
            <span className="comp-badge">{t.photoTag}</span>
          </div>
          <p className="section-subtext office-flush">{t.photoText}</p>
          <p className="sc-frame-note">{t.photoNext}</p>
        </div>
      )}
      {mode === 'barcode' && <Barcode fr={fr} t={t} client={client} onLogMeal={onLogMeal} />}

      {client && (
        <div className="meal-history-section" data-testid="meal-log">
          <h4>{t.logHead}</h4>
          {meals.length === 0 ? <p className="section-subtext office-flush">{t.logNone}</p> : (
            <div className="meals-list">
              {meals.map(m => {
                const old = legacyMeal(m);
                const [lp, lc, lf] = t.macroLetters;
                return (
                  <div key={m.id} className="meal-history-card" data-testid="meal-row">
                    <div className="meal-h-left">
                      <span className="meal-source-tag">{m.source === 'vision_plate' ? <SvgCamera /> : <SvgBarcode />}{old === 'photo' ? t.oldPhoto : old === 'barcode' ? t.oldValue : 'Open Food Facts'}</span>
                      <strong>{old === 'photo' ? t.photoHead : m.title}</strong>
                      <span className="meal-date-str">{paperDate(m.dateStr, fr)}</span>
                    </div>
                    {!old && (
                      <div className="meal-h-right">
                        {m.calories != null && <b>{num(m.calories, fr)}{'\u00A0'}kcal</b>}
                        <span>{[m.grams ? `${num(m.grams, fr)}\u00A0g` : '', m.proteinG != null ? `${num(m.proteinG, fr)}\u00A0g ${lp}` : '', m.carbsG != null ? `${num(m.carbsG, fr)}\u00A0g ${lc}` : '', m.fatG != null ? `${num(m.fatG, fr)}\u00A0g ${lf}` : ''].filter(Boolean).join(' • ')}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Needs({ fr, t, client, onUpdateClient }) {
  const [goal, setGoal] = useState('maintain');
  const [activity, setActivity] = useState('');
  const [typed, setTyped] = useState({});
  if (!client) return <div className="empty-clients-box"><p>{t.pickClient}</p></div>;
  const lacks = ['age', 'sex', 'weight', 'height'].filter(k => k === 'sex' ? !['male', 'female'].includes(client.sex) : !(parseFloat(client[k]) > 0));
  const check = bodyToCheck(client);
  if (lacks.length || check) {
    // A file from before 14 October 2026 shows all four values to confirm, as they are; a newer one asks only for what
    // is missing.
    const fields = check ? ['age', 'sex', 'weight', 'height'] : lacks;
    const valueOf = (k) => (k in typed ? typed[k] : check ? shownBodyValue(client, k) : '');
    // Saved as shown: a field the coach emptied is emptied in the file, and asked for again (bodyAsShown).
    const save = async () => {
      hapticTap();
      await onUpdateClient(bodyAsShown(client, Object.fromEntries(fields.map(k => [k, valueOf(k)]))));
      setTyped({});
    };
    const label = { age: t.fAge, sex: t.fSex, weight: t.fWeight, height: t.fHeight };
    return (
      <div className="client-target-summary" data-testid={check ? 'needs-check' : 'needs-missing'}>
        <span className="summary-client-name"><b>{client.name}</b>{check && <span className="comp-badge">{t.legacyTag}</span>}</span>
        <p className="office-strong">{check ? t.bodyLegacy : t.needData}</p>
        <div className="inline-inputs">
          {fields.map(k => (
            <div key={k} className="input-group">
              <label htmlFor={`nd-${k}`}>{label[k]}</label>
              {k === 'sex' ? (
                <select id={`nd-${k}`} value={valueOf('sex')} onChange={e => setTyped(v => ({ ...v, sex: e.target.value }))}>
                  <option value="">{t.activityPick}</option>
                  <option value="female">{fr ? 'Femme' : 'Female'}</option>
                  <option value="male">{fr ? 'Homme' : 'Male'}</option>
                </select>
              ) : (
                <input id={`nd-${k}`} type="number" inputMode="decimal" value={valueOf(k)} onChange={e => setTyped(v => ({ ...v, [k]: e.target.value }))} />
              )}
            </div>
          ))}
        </div>
        <div className="form-actions-row">
          <button type="button" className="btn-save press" onClick={save} data-testid="btn-save-needs">{check ? t.bodyConfirm : t.saveToFile}</button>
        </div>
      </div>
    );
  }
  const needs = estimateDailyNeeds(client, { goal, activity });
  // To the nearest 50 kcal (roundKcal, nutrition.js): the equation is not closer than that for one person.
  const kcal = (n) => {
    const r = roundKcal(n);
    return fr ? String(r).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F') : r.toLocaleString('en-GB');
  };
  return (
    <div className="nutrition-cards-layout">
      <div className="nutrition-goal-selector" role="group" aria-label={t.modeTargets}>
        {[['cut', `${t.goalCut} (−500)`], ['maintain', t.goalMaintain], ['bulk', `${t.goalBulk} (+300)`]].map(([g, label]) => (
          <button key={g} type="button" className={`goal-btn ${goal === g ? 'active' : ''}`} aria-pressed={goal === g} onClick={() => { hapticLight(); setGoal(g); }}>{label}</button>
        ))}
      </div>
      <div className="input-group">
        <label htmlFor="nd-activity">{t.activity}</label>
        <select id="nd-activity" value={activity} onChange={e => setActivity(e.target.value)} data-testid="needs-activity">
          <option value="">{t.activityPick}</option>
          {Object.keys(ACTIVITY_MULTIPLIERS).map(k => <option key={k} value={k}>{`${t.activities[k]} (×${num(ACTIVITY_MULTIPLIERS[k], fr)})`}</option>)}
        </select>
      </div>
      {needs ? (
        <div className="client-target-summary" data-testid="needs">
          <span className="summary-client-name"><b>{client.name}</b> · {client.weight}{'\u00A0'}kg</span>
          <div className="sc-metrics">
            <Metric wide label={t.energy} value={`≈ ${kcal(needs.calories)}`} unit={t.energyUnit} sub={t.energySub(num(needs.factor, fr), needs.offset)} testId="needs-kcal" />
            <Metric wide label={t.protein} value={t.proteinValue(needs.proteinG[0], needs.proteinG[1])} unit={t.proteinUnit} sub={t.proteinSub} testId="needs-protein" />
          </div>
          <p className="sc-frame-note">{t.needsNote}</p>
        </div>
      ) : <p className="section-subtext office-flush">{t.needActivity}</p>}
    </div>
  );
}

function Barcode({ fr, t, client, onLogMeal }) {
  const [code, setCode] = useState('');
  const [state, setState] = useState({ status: 'idle' });
  const [grams, setGrams] = useState('');
  const search = async (e) => {
    e?.preventDefault();
    if (state.status === 'loading') return;
    hapticLight();
    setGrams('');
    setState({ status: 'loading' });
    const r = await offLookup(code);
    setState(r);
  };
  const p = state.status === 'found' ? state.product : null;
  const portion = useMemo(() => (p ? forGrams(p.per100, grams) : null), [p, grams]);
  const value = (v, unit) => (v == null ? t.notGiven : `${num(v, fr)}${unit ? `\u00A0${unit}` : ''}`);
  const message = { invalid: t.bcInvalid, 'not-found': t.bcNotFound, offline: t.bcOffline, 'rate-limited': t.bcRateLimited, error: t.bcError }[state.status];
  const add = async () => {
    if (!client || !p || !portion) return;
    hapticTap();
    await onLogMeal({
      dateStr: localIsoDate(), mealType: 'snack', source: 'barcode', barcode: p.code, grams: Number(grams),
      title: [p.brand, p.name || t.bcNoName].filter(Boolean).join(' · '),
      calories: portion.kcal, proteinG: portion.proteins, carbsG: portion.carbs, fatG: portion.fat,
    });
    setGrams('');
  };
  return (
    <div className="barcode-scanner-section" data-testid="section-barcode-scan">
      <div className="barcode-header-row">
        <div>
          <h4>{t.bcHead}</h4>
          <p className="section-subtext">{t.bcSub}</p>
        </div>
      </div>
      <form className="barcode-input-bar" onSubmit={search}>
        <div className="input-group office-grow">
          <label htmlFor="bc-code">{t.bcField}</label>
          <input id="bc-code" type="text" inputMode="numeric" autoComplete="off" value={code} onChange={e => setCode(e.target.value)} placeholder={t.bcPh} data-testid="bc-code" />
        </div>
        <button type="submit" className="suite-action-btn press" disabled={!code.trim() || state.status === 'loading'} data-testid="btn-search-barcode">
          {state.status === 'loading' ? t.bcSearching : t.bcSearch}
        </button>
      </form>
      {message && <p className="sc-frame-note" role="status" data-testid="bc-message">{message}</p>}
      {p && (
        <div className="scanned-product-card" data-testid="scanned-product-card">
          <div className="prod-top-row">
            <div>
              {p.brand && <span className="prod-brand">{p.brand}</span>}
              <h4 className="prod-name">{p.name || t.bcNoName}</h4>
              <span className="prod-sub">EAN {p.code}</span>
            </div>
            {p.nutriScore && <span className={`nutriscore-badge ns-${p.nutriScore.toLowerCase()}`}>Nutri-Score {p.nutriScore}</span>}
          </div>
          <span className="office-label">{t.per100}</span>
          <div className="prod-macros-grid">
            <div className="prod-m-box"><b>{p.per100.kcal != null ? num(p.per100.kcal, fr) : p.per100.kj != null ? num(p.per100.kj, fr) : t.notGiven}</b><span>{p.per100.kcal != null || p.per100.kj == null ? t.kcal : t.kj}</span></div>
            <div className="prod-m-box"><b>{value(p.per100.proteins, 'g')}</b><span>{t.proteins}</span></div>
            <div className="prod-m-box"><b>{value(p.per100.carbs, 'g')}</b><span>{t.carbs}</span></div>
            <div className="prod-m-box"><b>{value(p.per100.fat, 'g')}</b><span>{t.fat}</span></div>
          </div>
          <p className="section-subtext office-flush">{t.attribution} <a className="office-link" href={p.url} target="_blank" rel="noopener noreferrer">{t.seeOnOff}</a></p>
          <div className="office-stack">
            <div className="input-group">
              <label htmlFor="bc-grams">{t.gramsEaten}</label>
              <input id="bc-grams" type="number" inputMode="decimal" min="1" value={grams} onChange={e => setGrams(e.target.value)} disabled={!client} />
            </div>
            <div className="input-group office-end">
              <button type="button" className="suite-action-btn press" onClick={add} disabled={!client || !portion} data-testid="btn-save-barcode-meal">
                {client ? t.addToLog : t.pickClientFirst}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
