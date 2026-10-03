import { useEffect, useRef, useState } from 'react';
import { norm } from './search-text';
import { useT } from '../../lib/LanguageContext';
import { getAllGuideExercises } from '../../lib/exerciseGuide';
import { Body, mapPose, DPR } from './entry-scene';
import entry from './entry-pose.json';
import { tierLabel, tierTag } from '../../lib/liftTiers';
import { isOffered, tierOf } from '../../lib/offer';
import './Guide.css';
import './Level.css';
import { useCondensingTopbar } from './topbar';

const CATALOGUE = getAllGuideExercises();
const ZONES = { front: ['shoulders', 'chest', 'biceps', 'abs', 'quads'], back: ['back', 'triceps', 'lowerback', 'glutes', 'hamstrings', 'calves'] };
const ZONE_NAMES = {
 fr: { shoulders: 'Épaules', chest: 'Pectoraux', biceps: 'Biceps', abs: 'Abdominaux', quads: 'Cuisses', back: 'Dos', triceps: 'Triceps', lowerback: 'Lombaires', glutes: 'Fessiers', hamstrings: 'Ischios', calves: 'Mollets' },
 en: { shoulders: 'Shoulders', chest: 'Chest', biceps: 'Biceps', abs: 'Abs', quads: 'Thighs', back: 'Back', triceps: 'Triceps', lowerback: 'Lower back', glutes: 'Glutes', hamstrings: 'Hamstrings', calves: 'Calves' }
};
const MUSCLES = { shoulders: ['Shoulders', 'Rear Delts'], chest: ['Chest'], biceps: ['Biceps', 'Forearms', 'Grip'], abs: ['Core'], quads: ['Quads', 'Legs', 'Adductors', 'Groin', 'Hips'], back: ['Back', 'Lats', 'Upper Back'], triceps: ['Triceps'], lowerback: ['Lower Back', 'Posterior Chain'], glutes: ['Glutes'], hamstrings: ['Hamstrings'], calves: ['Calves'] };
export const EQUIPMENT = { Barbell: 'Barre', Bench: 'Banc', Bodyweight: 'Poids du corps', Box: 'Banc / box', Cable: 'Poulie', Cardio: 'Cardio', Chair: 'Chaise', Doorway: 'Encadrement de porte', Dumbbell: 'Haltères', Kettlebell: 'Kettlebell', Machine: 'Machine', 'Medicine Ball': 'Médecine-ball', Plate: 'Disque', 'Pull-up Bar': 'Barre de traction', 'Resistance Band': 'Élastique', Sandbag: 'Sac lesté', 'Stability Ball': 'Ballon', Towel: 'Serviette', Wall: 'Mur' };
export { norm };
const inZone = (e, zone) => !zone || e.muscles.some(m => MUSCLES[zone].includes(m));
const countedLift = e => (isOffered(e.key) ? e.key : undefined);

function BodyMap() {
  const canvas = useRef(null);
  useEffect(() => {
    const c = canvas.current, ctx = c.getContext('2d'), body = new Body(1500, 31), out = new Float32Array(66);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame, stopped = false, seen = true;
    function draw(now) {
      const W = c.width, H = c.height;
      ctx.clearRect(0, 0, W, H);
      mapPose(new Float32Array(entry.p), entry.vb, { x: W * 0.05, y: H * 0.05, w: W * 0.9, h: H * 0.9 }, out);
      body.draw(ctx, out, { alpha: 0.72, time: reduced ? 1.5 : now / 1000, dpr: DPR, size: 0.75, stars: 0.6 });
    }
    function resize() { c.width = c.clientWidth * DPR; c.height = c.clientHeight * DPR; draw(performance.now()); }
    function loop(now) { if (stopped || !seen) return; draw(now); frame = requestAnimationFrame(loop); }
    const observer = new ResizeObserver(resize); observer.observe(c); resize();
    if (!reduced) frame = requestAnimationFrame(loop);
    // Scrolled out of view, the figure stops drawing: the list scrolls with the whole frame budget.
    const io = reduced || typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      const visible = entries[entries.length - 1].isIntersecting;
      if (visible === seen) return;
      seen = visible;
      if (seen) frame = requestAnimationFrame(loop); else cancelAnimationFrame(frame);
    });
    io?.observe(c);
    return () => { stopped = true; cancelAnimationFrame(frame); observer.disconnect(); io?.disconnect(); };
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
  return <div className="guide-frames">{exercise.frames.map((src, i) => <img key={src} className={i === active ? 'active' : ''} src={src} width="320" height="320" loading="lazy" alt={`${exercise.fr} / ${exercise.name} - ${i + 1}`} />)}</div>;
}
/**
 * lift: the exercise a beginner is about to film (level.js, until three sets are saved): the guide
 * opens on that one exercise, its drawings and the way on to filming; the whole guide is one tap away.
 */
export default function Guide({ onClose, onChoose, lift }) {
  const { lang, setLang } = useT(), fr = lang === 'fr';
  const [query, setQuery] = useState(''), [zone, setZone] = useState(null), [view, setView] = useState('front'), [open, setOpen] = useState(null);
  const [focus, setFocus] = useState(() => { const e = lift ? CATALOGUE.find(x => x.key === lift) : null; return e && countedLift(e) ? e : null; });
  // An exercise the guide does not hold goes straight on to filming, never to the whole catalogue.
  const [missing] = useState(() => !!lift && !focus);
  // The title condenses into the topbar as the list scrolls under it (section 3, change 1).
  const screenRef = useRef(null);
  useCondensingTopbar(screenRef, [!!focus, lang]);
  useEffect(() => { if (missing) onChoose(lift); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (missing) return <div className="wv-experience" aria-busy="true" />;
  if (focus) return <div className="wv-experience">
    <section ref={screenRef} className="screen is-active guide-screen"><div className="wrap">
      <div className="topbar"><button className="icon-btn press" onClick={onClose} aria-label={fr ? 'Retour' : 'Back'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg></button><span className="pill">{fr ? 'Version de test' : 'Test version'}</span></div>
      <h1 className="title" data-reveal style={{ '--i': 0 }}>{fr ? 'Le geste, avant de filmer.' : 'The movement, before you film.'}</h1>
      <p className="sub" data-reveal style={{ '--i': 1 }}>{fr ? 'Regardez le mouvement, puis filmez votre série. Ce guide s’affiche avant vos trois premières séries.' : 'Watch the movement, then film your set. This guide shows before your first three sets.'}</p>
      <div className="guide-focus" data-testid="guide-focus" data-reveal style={{ '--i': 2 }}>
        <p className="item-name">{fr ? focus.fr : focus.name}</p>
        <GuideFrames exercise={focus} />
        <button className="btn-primary press" onClick={() => onChoose(focus.key)}>{fr ? 'Filmer cet exercice' : 'Film this exercise'}</button>
        <button className="btn-ghost is-s press" onClick={() => setFocus(null)}>{fr ? 'Tous les exercices' : 'All exercises'}</button>
      </div>
      <p className="guide-credit">{fr ? 'Illustrations\u00A0:' : 'Illustrations:'} Everkinetic, via <a href="https://github.com/bryllim/workout-guide" target="_blank" rel="noreferrer">bryllim/workout-guide</a>, <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>. {fr ? 'Redimensionnées et converties en WebP.' : 'Resized and converted to WebP.'}</p>
    </div></section>
  </div>;
  const q = norm(query.trim());
  const list = CATALOGUE.filter(e => inZone(e, zone)).filter(e => !q || norm([e.fr, e.name, ...e.aliases, e.equipment, EQUIPMENT[e.equipment], ...Object.keys(MUSCLES).filter(z => inZone(e, z)).flatMap(z => [ZONE_NAMES.fr[z], ZONE_NAMES.en[z]]), ...e.muscles].join(' ')).includes(q));
  function pickZone(z) { setZone(previous => previous === z ? null : z); setOpen(null); }
  return <div className="wv-experience">
    <section ref={screenRef} className="screen is-active guide-screen"><div className="wrap">
      <div className="topbar"><button className="icon-btn press" onClick={onClose} aria-label={fr ? 'Retour' : 'Back'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg></button><span className="pill">{fr ? 'Version de test' : 'Test version'}</span></div>
      <h1 className="title" data-reveal style={{ '--i': 0 }}>{fr ? 'Trouvez votre mouvement.' : 'Find your movement.'}</h1>
      <p className="sub" data-reveal style={{ '--i': 1 }}>{fr ? 'Touchez une zone du corps ou cherchez un nom.' : 'Tap a body area or search for a name.'}</p>
      <div className="search" data-reveal style={{ '--i': 2 }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg><label className="sr" htmlFor="guide-search">{fr ? 'Rechercher un exercice' : 'Search exercises'}</label><input id="guide-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={fr ? 'Nom, muscle, matériel…' : 'Name, muscle, equipment…'} /></div>
      <div className="map" data-reveal style={{ '--i': 3 }}>
        <div className="map-fig"><div className="map-inner"><BodyMap />{ZONES[view].map(z => <button key={z} className="spot" style={{ left: `${5 + entry.spots[view][z][0] * 0.9}%`, top: `${5 + entry.spots[view][z][1] * 0.9}%` }} aria-label={ZONE_NAMES[lang][z]} aria-pressed={zone === z} onClick={() => pickZone(z)}><i /></button>)}</div></div>
        <div className="map-side"><div className="seg"><button aria-pressed={view === 'front'} onClick={() => setView('front')}>{fr ? 'Face' : 'Front'}</button><button aria-pressed={view === 'back'} onClick={() => setView('back')}>{fr ? 'Dos' : 'Back view'}</button></div>
          {ZONES[view].map(z => <button key={z} className="chip press" aria-pressed={zone === z} onClick={() => pickZone(z)}><span>{ZONE_NAMES[lang][z]}</span><span className="ct">{CATALOGUE.filter(e => inZone(e, z)).length}</span></button>)}
        </div>
      </div>
      <div className="guide-tools" data-reveal style={{ '--i': 4 }}><button className="btn-ghost is-s press" onClick={() => { setZone(null); setQuery(''); setOpen(null); }}>{fr ? 'Tous les exercices' : 'All exercises'}</button><button className="btn-ghost is-s press" lang={fr ? 'en' : 'fr'} onClick={() => setLang(fr ? 'en' : 'fr')}>{fr ? 'English' : 'Français'}</button></div>
      <p className="list-head" role="status" data-reveal style={{ '--i': 5 }}>{list.length} / {CATALOGUE.length} {fr ? 'exercices' : 'exercises'}</p>
      <ul className="list">{list.map(e => <li key={e.key} className="item" data-exercise={e.key}>
        <button className="item-btn press" aria-expanded={open === e.key} onClick={() => setOpen(open === e.key ? null : e.key)}>
          <span className="thumb"><img src={e.frames[0]} loading="lazy" width="56" height="56" alt="" /></span>
          <span><span className="item-name">{fr ? e.fr : e.name}</span><span className="item-sub">{fr ? e.name : e.fr} · {fr ? EQUIPMENT[e.equipment] : e.equipment}</span></span>
          <span className={`tag ${countedLift(e) ? 'on' : ''}`}>{countedLift(e) ? tierTag(tierOf(e.key), fr) : 'Guide'}</span>
        </button>
        {open === e.key && <div className="guide-detail"><GuideFrames exercise={e} /><p>{countedLift(e) ? `${fr ? 'Compté' : 'Counted'} · ${tierLabel(tierOf(e.key), fr)}.` : (fr ? 'Guide uniquement. Cet exercice n’est pas compté.' : 'Guide only. This exercise is not counted.')}{e.similar ? (fr ? ' Dessin d’un mouvement proche.' : ' Drawing of a similar movement.') : ''}</p>
          {countedLift(e) && <button className="btn-line press" onClick={() => onChoose(countedLift(e))}>{fr ? 'Filmer cet exercice' : 'Film this exercise'}</button>}
          <button className="btn-ghost is-s press" onClick={() => setOpen(null)}>{fr ? 'Fermer' : 'Close'}</button>
        </div>}
      </li>)}</ul>
      {!list.length && <p className="empty">{fr ? 'Aucun exercice trouvé.' : 'No exercises found.'}</p>}
      <p className="guide-credit">{fr ? 'Illustrations\u00A0:' : 'Illustrations:'} Everkinetic, via <a href="https://github.com/bryllim/workout-guide" target="_blank" rel="noreferrer">bryllim/workout-guide</a>, <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>. {fr ? 'Redimensionnées et converties en WebP.' : 'Resized and converted to WebP.'}</p>
    </div></section>
  </div>;
}
