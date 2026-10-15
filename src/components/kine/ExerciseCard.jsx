import { useState } from 'react';
import { mediaUrl } from '../../lib/kine/library';

// One exercise of the library (lib/kine/library.js): its video with the physiotherapist's voice, its title, dosage and
// whether the app compares a patient's attempt, and, opened, its position, steps and how to film. `action`: the
// screen's button (add to the programme, film an attempt).
export default function ExerciseCard({ ex, fr, k, action, open: startOpen = false, stepsLabel }) {
  const t = ex[fr ? 'fr' : 'en'];
  const [open, setOpen] = useState(startOpen);
  const video = mediaUrl(ex, 'mp4');
  return <article className="kn-card" data-testid={`kn-ex-${ex.id}`}>
    {video ? <video className="kn-video" src={video} poster={mediaUrl(ex, 'jpg')} controls playsInline preload="none" /> : null}
    <div className="kn-card-body">
      <div className="kn-card-head">
        <div>
          <h3 className="kn-card-title">{t.title}</h3>
          <p className="kn-card-meta">{k.dosage(ex.dosage.reps, ex.dosage.sets)} · <span className={ex.compare ? 'kn-on' : 'kn-off'}>{ex.compare ? k.compareOn : k.compareOff}</span></p>
        </div>
        {action}
      </div>
      <button type="button" className="rc-link press" onClick={() => setOpen(o => !o)} aria-expanded={open}>{open ? '−' : '+'} {stepsLabel || k.steps}</button>
      {open && <div className="kn-detail">
        <p><b>{k.position}.</b> {t.position}</p>
        <ol>{t.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        <p className="kn-camera"><b>{k.camera}.</b> {t.camera}</p>
      </div>}
    </div>
  </article>;
}

