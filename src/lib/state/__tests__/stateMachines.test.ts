import { describe, expect, it, vi } from 'vitest';
import {
  createAnalysisStateMachine,
  createDeviceStabilityStateMachine,
  createKineAttemptStateMachine,
  FiniteStateMachine,
} from '../stateMachines';

describe('Universal Canonical State Machine Engine', () => {
  describe('Generic FiniteStateMachine Core', () => {
    it('initializes with initial state and context', () => {
      const fsm = new FiniteStateMachine({
        id: 'test',
        initial: 'A',
        context: { count: 0 },
        states: {
          A: { on: { GO: 'B' } },
          B: { on: { BACK: 'A' } },
        },
      });

      expect(fsm.state).toBe('A');
      expect(fsm.matches('A')).toBe(true);
      expect(fsm.matches('B')).toBe(false);
      expect(fsm.can('GO')).toBe(true);
      expect(fsm.can('BACK' as any)).toBe(false);
      expect(fsm.context.count).toBe(0);
    });

    it('transitions state on allowed event and notifies subscribers', () => {
      const fsm = new FiniteStateMachine({
        id: 'test',
        initial: 'A',
        context: { count: 0 },
        states: {
          A: { on: { GO: 'B' } },
          B: { on: { BACK: 'A' } },
        },
      });

      const spy = vi.fn();
      const unsubscribe = fsm.subscribe(spy);

      const res = fsm.send('GO');
      expect(res.changed).toBe(true);
      expect(res.state).toBe('B');
      expect(fsm.state).toBe('B');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('B', { count: 0 });

      unsubscribe();
      fsm.send('BACK');
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('safely rejects illegal transitions without crashing or mutating state', () => {
      const fsm = new FiniteStateMachine({
        id: 'test',
        initial: 'A',
        context: { count: 0 },
        states: {
          A: { on: { GO: 'B' } },
          B: {},
        },
      });

      const res = fsm.send('NON_EXISTENT_EVENT' as any);
      expect(res.changed).toBe(false);
      expect(res.state).toBe('A');
      expect(fsm.state).toBe('A');
    });
  });

  describe('Video Analysis Pipeline Machine (UX/DX/AX Elevation)', () => {
    it('walks cleanly through the happy path: IDLE -> HASHING -> MODEL -> EXTRACTING -> COMPLETED', () => {
      const fsm = createAnalysisStateMachine('squat');
      expect(fsm.state).toBe('IDLE');
      expect(fsm.context.exercise).toBe('squat');

      const mockFile = new File(['mock'], 'squat.mp4', { type: 'video/mp4' });
      fsm.send('SELECT_FILE', mockFile);
      expect(fsm.state).toBe('HASHING_FILE');
      expect(fsm.context.file).toBe(mockFile);

      fsm.send('MODEL_LOAD_PROGRESS', 45);
      expect(fsm.state).toBe('LOADING_MODEL');
      expect(fsm.context.progressPercent).toBe(45);

      fsm.send('MODEL_READY');
      expect(fsm.state).toBe('EXTRACTING_FRAMES');

      fsm.send('FRAMES_PROGRESS', { pct: 50, reps: 3 });
      expect(fsm.context.repsCount).toBe(3);

      fsm.send('KINEMATICS_COMPLETE', { reps: 8, score: 95 });
      expect(fsm.state).toBe('COMPLETED');
      expect(fsm.context.progressPercent).toBe(100);
      expect(fsm.context.repsCount).toBe(8);

      fsm.send('RESET');
      expect(fsm.state).toBe('IDLE');
      expect(fsm.context.file).toBeNull();
    });

    it('handles cancellation and errors gracefully at any pipeline stage', () => {
      const fsm = createAnalysisStateMachine();
      fsm.send('SELECT_FILE', new File([''], 'test.mp4'));
      fsm.send('MODEL_LOAD_PROGRESS', 10);
      expect(fsm.state).toBe('LOADING_MODEL');

      fsm.send('CANCEL');
      expect(fsm.state).toBe('ABORTED');

      fsm.send('RESET');
      expect(fsm.state).toBe('IDLE');

      fsm.send('SELECT_FILE', new File([''], 'test.mp4'));
      fsm.send('FAIL', 'WebCodecs decoder stalled');
      expect(fsm.state).toBe('ERROR');
      expect(fsm.context.errorReason).toBe('WebCodecs decoder stalled');
    });
  });

  describe('Kiné Attempt & Mirror Avatar Lifecycle Machine (Client Zéro Priority)', () => {
    it('models the healthy-side mirror comparison and clinical report generation', () => {
      const fsm = createKineAttemptStateMachine('test-dyskinesie-scapulaire', 'patient-lamine-001');
      expect(fsm.state).toBe('AWAITING_INPUT');

      fsm.send('LOAD_REF_START');
      expect(fsm.state).toBe('LOADING_REFERENCE');

      fsm.send('LOAD_REF_SUCCESS', { id: 'ref-pose', angles: [90, 120, 160] });
      expect(fsm.state).toBe('AWAITING_INPUT');
      expect(fsm.context.referencePose).not.toBeNull();

      fsm.send('START_PATIENT_READ');
      expect(fsm.state).toBe('READING_PATIENT_ATTEMPT');

      fsm.send('PATIENT_READ_SUCCESS', { id: 'patient-pose', angles: [85, 115, 150] });
      expect(fsm.state).toBe('COMPARING_BIOMECHANICS');

      fsm.send('EVALUATE_SYMMETRY', { lsi: 102.1, verdict: 'match' });
      expect(fsm.state).toBe('CLINICAL_VERDICT_READY');
      expect(fsm.context.lsiPercent).toBe(102.1);
      expect(fsm.context.clinicalVerdict).toBe('match');
    });

    it('handles the deeper heavy pose model fallback seamlessly on low visibility', () => {
      const fsm = createKineAttemptStateMachine('elevation-paliers', 'christophe');
      fsm.send('START_PATIENT_READ');
      fsm.send('PATIENT_READ_SUCCESS', { confidence: 0.45 });
      expect(fsm.state).toBe('COMPARING_BIOMECHANICS');

      fsm.send('TRIGGER_DEEP_READ');
      expect(fsm.state).toBe('DEEP_HEAVY_FALLBACK');

      fsm.send('RETRY_HEAVY_SUCCESS', { confidence: 0.88, model: 'heavy' });
      expect(fsm.state).toBe('COMPARING_BIOMECHANICS');
      expect(fsm.context.patientPose.model).toBe('heavy');
    });
  });

  describe('Device Hardware Stability Machine', () => {
    it('manages transitions between handheld motion, static surface, and armed trigger', () => {
      const fsm = createDeviceStabilityStateMachine();
      expect(fsm.state).toBe('HANDHELD_MOTION');

      fsm.send('SURFACE_SETTLED', { variance: 0.015, pitch: 12.0 });
      expect(fsm.state).toBe('STABILIZING_ON_SURFACE');
      expect(fsm.context.pitchDeg).toBe(12.0);

      fsm.send('TIMER_STABLE_1500MS');
      expect(fsm.state).toBe('MOUNTED_STATIC');

      fsm.send('ARM_TRIGGER');
      expect(fsm.state).toBe('COUNTDOWN_ARMED');

      fsm.send('USER_TOUCH');
      expect(fsm.state).toBe('SESSION_ACTIVE');

      fsm.send('USER_TOUCH');
      expect(fsm.state).toBe('HANDHELD_MOTION');
    });
  });
});
