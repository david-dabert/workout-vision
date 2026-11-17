import { beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('../lift-scenes', () => ({ hasFigure: () => false, liftView: () => null, topPose: () => null }));
vi.mock('../entry-scene', () => ({ Body: class {}, mapPose: () => null, DPR: 1, LITE: false }));
vi.mock('../stage-loop', () => ({ addLayer: () => () => {}, presence: () => 0, holdStage: () => {} }));

import { pickSavedQuestion, resetSessionPromptsForTest } from '../Result';

beforeEach(() => resetSessionPromptsForTest());

describe('Card 053: pickSavedQuestion', () => {
  it('picks at most one question in order: install -> first-word -> contribute -> level', () => {
    expect(pickSavedQuestion({ refused: false, count: 8, skipPrompts: false, canInstall: true, firstWordAsked: false, canContribute: true, canLevel: true })).toBe('install');
    expect(pickSavedQuestion({ refused: false, count: 8, skipPrompts: false, canInstall: false, firstWordAsked: false, canContribute: true, canLevel: true })).toBe('first-word');
    expect(pickSavedQuestion({ refused: false, count: 8, skipPrompts: false, canInstall: false, firstWordAsked: true, canContribute: true, canLevel: true })).toBe('contribute');
    expect(pickSavedQuestion({ refused: false, count: 8, skipPrompts: false, canInstall: false, firstWordAsked: true, canContribute: false, canLevel: true })).toBe('level');
    expect(pickSavedQuestion({ refused: false, count: 8, skipPrompts: false, canInstall: false, firstWordAsked: true, canContribute: false, canLevel: false })).toBe('none');
  });

  it('skips first-word on unsure sets (count === 0) and falls through to contribute/level so saved sets still get one prompt', () => {
    expect(pickSavedQuestion({ refused: false, count: 0, skipPrompts: false, canInstall: false, firstWordAsked: false, canContribute: true, canLevel: true })).toBe('contribute');
    expect(pickSavedQuestion({ refused: false, count: 0, skipPrompts: false, canInstall: false, firstWordAsked: false, canContribute: false, canLevel: true })).toBe('level');
  });

  it('returns none when skipPrompts (keepAndClose) or refused', () => {
    expect(pickSavedQuestion({ refused: false, count: 8, skipPrompts: true, canInstall: true, firstWordAsked: false, canContribute: true, canLevel: true })).toBe('none');
    expect(pickSavedQuestion({ refused: true, count: 0, skipPrompts: false, canInstall: true, firstWordAsked: false, canContribute: true, canLevel: true })).toBe('none');
  });
});
