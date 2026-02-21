# PhantomSpell Implementation Roadmap

**Project:** P300-Based BCI Speller  
**Stack:** Vite + React + TypeScript + TensorFlow.js  
**Target:** Real-time character selection using EEG P300 signals

---

## ✅ Phase 1: Core Infrastructure (COMPLETED)

### 1.1 Project Rebranding ✅
- [x] Renamed project from PhantomLoop to PhantomSpell
- [x] Updated package.json, README.md, index.html
- [x] Updated branding across UI components
- [x] Changed focus from motor decoding to P300 speller

### 1.2 Type System Updates ✅
- [x] Extended decoder types for P300 classification
- [x] Added `P300Output` interface (row/col predictions)
- [x] Added `P300TrainingData` for calibration
- [x] Added `P300ModelConfig` for model parameters
- [x] Updated store slices with P300-specific state

### 1.3 Core Components ✅
- [x] `SpellerGrid.tsx` - 6x6 character matrix with row/column flashing
- [x] `TextOutputPanel.tsx` - Output display with word predictions
- [x] `P300CalibrationPanel.tsx` - Training/calibration interface
- [x] `SpellerDashboard.tsx` - Main speller interface
- [x] `wordPrediction.ts` - Smart autocomplete system

---

## 🚧 Phase 2: P300 Signal Processing (IN PROGRESS)

### 2.1 EEG Data Pipeline
- [ ] Create `useP300Data` hook for EEG epoch extraction
  - [ ] Synchronize flash events with EEG timestamps
  - [ ] Extract epochs (600-800ms windows post-flash)
  - [ ] Apply baseline correction (-200ms to 0ms)
  - [ ] Buffer epochs for batch processing
- [ ] Implement signal preprocessing utilities:
  - [ ] Bandpass filter (0.1-30 Hz for P300)
  - [ ] Common Average Reference (CAR) spatial filter
  - [ ] Laplacian spatial filter (optional)
  - [ ] Artifact rejection (amplitude threshold)
  - [ ] Downsampling (if needed)

### 2.2 Feature Extraction
- [ ] Create `p300Features.ts` utility:
  - [ ] Temporal features (amplitude at P300 peak ~300-500ms)
  - [ ] Spatial features (channel differences)
  - [ ] Area under curve features
  - [ ] Peak-to-peak amplitude
  - [ ] Latency features

### 2.3 Real-time EEG Streaming
- [ ] Update bridges to output properly formatted EEG data:
  - [ ] `pieeg_ws_bridge.py` - Ensure 8-channel output
  - [ ] Timestamp synchronization with browser
  - [ ] Verify sample rate consistency (250 Hz target)
- [ ] Create EEG buffer in store:
  - [ ] Circular buffer for continuous EEG (sliding window)
  - [ ] Event markers for flash onsets
  - [ ] Quality monitoring (signal-to-noise ratio)

---

## 🧠 Phase 3: P300 Decoder Implementation

### 3.1 Baseline Decoder (Simple)
- [ ] Create `p300Baseline.ts`:
  - [ ] Peak detection at expected P300 latency
  - [ ] Simple averaging across trials
  - [ ] Threshold-based classification
  - [ ] Serve as baseline for comparison

### 3.2 Linear Discriminant Analysis (LDA)
- [ ] Create `p300LDA.ts`:
  - [ ] Stepwise LDA for P300 vs non-P300
  - [ ] Feature selection (best channels + time points)
  - [ ] Fast inference (<10ms)
  - [ ] Good for real-time performance

### 3.3 TensorFlow.js CNN Model
- [ ] Create `p300CNN.ts`:
  - [ ] 1D CNN architecture for temporal classification
  - [ ] Input: [channels, samples] EEG epoch
  - [ ] Output: [probability target, probability non-target]
  - [ ] Training pipeline with data augmentation
  - [ ] Model saving/loading (IndexedDB)

### 3.4 Advanced: EEGNet Architecture
- [ ] Implement EEGNet model (state-of-the-art for ERP classification):
  - [ ] Temporal convolution layer
  - [ ] Depthwise spatial convolution
  - [ ] Separable convolution layers
  - [ ] Optimized for small datasets (~5-10 min calibration)

---

## 📊 Phase 4: Training & Calibration System

### 4.1 Calibration Protocol
- [ ] Implement copy-spelling task:
  - [ ] Present target characters in sequence
  - [ ] User focuses on indicated character
  - [ ] Collect labeled P300 data (target vs non-target)
  - [ ] Minimum 5 trials × 36 characters = 180 trials
  - [ ] Duration: ~10-15 minutes

### 4.2 Online Learning
- [ ] Implement adaptive decoder:
  - [ ] Update model after each selection (if high confidence)
  - [ ] Error correction mechanism
  - [ ] Gradual improvement over session
  - [ ] Drift compensation

### 4.3 Model Persistence
- [ ] Save trained models per user:
  - [ ] IndexedDB storage for TensorFlow.js models
  - [ ] LocalStorage for LDA weights
  - [ ] User profiles (multiple users on same device)
  - [ ] Export/import model files

---

## 🎯 Phase 5: Performance Optimization

### 5.1 Speed Optimization
- [ ] Implement dynamic stopping:
  - [ ] Stop trials early if high confidence achieved
  - [ ] Reduce from 10 trials to 3-5 if clear P300
  - [ ] Boost ITR (Information Transfer Rate)

### 5.2 Accuracy Improvement
- [ ] Implement uncertainty estimation:
  - [ ] Confidence scores for each prediction
  - [ ] Request confirmation for low-confidence selections
  - [ ] Error correction UI

### 5.3 Latency Reduction
- [ ] Optimize rendering pipeline:
  - [ ] Reduce flash timing jitter
  - [ ] Use requestAnimationFrame precisely
  - [ ] Web Workers for decoder inference
  - [ ] WebGPU acceleration (if available)

---

## 🎨 Phase 6: UI/UX Enhancements

### 6.1 Advanced Features
- [ ] Multiple flash paradigms:
  - [ ] Row-column (standard)
  - [ ] Checkerboard pattern (faster)
  - [ ] Region-based (4 quadrants)
  - [ ] Single character flash (slower but more accurate)
- [ ] Customizable grid:
  - [ ] 5x5 (25 chars)
  - [ ] 6x6 (36 chars - default)
  - [ ] 9x9 (81 chars including special symbols)
  - [ ] Custom layouts (emoji, numbers only, etc.)

### 6.2 Advanced Word Prediction
- [ ] Integrate language model:
  - [ ] N-gram model for word prediction
  - [ ] Frequency-based ranking
  - [ ] Context-aware suggestions
  - [ ] Custom vocabulary expansion

### 6.3 Accessibility
- [ ] High contrast mode
- [ ] Adjustable flash brightness/duration
- [ ] Audio feedback for selections
- [ ] Undo/redo functionality
- [ ] Voice output (text-to-speech)

---

## 🧪 Phase 7: Testing & Validation

### 7.1 Unit Tests
- [ ] Test P300 feature extraction
- [ ] Test epoch windowing logic
- [ ] Test decoder inference pipeline
- [ ] Test word prediction accuracy

### 7.2 Integration Tests
- [ ] Test full calibration workflow
- [ ] Test end-to-end spelling session
- [ ] Test model save/load
- [ ] Test reconnection handling

### 7.3 User Testing
- [ ] Pilot studies with real EEG data
- [ ] Measure ITR (bits per minute)
- [ ] Measure accuracy (% correct)
- [ ] Gather UX feedback
- [ ] Optimize based on results

---

## 📦 Phase 8: Deployment & Documentation

### 8.1 Documentation
- [ ] User manual (how to use PhantomSpell)
- [ ] Setup guide (EEG device connection)
- [ ] Calibration best practices
- [ ] Troubleshooting guide
- [ ] API documentation for custom decoders

### 8.2 Deployment
- [ ] Build production bundle
- [ ] Deploy to Vercel/Netlify
- [ ] Setup CI/CD pipeline
- [ ] Performance monitoring
- [ ] Error tracking (Sentry)

### 8.3 Community
- [ ] Create demo video
- [ ] Write blog post on P300 BCI
- [ ] GitHub repository cleanup
- [ ] License selection
- [ ] Contribution guidelines

---

## 🔬 Future Research Directions

### Advanced BCI Paradigms
- [ ] SSVEP speller (frequency-coded targets)
- [ ] Hybrid P300 + SSVEP
- [ ] Motor imagery selection
- [ ] Auditory P300 (for visual impairment)

### Machine Learning Improvements
- [ ] Transfer learning (pre-trained models)
- [ ] Multi-subject adaptation
- [ ] Domain adaptation techniques
- [ ] Few-shot learning for new users

### Hardware Optimization
- [ ] PiEEG 16-channel support
- [ ] Optimize for specific electrode montages
- [ ] Active electrode impedance monitoring
- [ ] Real-time signal quality feedback

---

## 🎯 Current Priority (Next Sprint)

**Focus:** Phase 2 (P300 Signal Processing)

1. Create EEG epoch extraction hook
2. Implement bandpass filter (0.1-30 Hz)
3. Test with synthetic P300 data
4. Verify timing accuracy (<10ms jitter)
5. Build simple baseline decoder (peak detection)

**Goal:** Demonstrate working P300 detection with synthetic/recorded EEG data

---

## Performance Targets

- **Accuracy:** >80% character selection accuracy
- **Speed:** <30 seconds per character (initial), <15s (optimized)
- **ITR:** >5 bits/minute (initial), >10 bits/min (optimized)
- **Latency:** <100ms decoder processing time
- **Calibration:** <15 minutes for initial training
- **Usability:** 3-click setup for new users

---

## Notes

- PiEEG 8-channel is primary target device
- Focus on research-grade performance
- Maintain code quality and documentation
- Prioritize user experience for assistive technology use cases
- Keep system open and extensible for research applications
