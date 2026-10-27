import { useState, useMemo, useEffect, useRef } from 'react';
import { useT } from '../../lib/LanguageContext';
import { searchExercises, getAllExercises } from '../../lib/exercises/index';
import './FilmExerciseDrawer.css';

const ARCHETYPE_FILTERS = [
  { id: 'all', labelEn: 'All', labelFr: 'Tous' },
  { id: 'squat', labelEn: 'Squat', labelFr: 'Squat' },
  { id: 'hinge', labelEn: 'Hinge', labelFr: 'Hanches' },
  { id: 'push', labelEn: 'Push', labelFr: 'Poussée' },
  { id: 'pull', labelEn: 'Pull', labelFr: 'Tirage' },
  { id: 'isolation', labelEn: 'Isolation', labelFr: 'Isolation' },
];

const EQUIPMENT_FILTERS = [
  { id: 'all', labelEn: 'All Gear', labelFr: 'Tout équipement' },
  { id: 'barbell', labelEn: 'Barbell', labelFr: 'Barre' },
  { id: 'dumbbell', labelEn: 'Dumbbell', labelFr: 'Haltères' },
  { id: 'machine', labelEn: 'Machine', labelFr: 'Machine' },
  { id: 'cable', labelEn: 'Cable', labelFr: 'Câble' },
  { id: 'bodyweight', labelEn: 'Bodyweight', labelFr: 'Poids de corps' },
];

const MUSCLE_LABELS = {
  quadriceps: { fr: 'Quadriceps', en: 'Quads' },
  glutes: { fr: 'Fessiers', en: 'Glutes' },
  hamstrings: { fr: 'Ischios', en: 'Hamstrings' },
  pectoralis_major: { fr: 'Pectoraux', en: 'Chest' },
  anterior_deltoid: { fr: 'Épaules', en: 'Shoulders' },
  lateral_deltoid: { fr: 'Épaules', en: 'Shoulders' },
  rear_deltoid: { fr: 'Épaules post.', en: 'Rear Delts' },
  latissimus_dorsi: { fr: 'Dorsaux', en: 'Lats' },
  biceps_brachii: { fr: 'Biceps', en: 'Biceps' },
  triceps_brachii: { fr: 'Triceps', en: 'Triceps' },
  rectus_abdominis: { fr: 'Abdominaux', en: 'Abs' },
  erector_spinae: { fr: 'Lombaires', en: 'Lower Back' },
  calves: { fr: 'Mollets', en: 'Calves' },
};

function ArchetypeGlyph({ archetype }) {
  switch (archetype) {
    case 'squat':
      return (
        <svg className="film-glyph-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="5" r="2" />
          <path d="M12 7v5l-3 4-1 5" />
          <path d="M12 12l3 4 1 5" />
          <path d="M7 11h10" />
        </svg>
      );
    case 'hinge':
      return (
        <svg className="film-glyph-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="8" cy="7" r="2" />
          <path d="M8 9l5 4 4-2" />
          <path d="M13 13l-1 8" />
          <path d="M17 11l2 10" />
        </svg>
      );
    case 'push':
      return (
        <svg className="film-glyph-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="6" cy="12" r="2" />
          <path d="M8 12h12" />
          <path d="M16 8l4 4-4 4" />
        </svg>
      );
    case 'pull':
      return (
        <svg className="film-glyph-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="12" r="2" />
          <path d="M16 12H4" />
          <path d="M8 8l-4 4 4 4" />
        </svg>
      );
    default:
      return (
        <svg className="film-glyph-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v3m0 12v3M3 12h3m12 0h3" />
        </svg>
      );
  }
}

function HighlightMatch({ text, query }) {
  if (!query || !query.trim()) return <span>{text}</span>;
  const q = query.trim().toLowerCase();
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return <span>{text}</span>;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);
  return (
    <span>
      {before}
      <mark className="film-drawer-highlight">{match}</mark>
      {after}
    </span>
  );
}

export default function FilmExerciseDrawer({ currentLift, onSelect, onClose }) {
  const { lang } = useT();
  const fr = lang === 'fr';
  const [query, setQuery] = useState('');
  const [archetype, setArchetype] = useState('all');
  const [equipment, setEquipment] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const allItems = useMemo(() => {
    return getAllExercises();
  }, []);

  const results = useMemo(() => {
    let list = query.trim() ? searchExercises(query, fr ? 'fr' : 'en', 120) : allItems.slice(0, 120);
    if (archetype !== 'all') {
      list = list.filter(item => item.archetype === archetype);
    }
    if (equipment !== 'all') {
      list = list.filter(item => item.equipment.toLowerCase().includes(equipment.toLowerCase()));
    }
    return list;
  }, [query, archetype, equipment, fr, allItems]);

  const toggleExpand = (e, id) => {
    e.stopPropagation();
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div className="film-drawer-overlay" data-testid="film-exercise-drawer">
      <div className="film-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="film-drawer-sheet" role="dialog" aria-modal="true" aria-label={fr ? 'Choisir un exercice' : 'Choose an exercise'}>
        <div className="film-drawer-handle" aria-hidden="true" />
        
        <div className="film-drawer-header">
          <div className="film-drawer-header-text">
            <span className="film-drawer-kicker">
              {fr ? 'Atlas universel du mouvement' : 'Universal movement atlas'}
            </span>
            <div className="film-drawer-title-row">
              <h3 className="film-drawer-title">
                {fr ? 'Catalogue d’exercices' : 'Exercise Catalog'}
              </h3>
              <span className="film-drawer-count">
                {fr ? '1\u00A0200+ variantes' : '1,200+ variations'}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="film-drawer-close press"
            onClick={onClose}
            aria-label={fr ? 'Fermer' : 'Close'}
            data-testid="drawer-close-btn"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="film-drawer-search">
          <svg className="film-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={fr ? 'Rechercher un mouvement, machine, muscle…' : 'Search movement, machine, muscle…'}
            data-testid="drawer-search-input"
          />
          {query && (
            <button
              type="button"
              className="film-search-clear"
              onClick={() => setQuery('')}
              aria-label={fr ? 'Effacer la recherche' : 'Clear search'}
            >
              ×
            </button>
          )}
          <span className="film-search-badge" role="status">
            {results.length} {fr ? 'variantes' : 'variations'}
          </span>
        </div>

        <div className="film-drawer-filters-container">
          <div className="film-drawer-filters" role="tablist" aria-label={fr ? 'Filtrer par mouvement' : 'Filter by pattern'}>
            {ARCHETYPE_FILTERS.map(f => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={archetype === f.id}
                className={`film-filter-chip${archetype === f.id ? ' is-active' : ''}`}
                onClick={() => setArchetype(f.id)}
                data-testid={`filter-chip-${f.id}`}
              >
                {fr ? f.labelFr : f.labelEn}
              </button>
            ))}
          </div>

          <div className="film-drawer-subfilters" role="toolbar" aria-label={fr ? 'Filtrer par équipement' : 'Filter by equipment'}>
            {EQUIPMENT_FILTERS.map(eq => (
              <button
                key={eq.id}
                type="button"
                className={`film-subfilter-pill${equipment === eq.id ? ' is-active' : ''}`}
                onClick={() => setEquipment(eq.id)}
              >
                {fr ? eq.labelFr : eq.labelEn}
              </button>
            ))}
          </div>
        </div>

        <div className="film-drawer-list-wrap">
          {results.length > 0 ? (
            <ul className="film-drawer-list" data-testid="drawer-exercise-list">
              {results.map(item => {
                const isSelected = item.id === currentLift || item.counting_key === currentLift;
                const isExpanded = expandedId === item.id;
                const name = fr ? item.name_fr : item.name;
                const subName = fr ? item.name : item.name_fr;
                const primaryMuscle = item.primary_muscles?.[0] ? (MUSCLE_LABELS[item.primary_muscles[0]]?.[fr ? 'fr' : 'en'] || item.primary_muscles[0]) : null;
                const cues = fr ? item.execution_cues_fr : item.execution_cues_en;
                const setup = fr ? item.setup_fr : item.setup_en;

                return (
                  <li key={item.id} className="film-drawer-item">
                    <div className={`film-drawer-card${isSelected ? ' is-selected' : ''}`}>
                      <button
                        type="button"
                        className="film-drawer-btn press"
                        onClick={() => onSelect(item.id)}
                        data-testid={`exercise-item-${item.id}`}
                      >
                        <div className="film-drawer-item-leading" aria-hidden="true">
                          <div className={`film-glyph-box film-glyph-${item.archetype}`}>
                            <ArchetypeGlyph archetype={item.archetype} />
                          </div>
                        </div>

                        <div className="film-drawer-item-info">
                          <span className="film-drawer-item-title">
                            <HighlightMatch text={name} query={query} />
                          </span>
                          <span className="film-drawer-item-meta">
                            <span className="film-drawer-item-sub">{subName}</span>
                            <span className="film-drawer-meta-divider" aria-hidden="true">•</span>
                            <span className="film-drawer-item-eq">{item.equipment}</span>
                            {primaryMuscle && (
                              <>
                                <span className="film-drawer-meta-divider" aria-hidden="true">•</span>
                                <span className="film-drawer-muscle-pill">{primaryMuscle}</span>
                              </>
                            )}
                          </span>
                        </div>

                        <div className="film-drawer-item-actions">
                          <span className="film-drawer-item-archetype">
                            {item.archetype}
                          </span>
                          {cues?.length > 0 && (
                            <button
                              type="button"
                              className={`film-drawer-info-trigger${isExpanded ? ' is-open' : ''}`}
                              onClick={(e) => toggleExpand(e, item.id)}
                              aria-expanded={isExpanded}
                              aria-label={fr ? 'Conseils biomécaniques' : 'Biomechanical cues'}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="16" x2="12" y2="12" />
                                <line x1="12" y1="8" x2="12.01" y2="8" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="film-drawer-details">
                          {setup && (
                            <div className="film-detail-row">
                              <span className="film-detail-label">{fr ? 'Installation\u00A0:' : 'Setup:'}</span>
                              <p className="film-detail-text">{setup}</p>
                            </div>
                          )}
                          {cues?.length > 0 && (
                            <div className="film-detail-row">
                              <span className="film-detail-label">{fr ? 'Repères d’exécution\u00A0:' : 'Key cues:'}</span>
                              <ul className="film-detail-cues">
                                {cues.slice(0, 3).map((cue, idx) => (
                                  <li key={idx}>{cue}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="film-detail-action">
                            <button
                              type="button"
                              className="film-detail-select-btn press"
                              onClick={() => onSelect(item.id)}
                            >
                              {fr ? 'Sélectionner ce mouvement' : 'Select this movement'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="film-drawer-empty-state">
              <svg className="film-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <p className="film-drawer-empty">
                {fr ? 'Aucun exercice trouvé.' : 'No exercises found.'}
              </p>
              <span className="film-empty-sub">
                {fr ? 'Essayez avec un autre nom, muscle ou matériel' : 'Try searching with another name, muscle or gear'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

