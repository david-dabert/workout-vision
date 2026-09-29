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
const NAMES = { bicep_curl: 'Biceps curl', lateral_raise: 'Lateral raise', lat_pulldown: 'Lat pulldown', overhead_press: 'Overhead press', bench_press: 'Bench press' };
const done = new Map();
let busy = false;
$('version').textContent = `App ${VERSION}${HASH ? ` (${HASH})` : ''}`;

function summary() {
  const ok = [...done.values()].filter(v => v.ok).length, bad = [...done.entries()].filter(([, v]) => !v.ok).map(([k]) => NAMES[k]);
  const el = $('verdict');
  el.className = done.size < baseline.clips.length ? (bad.length ? 'bad' : '') : bad.length ? 'bad' : 'ok';
  el.textContent = done.size < baseline.clips.length
    ? `${done.size} of ${baseline.clips.length} checked, ${ok} as before${bad.length ? `; not as before: ${bad.join(', ')}` : ''}.`
    : bad.length ? `Not as before: ${bad.join(', ')}. Nothing that touches analysis ships.` : `${ok} of ${baseline.clips.length} as before.`;
}

for (const clip of baseline.clips) {
  const box = document.createElement('div');
  box.className = 'clip';
  box.innerHTML = `<h2>${NAMES[clip.lift]}</h2><p class="want">${clip.file}<br>Your label ${clip.label} · before ${clip.refused ? `refused (${clip.before} counted)` : clip.before} · ${clip.fileSize} bytes</p>
    <button type="button">Pick this video</button><input type="file" accept="video/*,.mov" hidden><div class="out"></div>`;
  $('clips').appendChild(box);
  const btn = box.querySelector('button'), input = box.querySelector('input'), out = box.querySelector('.out');
  btn.addEventListener('click', () => { if (!busy) input.click(); });
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file || busy) return;
    busy = true;
    document.querySelectorAll('.clip button').forEach(b => { b.disabled = true; });
    box.className = 'clip';
    // A new run of this row forgets its last verdict, so a failed rerun never leaves an old pass (review 01).
    done.delete(clip.lift); summary();
    const controller = new AbortController();
    let unwatch = () => {}, release = async () => {};
    try {
      await whenVisible({ signal: controller.signal });
      unwatch = watchInterruption(controller);
      release = holdScreenAwake();
      out.textContent = 'Analysing… 0%';
      let row;
      try {
        const r = await analyzeCoreVideo(file, clip.lift, { signal: controller.signal, onProgress: p => { out.textContent = `Analysing… ${Math.round(p)}%`; } });
        row = { count: r.count, refused: !!r.refused, read: r.timestamps.length, expected: Math.floor(r.metadata.duration * TARGET_FPS), size: file.size, decoder: r.metadata.method };
      } catch (e) {
        if (e?.name !== 'PartialReadError') throw e;
        row = { count: null, read: e.read, expected: e.expected, size: file.size, decoder: e.decoder };
      }
      const v = rowVerdict(clip, row);
      done.set(clip.lift, v);
      box.className = `clip ${v.ok ? 'ok' : 'bad'}`;
      out.textContent = [
        v.ok ? 'As before.' : `Not as before: ${v.why.join('; ')}.`,
        `${row.refused ? 'Refused (the app shows no number)' : `Counted ${row.count ?? 'nothing'}`} · before ${clip.refused ? 'refused' : clip.before} · your label ${clip.label}`,
        `Read ${row.read} of ${row.expected ?? '?'} samples · decoder ${row.decoder || 'unknown'}`,
      ].join('\n');
    } catch (e) {
      box.className = 'clip bad';
      out.textContent = isInterruption(controller.signal.reason)
        ? 'Interrupted: the page was hidden. Keep the screen on and pick the video again.'
        : `Error: ${e?.message || e}`;
    } finally {
      unwatch(); await release();
      busy = false;
      document.querySelectorAll('.clip button').forEach(b => { b.disabled = false; });
      summary();
    }
  });
}
