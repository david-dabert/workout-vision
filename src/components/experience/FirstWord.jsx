import { useState } from 'react';
import { firstWord } from './first-word';
import './Level.css';

// Card 010: after a saved set, two short questions (the goal, what bothers the person most in this exercise), each
// one tap and skippable, then one true word about the set with the goal named. The third question, the experience, is
// the level question already asked once after a saved set (level.js, LevelPick), not asked twice. The answers stay on
// this phone (localStorage), are sent nowhere and change nothing the app measures. The word itself comes from
// first-word.js: range and tempo per rep only (R8, gate 7), checked on David's labelled sets
// (test/real-phone/accuracy/first-word.test.ts). Copy written by the agent under R10 (amended 20 October 2026).
export const FIRST_WORD_KEY = 'wv_first_word';

const GOALS = [
  ['strength', 'Gagner en force', 'Get stronger'],
  ['muscle', 'Prendre du muscle', 'Build muscle'],
  ['recovery', 'Reprendre après une blessure', 'Come back from an injury'],
  ['technique', 'Soigner ma technique', 'Refine my technique'],
];
const BOTHERS = [
  ['range', 'Aller jusqu’au bout du mouvement', 'Going the full range'],
  ['rhythm', 'Garder le bon rythme', 'Keeping the right rhythm'],
  ['even', 'Faire toutes les répétitions pareil', 'Doing every rep the same'],
  ['unsure', 'Je ne sais pas encore', 'I do not know yet'],
];

const read = () => { try { return JSON.parse(localStorage.getItem(FIRST_WORD_KEY) || 'null'); } catch { return null; } };
const write = v => { try { localStorage.setItem(FIRST_WORD_KEY, JSON.stringify(v)); return true; } catch { return false; } };

function Choices({ id, label, options, fr, onPick }) {
  return <div className="level-pick">
    <span className="sr" id={id}>{label}</span>
    <div className="level-seg fw-seg" role="group" aria-labelledby={id}>
      {options.map(([k, f, e]) => <button key={k} type="button" className="press" onClick={() => onPick(k)} data-testid={`${id}-${k}`}>{fr ? f : e}</button>)}
    </div>
  </div>;
}

/** The two questions, then the word. `reps`: the saved set's reps as the result screen holds them. */
export default function FirstWord({ reps, fr }) {
  const [answers, setAnswers] = useState(read);
  const [goal, setGoal] = useState(null);
  const save = v => { write(v); setAnswers(v); };

  if (!answers) {
    const goalQ = fr ? 'Qu’est-ce que vous cherchez avant tout\u00A0?' : 'What are you after most?';
    const botherQ = fr ? 'Sur cet exercice, qu’est-ce qui vous gêne le plus\u00A0?' : 'On this exercise, what bothers you most?';
    return <div className="level-ask fw-ask appear" data-testid="first-word-ask">
      {goal === null
        ? <><p className="level-q" aria-hidden="true">{goalQ}</p><Choices id="fw-goal" label={goalQ} options={GOALS} fr={fr} onPick={setGoal} /></>
        : <><p className="level-q" aria-hidden="true">{botherQ}</p><Choices id="fw-bother" label={botherQ} options={BOTHERS} fr={fr} onPick={b => save({ goal, bother: b })} /></>}
      <button type="button" className="text-btn press fw-skip" onClick={() => save({ skipped: true })} data-testid="first-word-skip">{fr ? 'Passer' : 'Skip'}</button>
    </div>;
  }
  if (answers.skipped) return null;
  const w = firstWord(reps);
  const g = GOALS.find(x => x[0] === answers.goal);
  return <div className="level-ask fw-word appear" data-testid="first-word" data-word={w.key}>
    <p className="level-q fw-goal">{g ? (fr ? `Votre objectif : ${g[1].toLowerCase()}.` : `Your goal: ${g[2].toLowerCase()}.`) : null}</p>
    <p className="fw-line">{fr ? w.fr : w.en}</p>
    <p className="level-note">{fr ? 'Lu sur l’amplitude et le tempo de vos répétitions, rien d’autre.' : 'Read from the range and tempo of your reps, nothing else.'}</p>
  </div>;
}
