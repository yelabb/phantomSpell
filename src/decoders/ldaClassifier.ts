/**
 * LDA (Linear Discriminant Analysis) Classifier for P300 Detection
 * 
 * A real, working classifier that:
 * 1. Trains on labeled epochs (target vs non-target)
 * 2. Computes class means, pooled covariance, and projection vector
 * 3. Classifies new epochs with a confidence score
 * 4. Persists trained weights to localStorage
 * 
 * LDA is the standard baseline for P300 BCI and typically achieves
 * 70-85% accuracy with 8-channel EEG after ~5 minutes of calibration.
 */

import {
  extractFeatures,
  extractP300Features,
  aggregateFlashScores,
} from '../utils/p300Pipeline';
import type { FlashEvent } from '../components/visualization/SpellerGrid';
import type { P300Output, P300TrainingData, P300ModelConfig, Decoder } from '../types/decoders';

// ============================================================================
// LDA MODEL
// ============================================================================

export interface LDAModel {
  /** Projection vector (w = Sw^{-1} * (mu1 - mu0)) */
  weights: number[];
  /** Decision threshold (midpoint of projected class means) */
  threshold: number;
  /** Number of features */
  nFeatures: number;
  /** Training accuracy (cross-validated) */
  trainingAccuracy: number;
  /** Number of training samples */
  nSamples: number;
  /** Feature extraction mode used during training */
  featureMode: 'downsample' | 'p300windows';
  /** Timestamp of training */
  trainedAt: number;
}

const LDA_STORAGE_KEY = 'phantomspell-lda-model-v1';

// ============================================================================
// TRAINING
// ============================================================================

/**
 * Train an LDA classifier from labeled P300 training data.
 * 
 * @param trainingData - Array of labeled epochs from calibration
 * @param config - P300 pipeline configuration
 * @param featureMode - Feature extraction strategy
 * @returns Trained LDA model with cross-validated accuracy
 */
export function trainLDA(
  trainingData: P300TrainingData[],
  config: P300ModelConfig,
  featureMode: 'downsample' | 'p300windows' = 'downsample'
): LDAModel {
  if (trainingData.length < 10) {
    throw new Error(`Need at least 10 training samples, got ${trainingData.length}`);
  }

  // Extract features from all epochs
  const features: number[][] = [];
  const labels: number[] = [];

  for (const sample of trainingData) {
    const feat = featureMode === 'p300windows'
      ? extractP300Features(sample.eegEpoch, config)
      : extractFeatures(sample.eegEpoch);

    features.push(feat);
    labels.push(sample.label);
  }

  const nFeatures = features[0].length;

  // Separate classes
  const class0: number[][] = []; // non-target
  const class1: number[][] = []; // target

  for (let i = 0; i < features.length; i++) {
    if (labels[i] === 0) class0.push(features[i]);
    else class1.push(features[i]);
  }

  if (class0.length === 0 || class1.length === 0) {
    throw new Error(`Need samples from both classes. Got ${class0.length} non-target, ${class1.length} target`);
  }

  // Compute class means
  const mean0 = computeMean(class0, nFeatures);
  const mean1 = computeMean(class1, nFeatures);

  // Compute pooled within-class scatter matrix (regularized)
  const Sw = computePooledCovariance(class0, class1, mean0, mean1, nFeatures);

  // Regularize: Sw + lambda * I (Ledoit-Wolf style shrinkage)
  const lambda = 0.1 * trace(Sw, nFeatures) / nFeatures;
  for (let i = 0; i < nFeatures; i++) {
    Sw[i * nFeatures + i] += lambda;
  }

  // Compute projection vector: w = Sw^{-1} * (mean1 - mean0)
  const meanDiff = mean1.map((v, i) => v - mean0[i]);
  const weights = solveLinearSystem(Sw, meanDiff, nFeatures);

  // Normalize weights
  const norm = Math.sqrt(weights.reduce((s, w) => s + w * w, 0));
  if (norm > 0) {
    for (let i = 0; i < weights.length; i++) weights[i] /= norm;
  }

  // Compute threshold (midpoint of projected class means)
  const proj0 = dotProduct(weights, mean0);
  const proj1 = dotProduct(weights, mean1);
  const threshold = (proj0 + proj1) / 2;

  // Cross-validated accuracy (leave-one-out)
  const accuracy = leaveOneOutCV(features, labels, nFeatures, lambda);

  const model: LDAModel = {
    weights,
    threshold,
    nFeatures,
    trainingAccuracy: accuracy,
    nSamples: features.length,
    featureMode,
    trainedAt: Date.now(),
  };

  // Persist to localStorage
  saveLDAModel(model);

  console.log(
    `[LDA] Trained on ${features.length} samples (${class1.length} target, ${class0.length} non-target). ` +
    `LOO-CV accuracy: ${(accuracy * 100).toFixed(1)}%`
  );

  return model;
}

// ============================================================================
// INFERENCE
// ============================================================================

/**
 * Classify a single epoch as target (1) or non-target (0).
 * @returns Score (higher = more likely target). > threshold means target.
 */
export function classifyEpoch(
  epoch: number[][],
  model: LDAModel,
  config: P300ModelConfig
): number {
  const features = model.featureMode === 'p300windows'
    ? extractP300Features(epoch, config)
    : extractFeatures(epoch);

  if (features.length !== model.nFeatures) {
    console.warn(
      `[LDA] Feature dimension mismatch: expected ${model.nFeatures}, got ${features.length}`
    );
    return 0;
  }

  return dotProduct(model.weights, features) - model.threshold;
}

/**
 * Run full P300 trial classification:
 * 1. Score each flash epoch
 * 2. Aggregate scores across trials
 * 3. Select predicted row and column
 */
export function classifyTrial(
  epochs: Array<{ epoch: number[][]; flashEvent: FlashEvent }>,
  model: LDAModel,
  config: P300ModelConfig
): P300Output {
  const startTime = performance.now();

  // Score each epoch
  const scores = epochs.map(({ epoch }) => classifyEpoch(epoch, model, config));

  // Aggregate flash scores to determine row/col
  const flashEvents = epochs.map(e => e.flashEvent);
  const { predictedRow, predictedCol, confidence, rowScores, colScores } =
    aggregateFlashScores(flashEvents, scores);

  const latency = performance.now() - startTime;

  return {
    predictedRow,
    predictedCol,
    confidence,
    rowScores,
    colScores,
    latency,
    timestamp: Date.now(),
  };
}

// ============================================================================
// PERSISTENCE
// ============================================================================

export function saveLDAModel(model: LDAModel): void {
  try {
    localStorage.setItem(LDA_STORAGE_KEY, JSON.stringify(model));
    console.log(`[LDA] Model saved (${model.nSamples} samples, ${(model.trainingAccuracy * 100).toFixed(1)}% accuracy)`);
  } catch (e) {
    console.warn('[LDA] Failed to save model:', e);
  }
}

export function loadLDAModel(): LDAModel | null {
  try {
    const stored = localStorage.getItem(LDA_STORAGE_KEY);
    if (!stored) return null;
    const model: LDAModel = JSON.parse(stored);
    console.log(`[LDA] Loaded saved model (trained ${new Date(model.trainedAt).toLocaleString()})`);
    return model;
  } catch (e) {
    console.warn('[LDA] Failed to load model:', e);
    return null;
  }
}

export function clearLDAModel(): void {
  localStorage.removeItem(LDA_STORAGE_KEY);
}

// ============================================================================
// LDA DECODER (Decoder interface for integration with DecoderSelector)
// ============================================================================

/**
 * Create a Decoder object for the LDA classifier.
 * This integrates with the existing decoder system.
 */
export const ldaDecoder: Decoder = {
  id: 'p300-lda',
  name: 'LDA Classifier',
  type: 'javascript',
  description: 'Linear Discriminant Analysis – standard P300 baseline. Requires calibration.',
  architecture: 'LDA (Fisher)',
  code: `
    // LDA decoder - actual classification happens via classifyTrial()
    // This code is a fallback stub; real inference uses the trained LDA model.
    const { flashEvents, eegData } = input;
    if (!flashEvents || flashEvents.length === 0) {
      return { predictedRow: 0, predictedCol: 0, confidence: 0, latency: 0 };
    }
    // Scores computed by the pipeline, not this code block
    return { predictedRow: 0, predictedCol: 0, confidence: 0, latency: 0 };
  `,
};

// ============================================================================
// MATH UTILITIES
// ============================================================================

function computeMean(data: number[][], nFeatures: number): number[] {
  const mean = new Array(nFeatures).fill(0);
  for (const sample of data) {
    for (let j = 0; j < nFeatures; j++) {
      mean[j] += sample[j];
    }
  }
  for (let j = 0; j < nFeatures; j++) {
    mean[j] /= data.length;
  }
  return mean;
}

function computePooledCovariance(
  class0: number[][],
  class1: number[][],
  mean0: number[],
  mean1: number[],
  nFeatures: number
): number[] {
  // Flat covariance matrix (row-major)
  const Sw = new Array(nFeatures * nFeatures).fill(0);

  // Add within-class scatter for each class
  for (const cls of [{ data: class0, mean: mean0 }, { data: class1, mean: mean1 }]) {
    for (const sample of cls.data) {
      for (let i = 0; i < nFeatures; i++) {
        const di = sample[i] - cls.mean[i];
        for (let j = i; j < nFeatures; j++) {
          const dj = sample[j] - cls.mean[j];
          Sw[i * nFeatures + j] += di * dj;
          if (i !== j) Sw[j * nFeatures + i] += di * dj;
        }
      }
    }
  }

  // Normalize by total samples - 2
  const n = class0.length + class1.length - 2;
  if (n > 0) {
    for (let i = 0; i < Sw.length; i++) Sw[i] /= n;
  }

  return Sw;
}

function trace(matrix: number[], n: number): number {
  let t = 0;
  for (let i = 0; i < n; i++) t += matrix[i * n + i];
  return t;
}

function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

/**
 * Solve Ax = b using Cholesky decomposition (since Sw is positive definite).
 * Falls back to regularized pseudo-inverse if Cholesky fails.
 */
function solveLinearSystem(A: number[], b: number[], n: number): number[] {
  // Try Cholesky decomposition: A = L * L^T
  const L = new Array(n * n).fill(0);
  let choleskyOk = true;

  for (let i = 0; i < n && choleskyOk; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i * n + k] * L[j * n + k];
      }
      if (i === j) {
        const val = A[i * n + i] - sum;
        if (val <= 0) {
          choleskyOk = false;
          break;
        }
        L[i * n + j] = Math.sqrt(val);
      } else {
        L[i * n + j] = (A[i * n + j] - sum) / L[j * n + j];
      }
    }
  }

  if (!choleskyOk) {
    // Fallback: simple gradient descent
    console.warn('[LDA] Cholesky failed, using iterative solver');
    return iterativeSolve(A, b, n);
  }

  // Forward substitution: L * y = b
  const y = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < i; j++) sum += L[i * n + j] * y[j];
    y[i] = (b[i] - sum) / L[i * n + i];
  }

  // Back substitution: L^T * x = y
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) sum += L[j * n + i] * x[j];
    x[i] = (y[i] - sum) / L[i * n + i];
  }

  return x;
}

function iterativeSolve(A: number[], b: number[], n: number, iterations: number = 100): number[] {
  const x = new Array(n).fill(0);
  const lr = 0.001;

  for (let iter = 0; iter < iterations; iter++) {
    // Compute Ax
    const Ax = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        Ax[i] += A[i * n + j] * x[j];
      }
    }
    // Gradient: 2 * A^T * (Ax - b)
    for (let i = 0; i < n; i++) {
      let grad = 0;
      for (let j = 0; j < n; j++) {
        grad += A[j * n + i] * (Ax[j] - b[j]);
      }
      x[i] -= lr * grad;
    }
  }

  return x;
}

/**
 * Leave-one-out cross-validation for accuracy estimation.
 */
function leaveOneOutCV(
  features: number[][],
  labels: number[],
  nFeatures: number,
  lambda: number
): number {
  let correct = 0;
  const n = features.length;

  // For efficiency with large datasets, use k-fold instead of LOO
  if (n > 100) {
    return kFoldCV(features, labels, nFeatures, lambda, 10);
  }

  for (let i = 0; i < n; i++) {
    // Split: one out
    const trainFeats = features.filter((_, j) => j !== i);
    const trainLabels = labels.filter((_, j) => j !== i);

    // Train on n-1 samples
    const class0 = trainFeats.filter((_, j) => trainLabels[j] === 0);
    const class1 = trainFeats.filter((_, j) => trainLabels[j] === 1);

    if (class0.length === 0 || class1.length === 0) continue;

    const mean0 = computeMean(class0, nFeatures);
    const mean1 = computeMean(class1, nFeatures);
    const Sw = computePooledCovariance(class0, class1, mean0, mean1, nFeatures);
    for (let k = 0; k < nFeatures; k++) Sw[k * nFeatures + k] += lambda;

    const meanDiff = mean1.map((v, j) => v - mean0[j]);
    const w = solveLinearSystem(Sw, meanDiff, nFeatures);
    const norm = Math.sqrt(w.reduce((s, v) => s + v * v, 0));
    if (norm > 0) for (let k = 0; k < w.length; k++) w[k] /= norm;

    const proj0 = dotProduct(w, mean0);
    const proj1 = dotProduct(w, mean1);
    const threshold = (proj0 + proj1) / 2;

    // Test on held-out sample
    const score = dotProduct(w, features[i]) - threshold;
    const predicted = score > 0 ? 1 : 0;
    if (predicted === labels[i]) correct++;
  }

  return correct / n;
}

function kFoldCV(
  features: number[][],
  labels: number[],
  nFeatures: number,
  lambda: number,
  k: number
): number {
  const n = features.length;
  const foldSize = Math.ceil(n / k);
  let correct = 0;
  let total = 0;

  // Shuffle indices
  const indices = Array.from({ length: n }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  for (let fold = 0; fold < k; fold++) {
    const testStart = fold * foldSize;
    const testEnd = Math.min(testStart + foldSize, n);
    const testIndices = new Set(indices.slice(testStart, testEnd));

    const trainFeats = features.filter((_, i) => !testIndices.has(indices[i]));
    const trainLabels = labels.filter((_, i) => !testIndices.has(indices[i]));

    const class0 = trainFeats.filter((_, j) => trainLabels[j] === 0);
    const class1 = trainFeats.filter((_, j) => trainLabels[j] === 1);

    if (class0.length === 0 || class1.length === 0) continue;

    const mean0 = computeMean(class0, nFeatures);
    const mean1 = computeMean(class1, nFeatures);
    const Sw = computePooledCovariance(class0, class1, mean0, mean1, nFeatures);
    for (let j = 0; j < nFeatures; j++) Sw[j * nFeatures + j] += lambda;

    const meanDiff = mean1.map((v, j) => v - mean0[j]);
    const w = solveLinearSystem(Sw, meanDiff, nFeatures);
    const norm = Math.sqrt(w.reduce((s, v) => s + v * v, 0));
    if (norm > 0) for (let j = 0; j < w.length; j++) w[j] /= norm;

    const proj0 = dotProduct(w, mean0);
    const proj1 = dotProduct(w, mean1);
    const threshold = (proj0 + proj1) / 2;

    for (const idx of testIndices) {
      const score = dotProduct(w, features[idx]) - threshold;
      const predicted = score > 0 ? 1 : 0;
      if (predicted === labels[idx]) correct++;
      total++;
    }
  }

  return total > 0 ? correct / total : 0;
}
