// P300CalibrationPanel.tsx - Training interface for P300 speller
//
// Embeds SpellerGrid during calibration to run the full flash sequence,
// advances target characters automatically, and forwards flash markers
// to the P300 pipeline for epoch extraction and LDA training.

import { memo, useState, useCallback, useRef } from 'react';
import { useStore } from '../store';
import SpellerGrid from './visualization/SpellerGrid';
import { CHARACTER_MATRIX } from './visualization/SpellerGrid';
import type { FlashEvent } from './visualization/SpellerGrid';

// Calibration uses a diverse subset of characters (~5 min total).
// Covers different grid positions for spatial balance.
const CALIBRATION_CHARS = [
  'A', 'E', 'I', 'O', 'U',   // Vowels (rows 0-3)
  'T', 'N', 'S', 'L', 'R',   // Common consonants
  '5', '0',                    // Numbers at grid corners
];

// 1 trial per char — each SpellerGrid trial already does 10 repetitions
// of all rows and columns (120 epochs per char, ~24 s each).
const TRIALS_PER_CHAR = 1;

interface P300CalibrationPanelProps {
  onCalibrationComplete?: (accuracy: number) => void;
  /** Called to train the LDA model from collected data */
  onTrainModel?: () => { accuracy: number; nSamples: number } | null;
  /** Whether an LDA model is loaded */
  isModelReady?: boolean;
  /** Current model accuracy */
  modelAccuracy?: number | null;
  /** Called when flash event occurs — for pipeline marker recording */
  onFlashMarker?: (event: FlashEvent, frameTimestamp: number) => void;
  /** Called when a trial completes with flash events and target position */
  onTrialComplete?: (
    flashEvents: FlashEvent[],
    targetPosition?: { row: number; col: number },
  ) => void;
  /** Called when user wants to switch to spelling mode */
  onSwitchToSpelling?: () => void;
}

type Stage = 'idle' | 'instructions' | 'training' | 'model-training' | 'complete';

const P300CalibrationPanel = memo(function P300CalibrationPanel({
  onCalibrationComplete,
  onTrainModel,
  isModelReady = false,
  modelAccuracy = null,
  onFlashMarker,
  onTrialComplete,
  onSwitchToSpelling,
}: P300CalibrationPanelProps) {
  // Store state
  const p300TrainingData = useStore((state) => state.p300TrainingData);
  const clearTrainingData = useStore((state) => state.clearTrainingData);
  const setTrainingStatus = useStore((state) => state.setTrainingStatus);

  // Local state
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [currentTrial, setCurrentTrial] = useState(0);
  const [stage, setStage] = useState<Stage>('idle');
  const [allCharsCollected, setAllCharsCollected] = useState(false);
  const [trainingResults, setTrainingResults] = useState<{
    totalEpochs: number;
    targetFlashes: number;
    nonTargetFlashes: number;
    accuracy: number;
    duration: number;
  } | null>(null);

  const startTimeRef = useRef<number>(0);

  const currentChar = CALIBRATION_CHARS[currentCharIndex];
  const totalChars = CALIBRATION_CHARS.length;
  const progress =
    ((currentCharIndex * TRIALS_PER_CHAR + currentTrial) /
      (totalChars * TRIALS_PER_CHAR)) *
    100;

  // Find target position in the 6×6 CHARACTER_MATRIX
  let targetPosition: { row: number; col: number } | undefined;
  if (currentChar) {
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        if (CHARACTER_MATRIX[r][c] === currentChar) {
          targetPosition = { row: r, col: c };
        }
      }
    }
  }

  // Live epoch counts for the UI
  const liveTargetCount = p300TrainingData.filter((d) => d.label === 1).length;
  const liveNonTargetCount = p300TrainingData.filter((d) => d.label === 0).length;

  // ── Stage transitions ─────────────────────────────────────────────

  const startCalibration = useCallback(() => {
    clearTrainingData();
    setCurrentCharIndex(0);
    setCurrentTrial(0);
    setAllCharsCollected(false);
    setStage('instructions');
    setTrainingResults(null);
  }, [clearTrainingData]);

  const beginTraining = useCallback(() => {
    startTimeRef.current = Date.now();
    setStage('training');
    setTrainingStatus(true, 0);
  }, [setTrainingStatus]);

  const stopCalibration = useCallback(() => {
    setStage('idle');
    setTrainingStatus(false, 0);
  }, [setTrainingStatus]);

  // ── SpellerGrid trial completion ──────────────────────────────────

  const handleGridTrialComplete = useCallback(
    (flashEvents: FlashEvent[]) => {
      // Forward to pipeline so it extracts epochs + stores training data
      if (onTrialComplete) {
        onTrialComplete(flashEvents, targetPosition);
      }

      const nextTrial = currentTrial + 1;

      if (nextTrial >= TRIALS_PER_CHAR) {
        // All trials for this character done → advance
        const nextCharIndex = currentCharIndex + 1;

        if (nextCharIndex >= totalChars) {
          // All characters calibrated
          setAllCharsCollected(true);
          setTrainingStatus(true, 100);
        } else {
          setCurrentCharIndex(nextCharIndex);
          setCurrentTrial(0);
          setTrainingStatus(true, (nextCharIndex / totalChars) * 100);
        }
      } else {
        setCurrentTrial(nextTrial);
      }
    },
    [
      currentCharIndex,
      currentTrial,
      totalChars,
      targetPosition,
      onTrialComplete,
      setTrainingStatus,
    ],
  );

  // ── LDA model training ────────────────────────────────────────────

  const doTrainModel = useCallback(() => {
    const targetCount = p300TrainingData.filter((d) => d.label === 1).length;
    const nonTargetCount = p300TrainingData.filter((d) => d.label === 0).length;
    const duration = Math.round((Date.now() - startTimeRef.current) / 1000);

    if (onTrainModel && p300TrainingData.length >= 10) {
      setStage('model-training');
      setTrainingStatus(true, 50);

      // Allow UI to update before blocking LDA training
      setTimeout(() => {
        const result = onTrainModel();
        const accuracy = result?.accuracy ?? 0;

        setTrainingResults({
          totalEpochs: targetCount + nonTargetCount,
          targetFlashes: targetCount,
          nonTargetFlashes: nonTargetCount,
          accuracy,
          duration,
        });

        setStage('complete');
        setTrainingStatus(false, 100);

        if (onCalibrationComplete) {
          onCalibrationComplete(accuracy);
        }
      }, 100);
    } else {
      console.warn(
        `[Calibration] Not enough training data: ${p300TrainingData.length} samples`,
      );
      setTrainingResults({
        totalEpochs: targetCount + nonTargetCount,
        targetFlashes: targetCount,
        nonTargetFlashes: nonTargetCount,
        accuracy: 0,
        duration,
      });
      setStage('complete');
      setTrainingStatus(false, 100);
      if (onCalibrationComplete) onCalibrationComplete(0);
    }
  }, [
    p300TrainingData,
    onTrainModel,
    onCalibrationComplete,
    setTrainingStatus,
  ]);

  const reset = useCallback(() => {
    clearTrainingData();
    setStage('idle');
    setCurrentCharIndex(0);
    setCurrentTrial(0);
    setAllCharsCollected(false);
    setTrainingResults(null);
    setTrainingStatus(false, 0);
  }, [clearTrainingData, setTrainingStatus]);

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-gray-950 border-2 border-gray-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="text-lg font-semibold text-white">P300 Calibration</div>

          {stage === 'training' && (
            <div className="px-2 py-1 bg-blue-900 text-blue-200 text-xs rounded-full">
              {allCharsCollected
                ? 'Data collected — ready to train'
                : 'Collecting EEG data...'}
            </div>
          )}

          {isModelReady && stage === 'idle' && (
            <div className="px-2 py-1 bg-green-900 text-green-200 text-xs rounded-full">
              Model ready ({((modelAccuracy ?? 0) * 100).toFixed(0)}%)
            </div>
          )}
        </div>

        {stage === 'training' && (
          <button
            onClick={stopCalibration}
            className="px-3 py-1.5 bg-red-900 hover:bg-red-800 text-red-200 text-sm rounded transition-colors"
          >
            Stop
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ════════════ IDLE ════════════ */}
        {stage === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
            <div className="text-6xl mb-6">🧠</div>
            <h2 className="text-2xl font-bold text-white mb-3">
              P300 Calibration
            </h2>
            <p className="text-gray-400 mb-6 max-w-md">
              Train the BCI classifier to recognize your brain's P300 response.
              Calibration takes about 5 minutes.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-8 max-w-lg">
              <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
                <div className="text-3xl font-bold text-blue-400">
                  {totalChars}
                </div>
                <div className="text-sm text-gray-500">Characters</div>
              </div>
              <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
                <div className="text-3xl font-bold text-green-400">~5 min</div>
                <div className="text-sm text-gray-500">Duration</div>
              </div>
            </div>

            <button
              onClick={startCalibration}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors text-lg"
            >
              {isModelReady ? 'Recalibrate' : 'Start Calibration'}
            </button>

            {isModelReady && onSwitchToSpelling && (
              <button
                onClick={onSwitchToSpelling}
                className="mt-4 px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors text-lg"
              >
                Start Spelling →
              </button>
            )}

            {p300TrainingData.length > 0 && !isModelReady && (
              <div className="mt-4 text-sm text-gray-500">
                {p300TrainingData.length} training samples from previous session
              </div>
            )}
          </div>
        )}

        {/* ════════════ INSTRUCTIONS ════════════ */}
        {stage === 'instructions' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
            <div className="text-5xl mb-6">👀</div>
            <h2 className="text-2xl font-bold text-white mb-6">Instructions</h2>

            <div className="max-w-lg space-y-4 text-left mb-8">
              <div className="flex gap-4 p-4 bg-gray-900 rounded-lg">
                <div className="text-2xl">1️⃣</div>
                <div>
                  <div className="font-medium text-white mb-1">
                    Focus on the Target
                  </div>
                  <div className="text-sm text-gray-400">
                    A purple-highlighted character will be shown. Keep your eyes
                    on it.
                  </div>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-gray-900 rounded-lg">
                <div className="text-2xl">2️⃣</div>
                <div>
                  <div className="font-medium text-white mb-1">
                    Count the Flashes
                  </div>
                  <div className="text-sm text-gray-400">
                    Silently count how many times the target row or column
                    flashes white.
                  </div>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-gray-900 rounded-lg">
                <div className="text-2xl">3️⃣</div>
                <div>
                  <div className="font-medium text-white mb-1">Stay Still</div>
                  <div className="text-sm text-gray-400">
                    Minimize eye blinks and movements during each trial
                    sequence.
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={beginTraining}
              className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors text-lg"
            >
              I'm Ready — Begin Training
            </button>
          </div>
        )}

        {/* ════════════ TRAINING (embedded SpellerGrid) ════════════ */}
        {stage === 'training' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Info bar */}
            <div className="shrink-0 px-4 py-3 bg-gray-900/50 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-6">
                {!allCharsCollected && (
                  <>
                    <div className="text-sm text-gray-400">
                      Target:{' '}
                      <span className="text-2xl font-bold text-purple-400 ml-1">
                        {currentChar}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      Char {currentCharIndex + 1} / {totalChars}
                    </div>
                  </>
                )}
                {allCharsCollected && (
                  <div className="text-sm text-green-400 font-medium">
                    All {totalChars} characters collected
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-600">
                {p300TrainingData.length} epochs ({liveTargetCount} target,{' '}
                {liveNonTargetCount} non-target)
              </div>
            </div>

            {/* Progress bar */}
            <div className="shrink-0 px-4 py-2 bg-gray-950">
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${allCharsCollected ? 100 : progress}%` }}
                />
              </div>
            </div>

            {/* SpellerGrid or "all done" message */}
            {!allCharsCollected ? (
              <div className="flex-1 min-h-0">
                <SpellerGrid
                  mode="calibration"
                  targetChar={currentChar}
                  onTrialComplete={handleGridTrialComplete}
                  onFlashMarker={onFlashMarker}
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="text-5xl mb-4">✅</div>
                <h3 className="text-xl font-bold text-white mb-2">
                  Data Collection Complete
                </h3>
                <p className="text-gray-400 mb-2">
                  {p300TrainingData.length} EEG epochs collected across{' '}
                  {totalChars} characters.
                </p>
                <p className="text-gray-500 text-sm">
                  Click below to train the LDA classifier on this data.
                </p>
              </div>
            )}

            {/* Bottom controls */}
            <div className="shrink-0 px-4 py-3 bg-gray-900 border-t border-gray-800 flex items-center justify-between">
              <button
                onClick={stopCalibration}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={doTrainModel}
                disabled={p300TrainingData.length < 10}
                className={`px-5 py-2 rounded font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  allCharsCollected
                    ? 'bg-green-600 hover:bg-green-500 text-white animate-pulse'
                    : 'bg-green-900 hover:bg-green-800 text-green-200'
                }`}
              >
                {p300TrainingData.length < 10
                  ? `Need ${10 - p300TrainingData.length} more epochs...`
                  : `Train Model (${p300TrainingData.length} epochs)`}
              </button>
            </div>
          </div>
        )}

        {/* ════════════ MODEL TRAINING ════════════ */}
        {stage === 'model-training' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="text-6xl mb-6 animate-spin">⚙️</div>
            <h2 className="text-2xl font-bold text-white mb-3">
              Training LDA Classifier...
            </h2>
            <p className="text-gray-400 mb-6">
              Computing discriminant projection from{' '}
              {p300TrainingData.length} epochs.
            </p>
            <div className="w-full max-w-md">
              <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 animate-pulse"
                  style={{ width: '60%' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ════════════ COMPLETE ════════════ */}
        {stage === 'complete' && trainingResults && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
            <div className="text-6xl mb-6">
              {trainingResults.accuracy > 0.6 ? '✅' : '⚠️'}
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">
              {trainingResults.accuracy > 0.6
                ? 'Training Complete!'
                : 'Training Complete (Low Accuracy)'}
            </h2>
            <p className="text-gray-400 mb-8">
              {trainingResults.accuracy > 0.6
                ? 'Your P300 classifier has been trained and is ready to use.'
                : 'Accuracy is below 60%. Consider retraining with better signal quality or more data.'}
            </p>

            <div className="grid grid-cols-4 gap-4 mb-8 max-w-2xl">
              <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
                <div className="text-2xl font-bold text-purple-400">
                  {(trainingResults.accuracy * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500">CV Accuracy</div>
              </div>
              <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
                <div className="text-2xl font-bold text-blue-400">
                  {trainingResults.totalEpochs}
                </div>
                <div className="text-xs text-gray-500">Total Epochs</div>
              </div>
              <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
                <div className="text-2xl font-bold text-green-400">
                  {trainingResults.targetFlashes}
                </div>
                <div className="text-xs text-gray-500">Target</div>
              </div>
              <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
                <div className="text-2xl font-bold text-yellow-400">
                  {trainingResults.duration > 0
                    ? `${Math.floor(trainingResults.duration / 60)}:${String(
                        trainingResults.duration % 60,
                      ).padStart(2, '0')}`
                    : '—'}
                </div>
                <div className="text-xs text-gray-500">Duration</div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={reset}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
              >
                Train Again
              </button>
              {trainingResults.accuracy > 0.5 && onSwitchToSpelling && (
                <button
                  onClick={onSwitchToSpelling}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
                >
                  Start Spelling →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default P300CalibrationPanel;
