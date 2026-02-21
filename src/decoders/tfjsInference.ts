/**
 * TensorFlow.js P300 Inference Engine
 *
 * Runs binary classification on epoched EEG windows using TFJS models.
 * Each model receives a single EEG epoch (post-stimulus window) and
 * returns P(target | epoch) — a probability between 0 and 1.
 *
 * Uses tf.tidy() to prevent memory leaks from tensor operations.
 */

import * as tf from '@tensorflow/tfjs';
import type { DecoderInput, P300Output } from '../types/decoders';
import type { FlashEvent } from '../components/visualization/SpellerGrid';
import { getModel, DEFAULT_EPOCH_SAMPLES, DEFAULT_CHANNELS, DEFAULT_FEATURE_DIM } from './tfjsModels';
import { extractFeatures } from '../utils/p300Pipeline';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Flatten a [channels, samples] epoch to [channels*samples] for linear/MLP models.
 * Falls back to extractFeatures() which does downsampling if shape doesn't match.
 */
function flattenEpoch(epoch: number[][]): number[] {
  return extractFeatures(epoch);
}

/**
 * Transpose epoch from [channels, samples] → [samples, channels]
 * for Conv1D / LSTM / Attention models.
 */
function transposeEpoch(epoch: number[][]): number[][] {
  const channels = epoch.length;
  const samples = epoch[0]?.length ?? 0;
  const transposed: number[][] = [];
  for (let s = 0; s < samples; s++) {
    const row: number[] = [];
    for (let c = 0; c < channels; c++) {
      row.push(epoch[c][s]);
    }
    transposed.push(row);
  }
  return transposed;
}

/**
 * Classify a single epoch and return P(target).
 */
async function classifySingleEpoch(
  modelType: 'p300-classifier' | 'erp-mlp' | 'erp-cnn' | 'erp-lstm' | 'erp-attention',
  epoch: number[][],
): Promise<number> {
  const model = await getModel(modelType);

  const score = tf.tidy(() => {
    let inputTensor: tf.Tensor;

    if (modelType === 'p300-classifier' || modelType === 'erp-mlp') {
      // Flatten to [1, features]
      const flat = flattenEpoch(epoch);
      inputTensor = tf.tensor2d([flat], [1, flat.length]);
    } else {
      // Transpose to [samples, channels] then wrap in batch → [1, samples, channels]
      const transposed = transposeEpoch(epoch);
      const samples = transposed.length;
      const channels = transposed[0]?.length ?? 0;
      inputTensor = tf.tensor3d([transposed], [1, samples, channels]);
    }

    const prediction = model.predict(inputTensor) as tf.Tensor;
    return prediction.dataSync()[0]; // sigmoid output ∈ [0, 1]
  });

  return score;
}

// ============================================================================
// PUBLIC INFERENCE FUNCTIONS
// ============================================================================

/**
 * Run Linear P300 Classifier inference (logistic regression).
 * Scores a batch of epoched EEG windows and aggregates per row/column.
 */
export async function runLinearP300Classifier(input: DecoderInput): Promise<P300Output> {
  return runP300ModelInference('p300-classifier', input);
}

/**
 * Run MLP P300 Classifier inference.
 */
export async function runMLPP300Classifier(input: DecoderInput): Promise<P300Output> {
  return runP300ModelInference('erp-mlp', input);
}

/**
 * Run CNN-ERP Classifier inference.
 */
export async function runCNNERPClassifier(input: DecoderInput): Promise<P300Output> {
  return runP300ModelInference('erp-cnn', input);
}

/**
 * Run LSTM P300 Classifier inference.
 */
export async function runLSTMP300Classifier(input: DecoderInput): Promise<P300Output> {
  return runP300ModelInference('erp-lstm', input);
}

/**
 * Run Attention-ERP Classifier inference.
 */
export async function runAttentionERPClassifier(input: DecoderInput): Promise<P300Output> {
  return runP300ModelInference('erp-attention', input);
}

// ============================================================================
// CORE INFERENCE PIPELINE
// ============================================================================

/**
 * Unified P300 model inference.
 *
 * Accepts a DecoderInput which should contain:
 *   - eegData: [channels, samples] — raw (or filtered) EEG epoch, OR
 *   - spikes: flattened feature vector (legacy compat)
 *   - flashEvents: sequence of row/col flash events with epochs
 *
 * If a single epoch is provided (eegData only), returns a point-classification.
 * If flashEvents with multiple epochs are provided, aggregates scores across
 * all flashes to determine the predicted row and column.
 */
async function runP300ModelInference(
  modelType: 'p300-classifier' | 'erp-mlp' | 'erp-cnn' | 'erp-lstm' | 'erp-attention',
  input: DecoderInput,
): Promise<P300Output> {
  const startTime = performance.now();

  const flashEvents = input.flashEvents;

  // ---------------------------------------------------------------
  // Case 1: Multiple flash epochs → aggregate across rows & columns
  // ---------------------------------------------------------------
  if (flashEvents && flashEvents.length > 0 && input.eegData) {
    // When flashEvents carry embedded epochs we score each one
    const rowScores = [0, 0, 0, 0, 0, 0];
    const colScores = [0, 0, 0, 0, 0, 0];
    const rowCounts = [0, 0, 0, 0, 0, 0];
    const colCounts = [0, 0, 0, 0, 0, 0];

    // Score each flash event's epoch
    for (const event of flashEvents) {
      // If event carries its own epoch, use it; otherwise fall back to input.eegData
      const epoch: number[][] = (event as FlashEvent & { epoch?: number[][] }).epoch ?? input.eegData;

      const score = await classifySingleEpoch(modelType, epoch);

      if (event.type === 'row') {
        rowScores[event.index] += score;
        rowCounts[event.index]++;
      } else {
        colScores[event.index] += score;
        colCounts[event.index]++;
      }
    }

    // Average scores per row / col
    for (let i = 0; i < 6; i++) {
      if (rowCounts[i] > 0) rowScores[i] /= rowCounts[i];
      if (colCounts[i] > 0) colScores[i] /= colCounts[i];
    }

    const predictedRow = rowScores.indexOf(Math.max(...rowScores));
    const predictedCol = colScores.indexOf(Math.max(...colScores));

    const maxRowScore = Math.max(...rowScores);
    const maxColScore = Math.max(...colScores);
    const confidence = (maxRowScore + maxColScore) / 2;

    const latency = performance.now() - startTime;

    return {
      predictedRow,
      predictedCol,
      confidence,
      rowScores,
      colScores,
      latency,
    };
  }

  // ---------------------------------------------------------------
  // Case 2: Single epoch classification
  // ---------------------------------------------------------------
  const epoch = input.eegData ?? [input.spikes]; // fallback: treat spikes as 1-channel
  const score = await classifySingleEpoch(modelType, epoch);

  const latency = performance.now() - startTime;

  return {
    predictedRow: -1,
    predictedCol: -1,
    confidence: score,
    latency,
  };
}

/**
 * Clear any cached state (call when changing sessions).
 * P300 classifiers are stateless per-epoch, so this is mainly
 * for compatibility with code that calls clearHistory().
 */
export function clearHistory() {
  // P300 classifiers are stateless — no history buffer to clear.
  // This function exists for API compatibility.
}
