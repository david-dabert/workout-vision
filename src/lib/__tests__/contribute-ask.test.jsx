// When the saved card asks to help improve the count (contribute.js shouldAskContribute, ContributeAsk.jsx; build
// brief "contribute-ask", 3 October 2026): after the first saved set; "Pas maintenant" asks once more at most, from
// the fifth set; never after a yes or a no; never when the choice was already made in the history.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { contributeAsks, markContributeAsked, shouldAskContribute, REASK_AT, MAX_ASKS } from '../contribute';
import ContributeAsk from '../../components/experience/ContributeAsk';
import { CONTRIBUTE } from '../../components/experience/contribute-copy';

const mem = (init = {}) => { const s = { ...init }; return { s, getItem: k => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); } }; };
// The sets saved one after another, the card left unanswered each time it shows ("Pas maintenant"): on which sets it asks.
function asksOver(n, { choice = null, store = mem() } = {}) {
  const on = [];
  for (let saved = 1; saved <= n; saved++) {
    if (shouldAskContribute({ choice, ...contributeAsks(store), saved })) { on.push(saved); markContributeAsked(saved, store); }
  }
  return on;
}

describe('when the saved card asks to help', () => {
  it('asks after the first saved set, then once more at the fifth, then never', () => {
    expect(REASK_AT).toBe(5);
    expect(asksOver(30)).toEqual([1, 5]);
  });
  it('never asks once the person said yes or no, here or in the history', () => {
    expect(asksOver(30, { choice: 'yes' })).toEqual([]);
    expect(asksOver(30, { choice: 'no' })).toEqual([]);
    // Yes at the first ask: no second ask, whatever the count.
    const store = mem();
    expect(shouldAskContribute({ choice: null, ...contributeAsks(store), saved: 1 })).toBe(true);
    markContributeAsked(1, store);
    for (const saved of [5, 6, 50]) expect(shouldAskContribute({ choice: 'yes', ...contributeAsks(store), saved })).toBe(false);
  });
  it('asks at most twice, and the second ask comes four sets after the first at the soonest', () => {
    // A phone first asked at its eighth set (sets saved before this version): the second ask comes at the twelfth.
    const store = mem();
    expect(shouldAskContribute({ choice: null, ...contributeAsks(store), saved: 8 })).toBe(true);
    markContributeAsked(8, store);
    expect([9, 10, 11].some(saved => shouldAskContribute({ choice: null, ...contributeAsks(store), saved }))).toBe(false);
    expect(shouldAskContribute({ choice: null, ...contributeAsks(store), saved: 12 })).toBe(true);
    markContributeAsked(12, store);
    expect(contributeAsks(store)).toEqual({ asks: MAX_ASKS, at: 8 });
    expect(shouldAskContribute({ choice: null, ...contributeAsks(store), saved: 40 })).toBe(false);
  });
  it('reads the old card\'s "true" as shown once, at the first set', () => {
    const store = mem({ wv_contribute_asked: 'true' });
    expect(contributeAsks(store)).toEqual({ asks: 1, at: 1 });
    expect(shouldAskContribute({ choice: null, ...contributeAsks(store), saved: 4 })).toBe(false);
    expect(shouldAskContribute({ choice: null, ...contributeAsks(store), saved: 5 })).toBe(true);
  });
  it('does not ask when the number of sets is not known, or the phone cannot read what was asked', () => {
    expect(shouldAskContribute({ choice: null, asks: 0, at: 0, saved: null })).toBe(false);
    expect(shouldAskContribute({ choice: null, asks: 0, at: 0, saved: 0 })).toBe(false);
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(shouldAskContribute({ choice: null, ...contributeAsks(broken), saved: 1 })).toBe(false);
    expect(markContributeAsked(1, broken)).toBe(false);
  });
});

describe('the card', () => {
  for (const [lang, fr] of [['fr', true], ['en', false]]) {
    it(`says what is kept in one sentence, keeps the full list behind a toggle, and offers yes or not now (${lang})`, () => {
      const t = CONTRIBUTE[lang];
      const html = renderToStaticMarkup(<ContributeAsk fr={fr} />);
      expect(html).toContain(t.ask.replace(' ', '&nbsp;').replace('?', '?') ? '' : '');
      for (const s of [t.lead, t.more, t.yes, t.later]) expect(html).toContain(s.replace(/’/g, '’'));
      // The full list is in the card, hidden until "what exactly?" is tapped.
      expect(html).toMatch(/aria-expanded="false"/);
      expect(html).toMatch(/<p class="level-note" id="[^"]+" hidden="" data-testid="contribute-what">/);
      // No "No thanks" on the card: the only no is in the history (stop and erase).
      expect(html).not.toContain(`>${t.no}<`);
    });
  }
  it('names, in one sentence, the video left out and the person who sends', () => {
    expect(CONTRIBUTE.fr.lead).toMatch(/jamais la vidéo/);
    expect(CONTRIBUTE.fr.lead).toMatch(/c’est vous qui les envoyez/);
    expect(CONTRIBUTE.en.lead).toMatch(/never the video/);
    for (const l of ['fr', 'en']) expect(CONTRIBUTE[l].lead.split(/[.!?](\s|$)/).filter(x => x && x.trim()).length).toBe(1);
  });
});
