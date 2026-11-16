// The labelling page (label.html; David, 16 November 2026: "Go ahead, build it now"). A person David names watches
// each stock clip once, confirms the lift, and taps once per full rep; the count is a label (R1). The page never
// shows what the app would count. French in « vous » (R10).
import { WHO, exportLabels, makeLabel, nextClip, progress, readLabels, saveLabel } from './label-core';

const LIFTS = {
  squat: 'Squat', bicep_curl: 'Curl biceps', lateral_raise: 'Élévations latérales', lat_pulldown: 'Tirage vertical',
  bench_press: 'Développé couché', hip_thrust: 'Hip thrust', romanian_deadlift: 'Soulevé de terre roumain',
  leg_press: 'Presse à cuisses', overhead_press: 'Développé militaire',
};
const NB = ' ';
const app = document.getElementById('app');
const store = window.localStorage;
let clips = [];
let lift = '';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const who = () => { try { return store.getItem(WHO) || ''; } catch { return ''; } };

async function load() {
  try {
    const res = await fetch('stock/queue.json', { cache: 'no-store' });
    clips = (await res.json()).clips || [];
  } catch { clips = []; }
  render();
}

function render() {
  if (!who()) return askName();
  const labels = readLabels(store);
  const prog = progress(clips, labels);
  const done = Object.values(prog).reduce((a, p) => a + p.done, 0);
  const clip = nextClip(clips, labels, lift);
  const sent = Object.keys(labels).length;
  app.innerHTML = `
    <div class="bar"><h1>Comptage</h1><span class="dim">${esc(who())} · ${done}/${clips.length}</span></div>
    <select id="lift" aria-label="Exercice">
      <option value="">Tous les exercices</option>
      ${Object.keys(prog).map(k => `<option value="${k}" ${k === lift ? 'selected' : ''}>${esc(LIFTS[k] || k)} (${prog[k].done}/${prog[k].total})</option>`).join('')}
    </select>
    <section id="clip"></section>
    <button id="send" ${sent ? '' : 'disabled'}>Envoyer mes comptes (${sent})</button>
    <p class="dim" style="margin-top:8px">Les comptes restent sur ce téléphone jusqu’à l’envoi. Envoyez-les à David.</p>`;
  app.querySelector('#lift').onchange = e => { lift = e.target.value; render(); };
  app.querySelector('#send').onclick = () => send(labels);
  const box = app.querySelector('#clip');
  if (!clips.length) { box.innerHTML = '<p class="msg">La file est vide pour l’instant.</p>'; return; }
  if (!clip) { box.innerHTML = `<p class="msg">Tout est compté${lift ? ' pour cet exercice' : ''}. Merci${NB}!</p>`; return; }
  showClip(box, clip);
}

function askName() {
  app.innerHTML = `
    <h1>Comptage des vidéos</h1>
    <p class="dim" style="margin-top:8px">Vous regardez de courtes vidéos d’exercice et vous comptez les répétitions complètes, d’une touche par répétition. Vos comptes servent à mesurer la justesse de l’appli.</p>
    <input id="name" placeholder="Votre prénom" autocomplete="given-name" />
    <button class="primary" id="go">Commencer</button>`;
  const go = () => { const v = app.querySelector('#name').value.trim(); if (!v) return; try { store.setItem(WHO, v); } catch { /* this visit only */ } render(); };
  app.querySelector('#go').onclick = go;
  app.querySelector('#name').onkeydown = e => { if (e.key === 'Enter') go(); };
}

function credit(clip) {
  return `<p class="credit">Vidéo${NB}: ${esc(clip.author)} · ${esc(clip.licence)} · <a href="${esc(clip.page)}" target="_blank" rel="noopener">source</a></p>`;
}

function showClip(box, clip) {
  box.classList.remove('counting');
  box.innerHTML = `
    <p class="q">Est-ce bien${NB}: ${esc(LIFTS[clip.lift] || clip.lift)}${NB}?</p>
    <video id="v" src="${esc(clip.file)}" playsinline muted controls preload="metadata"></video>
    ${credit(clip)}
    <p id="err" class="msg hide">La vidéo ne se charge pas. Marquez-la inutilisable.</p>
    <button class="primary" id="yes">Oui, je compte</button>
    <div class="row"><button id="other">Autre exercice</button><button id="bad">Inutilisable</button></div>
    <p class="dim" style="margin-top:8px">Inutilisable${NB}: le corps sort de l’image, plusieurs personnes, montage, ou pas une série.</p>`;
  const v = box.querySelector('#v');
  v.onerror = () => box.querySelector('#err').classList.remove('hide');
  box.querySelector('#yes').onclick = () => count(box, clip);
  box.querySelector('#other').onclick = () => finish(clip, 'other_lift');
  box.querySelector('#bad').onclick = () => finish(clip, 'unusable');
}

function count(box, clip) {
  let taps = [];
  box.classList.add('counting');
  box.innerHTML = `
    <p class="q">${esc(LIFTS[clip.lift] || clip.lift)}</p>
    <video id="v" src="${esc(clip.file)}" playsinline muted preload="auto"></video>
    ${credit(clip)}
    <p class="dim">Touchez à la fin de chaque répétition complète. Ne comptez pas une répétition coupée au début ou à la fin de la vidéo.</p>
    <p class="count" id="n" aria-live="polite">0</p>
    <button class="primary" id="play">Lancer la vidéo</button>
    <button class="tap hide" id="tap">Répétition</button>
    <div class="row"><button id="undo" disabled>Annuler la dernière</button><button id="again">Recommencer</button></div>
    <button class="primary" id="save" disabled>Valider</button>`;
  const v = box.querySelector('#v'), n = box.querySelector('#n'), tap = box.querySelector('#tap'), play = box.querySelector('#play');
  const undo = box.querySelector('#undo'), save = box.querySelector('#save');
  const show = () => { n.textContent = String(taps.length); undo.disabled = !taps.length; save.textContent = `Valider${NB}: ${taps.length} répétition${taps.length > 1 ? 's' : ''}`; };
  const start = () => { taps = []; show(); save.disabled = true; v.currentTime = 0; v.play(); box.scrollIntoView({ block: 'start' }); play.classList.add('hide'); tap.classList.remove('hide'); };
  play.onclick = start;
  box.querySelector('#again').onclick = start;
  // The tap is taken on pointerdown: the moment the finger lands, not when it lifts.
  tap.onpointerdown = e => { e.preventDefault(); if (v.paused && !v.ended) return; taps.push(v.currentTime); if (navigator.vibrate) navigator.vibrate(10); show(); };
  undo.onclick = () => { taps.pop(); show(); };
  // Saved only once the whole clip has played: a count from part of a clip is not a label.
  v.onended = () => { save.disabled = false; tap.classList.add('hide'); play.classList.remove('hide'); play.textContent = 'Revoir la vidéo'; };
  save.onclick = () => finish(clip, 'counted', taps);
  show();
}

function finish(clip, verdict, taps = []) {
  saveLabel(store, makeLabel(clip, { verdict, taps, who: who() }));
  render();
  window.scrollTo(0, 0);
}

async function send(labels) {
  const data = exportLabels(labels, who());
  const name = `comptes-${who().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${data.exportedAt.slice(0, 10)}.json`;
  const file = new File([JSON.stringify(data, null, 1)], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Comptes WorkoutVision' }); return; } catch { /* closed */ } }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

load();
