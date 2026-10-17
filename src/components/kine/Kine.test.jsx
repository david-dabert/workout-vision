import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('./Kine.css', () => ({}));
vi.mock('../reference/ReferenceCompare.css', () => ({}));
vi.mock('../../lib/reference/readPose', () => ({ readPose: vi.fn() }));
// Without a media address, as CI builds; the deploy job sets the repository variable.
// Set before any test imports the library (links.js imports it): the deploy job builds with the address set.
beforeEach(() => { vi.stubEnv('VITE_KINE_MEDIA_URL', ''); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

async function render(name, hash = '', lang = 'fr', extra = {}, media = '') {
  vi.stubEnv('VITE_KINE_MEDIA_URL', media);
  const store = { wv_lang: lang, ...extra };
  vi.stubGlobal('sessionStorage', { getItem: k => store[`s:${k}`] ?? null, setItem: (k, v) => { store[`s:${k}`] = String(v); }, removeItem: k => { delete store[`s:${k}`]; } });
  vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } });
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { location: { hash, origin: 'https://example.org', pathname: '/app/' } }));
  const { LanguageProvider } = await import('../../lib/LanguageContext');
  const { default: Screen } = await import(`./${name}.jsx`);
  return renderToStaticMarkup(<LanguageProvider><Screen onClose={() => {}} /></LanguageProvider>);
}

describe('the physiotherapist workspace', () => {
  it('opens on the programme, with the five tabs and Olivier\'s four exercises to add', async () => {
    const html = await render('KineWorkspace');
    expect(html).toContain('data-testid="kine-screen"');
    for (const tab of ['programme', 'followup', 'calibration', 'library', 'invoice', 'compare', 'profile']) expect(html).toContain(`data-testid="kn-tab-${tab}"`);
    for (const id of ['mains-jointes', 'rotation-externe', 'abduction-horizontale', 'elevation-paliers']) expect(html).toContain(`data-testid="kn-add-${id}"`);
    // No link to send before an exercise is chosen.
    expect(html).not.toContain('data-testid="kn-send"');
    // Without a media address, it says the videos are not online yet.
    expect(html).toContain('data-testid="kn-no-media"');
  });
});

describe('the patient programme', () => {
  it('shows the programme of its link', async () => {
    const { programmeLink } = await import('../../lib/kine/links');
    const link = programmeLink('https://example.org/app/', {
      kine: { name: 'Olivier', phone: '0600000000' }, patient: 'Christophe', perDay: 2, weeks: 6, note: 'Sans douleur.',
      items: [{ id: 'mains-jointes', reps: 10, sets: 5, note: 'Bien relâcher.' }, { id: 'rotation-externe', reps: 10, sets: 3 }],
    });
    const html = await render('KinePatient', link.slice(link.indexOf('#')));
    expect(html).toContain('Christophe, vos exercices');
    expect(html).toContain('Préparé par Olivier');
    expect(html).toContain('2 fois par jour, pendant 6 semaines');
    expect(html).toContain('Bien relâcher.');
    expect(html).toContain('href="tel:0600000000"');
    // Without a media address, no attempt can be filmed yet.
    expect(html).not.toContain('ne compare pas encore votre geste');
    expect(html).not.toContain('data-testid="kn-film-');
  });

  it('lets the patient film an attempt or choose a video the phone holds', async () => {
    // The media address set before the library is first imported (links.js imports it).
    vi.stubEnv('VITE_KINE_MEDIA_URL', 'https://media.example.org/');
    const { programmeLink } = await import('../../lib/kine/links');
    const link = programmeLink('https://example.org/app/', { kine: { name: 'Olivier' }, patient: 'C', items: [{ id: 'abduction-horizontale' }] });
    const html = await render('KinePatient', link.slice(link.indexOf('#')), 'fr', {}, 'https://media.example.org/');
    expect(html).toContain('Filmer mon exercice');
    expect(html).toContain('Choisir une vidéo');
    // The camera for the first, the phone's videos for the second.
    expect(html).toMatch(/capture="environment"[^>]*data-testid="kn-film-abduction-horizontale-input"/);
    expect(html).toMatch(/<input(?:(?!capture)[^>])*data-testid="kn-choose-abduction-horizontale-input"/);
  });

  it('lists the attempts made on this phone, each with its report to print again', async () => {
    const { programmeLink } = await import('../../lib/kine/links');
    const link = programmeLink('https://example.org/app/', { kine: { name: 'Olivier' }, patient: 'Christophe', items: [{ id: 'mains-jointes' }] });
    const hash = link.slice(link.indexOf('#'));
    // The programme's id on the phone: the hash of its payload (KinePatient.jsx).
    const payload = hash.slice(hash.indexOf('=') + 1);
    let h = 0x811c9dc5;
    for (let i = 0; i < payload.length; i++) { h ^= payload.charCodeAt(i); h = Math.imul(h, 16777619); }
    const id = (h >>> 0).toString(36);
    const report = { v: 1, id: 'mains-jointes', patient: 'Christophe', kine: 'Olivier', date: '2026-10-17T09:05', verdict: 'match', reasons: [], judged: 1, tempo: 1, joints: [], holds: [] };
    const attempts = { [id]: [{ id: 'mains-jointes', date: '2026-10-16T08:00:00.000Z', verdict: 'revise' }, { id: 'mains-jointes', date: '2026-10-17T07:05:00.000Z', verdict: 'match', report }] };
    const html = await render('KinePatient', hash, 'fr', { wv_kine_attempts: JSON.stringify(attempts) });
    expect(html).toContain('data-testid="kn-past"');
    expect(html).toContain('Vos essais');
    expect(html).toContain('Rapport (PDF)');
    // The attempt logged before reports were kept is not listed: there is no report to print.
    expect(html.match(/class="kn-past"/g)).toHaveLength(1);
  });

  it('tells the patient which side to work when it is not the video\'s', async () => {
    const { programmeLink } = await import('../../lib/kine/links');
    const link = programmeLink('https://example.org/app/', { kine: { name: 'Olivier' }, patient: 'C', items: [{ id: 'rotation-externe', side: 'right' }, { id: 'abduction-horizontale', side: 'left' }] });
    const html = await render('KinePatient', link.slice(link.indexOf('#')));
    expect(html).toContain('data-testid="kn-side-note-rotation-externe"');
    expect(html).toContain('Côté à travailler');
    expect(html).not.toContain('data-testid="kn-side-note-abduction-horizontale"');
  });

  it('says so when the link does not open', async () => {
    expect(await render('KinePatient', '#kine-p=zbroken')).toContain('data-testid="kn-bad-link"');
  });
});

describe('the AI commentary', () => {
  const commentary = { visible: true, sameExercise: 'yes', reps: 4, holds: [{ rep: 1, seconds: 4.5 }], compensations: ['Les épaules montent.'], setup: [], camera: ['Filmez de profil.'], advice: ['Gardez les épaules basses.'], summary: 'Quatre répétitions, bien conduites.' };

  it('says the video stays on the phone unless the patient asks for it, only when the build names the proxy', async () => {
    const { programmeLink } = await import('../../lib/kine/links');
    const link = programmeLink('https://example.org/app/', { kine: { name: 'Olivier' }, patient: 'C', items: [{ id: 'mains-jointes' }] });
    expect(await render('KinePatient', link.slice(link.indexOf('#')))).toContain('Votre vidéo reste sur votre téléphone. Seul');
    vi.resetModules();
    vi.stubEnv('VITE_GLIMPSE_URL', 'https://glimpse.example.app');
    expect(await render('KinePatient', link.slice(link.indexOf('#')))).toContain('sauf si vous demandez un avis détaillé (IA)');
  });

  it('offers it with the notice that the video leaves the phone, and sends nothing before the tap', async () => {
    const { default: AiCommentary } = await import('./AiCommentary.jsx');
    const { KINE } = await import('./kine-copy');
    const { exerciseById } = await import('../../lib/kine/library');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const html = renderToStaticMarkup(<AiCommentary file={{ name: 'a.mov' }} ex={exerciseById('mains-jointes')} fr k={KINE.fr} />);
    expect(html).toContain('Avis détaillé (IA)');
    expect(html).toContain('votre vidéo quitte le téléphone');
    expect(html).toContain('Envoyer ma vidéo pour un avis détaillé');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows the commentary labelled as an AI\'s, apart from the measures', async () => {
    const { CommentaryView } = await import('./AiCommentary.jsx');
    const { KINE } = await import('./kine-copy');
    const html = renderToStaticMarkup(<CommentaryView c={commentary} k={KINE.fr} />);
    expect(html).toContain('Quatre répétitions, bien conduites.');
    expect(html).toContain('4 répétitions vues');
    expect(html).toContain('Répétition 1\u00A0: 4,5\u00A0s');
    expect(html).toContain('Les épaules montent.');
    expect(html).toContain('non vérifié par votre kiné');
    expect(renderToStaticMarkup(<CommentaryView c={{ ...commentary, sameExercise: 'no' }} k={KINE.fr} />)).toContain('ne reconnaît pas l’exercice');
  });
});

describe('the follow-up', () => {
  const results = JSON.stringify([
    { id: 'mains-jointes', patient: 'Christophe', date: '2026-10-16T09:00', verdict: 'revise', tempo: 1, joints: [{ name: 'rightShoulder', within: 0.55, range: 0.8 }], holds: [] },
    { id: 'mains-jointes', patient: 'Christophe', date: '2026-10-20T09:00', verdict: 'match', tempo: 1, joints: [{ name: 'rightShoulder', within: 0.93, range: 1 }], holds: [] },
  ]);

  it('opens on the patient a result screen asked for, with the progress from first to last attempt', async () => {
    const html = await render('KineWorkspace', '', 'fr', { wv_kine_results: results, 's:wv_kine_open_follow_up': 'christophe' });
    expect(html).toContain('data-testid="kn-follow-patient"');
    expect(html).toContain('Christophe');
    expect(html).toContain('55\u00A0% du geste dans la tolérance au premier essai, 93\u00A0% au dernier');
    expect(html).toContain('data-testid="kn-follow-pdf"');
  });

  it('opens a patient whose stored result names a measure no screen knows, without breaking', async () => {
    const hostile = JSON.stringify([{ id: 'mains-jointes', patient: 'Eve', date: '2026-10-16T09:00', verdict: 'match', joints: [{ name: '__proto__', within: 0.95, range: 1 }, { name: 'rightShoulder', within: 0.95, range: 1 }], holds: [] }]);
    const html = await render('KineWorkspace', '', 'fr', { wv_kine_results: hostile, 's:wv_kine_open_follow_up': 'eve' });
    expect(html).toContain('Épaule droite');
    expect(html).not.toContain('__proto__');
  });
});

describe('the backup', () => {
  it('asks for a backup when results exist and none was made, and says where to keep it', async () => {
    vi.stubEnv('VITE_KINE_MEDIA_URL', '');
    const store = { wv_lang: 'fr' };
    vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } });
    const { default: Backup } = await import('./Backup.jsx');
    const { KINE } = await import('./kine-copy.js');
    const html = renderToStaticMarkup(<Backup fr k={KINE.fr} hasData />);
    expect(html).toContain('Aucune sauvegarde pour l’instant.');
    expect(html).toContain('si ce téléphone est perdu, le suivi l’est aussi');
    expect(html).toContain('clé USB');
    expect(html).toContain('data-testid="kn-backup-make"');
  });
});

describe('the calibration', () => {
  async function renderCal(extra) {
    vi.stubEnv('VITE_KINE_MEDIA_URL', '');
    const store = { wv_lang: 'fr', ...extra };
    vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } });
    const { default: Calibration } = await import('./Calibration.jsx');
    const { KINE } = await import('./kine-copy.js');
    return renderToStaticMarkup(<Calibration fr k={KINE.fr} />);
  }

  it('says how to start when no attempt is kept', async () => {
    const html = await renderCal({});
    expect(html).toContain('data-testid="kn-cal-summary"');
    expect(html).toContain('trois essais corrects et trois essais avec une erreur');
  });

  it('shows the agreement per exercise and the tolerance closest to the physiotherapist\'s eye', async () => {
    const hist = within => { const h = new Array(61).fill(0); h[5] = within; h[40] = 100 - within; return h; };
    const t = (w, label) => ({ v: 1, exercise: 'mains-jointes', label, fault: '', side: '', date: '2026-10-16T09:00', app: 'match', joints: [{ name: 'rightShoulder', kind: 'moving', rangeShare: 1, hist: hist(w), n: 100 }] });
    const trials = [t(100, 'match'), t(98, 'match'), t(96, 'match'), t(80, 'revise'), t(70, 'revise'), t(60, 'revise')];
    const html = await renderCal({ wv_kine_calibration: JSON.stringify(trials) });
    expect(html).toContain('data-testid="kn-cal-ex-mains-jointes"');
    expect(html).toContain('6 essais');
    expect(html).toContain('data-testid="kn-cal-best-mains-jointes"');
    expect(html).toContain('d’accord 6 fois sur 6');
  });
});

describe('a patient result', () => {
  it('shows the verdict and figures of its link', async () => {
    const { resultLink } = await import('../../lib/kine/links');
    const link = resultLink('https://example.org/app/', { id: 'mains-jointes', patient: 'Christophe', verdict: 'match', tempo: 1, joints: [{ name: 'rightShoulder', within: 0.95, range: 1 }], holds: [] });
    const html = await render('KineResult', link.slice(link.indexOf('#')));
    expect(html).toContain('data-testid="kn-result-verdict"');
    expect(html).toContain('Conforme à la référence');
    expect(html).toContain('Épaule droite');
    // Kept in this phone's follow-up, with the way to it.
    expect(html).toContain('data-testid="kn-result-kept"');
    expect(html).toContain('data-testid="kn-result-follow"');
    expect(html).toContain('data-testid="kn-result-copy"');
  });
});
