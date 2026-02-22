/**
 * useP300Pipeline Hook
 * 
 * Wires together:
 * 1. EEG stream (from UnifiedStreamSlice) → EEGRingBuffer
 * 2. Flash events (from SpellerGrid) → MarkerManager
 * 3. Epoch extraction → preprocessed epochs
 * 4. LDA classifier → P300Output → store
 * 5. Training data collection during calibration
 * 
 * This is the core hook that makes the P300 pipeline actually work.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';
import {
  MarkerManager,
  EEGRingBuffer,
  epochsToTrainingData,
  DEFAULT_P300_CONFIG,
} from '../utils/p300Pipeline';
import type { P300ModelConfig } from '../types/decoders';
import { classifyTrial, trainLDA, loadLDAModel, clearLDAModel } from '../decoders/ldaClassifier';
import type { LDAModel } from '../decoders/ldaClassifier';
import type { FlashEvent } from '../components/visualization/SpellerGrid';

interface UseP300PipelineOptions {
  /** P300 pipeline configuration (defaults to DEFAULT_P300_CONFIG) */
  config?: Partial<P300ModelConfig>;
  /** Whether the pipeline is active (false = paused) */
  enabled?: boolean;
}

export function useP300Pipeline(options: UseP300PipelineOptions = {}) {
  const config: P300ModelConfig = { ...DEFAULT_P300_CONFIG, ...options.config };
  const enabled = options.enabled ?? true;

  // Store connections
  const currentStreamSample = useStore((state) => state.currentStreamSample);
  const activeStreamConfig = useStore((state) => state.activeStreamConfig);
  const updateP300Output = useStore((state) => state.updateP300Output);
  const addTrainingData = useStore((state) => state.addTrainingData);
  const p300TrainingData = useStore((state) => state.p300TrainingData);
  const setTrainingStatus = useStore((state) => state.setTrainingStatus);

  // Internal refs
  const markerManagerRef = useRef<MarkerManager>(new MarkerManager(config.sampleRate));
  const eegBufferRef = useRef<EEGRingBuffer>(
    new EEGRingBuffer(config.channels, 30, config.sampleRate) // 30-second buffer
  );
  const ldaModelRef = useRef<LDAModel | null>(null);
  const streamOriginSetRef = useRef(false);
  const isClassifyingRef = useRef(false);

  // Load saved LDA model on mount
  useEffect(() => {
    const saved = loadLDAModel();
    if (saved) {
      ldaModelRef.current = saved;
      console.log(`[P300Pipeline] Loaded saved LDA model (accuracy: ${(saved.trainingAccuracy * 100).toFixed(1)}%)`);
    }
  }, []);

  // Update config when stream metadata changes
  useEffect(() => {
    if (activeStreamConfig) {
      const newRate = activeStreamConfig.samplingRate || config.sampleRate;
      const newChannels = activeStreamConfig.channelCount || config.channels;

      if (newRate !== config.sampleRate || newChannels !== config.channels) {
        console.log(`[P300Pipeline] Updating config: ${newChannels}ch @ ${newRate}Hz`);
        markerManagerRef.current.setSampleRate(newRate);
        eegBufferRef.current = new EEGRingBuffer(newChannels, 30, newRate);
        streamOriginSetRef.current = false;
      }
    }
  }, [activeStreamConfig, config.sampleRate, config.channels]);

  // Feed EEG samples into ring buffer
  useEffect(() => {
    if (!enabled || !currentStreamSample) return;

    const sample = currentStreamSample;
    const channels = sample.channels;

    // Set stream origin on first sample (align clocks)
    if (!streamOriginSetRef.current && channels.length > 0) {
      markerManagerRef.current.setStreamOrigin(performance.now(), 0);
      streamOriginSetRef.current = true;
      console.log('[P300Pipeline] Stream origin set (clock alignment established)');
    }

    // Push sample into ring buffer
    eegBufferRef.current.push(channels);
  }, [currentStreamSample, enabled]);

  /**
   * Record a flash event marker (called by SpellerGrid via rAF timestamp).
   */
  const recordFlashMarker = useCallback((flashEvent: FlashEvent, frameTimestamp?: number) => {
    markerManagerRef.current.addMarker(flashEvent, frameTimestamp);
  }, []);

  /**
   * Process a completed trial: extract epochs and classify or collect training data.
   * 
   * @param flashEvents - All flash events from the completed trial
   * @param targetPosition - Target row/col (for calibration labeling)
   * @param isCalibration - Whether this is calibration mode (collect training data)
   */
  const processCompletedTrial = useCallback(async (
    _flashEvents: FlashEvent[],
    targetPosition?: { row: number; col: number },
    isCalibration: boolean = false
  ) => {
    if (isClassifyingRef.current) return;
    isClassifyingRef.current = true;

    try {
      const buffer = eegBufferRef.current;
      const markers = markerManagerRef.current;
      const effectiveConfig = {
        ...config,
        channels: buffer.channels,
        sampleRate: activeStreamConfig?.samplingRate || config.sampleRate,
      };

      // Extract epochs for all flash events
      const epochs: Array<{ epoch: number[][]; flashEvent: FlashEvent; label: 0 | 1 }> = [];

      for (const marker of markers.getAllMarkers()) {
        const preSamples = Math.round((effectiveConfig.preStimulus / 1000) * effectiveConfig.sampleRate);
        const totalSamples = preSamples + Math.round((effectiveConfig.epochDuration / 1000) * effectiveConfig.sampleRate);
        const startSample = marker.sampleIndex - preSamples;

        const raw = buffer.extractWindow(startSample, totalSamples);
        if (!raw) continue;

        // Determine label
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

        epochs.push({ epoch: raw, flashEvent: marker.flashEvent, label });
      }

      if (epochs.length === 0) {
        console.warn('[P300Pipeline] No epochs extracted (EEG data may not have arrived yet)');
        isClassifyingRef.current = false;
        return;
      }

      if (isCalibration) {
        // Store training data
        const trainingData = epochsToTrainingData(
          epochs,
          targetPosition
        );
        for (const td of trainingData) {
          addTrainingData(td);
        }
        console.log(`[P300Pipeline] Collected ${trainingData.length} training epochs (${epochs.filter(e => e.label === 1).length} target, ${epochs.filter(e => e.label === 0).length} non-target)`);
      } else {
        // Classification mode
        const model = ldaModelRef.current;
        if (!model) {
          console.warn('[P300Pipeline] No trained LDA model available. Run calibration first.');
          isClassifyingRef.current = false;
          return;
        }

        // Classify the trial
        const output = classifyTrial(
          epochs.map(e => ({ epoch: e.epoch, flashEvent: e.flashEvent })),
          model,
          effectiveConfig
        );

        // Update store with classification result
        updateP300Output(output);
        console.log(
          `[P300Pipeline] Classified: row=${output.predictedRow}, col=${output.predictedCol}, ` +
          `confidence=${(output.confidence * 100).toFixed(1)}%, latency=${output.latency.toFixed(1)}ms`
        );
      }

      // Clear markers for next trial
      markers.clear();
    } catch (error) {
      console.error('[P300Pipeline] Error processing trial:', error);
    } finally {
      isClassifyingRef.current = false;
    }
  }, [config, activeStreamConfig, addTrainingData, updateP300Output]);

  /**
   * Train the LDA model from collected calibration data.
   */
  const trainModel = useCallback((): { accuracy: number; nSamples: number } | null => {
    if (p300TrainingData.length < 10) {
      console.warn(`[P300Pipeline] Not enough training data (${p300TrainingData.length} samples, need ≥ 10)`);
      return null;
    }

    try {
      setTrainingStatus(true, 50);
      
      const effectiveConfig = {
        ...config,
        channels: activeStreamConfig?.channelCount || config.channels,
        sampleRate: activeStreamConfig?.samplingRate || config.sampleRate,
      };

      const model = trainLDA(p300TrainingData, effectiveConfig, 'downsample');
      ldaModelRef.current = model;
      
      setTrainingStatus(false, 100);

      return {
        accuracy: model.trainingAccuracy,
        nSamples: model.nSamples,
      };
    } catch (error) {
      console.error('[P300Pipeline] Training failed:', error);
      setTrainingStatus(false, 0);
      return null;
    }
  }, [p300TrainingData, config, activeStreamConfig, setTrainingStatus]);

  /**
   * Reset the pipeline (clear model, markers, buffer).
   */
  const resetPipeline = useCallback(() => {
    markerManagerRef.current.clear();
    eegBufferRef.current.clear();
    ldaModelRef.current = null;
    streamOriginSetRef.current = false;
    clearLDAModel();
    console.log('[P300Pipeline] Pipeline reset');
  }, []);

  return {
    /** Record a flash marker (call from SpellerGrid at rAF timestamp) */
    recordFlashMarker,
    /** Process a completed trial's epochs */
    processCompletedTrial,
    /** Train the LDA model from collected data */
    trainModel,
    /** Reset everything */
    resetPipeline,
    /** Whether an LDA model is loaded and ready */
    isModelReady: ldaModelRef.current !== null,
    /** Training accuracy of current model */
    modelAccuracy: ldaModelRef.current?.trainingAccuracy ?? null,
    /** Number of samples the model was trained on */
    modelSamples: ldaModelRef.current?.nSamples ?? 0,
    /** Pipeline config */
    config,
    /** Marker manager (for advanced use) */
    markerManager: markerManagerRef.current,
    /** EEG buffer (for visualization) */
    eegBuffer: eegBufferRef.current,
  };
}
