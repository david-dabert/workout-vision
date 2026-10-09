/**
 * The check page (check.html, David's order of 29 September 2026): his labelled clips, picked
 * from the phone's library, counted by the live analysis (analyzeCoreVideo, the app's own path), and
 * compared with what their committed landmarks give (lib/check-baseline.json), with the samples read,
 * the repeat share, the decoder and its fallback shown. Rows are keyed by clip id, never by lift (WP0.2).
 * check.html?inject=frozen adds a row that feeds a synthetic frozen stream on the playback path, which must
 * be refused (WP0.2 of docs/SPEC-production.md). Nothing is uploaded.
 */
import { analyzeCoreVideo, repeatedSkeletons } from './lib/coreAnalysis';
import { TARGET_FPS } from './lib/extractionConfig';
import { watchInterruption, whenVisible, holdScreenAwake, isInterruption } from './lib/interruption';
import { clipId, delegateParam, injectVerdict, landmarksPrint, pathTally, poseLine, readLines, rowVerdict } from './lib/check';
import baseline from './lib/check-baseline.json';

const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
const HASH = typeof __GIT_HASH__ !== 'undefined' ? __GIT_HASH__ : '';
const $ = id => document.getElementById(id);
// French on a French phone, English otherwise (David, 29 September): the page is internal.
const fr = (navigator.language || '').toLowerCase().startsWith('fr');
const NB = '\u00A0';
const NAMES = fr
  ? { bicep_curl: 'Curl biceps', hip_thrust: 'Hip thrust', leg_press: 'Presse à cuisses', romanian_deadlift: 'Soulevé de terre roumain', bench_press: 'Développé couché', lateral_raise: 'Élévations latérales', lat_pulldown: 'Tirage vertical', overhead_press: 'Développé militaire', squat: 'Squat' }
  : { bicep_curl: 'Biceps curl', hip_thrust: 'Hip thrust', leg_press: 'Leg press', romanian_deadlift: 'Romanian deadlift', bench_press: 'Bench press', lateral_raise: 'Lateral raise', lat_pulldown: 'Lat pulldown', overhead_press: 'Overhead press', squat: 'Squat' };
const VIEW = { side: fr ? 'de profil' : 'side view', front: fr ? 'de face' : 'front view', angle: fr ? 'de biais' : 'angle view' };
// The verdict's reasons (lib/check.js) in French.
const why = w => !fr ? w : w
  .replace(/^read (\d+) of (.+) samples$/, (_, a, b) => `${a} échantillons lus sur ${b === 'an unknown number of' ? 'un nombre inconnu' : b}`)
  .replace(/^counted (\d+), before (\d+)$/, 'compté $1, avant $2')
  .replace(/^another video \(([\d.]+) s where the set lasts ([\d.]+) s\)$/, (_, a, b) => `autre vidéo (${a.replace('.', ',')}${NB}s, la série dure ${b.replace('.', ',')}${NB}s)`)
  .replace('refused now, counted before', 'refusée maintenant, comptée avant')
  .replace('counted now, refused before', 'comptée maintenant, refusée avant')
  .replace('no count', 'aucun compte')
  .replace('did not finish', 'analyse non terminée')
  .replace(/^counted (\S+), not refused$/, (_, n) => `compté ${n === 'nothing' ? 'rien' : n}, non refusée`)
  .replace(/^not refused as frozen \((.*)\)$/, 'non refusée comme figée ($1)')
  .replace('refused, but not as frozen', 'refusée, mais pas comme figée')
  .replace('refused as a frozen read', 'refusée comme lecture figée');
// The frozen-injection row: check.html?inject=frozen only. The app never reads this parameter.
const INJECT = new URLSearchParams(location.search).get('inject') === 'frozen';
// ?posemode=video: the rows read with MediaPipe in VIDEO mode (coreAnalysis.js; shipped on the morning of 9 October
// 2026, withdrawn that evening), to measure against the app's IMAGE mode. ?posemode=image reads as the app does.
const POSE_MODE = new URLSearchParams(location.search).get('posemode') === 'video' ? 'video' : null;
// ?delegate=gpu: the rows read with MediaPipe's GPU delegate (pillar 4, 9 October 2026), to measure its speed and its
// landmarks on this phone against the CPU's; every row prints the delegate, the time per sample and a fingerprint.
const DELEGATE = delegateParam(location.search);
// ?posemodel=<file>: the rows read with the pose model at bench/<file> (served beside the page by a local build only,
// never committed), to measure another model against the one the app ships.
const POSE_MODEL = (new URLSearchParams(location.search).get('posemodel') || '').replace(/[^\w.-]/g, '') || null;
const benchModel = () => (POSE_MODEL ? fetch(`bench/${POSE_MODEL}`).then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`bench model ${r.status}`)))) : Promise.resolve(null));
const N = baseline.clips.length;
// The browser and its version (Safari's Version/NN gives the iOS release), and the delegate asked, above the rows.
{
  const ua = document.createElement('p');
  ua.className = 'note';
  ua.dataset.testid = 'check-ua';
  ua.textContent = `${DELEGATE ? (fr ? 'Délégué\u00a0: GPU (mesure). ' : 'Delegate: GPU (measurement). ') : ''}${navigator.userAgent}`;
  document.querySelector('p.note')?.before(ua);
}
if (fr) {
  document.documentElement.lang = 'fr';
  document.title = 'Contrôle du comptage';
  document.querySelector('h1').textContent = 'Contrôle du comptage';
  const notes = document.querySelectorAll('p.note');
  notes[0].textContent = `Choisissez dans la photothèque chacune des ${N} séries retenues pour le contrôle (les six du 29 septembre ; l’élévation latérale est aussi la vidéo de la démo du 3 octobre). Chacune est comptée par le code en ligne de l’app, sur ce téléphone, et comparée au compte que donnent ses repères enregistrés. La vidéo est reconnue par sa durée. Rien n’est envoyé.`;
  notes[1].textContent = `Aucune version qui touche à l’analyse ne sort si les ${N} ne sont pas «${NB}comme avant${NB}» sur le chemin normal ; le correctif du décodeur demande aussi les ${N} «${NB}comme avant${NB}» avec la lecture forcée. Gardez l’écran allumé pendant l’analyse.`;
  document.querySelector('label.force').lastChild.textContent = ' Forcer la lecture (sans WebCodecs), pour tester le correctif';
} else {
  const notes = document.querySelectorAll('p.note');
  notes[0].textContent = `Pick each of the ${N} sets David chose for the check from the library (the six of 29 September; the lateral raise is also the video of the 3 October demo). Each is counted by the live code of this app, on this phone, and compared with the count its committed landmarks give. The video is recognised by its length. Nothing is uploaded.`;
  notes[1].textContent = `No release that touches analysis goes out unless all ${N} read "as before" on the normal path; the decoder fix needs all ${N} "as before" with the playback path forced too. Keep the screen on while a video is analysed.`;
}
let busy = false;
$('version').textContent = `${fr ? 'Version' : 'App'} ${VERSION}${HASH ? ` (${HASH})` : ''}`;

// Each path keeps its own verdicts, keyed by clip id: the app's normal path (WebCodecs first) is the release gate; the
// forced playback path tests the decoder fix. A run on one never counts for the other (review of the rebased page).
const done = { normal: new Map(), forced: new Map() };
let injected = null; // the frozen-injection row's verdict, when the page was opened with ?inject=frozen
function line(map, name) {
  const t = pathTally(map, baseline.clips, NAMES);
  const text = fr
    ? `${name}${NB}: ${t.checked} sur ${t.n} contrôlées, ${t.ok} comme avant${t.bad.length ? `${NB}; pas comme avant${NB}: ${t.bad.join(', ')}` : ''}.`
    : `${name}: ${t.checked} of ${t.n} checked, ${t.ok} as before${t.bad.length ? `; not as before: ${t.bad.join(', ')}` : ''}.`;
  return { ok: t.whole, bad: t.bad.length > 0, text };
}
function summary() {
  const a = line(done.normal, fr ? 'Chemin normal' : 'Normal path'), b = line(done.forced, fr ? 'Lecture forcée' : 'Playback path forced');
  const lines = [a.text, b.text];
  if (INJECT) {
    lines.push(injected == null
      ? (fr ? `Injection figée${NB}: pas encore lancée.` : 'Frozen injection: not run yet.')
      : injected.ok ? (fr ? `Injection figée${NB}: refusée, comme il faut.` : 'Frozen injection: refused, as it must be.')
        : (fr ? `Injection figée${NB}: PAS refusée.` : 'Frozen injection: NOT refused.'));
  }
  const el = $('verdict');
  el.className = a.bad || b.bad || injected?.ok === false ? 'bad' : a.ok ? 'ok' : '';
  el.textContent = lines.join('\n');
  el.style.whiteSpace = 'pre-line';
}

const lock = on => document.querySelectorAll('.clip button, #force-rvfc').forEach(b => { b.disabled = on; });

/** A row: a title, a line under it, a button that picks a video, and `run(file, out)` that analyses it. */
function addRow({ title, want, testid, run }) {
  const box = document.createElement('div');
  box.className = 'clip';
  if (testid) box.dataset.testid = testid;
  box.innerHTML = `<h2></h2><p class="want"></p><button type="button">${fr ? 'Choisir cette vidéo' : 'Pick this video'}</button><input type="file" accept="video/*,.mov" hidden><div class="out"></div>`;
  box.querySelector('h2').textContent = title;
  box.querySelector('.want').innerHTML = want;
  $('clips').appendChild(box);
  const btn = box.querySelector('button'), input = box.querySelector('input'), out = box.querySelector('.out');
  btn.addEventListener('click', () => { if (!busy) input.click(); });
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file || busy) return;
    busy = true;
    lock(true);
    box.className = 'clip';
    const controller = new AbortController();
    let unwatch = () => {}, release = async () => {};
    try {
      await whenVisible({ signal: controller.signal });
      unwatch = watchInterruption(controller);
      release = holdScreenAwake();
      out.textContent = fr ? `Analyse… 0${NB}%` : 'Analysing… 0%';
      const ok = await run(file, out, controller.signal);
      box.className = `clip ${ok ? 'ok' : 'bad'}`;
    } catch (e) {
      box.className = 'clip bad';
      out.textContent = isInterruption(controller.signal.reason)
        ? (fr ? 'Interrompu : la page a été masquée. Gardez l’écran allumé et choisissez de nouveau la vidéo.' : 'Interrupted: the page was hidden. Keep the screen on and pick the video again.')
        : `${fr ? `Erreur${NB}:` : 'Error:'} ${e?.message || e}`;
    } finally {
      unwatch(); await release();
      busy = false;
      lock(false);
      summary();
    }
  });
  return box;
}

const progress = out => p => { out.textContent = fr ? `Analyse… ${Math.round(p)}${NB}%` : `Analysing… ${Math.round(p)}%`; };

for (const clip of baseline.clips) {
  const id = clipId(clip);
  const before = clip.refused ? (fr ? `refusée (${clip.before} comptées)` : `refused (${clip.before} counted)`) : clip.before;
  addRow({
    title: NAMES[clip.lift] || clip.lift,
    testid: `row-${id}`,
    want: `${clip.file}<br>${fr ? 'Votre compte' : 'Your count'} ${clip.label} · ${fr ? 'avant' : 'before'} ${before} · ${VIEW[clip.view] || clip.view}`,
    async run(file, out, signal) {
      // A new run of this row forgets its last verdict on this path, so a failed rerun never leaves an old pass.
      const forced = $('force-rvfc').checked, mode = forced ? 'forced' : 'normal';
      done[mode].delete(id); summary();
      let row, read, poseNote = null;
      try {
        try {
          const model = await benchModel();
          const r = await analyzeCoreVideo(file, clip.lift, { signal, ...(forced ? { path: 'rvfc' } : {}), ...(POSE_MODE ? { poseMode: POSE_MODE } : {}), ...(model ? { benchModel: model } : {}), ...(DELEGATE ? { delegate: DELEGATE } : {}), onProgress: progress(out) });
          poseNote = poseLine(r.metadata?.pose, await landmarksPrint(r.worldLandmarks), fr);
          row = { count: r.count, refused: !!r.refused, read: r.timestamps.length, expected: Math.floor(r.metadata.duration * TARGET_FPS), duration: r.metadata.duration };
          read = { pictures: r.metadata.repeats, skeletons: repeatedSkeletons(r.worldLandmarks), decoder: r.metadata.method, fallback: r.metadata.fallback };
        } catch (e) {
          if (e?.name !== 'PartialReadError') throw e;
          row = { count: null, read: e.read, expected: e.expected };
          read = { decoder: e.decoder, fallback: e.fallback };
        }
      } catch (e) {
        // A read refused as frozen (the extractor's `frozen`, or the skeletons' FrozenSkeletonsError) is shown with its
        // repeat share: on this page it is a change, never a pass, since no committed set is frozen.
        const frozen = e?.frozen ?? (e?.name === 'FrozenSkeletonsError' ? { samples: e.samples, repeats: e.repeats } : null);
        done[mode].set(id, { ok: false, why: [frozen ? 'refused as a frozen read' : 'did not finish'] });
        if (!frozen) throw e;
        out.textContent = [
          `${forced ? (fr ? '[Lecture forcée] ' : '[Playback path forced] ') : ''}${fr ? `Pas comme avant${NB}: refusée comme lecture figée.` : 'Not as before: refused as a frozen read.'}`,
          ...readLines({ [e?.frozen ? 'pictures' : 'skeletons']: frozen, decoder: e?.frozen?.decoder || e?.decoder || '', fallback: e?.fallback ?? null }, fr),
        ].join('\n');
        return false;
      }
      const v = rowVerdict(clip, row);
      done[mode].set(id, v);
      out.textContent = [
        `${forced ? (fr ? '[Lecture forcée] ' : '[Playback path forced] ') : ''}${v.ok ? (fr ? 'Comme avant.' : 'As before.') : `${fr ? `Pas comme avant${NB}:` : 'Not as before:'} ${v.why.map(why).join('; ')}.`}`,
        `${row.refused ? (fr ? 'Refusée (l’app n’affiche aucun nombre)' : 'Refused (the app shows no number)') : `${fr ? 'Compté' : 'Counted'} ${row.count ?? (fr ? 'rien' : 'nothing')}`} · ${fr ? 'avant' : 'before'} ${clip.refused ? (fr ? 'refusée' : 'refused') : clip.before} · ${fr ? 'votre compte' : 'your count'} ${clip.label}`,
        fr ? `${row.read} échantillons lus sur ${row.expected ?? '?'}` : `Read ${row.read} of ${row.expected ?? '?'} samples`,
        ...readLines(read, fr),
        ...(poseNote ? [poseNote] : []),
      ].join('\n');
      return v.ok;
    },
  });
}

// check.html?inject=frozen: any video, read on the playback path with every sample after the first replaced by the
// first (frameExtractor.js, frozenStream). The guard must refuse it as a frozen read; a count fails the row.
if (INJECT) {
  addRow({
    title: fr ? 'Injection figée (test)' : 'Frozen injection (test)',
    testid: 'row-inject-frozen',
    want: fr
      ? `N’importe quelle vidéo. La lecture est forcée et chaque échantillon après le premier le répète. Attendu${NB}: refusée comme lecture figée.`
      : 'Any video. The playback path is forced and every sample after the first repeats it. Expected: refused as a frozen read.',
    async run(file, out, signal) {
      injected = null; summary();
      let outcome;
      try {
        const r = await analyzeCoreVideo(file, 'lateral_raise', { signal, path: 'rvfc', inject: 'frozen', onProgress: progress(out) });
        outcome = { count: r.refused ? 'refused' : r.count, read: { pictures: r.metadata.repeats, skeletons: repeatedSkeletons(r.worldLandmarks), decoder: r.metadata.method, fallback: r.metadata.fallback } };
      } catch (e) {
        if (e?.name === 'AbortError') throw e;
        outcome = { error: e };
      }
      const v = injectVerdict(outcome);
      injected = v;
      const e = outcome.error;
      out.textContent = [
        v.ok
          ? (fr ? `Refusée comme lecture figée (${v.by === 'skeletons' ? 'squelettes' : 'images'}), comme il faut.` : `Refused as a frozen read (${v.by}), as it must be.`)
          : `${fr ? `PAS refusée${NB}:` : 'NOT refused:'} ${v.why.map(why).join('; ')}.`,
        ...readLines(v.ok
          ? { [v.by]: v.read, decoder: e?.frozen?.decoder || e?.decoder || '', fallback: e?.fallback ?? (fr ? 'lecture forcée' : 'playback path forced') }
          : (outcome.read ?? { decoder: e?.decoder || '', fallback: e?.fallback ?? null }), fr),
      ].join('\n');
      return v.ok;
    },
  });
}
summary(); // the top line in the page's language from the start
