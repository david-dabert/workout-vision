/**
 * WeeklyReport — weekly fitness summary with share card.
 * Shows volume, reps, sets, exercises, form trend, muscle heatmap,
 * streak, a standout callout, and a Canvas-based share button.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { getAllWorkouts } from '../lib/storage';
import { EXERCISES } from '../lib/exercises';
import { useT } from '../lib/LanguageContext';
import { translateMuscle } from '../lib/utils';
import MuscleMap from './MuscleMap';

// ── Date helpers ─────────────────────────────────────────────────────────────

function getWeekBounds(offsetWeeks = 0) {
  const now = new Date();
  const day = now.getDay(); // 0 Sun .. 6 Sat
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMon + offsetWeeks * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

function isInWeek(ts, { monday, sunday }) {
  const d = new Date(ts);
  return d >= monday && d <= sunday;
}

function buildWeekStats(workouts, bounds) {
  const hits = workouts.filter(w => isInWeek(w.createdAt || new Date(w.date).getTime(), bounds));
  if (!hits.length) return null;

  const totalReps = hits.reduce((s, w) => s + (w.reps || 0), 0);
  const totalSets = hits.length;
  const totalVolume = hits.reduce((s, w) => s + ((w.weight || 0) * (w.reps || 0)), 0);
  const exerciseSet = new Set(hits.map(w => w.exercise));
  const totalExercises = exerciseSet.size;
  const formScores = hits.filter(w => w.formScore > 0).map(w => w.formScore);
  const avgForm = formScores.length ? Math.round(formScores.reduce((a, b) => a + b, 0) / formScores.length) : null;

  // Muscle groups hit
  const primary = new Set();
  const secondary = new Set();
  for (const w of hits) {
    const ex = EXERCISES[w.exercise];
    if (ex?.muscles) {
      (ex.muscles.primary || []).forEach(m => primary.add(m));
      (ex.muscles.secondary || []).forEach(m => secondary.add(m));
    }
  }

  // Days with workouts
  const activeDays = new Set(hits.map(w => new Date(w.createdAt || w.date).toDateString()));

  // Best form score callout
  const bestEntry = [...hits]
    .filter(w => w.formScore > 0)
    .sort((a, b) => b.formScore - a.formScore)[0] || null;

  return {
    hits,
    totalReps,
    totalSets,
    totalVolume,
    totalExercises,
    avgForm,
    muscles: { primary: [...primary], secondary: [...secondary] },
    activeDays: activeDays.size,
    bestEntry,
  };
}

// ── Streak (consecutive days ending today) ───────────────────────────────────

function calcStreak(workouts) {
  if (!workouts.length) return 0;
  const days = new Set(workouts.map(w => new Date(w.createdAt || w.date).toDateString()));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (days.has(d.toDateString())) streak++;
    else if (i > 0) break;
  }
  return streak;
}

// ── Form trend arrow ─────────────────────────────────────────────────────────

function FormTrend({ thisWeek, lastWeek }) {
  const { t } = useT();
  if (thisWeek === null) return <span style={{ color: 'var(--muted)' }}>—</span>;
  if (lastWeek === null) return <span style={{ color: 'var(--accent)' }}>{thisWeek}</span>;

  const diff = thisWeek - lastWeek;
  const color = diff >= 0 ? 'var(--accent)' : 'var(--red)';
  const arrow = diff >= 0 ? '↑' : '↓';
  const sign = diff > 0 ? '+' : '';

  return (
    <span style={{ color }}>
      {thisWeek} <span style={{ fontSize: '0.85em' }}>{arrow} {sign}{diff} {t('wr_vs_last')}</span>
    </span>
  );
}

// ── Canvas share card ─────────────────────────────────────────────────────────

function buildShareCard(stats, streakCount, lang, t) {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0d1117');
  grad.addColorStop(1, '#0a1628');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid overlay
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Accent glow top-left
  const glow = ctx.createRadialGradient(200, 300, 0, 200, 300, 600);
  glow.addColorStop(0, 'rgba(0,224,150,0.12)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Header — app name
  ctx.font = 'bold 52px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.textAlign = 'left';
  ctx.fillText('Workout', 80, 120);
  ctx.fillStyle = '#00e096';
  ctx.fillText('Vision', 80 + ctx.measureText('Workout').width + 14, 120);

  // Week label
  const now = new Date();
  const weekLabel = `${t('wr_canvas_week_of')} ${now.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { month: 'long', day: 'numeric' })}`;
  ctx.font = '36px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText(weekLabel, 80, 180);

  // Divider
  ctx.strokeStyle = 'rgba(0,224,150,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(80, 220); ctx.lineTo(W - 80, 220); ctx.stroke();

  // Big stat grid (2 × 2)
  const statItems = [
    { label: t('wr_volume'), value: stats.totalVolume > 0 ? `${Math.round(stats.totalVolume).toLocaleString()}kg` : '—' },
    { label: 'REPS', value: stats.totalReps.toLocaleString() },
    { label: t('wr_sets'), value: stats.totalSets },
    { label: t('wr_exercises'), value: stats.totalExercises },
  ];

  const cellW = (W - 160) / 2;
  const cellH = 280;
  const gridY = 280;

  statItems.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 80 + col * (cellW + 20);
    const y = gridY + row * (cellH + 20);

    // Card bg
    const rr = ctx.createRoundRect ? null : null;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    roundRect(ctx, x, y, cellW, cellH, 24);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, cellW, cellH, 24);
    ctx.stroke();

    // Value
    ctx.font = `bold ${String(item.value).length > 6 ? 72 : 96}px system-ui, sans-serif`;
    ctx.fillStyle = '#00e096';
    ctx.textAlign = 'center';
    ctx.fillText(item.value, x + cellW / 2, y + cellH / 2 + 18);

    // Label
    ctx.font = '28px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText(item.label, x + cellW / 2, y + cellH - 40);
  });

  // Form score section
  const formY = gridY + 2 * (cellH + 20) + 40;

  ctx.textAlign = 'left';
  ctx.font = 'bold 36px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(t('wr_canvas_form_score'), 80, formY);

  if (stats.avgForm !== null) {
    ctx.font = 'bold 80px system-ui, sans-serif';
    const fc = stats.avgForm >= 80 ? '#00e096' : stats.avgForm >= 60 ? '#ffd60a' : '#ff3b5c';
    ctx.fillStyle = fc;
    ctx.fillText(`${stats.avgForm}`, 80, formY + 90);
    ctx.font = '36px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('/ 100', 80 + ctx.measureText(`${stats.avgForm}`).width + 10, formY + 80);
  } else {
    ctx.font = 'bold 80px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText('—', 80, formY + 90);
  }

  // Streak
  if (streakCount > 0) {
    const streakY = formY + 160;
    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'left';
    ctx.fillText(`🔥 ${streakCount} ${t('wr_canvas_streak')}`, 80, streakY);
  }

  // Best callout
  if (stats.bestEntry) {
    const calloutY = H - 360;
    ctx.fillStyle = 'rgba(0,224,150,0.1)';
    roundRect(ctx, 80, calloutY, W - 160, 180, 20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,224,150,0.25)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, 80, calloutY, W - 160, 180, 20);
    ctx.stroke();

    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillStyle = '#00e096';
    ctx.textAlign = 'left';
    ctx.fillText(t('wr_canvas_best_form'), 120, calloutY + 56);

    const name = stats.bestEntry.exerciseName || stats.bestEntry.exercise;
    const score = stats.bestEntry.formScore;
    ctx.font = 'bold 42px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    const label = `${name} ${t('wr_canvas_best_at')} ${score}/100`;
    ctx.fillText(label, 120, calloutY + 120);
  }

  // Footer
  ctx.font = '28px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.textAlign = 'center';
  ctx.fillText('workoutvision.app · 100% on-device', W / 2, H - 60);

  return canvas;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WeeklyReport({ onClose }) {
  const { t, lang } = useT();
  const [allWorkouts, setAllWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [shareMsg, setShareMsg] = useState('');

  useEffect(() => {
    getAllWorkouts().then(ws => {
      setAllWorkouts(ws);
      setLoading(false);
    });
  }, []);

  const thisWeekBounds = useMemo(() => getWeekBounds(0), []);
  const lastWeekBounds = useMemo(() => getWeekBounds(-1), []);

  const thisStats = useMemo(() => buildWeekStats(allWorkouts, thisWeekBounds), [allWorkouts, thisWeekBounds]);
  const lastStats = useMemo(() => buildWeekStats(allWorkouts, lastWeekBounds), [allWorkouts, lastWeekBounds]);
  const streak = useMemo(() => calcStreak(allWorkouts), [allWorkouts]);

  const formImprovement = useMemo(() => {
    if (!thisStats?.avgForm || !lastStats?.avgForm) return null;
    return thisStats.avgForm - lastStats.avgForm;
  }, [thisStats, lastStats]);

  const handleShare = async () => {
    if (!thisStats) return;
    setSharing(true);
    try {
      const canvas = buildShareCard(thisStats, streak, lang, t);
      canvas.toBlob(async (blob) => {
        if (!blob) { setSharing(false); return; }
        const file = new File([blob], 'weekly-report.png', { type: 'image/png' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: t('wr_share_title'), text: t('wr_share_text') });
          setShareMsg(t('wr_shared'));
        } else {
          // Fallback: download
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'weekly-report.png';
          a.click();
          URL.revokeObjectURL(url);
          setShareMsg(t('wr_downloaded'));
        }
        setTimeout(() => setShareMsg(''), 3000);
        setSharing(false);
      }, 'image/png');
    } catch {
      setSharing(false);
    }
  };

  return (
    <div className="page" style={{ background: 'var(--bg)', minHeight: '100vh', paddingBottom: 48 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 20px 12px',
        borderBottom: '1px solid var(--border, rgba(255,255,255,0.07))',
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--bg)',
      }}>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', color: 'var(--text)',
            cursor: 'pointer', padding: 4, borderRadius: 8,
            display: 'flex', alignItems: 'center',
          }}
          aria-label={t('back')}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text)' }}>
          {t('wr_title')}
        </h2>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" />
        </div>
      ) : !thisStats ? (
        <EmptyState t={t} />
      ) : (
        <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Week label */}
          <WeekLabel bounds={thisWeekBounds} lang={lang} />

          {/* Big stats row */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12,
          }}>
            <StatCard label={t('wr_volume')} value={thisStats.totalVolume > 0 ? `${Math.round(thisStats.totalVolume).toLocaleString()}` : '—'} unit={thisStats.totalVolume > 0 ? 'kg' : ''} accent />
            <StatCard label="REPS" value={thisStats.totalReps.toLocaleString()} />
            <StatCard label={t('wr_exercises')} value={thisStats.totalExercises} />
            <StatCard label={t('wr_sets')} value={thisStats.totalSets} />
          </div>

          {/* Form trend */}
          <SectionCard>
            <h3 style={sectionTitleStyle}>{t('wr_form_trend')}</h3>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <FormTrend thisWeek={thisStats.avgForm} lastWeek={lastStats?.avgForm ?? null} />
            </div>
            {formImprovement !== null && (
              <p style={{ margin: '6px 0 0', fontSize: '0.82rem', color: 'var(--muted)' }}>
                {formImprovement >= 0
                  ? t('wr_form_improving')
                  : t('wr_form_declining')}
              </p>
            )}
          </SectionCard>

          {/* Muscle heat map */}
          {thisStats.muscles.primary.length > 0 && (
            <SectionCard>
              <h3 style={sectionTitleStyle}>{t('wr_muscles')}</h3>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <MuscleMap muscles={thisStats.muscles} size={110} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 10px', marginTop: 12 }}>
                {thisStats.muscles.primary.map(m => (
                  <span key={m} style={{
                    padding: '3px 10px', borderRadius: 20,
                    background: 'rgba(0,224,150,0.15)', color: 'var(--accent)',
                    fontSize: '0.78rem', fontWeight: 600,
                    border: '1px solid rgba(0,224,150,0.25)',
                  }}>{translateMuscle(m, lang)}</span>
                ))}
                {thisStats.muscles.secondary.map(m => (
                  <span key={m} style={{
                    padding: '3px 10px', borderRadius: 20,
                    background: 'rgba(255,255,255,0.05)', color: 'var(--muted)',
                    fontSize: '0.78rem', fontWeight: 500,
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}>{translateMuscle(m, lang)}</span>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Streak */}
          {streak > 0 && (
            <SectionCard>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '2rem' }}>🔥</span>
                <div>
                  <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent)' }}>{streak}</span>
                  <span style={{ marginLeft: 6, fontSize: '0.95rem', color: 'var(--muted)' }}>{t('wr_streak_label')}</span>
                </div>
              </div>
            </SectionCard>
          )}

          {/* Best callout */}
          {thisStats.bestEntry && (
            <SectionCard accent>
              <h3 style={{ ...sectionTitleStyle, color: 'var(--accent)' }}>{t('wr_best_callout')}</h3>
              <p style={{ margin: '4px 0 0', fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
                {thisStats.bestEntry.exerciseName || thisStats.bestEntry.exercise}
                <span style={{ marginLeft: 8, color: 'var(--accent)', fontWeight: 800 }}>
                  {thisStats.bestEntry.formScore}/100
                </span>
              </p>
            </SectionCard>
          )}

          {/* Active days */}
          <ActiveDaysBar bounds={thisWeekBounds} workouts={allWorkouts} lang={lang} />

          {/* Share button */}
          <button
            onClick={handleShare}
            disabled={sharing}
            style={{
              marginTop: 8,
              padding: '15px 24px',
              borderRadius: 16,
              border: '1.5px solid var(--accent)',
              background: 'rgba(0,224,150,0.12)',
              color: 'var(--accent)',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: sharing ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              transition: 'opacity 0.2s',
              opacity: sharing ? 0.6 : 1,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            {sharing ? t('loading') : t('wr_share_btn')}
          </button>

          {shareMsg && (
            <p style={{ textAlign: 'center', color: 'var(--accent)', fontSize: '0.9rem', margin: 0 }}>
              {shareMsg}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

const sectionTitleStyle = {
  margin: '0 0 8px', fontSize: '0.75rem', fontWeight: 700,
  letterSpacing: '0.08em', color: 'var(--muted)', textTransform: 'uppercase',
};

function SectionCard({ children, accent = false }) {
  return (
    <div style={{
      background: accent ? 'rgba(0,224,150,0.06)' : 'var(--card-bg, rgba(255,255,255,0.04))',
      border: `1px solid ${accent ? 'rgba(0,224,150,0.2)' : 'var(--border, rgba(255,255,255,0.06))'}`,
      borderRadius: 16, padding: '16px 18px',
    }}>
      {children}
    </div>
  );
}

function StatCard({ label, value, unit = '', accent = false }) {
  return (
    <div style={{
      background: 'var(--card-bg, rgba(255,255,255,0.04))',
      border: '1px solid var(--border, rgba(255,255,255,0.06))',
      borderRadius: 16, padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <span style={{
        fontSize: accent ? '1.9rem' : '1.7rem',
        fontWeight: 800,
        color: accent ? 'var(--accent)' : 'var(--text)',
        lineHeight: 1.1,
      }}>
        {value}{unit && <span style={{ fontSize: '0.9rem', fontWeight: 600, marginLeft: 3 }}>{unit}</span>}
      </span>
      <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--muted)', textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
  );
}

function WeekLabel({ bounds, lang }) {
  const fmt = (d) => d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', day: 'numeric' });
  return (
    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--muted)', fontWeight: 500 }}>
      {fmt(bounds.monday)} – {fmt(bounds.sunday)}
    </p>
  );
}

function ActiveDaysBar({ bounds, workouts, lang }) {
  const { t } = useT();
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(bounds.monday);
    d.setDate(bounds.monday.getDate() + i);
    const hasWorkout = workouts.some(w =>
      new Date(w.createdAt || w.date).toDateString() === d.toDateString()
    );
    days.push({
      label: d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'narrow' }),
      active: hasWorkout,
      isToday: d.toDateString() === new Date().toDateString(),
    });
  }

  return (
    <SectionCard>
      <h3 style={sectionTitleStyle}>{t('wr_active_days')}</h3>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 4 }}>
        {days.map((day, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: day.active ? 'var(--accent)' : 'transparent',
              border: day.active ? '2px solid var(--accent)' : '2px solid var(--border, rgba(255,255,255,0.12))',
              boxShadow: day.active && day.isToday ? '0 0 10px rgba(0,224,150,0.4)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {day.active && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0d1117" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <span style={{
              fontSize: '0.65rem',
              color: day.isToday ? 'var(--text)' : 'var(--muted)',
              fontWeight: day.isToday ? 700 : 400,
            }}>{day.label}</span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function EmptyState({ t }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '60px 24px', gap: 16, textAlign: 'center',
    }}>
      <span style={{ fontSize: '3rem' }}>📊</span>
      <h3 style={{ margin: 0, color: 'var(--text)', fontWeight: 700 }}>{t('wr_empty_title')}</h3>
      <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>{t('wr_empty_desc')}</p>
    </div>
  );
}
