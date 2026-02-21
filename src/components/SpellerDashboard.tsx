// SpellerDashboard.tsx - Main interface for P300 BCI Speller

import { memo, useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import SpellerGrid from './visualization/SpellerGrid';
import type { SpellerMode, FlashEvent } from './visualization/SpellerGrid';
import { CHARACTER_MATRIX } from './visualization/SpellerGrid';
import TextOutputPanel from './TextOutputPanel';
import P300CalibrationPanel from './P300CalibrationPanel';
import { ConnectionStatus } from './ConnectionStatus';
import { DecoderSelector } from './DecoderSelector';
import { ElectrodePlacementPanel } from './visualization/ElectrodePlacementPanel';
import { useStore } from '../store';
import { getSmartPredictions, addCustomWord } from '../utils/wordPrediction';
import { useP300Pipeline } from '../hooks/useP300Pipeline';

const SpellerDashboard = memo(function SpellerDashboard() {
  // Store state
  const isConnected = useStore((state) => state.isConnected);
  const activeDecoder = useStore((state) => state.activeDecoder);
  const p300Output = useStore((state) => state.p300Output);
  const dataSource = useStore((state) => state.dataSource);

  // P300 pipeline
  const {
    recordFlashMarker,
    processCompletedTrial,
    trainModel,
    isModelReady,
    modelAccuracy,
  } = useP300Pipeline({ enabled: isConnected });

  // Local state
  const [mode, setMode] = useState<'calibration' | 'spelling'>('calibration');
  const [spellerMode, setSpellerMode] = useState<SpellerMode>('idle');
  const targetChar: string | null = null; // Set dynamically for spelling mode if needed
  const [spelledText, setSpelledText] = useState('');
  const [wordPredictions, setWordPredictions] = useState<string[]>([]);
  const [showMetrics, setShowMetrics] = useState(true);
  const [showElectrodes, setShowElectrodes] = useState(false);
  
  // Session stats
  const [sessionStats, setSessionStats] = useState(() => ({
    charactersTyped: 0,
    wordsTyped: 0,
    accuracy: 0,
    avgSelectionTime: 0,
    startTime: Date.now(),
  }));

  // Track current time for session duration (updates every minute)
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // Update word predictions
  const updatePredictions = useCallback((text: string) => {
    const predictions = getSmartPredictions(text, 5);
    setWordPredictions(predictions);
  }, []);

  // Handle character selection from speller
  const handleCharacterSelected = useCallback((char: string, confidence: number) => {
    // Add space handling and backspace
    if (char === '_') {
      setSpelledText(prev => prev + ' ');
    } else if (char === '<') {
      // Backspace
      setSpelledText(prev => prev.slice(0, -1));
    } else {
      setSpelledText(prev => prev + char);
      
      // Add to custom vocabulary
      const words = spelledText.split(/\s+/);
      if (words.length > 0) {
        addCustomWord(words[words.length - 1]);
      }
    }

    // Update stats
    setSessionStats(prev => ({
      ...prev,
      charactersTyped: prev.charactersTyped + 1,
      accuracy: (prev.accuracy * prev.charactersTyped + confidence) / (prev.charactersTyped + 1),
    }));

    // Update word predictions
    updatePredictions(spelledText + char);
  }, [spelledText, updatePredictions]);

  // Handle word prediction selection
  const handleSelectPrediction = useCallback((word: string) => {
    const words = spelledText.trim().split(/\s+/);
    const withoutLastWord = words.slice(0, -1).join(' ');
    const newText = withoutLastWord ? `${withoutLastWord} ${word} ` : `${word} `;
    setSpelledText(newText);
    updatePredictions(newText);
  }, [spelledText, updatePredictions]);

  // Handle calibration complete
  const handleCalibrationComplete = useCallback((accuracy: number) => {
    console.log(`[PhantomSpell] Calibration complete with ${(accuracy * 100).toFixed(1)}% accuracy`);
    if (accuracy > 0.5) {
      setMode('spelling');
      setSpellerMode('free-spelling');
    }
  }, []);

  // Handle flash marker from SpellerGrid (rAF frame timestamp)
  const handleFlashMarker = useCallback((event: FlashEvent, frameTimestamp: number) => {
    recordFlashMarker(event, frameTimestamp);
  }, [recordFlashMarker]);

  // Handle calibration trial completion (from CalibrationPanel's embedded SpellerGrid)
  const handleCalibTrialComplete = useCallback((
    flashEvents: FlashEvent[],
    targetPosition?: { row: number; col: number },
  ) => {
    processCompletedTrial(flashEvents, targetPosition, true /* isCalibration */);
  }, [processCompletedTrial]);

  // Handle trial completion (all flash cycles done for one character)
  const handleTrialComplete = useCallback((flashEvents: FlashEvent[]) => {
    const isCalibration = mode === 'calibration' && spellerMode === 'calibration';
    
    // Find target position for calibration
    let targetPos: { row: number; col: number } | undefined;
    if (isCalibration && targetChar) {
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 6; c++) {
          if (CHARACTER_MATRIX[r][c] === targetChar) {
            targetPos = { row: r, col: c };
          }
        }
      }
    }
    
    processCompletedTrial(flashEvents, targetPos, isCalibration);
  }, [mode, spellerMode, targetChar, processCompletedTrial]);

  // Start/stop spelling
  const toggleSpelling = () => {
    if (spellerMode === 'idle') {
      setSpellerMode('free-spelling');
    } else {
      setSpellerMode('idle');
    }
  };

  // Calculate session duration from state
  const sessionDuration = Math.floor((currentTime - sessionStats.startTime) / 1000 / 60);

  // Calculate information transfer rate (ITR)
  const calculateITR = () => {
    // ITR formula: bits/min = (log2(N) + P*log2(P) + (1-P)*log2((1-P)/(N-1))) * (60/T)
    // N = number of classes (36), P = accuracy, T = selection time
    const N = 36;
    const P = sessionStats.accuracy;
    const T = sessionStats.avgSelectionTime || 30; // seconds per selection
    
    if (P === 0 || T === 0) return 0;
    
    const bits = Math.log2(N) + P * Math.log2(P) + (1 - P) * Math.log2((1 - P) / (N - 1));
    const itr = bits * (60 / T);
    return Math.max(0, itr);
  };

  return (
    <div className="w-screen h-screen bg-black text-white flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <div className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            PhantomSpell
          </div>
          <div className="h-6 w-px bg-gray-700" />
          <ConnectionStatus />
        </div>

        <div className="flex items-center gap-3">
          {/* Mode toggle */}
          <div className="flex gap-2 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setMode('calibration')}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                mode === 'calibration'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Training
            </button>
            <button
              onClick={() => setMode('spelling')}
              disabled={!activeDecoder}
              className={`px-3 py-1.5 text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                mode === 'spelling'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Spelling
            </button>
          </div>

          {/* View toggles */}
          <button
            onClick={() => setShowMetrics(!showMetrics)}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-sm rounded transition-colors"
          >
            {showMetrics ? '📊 Hide' : '📊 Show'} Metrics
          </button>

          {dataSource?.type?.includes('eeg') && (
            <button
              onClick={() => setShowElectrodes(!showElectrodes)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-sm rounded transition-colors"
            >
              🔌 Electrodes
            </button>
          )}

          <div className="h-6 w-px bg-gray-700" />
          <DecoderSelector />
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - Metrics/Info */}
        {showMetrics && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: 320 }}
            className="bg-gray-950 border-r border-gray-800 overflow-y-auto"
          >
            <div className="p-4 space-y-4">
              {/* Session stats */}
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
                  Session Stats
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Characters:</span>
                    <span className="text-white font-medium">{sessionStats.charactersTyped}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Words:</span>
                    <span className="text-white font-medium">
                      {spelledText.trim().split(/\s+/).filter(w => w.length > 0).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Accuracy:</span>
                    <span className="text-green-400 font-medium">
                      {(sessionStats.accuracy * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Duration:</span>
                    <span className="text-white font-medium">{sessionDuration} min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">ITR:</span>
                    <span className="text-blue-400 font-medium">
                      {calculateITR().toFixed(1)} bits/min
                    </span>
                  </div>
                </div>
              </div>

              {/* Performance metrics */}
              {p300Output && (
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                  <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
                    Last Selection
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Confidence:</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500"
                            style={{ width: `${p300Output.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-white font-medium">
                          {(p300Output.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Latency:</span>
                      <span className="text-white font-medium">{p300Output.latency.toFixed(0)} ms</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Electrode panel */}
              {showElectrodes && dataSource?.type?.includes('eeg') && (
                <ElectrodePlacementPanel />
              )}
            </div>
          </motion.div>
        )}

        {/* Center - Main speller/calibration area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {mode === 'calibration' ? (
            <P300CalibrationPanel
              onCalibrationComplete={handleCalibrationComplete}
              onTrainModel={trainModel}
              isModelReady={isModelReady}
              modelAccuracy={modelAccuracy}
              onFlashMarker={handleFlashMarker}
              onTrialComplete={handleCalibTrialComplete}
              onSwitchToSpelling={() => {
                setMode('spelling');
                setSpellerMode('free-spelling');
              }}
            />
          ) : (
            <div className="flex-1 flex flex-col">
              {/* Speller grid */}
              <div className="flex-1">
                <SpellerGrid
                  mode={spellerMode}
                  targetChar={targetChar}
                  onCharacterSelected={handleCharacterSelected}
                  onTrialComplete={handleTrialComplete}
                  onFlashMarker={handleFlashMarker}
                />
              </div>

              {/* Control bar */}
              <div className="bg-gray-900 border-t border-gray-800 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={toggleSpelling}
                      disabled={!activeDecoder || !isConnected}
                      className={`px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        spellerMode !== 'idle'
                          ? 'bg-red-600 hover:bg-red-500 text-white'
                          : 'bg-green-600 hover:bg-green-500 text-white'
                      }`}
                    >
                      {spellerMode !== 'idle' ? '⏸️ Stop' : '▶️ Start Spelling'}
                    </button>

                    {!isConnected && (
                      <span className="text-sm text-yellow-500">
                        ⚠️ Connect to EEG device first
                      </span>
                    )}
                    {!activeDecoder && isConnected && (
                      <span className="text-sm text-yellow-500">
                        ⚠️ Select a decoder first
                      </span>
                    )}
                  </div>

                  <div className="text-sm text-gray-500">
                    {spellerMode === 'free-spelling' && (
                      <span className="text-green-400">● Spelling Active</span>
                    )}
                    {spellerMode === 'idle' && <span>Ready to spell</span>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar - Text output */}
        {mode === 'spelling' && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: 400 }}
            className="bg-gray-950 border-l border-gray-800"
          >
            <TextOutputPanel
              text={spelledText}
              onTextChange={setSpelledText}
              predictions={wordPredictions}
              onSelectPrediction={handleSelectPrediction}
              confidence={p300Output?.confidence}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
});

export default SpellerDashboard;
