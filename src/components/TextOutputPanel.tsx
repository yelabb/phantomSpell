// TextOutputPanel.tsx - Display spelled text with word prediction

import { memo, useState, useEffect } from 'react';

interface TextOutputPanelProps {
  text: string;
  onTextChange?: (text: string) => void;
  predictions?: string[];
  onSelectPrediction?: (word: string) => void;
  confidence?: number;
}

const TextOutputPanel = memo(function TextOutputPanel({
  text,
  onTextChange,
  predictions = [],
  onSelectPrediction,
  confidence,
}: TextOutputPanelProps) {
  const [cursorVisible, setCursorVisible] = useState(true);

  // Blinking cursor effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible((v) => !v);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  // Handle backspace
  const handleBackspace = () => {
    if (text.length > 0 && onTextChange) {
      onTextChange(text.slice(0, -1));
    }
  };

  // Handle clear
  const handleClear = () => {
    if (onTextChange) {
      onTextChange('');
    }
  };

  // Get last word for prediction context
  const getLastWord = () => {
    const words = text.trim().split(/\s+/);
    return words[words.length - 1] || '';
  };

  const lastWord = getLastWord();
  const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length;
  const charCount = text.length;

  return (
    <div className="flex flex-col h-full bg-gray-950 border-2 border-gray-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <div className="text-sm font-medium text-gray-300">Output</div>
        <div className="flex items-center gap-4">
          {/* Stats */}
          <div className="text-xs text-gray-500">
            {wordCount} word{wordCount !== 1 ? 's' : ''} • {charCount} char{charCount !== 1 ? 's' : ''}
          </div>
          
          {/* Confidence indicator */}
          {confidence !== undefined && confidence > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Confidence:</span>
              <div className="w-16 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-400">{Math.round(confidence * 100)}%</span>
            </div>
          )}

          {/* Controls */}
          <button
            onClick={handleBackspace}
            disabled={text.length === 0}
            className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 rounded transition-colors"
          >
            ← Backspace
          </button>
          <button
            onClick={handleClear}
            disabled={text.length === 0}
            className="px-2 py-1 text-xs bg-gray-800 hover:bg-red-900 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 rounded transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Text display area */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="text-2xl text-white font-mono leading-relaxed break-words">
          {text}
          {cursorVisible && (
            <span className="inline-block w-0.5 h-8 bg-blue-500 ml-1 align-middle" />
          )}
        </div>
        
        {text.length === 0 && (
          <div className="text-gray-600 text-lg italic">
            Start spelling to see text appear here...
          </div>
        )}
      </div>

      {/* Word predictions */}
      {predictions.length > 0 && (
        <div className="px-4 py-3 bg-gray-900 border-t border-gray-800">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
            Word Suggestions
          </div>
          <div className="flex gap-2 flex-wrap">
            {predictions.map((word, idx) => (
              <button
                key={idx}
                onClick={() => onSelectPrediction?.(word)}
                className="px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-blue-200 text-sm rounded-md transition-colors border border-blue-700"
              >
                {word}
              </button>
            ))}
          </div>
          
          {lastWord && (
            <div className="text-xs text-gray-600 mt-2">
              Completing: "<span className="text-gray-400">{lastWord}</span>"
            </div>
          )}
        </div>
      )}

      {/* Copy to clipboard */}
      {text.length > 0 && (
        <div className="px-4 py-2 bg-gray-900 border-t border-gray-800">
          <button
            onClick={() => navigator.clipboard.writeText(text)}
            className="w-full px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded transition-colors"
          >
            📋 Copy to Clipboard
          </button>
        </div>
      )}
    </div>
  );
});

export default TextOutputPanel;
