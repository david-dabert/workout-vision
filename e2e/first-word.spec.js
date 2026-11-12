// Card 010 (cards/010-first-word-after-a-set.md): after a saved set, the goal and what bothers the person, each one
// tap and skippable, then one true word about the set with the goal named. Production build (port 4176). The word's
// truth is held by test/real-phone/accuracy/first-word.test.ts; here, that it shows, and where.
import { test, expect } from '@playwright/test';
import { start, saveSet } from './shared/filmed-set.js';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
const PROD = 'http://localhost:4176/workout-vision/';
const WORDS = /Une seule répétition sort du lot|ont perdu de l’amplitude|redescendez nettement plus vite|amplitude a tenu|rythme est resté régulier|L’appli a mesuré l’amplitude et le tempo/;

test('after the first saved set, two questions in one tap each, then the word with the goal named', async ({ page }) => {
  const errors = await start(page);
  const card = await saveSet(page, PROD);
  const ask = card.getByTestId('first-word-ask');
  await expect(ask).toBeVisible();
  await expect(ask).toContainText('Qu’est-ce que vous cherchez avant tout');
  await card.getByTestId('fw-goal-strength').click();
  await expect(ask).toContainText('qu’est-ce qui vous gêne le plus');
  await card.getByTestId('fw-bother-rhythm').click();
  const word = card.getByTestId('first-word');
  await expect(word).toBeVisible();
  await expect(word).toContainText('Votre objectif : gagner en force.');
  await expect(word).toContainText(WORDS);
  await expect(word).not.toContainText(/posture|risque|blessure|charge|fatigue/);
  await word.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/first-word-390x844.png' });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('wv_first_word')))).toEqual({ goal: 'strength', bother: 'rhythm' });
  expect(errors).toEqual([]);
});

test('the questions can be skipped, and then nothing more is asked or said', async ({ page }) => {
  await start(page);
  const card = await saveSet(page, PROD);
  await card.getByTestId('first-word-skip').click();
  await expect(card.getByTestId('first-word-ask')).toHaveCount(0);
  await expect(card.getByTestId('first-word')).toHaveCount(0);
});
