// SpellerGrid.tsx - P300 Matrix Speller Component
// 6x6 character grid with row/column flashing paradigm

import { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { useStore } from '../../store';

// Grid configuration
const GRID_ROWS = 6;
const GRID_COLS = 6;

// Character matrix (A-Z + 0-9)
const CHARACTER_MATRIX: string[][] = [
  ['A', 'B', 'C', 'D', 'E', 'F'],
  ['G', 'H', 'I', 'J', 'K', 'L'],
  ['M', 'N', 'O', 'P', 'Q', 'R'],
  ['S', 'T', 'U', 'V', 'W', 'X'],
  ['Y', 'Z', '1', '2', '3', '4'],
  ['5', '6', '7', '8', '9', '0'],
];

// Special characters (for future expansion)
// const SPECIAL_CHARS = ['_', '<', '>', '.', '?', '!'];

// P300 timing configuration (all in ms)
const FLASH_DURATION = 125;        // How long each flash lasts
const INTER_FLASH_INTERVAL = 75;   // Gap between flashes
const TRIAL_COUNT = 10;             // Number of complete cycles per selection
const POST_SELECTION_PAUSE = 1500;  // Pause after character selection

export type SpellerMode = 'idle' | 'calibration' | 'free-spelling';
export type FlashType = 'none' | 'row' | 'col';

interface FlashState {
  type: FlashType;
  index: number; // Row or column index being flashed
}

interface SpellerGridProps {
  mode?: SpellerMode;
  targetChar?: string | null;       // For calibration mode
  onCharacterSelected?: (char: string, confidence: number) => void;
  onTrialComplete?: (flashSequence: FlashEvent[]) => void;
}

export interface FlashEvent {
  type: 'row' | 'col';
  index: number;
  timestamp: number;
  containsTarget: boolean; // For training labels
}

const SpellerGrid = memo(function SpellerGrid({
  mode = 'idle',
  targetChar = null,
  onCharacterSelected,
  onTrialComplete,
}: SpellerGridProps) {
  // Flash state
  const [flashState, setFlashState] = useState<FlashState>({ type: 'none', index: -1 });
  const [currentTrial, setCurrentTrial] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  
  // Selection state (from decoder output)
  const decoderOutput = useStore((state) => state.p300Output);
  const [selectedChar, setSelectedChar] = useState<{char: string, confidence: number} | null>(null);

  // Find target position for calibration
  const targetPosition = useMemo(() => {
    if (!targetChar) return null;
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (CHARACTER_MATRIX[row][col] === targetChar) {
          return { row, col };
        }
      }
    }
    return null;
  }, [targetChar]);

  // Generate random flash sequence (Marsaglia algorithm for balanced sequence)
  const generateFlashSequence = useCallback(() => {
    const rows = Array.from({ length: GRID_ROWS }, (_, i) => ({ type: 'row' as const, index: i }));
    const cols = Array.from({ length: GRID_COLS }, (_, i) => ({ type: 'col' as const, index: i }));
    
    // Interleave rows and columns randomly
    const all = [...rows, ...cols];
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    
    return all;
  }, []);

  // Start P300 trial sequence
  const startTrial = useCallback(() => {
    if (mode === 'idle') return;
    
    setIsRunning(true);
    setCurrentTrial(0);
    setSelectedChar(null);

    let trialNum = 0;
    let flashIndex = 0;
    let sequence = generateFlashSequence();
    const events: FlashEvent[] = [];

    const flashTimer = setInterval(() => {
      if (trialNum >= TRIAL_COUNT) {
        // End of all trials
        clearInterval(flashTimer);
        setFlashState({ type: 'none', index: -1 });
        setIsRunning(false);
        
        // Trigger analysis (decoder processes flash events)
        if (onTrialComplete) {
          onTrialComplete(events);
        }
        
        return;
      }

      // Flash on
      const currentFlash = sequence[flashIndex];
      setFlashState({
        type: currentFlash.type,
        index: currentFlash.index,
      });

      // Record event with label for training
      const containsTarget = targetPosition
        ? (currentFlash.type === 'row' && currentFlash.index === targetPosition.row) ||
          (currentFlash.type === 'col' && currentFlash.index === targetPosition.col)
        : false;

      events.push({
        type: currentFlash.type,
        index: currentFlash.index,
        timestamp: performance.now(),
        containsTarget,
      });

      // Schedule flash off
      setTimeout(() => {
        setFlashState({ type: 'none', index: -1 });
      }, FLASH_DURATION);

      flashIndex++;
      
      // Check if we've completed one full cycle
      if (flashIndex >= sequence.length) {
        flashIndex = 0;
        trialNum++;
        setCurrentTrial(trialNum);
        sequence = generateFlashSequence(); // Re-randomize for next trial
      }
    }, FLASH_DURATION + INTER_FLASH_INTERVAL);

    return () => clearInterval(flashTimer);
  }, [mode, targetPosition, generateFlashSequence, onTrialComplete]);

  // Monitor decoder output and determine selected character
  useEffect(() => {
    if (!decoderOutput || isRunning) return;

    const { predictedRow, predictedCol, confidence } = decoderOutput;
    
    if (predictedRow >= 0 && predictedRow < GRID_ROWS &&
        predictedCol >= 0 && predictedCol < GRID_COLS) {
      const char = CHARACTER_MATRIX[predictedRow][predictedCol];
      setSelectedChar({ char, confidence });
      
      if (onCharacterSelected) {
        onCharacterSelected(char, confidence);
      }

      // Show selection briefly, then reset
      setTimeout(() => {
        setSelectedChar(null);
      }, POST_SELECTION_PAUSE);
    }
  }, [decoderOutput, isRunning, onCharacterSelected]);

  // Auto-start when mode changes to calibration/free-spelling
  useEffect(() => {
    if (mode !== 'idle' && !isRunning) {
      const timer = setTimeout(() => startTrial(), 500); // Small delay before starting
      return () => clearTimeout(timer);
    }
  }, [mode, isRunning, startTrial]);

  // Render character cell
  const renderCell = (char: string, row: number, col: number) => {
    const isFlashing = 
      (flashState.type === 'row' && flashState.index === row) ||
      (flashState.type === 'col' && flashState.index === col);
    
    const isTarget = targetChar === char;
    const isSelected = selectedChar?.char === char;

    return (
      <div
        key={`${row}-${col}`}
        className={`
          relative flex items-center justify-center
          text-3xl font-bold rounded-lg border-2
          transition-all duration-75
          ${isFlashing 
            ? 'bg-white text-black border-white scale-105 shadow-2xl' 
            : 'bg-gray-900 text-gray-300 border-gray-700'
          }
          ${isTarget && mode === 'calibration'
            ? 'ring-4 ring-purple-500 ring-opacity-50'
            : ''
          }
          ${isSelected
            ? 'bg-green-500 text-white border-green-400 scale-110'
            : ''
          }
        `}
        style={{
          width: '100%',
          aspectRatio: '1',
        }}
      >
        {char}
        
        {/* Target indicator (calibration only) */}
        {isTarget && mode === 'calibration' && (
          <div className="absolute -top-2 -right-2 w-4 h-4 bg-purple-500 rounded-full animate-pulse" />
        )}
        
        {/* Selection confidence indicator */}
        {isSelected && selectedChar && (
          <div className="absolute -bottom-1 left-0 right-0 h-1 bg-green-400 rounded-full"
               style={{ width: `${selectedChar.confidence * 100}%` }} />
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-8 bg-black">
      {/* Status header */}
      <div className="mb-6 text-center">
        <div className="text-sm text-gray-500 uppercase tracking-wider mb-2">
          {mode === 'calibration' ? 'Training Mode' : mode === 'free-spelling' ? 'Free Spelling' : 'Idle'}
        </div>
        
        {mode === 'calibration' && targetChar && (
          <div className="text-lg text-purple-400">
            Focus on: <span className="text-4xl font-bold text-white ml-2">{targetChar}</span>
          </div>
        )}
        
        {isRunning && (
          <div className="text-sm text-blue-400 mt-2">
            Trial {currentTrial + 1} / {TRIAL_COUNT}
          </div>
        )}
      </div>

      {/* Character Grid */}
      <div 
        className="grid gap-3 p-6 bg-gray-950 rounded-xl border-2 border-gray-800"
        style={{
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
          maxWidth: '600px',
          maxHeight: '600px',
          width: '100%',
        }}
      >
        {CHARACTER_MATRIX.map((row, rowIndex) =>
          row.map((char, colIndex) => renderCell(char, rowIndex, colIndex))
        )}
      </div>

      {/* Progress bar */}
      {isRunning && (
        <div className="mt-6 w-full max-w-md">
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${(currentTrial / TRIAL_COUNT) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
});

export default SpellerGrid;
