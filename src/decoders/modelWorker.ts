/**
 * Web Worker for TensorFlow.js P300 Classifiers
 *
 * Offloads heavy model compilation and inference to a separate thread,
 * keeping the main UI thread responsive.
 *
 * All built-in models are binary P300 classifiers:
 *   Input:  epoched EEG window
 *   Output: P(target | epoch) ∈ [0, 1]
 *   Loss:   binaryCrossentropy
 */

import * as tf from '@tensorflow/tfjs';

// ============================================================================
// CONSTANTS (must match tfjsModels.ts)
// ============================================================================

const DEFAULT_CHANNELS = 8;
const DEFAULT_SAMPLE_RATE = 250;
const DEFAULT_EPOCH_MS = 800;
const DEFAULT_PRE_STIM_MS = 200;
const DEFAULT_EPOCH_SAMPLES = Math.round(
  ((DEFAULT_PRE_STIM_MS + DEFAULT_EPOCH_MS) / 1000) * DEFAULT_SAMPLE_RATE
); // 250
const DEFAULT_FEATURE_DIM = DEFAULT_CHANNELS * DEFAULT_EPOCH_SAMPLES; // 2000

// Weight initialization seeds for reproducibility
const WEIGHT_SEEDS: Record<string, number> = {
  'p300-classifier': 42,
  'erp-mlp': 123,
  'erp-lstm': 456,
  'erp-cnn': 789,
  'erp-attention': 101,
};

// Store created models
const models = new Map<string, tf.LayersModel>();

// ============================================================================
// BACKEND
// ============================================================================

async function initBackend(): Promise<string> {
  try {
    await tf.setBackend('webgl');
    await tf.ready();
    return tf.getBackend() || 'cpu';
  } catch {
    await tf.setBackend('cpu');
    await tf.ready();
    return 'cpu';
  }
}

// ============================================================================
// MODEL CREATION — P300 Binary Classifiers
// ============================================================================

async function createModel(type: string): Promise<{ success: boolean; params?: number; error?: string }> {
  try {
    let model: tf.LayersModel;

    switch (type) {
      // ------------------------------------------------------------------
      // Linear P300 Classifier (logistic regression)
      // Input:  [batch, features]  →  Output: [batch, 1]
      // ------------------------------------------------------------------
      case 'p300-classifier':
        model = tf.sequential({
          name: 'P300_Linear',
          layers: [
            tf.layers.dense({
              inputShape: [DEFAULT_FEATURE_DIM],
              units: 1,
              activation: 'sigmoid',
              kernelInitializer: tf.initializers.glorotNormal({ seed: WEIGHT_SEEDS['p300-classifier'] }),
              name: 'output',
            }),
          ],
        });
        break;

      // ------------------------------------------------------------------
      // MLP P300 Classifier
      // Input:  [batch, features]  →  Output: [batch, 1]
      // ------------------------------------------------------------------
      case 'erp-mlp':
        model = tf.sequential({
          name: 'P300_MLP',
          layers: [
            tf.layers.dense({
              inputShape: [DEFAULT_FEATURE_DIM],
              units: 128,
              activation: 'relu',
              kernelInitializer: tf.initializers.heNormal({ seed: WEIGHT_SEEDS['erp-mlp'] }),
              name: 'hidden1',
            }),
            tf.layers.batchNormalization({ name: 'bn1' }),
            tf.layers.dropout({ rate: 0.3 }),
            tf.layers.dense({
              units: 64,
              activation: 'relu',
              kernelInitializer: tf.initializers.heNormal({ seed: WEIGHT_SEEDS['erp-mlp'] + 1 }),
              name: 'hidden2',
            }),
            tf.layers.dropout({ rate: 0.2 }),
            tf.layers.dense({
              units: 1,
              activation: 'sigmoid',
              name: 'output',
            }),
          ],
        });
        break;

      // ------------------------------------------------------------------
      // CNN-ERP Classifier (1D convolutions over time)
      // Input:  [batch, epoch_samples, channels]  →  Output: [batch, 1]
      // ------------------------------------------------------------------
      case 'erp-cnn':
        model = tf.sequential({
          name: 'P300_CNN',
          layers: [
            tf.layers.conv1d({
              inputShape: [DEFAULT_EPOCH_SAMPLES, DEFAULT_CHANNELS],
              filters: 32,
              kernelSize: 25,
              activation: 'relu',
              padding: 'same',
              kernelInitializer: tf.initializers.heNormal({ seed: WEIGHT_SEEDS['erp-cnn'] }),
              name: 'conv1',
            }),
            tf.layers.batchNormalization({ name: 'bn1' }),
            tf.layers.maxPooling1d({ poolSize: 2, name: 'pool1' }),
            tf.layers.dropout({ rate: 0.25 }),
            tf.layers.conv1d({
              filters: 64,
              kernelSize: 13,
              activation: 'relu',
              padding: 'same',
              kernelInitializer: tf.initializers.heNormal({ seed: WEIGHT_SEEDS['erp-cnn'] + 1 }),
              name: 'conv2',
            }),
            tf.layers.batchNormalization({ name: 'bn2' }),
            tf.layers.maxPooling1d({ poolSize: 2, name: 'pool2' }),
            tf.layers.dropout({ rate: 0.25 }),
            tf.layers.conv1d({
              filters: 128,
              kernelSize: 7,
              activation: 'relu',
              padding: 'same',
              kernelInitializer: tf.initializers.heNormal({ seed: WEIGHT_SEEDS['erp-cnn'] + 2 }),
              name: 'conv3',
            }),
            tf.layers.batchNormalization({ name: 'bn3' }),
            tf.layers.globalAveragePooling1d({ name: 'gap' }),
            tf.layers.dense({ units: 64, activation: 'relu', name: 'fc1' }),
            tf.layers.dropout({ rate: 0.3 }),
            tf.layers.dense({ units: 1, activation: 'sigmoid', name: 'output' }),
          ],
        });
        break;

      // ------------------------------------------------------------------
      // LSTM P300 Classifier
      // Input:  [batch, epoch_samples, channels]  →  Output: [batch, 1]
      // ------------------------------------------------------------------
      case 'erp-lstm':
        model = tf.sequential({
          name: 'P300_LSTM',
          layers: [
            tf.layers.lstm({
              inputShape: [DEFAULT_EPOCH_SAMPLES, DEFAULT_CHANNELS],
              units: 64,
              returnSequences: false,
              kernelInitializer: tf.initializers.glorotNormal({ seed: WEIGHT_SEEDS['erp-lstm'] }),
              recurrentInitializer: tf.initializers.orthogonal({ seed: WEIGHT_SEEDS['erp-lstm'] }),
              name: 'lstm',
            }),
            tf.layers.dropout({ rate: 0.3 }),
            tf.layers.dense({ units: 32, activation: 'relu', name: 'dense1' }),
            tf.layers.dropout({ rate: 0.2 }),
            tf.layers.dense({ units: 1, activation: 'sigmoid', name: 'output' }),
          ],
        });
        break;

      // ------------------------------------------------------------------
      // Attention-ERP Classifier (BiGRU + MaxPool)
      // Input:  [batch, epoch_samples, channels]  →  Output: [batch, 1]
      // ------------------------------------------------------------------
      case 'erp-attention':
        model = tf.sequential({
          name: 'P300_Attention',
          layers: [
            tf.layers.dense({
              inputShape: [DEFAULT_EPOCH_SAMPLES, DEFAULT_CHANNELS],
              units: 48,
              activation: 'relu',
              name: 'projection',
            }),
            tf.layers.bidirectional({
              layer: tf.layers.gru({
                units: 32,
                returnSequences: true,
                kernelInitializer: tf.initializers.glorotNormal({ seed: WEIGHT_SEEDS['erp-attention'] }),
              }) as tf.RNN,
              mergeMode: 'concat',
              name: 'bigru',
            }),
            tf.layers.globalMaxPooling1d({ name: 'pool' }),
            tf.layers.dense({ units: 64, activation: 'relu', name: 'fc1' }),
            tf.layers.dropout({ rate: 0.3 }),
            tf.layers.dense({ units: 1, activation: 'sigmoid', name: 'output' }),
          ],
        });
        break;

      default:
        return { success: false, error: `Unknown model type: ${type}` };
    }

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy'],
    });

    const params = model.countParams();
    models.set(type, model);

    return { success: true, params };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ============================================================================
// REMOTE / CUSTOM MODEL LOADING
// ============================================================================

async function loadModelFromUrl(id: string, url: string): Promise<{ success: boolean; params?: number; inputShape?: number[]; error?: string }> {
  try {
    console.log(`[Worker] Loading model from: ${url}`);
    const model = await tf.loadLayersModel(url);

    // Compile for P300 binary classification by default
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy'],
    });

    const params = model.countParams();
    const inputShape = model.inputs[0].shape.slice(1).map(d => d || 0);
    models.set(id, model);

    console.log(`[Worker] ✓ Loaded model: ${id} (${params.toLocaleString()} params)`);
    return { success: true, params, inputShape };
  } catch (error) {
    console.error(`[Worker] Failed to load model from ${url}:`, error);
    return { success: false, error: String(error) };
  }
}

async function createModelFromCode(id: string, code: string): Promise<{ success: boolean; params?: number; inputShape?: number[]; error?: string }> {
  try {
    console.log(`[Worker] Creating model from code: ${id}`);

    const createModelFn = new Function('tf', code) as (tf: typeof import('@tensorflow/tfjs')) => tf.LayersModel | Promise<tf.LayersModel>;
    const model = await Promise.resolve(createModelFn(tf));

    if (!model || typeof model.predict !== 'function') {
      throw new Error('Code must return a TensorFlow.js model with predict() method');
    }

    // Compile for binary classification if not already compiled
    if (!model.optimizer) {
      model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy'],
      });
    }

    const params = model.countParams();
    const inputShape = model.inputs[0]?.shape.slice(1).map(d => d || 0) || [];
    models.set(id, model);

    console.log(`[Worker] ✓ Created model from code: ${id} (${params.toLocaleString()} params)`);
    return { success: true, params, inputShape };
  } catch (error) {
    console.error(`[Worker] Failed to create model from code:`, error);
    return { success: false, error: String(error) };
  }
}

// ============================================================================
// INFERENCE
// ============================================================================

/**
 * Run inference on a model.
 *
 * For flat models (p300-classifier, erp-mlp):
 *   input = number[]  (flattened features)
 *   output = [P(target)]
 *
 * For temporal models (erp-cnn, erp-lstm, erp-attention):
 *   input = number[][]  ([samples, channels])
 *   output = [P(target)]
 */
function runInference(type: string, input: number[] | number[][]): { success: boolean; output?: number[]; error?: string } {
  const model = models.get(type);
  if (!model) {
    return { success: false, error: `Model ${type} not loaded` };
  }

  try {
    const result = tf.tidy(() => {
      let tensor: tf.Tensor;

      if (type === 'erp-cnn' || type === 'erp-lstm' || type === 'erp-attention') {
        // Temporal models: [batch, samples, channels]
        const data2d = input as number[][];
        const samples = data2d.length;
        const channels = data2d[0]?.length ?? DEFAULT_CHANNELS;
        tensor = tf.tensor3d([data2d], [1, samples, channels]);
      } else {
        // Flat models: [batch, features]
        const data1d = input as number[];
        tensor = tf.tensor2d([data1d], [1, data1d.length]);
      }

      const prediction = model.predict(tensor) as tf.Tensor;
      return Array.from(prediction.dataSync());
    });

    return { success: true, output: result };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ============================================================================
// MESSAGE HANDLER
// ============================================================================

self.onmessage = async (event: MessageEvent) => {
  const { id, action, payload } = event.data;

  switch (action) {
    case 'init': {
      const backend = await initBackend();
      self.postMessage({ id, action: 'init', result: { backend } });
      break;
    }

    case 'create': {
      const createResult = await createModel(payload.type);
      self.postMessage({ id, action: 'create', result: createResult });
      break;
    }

    case 'load': {
      const loadResult = await loadModelFromUrl(payload.id, payload.url);
      self.postMessage({ id, action: 'load', result: loadResult });
      break;
    }

    case 'createFromCode': {
      const codeResult = await createModelFromCode(payload.id, payload.code);
      self.postMessage({ id, action: 'createFromCode', result: codeResult });
      break;
    }

    case 'infer': {
      const inferResult = runInference(payload.type, payload.input);
      self.postMessage({ id, action: 'infer', result: inferResult });
      break;
    }

    case 'dispose': {
      const model = models.get(payload.type);
      if (model) {
        model.dispose();
        models.delete(payload.type);
      }
      self.postMessage({ id, action: 'dispose', result: { success: true } });
      break;
    }

    default:
      self.postMessage({ id, action, result: { error: `Unknown action: ${action}` } });
  }
};

// Signal that worker is ready
self.postMessage({ action: 'ready' });
