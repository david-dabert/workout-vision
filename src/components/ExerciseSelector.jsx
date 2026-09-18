import { useState, useRef, useEffect, useMemo } from 'react';
import { EXERCISES, EXERCISE_BY_MUSCLE } from '../lib/exercises';
import { useT } from '../lib/LanguageContext';
import { Icon, REGION_ICON_KEY } from '../lib/icons';

const REGION_KEYS = {
  Chest: 'region_chest', Back: 'region_back', Shoulders: 'region_shoulders',
  Legs: 'region_legs', Arms: 'region_arms', Core: 'region_core',
  'Full Body': 'region_full_body',
};

/**
 * Searchable exercise selector with muscle-group tabs.
 *
 * @param {string} value - current exercise key (or '__auto__')
 * @param {function} onChange - called with exercise key
 * @param {boolean} showAuto - show "Automatic" option (default true)
 * @param {string} className - optional wrapper class
 */
export default function ExerciseSelector({ value, onChange, showAuto = true, className }) {
  const { t, tExercise } = useT();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeRegion, setActiveRegion] = useState(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  // Focus search input when opening
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const regions = useMemo(() => Object.keys(EXERCISE_BY_MUSCLE), []);

  // Filter exercises by search term
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term && !activeRegion) return EXERCISE_BY_MUSCLE;

    const result = {};
    for (const [region, exercises] of Object.entries(EXERCISE_BY_MUSCLE)) {
      if (activeRegion && region !== activeRegion) continue;
      const matched = exercises.filter(ex => {
        if (!term) return true;
        const translatedName = tExercise(ex.key, ex.name).toLowerCase();
        return translatedName.includes(term) || ex.name.toLowerCase().includes(term) || ex.key.includes(term);
      });
      if (matched.length > 0) result[region] = matched;
    }
    return result;
  }, [search, activeRegion, tExercise]);

  const totalResults = useMemo(() =>
    Object.values(filtered).reduce((sum, arr) => sum + arr.length, 0),
  [filtered]);

  const displayName = value === '__auto__'
    ? t('automatic')
    : value
      ? tExercise(value, EXERCISES[value]?.name || value)
      : t('select_exercise');

  function select(key) {
    onChange(key);
    setOpen(false);
    setSearch('');
    setActiveRegion(null);
  }

  return (
    <div ref={panelRef} style={{ position: 'relative', width: '100%' }} className={className}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(''); setActiveRegion(null); }}
        aria-expanded={open}
        aria-haspopup="listbox"
        style={{
          width: '100%',
          textAlign: 'left',
          minHeight: 44,
          padding: '10px 36px 10px 12px',
          borderRadius: 'var(--radius-sm, 8px)',
          border: '1px solid var(--border, #333)',
          background: 'var(--surface-elevated, rgba(255,255,255,0.04))',
          color: value && value !== '__auto__' ? 'var(--text-primary, #f0f0f5)' : 'var(--text-secondary, #888)',
          fontWeight: value && value !== '__auto__' ? 600 : 400,
          fontSize: '0.88rem',
          cursor: 'pointer',
          position: 'relative',
        }}
      >
        {displayName}
        <span style={{
          position: 'absolute', right: 12, top: '50%', transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
          transition: 'transform 0.2s', fontSize: 12, color: 'var(--text-tertiary, #666)',
        }}>▼</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0, right: 0,
          zIndex: 100,
          marginTop: 4,
          background: 'var(--card-elevated, #111)',
          border: '1px solid var(--border, #333)',
          borderRadius: 'var(--radius-sm, 8px)',
          maxHeight: 380,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          animation: 'fadeIn 0.15s ease',
        }}>
          {/* Search input */}
          <div style={{ padding: 8, borderBottom: '1px solid var(--border, #333)' }}>
            <input
              ref={inputRef}
              type="text"
              placeholder={t('search_exercises') || 'Search exercises...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm, 8px)',
                border: '1px solid var(--border, #333)',
                background: 'var(--bg, #07070a)',
                color: 'var(--text-primary, #f0f0f5)',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Region tabs */}
          <div style={{
            display: 'flex',
            overflowX: 'auto',
            gap: 6,
            padding: '8px 10px',
            borderBottom: '1px solid var(--border, #333)',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}>
            <button
              type="button"
              onClick={() => setActiveRegion(null)}
              style={{
                padding: '6px 12px',
                borderRadius: 14,
                border: 'none',
                background: !activeRegion ? 'var(--accent, #00f5d4)' : 'rgba(255,255,255,0.06)',
                color: !activeRegion ? '#07070a' : 'var(--text-secondary, #888)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                minHeight: 32,
              }}
            >
              {t('all') || 'All'}
            </button>
            {regions.map(region => (
              <button
                key={region}
                type="button"
                onClick={() => setActiveRegion(activeRegion === region ? null : region)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 14,
                  border: 'none',
                  background: activeRegion === region ? 'var(--accent, #00f5d4)' : 'rgba(255,255,255,0.06)',
                  color: activeRegion === region ? '#07070a' : 'var(--text-secondary, #888)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  minHeight: 32,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Icon name={REGION_ICON_KEY[region] || 'weight'} size={13} color="currentColor" />
                {t(REGION_KEYS[region]) || region}
              </button>
            ))}
          </div>

          {/* Exercise list */}
          <div style={{ overflowY: 'auto', flex: 1 }} role="listbox">
            {/* Automatic option */}
            {showAuto && !search && !activeRegion && (
              <button
                type="button"
                role="option"
                aria-selected={value === '__auto__'}
                onClick={() => select('__auto__')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', textAlign: 'left',
                  padding: '10px 12px',
                  background: value === '__auto__' ? 'rgba(0, 245, 212, 0.1)' : 'transparent',
                  color: value === '__auto__' ? 'var(--accent, #00f5d4)' : 'var(--text-primary, #f0f0f5)',
                  border: 'none',
                  borderBottom: '1px solid var(--border, #333)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: value === '__auto__' ? 600 : 400,
                  minHeight: 44,
                }}
              >
                <Icon name="auto" size={16} color="currentColor" />
                {t('automatic')}
              </button>
            )}

            {Object.entries(filtered).map(([region, exercises]) => (
              <div key={region}>
                {/* Region header */}
                <div style={{
                  padding: '8px 12px 4px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text-tertiary, #666)',
                  background: 'rgba(255,255,255,0.02)',
                  position: 'sticky', top: 0,
                  zIndex: 1,
                  display: 'flex', alignItems: 'center', gap: 6,
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>
                  {t(REGION_KEYS[region]) || region}
                  <span style={{ opacity: 0.35, marginLeft: 'auto', fontSize: '0.65rem', fontWeight: 500 }}>{exercises.length}</span>
                </div>

                {exercises.map(ex => (
                  <button
                    key={ex.key}
                    type="button"
                    role="option"
                    aria-selected={value === ex.key}
                    onClick={() => select(ex.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      width: '100%', textAlign: 'left',
                      padding: '10px 12px 10px 16px',
                      background: value === ex.key ? 'rgba(0, 245, 212, 0.08)' : 'transparent',
                      color: value === ex.key ? 'var(--accent, #00f5d4)' : 'var(--text-primary, #f0f0f5)',
                      border: 'none',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: value === ex.key ? 600 : 400,
                      minHeight: 44,
                    }}
                  >
                    <span style={{ flex: 1 }}>{tExercise(ex.key, ex.name)}</span>
                    {ex.tier === 'validated' && (
                      <Icon name="check" size={12} color="var(--bio-green, #00e676)" />
                    )}
                  </button>
                ))}
              </div>
            ))}

            {totalResults === 0 && (
              <p style={{
                padding: 20, textAlign: 'center',
                color: 'var(--text-tertiary, #666)', fontSize: '0.82rem',
              }}>
                {t('no_exercises_found') || 'No exercises found'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
