/**
 * Unified Decoder Execution
 *
 * Execution paths:
 * 1. Built-in TFJS (tfjsModelType) → Web Worker inference (P300 binary classification)
 * 2. Custom TFJS code → Web Worker (same as built-in)
 * 3. Simple JS code → Direct execution (baselines)
 *
 * All TFJS models are P300 binary classifiers:
 *   Input:  epoched EEG window
 *   Output: P(target | epoch) ∈ [0, 1]
 *
 * Custom TensorFlow.js code is executed in the Web Worker
 * where the full tf namespace (including tf.train) is available.
 */

import type { DecoderInput, DecoderOutput, P300Output, Decoder } from '../types/decoders';
import { PERFORMANCE_THRESHOLDS } from '../utils/constants';
import { tfWorker, getWorkerModelType } from './tfWorkerManager';
import { extractFeatures } from '../utils/p300Pipeline';

// Cache for compiled JS functions (simple decoders, not TFJS)
type JSDecoderFn = (input: DecoderInput) => { x: number; y: number; vx?: number; vy?: number; confidence?: number } | P300Output;
const jsFunctions = new Map<string, JSDecoderFn>();

// Track which custom TFJS models have been loaded into the worker
const customModelsLoaded = new Set<string>();

/**
 * Check if code is TensorFlow.js model creation code
 */
function isTFJSModelCode(code: string): boolean {
  return code.includes('tf.sequential') || 
         code.includes('tf.model') || 
         code.includes('tf.layers');
}

/**
 * Get or compile a JS decoder function (cached)
 */
function getOrCompileJSDecoder(decoder: Decoder): JSDecoderFn {
  if (!jsFunctions.has(decoder.id)) {
    console.log(`[Decoder] Compiling JS: ${decoder.name}`);
    const fn = new Function('input', decoder.code!) as JSDecoderFn;
    jsFunctions.set(decoder.id, fn);
  }
  return jsFunctions.get(decoder.id)!;
}

/**
 * Clear decoder cache - call when decoder is updated or removed
 */
export function clearDecoderCache(decoderId?: string) {
  if (decoderId) {
    jsFunctions.delete(decoderId);
    // Also dispose from worker if it was a custom TFJS model
    if (customModelsLoaded.has(decoderId)) {
      tfWorker.disposeModel(decoderId);
      customModelsLoaded.delete(decoderId);
    }
  } else {
    jsFunctions.clear();
    // Dispose all custom models from worker
    for (const id of customModelsLoaded) {
      tfWorker.disposeModel(id);
    }
    customModelsLoaded.clear();
  }
}

/**
 * Transpose epoch from [channels, samples] → [samples, channels]
 * for temporal/convolutional models.
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
 * Execute a custom TensorFlow.js model decoder via Web Worker.
 * Returns a P300Output with the classifier score.
 */
async function executeCustomTFJSDecoder(
  decoder: Decoder,
  input: DecoderInput
): Promise<DecoderOutput> {
  const startTime = performance.now();

  // Create model in worker if not already loaded
  if (!customModelsLoaded.has(decoder.id)) {
    await tfWorker.createModelFromCode(decoder.id, decoder.code!);
    customModelsLoaded.add(decoder.id);
  }

  // Prepare input: prefer eegData (epoched), fall back to spikes (flattened)
  let workerInput: number[] | number[][];
  if (input.eegData) {
    workerInput = extractFeatures(input.eegData);
  } else {
    workerInput = [...input.spikes];
  }

  // Run inference via worker
  const output = await tfWorker.infer(decoder.id, workerInput);
  const latency = performance.now() - startTime;

  // output[0] is P(target) from sigmoid
  const confidence = output[0] ?? 0;

  return {
    x: 0,
    y: 0,
    confidence,
    latency,
  };
}

/**
 * Execute a simple JavaScript decoder (baselines + custom JS)
 */
function executeSimpleJSDecoder(
  decoder: Decoder,
  input: DecoderInput
): DecoderOutput {
  const startTime = performance.now();

  const decoderFn = getOrCompileJSDecoder(decoder);
  const result = decoderFn(input);

  const latency = performance.now() - startTime;

  if (latency > PERFORMANCE_THRESHOLDS.DECODER_TIMEOUT_MS) {
    console.warn(`[Decoder] ${decoder.name} exceeded timeout: ${latency.toFixed(2)}ms`);
  }

  return {
    x: 'x' in result ? result.x : 0,
    y: 'y' in result ? result.y : 0,
    vx: 'vx' in result ? result.vx : undefined,
    vy: 'vy' in result ? result.vy : undefined,
    confidence: result.confidence,
    latency,
  };
}

/**
 * Execute a code-based decoder (auto-detects type)
 */
async function executeCodeDecoder(
  decoder: Decoder,
  input: DecoderInput
): Promise<DecoderOutput> {
  // Detect if this is TensorFlow.js model code or simple JS
  if (isTFJSModelCode(decoder.code!)) {
    return executeCustomTFJSDecoder(decoder, input);
  } else {
    return executeSimpleJSDecoder(decoder, input);
  }
}

/**
 * Execute a TensorFlow.js P300 classifier using Web Worker (asynchronous, non-blocking).
 *
 * Routes the EEG epoch to the correct model type and returns a P300 classification score.
 */
export async function executeTFJSDecoder(
  decoder: Decoder,
  input: DecoderInput
): Promise<DecoderOutput> {
  const startTime = performance.now();

  try {
    const workerType = getWorkerModelType(decoder.tfjsModelType);

    if (!workerType) {
      throw new Error(
        `[Decoder] Unknown TFJS model type "${decoder.tfjsModelType}" for decoder "${decoder.name}"`
      );
    }

    // Determine if this is a temporal model (needs [samples, channels] input)
    const isTemporal = workerType === 'erp-cnn' || workerType === 'erp-lstm' || workerType === 'erp-attention';

    // Prepare input based on model architecture
    let workerInput: number[] | number[][];

    if (isTemporal) {
      // Temporal models need [samples, channels] — transpose from [channels, samples]
      if (input.eegData) {
        workerInput = transposeEpoch(input.eegData);
      } else {
        // Fallback: reshape spikes into a pseudo-epoch
        const channels = 8;
        const samplesPerChannel = Math.floor(input.spikes.length / channels);
        const epoch: number[][] = [];
        for (let c = 0; c < channels; c++) {
          epoch.push(input.spikes.slice(c * samplesPerChannel, (c + 1) * samplesPerChannel));
        }
        workerInput = transposeEpoch(epoch);
      }
    } else {
      // Flat models (p300-classifier, erp-mlp): extract flattened features
      if (input.eegData) {
        workerInput = extractFeatures(input.eegData);
      } else {
        workerInput = [...input.spikes];
      }
    }

    // Run inference in worker (off main thread)
    const output = await tfWorker.infer(workerType, workerInput);
    const latency = performance.now() - startTime;

    // output[0] is P(target) from sigmoid ∈ [0, 1]
    const confidence = output[0] ?? 0;

    return {
      x: 0,
      y: 0,
      confidence,
      latency,
    };
  } catch (error) {
    throw new Error(
      `[Decoder] TFJS Worker failed for "${decoder.name}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Execute any decoder — unified routing
 *
 * Execution paths:
 * 1. Has code → Auto-detect: TFJS model code or simple JS
 * 2. Has tfjsModelType → Web Worker inference (P300 binary classification)
 *
 * THROWS on invalid decoder configuration — never silently corrupts data
 */
export async function executeDecoder(
  decoder: Decoder,
  input: DecoderInput
): Promise<DecoderOutput> {
  // Code-based decoders (custom + baselines)
  // Auto-detects if code creates a TF model or is simple JS
  if (decoder.code) {
    return executeCodeDecoder(decoder, input);
  }

  // Built-in TFJS decoders (Web Worker, non-blocking)
  if (decoder.tfjsModelType) {
    return executeTFJSDecoder(decoder, input);
  }

  // Invalid decoder configuration — fail hard, never silently corrupt data
  throw new Error(
    `[Decoder] Invalid decoder configuration for "${decoder.name}" (id: ${decoder.id}). ` +
    `Decoder must have either 'code' (JavaScript/TFJS) or 'tfjsModelType' (built-in TFJS).`
  );
}
