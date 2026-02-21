// wordPrediction.ts - Simple word prediction/autocomplete for P300 speller

// Common English words sorted by frequency (top 1000)
const COMMON_WORDS = [
  // Top 100 most common words
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
  'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
  'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
  'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
  'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
  
  // Additional common words
  'need', 'help', 'yes', 'no', 'please', 'thank', 'sorry', 'hello', 'water',
  'food', 'pain', 'tired', 'hungry', 'happy', 'sad', 'angry', 'sick', 'cold',
  'hot', 'bathroom', 'bed', 'chair', 'phone', 'computer', 'music', 'tv', 'book',
  'read', 'write', 'listen', 'watch', 'eat', 'drink', 'sleep', 'wake', 'stand',
  'sit', 'walk', 'run', 'stop', 'start', 'open', 'close', 'turn', 'push', 'pull',
];

/**
 * Get word predictions based on current partial word
 * @param partialWord - The incomplete word to complete
 * @param maxResults - Maximum number of predictions to return
 * @returns Array of predicted words
 */
export function getWordPredictions(partialWord: string, maxResults = 5): string[] {
  if (!partialWord || partialWord.length === 0) {
    // Return most common words if no context
    return COMMON_WORDS.slice(0, maxResults);
  }

  const partial = partialWord.toLowerCase();
  const predictions: string[] = [];

  // Find words that start with the partial word
  for (const word of COMMON_WORDS) {
    if (word.startsWith(partial)) {
      predictions.push(word);
      if (predictions.length >= maxResults) {
        break;
      }
    }
  }

  // If we don't have enough predictions, add words containing the partial
  if (predictions.length < maxResults) {
    for (const word of COMMON_WORDS) {
      if (!word.startsWith(partial) && word.includes(partial)) {
        predictions.push(word);
        if (predictions.length >= maxResults) {
          break;
        }
      }
    }
  }

  return predictions;
}

/**
 * Get next word predictions based on context (previous word)
 * Simple bigram-based prediction
 */
export function getNextWordPredictions(previousWord: string, maxResults = 5): string[] {
  const word = previousWord.toLowerCase();

  // Simple bigram rules (can be expanded)
  const bigrams: Record<string, string[]> = {
    'i': ['am', 'need', 'want', 'have', 'can', 'will'],
    'you': ['are', 'can', 'will', 'need', 'want'],
    'the': ['the', 'a', 'an', 'this', 'that'],
    'need': ['help', 'water', 'food', 'to', 'a'],
    'want': ['to', 'a', 'the', 'some', 'more'],
    'can': ['you', 'i', 'we', 'help', 'see'],
    'help': ['me', 'please', 'with', 'you'],
    'please': ['help', 'call', 'give', 'turn'],
    'thank': ['you'],
    'am': ['tired', 'hungry', 'sick', 'happy', 'sad'],
    'are': ['you', 'we', 'they'],
    'is': ['it', 'this', 'that', 'he', 'she'],
  };

  if (bigrams[word]) {
    return bigrams[word].slice(0, maxResults);
  }

  // Fall back to most common words
  return COMMON_WORDS.slice(0, maxResults);
}

/**
 * Auto-correct common spelling mistakes
 */
export function autoCorrect(word: string): string {
  const corrections: Record<string, string> = {
    'teh': 'the',
    'adn': 'and',
    'cna': 'can',
    'taht': 'that',
    'waht': 'what',
    'whta': 'what',
    'hte': 'the',
    'ot': 'to',
    'fo': 'of',
  };

  return corrections[word.toLowerCase()] || word;
}

/**
 * Calculate Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Find closest word match (for error correction)
 */
export function findClosestWord(word: string, maxDistance = 2): string | null {
  const wordLower = word.toLowerCase();
  let bestMatch: string | null = null;
  let bestDistance = Infinity;

  for (const candidate of COMMON_WORDS) {
    const distance = levenshteinDistance(wordLower, candidate);
    if (distance <= maxDistance && distance < bestDistance) {
      bestMatch = candidate;
      bestDistance = distance;
    }
  }

  return bestMatch;
}

/**
 * Get smart predictions combining current word completion and next word suggestions
 */
export function getSmartPredictions(text: string, maxResults = 5): string[] {
  const words = text.trim().split(/\s+/);
  
  if (words.length === 0 || text.endsWith(' ')) {
    // Predict next word based on previous word
    const previousWord = words[words.length - 1] || '';
    return getNextWordPredictions(previousWord, maxResults);
  } else {
    // Complete current word
    const currentWord = words[words.length - 1];
    return getWordPredictions(currentWord, maxResults);
  }
}

/**
 * Add custom word to vocabulary (for personalization)
 */
const customWords: string[] = [];

export function addCustomWord(word: string): void {
  const wordLower = word.toLowerCase();
  if (!COMMON_WORDS.includes(wordLower) && !customWords.includes(wordLower)) {
    customWords.unshift(wordLower);
  }
}

/**
 * Get all available words (common + custom)
 */
export function getAllWords(): string[] {
  return [...customWords, ...COMMON_WORDS];
}
