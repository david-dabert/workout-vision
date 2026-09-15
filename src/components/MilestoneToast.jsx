import { useState, useEffect } from 'react';
import { getMilestones } from '../lib/storage';
import { useT } from '../lib/LanguageContext';

const MILESTONE_KEYS = [
  { key: 'first_workout', icon: '🎯' },
  { key: 'ten_workouts', icon: '🔟' },
  { key: 'twenty_five_workouts', icon: '🏅' },
  { key: 'fifty_workouts', icon: '🏆' },
  { key: 'first_a_grade', icon: '⭐' },
  { key: 'five_day_streak', icon: '🔥' },
  { key: 'form_improved', icon: '📈' },
];

const SEEN_KEY = 'wv-milestones-seen';

export default function MilestoneToast() {
  const { t } = useT();
  const [toast, setToast] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    (async () => {
      const milestones = await getMilestones();
      if (!milestones || Object.keys(milestones).length === 0) return;

      const seen = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}');
      // Find the first newly achieved milestone not yet shown
      for (const { key, icon } of MILESTONE_KEYS) {
        if (milestones[key] && !seen[key]) {
          seen[key] = true;
          localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
          const label = t(`milestone_${key}`) || key.replace(/_/g, ' ');
          setToast({ icon, label });
          setVisible(true);
          setTimeout(() => setVisible(false), 4000);
          break;
        }
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!toast) return null;

  return (
    <div
      className="milestone-toast"
      style={{
        position: 'fixed',
        top: visible ? 'calc(env(safe-area-inset-top, 0px) + 16px)' : '-80px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 20px',
        borderRadius: 'var(--radius)',
        background: 'rgba(0, 245, 212, 0.12)',
        border: '1px solid rgba(0, 245, 212, 0.3)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        transition: 'top 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        maxWidth: 'calc(100vw - 32px)',
      }}
    >
      <span style={{ fontSize: 24 }}>{toast.icon}</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.88rem' }}>
        {toast.label}
      </span>
    </div>
  );
}
