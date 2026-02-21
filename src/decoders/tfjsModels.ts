/**
 * TensorFlow.js P300 Model Factory
 * 
 * Creates binary ERP classifiers programmatically in the browser.
 * All models perform binary classification (Target vs Non-Target)
 * on epoched EEG windows (0–800 ms post-stimulus).
 * 
 * Input shape: [channels × samples] flattened, or [samples, channels] for
 * temporal/convolutional models. Default epoch = 8 channels × 200 samples
 * (800 ms at 250 Hz) = 1600 features for the linear model.
 *
 * Output: single sigmoid unit → P(target | epoch)
 * Loss: binaryCrossentropy
 *
 * For production, models can be:
 * 1. Created here with random weights and fine-tuned with user data
 * 2. Loaded from a remote URL (CDN, cloud storage)
 * 3. Fine-tuned in the browser with calibration data
 */

import * as tf from '@tensorflow/tfjs';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default number of EEG channels (8-channel cap) */
export const DEFAULT_CHANNELS = 8;

/** Default sampling rate (Hz) */
export const DEFAULT_SAMPLE_RATE = 250;

/** Default epoch duration in ms (post-stimulus window) */
export const DEFAULT_EPOCH_MS = 800;

/** Default pre-stimulus baseline in ms */
export const DEFAULT_PRE_STIM_MS = 200;

/** Total epoch samples = (pre + post) / 1000 * sampleRate */
export const DEFAULT_EPOCH_SAMPLES = Math.round(
  ((DEFAULT_PRE_STIM_MS + DEFAULT_EPOCH_MS) / 1000) * DEFAULT_SAMPLE_RATE
); // 250

/** Flattened feature length for linear/MLP models: channels × epoch_samples */
export const DEFAULT_FEATURE_DIM = DEFAULT_CHANNELS * DEFAULT_EPOCH_SAMPLES; // 2000

// Model cache to avoid recreating models
const modelCache = new Map<string, tf.LayersModel>();

// Weight initialization seeds for reproducibility
const WEIGHT_SEEDS: Record<string, number> = {
  'p300-classifier': 42,
  'erp-mlp': 123,
  'erp-lstm': 456,
  'erp-cnn': 789,
  'erp-attention': 101,
};

// ============================================================================
// MODEL FACTORIES — P300 Binary Classifiers
// ============================================================================

/**
 * Create a Linear P300 Classifier (Logistic Regression)
 * 
 * Architecture: epoch[channels*samples] → Dense(1, sigmoid)
 * Equivalent to logistic regression on the flattened EEG epoch.
 * This is the standard baseline for P300 BCI — fast and interpretable.
 *
 * Input:  [batch, channels × samples]  (flattened epoch)
 * Output: [batch, 1]  → P(target)
 */
export async function createLinearP300Classifier(
  featureDim: number = DEFAULT_FEATURE_DIM
): Promise<tf.LayersModel> {
  const cacheKey = 'p300-classifier';
  if (modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey)!;
  }

  console.log('[TFJS] Creating Linear P300 Classifier (logistic regression)...');

  const model = tf.sequential({
    name: 'P300_Linear',
    layers: [
      tf.layers.dense({
        inputShape: [featureDim],
        units: 1,
        activation: 'sigmoid',
        kernelInitializer: tf.initializers.glorotNormal({ seed: WEIGHT_SEEDS['p300-classifier'] }),
        name: 'output',
      }),
    ],
  });

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy'],
  });

  modelCache.set(cacheKey, model);
  console.log(`[TFJS] ✓ Linear P300 Classifier created (input: ${featureDim} features)`);
  return model;
}

/**
 * Create an MLP P300 Classifier
 * 
 * Architecture: epoch[features] → Dense(128,relu) → Dense(64,relu) → Dense(1,sigmoid)
 * Non-linear classifier that can learn complex ERP feature interactions.
 *
 * Input:  [batch, channels × samples]
 * Output: [batch, 1] → P(target)
 */
export async function createMLPP300Classifier(
  featureDim: number = DEFAULT_FEATURE_DIM
): Promise<tf.LayersModel> {
  const cacheKey = 'erp-mlp';
  if (modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey)!;
  }

  console.log('[TFJS] Creating MLP P300 Classifier...');

  const model = tf.sequential({
    name: 'P300_MLP',
    layers: [
      tf.layers.dense({
        inputShape: [featureDim],
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

  model.compile({
    optimizer: tf.train.adam(0.0005),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy'],
  });

  modelCache.set(cacheKey, model);
  console.log('[TFJS] ✓ MLP P300 Classifier created');
  return model;
}

/**
 * Create a CNN-ERP Classifier (1D Convolutions over time)
 *
 * Architecture:
 *   epoch[samples, channels] → Conv1D(32) → Conv1D(64) → Conv1D(128)
 *   → GlobalAvgPool → Dense(64) → Dense(1, sigmoid)
 *
 * Learns temporal filter kernels (like matched filters for P300 waveform).
 * Based on DeepConvNet / ShallowConvNet adapted for single-epoch P300.
 *
 * Input:  [batch, epoch_samples, channels]  (2-D time-series)
 * Output: [batch, 1] → P(target)
 */
export async function createCNNERPClassifier(
  epochSamples: number = DEFAULT_EPOCH_SAMPLES,
  channels: number = DEFAULT_CHANNELS
): Promise<tf.LayersModel> {
  const cacheKey = 'erp-cnn';
  if (modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey)!;
  }

  console.log('[TFJS] Creating CNN-ERP Classifier...');

  const model = tf.sequential({
    name: 'P300_CNN',
    layers: [
      // Temporal convolution block 1
      tf.layers.conv1d({
        inputShape: [epochSamples, channels],
        filters: 32,
        kernelSize: 25, // 100 ms at 250 Hz — captures P300 rise
        activation: 'relu',
        padding: 'same',
        kernelInitializer: tf.initializers.heNormal({ seed: WEIGHT_SEEDS['erp-cnn'] }),
        name: 'conv1',
      }),
      tf.layers.batchNormalization({ name: 'bn1' }),
      tf.layers.maxPooling1d({ poolSize: 2, name: 'pool1' }),
      tf.layers.dropout({ rate: 0.25 }),

      // Temporal convolution block 2
      tf.layers.conv1d({
        filters: 64,
        kernelSize: 13, // ~50 ms
        activation: 'relu',
        padding: 'same',
        kernelInitializer: tf.initializers.heNormal({ seed: WEIGHT_SEEDS['erp-cnn'] + 1 }),
        name: 'conv2',
      }),
      tf.layers.batchNormalization({ name: 'bn2' }),
      tf.layers.maxPooling1d({ poolSize: 2, name: 'pool2' }),
      tf.layers.dropout({ rate: 0.25 }),

      // Temporal convolution block 3
      tf.layers.conv1d({
        filters: 128,
        kernelSize: 7,
        activation: 'relu',
        padding: 'same',
        kernelInitializer: tf.initializers.heNormal({ seed: WEIGHT_SEEDS['erp-cnn'] + 2 }),
        name: 'conv3',
      }),
      tf.layers.batchNormalization({ name: 'bn3' }),

      // Global pooling → fixed-size representation
      tf.layers.globalAveragePooling1d({ name: 'gap' }),

      // Classification head
      tf.layers.dense({
        units: 64,
        activation: 'relu',
        name: 'fc1',
      }),
      tf.layers.dropout({ rate: 0.3 }),
      tf.layers.dense({
        units: 1,
        activation: 'sigmoid',
        name: 'output',
      }),
    ],
  });

  model.compile({
    optimizer: tf.train.adam(0.0005),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy'],
  });

  modelCache.set(cacheKey, model);
  console.log('[TFJS] ✓ CNN-ERP Classifier created');
  return model;
}

/**
 * Create an LSTM P300 Classifier
 *
 * Architecture: epoch[samples, channels] → LSTM(64) → Dense(32) → Dense(1, sigmoid)
 * Captures temporal dynamics of the P300 waveform using recurrent processing.
 *
 * Input:  [batch, epoch_samples, channels]
 * Output: [batch, 1] → P(target)
 */
export async function createLSTMP300Classifier(
  epochSamples: number = DEFAULT_EPOCH_SAMPLES,
  channels: number = DEFAULT_CHANNELS
): Promise<tf.LayersModel> {
  const cacheKey = 'erp-lstm';
  if (modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey)!;
  }

  console.log('[TFJS] Creating LSTM P300 Classifier...');

  const model = tf.sequential({
    name: 'P300_LSTM',
    layers: [
      tf.layers.lstm({
        inputShape: [epochSamples, channels],
        units: 64,
        returnSequences: false,
        kernelInitializer: tf.initializers.glorotNormal({ seed: WEIGHT_SEEDS['erp-lstm'] }),
        recurrentInitializer: tf.initializers.orthogonal({ seed: WEIGHT_SEEDS['erp-lstm'] }),
        name: 'lstm',
      }),
      tf.layers.dropout({ rate: 0.3 }),
      tf.layers.dense({
        units: 32,
        activation: 'relu',
        name: 'dense1',
      }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({
        units: 1,
        activation: 'sigmoid',
        name: 'output',
      }),
    ],
  });

  model.compile({
    optimizer: tf.train.adam(0.0005),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy'],
  });

  modelCache.set(cacheKey, model);
  console.log('[TFJS] ✓ LSTM P300 Classifier created');
  return model;
}

/**
 * Create an Attention-based ERP Classifier (BiGRU + Attention Pooling)
 *
 * Architecture:
 *   epoch[samples, channels] → Dense(48, relu)
 *   → BiGRU(32) → GlobalMaxPool → Dense(64, relu) → Dense(1, sigmoid)
 *
 * The bidirectional GRU captures forward and backward temporal context.
 * GlobalMaxPooling acts as a simple attention mechanism, selecting the
 * strongest activations across the temporal dimension.
 *
 * Input:  [batch, epoch_samples, channels]
 * Output: [batch, 1] → P(target)
 */
export async function createAttentionERPClassifier(
  epochSamples: number = DEFAULT_EPOCH_SAMPLES,
  channels: number = DEFAULT_CHANNELS
): Promise<tf.LayersModel> {
  const cacheKey = 'erp-attention';
  if (modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey)!;
  }

  console.log('[TFJS] Creating Attention-ERP Classifier (BiGRU + Pool)...');

  const model = tf.sequential({
    name: 'P300_Attention',
    layers: [
      // Channel projection to reduce dimensionality
      tf.layers.dense({
        inputShape: [epochSamples, channels],
        units: 48,
        activation: 'relu',
        name: 'projection',
      }),
      // Bidirectional GRU for temporal context
      tf.layers.bidirectional({
        layer: tf.layers.gru({
          units: 32,
          returnSequences: true,
          kernelInitializer: tf.initializers.glorotNormal({ seed: WEIGHT_SEEDS['erp-attention'] }),
        }) as tf.RNN,
        mergeMode: 'concat',
        name: 'bigru',
      }),
      // Global max pooling (attention-like — focuses on strongest temporal activations)
      tf.layers.globalMaxPooling1d({
        name: 'pool',
      }),
      // Classification head
      tf.layers.dense({
        units: 64,
        activation: 'relu',
        name: 'fc1',
      }),
      tf.layers.dropout({ rate: 0.3 }),
      tf.layers.dense({
        units: 1,
        activation: 'sigmoid',
        name: 'output',
      }),
    ],
  });

  model.compile({
    optimizer: tf.train.adam(0.0005),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy'],
  });

  modelCache.set(cacheKey, model);
  console.log('[TFJS] ✓ Attention-ERP Classifier created');
  return model;
}

// ============================================================================
// MODEL ACCESS
// ============================================================================

/**
 * Load a pre-trained model from a remote URL
 * Supports CDN or any CORS-enabled endpoint
 */
export async function loadRemoteModel(url: string, cacheKey: string): Promise<tf.LayersModel> {
  if (modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey)!;
  }

  console.log(`[TFJS] Loading model from: ${url}`);

  try {
    const model = await tf.loadLayersModel(url);
    modelCache.set(cacheKey, model);
    console.log(`[TFJS] ✓ Model loaded: ${cacheKey}`);
    return model;
  } catch (error) {
    console.error(`[TFJS] Failed to load model from ${url}:`, error);
    throw error;
  }
}

/**
 * Get a P300 model by type, creating if necessary.
 * 
 * Type mapping:
 *   'p300-classifier' → Linear (logistic regression)
 *   'erp-mlp'         → MLP classifier
 *   'erp-cnn'         → CNN-ERP classifier
 *   'erp-lstm'        → LSTM classifier
 *   'erp-attention'   → Attention (BiGRU) classifier
 */
export async function getModel(
  type: 'p300-classifier' | 'erp-mlp' | 'erp-cnn' | 'erp-lstm' | 'erp-attention'
): Promise<tf.LayersModel> {
  switch (type) {
    case 'p300-classifier':
      return createLinearP300Classifier();
    case 'erp-mlp':
      return createMLPP300Classifier();
    case 'erp-cnn':
      return createCNNERPClassifier();
    case 'erp-lstm':
      return createLSTMP300Classifier();
    case 'erp-attention':
      return createAttentionERPClassifier();
    default:
      throw new Error(`Unknown P300 model type: ${type}`);
  }
}

/**
 * Clear model cache and free memory
 */
export function clearModelCache() {
  for (const model of modelCache.values()) {
    model.dispose();
  }
  modelCache.clear();
  console.log('[TFJS] Model cache cleared');
}

/**
 * Get model info for display
 */
export function getModelInfo(model: tf.LayersModel) {
  return {
    name: model.name,
    layers: model.layers.length,
    params: model.countParams(),
    inputShape: model.inputs[0].shape,
    outputShape: model.outputs[0].shape,
  };
}
