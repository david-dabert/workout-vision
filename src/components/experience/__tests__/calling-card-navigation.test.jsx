import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider } from '../../../lib/LanguageContext';
import NavigationShell from '../NavigationShell';
import TrainHome from '../TrainHome';
import SampleDemoModal from '../SampleDemoModal';
import EvidenceRoadmap from '../EvidenceRoadmap';

const origStorage = globalThis.localStorage;

afterEach(() => {
  globalThis.localStorage = origStorage;
});

describe('Calling Card Navigation & Core Flow Integration', () => {
  it('renders NavigationShell with the 3 persistent destinations', () => {
    const htmlEn = renderToStaticMarkup(
      <NavigationShell current="train" fr={false} onNavigate={() => {}} />
    );
    expect(htmlEn).toContain('Train');
    expect(htmlEn).toContain('Progress');
    expect(htmlEn).toContain('Explore');

    const htmlFr = renderToStaticMarkup(
      <NavigationShell current="train" fr={true} onNavigate={() => {}} />
    );
    expect(htmlFr).toContain('Entraînement');
    expect(htmlFr).toContain('Progrès');
    expect(htmlFr).toContain('Explorer');
  });

  it('renders TrainHome with truthful answers to the 4 first-minute visitor questions (French)', () => {
    globalThis.localStorage = { getItem: k => (k === 'wv_lang' ? 'fr' : null), setItem: () => {} };
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <TrainHome
          onStartAnalysis={() => {}}
          onSampleDemo={() => {}}
          onSelectLift={() => {}}
          onOpenEvidence={() => {}}
          onOpenAllExercises={() => {}}
        />
      </LanguageProvider>
    );

    // Q1: What does the app do today? (Count and review on phone)
    expect(html).toContain('Comptez et analysez vos séries directement sur votre téléphone.');

    // Q2: What can I try right now? (Analyze a set or sample analysis)
    expect(html).toContain('Analyser une série');
    expect(html).toContain('Tester une analyse type (30\u00A0s)');

    // Q3: What happens to my video? (Zero servers, stays on phone)
    expect(html).toContain('100\u00A0% sur l’appareil');
    expect(html).toContain('Zéro serveur. Votre vidéo et vos mouvements restent strictement sur votre appareil.');

    // Q4: What is the evidence? (Pilot version, 7 calibrated lifts)
    expect(html).toContain('Version Pilote\u00A0: 7 mouvements calibrés sur séries réelles.');
    expect(html).toContain('Preuves et limites\u00A0&gt;');
  });

  it('renders TrainHome with truthful answers in English', () => {
    globalThis.localStorage = { getItem: k => (k === 'wv_lang' ? 'en' : null), setItem: () => {} };
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <TrainHome
          onStartAnalysis={() => {}}
          onSampleDemo={() => {}}
          onSelectLift={() => {}}
          onOpenEvidence={() => {}}
          onOpenAllExercises={() => {}}
        />
      </LanguageProvider>
    );

    expect(html).toContain('Count and review a filmed set on your phone.');
    expect(html).toContain('Analyze a set');
    expect(html).toContain('Try a sample analysis (30s)');
    expect(html).toContain('100% On-Device');
    expect(html).toContain('Pilot version: 7 movements calibrated on real sets.');
  });

  it('renders SampleDemoModal with David’s verified 7-rep squat meeting demo', () => {
    globalThis.localStorage = { getItem: k => (k === 'wv_lang' ? 'en' : null), setItem: () => {} };
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <SampleDemoModal
          isOpen={true}
          onClose={() => {}}
          onSelectExercise={() => {}}
        />
      </LanguageProvider>
    );

    expect(html).toContain('Gym Squat (7 Repetitions)');
    expect(html).toContain('7');
    expect(html).toContain('Knee ROM');
    expect(html).toContain('Avg. Tempo');
  });

  it('renders EvidenceRoadmap with exact certified metrics and transparency', () => {
    globalThis.localStorage = { getItem: k => (k === 'wv_lang' ? 'en' : null), setItem: () => {} };
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <EvidenceRoadmap onBack={() => {}} />
      </LanguageProvider>
    );

    expect(html).toContain('Evidence &amp; Roadmap');
    expect(html).toContain('13 / 15');
    expect(html).toContain('13 / 16');
    expect(html).toContain('Overhead Press');
  });
});
