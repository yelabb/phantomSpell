/**
 * Unit Tests for Baseline P300 Decoders
 * Tests the P300 baseline classifiers and their output structure.
 *
 * The baselines are code-string decoders executed via `new Function()`.
 * They produce P300Output (predictedRow, predictedCol, confidence) —
 * not motor-kinematics (x, y, vx, vy).
 */

import { describe, it, expect } from 'vitest';
import {
  randomClassifier,
  templateMatchingClassifier,
  majorityVoteClassifier,
  baselineDecoders,
} from '../decoders/baselines';
import type { DecoderInput } from '../types/decoders';

// Helper to create a decoder function from code string
function createDecoderFn(code: string): (input: DecoderInput) => Record<string, unknown> {
  return new Function('input', code) as (input: DecoderInput) => Record<string, unknown>;
}

// Mock decoder input for P300 baselines
function createMockInput(overrides?: Partial<DecoderInput>): DecoderInput {
  return {
    kinematics: { x: 0, y: 0, vx: 0, vy: 0 },
    spikes: new Array(20).fill(0),
    ...overrides,
  };
}

describe('Baseline P300 Decoders', () => {
  describe('Decoder Registry', () => {
    it('should have all baseline decoders registered', () => {
      expect(baselineDecoders).toHaveLength(4);
    });

    it('should have unique decoder IDs', () => {
      const ids = baselineDecoders.map(d => d.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have all required decoder properties', () => {
      for (const decoder of baselineDecoders) {
        expect(decoder.id).toBeDefined();
        expect(decoder.name).toBeDefined();
        expect(decoder.type).toBe('javascript');
        expect(decoder.description).toBeDefined();
      }
    });
  });

  describe('Random Classifier', () => {
    it('should have correct metadata', () => {
      expect(randomClassifier.id).toBe('p300-random');
      expect(randomClassifier.name).toContain('Random');
      expect(randomClassifier.type).toBe('javascript');
    });

    it('should return predictedRow and predictedCol in valid range', () => {
      const fn = createDecoderFn(randomClassifier.code!);
      const input = createMockInput();
      const result = fn(input);

      expect(result.predictedRow).toBeDefined();
      expect(result.predictedCol).toBeDefined();
      expect(result.predictedRow).toBeGreaterThanOrEqual(0);
      expect(result.predictedRow).toBeLessThan(6);
      expect(result.predictedCol).toBeGreaterThanOrEqual(0);
      expect(result.predictedCol).toBeLessThan(6);
    });

    it('should return a confidence value', () => {
      const fn = createDecoderFn(randomClassifier.code!);
      const input = createMockInput();
      const result = fn(input);

      expect(typeof result.confidence).toBe('number');
      expect(result.confidence as number).toBeGreaterThanOrEqual(0);
      expect(result.confidence as number).toBeLessThanOrEqual(1);
    });

    it('should produce integer row and column indices', () => {
      const fn = createDecoderFn(randomClassifier.code!);
      const input = createMockInput();

      // Run several times to check randomness produces integers
      for (let i = 0; i < 10; i++) {
        const result = fn(input);
        expect(Number.isInteger(result.predictedRow)).toBe(true);
        expect(Number.isInteger(result.predictedCol)).toBe(true);
      }
    });
  });

  describe('Template Matching Classifier', () => {
    it('should have correct metadata', () => {
      expect(templateMatchingClassifier.id).toBe('p300-template');
      expect(templateMatchingClassifier.name).toContain('Template');
      expect(templateMatchingClassifier.type).toBe('javascript');
    });

    it('should return default output when no flash events provided', () => {
      const fn = createDecoderFn(templateMatchingClassifier.code!);
      const input = createMockInput();
      const result = fn(input);

      expect(result.predictedRow).toBe(0);
      expect(result.predictedCol).toBe(0);
      expect(result.confidence).toBe(0);
    });
  });

  describe('Majority Vote Classifier', () => {
    it('should have correct metadata', () => {
      expect(majorityVoteClassifier.id).toBe('p300-majority');
      expect(majorityVoteClassifier.name).toContain('Majority');
      expect(majorityVoteClassifier.type).toBe('javascript');
    });

    it('should return default output when no flash events provided', () => {
      const fn = createDecoderFn(majorityVoteClassifier.code!);
      const input = createMockInput();
      const result = fn(input);

      expect(result.predictedRow).toBe(0);
      expect(result.predictedCol).toBe(0);
      expect(result.confidence).toBeDefined();
    });

    it('should identify target row and column from labeled flash events', () => {
      const fn = createDecoderFn(majorityVoteClassifier.code!);
      const flashEvents = [
        { type: 'row' as const, index: 2, timestamp: 100, containsTarget: true },
        { type: 'row' as const, index: 2, timestamp: 300, containsTarget: true },
        { type: 'row' as const, index: 0, timestamp: 500, containsTarget: false },
        { type: 'col' as const, index: 4, timestamp: 200, containsTarget: true },
        { type: 'col' as const, index: 4, timestamp: 400, containsTarget: true },
        { type: 'col' as const, index: 1, timestamp: 600, containsTarget: false },
      ];

      const input = createMockInput({ flashEvents });
      const result = fn(input);

      expect(result.predictedRow).toBe(2);
      expect(result.predictedCol).toBe(4);
    });
  });
});

describe('Decoder Type Validation', () => {
  it('all decoders should be type javascript', () => {
    for (const decoder of baselineDecoders) {
      expect(decoder.type).toBe('javascript');
    }
  });

  it('all decoders with code should produce valid JavaScript', () => {
    for (const decoder of baselineDecoders) {
      if (decoder.code) {
        expect(() => {
          new Function('input', decoder.code!);
        }).not.toThrow();
      }
    }
  });

  it('all decoders with code should return an object', () => {
    const input = createMockInput();

    for (const decoder of baselineDecoders) {
      if (decoder.code) {
        const fn = createDecoderFn(decoder.code);
        const result = fn(input);
        expect(typeof result).toBe('object');
        expect(result).not.toBeNull();
      }
    }
  });
})
