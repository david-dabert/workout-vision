import { LEVELS } from './level';
import './Level.css';

const LEVEL_NAMES = { beginner: ['Débutant', 'Beginner'], intermediate: ['Intermédiaire', 'Intermediate'], expert: ['Confirmé', 'Expert'] };

/** The three levels as one row of buttons, the chosen one lit (the report's segmented control). */
export default function LevelPick({ id, label, value, onChange, fr, quiet = false }) {
  return <div className="level-pick">
    <span className={quiet ? 'sr' : 'eyebrow level-label'} id={id}>{label}</span>
    <div className="level-seg" role="group" aria-labelledby={id}>
      {LEVELS.map(l => <button key={l} type="button" className="press" aria-pressed={value === l} onClick={() => onChange(l)}>{LEVEL_NAMES[l][fr ? 0 : 1]}</button>)}
    </div>
  </div>;
}
