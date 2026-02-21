// Decoder state slice - Optimized to separate high-frequency updates

import type { StateCreator } from 'zustand';
import type { Decoder, DecoderOutput, P300Output, P300TrainingData } from '../../types/decoders';
import { clearHistory as clearTFJSHistory } from '../../decoders/tfjsInference';
import { clearDecoderCache } from '../../decoders/executeDecoder';

export interface DecoderSlice {
  activeDecoder: Decoder | null;
  decoderOutput: DecoderOutput | null;
  availableDecoders: Decoder[];
  isDecoderLoading: boolean;
  decoderLoadingMessage: string;
  
  // P300 speller specific
  p300Output: P300Output | null;
  p300TrainingData: P300TrainingData[];
  isTraining: boolean;
  trainingProgress: number; // 0-100
  
  setActiveDecoder: (decoder: Decoder | null) => void;
  updateDecoderOutput: (output: DecoderOutput) => void;
  updateP300Output: (output: P300Output) => void;
  registerDecoder: (decoder: Decoder) => void;
  setDecoderLoading: (isLoading: boolean, message?: string) => void;
  
  // P300 training methods
  addTrainingData: (data: P300TrainingData) => void;
  clearTrainingData: () => void;
  setTrainingStatus: (isTraining: boolean, progress?: number) => void;
  
  resetDecoder: () => void;
}

export const createDecoderSlice: StateCreator<
  DecoderSlice,
  [],
  [],
  DecoderSlice
> = (set, get) => ({
  activeDecoder: null,
  decoderOutput: null,
  availableDecoders: [],
  isDecoderLoading: false,
  decoderLoadingMessage: '',
  
  // P300 state
  p300Output: null,
  p300TrainingData: [],
  isTraining: false,
  trainingProgress: 0,

  setActiveDecoder: (decoder: Decoder | null) => {
    console.log(`[PhantomSpell] Decoder changed:`, decoder?.name || 'None');
    set({ 
      activeDecoder: decoder,
      decoderOutput: null,
      p300Output: null,
    });
  },

  updateDecoderOutput: (output: DecoderOutput) => {
    // Only update the output, don't touch activeDecoder
    set({ decoderOutput: output });
  },
  
  updateP300Output: (output: P300Output) => {
    set({ p300Output: output });
  },

  registerDecoder: (decoder: Decoder) => {
    const { availableDecoders } = get();
    
    // Check if decoder already exists
    const exists = availableDecoders.some(d => d.id === decoder.id);
    if (!exists) {
      set({ 
        availableDecoders: [...availableDecoders, decoder] 
      });
      console.log(`[PhantomSpell] Registered decoder: ${decoder.name}`);
    }
  },

  setDecoderLoading: (isLoading: boolean, message = '') => {
    set({ 
      isDecoderLoading: isLoading,
      decoderLoadingMessage: message,
    });
  },
  
  // P300 training methods
  addTrainingData: (data: P300TrainingData) => {
    const { p300TrainingData } = get();
    set({ p300TrainingData: [...p300TrainingData, data] });
  },
  
  clearTrainingData: () => {
    set({ p300TrainingData: [], trainingProgress: 0 });
  },
  
  setTrainingStatus: (isTraining: boolean, progress = 0) => {
    set({ isTraining, trainingProgress: progress });
  },

  resetDecoder: () => {
    console.log('[PhantomSpell] 🧹 Resetting decoder state');
    console.log('[PhantomSpell] Previous activeDecoder:', get().activeDecoder?.name);
    
    // Clear all decoder-related caches
    clearTFJSHistory();
    clearDecoderCache();
    
    set({ 
      activeDecoder: null,
      decoderOutput: null,
      p300Output: null,
      p300TrainingData: [],
      isDecoderLoading: false,
      decoderLoadingMessage: '',
      isTraining: false,
      trainingProgress: 0,
    });
    
    console.log('[PhantomSpell] ✅ Decoder state reset complete');
  },
});
