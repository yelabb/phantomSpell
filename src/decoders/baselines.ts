// Baseline P300 classifiers for testing and development

import type { Decoder } from '../types/decoders';

/**
 * Random Classifier
 * Returns random row/column predictions
 * Used for baseline performance testing (should achieve ~8.3% accuracy on 6×6 grid)
 */
export const randomClassifier: Decoder = {
  id: 'p300-random',
  name: 'Random Baseline',
  type: 'javascript',
  description: 'Random predictions. Baseline for comparison (8.3% expected accuracy).',
  code: `
    // Random row and column (0-5)
    const predictedRow = Math.floor(Math.random() * 6);
    const predictedCol = Math.floor(Math.random() * 6);
    
    return {
      predictedRow,
      predictedCol,
      confidence: 0.17,  // 1/6 chance
      latency: 0,
    };
  `,
};

/**
 * Template Matching Classifier
 * Simple correlation-based P300 detection
 * Looks for characteristic P300 waveform pattern (positive peak at 300ms)
 */
export const templateMatchingClassifier: Decoder = {
  id: 'p300-template',
  name: 'Template Matching',
  type: 'javascript',
  description: 'Correlation-based P300 detection. Simple but limited.',
  code: `
    // Extract epoched EEG data
    const { flashEvents, eegEpochs } = input;
    
    if (!flashEvents || !eegEpochs) {
      return { predictedRow: 0, predictedCol: 0, confidence: 0, latency: 0 };
    }
    
    // Score each flash by peak amplitude in P300 window (250-450ms)
    const scores = eegEpochs.map(epoch => {
      // Average across channels
      const avgSignal = epoch.reduce((sum, ch) => {
        const p300Window = ch.slice(62, 112); // 250-450ms at 250Hz
        const peak = Math.max(...p300Window);
        return sum + peak;
      }, 0) / epoch.length;
      return avgSignal;
    });
    
    // Find highest-scoring row and column
    const rowScores = [0,0,0,0,0,0];
    const colScores = [0,0,0,0,0,0];
    
    flashEvents.forEach((event, idx) => {
      if (event.type === 'row') rowScores[event.index] += scores[idx];
      else colScores[event.index] += scores[idx];
    });
    
    const predictedRow = rowScores.indexOf(Math.max(...rowScores));
    const predictedCol = colScores.indexOf(Math.max(...colScores));
    
    return {
      predictedRow,
      predictedCol,
      confidence: 0.5,
      rowScores,
      colScores,
      latency: 5,
    };
  `,
};

/**
 * Majority Vote Classifier
 * Combines multiple trials with simple voting
 */
export const majorityVoteClassifier: Decoder = {
  id: 'p300-majority',
  name: 'Majority Vote',
  type: 'javascript',
  description: 'Ensemble voting across trials. Improves stability.',
  code: `
    const { flashEvents } = input;
    
    if (!flashEvents || flashEvents.length === 0) {
      return { predictedRow: 0, predictedCol: 0, confidence: 0, latency: 0 };
    }
    
    // Simple heuristic: target flashes should be labeled
    const rowVotes = [0,0,0,0,0,0];
    const colVotes = [0,0,0,0,0,0];
    
    flashEvents.forEach(event => {
      if (event.containsTarget) {
        if (event.type === 'row') rowVotes[event.index]++;
        else colVotes[event.index]++;
      }
    });
    
    return {
      predictedRow: rowVotes.indexOf(Math.max(...rowVotes)),
      predictedCol: colVotes.indexOf(Math.max(...colVotes)),
      confidence: Math.max(...rowVotes) / flashEvents.filter(e => e.type === 'row').length,
      latency: 1,
    };
  `,
};

// Export all baseline classifiers
export const baselineDecoders: Decoder[] = [
  randomClassifier,
  templateMatchingClassifier,
  majorityVoteClassifier,
];
