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

export default function FilmExerciseDrawer({ currentLift, onSelect, onClose }) {
  const { lang } = useT();
  const fr = lang === 'fr';
  const [query, setQuery] = useState('');
  const [archetype, setArchetype] = useState('all');
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
    let list = query.trim() ? searchExercises(query, fr ? 'fr' : 'en', 60) : allItems.slice(0, 60);
    if (archetype !== 'all') {
      list = list.filter(item => item.archetype === archetype);
    }
    return list;
  }, [query, archetype, fr, allItems]);

  return (
    <div className="film-drawer-overlay" data-testid="film-exercise-drawer">
      <div className="film-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="film-drawer-sheet" role="dialog" aria-modal="true" aria-label={fr ? 'Choisir un exercice' : 'Choose an exercise'}>
        <div className="film-drawer-header">
          <div className="film-drawer-header-text">
            <h3 className="film-drawer-title">
              {fr ? 'Catalogue d’exercices' : 'Exercise Catalog'}
            </h3>
            <span className="film-drawer-count">
              {fr ? '1\u00A0200+ variantes' : '1,200+ variations'}
            </span>
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
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
        </div>

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

        <div className="film-drawer-list-wrap">
          {results.length > 0 ? (
            <ul className="film-drawer-list" data-testid="drawer-exercise-list">
              {results.map(item => {
                const isSelected = item.id === currentLift || item.counting_key === currentLift;
                const name = fr ? item.name_fr : item.name;
                const subName = fr ? item.name : item.name_fr;
                return (
                  <li key={item.id} className="film-drawer-item">
                    <button
                      type="button"
                      className={`film-drawer-btn press${isSelected ? ' is-selected' : ''}`}
                      onClick={() => onSelect(item.id)}
                      data-testid={`exercise-item-${item.id}`}
                    >
                      <div className="film-drawer-item-info">
                        <span className="film-drawer-item-title">{name}</span>
                        <span className="film-drawer-item-meta">
                          <span className="film-drawer-item-sub">{subName}</span>
                          <span className="film-drawer-meta-divider" aria-hidden="true">•</span>
                          <span className="film-drawer-item-eq">{item.equipment}</span>
                        </span>
                      </div>
                      <span className="film-drawer-item-archetype">
                        {item.archetype}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="film-drawer-empty">
              {fr ? 'Aucun exercice trouvé.' : 'No exercises found.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
