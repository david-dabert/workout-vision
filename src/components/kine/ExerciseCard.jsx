import { useState } from 'react';
import { mediaUrl } from '../../lib/kine/library';

// One exercise of the library (lib/kine/library.js): its video with the physiotherapist's voice, its title, dosage and
// whether the app compares a patient's attempt, and, opened, its position, steps and how to film. `action`: the
// screen's button (add to the programme, film an attempt).
export default function ExerciseCard({ ex, fr, k, action, open: startOpen = false, stepsLabel }) {
  const t = ex[fr ? 'fr' : 'en'];
  const [open, setOpen] = useState(startOpen);
  const [videoError, setVideoError] = useState(false);
  const video = mediaUrl(ex, 'mp4');

  return <article className="kn-card" data-testid={`kn-ex-${ex.id}`}>
    {video && !videoError ? (
      <video
        className="kn-video"
        src={video}
        poster={mediaUrl(ex, 'jpg')}
        controls
        playsInline
        preload="none"
        onError={() => setVideoError(true)}
      />
    ) : (
      <div className="kn-video-placeholder" data-testid={`kn-placeholder-${ex.id}`}>
        <div className="kn-protocol-badge">
          <svg viewBox="0 0 16 16" fill="currentColor" role="img" aria-hidden="true">
            <path d="M4 1.5A1.5 1.5 0 0 0 2.5 3v10A1.5 1.5 0 0 0 4 14.5h8a1.5 1.5 0 0 0 1.5-1.5V3A1.5 1.5 0 0 0 12 1.5H4zm1 3.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5z" />
          </svg>
          <span>{fr ? 'Protocole guidé · Repères cliniques' : 'Guided protocol · Clinical benchmarks'}</span>
        </div>
        {ex.targets && ex.targets.length > 0 && (
          <div className="kn-targets-badge">
            <span>{fr ? `Cible\u00A0: ${ex.targets.join('° à ')}°` : `Target: ${ex.targets.join('° to ')}°`}</span>
          </div>
        )}
      </div>
    )}
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

