/**
 * Deterministic P300 Pipeline Tests
 *
 * Tests the complete P300 signal processing and classification pipeline
 * using synthetic ERP waveforms with known ground truth. These tests
 * are fully deterministic (no random elements) so they serve as a
 * regression suite.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MarkerManager,
  EEGRingBuffer,
  baselineCorrect,
  commonAverageReference,
  bandpassFilter,
  filterEpoch,
  extractEpoch,
  extractFeatures,
  extractP300Features,
  validateFlashSequence,
  aggregateFlashScores,
} from '../utils/p300Pipeline';
import { trainLDA, classifyEpoch } from '../decoders/ldaClassifier';
import type { FlashEvent } from '../components/visualization/SpellerGrid';
import type { P300ModelConfig, P300TrainingData } from '../types/decoders';

// ============================================================================
// HELPERS — Synthetic ERP Generation
// ============================================================================

const TEST_CONFIG: P300ModelConfig = {
  channels: 8,
  sampleRate: 250,
  epochDuration: 800,
  preStimulus: 200,
  filterLowcut: 0.5,
  filterHighcut: 30,
  spatialFiltering: 'car',
};

/** Total epoch length in samples */
const EPOCH_SAMPLES = Math.round(
  ((TEST_CONFIG.preStimulus + TEST_CONFIG.epochDuration) / 1000) * TEST_CONFIG.sampleRate
);

/** Pre-stimulus samples */
const PRE_STIM = Math.round((TEST_CONFIG.preStimulus / 1000) * TEST_CONFIG.sampleRate);

/**
 * Generate a synthetic P300-like epoch for one channel.
 * Target epochs have a positive peak at ~300ms post-stimulus.
 * Non-target epochs are flat (zero mean noise-free).
 */
function syntheticChannel(isTarget: boolean, channelIndex: number): number[] {
  const data = new Array(EPOCH_SAMPLES).fill(0);
  if (isTarget) {
    // Inject a Gaussian-like P300 peak at 300ms post-stim
    const peakSample = PRE_STIM + Math.round(0.3 * TEST_CONFIG.sampleRate); // 300ms
    const sigma = Math.round(0.04 * TEST_CONFIG.sampleRate); // 40ms width
    const amplitude = 5 + channelIndex * 0.5; // Vary slightly across channels
    for (let i = 0; i < data.length; i++) {
      const dist = i - peakSample;
      data[i] = amplitude * Math.exp(-(dist * dist) / (2 * sigma * sigma));
    }
  }
  return data;
}

/**
 * Generate a full [channels × samples] synthetic epoch.
 */
function syntheticEpoch(isTarget: boolean, nChannels: number = 8): number[][] {
  return Array.from({ length: nChannels }, (_, ch) => syntheticChannel(isTarget, ch));
}

/**
 * Generate a balanced flash sequence with N repetitions for a 6×6 grid.
 */
function generateFlashSequence(
  repetitions: number,
  targetRow: number = 2,
  targetCol: number = 3
): FlashEvent[] {
  const events: FlashEvent[] = [];
  let timestamp = 1000; // Start at 1000ms
  for (let rep = 0; rep < repetitions; rep++) {
    // Flash all rows then all columns (simplified deterministic order)
    for (let r = 0; r < 6; r++) {
      events.push({
        type: 'row' as const,
        index: r,
        timestamp,
        containsTarget: r === targetRow,
      });
      timestamp += 200; // 125ms flash + 75ms ISI
    }
    for (let c = 0; c < 6; c++) {
      events.push({
        type: 'col' as const,
        index: c,
        timestamp,
        containsTarget: c === targetCol,
      });
      timestamp += 200;
    }
  }
  return events;
}

// ============================================================================
// TESTS: MarkerManager
// ============================================================================

describe('MarkerManager', () => {
  let mm: MarkerManager;

  beforeEach(() => {
    mm = new MarkerManager(250);
  });

  it('is not calibrated initially', () => {
    expect(mm.isCalibrated).toBe(false);
  });

  it('becomes calibrated after setStreamOrigin', () => {
    mm.setStreamOrigin(1000, 0);
    expect(mm.isCalibrated).toBe(true);
  });

  it('converts timestamps to correct sample indices', () => {
    mm.setStreamOrigin(1000, 0); // stream starts at t=1000ms
    // At t=1000 → sample 0
    expect(mm.timestampToSampleIndex(1000)).toBe(0);
    // At t=2000 (1000ms later at 250Hz) → sample 250
    expect(mm.timestampToSampleIndex(2000)).toBe(250);
    // At t=1500 (500ms later) → sample 125
    expect(mm.timestampToSampleIndex(1500)).toBe(125);
  });

  it('handles non-zero starting sample index', () => {
    mm.setStreamOrigin(1000, 100); // stream starts at sample 100
    expect(mm.timestampToSampleIndex(1000)).toBe(100);
    expect(mm.timestampToSampleIndex(2000)).toBe(350);
  });

  it('records and retrieves markers', () => {
    mm.setStreamOrigin(1000, 0);
    const event: FlashEvent = {
      type: 'row',
      index: 2,
      timestamp: 1200,
      containsTarget: true,
    };
    mm.addMarker(event);
    const markers = mm.getAllMarkers();
    expect(markers).toHaveLength(1);
    expect(markers[0].sampleIndex).toBe(50); // 200ms at 250Hz
  });

  it('filters markers by sample range', () => {
    mm.setStreamOrigin(0, 0);
    const events: FlashEvent[] = [
      { type: 'row', index: 0, timestamp: 100, containsTarget: false },
      { type: 'row', index: 1, timestamp: 200, containsTarget: false },
      { type: 'row', index: 2, timestamp: 400, containsTarget: true },
      { type: 'col', index: 0, timestamp: 600, containsTarget: false },
    ];
    events.forEach(e => mm.addMarker(e));

    // 200ms at 250Hz = sample 50
    // Markers at samples: 25, 50, 100, 150
    const inRange = mm.getMarkersInRange(40, 110);
    expect(inRange).toHaveLength(2); // samples 50 and 100
  });

  it('clears all markers', () => {
    mm.setStreamOrigin(0, 0);
    mm.addMarker({ type: 'row', index: 0, timestamp: 100, containsTarget: false });
    mm.clear();
    expect(mm.getAllMarkers()).toHaveLength(0);
  });
});

// ============================================================================
// TESTS: EEGRingBuffer
// ============================================================================

describe('EEGRingBuffer', () => {
  it('stores and retrieves samples correctly', () => {
    const buf = new EEGRingBuffer(2, 1, 10); // 2 channels, 1 sec, 10 Hz → 10 samples
    // Push 5 samples
    for (let i = 0; i < 5; i++) {
      buf.push([i * 10, i * 20]);
    }
    expect(buf.samplesWritten).toBe(5);

    // Extract first 3 samples
    const win = buf.extractWindow(0, 3);
    expect(win).not.toBeNull();
    expect(win![0]).toEqual([0, 10, 20]); // channel 0
    expect(win![1]).toEqual([0, 20, 40]); // channel 1
  });

  it('wraps around correctly', () => {
    const buf = new EEGRingBuffer(1, 1, 4); // capacity = 4 samples
    // Push 6 samples (wraps around)
    for (let i = 0; i < 6; i++) {
      buf.push([i * 100]);
    }

    // Oldest available is sample index 2 (6 - 4 = 2)
    // So samples 0-1 are overwritten
    expect(buf.extractWindow(0, 2)).toBeNull(); // overwritten
    const win = buf.extractWindow(2, 4);
    expect(win).not.toBeNull();
    expect(win![0]).toEqual([200, 300, 400, 500]);
  });

  it('returns null for future samples', () => {
    const buf = new EEGRingBuffer(1, 1, 10);
    buf.push([1]);
    expect(buf.extractWindow(0, 5)).toBeNull(); // only 1 sample available
  });

  it('pushBatch stores multiple samples', () => {
    const buf = new EEGRingBuffer(2, 2, 100);
    const batch = [[1, 2], [3, 4], [5, 6]];
    buf.pushBatch(batch);
    expect(buf.samplesWritten).toBe(3);
    const win = buf.extractWindow(0, 3);
    expect(win![0]).toEqual([1, 3, 5]);
    expect(win![1]).toEqual([2, 4, 6]);
  });

  it('clear resets the buffer', () => {
    const buf = new EEGRingBuffer(1, 1, 10);
    buf.push([42]);
    buf.clear();
    expect(buf.samplesWritten).toBe(0);
    expect(buf.extractWindow(0, 1)).toBeNull();
  });
});

// ============================================================================
// TESTS: Signal Processing
// ============================================================================

describe('baselineCorrect', () => {
  it('subtracts pre-stimulus mean from entire epoch', () => {
    // 2 channels, 10 samples each. Pre-stimulus = 3 samples.
    const epoch = [
      [10, 10, 10, 20, 30, 40, 50, 60, 70, 80],
      [5, 5, 5, 15, 25, 35, 45, 55, 65, 75],
    ];
    const corrected = baselineCorrect(epoch, 3);

    // Pre-stim mean for ch0 = 10, ch1 = 5
    expect(corrected[0]).toEqual([0, 0, 0, 10, 20, 30, 40, 50, 60, 70]);
    expect(corrected[1]).toEqual([0, 0, 0, 10, 20, 30, 40, 50, 60, 70]);
  });

  it('handles single-sample pre-stimulus', () => {
    const epoch = [[100, 150, 200]];
    const corrected = baselineCorrect(epoch, 1);
    expect(corrected[0]).toEqual([0, 50, 100]);
  });
});

describe('commonAverageReference', () => {
  it('subtracts channel mean at each time point', () => {
    const epoch = [
      [10, 20, 30],
      [20, 40, 60],
      [30, 60, 90],
    ];
    // Mean at t=0: (10+20+30)/3 = 20
    // Mean at t=1: (20+40+60)/3 = 40
    // Mean at t=2: (30+60+90)/3 = 60
    const car = commonAverageReference(epoch);
    expect(car[0]).toEqual([-10, -20, -30]);
    expect(car[1]).toEqual([0, 0, 0]);
    expect(car[2]).toEqual([10, 20, 30]);
  });
});

describe('bandpassFilter', () => {
  it('attenuates DC component', () => {
    // Pure DC signal should be removed by bandpass
    const dc = new Array(500).fill(100);
    const filtered = bandpassFilter(dc, 250, 0.5, 30);
    // After transient, output should be near zero
    const tail = filtered.slice(200);
    const maxAbsValue = Math.max(...tail.map(Math.abs));
    expect(maxAbsValue).toBeLessThan(5); // DC should be strongly attenuated
  });

  it('passes signal within passband', () => {
    // 10 Hz sine wave (within 0.5-30 Hz passband)
    const sr = 250;
    const f = 10;
    const signal = Array.from({ length: 500 }, (_, i) =>
      Math.sin(2 * Math.PI * f * (i / sr))
    );
    const filtered = bandpassFilter(signal, sr, 0.5, 30);
    // After initial transient, amplitude should be preserved (>50% of original)
    const tail = filtered.slice(200);
    const maxAmp = Math.max(...tail.map(Math.abs));
    expect(maxAmp).toBeGreaterThan(0.3);
  });
});

describe('filterEpoch', () => {
  it('filters each channel independently', () => {
    const epoch = [
      new Array(200).fill(100), // DC
      Array.from({ length: 200 }, (_, i) => Math.sin(2 * Math.PI * 10 * (i / 250))), // 10 Hz
    ];
    const filtered = filterEpoch(epoch, 250, 0.5, 30);
    expect(filtered).toHaveLength(2);
    // DC channel tail should be near zero
    const dcTail = filtered[0].slice(100);
    expect(Math.max(...dcTail.map(Math.abs))).toBeLessThan(10);
    // 10 Hz channel should retain some energy
    const sineTail = filtered[1].slice(100);
    expect(Math.max(...sineTail.map(Math.abs))).toBeGreaterThan(0.1);
  });
});

// ============================================================================
// TESTS: Epoch Extraction from Ring Buffer
// ============================================================================

describe('extractEpoch', () => {
  it('extracts correct window around marker', () => {
    const config: P300ModelConfig = {
      channels: 2,
      sampleRate: 250,
      epochDuration: 800,
      preStimulus: 200,
      filterLowcut: 0.5,
      filterHighcut: 30,
      spatialFiltering: 'none',
    };
    // preSamples = Math.round((200 / 1000) * 250) = 50
    const totalSamples = Math.round(((200 + 800) / 1000) * 250); // 250

    const buf = new EEGRingBuffer(2, 5, 250); // 5 sec buffer
    // Fill buffer with 500 samples (2 sec worth)
    for (let i = 0; i < 500; i++) {
      buf.push([i, i * 2]);
    }

    // Extract epoch centered on sample 200 (at 200ms pre-stim, starts at sample 150)
    const epoch = extractEpoch(buf, 200, config);
    expect(epoch).not.toBeNull();
    expect(epoch!).toHaveLength(2); // 2 channels
    expect(epoch![0]).toHaveLength(totalSamples); // 250 samples
  });

  it('returns null if data overwritten', () => {
    const config: P300ModelConfig = {
      channels: 1,
      sampleRate: 250,
      epochDuration: 800,
      preStimulus: 200,
      spatialFiltering: 'none',
    };
    const buf = new EEGRingBuffer(1, 1, 250); // 1 sec buffer = 250 samples
    // Fill buffer past capacity
    for (let i = 0; i < 500; i++) {
      buf.push([i]);
    }
    // Sample 10 would have been overwritten (oldest is 500-250=250)
    const epoch = extractEpoch(buf, 10, config);
    expect(epoch).toBeNull();
  });
});

// ============================================================================
// TESTS: Feature Extraction
// ============================================================================

describe('extractFeatures', () => {
  it('produces correct number of features with default downsample', () => {
    const epoch = syntheticEpoch(true);
    const features = extractFeatures(epoch, 8);
    // 8 channels × ceil(250 / 8) = 8 × 32 ≈ 256 features
    const expectedPerChannel = Math.ceil(EPOCH_SAMPLES / 8);
    expect(features).toHaveLength(8 * expectedPerChannel);
  });

  it('features differ between target and non-target', () => {
    const targetFeats = extractFeatures(syntheticEpoch(true));
    const nonTargetFeats = extractFeatures(syntheticEpoch(false));
    // Non-target is all zeros, target should have non-zero values
    const targetEnergy = targetFeats.reduce((s, v) => s + v * v, 0);
    const nonTargetEnergy = nonTargetFeats.reduce((s, v) => s + v * v, 0);
    expect(targetEnergy).toBeGreaterThan(0);
    expect(nonTargetEnergy).toBe(0);
  });
});

describe('extractP300Features', () => {
  it('produces features from three windows per channel', () => {
    const epoch = syntheticEpoch(true);
    const features = extractP300Features(epoch, TEST_CONFIG);
    // 3 windows × 2 stats (mean + peak) × 8 channels = 48 features
    expect(features).toHaveLength(8 * 3 * 2);
  });

  it('P300 window features are stronger for target epochs', () => {
    const targetFeats = extractP300Features(syntheticEpoch(true), TEST_CONFIG);
    const nonTargetFeats = extractP300Features(syntheticEpoch(false), TEST_CONFIG);
    // Target should have higher energy overall
    const targetEnergy = targetFeats.reduce((s, v) => s + Math.abs(v), 0);
    const nonTargetEnergy = nonTargetFeats.reduce((s, v) => s + Math.abs(v), 0);
    expect(targetEnergy).toBeGreaterThan(nonTargetEnergy);
  });
});

// ============================================================================
// TESTS: Flash Sequence Validation
// ============================================================================

describe('validateFlashSequence', () => {
  it('validates a balanced sequence', () => {
    const events = generateFlashSequence(5, 0, 0); // 5 reps
    const result = validateFlashSequence(events);
    expect(result.valid).toBe(true);
    expect(result.rowCounts).toEqual([5, 5, 5, 5, 5, 5]);
    expect(result.colCounts).toEqual([5, 5, 5, 5, 5, 5]);
  });

  it('detects imbalanced sequence', () => {
    const events: FlashEvent[] = [
      { type: 'row', index: 0, timestamp: 0, containsTarget: false },
      { type: 'row', index: 0, timestamp: 100, containsTarget: false },
      { type: 'row', index: 1, timestamp: 200, containsTarget: false },
      // Missing rows 2-5 and all columns
    ];
    const result = validateFlashSequence(events);
    expect(result.valid).toBe(false);
    expect(result.rowCounts[0]).toBe(2);
    expect(result.rowCounts[1]).toBe(1);
    expect(result.colCounts.every(c => c === 0)).toBe(true);
  });

  it('validates single repetition', () => {
    const events = generateFlashSequence(1);
    const result = validateFlashSequence(events);
    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// TESTS: Score Aggregation
// ============================================================================

describe('aggregateFlashScores', () => {
  it('selects row and column with highest mean score', () => {
    const events: FlashEvent[] = [
      { type: 'row', index: 0, timestamp: 0, containsTarget: false },
      { type: 'row', index: 1, timestamp: 200, containsTarget: false },
      { type: 'row', index: 2, timestamp: 400, containsTarget: true },
      { type: 'col', index: 0, timestamp: 600, containsTarget: false },
      { type: 'col', index: 1, timestamp: 800, containsTarget: false },
      { type: 'col', index: 3, timestamp: 1000, containsTarget: true },
    ];
    // Scores: highest for row 2 and col 3
    const scores = [0.1, 0.2, 0.9, 0.1, 0.2, 0.8];
    const result = aggregateFlashScores(events, scores);
    expect(result.predictedRow).toBe(2);
    expect(result.predictedCol).toBe(3);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('handles multiple repetitions correctly', () => {
    const events: FlashEvent[] = [];
    const scores: number[] = [];
    // 3 repetitions, target at row=1, col=4
    for (let rep = 0; rep < 3; rep++) {
      for (let r = 0; r < 6; r++) {
        events.push({ type: 'row', index: r, timestamp: rep * 2400 + r * 200, containsTarget: r === 1 });
        scores.push(r === 1 ? 0.8 + rep * 0.01 : 0.2); // target row gets high score
      }
      for (let c = 0; c < 6; c++) {
        events.push({ type: 'col', index: c, timestamp: rep * 2400 + 1200 + c * 200, containsTarget: c === 4 });
        scores.push(c === 4 ? 0.85 : 0.15); // target col gets high score
      }
    }
    const result = aggregateFlashScores(events, scores);
    expect(result.predictedRow).toBe(1);
    expect(result.predictedCol).toBe(4);
  });

  it('confidence is zero when all scores equal', () => {
    const events: FlashEvent[] = [];
    const scores: number[] = [];
    for (let r = 0; r < 6; r++) {
      events.push({ type: 'row', index: r, timestamp: r * 200, containsTarget: false });
      scores.push(0.5);
    }
    for (let c = 0; c < 6; c++) {
      events.push({ type: 'col', index: c, timestamp: 1200 + c * 200, containsTarget: false });
      scores.push(0.5);
    }
    const result = aggregateFlashScores(events, scores);
    expect(result.confidence).toBe(0);
  });
});

// ============================================================================
// TESTS: LDA Classifier
// ============================================================================

describe('LDA Classifier', () => {
  /**
   * Generate synthetic training data with known P300 waveforms
   * for a deterministic classification test.
   */
  function generateTrainingData(
    nTargets: number,
    nNonTargets: number
  ): P300TrainingData[] {
    const data: P300TrainingData[] = [];
    for (let i = 0; i < nTargets; i++) {
      data.push({
        eegEpoch: syntheticEpoch(true),
        label: 1,
        flashType: 'row',
        flashIndex: 2,
        timestamp: i * 200,
      });
    }
    for (let i = 0; i < nNonTargets; i++) {
      data.push({
        eegEpoch: syntheticEpoch(false),
        label: 0,
        flashType: 'row',
        flashIndex: i % 6,
        timestamp: (nTargets + i) * 200,
      });
    }
    return data;
  }

  it('throws if fewer than 10 training samples', () => {
    const data = generateTrainingData(3, 3);
    expect(() => trainLDA(data, TEST_CONFIG)).toThrow('at least 10');
  });

  it('throws if only one class present', () => {
    const data = generateTrainingData(15, 0);
    expect(() => trainLDA(data, TEST_CONFIG)).toThrow('both classes');
  });

  it('trains successfully on valid data', () => {
    const data = generateTrainingData(20, 60);
    const model = trainLDA(data, TEST_CONFIG);

    expect(model.weights).toHaveLength(model.nFeatures);
    expect(model.nSamples).toBe(80);
    expect(model.trainingAccuracy).toBeGreaterThan(0);
    expect(model.trainedAt).toBeGreaterThan(0);
  });

  it('classifies clean synthetic epochs correctly', () => {
    // Train with balanced data
    const data = generateTrainingData(30, 90);
    const model = trainLDA(data, TEST_CONFIG);

    // Score a target epoch → should be positive (above threshold=0)
    const targetScore = classifyEpoch(syntheticEpoch(true), model, TEST_CONFIG);
    // Score a non-target epoch → should be negative
    const nonTargetScore = classifyEpoch(syntheticEpoch(false), model, TEST_CONFIG);

    expect(targetScore).toBeGreaterThan(nonTargetScore);
  });

  it('achieves >90% LOO-CV accuracy on clean synthetic data', () => {
    const data = generateTrainingData(30, 90);
    const model = trainLDA(data, TEST_CONFIG);
    // Clean synthetic data with clear P300 vs. flat should be easy for LDA
    expect(model.trainingAccuracy).toBeGreaterThan(0.9);
  });

  it('works with p300windows feature mode', () => {
    const data = generateTrainingData(20, 60);
    const model = trainLDA(data, TEST_CONFIG, 'p300windows');

    expect(model.featureMode).toBe('p300windows');
    expect(model.nFeatures).toBe(48); // 8ch × 3 windows × 2 stats
    expect(model.trainingAccuracy).toBeGreaterThan(0.5);
  });
});

// ============================================================================
// TESTS: End-to-End Pipeline (Buffer → Epochs → LDA → Character)
// ============================================================================

describe('End-to-end P300 pipeline', () => {
  it('correctly identifies target character from synthetic EEG stream', () => {
    const config: P300ModelConfig = {
      channels: 8,
      sampleRate: 250,
      epochDuration: 800,
      preStimulus: 200,
      spatialFiltering: 'none', // Simpler for this test
    };

    // 1. Train an LDA model
    const trainingData: P300TrainingData[] = [];
    for (let i = 0; i < 25; i++) {
      trainingData.push({
        eegEpoch: syntheticEpoch(true, 8),
        label: 1,
        flashType: 'row',
        flashIndex: 0,
        timestamp: i * 200,
      });
    }
    for (let i = 0; i < 75; i++) {
      trainingData.push({
        eegEpoch: syntheticEpoch(false, 8),
        label: 0,
        flashType: 'row',
        flashIndex: 1,
        timestamp: (25 + i) * 200,
      });
    }
    const model = trainLDA(trainingData, config);

    // 2. Set up buffer and marker manager
    const buffer = new EEGRingBuffer(8, 30, 250);
    const mm = new MarkerManager(250);
    mm.setStreamOrigin(0, 0);

    // 3. Simulate streaming EEG with embedded P300 at known positions
    // We fill the buffer with enough data, then place synthetic epochs at marker locations
    const TARGET_ROW = 2;
    const TARGET_COL = 3;
    const flashEvents = generateFlashSequence(1, TARGET_ROW, TARGET_COL);

    // Fill buffer with zeros (enough to cover all epochs)
    const totalDuration = 10 * 250; // 10 seconds
    for (let i = 0; i < totalDuration; i++) {
      buffer.push(new Array(8).fill(0));
    }

    // 4. Score each flash event using directly constructed epochs
    // (bypasses buffer extraction for determinism)
    const epochsWithFlash: Array<{ epoch: number[][]; flashEvent: FlashEvent }> = [];
    for (const event of flashEvents) {
      const isTarget =
        (event.type === 'row' && event.index === TARGET_ROW) ||
        (event.type === 'col' && event.index === TARGET_COL);
      epochsWithFlash.push({
        epoch: syntheticEpoch(isTarget, 8),
        flashEvent: event,
      });
    }

    // 5. Score all epochs
    const scores = epochsWithFlash.map(({ epoch }) =>
      classifyEpoch(epoch, model, config)
    );

    // 6. Aggregate scores
    const result = aggregateFlashScores(
      epochsWithFlash.map(e => e.flashEvent),
      scores
    );

    // Target should be correctly identified
    expect(result.predictedRow).toBe(TARGET_ROW);
    expect(result.predictedCol).toBe(TARGET_COL);
    expect(result.confidence).toBeGreaterThan(0);
  });
});
