/**
 * The check page (check.html, David's order of 29 September 2026): his five labelled clips, picked
 * from the phone's library, counted by the live analysis (analyzeCoreVideo, the app's own path), and
 * compared with what their committed landmarks give (lib/check-baseline.json), with the samples read
 * and the decoder shown. Nothing is uploaded.
 */
import { analyzeCoreVideo } from './lib/coreAnalysis';
import { TARGET_FPS } from './lib/extractionConfig';
import { watchInterruption, whenVisible, holdScreenAwake, isInterruption } from './lib/interruption';
import { rowVerdict } from './lib/check';
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
  .replace('did not finish', 'analyse non terminée');
if (fr) {
  document.documentElement.lang = 'fr';
  document.title = 'Contrôle du comptage';
  document.querySelector('h1').textContent = 'Contrôle du comptage';
  const notes = document.querySelectorAll('p.note');
  notes[0].textContent = 'Choisissez dans la photothèque chacune des cinq séries du 29 septembre retenues pour le contrôle (curl biceps, hip thrust, presse à cuisses, soulevé de terre roumain, développé couché). Chacune est comptée par le code en ligne de l’app, sur ce téléphone, et comparée au compte que donnent ses repères enregistrés. La vidéo est reconnue par sa durée. Rien n’est envoyé.';
  notes[1].textContent = 'Aucune version qui touche à l’analyse ne sort si les cinq ne sont pas «' + NB + 'comme avant' + NB + '» sur le chemin normal ; le correctif du décodeur demande aussi les cinq «' + NB + 'comme avant' + NB + '» avec la lecture forcée. Gardez l’écran allumé pendant l’analyse.';
  document.querySelector('label.force').lastChild.textContent = ' Forcer la lecture (sans WebCodecs), pour tester le correctif';
}
let busy = false;
$('version').textContent = `${fr ? 'Version' : 'App'} ${VERSION}${HASH ? ` (${HASH})` : ''}`;

// Each path keeps its own verdicts: the app's normal path (WebCodecs first) is the release gate; the forced
// playback path tests the decoder fix. A run on one never counts for the other (review of the rebased page).
const done = { normal: new Map(), forced: new Map() };
function line(map, name) {
  const n = baseline.clips.length, ok = [...map.values()].filter(v => v.ok).length;
  const bad = [...map.entries()].filter(([, v]) => !v.ok).map(([k]) => NAMES[k]);
  const text = fr
    ? `${name}${NB}: ${map.size} sur ${n} contrôlées, ${ok} comme avant${bad.length ? `${NB}; pas comme avant${NB}: ${bad.join(', ')}` : ''}.`
    : `${name}: ${map.size} of ${n} checked, ${ok} as before${bad.length ? `; not as before: ${bad.join(', ')}` : ''}.`;
  return { ok: map.size === n && !bad.length, bad: bad.length > 0, text };
}
function summary() {
  const a = line(done.normal, fr ? 'Chemin normal' : 'Normal path'), b = line(done.forced, fr ? 'Lecture forcée' : 'Playback path forced');
  const el = $('verdict');
  el.className = a.bad || b.bad ? 'bad' : a.ok ? 'ok' : '';
  el.textContent = `${a.text}\n${b.text}`;
  el.style.whiteSpace = 'pre-line';
}

for (const clip of baseline.clips) {
  const box = document.createElement('div');
  box.className = 'clip';
  const before = clip.refused ? (fr ? `refusée (${clip.before} comptées)` : `refused (${clip.before} counted)`) : clip.before;
  box.innerHTML = `<h2>${NAMES[clip.lift]}</h2><p class="want">${clip.file}<br>${fr ? 'Votre compte' : 'Your count'} ${clip.label} · ${fr ? 'avant' : 'before'} ${before} · ${VIEW[clip.view] || clip.view}</p>
    <button type="button">${fr ? 'Choisir cette vidéo' : 'Pick this video'}</button><input type="file" accept="video/*,.mov" hidden><div class="out"></div>`;
  $('clips').appendChild(box);
  const btn = box.querySelector('button'), input = box.querySelector('input'), out = box.querySelector('.out');
  btn.addEventListener('click', () => { if (!busy) input.click(); });
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file || busy) return;
    busy = true;
    document.querySelectorAll('.clip button, #force-rvfc').forEach(b => { b.disabled = true; });
    box.className = 'clip';
    // A new run of this row forgets its last verdict on this path, so a failed rerun never leaves an old pass.
    const forced = $('force-rvfc').checked, mode = forced ? 'forced' : 'normal';
    done[mode].delete(clip.lift); summary();
    const controller = new AbortController();
    let unwatch = () => {}, release = async () => {};
    try {
      await whenVisible({ signal: controller.signal });
      unwatch = watchInterruption(controller);
      release = holdScreenAwake();
      out.textContent = fr ? `Analyse… 0${NB}%` : 'Analysing… 0%';
      let row;
      try {
        const r = await analyzeCoreVideo(file, clip.lift, { signal: controller.signal, ...(forced ? { path: 'rvfc' } : {}), onProgress: p => { out.textContent = fr ? `Analyse… ${Math.round(p)}${NB}%` : `Analysing… ${Math.round(p)}%`; } });
        row = { count: r.count, refused: !!r.refused, read: r.timestamps.length, expected: Math.floor(r.metadata.duration * TARGET_FPS), duration: r.metadata.duration, decoder: r.metadata.method };
      } catch (e) {
        if (e?.name !== 'PartialReadError') throw e;
        row = { count: null, read: e.read, expected: e.expected, decoder: e.decoder };
      }
      const v = rowVerdict(clip, row);
      done[mode].set(clip.lift, v);
      box.className = `clip ${v.ok ? 'ok' : 'bad'}`;
      out.textContent = [
        `${forced ? (fr ? '[Lecture forcée] ' : '[Playback path forced] ') : ''}${v.ok ? (fr ? 'Comme avant.' : 'As before.') : `${fr ? `Pas comme avant${NB}:` : 'Not as before:'} ${v.why.map(why).join('; ')}.`}`,
        `${row.refused ? (fr ? 'Refusée (l’app n’affiche aucun nombre)' : 'Refused (the app shows no number)') : `${fr ? 'Compté' : 'Counted'} ${row.count ?? (fr ? 'rien' : 'nothing')}`} · ${fr ? 'avant' : 'before'} ${clip.refused ? (fr ? 'refusée' : 'refused') : clip.before} · ${fr ? 'votre compte' : 'your count'} ${clip.label}`,
        fr ? `${row.read} échantillons lus sur ${row.expected ?? '?'} · décodeur ${row.decoder || 'inconnu'}` : `Read ${row.read} of ${row.expected ?? '?'} samples · decoder ${row.decoder || 'unknown'}`,
      ].join('\n');
    } catch (e) {
      box.className = 'clip bad';
      done[mode].set(clip.lift, { ok: false, why: ['did not finish'] });
      out.textContent = isInterruption(controller.signal.reason)
        ? (fr ? 'Interrompu\u00A0: la page a été masquée. Gardez l’écran allumé et choisissez de nouveau la vidéo.' : 'Interrupted: the page was hidden. Keep the screen on and pick the video again.')
        : `${fr ? `Erreur${NB}:` : 'Error:'} ${e?.message || e}`;
    } finally {
      unwatch(); await release();
      busy = false;
      document.querySelectorAll('.clip button, #force-rvfc').forEach(b => { b.disabled = false; });
      summary();
    }
  });
}
summary(); // the top line in the page's language from the start
