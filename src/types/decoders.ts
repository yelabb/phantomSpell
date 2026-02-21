// Decoder types for BCI algorithm integration

import type { ElectrodeConfiguration, SpatialFeatures } from './electrodes';
import type { FlashEvent } from '../components/visualization/SpellerGrid';

export type DecoderType = 'javascript' | 'tfjs' | 'wasm';

export type TFJSModelType = 'linear' | 'mlp' | 'lstm' | 'attention' | 'kalman-neural' | 'p300-classifier' | 'erp-cnn';

// Decoder task type
export type DecoderTask = 'motor-decoding' | 'p300-speller' | 'ssvep' | 'motor-imagery';

/**
 * Decoder source - where the model comes from
 */
export type DecoderSource = 
  | { type: 'builtin'; modelType: TFJSModelType }  // Built programmatically
  | { type: 'url'; url: string }                    // Load from remote URL
  | { type: 'local'; path: string }                 // Load from /models/ folder
  | { type: 'custom'; execute: DecoderFunction };   // User-provided function

/**
 * Custom decoder function signature
 * Takes spike data, returns velocity prediction (motor) or P300 classification
 */
export type DecoderFunction = (
  input: DecoderInput
) => DecoderOutput | P300Output | Promise<DecoderOutput | P300Output>;

export interface Decoder {
  id: string;
  name: string;
  type: DecoderType;
  description?: string;
  
  // Source configuration (new flexible system)
  source?: DecoderSource;
  
  // For JavaScript decoders (legacy, use source.type='custom' instead)
  code?: string;
  
  // For TensorFlow.js decoders (legacy, use source instead)
  modelUrl?: string; // Remote URL (optional - models can be created in-browser)
  tfjsModelType?: TFJSModelType; // Built-in model type
  
  // Architecture info for display
  architecture?: string;
  params?: number;
  
  // Input/output shape (for validation)
  inputShape?: number[];
  outputShape?: number[];
  
  // Performance metrics
  avgLatency?: number;
  lastLatency?: number;
}

export interface DecoderOutput {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  confidence?: number;
  latency: number;
}

export interface DecoderInput {
  spikes: number[];
  kinematics: {
    x: number;
    y: number;
    vx: number;
    vy: number;
  };
  history?: DecoderOutput[];
  
  // Electrode-aware features (optional)
  electrodeConfig?: ElectrodeConfiguration;
  spatialFeatures?: SpatialFeatures;
  channelMask?: boolean[]; // Active/inactive channels
  
  // P300 speller specific input
  eegData?: number[][];        // [channels, samples] - raw EEG epochs
  flashEvents?: FlashEvent[];  // Flash event sequence for training/decoding
  sampleRate?: number;         // Sampling rate in Hz
}

// ============================================================================
// P300 SPELLER OUTPUTS
// ============================================================================

/**
 * P300 decoder output - classifies which row/col contains target
 */
export interface P300Output {
  predictedRow: number;        // 0-5 for 6x6 grid
  predictedCol: number;        // 0-5 for 6x6 grid
  confidence: number;          // 0-1 overall confidence
  rowScores?: number[];        // Scores for each row
  colScores?: number[];        // Scores for each column
  latency: number;             // Processing time (ms)
  timestamp?: number;          // When prediction was made
}

/**
 * P300 training data point
 */
export interface P300TrainingData {
  eegEpoch: number[][];        // [channels, samples] centered on flash
  label: 0 | 1;                // 0 = non-target, 1 = target
  flashType: 'row' | 'col';
  flashIndex: number;
  targetPosition?: { row: number; col: number };
  timestamp: number;
}

/**
 * P300 model configuration
 */
export interface P300ModelConfig {
  channels: number;            // Number of EEG channels
  sampleRate: number;          // Sampling rate (Hz)
  epochDuration: number;       // Epoch length in ms (typically 600-800ms)
  preStimulus: number;         // Pre-stimulus baseline (ms)
  filterLowcut?: number;       // Bandpass low cutoff (Hz)
  filterHighcut?: number;      // Bandpass high cutoff (Hz)
  spatialFiltering?: 'none' | 'car' | 'laplacian'; // Spatial filter type
}
