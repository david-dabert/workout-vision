import { useState, useEffect } from 'react';
import { getAllWorkouts } from '../lib/storage';
import { useProfile } from '../lib/ProfileContext';
import { generatePhysicalAnalysis, generateWorkoutPlan } from '../lib/planner';
import { EXERCISES } from '../lib/exercises';
import { useT } from '../lib/LanguageContext';

const exerciseName = (key) => EXERCISES[key]?.name || key.replace(/_/g, ' ');

const bmiColor = (val) => {
  if (val < 18.5 || val >= 30) return 'var(--red)';
  if (val >= 25) return 'var(--yellow)';
  return 'var(--accent)';
};

const ZONE_COLORS = ['var(--blue)', 'var(--accent)', 'var(--yellow)', '#ff6d00', 'var(--red)'];
const getZoneLabels = (t) => [t('recovery'), t('aerobic'), t('tempo'), t('threshold'), t('vo2max')];

const s = {
  page: { padding: 16, paddingBottom: 100, minHeight: '100vh', background: 'var(--bg)' },
  header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 },
  backBtn: {
    background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)',
    borderRadius: 'var(--radius-sm)', padding: '8px 12px', cursor: 'pointer', fontSize: '0.9rem',
  },
  title: { fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', margin: 0 },
  tabs: { display: 'flex', gap: 4, background: 'var(--card)', borderRadius: 'var(--radius-sm)', padding: 4, marginBottom: 20 },
  tab: (active) => ({
    flex: 1, padding: '10px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s',
    background: active ? 'var(--accent)' : 'transparent', color: active ? '#000' : 'var(--muted)',
  }),
  card: { background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: 20, marginBottom: 14 },
  cardTitle: { fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', marginBottom: 14, marginTop: 0 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 },
  statBox: { background: 'var(--card-elevated)', borderRadius: 'var(--radius-sm)', padding: '14px 12px', textAlign: 'center' },
  statValue: { fontSize: '1.3rem', fontWeight: 800, color: 'var(--text)', display: 'block' },
  statLabel: { fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 4, display: 'block' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' },
  rowLast: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' },
  rowLabel: { fontSize: '0.85rem', color: 'var(--muted)' },
  rowValue: { fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' },
  zoneRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' },
  zoneName: { fontSize: '0.75rem', color: 'var(--muted)', width: 80, flexShrink: 0 },
  zoneBar: (w, c) => ({ height: 10, borderRadius: 5, width: `${w}%`, background: c, minWidth: 20 }),
  zoneBpm: { fontSize: '0.72rem', color: 'var(--text)', width: 90, textAlign: 'right', flexShrink: 0 },
  recommendation: { background: 'var(--card-elevated)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 8, borderLeft: '3px solid var(--accent)' },
  recText: { fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.5, margin: 0 },
  splitBadge: {
    display: 'inline-block', padding: '6px 14px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700,
    background: 'rgba(0,230,118,0.1)', color: 'var(--accent)', border: '1px solid rgba(0,230,118,0.25)',
    marginRight: 8, marginBottom: 8,
  },
  periodBadge: {
    display: 'inline-block', padding: '6px 14px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
    background: 'rgba(68,138,255,0.1)', color: 'var(--blue)', border: '1px solid rgba(68,138,255,0.2)',
    marginRight: 8, marginBottom: 8,
  },
  dayCard: (exp) => ({
    background: 'var(--card-elevated)', borderRadius: 'var(--radius-sm)',
    border: exp ? '1px solid rgba(0,230,118,0.25)' : '1px solid var(--border)',
    marginBottom: 10, overflow: 'hidden',
  }),
  dayHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', cursor: 'pointer', userSelect: 'none' },
  dayTitle: { fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' },
  dayMuscles: { fontSize: '0.72rem', color: 'var(--muted)', marginTop: 2 },
  chevron: (exp) => ({ color: 'var(--muted)', fontSize: '0.8rem', transition: 'transform 0.2s', transform: exp ? 'rotate(180deg)' : 'rotate(0deg)' }),
  exerciseRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 16px', borderTop: '1px solid var(--border)' },
  exName: { fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' },
  exDetail: { fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 },
  exNote: { fontSize: '0.7rem', color: 'var(--yellow)', fontStyle: 'italic', marginTop: 3 },
  exRight: { textAlign: 'right', flexShrink: 0, marginLeft: 12 },
  macroRow: { marginBottom: 12 },
  macroHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 },
  macroLabel: { fontSize: '0.78rem', color: 'var(--muted)' },
  macroValue: { fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' },
  barOuter: { height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden', marginTop: 4 },
  barInner: (pct, c) => ({ height: '100%', borderRadius: 3, width: `${Math.min(pct, 100)}%`, background: c }),
  updatePrompt: {
    background: 'var(--card-elevated)', borderRadius: 'var(--radius-sm)', padding: '12px 16px',
    marginBottom: 16, borderLeft: '3px solid var(--yellow)', display: 'flex', alignItems: 'center', gap: 10,
  },
  primaryBtn: {
    background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 'var(--radius-sm)',
    padding: '12px 24px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
  },
};

export default function WorkoutPlan({ onClose }) {
  const { t } = useT();
  const { profile } = useProfile();
  const [analysis, setAnalysis] = useState(null);
  const [plan, setPlan] = useState(null);
  const [tab, setTab] = useState('analysis');
  const [expandedDay, setExpandedDay] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [profile]);

  async function loadData() {
    try {
      if (!profile) { setLoading(false); return; }

      const workouts = await getAllWorkouts();
      setAnalysis(generatePhysicalAnalysis(profile));
      setPlan(generateWorkoutPlan(profile, workouts));
    } catch (err) {
      console.error('WorkoutPlan load error:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={onClose}>&larr;</button>
        <h1 style={s.title}>{t('workout_plan')}</h1>
      </div>
      <div style={{ ...s.card, textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: '1.5rem', marginBottom: 12 }}>{t('generating')}</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{t('building_plan')}</div>
      </div>
    </div>
  );

  if (!profile) return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={onClose}>&larr;</button>
        <h1 style={s.title}>{t('workout_plan')}</h1>
      </div>
      <div style={{ ...s.card, textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>&#128170;</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t('no_profile_found')}</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 24 }}>{t('setup_profile_first')}</div>
        <button style={s.primaryBtn} onClick={onClose}>{t('go_to_profile')}</button>
      </div>
    </div>
  );

  const missingFields = !profile.experience || !profile.goal || !profile.restingHR;
  const bmiVal = analysis?.bmi?.value || 0;

  // Convert heart rate zones object to array
  const hrZonesArray = analysis?.heartRateZones
    ? Object.entries(analysis.heartRateZones).map(([key, z], i) => ({
        name: getZoneLabels(t)[i] || z.label,
        min: z.min,
        max: z.max,
        label: z.label,
      }))
    : [];

  // Compute macros from calorie target
  const calTarget = analysis?.calories?.target || 0;
  const proteinG = analysis?.protein?.gramsPerDay || 0;
  const proteinCal = proteinG * 4;
  const fatG = Math.round(calTarget * 0.25 / 9);
  const carbG = Math.round((calTarget - proteinCal - fatG * 9) / 4);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={onClose}>&larr;</button>
        <h1 style={s.title}>{t('workout_plan')}</h1>
      </div>

      {missingFields && (
        <div style={s.updatePrompt}>
          <span style={{ fontSize: '1.1rem' }}>&#9888;&#65039;</span>
          <p style={{ fontSize: '0.8rem', color: 'var(--yellow)', margin: 0 }}>
            {t('profile_incomplete_hint')}
          </p>
        </div>
      )}

      <div style={s.tabs}>
        <button style={s.tab(tab === 'analysis')} onClick={() => setTab('analysis')}>{t('my_analysis')}</button>
        <button style={s.tab(tab === 'plan')} onClick={() => setTab('plan')}>{t('workout_plan')}</button>
      </div>

      {tab === 'analysis' && analysis && (
        <>
          {/* Key Stats */}
          <div style={s.card}>
            <h3 style={s.cardTitle}>{t('key_stats')}</h3>
            <div style={s.statsGrid}>
              <div style={s.statBox}>
                <span style={s.statValue}>{profile.height || '--'}</span>
                <span style={s.statLabel}>{t('height_cm')}</span>
              </div>
              <div style={s.statBox}>
                <span style={s.statValue}>{profile.weight || '--'}</span>
                <span style={s.statLabel}>{t('weight_kg')}</span>
              </div>
              <div style={s.statBox}>
                <span style={s.statValue}>{profile.age || '--'}</span>
                <span style={s.statLabel}>{t('age')}</span>
              </div>
              <div style={s.statBox}>
                <span style={{ ...s.statValue, color: bmiColor(bmiVal) }}>
                  {bmiVal > 0 ? bmiVal.toFixed(1) : '--'}
                </span>
                <span style={s.statLabel}>{t('bmi')} {analysis.bmi ? `(${analysis.bmi.classification})` : ''}</span>
              </div>
            </div>
          </div>

          {/* Body Composition */}
          <div style={s.card}>
            <h3 style={s.cardTitle}>{t('body_composition')}</h3>
            <div style={s.row}>
              <span style={s.rowLabel}>{t('est_body_fat')}</span>
              <span style={s.rowValue}>{analysis.bodyFat?.estimatedPct?.toFixed(1) || '--'}%</span>
            </div>
            <div style={s.row}>
              <span style={s.rowLabel}>{t('ideal_weight')}</span>
              <span style={s.rowValue}>{analysis.idealWeightRange ? `${analysis.idealWeightRange.min}-${analysis.idealWeightRange.max} kg` : '--'}</span>
            </div>
            <div style={s.row}>
              <span style={s.rowLabel}>{t('bmr')}</span>
              <span style={s.rowValue}>{analysis.bmr ? `${analysis.bmr} ${t('kcal')}` : '--'}</span>
            </div>
            <div style={s.rowLast}>
              <span style={s.rowLabel}>{t('tdee')}</span>
              <span style={s.rowValue}>{analysis.tdee ? `${analysis.tdee} ${t('kcal')}` : '--'}</span>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: 8 }}>
              {analysis.bodyFat?.accuracyNote || ''}
            </div>
          </div>

          {/* Heart Rate Zones */}
          {hrZonesArray.length > 0 && (
            <div style={s.card}>
              <h3 style={s.cardTitle}>{t('hr_zones')}</h3>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 10 }}>
                {t('max_hr')} {analysis.maxHR} {t('bpm')} | {t('resting')} {profile.restingHR || '70'} {t('bpm')}
              </div>
              {hrZonesArray.map((z, i) => (
                <div key={i} style={s.zoneRow}>
                  <span style={s.zoneName}>{z.name}</span>
                  <div style={{ flex: 1 }}>
                    <div style={s.zoneBar(20 + i * 15, ZONE_COLORS[i])} />
                  </div>
                  <span style={s.zoneBpm}>{z.min}-{z.max} {t('bpm')}</span>
                </div>
              ))}
            </div>
          )}

          {/* Daily Targets */}
          <div style={s.card}>
            <h3 style={s.cardTitle}>{t('daily_targets')}</h3>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 12 }}>
              {analysis.calories?.note || ''}
            </div>
            <MacroBar label={t('calories')} value={calTarget} unit={t('kcal')} color="var(--accent)" max={3500} />
            <MacroBar label={t('protein_cap')} value={proteinG} unit="g" color="var(--blue)" max={250} />
            <MacroBar label={t('carbs')} value={carbG} unit="g" color="var(--yellow)" max={400} />
            <MacroBar label={t('fat')} value={fatG} unit="g" color="var(--red)" max={150} />
          </div>

          {/* Strength Potential */}
          {analysis.strengthPotential && (
            <div style={s.card}>
              <h3 style={s.cardTitle}>{t('est_1rm')}</h3>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 10 }}>
                {analysis.strengthPotential.note}
              </div>
              <div style={s.row}>
                <span style={s.rowLabel}>{t('squat')}</span>
                <span style={s.rowValue}>{analysis.strengthPotential.squat1RM} kg</span>
              </div>
              <div style={s.row}>
                <span style={s.rowLabel}>{t('bench_press')}</span>
                <span style={s.rowValue}>{analysis.strengthPotential.benchPress1RM} kg</span>
              </div>
              <div style={s.rowLast}>
                <span style={s.rowLabel}>{t('deadlift')}</span>
                <span style={s.rowValue}>{analysis.strengthPotential.deadlift1RM} kg</span>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {analysis.recommendations?.length > 0 && (
            <div style={s.card}>
              <h3 style={s.cardTitle}>{t('recommendations')}</h3>
              {analysis.recommendations.map((rec, i) => (
                <div key={i} style={s.recommendation}>
                  <p style={s.recText}>{rec}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'plan' && plan && (
        <>
          <div style={s.card}>
            <h3 style={s.cardTitle}>{t('your_program')}</h3>
            <div style={{ marginBottom: 12 }}>
              <span style={s.splitBadge}>{plan.split}</span>
              <span style={s.periodBadge}>{plan.daysPerWeek} {t('days_week')}</span>
            </div>
            {plan.periodization && (
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.5, padding: '10px 14px', background: 'var(--card-elevated)', borderRadius: 'var(--radius-sm)' }}>
                {plan.periodization.mesocycleWeeks}-{t('week_mesocycle')} {plan.periodization.structure.map(w => w.label).join(' → ')}
              </div>
            )}
          </div>

          {plan.program.map((day, i) => (
            <div key={i} style={s.dayCard(expandedDay === i)}>
              <div style={s.dayHeader} onClick={() => setExpandedDay(expandedDay === i ? null : i)}>
                <div>
                  <div style={s.dayTitle}>{t('day')} {i + 1}: {day.name}</div>
                  <div style={s.dayMuscles}>{day.muscleGroups.join(' / ')}</div>
                </div>
                <span style={s.chevron(expandedDay === i)}>&#9660;</span>
              </div>
              {expandedDay === i && (
                <div>
                  {day.exercises.map((ex, j) => (
                    <div key={j} style={s.exerciseRow}>
                      <div style={{ flex: 1 }}>
                        <div style={s.exName}>{exerciseName(ex.exerciseKey)}</div>
                        <div style={s.exDetail}>
                          {ex.sets} x {ex.reps} | {t('rest_colon')} {ex.restSeconds}s
                        </div>
                        {ex.notes && <div style={s.exNote}>{ex.notes}</div>}
                      </div>
                      <div style={s.exRight}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent)' }}>
                          {ex.sets}x{ex.reps}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Deload info */}
          {plan.deloadWeek && (
            <div style={{ ...s.card, borderLeft: '3px solid var(--blue)' }}>
              <h3 style={s.cardTitle}>{plan.deloadWeek.label}</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.5, margin: 0 }}>
                {plan.deloadWeek.instructions}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MacroBar({ label, value, unit, color, max }) {
  const pct = value ? (value / max) * 100 : 0;
  return (
    <div style={s.macroRow}>
      <div style={s.macroHeader}>
        <span style={s.macroLabel}>{label}</span>
        <span style={s.macroValue}>{value ? Math.round(value) : '--'} {unit}</span>
      </div>
      <div style={s.barOuter}>
        <div style={s.barInner(pct, color)} />
      </div>
    </div>
  );
}
