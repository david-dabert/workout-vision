import { useState, useEffect } from 'react';
import { useT } from '../lib/LanguageContext';
import { getCoachProfile, saveCoachProfile, getAllClients, saveClient } from '../lib/coachStorage';
import { getRecentWorkouts } from '../lib/storage';
import { generateCoachReportPDF } from '../lib/coachPDF';
import { EXERCISES } from '../lib/exercises';
import { ExerciseAnimation } from './ExerciseGuide';
import css from './CoachReport.module.css';

export default function CoachReport({ onClose }) {
  const { t, tExercise } = useT();

  // State
  const [coach, setCoach] = useState({ name: '', credentials: '', gym: '', email: '', phone: '' });
  const [client, setClient] = useState({ name: '', age: '', sex: '', weight: '', level: '', goals: '' });
  const [clients, setClients] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [coachNotes, setCoachNotes] = useState('');
  const [toast, setToast] = useState(null);
  const [step, setStep] = useState('setup'); // setup | select | review

  // Load data on mount
  useEffect(() => {
    (async () => {
      const cp = await getCoachProfile();
      if (cp) setCoach(cp);
      const cl = await getAllClients();
      setClients(cl);
      const wk = await getRecentWorkouts(20);
      setWorkouts(wk);
    })();
  }, []);

  // Save coach profile on change
  const updateCoach = (field, value) => {
    const updated = { ...coach, [field]: value };
    setCoach(updated);
    saveCoachProfile(updated);
  };

  // Save client
  const updateClient = (field, value) => {
    setClient(prev => ({ ...prev, [field]: value }));
  };

  const handleSelectExistingClient = (cl) => {
    setClient(cl);
  };

  const handleNext = async () => {
    if (step === 'setup') {
      // Save client if new
      if (client.name && !client.id) {
        const saved = await saveClient({ ...client });
        setClient(saved);
        setClients(prev => [saved, ...prev]);
      }
      setStep('select');
    } else if (step === 'select' && selectedWorkout) {
      setStep('review');
    }
  };

  const handleGeneratePDF = () => {
    if (!selectedWorkout) return;

    const doc = generateCoachReportPDF({
      coach,
      client,
      workout: selectedWorkout,
      coachNotes: coachNotes || null,
      t,
      tExercise,
    });

    const clientName = client.name ? client.name.replace(/\s+/g, '_') : 'client';
    const date = new Date().toISOString().slice(0, 10);
    doc.save(`report_${clientName}_${date}.pdf`);

    setToast(t('coach_pdf_saved') || 'PDF saved!');
    setTimeout(() => setToast(null), 3000);
  };

  // ── Step 1: Coach & Client Setup ──
  if (step === 'setup') {
    return (
      <div className={css.page}>
        <div className={css.header}>
          <button className={css.backBtn} onClick={onClose} aria-label={t('back') || 'Back'}>
            &larr;
          </button>
          <h1 className={css.title}>{t('coach_report') || 'Coach Report'}</h1>
        </div>

        {/* Coach profile */}
        <div className={css.section}>
          <h2 className={css.sectionTitle}>{t('coach_profile') || 'Coach Profile'}</h2>
          <div className={css.fieldRow}>
            <div>
              <label className={css.label}>{t('name') || 'Name'}</label>
              <input className={css.input} value={coach.name} onChange={e => updateCoach('name', e.target.value)} placeholder="John Smith" />
            </div>
            <div>
              <label className={css.label}>{t('coach_gym') || 'Gym / Studio'}</label>
              <input className={css.input} value={coach.gym} onChange={e => updateCoach('gym', e.target.value)} placeholder="FitPro Gym" />
            </div>
          </div>
          <div className={css.fieldFull}>
            <label className={css.label}>{t('coach_credentials') || 'Credentials'}</label>
            <input className={css.input} value={coach.credentials} onChange={e => updateCoach('credentials', e.target.value)} placeholder="NSCA-CPT, CSCS" />
          </div>
          <div className={css.fieldRow}>
            <div>
              <label className={css.label}>{t('email') || 'Email'}</label>
              <input className={css.input} type="email" value={coach.email} onChange={e => updateCoach('email', e.target.value)} />
            </div>
            <div>
              <label className={css.label}>{t('phone') || 'Phone'}</label>
              <input className={css.input} type="tel" value={coach.phone} onChange={e => updateCoach('phone', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Client selection or new client */}
        <div className={css.section}>
          <h2 className={css.sectionTitle}>{t('coach_client') || 'Client'}</h2>

          {clients.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <label className={css.label}>{t('coach_existing_clients') || 'Existing Clients'}</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {clients.map(cl => (
                  <button
                    key={cl.id}
                    className={`${css.workoutItem}${client.id === cl.id ? ` ${css.workoutItemSelected}` : ''}`}
                    style={{ flex: 'none', padding: '6px 12px' }}
                    onClick={() => handleSelectExistingClient(cl)}
                  >
                    <span className={css.workoutExercise}>{cl.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={css.fieldRow}>
            <div>
              <label className={css.label}>{t('client_name') || 'Client Name'}</label>
              <input className={css.input} value={client.name} onChange={e => updateClient('name', e.target.value)} placeholder="Jane Doe" />
            </div>
            <div>
              <label className={css.label}>{t('age') || 'Age'}</label>
              <input className={css.input} value={client.age} onChange={e => updateClient('age', e.target.value)} placeholder="28" />
            </div>
          </div>
          <div className={css.fieldRow}>
            <div>
              <label className={css.label}>{t('sex') || 'Sex'}</label>
              <select className={css.select} value={client.sex} onChange={e => updateClient('sex', e.target.value)}>
                <option value="">—</option>
                <option value="male">{t('male') || 'Male'}</option>
                <option value="female">{t('female') || 'Female'}</option>
              </select>
            </div>
            <div>
              <label className={css.label}>{t('weight') || 'Weight'}</label>
              <input className={css.input} value={client.weight} onChange={e => updateClient('weight', e.target.value)} placeholder="70 kg" />
            </div>
          </div>
          <div className={css.fieldRow}>
            <div>
              <label className={css.label}>{t('experience') || 'Level'}</label>
              <select className={css.select} value={client.level} onChange={e => updateClient('level', e.target.value)}>
                <option value="">—</option>
                <option value="beginner">{t('beginner') || 'Beginner'}</option>
                <option value="intermediate">{t('intermediate') || 'Intermediate'}</option>
                <option value="advanced">{t('advanced') || 'Advanced'}</option>
              </select>
            </div>
            <div>
              <label className={css.label}>{t('goals') || 'Goals'}</label>
              <input className={css.input} value={client.goals} onChange={e => updateClient('goals', e.target.value)} placeholder={t('coach_goals_placeholder') || 'Strength, weight loss...'} />
            </div>
          </div>
        </div>

        <div className={css.actions}>
          <button
            className={css.btnPrimary}
            onClick={handleNext}
            disabled={!coach.name || !client.name}
          >
            {t('coach_select_workout') || 'Select Workout'} &rarr;
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2: Select Workout ──
  if (step === 'select') {
    return (
      <div className={css.page}>
        <div className={css.header}>
          <button className={css.backBtn} onClick={() => setStep('setup')} aria-label={t('back') || 'Back'}>
            &larr;
          </button>
          <h1 className={css.title}>{t('coach_select_session') || 'Select Session'}</h1>
        </div>

        <div className={css.section}>
          <h2 className={css.sectionTitle}>
            {t('coach_recent_workouts') || 'Recent Workouts'} ({client.name})
          </h2>

          {workouts.length === 0 ? (
            <p className={css.empty}>{t('coach_no_workouts') || 'No workouts recorded yet. Analyze a video first.'}</p>
          ) : (
            <div className={css.workoutList}>
              {workouts.map(w => {
                const exKey = w.exerciseKey || w.exercise || '';
                const exName = tExercise ? tExercise(exKey, w.exerciseName || exKey) : (w.exerciseName || exKey);
                const date = w.date || w.createdAt ? new Date(w.date || w.createdAt).toLocaleDateString() : '';
                const isSelected = selectedWorkout?.id === w.id;

                return (
                  <button
                    key={w.id}
                    className={`${css.workoutItem}${isSelected ? ` ${css.workoutItemSelected}` : ''}`}
                    onClick={() => setSelectedWorkout(w)}
                  >
                    <ExerciseAnimation exerciseKey={exKey} compact autoPlay={isSelected} />
                    <div>
                      <div className={css.workoutExercise}>{exName}</div>
                      <div className={css.workoutMeta}>
                        {date} &middot; {w.reps || 0} reps
                      </div>
                    </div>
                    {w.formScore != null && (
                      <span className={css.workoutScore}>{w.formScore}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className={css.actions}>
          <button className={css.btnSecondary} onClick={() => setStep('setup')}>
            &larr; {t('back') || 'Back'}
          </button>
          <button
            className={css.btnPrimary}
            onClick={handleNext}
            disabled={!selectedWorkout}
          >
            {t('coach_review') || 'Review'} &rarr;
          </button>
        </div>
      </div>
    );
  }

  // ── Step 3: Review & Generate ──
  const exKey = selectedWorkout?.exerciseKey || selectedWorkout?.exercise || '';
  const exName = tExercise ? tExercise(exKey, selectedWorkout?.exerciseName || exKey) : (selectedWorkout?.exerciseName || exKey);

  return (
    <div className={css.page}>
      <div className={css.header}>
        <button className={css.backBtn} onClick={() => setStep('select')} aria-label={t('back') || 'Back'}>
          &larr;
        </button>
        <h1 className={css.title}>{t('coach_review_report') || 'Review Report'}</h1>
      </div>

      {/* Preview */}
      <div className={css.preview}>
        <h3 className={css.previewTitle}>{exName}</h3>
        <div className={css.previewRow}>
          <span>{t('coach_for_client') || 'Client'}</span>
          <span className={css.previewValue}>{client.name}</span>
        </div>
        <div className={css.previewRow}>
          <span>{t('coach_by') || 'Coach'}</span>
          <span className={css.previewValue}>{coach.name}</span>
        </div>
        <div className={css.previewRow}>
          <span>{t('reps') || 'Reps'}</span>
          <span className={css.previewValue}>{selectedWorkout?.reps || 0}</span>
        </div>
        {selectedWorkout?.formScore != null && (
          <div className={css.previewRow}>
            <span>{t('form_score') || 'Form Score'}</span>
            <span className={css.previewValue}>{selectedWorkout.formScore}/100</span>
          </div>
        )}
        {selectedWorkout?.bioAnalysis?.timeUnderTension?.total != null && (
          <div className={css.previewRow}>
            <span>{t('coach_tut_total') || 'Time Under Tension'}</span>
            <span className={css.previewValue}>{selectedWorkout.bioAnalysis.timeUnderTension.total.toFixed(1)}s</span>
          </div>
        )}
      </div>

      {/* Coach notes */}
      <div className={css.section}>
        <h2 className={css.sectionTitle}>{t('coach_notes') || 'Coach Notes'}</h2>
        <textarea
          className={css.textarea}
          value={coachNotes}
          onChange={e => setCoachNotes(e.target.value)}
          placeholder={t('coach_notes_placeholder') || 'Add your observations, recommendations, and next steps for the client...'}
        />
      </div>

      <div className={css.actions}>
        <button className={css.btnSecondary} onClick={() => setStep('select')}>
          &larr; {t('back') || 'Back'}
        </button>
        <button className={css.btnPrimary} onClick={handleGeneratePDF}>
          {t('coach_generate_pdf') || 'Generate PDF'}
        </button>
      </div>

      {toast && <div className={css.toast}>{toast}</div>}
    </div>
  );
}
