import { OFFERED, tierOf } from '../../lib/offer';
import { FITNESS_TESTS } from '../../lib/fitness-tests';
import catalogue from '../../lib/guide-catalog.json';
import { META } from './lift-meta';
import { REPORT_EMAIL } from '../../lib/reportLinks';
import './EntryMore.css';

// Under the first screen (12 November 2026, David: "get this sorted and implemented", after the page of another
// product): why film a set, what the app does today in three promises of three lines each, what works and what does
// not yet, said as plainly as the rest, and a way to write to its maker. Loaded after the entry, in its own chunk, so
// the entry's budget is untouched (check:entry-budget).
// Names as exercise-info.js gives them (the card's, else the guide's), without its drawings: lift-scenes.js needs a page.
const nameOf = (key, l) => META[key]?.[l] ?? (c => (c ? (l === 'fr' ? c.fr || c.name : c.name) : key))(catalogue.find(e => e.key === key));

// Every figure comes from the scoreboard, with its date (R13): 13 of David's 15 labelled phone sets exact,
// npm run scoreboard, 11 November 2026 (STATE.md). The list of Beta exercises is read from offer.js (tierOf), never typed.
const SCORE = { exact: 13, of: 15, fr: '11 novembre 2026', en: '11 November 2026' };

const COPY = {
  fr: {
    why: 'Pourquoi se filmer ?',
    whyText: ['En salle, personne ne compte à votre place et personne ne regarde votre geste. À la huitième répétition, vous ne savez plus si elle ressemble à la première.', 'WorkoutVision regarde la série pour vous, sur votre téléphone, et vous la rend lisible.'],
    blocks: [
      { head: 'Vos répétitions, comptées.', text: 'Vous filmez, l’appli compte.', proofs: [s => `Compte exact sur ${s.exact} de nos ${s.of} séries de référence filmées au téléphone (${s.fr}).`, () => 'Quand elle doute, elle vous le dit et vous demande de confirmer.', () => 'Vous corrigez le compte d’un geste.'] },
      { head: 'Votre série, rejouée.', text: 'Vous vous revoyez, avec ce que l’œil ne voit pas en direct.', proofs: [() => 'Votre vidéo, avec le tracé de vos articulations.', () => 'Le tempo de chaque répétition, à l’aller et au retour.', () => 'L’amplitude, répétition par répétition.'] },
      { head: 'Rien ne quitte votre téléphone.', text: 'Ni serveur, ni compte.', proofs: [() => 'L’analyse se fait sur votre appareil.', () => 'Votre vidéo ne part que si vous la partagez.', () => 'Seuls des compteurs d’usage anonymes sont envoyés, et vous pouvez les couper.'] },
    ],
    today: 'Ce qui marche aujourd’hui',
    rows: (beta, rest) => [['Compté, en bêta', beta], ['Expérimental', `${rest} autres exercices : l’appli compte, et vous dit quand elle doute.`], ['Pas encore', 'Les conseils sur votre technique. Nous ne montrons que ce que nous savons mesurer.']],
    real: 'Un vrai produit ou une démo ?', realText: 'Une version de test, gratuite, qui compte déjà vos séries.',
    write: 'Un compte faux, une question ? Écrivez à David :', start: 'Commencer',
  },
  en: {
    why: 'Why film yourself?',
    whyText: ['In the gym, nobody counts for you and nobody watches your movement. By the eighth rep you no longer know whether it looks like the first.', 'WorkoutVision watches the set for you, on your phone, and makes it readable.'],
    blocks: [
      { head: 'Your reps, counted.', text: 'You film, the app counts.', proofs: [s => `Exact count on ${s.exact} of our ${s.of} reference sets filmed on a phone (${s.en}).`, () => 'When it is not sure, it says so and asks you to confirm.', () => 'You correct the count in one tap.'] },
      { head: 'Your set, replayed.', text: 'You watch yourself, with what the eye misses live.', proofs: [() => 'Your video, with the line of your joints.', () => 'The tempo of each rep, up and down.', () => 'The range, rep by rep.'] },
      { head: 'Nothing leaves your phone.', text: 'No server, no account.', proofs: [() => 'The analysis runs on your device.', () => 'Your video leaves only if you share it.', () => 'Only anonymous usage counts are sent, and you can turn them off.'] },
    ],
    today: 'What works today',
    rows: (beta, rest) => [['Counted, in beta', beta], ['Experimental', `${rest} other exercises: the app counts, and says when it is not sure.`], ['Not yet', 'Advice on your technique. We show only what we know how to measure.']],
    real: 'A real product or a demo?', realText: 'A test version, free, that already counts your sets.',
    write: 'A wrong count, a question? Write to David:', start: 'Start',
  },
};

export default function EntryMore({ lang, onStart }) {
  const l = lang === 'en' ? 'en' : 'fr', c = COPY[l];
  const beta = OFFERED.filter(k => tierOf(k) === 'beta');
  const names = beta.map(k => nameOf(k, l)).join(', ');
  return <div className="entry-more" data-testid="entry-more">
    <section className="em-block">
      <h2 className="em-head">{c.why}</h2>
      {c.whyText.map(t => <p key={t} className="em-text">{t}</p>)}
    </section>
    {c.blocks.map(b => <section key={b.head} className="em-block">
      <h2 className="em-head">{b.head}</h2>
      <p className="em-text">{b.text}</p>
      <ul className="em-proofs">{b.proofs.map((p, i) => <li key={i}>{p(SCORE)}</li>)}</ul>
    </section>)}
    <section className="em-block">
      <h2 className="em-head">{c.today}</h2>
      <dl className="em-table" data-testid="entry-today">
        {c.rows(names, OFFERED.filter(k => !Object.hasOwn(FITNESS_TESTS, k)).length - beta.length).map(([k, v]) => <div key={k} className="em-row"><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
      <p className="em-text"><b>{c.real}</b> {c.realText}</p>
    </section>
    <section className="em-block em-end">
      <button type="button" className="em-start tactile" onClick={() => onStart()} data-testid="entry-start-again"><span>{c.start}</span></button>
      <p className="em-write">{c.write} <a href={`mailto:${REPORT_EMAIL}`}>{REPORT_EMAIL}</a></p>
    </section>
  </div>;
}
