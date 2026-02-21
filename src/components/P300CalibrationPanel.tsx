// P300CalibrationPanel.tsx - Training interface for P300 speller

import { memo, useState } from 'react';
import { useStore } from '../store';

// Standard calibration sequence (all characters)
const CALIBRATION_SEQUENCE = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L',
  'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X',
  'Y', 'Z', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'
];

const TRIALS_PER_CHAR = 5; // Number of repetitions per character

interface P300CalibrationPanelProps {
  onCalibrationComplete?: (accuracy: number) => void;
  onStartCalibration?: () => void;
  onStopCalibration?: () => void;
}

const P300CalibrationPanel = memo(function P300CalibrationPanel({
  onCalibrationComplete,
  onStartCalibration,
  onStopCalibration,
}: P300CalibrationPanelProps) {
  // Store state
  const p300TrainingData = useStore((state) => state.p300TrainingData);
  const clearTrainingData = useStore((state) => state.clearTrainingData);
  const setTrainingStatus = useStore((state) => state.setTrainingStatus);
  
  // Local state
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [currentTrial, setCurrentTrial] = useState(0);
  const [stage, setStage] = useState<'idle' | 'instructions' | 'training' | 'complete'>('idle');
  const [trainingResults, setTrainingResults] = useState<{
    totalTrials: number;
    targetFlashes: number;
    nonTargetFlashes: number;
    duration: number;
  } | null>(null);

  const currentChar = CALIBRATION_SEQUENCE[currentCharIndex];
  const totalChars = CALIBRATION_SEQUENCE.length;
  const progress = ((currentCharIndex * TRIALS_PER_CHAR + currentTrial) / (totalChars * TRIALS_PER_CHAR)) * 100;

  // TODO: Phase 2 - Implement model training and EEG data collection

  // Start calibration
  const startCalibration = () => {
    clearTrainingData();
    setCurrentCharIndex(0);
    setCurrentTrial(0);
    setStage('instructions');
    setTrainingResults(null);
  };

  // Begin training after instructions
  const beginTraining = () => {
    setStage('training');
    setTrainingStatus(true, 0);
    if (onStartCalibration) {
      onStartCalibration();
    }
  };

  // Stop calibration
  const stopCalibration = () => {
    setStage('idle');
    setTrainingStatus(false, 0);
    if (onStopCalibration) {
      onStopCalibration();
    }
  };

  // Complete training (for manual trigger in stub mode)
  const completeCalibration = () => {
    const targetCount = p300TrainingData.filter(d => d.label === 1).length;
    const nonTargetCount = p300TrainingData.filter(d => d.label === 0).length;
    
    setTrainingResults({
      totalTrials: totalChars * TRIALS_PER_CHAR,
      targetFlashes: targetCount,
      nonTargetFlashes: nonTargetCount,
      duration: 0, // Would calculate actual duration
    });
    
    setStage('complete');
    setTrainingStatus(false, 100);
    
    // TODO Phase 2: Train the actual P300 model here
    if (onCalibrationComplete) {
      onCalibrationComplete(0.85); // Placeholder accuracy
    }
  };

  // Reset and return to idle
  const reset = () => {
    clearTrainingData();
    setStage('idle');
    setCurrentCharIndex(0);
    setCurrentTrial(0);
    setTrainingResults(null);
    setTrainingStatus(false, 0);
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 border-2 border-gray-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="text-lg font-semibold text-white">P300 Calibration</div>
          {stage === 'training' && (
            <div className="px-2 py-1 bg-blue-900 text-blue-200 text-xs rounded-full">
              Training in progress...
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
      <div className="flex-1 p-6 overflow-y-auto">
        {/* Idle state */}
        {stage === 'idle' && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-6xl mb-6">🧠</div>
            <h2 className="text-2xl font-bold text-white mb-3">P300 Model Training</h2>
            <p className="text-gray-400 mb-6 max-w-md">
              Train the BCI classifier to recognize your brain's P300 response.
              This takes about 10-15 minutes.
            </p>
            
            <div className="grid grid-cols-2 gap-4 mb-8 max-w-lg">
              <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
                <div className="text-3xl font-bold text-blue-400">{totalChars}</div>
                <div className="text-sm text-gray-500">Characters</div>
              </div>
              <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
                <div className="text-3xl font-bold text-green-400">{TRIALS_PER_CHAR}</div>
                <div className="text-sm text-gray-500">Trials Each</div>
              </div>
            </div>
            
            <button
              onClick={startCalibration}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors text-lg"
            >
              Start Calibration
            </button>
            
            {p300TrainingData.length > 0 && (
              <div className="mt-4 text-sm text-gray-500">
                {p300TrainingData.length} training samples collected
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        {stage === 'instructions' && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-5xl mb-6">👀</div>
            <h2 className="text-2xl font-bold text-white mb-6">Instructions</h2>
            
            <div className="max-w-lg space-y-4 text-left mb-8">
              <div className="flex gap-4 p-4 bg-gray-900 rounded-lg">
                <div className="text-2xl">1️⃣</div>
                <div>
                  <div className="font-medium text-white mb-1">Focus on the Target</div>
                  <div className="text-sm text-gray-400">
                    A purple-highlighted character will be shown. Keep your eyes on it.
                  </div>
                </div>
              </div>
              
              <div className="flex gap-4 p-4 bg-gray-900 rounded-lg">
                <div className="text-2xl">2️⃣</div>
                <div>
                  <div className="font-medium text-white mb-1">Count the Flashes</div>
                  <div className="text-sm text-gray-400">
                    Silently count how many times the target row or column flashes white.
                  </div>
                </div>
              </div>
              
              <div className="flex gap-4 p-4 bg-gray-900 rounded-lg">
                <div className="text-2xl">3️⃣</div>
                <div>
                  <div className="font-medium text-white mb-1">Stay Still</div>
                  <div className="text-sm text-gray-400">
                    Minimize eye blinks and movements during each trial sequence.
                  </div>
                </div>
              </div>
            </div>
            
            <button
              onClick={beginTraining}
              className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors text-lg"
            >
              I'm Ready - Begin Training
            </button>
          </div>
        )}

        {/* Training in progress */}
        {stage === 'training' && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="mb-8 text-center">
              <div className="text-lg text-gray-500 mb-2">Current Target</div>
              <div className="text-6xl font-bold text-purple-400">{currentChar}</div>
              <div className="text-sm text-gray-600 mt-2">
                Trial {currentTrial + 1} of {TRIALS_PER_CHAR}
              </div>
            </div>
            
            <div className="w-full max-w-md">
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-center text-xs text-gray-600 mt-2">
                Character {currentCharIndex + 1} of {totalChars}
              </div>
            </div>

            <div className="mt-6 text-sm text-gray-500">
              <button
                onClick={completeCalibration}
                className="px-4 py-2 bg-green-900 hover:bg-green-800 text-green-200 rounded transition-colors"
              >
                Complete Calibration (Manual)
              </button>
              <p className="mt-2 text-xs">In stub mode - click to finish training</p>
            </div>
          </div>
        )}

        {/* Complete */}
        {stage === 'complete' && trainingResults && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-6xl mb-6">✅</div>
            <h2 className="text-2xl font-bold text-white mb-3">Training Complete!</h2>
            <p className="text-gray-400 mb-8">
              Your P300 classifier has been trained and is ready to use.
            </p>
            
            <div className="grid grid-cols-3 gap-4 mb-8 max-w-2xl">
              <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
                <div className="text-2xl font-bold text-blue-400">{trainingResults.totalTrials}</div>
                <div className="text-xs text-gray-500">Total Trials</div>
              </div>
              <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
                <div className="text-2xl font-bold text-green-400">{trainingResults.targetFlashes}</div>
                <div className="text-xs text-gray-500">Target Flashes</div>
              </div>
              <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
                <div className="text-2xl font-bold text-yellow-400">{trainingResults.nonTargetFlashes}</div>
                <div className="text-xs text-gray-500">Non-Target Flashes</div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={reset}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
              >
                Train Again
              </button>
              <button
                onClick={() => setStage('idle')}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
              >
                Start Spelling
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default P300CalibrationPanel;
