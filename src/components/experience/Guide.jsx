import { useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/LanguageContext';
import { getAllGuideExercises } from '../../lib/exerciseGuide';
import { Body, mapPose, DPR } from './entry-scene';
import entry from './entry-pose.json';
import './Guide.css';

const CATALOGUE = getAllGuideExercises();
const ZONES = { front: ['shoulders', 'chest', 'biceps', 'abs', 'quads'], back: ['back', 'triceps', 'lowerback', 'glutes', 'hamstrings', 'calves'] };
const ZONE_NAMES = {
 fr: { shoulders: 'Épaules', chest: 'Pectoraux', biceps: 'Biceps', abs: 'Abdominaux', quads: 'Cuisses', back: 'Dos', triceps: 'Triceps', lowerback: 'Lombaires', glutes: 'Fessiers', hamstrings: 'Ischios', calves: 'Mollets' },
 en: { shoulders: 'Shoulders', chest: 'Chest', biceps: 'Biceps', abs: 'Abs', quads: 'Thighs', back: 'Back', triceps: 'Triceps', lowerback: 'Lower back', glutes: 'Glutes', hamstrings: 'Hamstrings', calves: 'Calves' }
};
const MUSCLES = { shoulders: ['Shoulders', 'Rear Delts'], chest: ['Chest'], biceps: ['Biceps', 'Forearms', 'Grip'], abs: ['Core'], quads: ['Quads', 'Legs', 'Adductors', 'Groin', 'Hips'], back: ['Back', 'Lats', 'Upper Back'], triceps: ['Triceps'], lowerback: ['Lower Back', 'Posterior Chain'], glutes: ['Glutes'], hamstrings: ['Hamstrings'], calves: ['Calves'] };
const EQUIPMENT = { Barbell: 'Barre', Bench: 'Banc', Bodyweight: 'Poids du corps', Box: 'Banc / box', Cable: 'Poulie', Cardio: 'Cardio', Chair: 'Chaise', Doorway: 'Encadrement de porte', Dumbbell: 'Haltères', Kettlebell: 'Kettlebell', Machine: 'Machine', Plate: 'Disque', 'Pull-up Bar': 'Barre de traction', 'Resistance Band': 'Élastique', 'Stability Ball': 'Ballon', Towel: 'Serviette', Wall: 'Mur' };
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const inZone = (e, zone) => !zone || e.muscles.some(m => MUSCLES[zone].includes(m));
const countedLift = e => ({ 'bicep-curl': 'bicep_curl', 'lateral-raise': 'lateral_raise', 'lat-pulldown': 'lat_pulldown' })[e.slug];

function BodyMap() {
  const canvas = useRef(null);
  useEffect(() => {
    const c = canvas.current, ctx = c.getContext('2d'), body = new Body(1500, 31), out = new Float32Array(66);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame, stopped = false;
    function draw(now) {
      const W = c.width, H = c.height;
      ctx.clearRect(0, 0, W, H);
      mapPose(new Float32Array(entry.p), entry.vb, { x: W * 0.05, y: H * 0.05, w: W * 0.9, h: H * 0.9 }, out);
      body.draw(ctx, out, { alpha: 0.72, time: reduced ? 1.5 : now / 1000, dpr: DPR, size: 0.75, stars: 0.6 });
    }
    function resize() { c.width = c.clientWidth * DPR; c.height = c.clientHeight * DPR; draw(performance.now()); }
    function loop(now) { if (stopped) return; draw(now); frame = requestAnimationFrame(loop); }
    const observer = new ResizeObserver(resize); observer.observe(c); resize();
    if (!reduced) frame = requestAnimationFrame(loop);
    return () => { stopped = true; cancelAnimationFrame(frame); observer.disconnect(); };
  }, []);
  return <canvas ref={canvas} aria-hidden="true" />;
}
export function GuideFrames({ exercise }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => setActive(n => (n + 1) % exercise.frames.length), 800);
    return () => clearInterval(timer);
  }, [exercise]);
  return <div className="guide-frames">{exercise.frames.map((src, i) => <img key={src} className={i === active ? 'active' : ''} src={src} width="320" height="320" loading="lazy" alt={`${exercise.fr} / ${exercise.name} — ${i + 1}`} />)}</div>;
}
export default function Guide({ onClose, onChoose }) {
  const { lang, setLang } = useT(), fr = lang === 'fr';
  const [query, setQuery] = useState(''), [zone, setZone] = useState(null), [view, setView] = useState('front'), [open, setOpen] = useState(null);
  const q = norm(query.trim());
  const list = CATALOGUE.filter(e => inZone(e, zone)).filter(e => !q || norm([e.fr, e.name, ...e.aliases, e.equipment, EQUIPMENT[e.equipment], ...Object.keys(MUSCLES).filter(z => inZone(e, z)).flatMap(z => [ZONE_NAMES.fr[z], ZONE_NAMES.en[z]]), ...e.muscles].join(' ')).includes(q));
  function pickZone(z) { setZone(previous => previous === z ? null : z); setOpen(null); }
  return <div className="wv-experience">
    <section className="screen is-active guide-screen"><div className="wrap">
      <div className="topbar"><button className="icon-btn press" onClick={onClose} aria-label={fr ? 'Retour' : 'Back'}>←</button><span className="pill">{fr ? 'Version de test' : 'Test version'}</span></div>
      <h1 className="title">{fr ? 'Trouvez votre mouvement.' : 'Find your movement.'}</h1>
      <p className="sub">{fr ? 'Touchez une zone du corps ou cherchez un nom.' : 'Tap a body area or search for a name.'}</p>
      <div className="search"><label className="sr" htmlFor="guide-search">{fr ? 'Rechercher un exercice' : 'Search exercises'}</label><input id="guide-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={fr ? 'Nom, muscle, matériel…' : 'Name, muscle, equipment…'} /></div>
      <div className="map">
        <div className="map-fig"><div className="map-inner"><BodyMap />{ZONES[view].map(z => <button key={z} className="spot" style={{ left: `${5 + entry.spots[view][z][0] * 0.9}%`, top: `${5 + entry.spots[view][z][1] * 0.9}%` }} aria-label={ZONE_NAMES[lang][z]} aria-pressed={zone === z} onClick={() => pickZone(z)}><i /></button>)}</div></div>
        <div className="map-side"><div className="seg"><button aria-pressed={view === 'front'} onClick={() => setView('front')}>{fr ? 'Face' : 'Front'}</button><button aria-pressed={view === 'back'} onClick={() => setView('back')}>{fr ? 'Dos' : 'Back view'}</button></div>
          {ZONES[view].map(z => <button key={z} className="chip press" aria-pressed={zone === z} onClick={() => pickZone(z)}><span>{ZONE_NAMES[lang][z]}</span><span className="ct">{CATALOGUE.filter(e => inZone(e, z)).length}</span></button>)}
        </div>
      </div>
      <div className="guide-tools"><button className="guide-action press" onClick={() => { setZone(null); setQuery(''); setOpen(null); }}>{fr ? 'Tous les exercices' : 'All exercises'}</button><button className="guide-action press" onClick={() => setLang(fr ? 'en' : 'fr')}>{fr ? 'English' : 'Français'}</button></div>
      <p className="guide-credit">Illustrations: Everkinetic, via <a href="https://github.com/bryllim/workout-guide" target="_blank" rel="noreferrer">bryllim/workout-guide</a>, <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>. {fr ? 'Redimensionnées et converties en WebP.' : 'Resized and converted to WebP.'}</p>
      <p className="list-head" role="status">{list.length} / {CATALOGUE.length} {fr ? 'exercices' : 'exercises'}</p>
      <ul className="list">{list.map(e => <li key={e.key} className="item" data-exercise={e.key}>
        <button className="item-btn press" aria-expanded={open === e.key} onClick={() => setOpen(open === e.key ? null : e.key)}>
          <span className="thumb"><img src={e.frames[0]} loading="lazy" width="56" height="56" alt="" /></span>
          <span><span className="item-name">{fr ? e.fr : e.name}</span><span className="item-sub">{fr ? e.name : e.fr} · {fr ? EQUIPMENT[e.equipment] : e.equipment}</span></span>
          <span className={`tag ${countedLift(e) ? 'on' : ''}`}>{countedLift(e) ? (fr ? 'Compté' : 'Counted') : 'Guide'}</span>
        </button>
        {open === e.key && <div className="guide-detail"><GuideFrames exercise={e} /><p>{countedLift(e) ? (fr ? 'Cet exercice peut être compté.' : 'This exercise can be counted.') : (fr ? 'Guide uniquement. Cet exercice n’est pas compté.' : 'Guide only. This exercise is not counted.')}</p>
          {countedLift(e) && <button className="guide-action press" onClick={() => onChoose(countedLift(e))}>{fr ? 'Filmer cet exercice' : 'Film this exercise'}</button>}
          <button className="guide-action press" onClick={() => setOpen(null)}>{fr ? 'Fermer' : 'Close'}</button>
        </div>}
      </li>)}</ul>
      {!list.length && <p className="empty">{fr ? 'Aucun exercice trouvé.' : 'No exercises found.'}</p>}
    </div></section>
  </div>;
}
