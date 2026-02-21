/**
 * P300 Signal Processing Pipeline
 * 
 * Implements the core signal processing chain for P300 BCI speller:
 * 1. Marker management - aligns flash events to EEG sample time
 * 2. Epoch extraction - [-200ms, +800ms] windows around flash onset
 * 3. Baseline correction - subtract pre-stimulus mean
 * 4. Bandpass filtering - IIR Butterworth 0.5-30 Hz
 * 5. Epoch aggregation - collect epochs per trial for classifier input
 */

import type { FlashEvent } from '../components/visualization/SpellerGrid';
import type { P300TrainingData, P300ModelConfig } from '../types/decoders';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default P300 pipeline configuration */
export const DEFAULT_P300_CONFIG: P300ModelConfig = {
  channels: 8,
  sampleRate: 250,
  epochDuration: 800,    // 800ms post-stimulus
  preStimulus: 200,      // 200ms pre-stimulus baseline
  filterLowcut: 0.5,
  filterHighcut: 30,
  spatialFiltering: 'car',
};

/** Epoch window in samples (at default 250 Hz) */
const PRE_STIMULUS_SAMPLES = (config: P300ModelConfig) =>
  Math.round((config.preStimulus / 1000) * config.sampleRate);

const POST_STIMULUS_SAMPLES = (config: P300ModelConfig) =>
  Math.round((config.epochDuration / 1000) * config.sampleRate);

const TOTAL_EPOCH_SAMPLES = (config: P300ModelConfig) =>
  PRE_STIMULUS_SAMPLES(config) + POST_STIMULUS_SAMPLES(config);

// ============================================================================
// MARKER MANAGER
// ============================================================================

/**
 * Aligns flash event timestamps (performance.now()) to EEG stream sample indices.
 * 
 * The EEG stream arrives via WebSocket with its own clock domain.
 * Flash events are recorded with performance.now(). This class maintains
 * a mapping between the two clock domains using the bridge timestamp
 * and the first sample received.
 */
export class MarkerManager {
  private streamStartTime: number = 0;       // performance.now() when first EEG sample arrived
  private streamStartSample: number = 0;     // Sample index of the first sample
  private sampleRate: number;
  private markers: Array<{
    flashEvent: FlashEvent;
    sampleIndex: number;                     // Aligned EEG sample index
    frameTimestamp: number;                   // Actual display timestamp (from rAF)
  }> = [];

  constructor(sampleRate: number = 250) {
    this.sampleRate = sampleRate;
  }

  /**
   * Called when the first EEG sample arrives to establish clock alignment.
   */
  setStreamOrigin(performanceTimestamp: number, sampleIndex: number = 0) {
    this.streamStartTime = performanceTimestamp;
    this.streamStartSample = sampleIndex;
  }

  /**
   * Update sample rate if stream metadata changes.
   */
  setSampleRate(rate: number) {
    this.sampleRate = rate;
  }

  /**
   * Convert a performance.now() timestamp to an EEG sample index.
   */
  timestampToSampleIndex(timestamp: number): number {
    const elapsedMs = timestamp - this.streamStartTime;
    const elapsedSamples = (elapsedMs / 1000) * this.sampleRate;
    return Math.round(this.streamStartSample + elapsedSamples);
  }

  /**
   * Record a flash event with its actual display timestamp.
   * @param flashEvent - The flash event from SpellerGrid
   * @param frameTimestamp - The actual rAF frame timestamp (not performance.now())
   */
  addMarker(flashEvent: FlashEvent, frameTimestamp?: number) {
    const ts = frameTimestamp ?? flashEvent.timestamp;
    const sampleIndex = this.timestampToSampleIndex(ts);
    this.markers.push({ flashEvent, sampleIndex, frameTimestamp: ts });
  }

  /**
   * Get all markers within a sample range.
   */
  getMarkersInRange(startSample: number, endSample: number) {
    return this.markers.filter(
      m => m.sampleIndex >= startSample && m.sampleIndex <= endSample
    );
  }

  /**
   * Get all recorded markers.
   */
  getAllMarkers() {
    return [...this.markers];
  }

  /**
   * Clear all markers (e.g., between trials).
   */
  clear() {
    this.markers = [];
  }

  /**
   * Check if stream origin has been set.
   */
  get isCalibrated(): boolean {
    return this.streamStartTime > 0;
  }
}

// ============================================================================
// CIRCULAR EEG BUFFER
// ============================================================================

/**
 * Circular buffer that stores continuous EEG samples for epoch extraction.
 * Stores [channels × samples] with efficient wraparound.
 */
export class EEGRingBuffer {
  private buffer: Float32Array[];  // One array per channel
  private writeIndex: number = 0;
  private totalSamplesWritten: number = 0;
  private capacity: number;
  readonly channels: number;

  constructor(channels: number, durationSeconds: number, sampleRate: number) {
    this.channels = channels;
    this.capacity = Math.ceil(durationSeconds * sampleRate);
    this.buffer = Array.from({ length: channels }, () => new Float32Array(this.capacity));
  }

  /**
   * Push a single multi-channel sample into the buffer.
   * @param sample - Array of length `channels`
   */
  push(sample: number[]) {
    for (let ch = 0; ch < this.channels; ch++) {
      this.buffer[ch][this.writeIndex] = sample[ch] ?? 0;
    }
    this.writeIndex = (this.writeIndex + 1) % this.capacity;
    this.totalSamplesWritten++;
  }

  /**
   * Push multiple samples at once (batch from WebSocket frame).
   * @param samples - Array of multi-channel samples [[ch0, ch1, ...], ...]
   */
  pushBatch(samples: number[][]) {
    for (const sample of samples) {
      this.push(sample);
    }
  }

  /**
   * Extract a window of samples by absolute sample index.
   * Returns [channels × windowLength] or null if data not available.
   */
  extractWindow(startSample: number, length: number): number[][] | null {
    // Check if we have enough data
    const oldestAvailable = this.totalSamplesWritten - this.capacity;
    if (startSample < oldestAvailable) {
      return null; // Data has been overwritten
    }
    if (startSample + length > this.totalSamplesWritten) {
      return null; // Data hasn't arrived yet
    }

    const result: number[][] = [];
    for (let ch = 0; ch < this.channels; ch++) {
      const channelData = new Array(length);
      for (let i = 0; i < length; i++) {
        const bufIdx = (startSample + i) % this.capacity;
        channelData[i] = this.buffer[ch][bufIdx >= 0 ? bufIdx : bufIdx + this.capacity];
      }
      result.push(channelData);
    }
    return result;
  }

  /** Total number of samples written since creation */
  get samplesWritten(): number {
    return this.totalSamplesWritten;
  }

  /** Clear the buffer */
  clear() {
    for (let ch = 0; ch < this.channels; ch++) {
      this.buffer[ch].fill(0);
    }
    this.writeIndex = 0;
    this.totalSamplesWritten = 0;
  }
}

// ============================================================================
// SIGNAL PROCESSING
// ============================================================================

/**
 * Baseline correction: subtract mean of pre-stimulus period from entire epoch.
 * @param epoch - [channels × samples]
 * @param preStimSamples - Number of pre-stimulus samples
 */
export function baselineCorrect(epoch: number[][], preStimSamples: number): number[][] {
  return epoch.map(channelData => {
    // Compute mean of pre-stimulus window
    let sum = 0;
    for (let i = 0; i < preStimSamples; i++) {
      sum += channelData[i];
    }
    const baseline = sum / preStimSamples;

    // Subtract baseline from entire epoch
    return channelData.map(v => v - baseline);
  });
}

/**
 * Common Average Reference (CAR): subtract mean across channels at each time point.
 * @param epoch - [channels × samples]
 */
export function commonAverageReference(epoch: number[][]): number[][] {
  const nChannels = epoch.length;
  const nSamples = epoch[0].length;
  const result = epoch.map(ch => [...ch]);

  for (let t = 0; t < nSamples; t++) {
    let sum = 0;
    for (let ch = 0; ch < nChannels; ch++) {
      sum += epoch[ch][t];
    }
    const mean = sum / nChannels;
    for (let ch = 0; ch < nChannels; ch++) {
      result[ch][t] -= mean;
    }
  }
  return result;
}

/**
 * Simple 2nd-order IIR bandpass filter (Butterworth approximation).
 * Applied forward-only (causal) per channel.
 * 
 * For a proper production implementation you'd use a proper DSP library,
 * but this is sufficient for a working P300 pipeline.
 */
export function bandpassFilter(
  data: number[],
  sampleRate: number,
  lowcut: number,
  highcut: number
): number[] {
  // Design 2nd-order Butterworth bandpass coefficients
  const nyquist = sampleRate / 2;
  const low = lowcut / nyquist;
  const high = highcut / nyquist;

  // Compute analog frequencies
  const wLow = Math.tan(Math.PI * low);
  const wHigh = Math.tan(Math.PI * high);
  const bw = wHigh - wLow;
  const w0sq = wLow * wHigh;

  // 2nd order bandpass coefficients via bilinear transform
  const Q = Math.sqrt(w0sq) / bw; // Quality factor
  const w0 = Math.sqrt(w0sq);
  const alpha = Math.sin(2 * Math.atan(w0)) / (2 * Q);

  // IIR coefficients (biquad)
  const a0 = 1 + alpha;
  const b0 = alpha / a0;
  const b1 = 0;
  const b2 = -alpha / a0;
  const a1 = (-2 * Math.cos(2 * Math.atan(w0))) / a0;
  const a2 = (1 - alpha) / a0;

  // Apply filter
  const output = new Array(data.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;

  for (let i = 0; i < data.length; i++) {
    const x0 = data[i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    output[i] = y0;
    x2 = x1; x1 = x0;
    y2 = y1; y1 = y0;
  }

  return output;
}

/**
 * Apply bandpass filter to all channels of an epoch.
 */
export function filterEpoch(
  epoch: number[][],
  sampleRate: number,
  lowcut: number,
  highcut: number
): number[][] {
  return epoch.map(channelData =>
    bandpassFilter(channelData, sampleRate, lowcut, highcut)
  );
}

// ============================================================================
// EPOCH EXTRACTION
// ============================================================================

/**
 * Extract a single epoch around a flash event from the EEG ring buffer.
 * Returns preprocessed [channels × samples] data.
 */
export function extractEpoch(
  buffer: EEGRingBuffer,
  markerSampleIndex: number,
  config: P300ModelConfig
): number[][] | null {
  const preSamples = PRE_STIMULUS_SAMPLES(config);
  const totalSamples = TOTAL_EPOCH_SAMPLES(config);
  const startSample = markerSampleIndex - preSamples;

  // Extract raw window
  const raw = buffer.extractWindow(startSample, totalSamples);
  if (!raw) return null;

  // 1. Bandpass filter
  let processed = filterEpoch(
    raw,
    config.sampleRate,
    config.filterLowcut ?? 0.5,
    config.filterHighcut ?? 30
  );

  // 2. Common average reference (if enabled)
  if (config.spatialFiltering === 'car') {
    processed = commonAverageReference(processed);
  }

  // 3. Baseline correction (subtract pre-stimulus mean)
  processed = baselineCorrect(processed, preSamples);

  return processed;
}

/**
 * Extract all epochs for a complete trial (all flash events).
 * Returns array of { epoch, flashEvent, label } for training or classification.
 */
export function extractTrialEpochs(
  buffer: EEGRingBuffer,
  markers: MarkerManager,
  config: P300ModelConfig,
  targetPosition?: { row: number; col: number }
): Array<{
  epoch: number[][];
  flashEvent: FlashEvent;
  label: 0 | 1;
}> {
  const results: Array<{
    epoch: number[][];
    flashEvent: FlashEvent;
    label: 0 | 1;
  }> = [];

  for (const marker of markers.getAllMarkers()) {
    const epoch = extractEpoch(buffer, marker.sampleIndex, config);
    if (!epoch) continue;

    // Determine label (target vs non-target)
    let label: 0 | 1 = 0;
    if (targetPosition) {
      if (
        (marker.flashEvent.type === 'row' && marker.flashEvent.index === targetPosition.row) ||
        (marker.flashEvent.type === 'col' && marker.flashEvent.index === targetPosition.col)
      ) {
        label = 1;
      }
    } else {
      label = marker.flashEvent.containsTarget ? 1 : 0;
    }

    results.push({ epoch, flashEvent: marker.flashEvent, label });
  }

  return results;
}

/**
 * Convert extracted epochs to P300TrainingData format for storage.
 */
export function epochsToTrainingData(
  epochs: Array<{ epoch: number[][]; flashEvent: FlashEvent; label: 0 | 1 }>,
  targetPosition?: { row: number; col: number }
): P300TrainingData[] {
  return epochs.map(({ epoch, flashEvent, label }) => ({
    eegEpoch: epoch,
    label,
    flashType: flashEvent.type,
    flashIndex: flashEvent.index,
    targetPosition,
    timestamp: flashEvent.timestamp,
  }));
}

// ============================================================================
// FEATURE EXTRACTION (for LDA classifier)
// ============================================================================

/**
 * Extract features from a single epoch for LDA classification.
 * Features: downsampled epoch values (temporal features per channel).
 * 
 * @param epoch - [channels × samples] preprocessed EEG
 * @param downsampleFactor - Reduce temporal resolution (default: 8 → ~31 features/channel at 250Hz/800ms)
 * @returns Flat feature vector
 */
export function extractFeatures(
  epoch: number[][],
  downsampleFactor: number = 8
): number[] {
  const features: number[] = [];
  
  for (const channelData of epoch) {
    // Downsample by averaging blocks
    const blockSize = downsampleFactor;
    for (let i = 0; i < channelData.length; i += blockSize) {
      const end = Math.min(i + blockSize, channelData.length);
      let sum = 0;
      for (let j = i; j < end; j++) {
        sum += channelData[j];
      }
      features.push(sum / (end - i));
    }
  }
  
  return features;
}

/**
 * Extract P300-specific features from an epoch:
 * - Mean amplitude in P300 window (250-500ms post-stimulus)
 * - Peak amplitude in P300 window
 * - Mean amplitude in early window (100-200ms, N1/P2 complex)
 * - Late positive potential (500-700ms)
 */
export function extractP300Features(
  epoch: number[][],
  config: P300ModelConfig
): number[] {
  const features: number[] = [];
  const preSamples = PRE_STIMULUS_SAMPLES(config);
  const sr = config.sampleRate;

  // Convert ms to sample offsets from stimulus onset
  const toSample = (ms: number) => preSamples + Math.round((ms / 1000) * sr);

  const windows = [
    { start: toSample(100), end: toSample(200), name: 'N1/P2' },
    { start: toSample(250), end: toSample(500), name: 'P300' },
    { start: toSample(500), end: toSample(700), name: 'LPP' },
  ];

  for (const channelData of epoch) {
    for (const w of windows) {
      const windowData = channelData.slice(w.start, w.end);
      if (windowData.length === 0) {
        features.push(0, 0);
        continue;
      }

      // Mean amplitude
      const mean = windowData.reduce((a, b) => a + b, 0) / windowData.length;
      features.push(mean);

      // Peak amplitude
      features.push(Math.max(...windowData));
    }
  }

  return features;
}

// ============================================================================
// FLASH SEQUENCE VALIDATION
// ============================================================================

/**
 * Validate that a flash sequence is balanced (each row and column appears equally).
 */
export function validateFlashSequence(
  events: FlashEvent[],
  expectedRows: number = 6,
  expectedCols: number = 6
): { valid: boolean; rowCounts: number[]; colCounts: number[] } {
  const rowCounts = new Array(expectedRows).fill(0);
  const colCounts = new Array(expectedCols).fill(0);

  for (const event of events) {
    if (event.type === 'row') rowCounts[event.index]++;
    else colCounts[event.index]++;
  }

  // Check balance: all rows should have same count, all cols should have same count
  const rowTarget = rowCounts[0];
  const colTarget = colCounts[0];
  const valid =
    rowCounts.every(c => c === rowTarget) &&
    colCounts.every(c => c === colTarget) &&
    rowTarget > 0 && colTarget > 0;

  return { valid, rowCounts, colCounts };
}

// ============================================================================
// AGGREGATE SCORES FOR CHARACTER SELECTION
// ============================================================================

/**
 * Aggregate classifier scores across all flash events in a trial to determine
 * the predicted row and column.
 * 
 * @param flashEvents - Flash events from the trial
 * @param scores - Classifier score for each flash event (higher = more likely target)
 * @returns P300-style output with predicted row/col and confidence
 */
export function aggregateFlashScores(
  flashEvents: FlashEvent[],
  scores: number[]
): {
  predictedRow: number;
  predictedCol: number;
  confidence: number;
  rowScores: number[];
  colScores: number[];
} {
  const rowScores = [0, 0, 0, 0, 0, 0];
  const colScores = [0, 0, 0, 0, 0, 0];
  const rowCounts = [0, 0, 0, 0, 0, 0];
  const colCounts = [0, 0, 0, 0, 0, 0];

  for (let i = 0; i < flashEvents.length; i++) {
    const event = flashEvents[i];
    const score = scores[i] ?? 0;

    if (event.type === 'row') {
      rowScores[event.index] += score;
      rowCounts[event.index]++;
    } else {
      colScores[event.index] += score;
      colCounts[event.index]++;
    }
  }

  // Average scores
  for (let i = 0; i < 6; i++) {
    if (rowCounts[i] > 0) rowScores[i] /= rowCounts[i];
    if (colCounts[i] > 0) colScores[i] /= colCounts[i];
  }

  const predictedRow = rowScores.indexOf(Math.max(...rowScores));
  const predictedCol = colScores.indexOf(Math.max(...colScores));

  // Confidence: softmax-like score difference
  const rowSorted = [...rowScores].sort((a, b) => b - a);
  const colSorted = [...colScores].sort((a, b) => b - a);
  const rowMargin = rowSorted[0] - rowSorted[1];
  const colMargin = colSorted[0] - colSorted[1];

  // Confidence is the geometric mean of row and col margins, scaled to 0-1
  const confidence = Math.min(1, Math.sqrt(Math.max(0, rowMargin) * Math.max(0, colMargin)));

  return { predictedRow, predictedCol, confidence, rowScores, colScores };
}
