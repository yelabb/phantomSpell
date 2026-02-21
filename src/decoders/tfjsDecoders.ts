/**
 * TensorFlow.js P300 Classifier Definitions
 * 
 * These classifiers use real neural networks built in-browser.
 * All models perform binary classification on epoched EEG windows:
 *   Input:  EEG epoch (0–800 ms post-stimulus)
 *   Output: P(target | epoch) ∈ [0, 1]
 *   Loss:   binaryCrossentropy
 * 
 * No model downloads required - models are created programmatically.
 */

import type { Decoder } from '../types/decoders';

/**
 * Linear P300 Classifier (Logistic Regression)
 * Flattened epoched EEG → Dense(1, sigmoid)
 */
export const linearP300Classifier: Decoder = {
  id: 'tfjs-p300-linear',
  name: 'Linear Classifier',
  type: 'tfjs',
  tfjsModelType: 'p300-classifier',
  description: 'Logistic regression on epoched EEG. Fast baseline for P300 detection.',
  architecture: 'Dense(channels×samples → 1) + Sigmoid',
  params: 0, // Depends on channel count and epoch length
};

/**
 * MLP P300 Classifier
 * Non-linear multi-layer classifier for P300 detection
 */
export const mlpP300Classifier: Decoder = {
  id: 'tfjs-p300-mlp',
  name: 'MLP Classifier',
  type: 'tfjs',
  tfjsModelType: 'erp-mlp',
  description: 'Multi-layer perceptron for P300 detection. Better than linear for noisy signals.',
  architecture: 'Dense(128,relu) → BN → Dense(64,relu) → Dense(1,sigmoid)',
  params: 0, // ~260K parameters typically
};

/**
 * CNN-ERP Classifier
 * Convolutional neural network for ERP classification
 * Based on DeepConvNet architecture adapted for P300
 */
export const cnnERPClassifier: Decoder = {
  id: 'tfjs-cnn-erp',
  name: 'CNN-ERP',
  type: 'tfjs',
  tfjsModelType: 'erp-cnn',
  description: 'Convolutional classifier for P300 detection. Learns temporal filter patterns.',
  architecture: 'Conv1D(32) → Conv1D(64) → Conv1D(128) → GAP → Dense(1,sigmoid)',
  params: 0, // ~50K parameters typically
};

/**
 * LSTM P300 Classifier
 * Recurrent neural network captures P300 waveform dynamics
 */
export const lstmP300Classifier: Decoder = {
  id: 'tfjs-lstm-p300',
  name: 'LSTM-P300',
  type: 'tfjs',
  tfjsModelType: 'erp-lstm',
  description: 'LSTM network for temporal P300 features. Good for noisy signals.',
  architecture: 'LSTM(64) → Dense(32,relu) → Dense(1,sigmoid)',
  params: 0, // Depends on input shape
};

/**
 * EEGNet Classifier
 * Compact CNN specifically designed for EEG-based BCI
 * Reference: Lawhern et al. (2018) "EEGNet: A Compact Convolutional Network for EEG-based BCIs"
 */
export const eegnetClassifier: Decoder = {
  id: 'tfjs-eegnet',
  name: 'EEGNet',
  type: 'tfjs',
  tfjsModelType: 'erp-cnn',
  description: 'Compact EEG-specific CNN. State-of-the-art for ERP classification.',
  architecture: 'DepthwiseConv2D → SeparableConv2D → Dense(1,sigmoid)',
  params: 0, // ~2-5K parameters (very compact)
};

/**
 * Attention-based ERP Classifier
 * Uses bidirectional GRU with max-pooling to learn temporal importance
 */
export const attentionERPClassifier: Decoder = {
  id: 'tfjs-attention-erp',
  name: 'Attention-ERP',
  type: 'tfjs',
  tfjsModelType: 'erp-attention',
  description: 'BiGRU with attention pooling. Learns which time-points matter most.',
  architecture: 'Dense(48) → BiGRU(32) → GlobalMaxPool → Dense(64) → Dense(1,sigmoid)',
  params: 0, // ~15-30K parameters
};

/**
 * All TensorFlow.js P300 classifiers
 */
export const tfjsDecoders: Decoder[] = [
  linearP300Classifier,
  mlpP300Classifier,
  cnnERPClassifier,
  lstmP300Classifier,
  eegnetClassifier,
  attentionERPClassifier,
];
