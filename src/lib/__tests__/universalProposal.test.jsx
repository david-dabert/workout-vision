import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CHANNEL_POINTS, MIN_SEEN_SHARE, seenShare, universalAsProposal } from '../universalProposal';
import { savedSet } from '../../components/experience/saved-set';
import { RESULT } from '../../components/experience/result-copy';
import { validateWorkout } from '../validateSchema';
import { proposedBy } from '../../components/experience/sets';
import { measuresFile, reportSheet } from '../../components/experience/report-sheet';

// An exercise the core does not offer is read by the universal engine, whose number is never a counted result
// (counting research of 14 October 2026: it gave David's prone Y raise 21 for 10, from wrists seen on 44-46 % of the
// samples). It is refused under the core's coverage rule, and otherwise offered as "Proposition de l'appli" (R8).
vi.mock('../../components/experience/lift-scenes', () => ({ hasFigure: () => false, liftView: () => null, topPose: () => null }));
vi.mock('../../components/experience/entry-scene', () => ({ Body: class {}, mapPose: () => null, DPR: 1, LITE: false }));
vi.mock('../../components/experience/stage-loop', () => ({ addLayer: () => () => {}, presence: () => 0, holdStage: () => {} }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

const body = vis => Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: vis }));
// n samples, the first `seen` of them with the wrists in sight, the rest with the wrists below the floor.
function frames(n, seen) {
  return Array.from({ length: n }, (_, i) => body(0.9).map((p, k) => ([15, 16].includes(k) && i >= seen ? { ...p, visibility: 0.3 } : p)));
}
const read = (n, seen, extra = {}) => {
  const wl = frames(n, seen);
  return { count: 21, reps: [{ index: 1, startTime: 0, endTime: 1 }], dominantJoint: 'chestAperture', refused: false, worldLandmarks: wl, imageLandmarks: wl, timestamps: wl.map((_, i) => i / 15), metadata: { duration: n / 15 }, ...extra };
};

describe('the universal read is never a counted result', () => {
  it('refuses with no number when the needed joints are seen on fewer than half the samples (the prone Y raise: 44 %)', () => {
    const r = universalAsProposal(read(100, 44), 'bent_over_rear_delt_raise');
    expect(r).toMatchObject({ refused: true, count: 0, reps: [], proposal: null, universal: { channel: 'chestAperture', seen: 0.44, count: 21, hold: false } });
  });
  it('offers its number as a proposal, never as the count, when they are seen on half the samples or more', () => {
    for (const seen of [50, 80, 100]) {
      const r = universalAsProposal(read(100, seen), 'bent_over_rear_delt_raise');
      expect(r.refused).toBe(true);
      expect(r.count).toBe(0);
      expect(r.reps).toEqual([]);
      expect(r.proposal).toEqual({ count: 21, by: 'universal' });
    }
  });
  it('offers nothing for a hold, whose "count" is the length of the video in seconds', () => {
    expect(universalAsProposal(read(100, 100, { count: 45, isIsometric: true }), 'plank').proposal).toBeNull();
    expect(universalAsProposal(read(100, 100, { count: 45 }), 'wall_sit').universal.hold).toBe(true);
  });
  it('offers nothing when the engine found no rep, or named no signal', () => {
    expect(universalAsProposal(read(100, 100, { count: 0 }), 'shrug').proposal).toBeNull();
    expect(universalAsProposal(read(100, 100, { dominantJoint: undefined }), 'shrug').proposal).toBeNull();
    expect(universalAsProposal(null, 'shrug')).toMatchObject({ refused: true, proposal: null, count: 0 });
  });
  it('counts a sample with no body as unseen, as the core does, and applies the core\'s floors', () => {
    expect(MIN_SEEN_SHARE).toBe(0.5);
    expect(seenShare([null, body(0.9), body(0.9), null], CHANNEL_POINTS.leftElbow)).toBe(0.5);
    expect(seenShare([body(0.49)], CHANNEL_POINTS.leftElbow)).toBe(0);
    for (const ch of ['leftElbow', 'rightElbow', 'leftHip', 'rightHip', 'leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle', 'chestAperture', 'shrug', 'torso']) expect(CHANNEL_POINTS[ch]?.length).toBeGreaterThan(2);
  });
  it('a confirmed proposal is saved as the person\'s count, marked as the universal engine\'s', () => {
    const r = universalAsProposal(read(100, 80), 'bent_over_rear_delt_raise');
    const w = savedSet({ result: r, lift: 'bent_over_rear_delt_raise', n: 21, corrected: true, manual: true, proposal: 21 });
    expect(w).toMatchObject({ reps: 21, source: 'manual', machineResult: null, repDetails: [], proposal: { reps: 21, by: 'universal' } });
  });
});

// The read path (second round of the honesty pass, 14 October 2026): every read of a stored set goes through
// validateWorkout (storage.js), which dropped any proposal but PSC's, so a confirmed universal proposal came back as a
// count typed by hand in the history, the report, the PDF and the JSON.
describe('a confirmed universal proposal keeps its provenance once read back', () => {
  const lift = 'bent_over_rear_delt_raise';
  const stored = (n, proposal) => ({ id: 'u1', createdAt: 1760400000000, ...savedSet({ result: universalAsProposal(read(100, 80), lift), lift, n, corrected: true, manual: true, proposal, now: new Date('2026-10-14T10:00:00Z') }) });
  it('the read keeps it, marked as the universal engine\'s; PSC\'s too; any other is dropped', () => {
    const back = validateWorkout(stored(21, 21)).sanitized;
    expect(back.proposal).toEqual({ reps: 21, by: 'universal' });
    expect(proposedBy(back)).toBe('universal');
    expect(validateWorkout({ ...stored(21, 21), proposal: { reps: 21, by: 'psc' } }).sanitized.proposal).toEqual({ reps: 21, by: 'psc' });
    expect(validateWorkout({ ...stored(21, 21), proposal: { reps: 21, by: 'someone' } }).sanitized.proposal).toBeUndefined();
  });
  it('a number changed from the proposal is the person\'s own, typed', () => {
    const back = validateWorkout(stored(9, 21)).sanitized;
    expect(back.proposal).toEqual({ reps: 21, by: 'universal' });
    expect(proposedBy(back)).toBeNull();
  });
  it('the report and its JSON say who proposed it and why the app proposed rather than counted', () => {
    const back = validateWorkout(stored(21, 21)).sanitized;
    const props = { source: back.source, afterRefusal: back.afterRefusal, proposed: proposedBy(back) !== null, proposedBy: proposedBy(back) };
    const base = { lang: 'fr', date: new Date('2026-10-14T10:00:00Z'), notes: '', liftName: 'Oiseau', count: back.reps, counted: null, reps: [], lift, ...props };
    const fr = reportSheet(base);
    expect(fr.details).toContainEqual(['Saisie', 'proposée par l’appli, confirmée par la personne']);
    expect(fr.corrected).toBe('Proposé par l’appli, qui ne compte pas encore cet exercice, puis confirmé à la main.');
    expect(JSON.stringify(fr)).not.toMatch(/à la main, l’appli n’a pas pu compter|Saisi à la main/);
    expect(reportSheet({ ...base, lang: 'en' }).corrected).toBe('Proposed by the app, which does not count this exercise yet, then confirmed by hand.');
    const file = measuresFile({ fr: true, lift, date: base.date, count: back.reps, ...props });
    expect(file.count).toEqual({ value: 21, source: 'proposé par l’appli, qui ne compte pas encore cet exercice, puis confirmé par la personne' });
    expect(file.countedByApp).toBeNull();
    expect(file.reps).toBeNull();
    expect(measuresFile({ fr: false, lift, date: base.date, count: back.reps, ...props }).count.source).toBe('proposed by the app, which does not count this exercise yet, then confirmed by the person');
  });
});

async function render(lang, result, lift = 'bent_over_rear_delt_raise') {
  const store = { wv_lang: lang, wv_level: 'intermediate' };
  vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } });
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  const { LanguageProvider } = await import('../LanguageContext');
  const { default: Result } = await import('../../components/experience/Result');
  return renderToStaticMarkup(<LanguageProvider><Result lift={lift} result={result} onClose={() => {}} /></LanguageProvider>);
}

describe('the result screen of a universal read', () => {
  it('with a proposal: one title, one line, the slot empty and the proposal as one key; no counted numeral, no measure', async () => {
    const fr = await render('fr', universalAsProposal(read(100, 80), 'bent_over_rear_delt_raise'));
    expect(fr).toContain(`>${RESULT.fr.universalTitle}</h2>`);
    expect(fr).toContain(RESULT.fr.universalProposes);
    // Neither the core's doubt ("avec certitude"), nor a second or third disclaimer, nor warranty words.
    expect(fr).not.toMatch(/avec certitude|sans garantie|comptage validé|sans avoir bien vu/);
    expect(fr.match(/<p>/g)).toHaveLength(1);
    // The slot opens empty: the proposal is taken by a tap on its key, then confirmed.
    expect(fr).toContain('data-testid="res-empty"');
    expect(fr).toContain('data-testid="res-proposal-key"');
    expect(fr).toMatch(new RegExp(`aria-pressed="false"><span class="res-cand-n">21</span><span class="res-cand-from">${RESULT.fr.proposalKey}</span>`));
    expect(fr).toMatch(/data-testid="res-save" disabled="">Enregistrer<\/button>/);
    expect(fr).not.toContain('data-testid="res-numeral"');
    expect(fr).not.toMatch(/data-testid="(res-exp|set-account|res-sides|level-table|level-speed|saved-card)"/);
    const en = await render('en', universalAsProposal(read(100, 80), 'bent_over_rear_delt_raise'));
    expect(en).toContain(`>${RESULT.en.universalTitle}</h2>`);
    expect(en).toContain(`<span class="res-cand-from">${RESULT.en.proposalKey}</span>`);
  });
  it('a lift the core defines but does not offer (walking lunge) reads the same: no counted result', async () => {
    const fr = await render('fr', universalAsProposal(read(100, 80), 'walking_lunge'), 'walking_lunge');
    expect(fr).toContain(`>${RESULT.fr.universalTitle}</h2>`);
    expect(fr).not.toContain('data-testid="res-numeral"');
  });
  it('without one (the prone Y raise\'s 44 %): the title, the cause, no number, Save waits for the person\'s', async () => {
    const fr = await render('fr', universalAsProposal(read(100, 44), 'bent_over_rear_delt_raise'));
    expect(fr).toContain(`>${RESULT.fr.universalTitle}</h2>`);
    expect(fr).toContain(RESULT.fr.universalUnseen);
    expect(fr).not.toContain('21');
    expect(fr).not.toMatch(/data-testid="res-proposal(-key)?"/);
    expect(fr).toContain('data-testid="res-empty"');
    expect(fr).toMatch(/data-testid="res-save" disabled="">Enregistrer<\/button>/);
  });
  it('a hold: says hold times are not measured, offers no number and no slot, and goes back to the exercises', async () => {
    const fr = await render('fr', universalAsProposal(read(100, 100, { count: 45, isIsometric: true }), 'plank'), 'plank');
    expect(fr).toContain(`>${RESULT.fr.universalTitle}</h2>`);
    expect(fr).toContain(RESULT.fr.universalHold);
    expect(fr).not.toMatch(/data-testid="res-(proposal|proposal-key|empty|save)"|Combien en avez-vous fait/);
    expect(fr).toContain('data-testid="change-lift">Changer d’exercice</button>');
    // Its one key stands under the cause, in the card: no dock at the foot of an empty screen; the status says it is
    // not counted (the guide's words), and there is no count to report.
    expect(fr).toMatch(/<div class="res-keys res-keys-inline"><button[^>]*data-testid="change-lift"/);
    expect(fr).not.toMatch(/data-testid="(res-dock|report-count)"|À vous de compter/);
    expect(fr).toContain(`</i>${RESULT.fr.notCounted}</p>`);
    // Even with nobody in sight: a hold is never offered a slot that would save seconds as reps.
    const nobody = universalAsProposal(read(100, 0, { count: 0 }), 'plank');
    nobody.worldLandmarks = nobody.worldLandmarks.map(() => null);
    nobody.imageLandmarks = nobody.worldLandmarks;
    const fr2 = await render('fr', nobody, 'plank');
    expect(fr2).not.toMatch(/data-testid="res-(empty|save)"/);
  });
});
