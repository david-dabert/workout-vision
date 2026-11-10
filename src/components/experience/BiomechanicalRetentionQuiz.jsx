import { useState, useEffect } from 'react';
import { useT } from '../../lib/LanguageContext';
import { saveProfile } from '../../lib/storage';
import './BiomechanicalRetentionQuiz.css';

const PHYSIQUES = [
  {
    id: 'v_taper',
    titleFr: 'V-Taper athlétique',
    titleEn: 'Athletic V-Taper',
    descFr: 'Épaules larges, dos dessiné en V et taille étroite',
    descEn: 'Broad shoulders, wide V-shaped back, tight waist',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 4h16l-5 16H9L4 4z" />
        <path d="M9 4v4m6-4v4" />
      </svg>
    ),
  },
  {
    id: 'power_density',
    titleFr: 'Puissance & Densité',
    titleEn: 'Power & Density',
    descFr: 'Masse musculaire dense, trapèzes épais et cuisses massives',
    descEn: 'Dense muscular mass, thick traps, powerful quads',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="8" width="18" height="12" rx="2" />
        <path d="M7 8V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3" />
        <line x1="8" y1="14" x2="16" y2="14" />
      </svg>
    ),
  },
  {
    id: 'lean_athletic',
    titleFr: 'Athlète découpé & Sec',
    titleEn: 'Lean & Functional Athlete',
    descFr: 'Abdominaux visibles, silhouette athlétique et agile',
    descEn: 'Visible abs, athletic lines, speed and agility',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
  {
    id: 'glute_curves',
    titleFr: 'Galbe & Chaîne postérieure',
    titleEn: 'Glute Curves & Posture',
    descFr: 'Fessiers galbés, hanches fortes et colonne décompressée',
    descEn: 'Full glutes, strong hips, sculpted posterior chain',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3a9 9 0 0 0 0 18" />
      </svg>
    ),
  },
  {
    id: 'posture_health',
    titleFr: 'Longévité & Zéro douleur',
    titleEn: 'Longevity & Pain-Free Joints',
    descFr: 'Santé articulaire kiné, posture droite et mobilité libre',
    descEn: 'Physical therapy joint health, upright posture, freedom of movement',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 14h-2v-2h2zm0-4h-2V7h2z" />
      </svg>
    ),
  },
];

const MUSCLE_FOCUS = [
  { id: 'chest_shoulders', labelFr: 'Pectoraux & Épaules', labelEn: 'Chest & Shoulders' },
  { id: 'back_lats', labelFr: 'Dos & Grand dorsal (V-Shape)', labelEn: 'Back & Lats (V-Shape)' },
  { id: 'arms', labelFr: 'Bras (Biceps & Triceps)', labelEn: 'Arms (Biceps & Triceps)' },
  { id: 'glutes_posterior', labelFr: 'Fessiers & Ischios', labelEn: 'Glutes & Hamstrings' },
  { id: 'quads_legs', labelFr: 'Cuisses & Quadriceps', labelEn: 'Quads & Legs' },
  { id: 'core_abs', labelFr: 'Abdominaux & Gainage profond', labelEn: 'Core & Deep Abs' },
];

const SHORT_TERMS = [
  { id: 'unlock_rep', labelFr: 'Débloquer un palier technique (15 pompes ou 1 traction stricte)', labelEn: 'Unlock a milestone (15 perfect push-ups or 1 pull-up)' },
  { id: 'pr_breakthrough', labelFr: 'Battre un record de charge (+10 kg à +20 kg en sécurité)', labelEn: 'Break a strength PR (+10 kg to +20 kg safely)' },
  { id: 'pain_free', labelFr: 'Éliminer mes douleurs aux genoux / épaules / bas du dos', labelEn: 'Eliminate knee, shoulder or lower back discomfort' },
  { id: 'fat_loss', labelFr: 'Affiner ma taille tout en conservant mes muscles', labelEn: 'Drop body fat while retaining muscle mass' },
  { id: 'regularity', labelFr: 'Créer une routine sans sauter de séance (3x par semaine)', labelEn: 'Build bulletproof regularity (3x per week)' },
];

const LONG_TERMS = [
  { id: 'body_transformation', labelFr: 'Transformation corporelle spectaculaire et visible', labelEn: 'Dramatic, visible full body transformation' },
  { id: 'strength_mastery', labelFr: 'Atteindre le sommet de ma force athlétique naturelle', labelEn: 'Reach peak natural strength potential' },
  { id: 'bulletproof_joints', labelFr: 'Construire une armure articulaire pour les 20 prochaines années', labelEn: 'Build bulletproof joints for the next 20 years' },
  { id: 'athletic_performance', labelFr: 'Dominer mes performances sportives sur le terrain', labelEn: 'Dominate athletic performance in my sport' },
];

const SESSION_TIMES = [
  { id: '30m', labelFr: '20 à 30 min (Express)', labelEn: '20 to 30 min (Express)' },
  { id: '45m', labelFr: '45 min (Équilibre optimal)', labelEn: '45 min (Optimal balance)' },
  { id: '60m', labelFr: '60 min (Séance complète)', labelEn: '60 min (Full session)' },
  { id: '75m', labelFr: '75 min et plus (Athlète)', labelEn: '75 min+ (Athlete)' },
];

const DAYS_PER_WEEK = [
  { id: '2_days', labelFr: '2 jours par semaine', labelEn: '2 days per week' },
  { id: '3_4_days', labelFr: '3 à 4 jours par semaine', labelEn: '3 to 4 days per week' },
  { id: '5_plus', labelFr: '5 jours ou plus', labelEn: '5+ days per week' },
];

const EQUIPMENT_OPTIONS = [
  { id: 'commercial_gym', labelFr: 'Salle complète (machines, poulies, barres)', labelEn: 'Commercial gym (machines, cables, barbells)' },
  { id: 'home_gym', labelFr: 'Haltères et banc à domicile', labelEn: 'Home gym with dumbbells and bench' },
  { id: 'bodyweight', labelFr: 'Poids du corps (calisthénie, barre de traction)', labelEn: 'Bodyweight only (calisthenics, pull-up bar)' },
];

const JOINT_SENSITIVITIES = [
  { id: 'none', labelFr: 'Aucune douleur particulière', labelEn: 'No pain or discomfort' },
  { id: 'shoulders', labelFr: 'Épaules (conflit sous-acromial, instabilité)', labelEn: 'Shoulders (impingement, instability)' },
  { id: 'lower_back', labelFr: 'Bas du dos / Lombaires', labelEn: 'Lower back / Lumbar strain' },
  { id: 'knees', labelFr: 'Genoux (tendon rotulien)', labelEn: 'Knees (patellar tendon)' },
];

export default function BiomechanicalRetentionQuiz({ onComplete, onClose, initialData = {} }) {
  const { lang } = useT();
  const fr = lang === 'fr';

  const [step, setStep] = useState(0); // 0=Intro, 1=Bio, 2=Physique, 3=Muscle, 4=Goals, 5=Time, 6=Gear, 7=Synthesizing, 8=Payoff
  const [height, setHeight] = useState(initialData.height || 178);
  const [weight, setWeight] = useState(initialData.weight || 75);
  const [age, setAge] = useState(initialData.age || 28);
  const [sex, setSex] = useState(initialData.sex || 'male');
  const [physique, setPhysique] = useState(initialData.physique || 'v_taper');
  const [muscleFocus, setMuscleFocus] = useState(initialData.muscleFocus || 'chest_shoulders');
  const [shortTerm, setShortTerm] = useState(initialData.shortTerm || 'unlock_rep');
  const [longTerm, setLongTerm] = useState(initialData.longTerm || 'body_transformation');
  const [sessionTime, setSessionTime] = useState(initialData.sessionTime || '45m');
  const [daysPerWeek, setDaysPerWeek] = useState(initialData.daysPerWeek || '3_4_days');
  const [equipment, setEquipment] = useState(initialData.equipment || 'commercial_gym');
  const [sensitivity, setSensitivity] = useState(initialData.sensitivity || 'none');
  const [synthPhase, setSynthPhase] = useState(0);

  const totalQuestions = 6; // Steps 1 to 6

  const tap = () => {
    navigator.vibrate?.(10);
  };

  const nextStep = () => {
    tap();
    setStep(s => s + 1);
  };

  const prevStep = () => {
    tap();
    setStep(s => Math.max(0, s - 1));
  };

  // Synthesis effect on step 7
  useEffect(() => {
    if (step !== 7) return undefined;
    const t1 = setTimeout(() => setSynthPhase(1), 800);
    const t2 = setTimeout(() => setSynthPhase(2), 1600);
    const t3 = setTimeout(() => {
      // Save profile
      const computedBmi = Number((weight / Math.pow(height / 100, 2)).toFixed(1));
      const profileData = {
        height: Number(height),
        weight: Number(weight),
        age: Number(age),
        sex,
        bmi: computedBmi,
        physique,
        muscleFocus,
        shortTerm,
        longTerm,
        sessionTime,
        daysPerWeek,
        equipment,
        sensitivity,
        completedAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem('wv_athlete_profile', JSON.stringify(profileData));
        localStorage.setItem('wv_profile_completed', 'true');
        saveProfile(profileData).catch(() => {});
      } catch {}
      setStep(8);
    }, 2400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [step, height, weight, age, sex, physique, muscleFocus, shortTerm, longTerm, sessionTime, daysPerWeek, equipment, sensitivity]);

  const bmi = (weight / Math.pow(height / 100, 2)).toFixed(1);
  const selectedPhysique = PHYSIQUES.find(p => p.id === physique) || PHYSIQUES[0];
  const selectedMuscle = MUSCLE_FOCUS.find(m => m.id === muscleFocus) || MUSCLE_FOCUS[0];

  return (
    <div className="bio-quiz-overlay" data-testid="bio-retention-quiz">
      <div className="bio-quiz-modal" role="dialog" aria-modal="true" aria-label={fr ? 'Questionnaire de profil biomécanique' : 'Biomechanical profile questionnaire'}>
        {/* Top bar with back and close */}
        <div className="bio-quiz-topbar">
          {step > 0 && step < 7 && (
            <button type="button" className="bio-quiz-back-btn press" onClick={prevStep} aria-label={fr ? 'Retour' : 'Back'}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          {step > 0 && step < 7 && (
            <div className="bio-quiz-progress-wrap">
              <div className="bio-quiz-progress-track">
                <div
                  className="bio-quiz-progress-bar"
                  style={{ width: `${(step / totalQuestions) * 100}%` }}
                />
              </div>
              <span className="bio-quiz-progress-text">{step} / {totalQuestions}</span>
            </div>
          )}
          <button type="button" className="bio-quiz-close-btn press" onClick={onClose} aria-label={fr ? 'Fermer' : 'Close'}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step 0: Hook Intro */}
        {step === 0 && (
          <div className="bio-quiz-screen bio-quiz-intro" data-testid="quiz-intro">
            <div className="bio-quiz-hero-badge">
              <span className="bio-glow-dot" aria-hidden="true" />
              <span>{fr ? 'Analyse sur mesure' : 'Custom Analysis'}</span>
            </div>
            <h2 className="bio-quiz-title">
              {fr ? 'Tirez le maximum de votre vidéo' : 'Get more out of your video'}
            </h2>
            <p className="bio-quiz-subtitle">
              {fr
                ? 'Chaque squelette est unique. Prenez 90 secondes pour calibrer vos leviers articulaires, votre morphologie et votre physique cible.'
                : 'Every skeleton is unique. Take 90 seconds to calibrate your joint levers, morphology and target physique.'}
            </p>

            <div className="bio-quiz-perks">
              <div className="bio-quiz-perk">
                <span className="bio-perk-ico" aria-hidden="true">📐</span>
                <div className="bio-perk-text">
                  <b>{fr ? 'Leviers articulaires calculés' : 'Joint levers computed'}</b>
                  <small>{fr ? 'Stance au squat et prise au couché personnalisées' : 'Personalized squat stance and bench grip width'}</small>
                </div>
              </div>
              <div className="bio-quiz-perk">
                <span className="bio-perk-ico" aria-hidden="true">🔥</span>
                <div className="bio-perk-text">
                  <b>{fr ? 'Dépense calorique exacte' : 'Exact calorie expenditure'}</b>
                  <small>{fr ? 'Zéro moyenne générique\u00A0: ajusté à votre poids réel' : 'Zero generic guessing: tailored to your actual weight'}</small>
                </div>
              </div>
              <div className="bio-quiz-perk">
                <span className="bio-perk-ico" aria-hidden="true">🎯</span>
                <div className="bio-perk-text">
                  <b>{fr ? 'Programme adapté à votre temps' : 'Plan fitted to your schedule'}</b>
                  <small>{fr ? 'Volume ciblé sur vos priorités musculaires' : 'Target volume allocated to your muscle priorities'}</small>
                </div>
              </div>
            </div>

            <div className="bio-quiz-footer">
              <button type="button" className="bio-quiz-btn-primary press" onClick={nextStep} data-testid="quiz-start-btn">
                <span>{fr ? 'Calibrer mon profil' : 'Calibrate my profile'}</span>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Biometrics */}
        {step === 1 && (
          <div className="bio-quiz-screen" data-testid="quiz-step-biometrics">
            <h2 className="bio-quiz-heading">
              {fr ? 'Vos mesures fondamentales' : 'Your basic measurements'}
            </h2>
            <p className="bio-quiz-lead">
              {fr ? 'Nécessaires pour calibrer vos ratios de levier et votre dépense énergétique.' : 'Required to calibrate your leverage ratios and energy expenditure.'}
            </p>

            <div className="bio-quiz-form">
              <div className="bio-input-group">
                <label htmlFor="bio-height" className="bio-input-label">{fr ? 'Taille (cm)' : 'Height (cm)'}</label>
                <div className="bio-num-control">
                  <button type="button" className="bio-num-btn press" onClick={() => { tap(); setHeight(h => Math.max(130, h - 1)); }}>-</button>
                  <input
                    id="bio-height"
                    type="number"
                    className="bio-num-input"
                    value={height}
                    onChange={e => setHeight(Number(e.target.value))}
                    min="130"
                    max="225"
                  />
                  <button type="button" className="bio-num-btn press" onClick={() => { tap(); setHeight(h => Math.min(225, h + 1)); }}>+</button>
                </div>
              </div>

              <div className="bio-input-group">
                <label htmlFor="bio-weight" className="bio-input-label">{fr ? 'Poids corporel (kg)' : 'Bodyweight (kg)'}</label>
                <div className="bio-num-control">
                  <button type="button" className="bio-num-btn press" onClick={() => { tap(); setWeight(w => Math.max(35, w - 1)); }}>-</button>
                  <input
                    id="bio-weight"
                    type="number"
                    className="bio-num-input"
                    value={weight}
                    onChange={e => setWeight(Number(e.target.value))}
                    min="35"
                    max="220"
                  />
                  <button type="button" className="bio-num-btn press" onClick={() => { tap(); setWeight(w => Math.min(220, w + 1)); }}>+</button>
                </div>
              </div>

              <div className="bio-input-row">
                <div className="bio-input-group">
                  <label htmlFor="bio-age" className="bio-input-label">{fr ? 'Âge' : 'Age'}</label>
                  <input
                    id="bio-age"
                    type="number"
                    className="bio-field-input"
                    value={age}
                    onChange={e => setAge(Number(e.target.value))}
                    min="14"
                    max="99"
                  />
                </div>
                <div className="bio-input-group">
                  <span className="bio-input-label">{fr ? 'Sexe biologique' : 'Biological sex'}</span>
                  <div className="bio-seg-control" role="radiogroup">
                    <button
                      type="button"
                      className={`bio-seg-btn press${sex === 'male' ? ' is-active' : ''}`}
                      role="radio"
                      aria-checked={sex === 'male'}
                      onClick={() => { tap(); setSex('male'); }}
                    >
                      {fr ? 'Homme' : 'Male'}
                    </button>
                    <button
                      type="button"
                      className={`bio-seg-btn press${sex === 'female' ? ' is-active' : ''}`}
                      role="radio"
                      aria-checked={sex === 'female'}
                      onClick={() => { tap(); setSex('female'); }}
                    >
                      {fr ? 'Femme' : 'Female'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bio-quiz-footer">
              <button type="button" className="bio-quiz-btn-primary press" onClick={nextStep} data-testid="quiz-next-btn">
                <span>{fr ? 'Continuer' : 'Continue'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Target Physique / Body Type */}
        {step === 2 && (
          <div className="bio-quiz-screen" data-testid="quiz-step-physique">
            <h2 className="bio-quiz-heading">
              {fr ? 'Quel physique voulez-vous bâtir\u00A0?' : 'What physique do you want to build?'}
            </h2>
            <p className="bio-quiz-lead">
              {fr ? 'Le moteur adapte les fourchettes de répétitions et les tempos selon votre silhouette cible.' : 'The engine fits repetition ranges and tempos to your target aesthetic.'}
            </p>

            <div className="bio-options-list" role="radiogroup" aria-label={fr ? 'Physique cible' : 'Target physique'}>
              {PHYSIQUES.map(p => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={physique === p.id}
                  className={`bio-option-card press${physique === p.id ? ' is-selected' : ''}`}
                  onClick={() => { tap(); setPhysique(p.id); }}
                  data-testid={`physique-opt-${p.id}`}
                >
                  <div className="bio-opt-icon" aria-hidden="true">{p.icon}</div>
                  <div className="bio-opt-content">
                    <span className="bio-opt-title">{fr ? p.titleFr : p.titleEn}</span>
                    <span className="bio-opt-desc">{fr ? p.descFr : p.descEn}</span>
                  </div>
                  <div className="bio-radio-indicator" aria-hidden="true" />
                </button>
              ))}
            </div>

            <div className="bio-quiz-footer">
              <button type="button" className="bio-quiz-btn-primary press" onClick={nextStep} data-testid="quiz-next-btn">
                <span>{fr ? 'Continuer' : 'Continue'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Muscle Focus */}
        {step === 3 && (
          <div className="bio-quiz-screen" data-testid="quiz-step-muscle">
            <h2 className="bio-quiz-heading">
              {fr ? 'Quelle zone voulez-vous accentuer en priorité\u00A0?' : 'Which muscle group do you want to emphasize?'}
            </h2>
            <p className="bio-quiz-lead">
              {fr ? 'WorkoutVision placera ces mouvements en début de séance pour maximiser l’intensité nerveuse.' : 'WorkoutVision prioritizes these patterns when neural freshness is highest.'}
            </p>

            <div className="bio-chips-grid" role="radiogroup" aria-label={fr ? 'Zone prioritaire' : 'Priority zone'}>
              {MUSCLE_FOCUS.map(m => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={muscleFocus === m.id}
                  className={`bio-chip-btn press${muscleFocus === m.id ? ' is-selected' : ''}`}
                  onClick={() => { tap(); setMuscleFocus(m.id); }}
                  data-testid={`muscle-chip-${m.id}`}
                >
                  <span>{fr ? m.labelFr : m.labelEn}</span>
                </button>
              ))}
            </div>

            <div className="bio-quiz-footer">
              <button type="button" className="bio-quiz-btn-primary press" onClick={nextStep} data-testid="quiz-next-btn">
                <span>{fr ? 'Continuer' : 'Continue'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Short-term and Long-term Goals */}
        {step === 4 && (
          <div className="bio-quiz-screen" data-testid="quiz-step-goals">
            <h2 className="bio-quiz-heading">
              {fr ? 'Vos objectifs d’entraînement' : 'Your workout goals'}
            </h2>
            <p className="bio-quiz-lead">
              {fr ? 'Pour calibrer les paliers de progression et les indicateurs de succès.' : 'To calibrate progression thresholds and milestone milestones.'}
            </p>

            <div className="bio-goals-section">
              <span className="bio-section-title">{fr ? 'Court terme (4 à 8 semaines)' : 'Short-term (4 to 8 weeks)'}</span>
              <div className="bio-select-cards">
                {SHORT_TERMS.map(st => (
                  <button
                    key={st.id}
                    type="button"
                    className={`bio-subcard press${shortTerm === st.id ? ' is-selected' : ''}`}
                    onClick={() => { tap(); setShortTerm(st.id); }}
                  >
                    <span>{fr ? st.labelFr : st.labelEn}</span>
                  </button>
                ))}
              </div>

              <span className="bio-section-title" style={{ marginTop: '14px' }}>{fr ? 'Long terme (6 à 12 mois)' : 'Long-term (6 to 12 months)'}</span>
              <div className="bio-select-cards">
                {LONG_TERMS.map(lt => (
                  <button
                    key={lt.id}
                    type="button"
                    className={`bio-subcard press${longTerm === lt.id ? ' is-selected' : ''}`}
                    onClick={() => { tap(); setLongTerm(lt.id); }}
                  >
                    <span>{fr ? lt.labelFr : lt.labelEn}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bio-quiz-footer">
              <button type="button" className="bio-quiz-btn-primary press" onClick={nextStep} data-testid="quiz-next-btn">
                <span>{fr ? 'Continuer' : 'Continue'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Schedule and Time Available */}
        {step === 5 && (
          <div className="bio-quiz-screen" data-testid="quiz-step-schedule">
            <h2 className="bio-quiz-heading">
              {fr ? 'Votre rythme et temps disponible' : 'Your schedule & time available'}
            </h2>
            <p className="bio-quiz-lead">
              {fr ? 'WorkoutVision optimise la densité de vos séances pour que vous ne perdiez pas une seconde.' : 'WorkoutVision optimizes session density to fit your exact availability.'}
            </p>

            <div className="bio-goals-section">
              <span className="bio-section-title">{fr ? 'Durée idéale par séance' : 'Target session duration'}</span>
              <div className="bio-select-cards">
                {SESSION_TIMES.map(st => (
                  <button
                    key={st.id}
                    type="button"
                    className={`bio-subcard press${sessionTime === st.id ? ' is-selected' : ''}`}
                    onClick={() => { tap(); setSessionTime(st.id); }}
                  >
                    <span>{fr ? st.labelFr : st.labelEn}</span>
                  </button>
                ))}
              </div>

              <span className="bio-section-title" style={{ marginTop: '14px' }}>{fr ? 'Fréquence hebdomadaire' : 'Weekly frequency'}</span>
              <div className="bio-select-cards">
                {DAYS_PER_WEEK.map(dp => (
                  <button
                    key={dp.id}
                    type="button"
                    className={`bio-subcard press${daysPerWeek === dp.id ? ' is-selected' : ''}`}
                    onClick={() => { tap(); setDaysPerWeek(dp.id); }}
                  >
                    <span>{fr ? dp.labelFr : dp.labelEn}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bio-quiz-footer">
              <button type="button" className="bio-quiz-btn-primary press" onClick={nextStep} data-testid="quiz-next-btn">
                <span>{fr ? 'Continuer' : 'Continue'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 6: Equipment and Joint Sensitivity */}
        {step === 6 && (
          <div className="bio-quiz-screen" data-testid="quiz-step-gear">
            <h2 className="bio-quiz-heading">
              {fr ? 'Matériel & Zones articulaires à protéger' : 'Gear & Joint safety priorities'}
            </h2>
            <p className="bio-quiz-lead">
              {fr ? 'Pour exclure les trajectoires à risque et filtrer votre catalogue.' : 'To filter out hazardous bar paths and tailor exercise selection.'}
            </p>

            <div className="bio-goals-section">
              <span className="bio-section-title">{fr ? 'Où vous entraînez-vous\u00A0?' : 'Where do you train?'}</span>
              <div className="bio-select-cards">
                {EQUIPMENT_OPTIONS.map(eq => (
                  <button
                    key={eq.id}
                    type="button"
                    className={`bio-subcard press${equipment === eq.id ? ' is-selected' : ''}`}
                    onClick={() => { tap(); setEquipment(eq.id); }}
                  >
                    <span>{fr ? eq.labelFr : eq.labelEn}</span>
                  </button>
                ))}
              </div>

              <span className="bio-section-title" style={{ marginTop: '14px' }}>{fr ? 'Sensibilité articulaire connue' : 'Known joint sensitivity'}</span>
              <div className="bio-select-cards">
                {JOINT_SENSITIVITIES.map(js => (
                  <button
                    key={js.id}
                    type="button"
                    className={`bio-subcard press${sensitivity === js.id ? ' is-selected' : ''}`}
                    onClick={() => { tap(); setSensitivity(js.id); }}
                  >
                    <span>{fr ? js.labelFr : js.labelEn}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bio-quiz-footer">
              <button type="button" className="bio-quiz-btn-primary press" onClick={nextStep} data-testid="quiz-finish-btn">
                <span>{fr ? 'Calculer mon profil biomécanique' : 'Synthesize my profile'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 7: The Cinematic Synthesis */}
        {step === 7 && (
          <div className="bio-quiz-screen bio-quiz-synth" data-testid="quiz-step-synthesizing">
            <div className="bio-synth-spinner">
              <svg viewBox="0 0 100 100" className="bio-spinner-svg">
                <circle cx="50" cy="50" r="42" className="bio-spinner-track" />
                <circle cx="50" cy="50" r="42" className="bio-spinner-glow" />
              </svg>
              <div className="bio-synth-center-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 2v20M2 12h20" />
                </svg>
              </div>
            </div>

            <h3 className="bio-synth-title">
              {synthPhase === 0 && (fr ? 'Calcul des ratios articulaires...' : 'Computing joint ratios...')}
              {synthPhase === 1 && (fr ? 'Calibration du métabolisme de base...' : 'Calibrating metabolic burn...')}
              {synthPhase === 2 && (fr ? 'Finalisation du profil athlète...' : 'Finalizing athlete profile...')}
            </h3>
            <p className="bio-synth-sub">
              {fr ? 'WorkoutVision configure votre modèle biomécanique 100\u00A0% local.' : 'WorkoutVision is configuring your 100% on-device biomechanical engine.'}
            </p>
          </div>
        )}

        {/* Step 8: The Payoff Identity Card */}
        {step === 8 && (
          <div className="bio-quiz-screen bio-quiz-payoff" data-testid="quiz-step-payoff">
            <div className="bio-card-badge">
              <span>✓ {fr ? 'Profil biomécanique calibré' : 'Biomechanical profile calibrated'}</span>
            </div>

            <h2 className="bio-payoff-title">
              {fr ? 'Votre profil sur mesure est prêt' : 'Your custom profile is ready'}
            </h2>
            <p className="bio-payoff-sub">
              {fr
                ? 'L’application a enregistré vos leviers et vos objectifs. Vos prochaines vidéos afficheront des repères adaptés à votre corps.'
                : 'The app has recorded your levers and goals. Your next videos will display cues tailored to your body.'}
            </p>

            <div className="bio-id-card">
              <div className="bio-id-header">
                <span className="bio-id-kicker">{fr ? 'Carte d’identité athlète' : 'Athlete Identity Card'}</span>
                <span className="bio-id-bmi">IMC {bmi}</span>
              </div>

              <div className="bio-id-metrics">
                <div className="bio-id-metric">
                  <span className="bio-id-label">{fr ? 'Taille & Poids' : 'Height & Weight'}</span>
                  <span className="bio-id-val">{height} cm · {weight} kg</span>
                </div>
                <div className="bio-id-metric">
                  <span className="bio-id-label">{fr ? 'Ratio fémur / buste' : 'Femur-to-torso ratio'}</span>
                  <span className="bio-id-val">{fr ? (height >= 175 ? '1.09 (Fémurs longs)' : height <= 162 ? '0.94 (Fémurs courts)' : '1.02 (Équilibré)') : (height >= 175 ? '1.09 (Long femurs)' : height <= 162 ? '0.94 (Short femurs)' : '1.02 (Balanced)')}</span>
                </div>
                <div className="bio-id-metric">
                  <span className="bio-id-label">{fr ? 'Silhouette cible' : 'Target physique'}</span>
                  <span className="bio-id-val">{fr ? selectedPhysique.titleFr : selectedPhysique.titleEn}</span>
                </div>
                <div className="bio-id-metric">
                  <span className="bio-id-label">{fr ? 'Priorité musculaire' : 'Muscle priority'}</span>
                  <span className="bio-id-val">{fr ? selectedMuscle.labelFr : selectedMuscle.labelEn}</span>
                </div>
                <div className="bio-id-metric">
                  <span className="bio-id-label">{fr ? 'Rythme' : 'Schedule'}</span>
                  <span className="bio-id-val">{sessionTime} · {fr ? (daysPerWeek === '3_4_days' ? '3-4x / sem' : daysPerWeek) : daysPerWeek}</span>
                </div>
              </div>

              <div className="bio-id-prescription">
                <div className="bio-rx-pill">{fr ? 'Prescription biomécanique' : 'Biomechanical prescription'}</div>
                <p className="bio-rx-text">
                  {fr
                    ? `${height >= 175 ? 'Fémurs longs détectés\u00A0: stance large (1.2x épaules) avec rotation externe des hanches de 20° pour soulager le bas du dos et maximiser le grand fessier.' : 'Leviers articulaires compacts\u00A0: amplitude complète avec genoux avançant librement sur les orteils.'} Tempo excentrique 3-1-1 pour l'hypertrophie des ${selectedMuscle.labelFr.toLowerCase()}. Protection active activée sur les ${sensitivity === 'none' ? 'articulations principales' : sensitivity}.`
                    : `${height >= 175 ? 'Long femurs detected: wide stance (1.2x shoulders) with 20° hip external rotation to protect lower back and maximize gluteus maximus recruitment.' : 'Compact joint levers: full depth with knees tracking forward over toes.'} 3-1-1 eccentric tempo for ${selectedMuscle.labelEn.toLowerCase()} hypertrophy. Active protection enabled on ${sensitivity === 'none' ? 'major joints' : sensitivity}.`}
                </p>
              </div>
            </div>

            <div className="bio-quiz-footer">
              <button
                type="button"
                className="bio-quiz-btn-primary press"
                onClick={() => {
                  tap();
                  onComplete?.({
                    height,
                    weight,
                    age,
                    sex,
                    bmi,
                    physique,
                    muscleFocus,
                    shortTerm,
                    longTerm,
                    sessionTime,
                    daysPerWeek,
                    equipment,
                    sensitivity,
                  });
                  onClose();
                }}
                data-testid="quiz-complete-btn"
              >
                <span>{fr ? 'Appliquer à mon entraînement' : 'Apply to my training'}</span>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
