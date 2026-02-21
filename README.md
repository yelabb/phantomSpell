> **🚧 Work In Progress: Active Engineering Sprint**
>
> This project is currently under active development. Core features are functional but APIs and data structures are subject to rapid iteration. Not yet ready for stable deployment.

<img width="300" alt="logo" src="https://github.com/user-attachments/assets/87525c02-0301-4421-850f-06f96584b9df" />

# PHANTOM SPELL

**P300-Based BCI Speller Interface**

[![React 19](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-4.22-orange.svg)](https://www.tensorflow.org/js)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF.svg)](https://vitejs.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---
<img width="1333" height="931" alt="image" src="https://github.com/user-attachments/assets/7b319c9b-86cd-4535-8dc4-31b4ac066447" />
<img width="1333" alt="image" src="https://github.com/user-attachments/assets/b16e0d63-d623-4586-b255-944a326fc40d" />
<img width="1333" alt="image" src="https://github.com/user-attachments/assets/d08eda0b-afd5-4604-9130-dfb2c778cd37" />
<img width="1333" alt="image" src="https://github.com/user-attachments/assets/89229bc0-196a-4d35-b88f-fa691d432990" />



---

> A brain-computer interface speller that enables letter and word selection using P300 event-related potentials from EEG signals.

## ✨ Key Features

- **🔤 P300 Matrix Speller** – 6×6 character grid with row/column flashing paradigm
- **🧠 EEG Device Support** – Optimized for PiEEG 8-channel, supports OpenBCI, Muse, LSL devices
- **⚡ Real-Time Classification** – LDA baseline classifier + TensorFlow.js models with WebGPU/WebGL acceleration
- **📚 Training & Calibration** – Copy-spelling calibration with LDA model training from labeled EEG epochs
- **💬 Word Prediction** – Smart autocomplete for faster communication
- **📊 Performance Metrics** – Accuracy tracking, ITR (bits/min), selection confidence
- **🎯 Signal Quality Monitoring** – Estimated contact quality via noise proxy (not hardware impedance)
- **🔧 Brainflow Integration** – Export configurations for any Brainflow-compatible EEG device

---

## 🏁 Golden Path: Simulated EEG → Calibration → Spell "HELLO"

This is the single verified path to get PhantomSpell running end-to-end in under 10 minutes, no hardware required.

### Step 1: Start the app

```bash
git clone https://github.com/yelabb/phantomSpell.git
cd phantomSpell
npm install
npm run dev
# Open http://localhost:5173
```

### Step 2: Start the synthetic EEG bridge

In a second terminal:

```bash
cd scripts
python -m venv venv
venv/Scripts/activate   # Windows (or: source venv/bin/activate on Linux/Mac)
pip install websockets brainflow numpy
python synthetic_board_bridge.py
```

This starts a WebSocket server on `ws://localhost:8766` that streams 8-channel synthetic EEG at 250 Hz.

### Step 3: Connect

In the PhantomSpell UI:
1. Click the connection status indicator → enter `ws://localhost:8766` → Connect
2. Verify the stream indicator shows connected with sample rate

### Step 4: Calibrate

1. You start on the **Training** tab. Click **Start Calibration**
2. Read the instructions, click **I'm Ready – Begin Training**
3. Focus on the highlighted target character and count flashes
4. After enough epochs are collected, click **Train Model**
5. The LDA classifier trains on your collected epochs and reports cross-validated accuracy

### Step 5: Spell

1. After calibration completes with acceptable accuracy (>60%), click **Start Spelling**
2. The system switches to free-spelling mode
3. Focus on letters. After each trial cycle, the classifier selects the character with highest P300 response

> **Note:** With simulated EEG (random noise), classification accuracy will be at chance level (~8%). With real EEG and genuine P300 attention, expect 70-85% accuracy after calibration.

---

## 📡 EEG Device Support

PhantomSpell supports multichannel EEG devices through a unified adapter pattern.

### Device Verification Matrix

| Device | Status | Protocol | Verified Path |
|--------|--------|----------|---------------|
| **Brainflow Synthetic** | ✅ Verified | WebSocket bridge | `synthetic_board_bridge.py` |
| **PiEEG 8ch** | ✅ Verified | WebSocket bridge (SPI) | `pieeg_ws_bridge.py` |
| **PiEEG + DSP** | ✅ Verified | WebSocket bridge (SPI+DSP) | `pieeg_ws_bridge_dsp.py` |
| **LSL Generic** | ✅ Verified | WebSocket bridge (LSL) | `lsl_ws_bridge.py` |
| **Cerelog ESP-EEG** | ✅ Verified | WebSocket bridge (TCP) | `cerelog_ws_bridge.py` |
| **OpenBCI Cyton** | 🔧 Supported (via LSL/Brainflow) | Requires LSL bridge | See LSL section |
| **Muse 2 / Muse S** | 🔧 Supported (via muse-lsl) | Requires LSL bridge | See LSL section |
| **Emotiv EPOC X** | 🔧 Supported (via EmotivPRO LSL) | Requires LSL bridge | See LSL section |
| **Other LSL devices** | 🔧 Supported (via LSL) | Requires LSL bridge | See LSL section |

> **✅ Verified** = tested end-to-end with PhantomSpell. **🔧 Supported** = should work via LSL/Brainflow bridge but not yet independently verified.

### Supported Devices

| Manufacturer | Device | Channels | Sample Rate | Protocol |
|--------------|--------|----------|-------------|----------|
| **OpenBCI** | Cyton | 8 | 250 Hz | Serial/WiFi |
| **OpenBCI** | Cyton + Daisy | 16 | 125 Hz | Serial/WiFi |
| **OpenBCI** | Ganglion | 4 | 200 Hz | BLE |
| **Muse** | Muse 2 / Muse S | 4 | 256 Hz | BLE |
| **Emotiv** | Insight | 5 | 128 Hz | BLE |
| **Emotiv** | EPOC X | 14 | 128/256 Hz | BLE |
| **PiEEG** | PiEEG | 8 | 250-16000 Hz | SPI (Raspberry Pi) |
| **PiEEG** | PiEEG-16 | 16 | 250-8000 Hz | SPI (Raspberry Pi) |
| **PiEEG** | IronBCI | 8 | 250 Hz | BLE/WiFi |
| **Cerelog** | ESP-EEG | 8 | 250 Hz | WiFi (TCP) |
| **LSL** | Generic (8-64ch) | 8-64 | Variable | Lab Streaming Layer |
| **Brainflow** | Synthetic | 8 | 250 Hz | Virtual |

> ⚠️ **Note:** Browsers cannot connect directly to TCP/Serial/BLE. Hardware devices require a WebSocket bridge (Python scripts included).

### 🥧 PiEEG Integration

[PiEEG](https://pieeg.com) is a low-cost, open-source EEG shield for Raspberry Pi using the ADS1299 ADC. PhantomSpell provides full support for the PiEEG device family:

| Device | Channels | Use Case | Link |
|--------|----------|----------|------|
| **PiEEG** | 8 | Raspberry Pi 3/4/5, research & learning | [pieeg.com/pieeg](https://pieeg.com/pieeg/) |
| **PiEEG-16** | 16 | Extended coverage, dual ADS1299 | [pieeg.com/pieeg-16](https://pieeg.com/pieeg-16/) |
| **IronBCI** | 8 | Wearable, BLE, mobile SDK | [pieeg.com/ironbci](https://pieeg.com/ironbci/) |

**Key Specs:**
- 24-bit resolution (ADS1299)
- Programmable gain: 1, 2, 4, 6, 8, 12, 24
- Configurable sample rates: 250-16000 SPS
- BrainFlow compatible (board ID: 46)

⚠️ **Safety:** PiEEG must be powered by battery only (5V). Never connect to mains power!

### 🌐 Lab Streaming Layer (LSL) Integration

[Lab Streaming Layer (LSL)](https://labstreaminglayer.org) is the universal protocol for streaming EEG and biosignal data in research settings. PhantomSpell supports LSL-compatible devices through the included WebSocket bridge.

**Key Features:**
- Real-time stream discovery on local network
- Sub-millisecond time synchronization
- Multi-stream support (EEG, markers, motion)
- Automatic reconnection on stream loss

**LSL-Compatible Devices (via bridge):**

| Manufacturer | Devices | Notes |
|--------------|---------|-------|
| **Brain Products** | actiCHamp, LiveAmp, BrainVision | Via LSL Connector app |
| **BioSemi** | ActiveTwo 32-256ch | Research gold standard |
| **g.tec** | g.USBamp, g.Nautilus, g.HIamp | Via g.NEEDaccess |
| **OpenBCI** | All models | Via OpenBCI GUI LSL |
| **Muse** | Muse 1/2/S | Via muse-lsl |
| **Emotiv** | EPOC, Insight, EPOC Flex | Via EmotivPRO LSL |

📚 Full device list: [labstreaminglayer.org](https://labstreaminglayer.org/#checks:certified)

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/yelabb/phantomSpell.git
cd phantomSpell

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:5173 in your browser
```

### Connect to Data Sources

**PiEEG (Raspberry Pi)**
```bash
# 1. Connect PiEEG shield to Raspberry Pi GPIO
# 2. Enable SPI: sudo raspi-config → Interface Options → SPI
# 3. Run the WebSocket bridge on the Pi
pip install websockets spidev RPi.GPIO numpy
python scripts/pieeg_ws_bridge.py --rate 250 --gain 24

# 4. In PhantomSpell, connect to ws://<raspberry-pi-ip>:8766
# 5. Select "PiEEG" in the device selector
```

**Lab Streaming Layer (130+ Devices)**
```bash
# 1. Start your LSL source (OpenBCI GUI, muse-lsl, BrainVision, etc.)
# 2. Run the LSL WebSocket bridge
pip install websockets pylsl numpy
python scripts/lsl_ws_bridge.py

# 3. In PhantomSpell, connect to ws://localhost:8767
# 4. Select "LSL Stream" in the device selector

# Advanced: Connect to specific stream by name
python scripts/lsl_ws_bridge.py --stream "OpenBCI_EEG"

# List available LSL streams on your network
python scripts/lsl_ws_bridge.py --list
```

**Cerelog ESP-EEG (WiFi)**
```bash
# 1. Connect to ESP-EEG WiFi: SSID: CERELOG_EEG, Password: cerelog123
# 2. Run the WebSocket bridge
pip install websockets
python scripts/cerelog_ws_bridge.py

# 3. In PhantomSpell, connect to ws://localhost:8765
```

---

## WebSocket Bridges

Since browsers cannot directly access hardware (SPI, Serial, BLE, TCP), PhantomSpell includes Python bridge scripts that expose devices via WebSocket:

| Script | Device | Port | Mode |
|--------|--------|------|------|
| `synthetic_board_bridge.py` | BrainFlow synthetic board | 8766 | Virtual (no hardware) |
| `lsl_ws_bridge.py` | Any LSL source (130+ devices) | 8767 | LSL Inlet → WebSocket |
| `pieeg_ws_bridge.py` | PiEEG (Raspberry Pi) | 8766 | SPI / BrainFlow / Simulation |
| `pieeg_ws_bridge_dsp.py` | PiEEG + Signal Hygiene | 8766 | SPI + Real-Time DSP |
| `cerelog_ws_bridge.py` | Cerelog ESP-EEG | 8765 | TCP-to-WebSocket |

### LSL Bridge

The LSL bridge connects to any Lab Streaming Layer source and forwards data to the browser:

```bash
# Auto-discover and connect to first EEG stream
python scripts/lsl_ws_bridge.py

# Connect to specific stream by name
python scripts/lsl_ws_bridge.py --stream "OpenBCI_EEG"

# Run with simulated data for testing (no hardware)
python scripts/lsl_ws_bridge.py --simulate

# Custom port
python scripts/lsl_ws_bridge.py --port 8768
```

**WebSocket Commands:**
```json
{"command": "discover"}
{"command": "connect", "name": "OpenBCI_EEG", "stream_type": "EEG"}
{"command": "disconnect"}
{"command": "ping"}
```

### PiEEG Bridge

```bash
# Basic usage (on Raspberry Pi)
python scripts/pieeg_ws_bridge.py

# With options
python scripts/pieeg_ws_bridge.py \
  --rate 500 \        # Sample rate: 250, 500, 1000, 2000, 4000, 8000, 16000
  --gain 24 \         # PGA gain: 1, 2, 4, 6, 8, 12, 24
  --channels 16 \     # 8 or 16 (PiEEG-16)
  --port 8766 \       # WebSocket port
  --brainflow         # Use BrainFlow instead of direct SPI

# Development mode (no hardware - generates synthetic alpha waves)
python scripts/pieeg_ws_bridge.py  # Auto-detects non-Pi systems
```

### PiEEG Bridge with DSP (Signal Hygiene)

The DSP-enhanced bridge applies real-time digital signal processing before streaming:

**Signal Hygiene Pipeline:**
```
Raw ADS1299 → DC Block → Notch (50/60 Hz) → Bandpass (0.5-45 Hz) → Artifact Reject → CAR → WebSocket
```

| Filter | Purpose | Default |
|--------|---------|--------|
| DC Blocker | Removes electrode drift | α=0.995 (~0.8 Hz) |
| Notch Filter | Removes powerline + harmonics | 60 Hz (3 harmonics) |
| Bandpass | Isolates EEG band | 0.5-45 Hz (order 4) |
| Artifact Rejection | Blanks amplitude spikes | ±150 µV threshold |
| CAR | Common Average Reference | Disabled by default |

```bash
# Basic usage with 60 Hz notch (Americas, Asia)
python scripts/pieeg_ws_bridge_dsp.py --notch 60

# European 50 Hz with custom bandpass
python scripts/pieeg_ws_bridge_dsp.py --notch 50 --highpass 1.0 --lowpass 40

# Full signal hygiene with artifact rejection and CAR
python scripts/pieeg_ws_bridge_dsp.py --notch 60 --car --artifact-threshold 150
```

### Cerelog Bridge

```bash
python scripts/cerelog_ws_bridge.py --esp-ip 192.168.4.1 --esp-port 1112
```

---

## 🏗 Architecture

PhantomSpell is a single-page React application with modular state management:

### System Overview
```
┌─────────────────────────┐     ┌─────────────────────────┐
│      Simulations        │     │      EEG Devices        │
│    (8-64ch @ 250Hz+)    │     │     (4-64ch @ 250Hz+)   │
└───────────┬─────────────┘     └───────────┬─────────────┘
            │                               │
            └───────────────┬───────────────┘
                            │
                    ┌────────────▼────────────┐
                    │    StreamSource API     │
                    │  connect() / onSample() │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Zustand Store         │
                    │   (5 specialized slices)│
                    └────────────┬────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
┌─────────▼─────────┐  ┌─────────▼─────────┐  ┌─────────▼─────────┐
│  P300 Pipeline    │  │  Speller Grid     │  │  Metrics Engine   │
│  Markers → Epoch  │  │  (6×6 matrix)     │  │  (ITR, accuracy)  │
│  → LDA / TFJS     │  │  rAF flash timing │  │                   │
└───────────────────┘  └───────────────────┘  └───────────────────┘
```

### P300 Classification Pipeline (implemented)
1. **Flash Event** → Row/column illuminates for 125ms (via `requestAnimationFrame`)
2. **Marker Recording** → Frame-accurate timestamp aligned to EEG stream clock
3. **Epoch Extraction** → [-200ms, +800ms] window around flash onset from circular EEG buffer
4. **Preprocessing** → Bandpass filter (0.5-30 Hz), CAR, baseline correction
5. **Classification** → LDA classifier (or TFJS model) predicts target vs. non-target score
6. **Aggregation** → Average scores per row/col across all flash cycles
7. **Character Selection** → Intersect highest-scoring row and column

### Core Components
1. **Stream Adapters** - Unified interface for any multichannel EEG device
2. **EEG Ring Buffer** - Circular buffer for continuous EEG storage (30s at 250Hz)
3. **Marker Manager** - Aligns flash timestamps (rAF frame time) to EEG sample indices
4. **P300 Pipeline** - Epoch extraction, bandpass filter, CAR, baseline correction
5. **LDA Classifier** - Fisher LDA with regularized covariance, LOO cross-validation
6. **Speller Grid** - 6×6 character matrix with `requestAnimationFrame`-driven flashing
7. **Calibration System** - Copy-spelling task → labeled epochs → LDA training

---

## 🧠 P300 Classification Models

### LDA Baseline (implemented)

The default classifier is **Fisher's Linear Discriminant Analysis**:
- Trains on labeled epochs collected during calibration
- Regularized pooled covariance (Ledoit-Wolf shrinkage)
- Leave-one-out or 10-fold cross-validation for accuracy estimation
- Persists trained weights to localStorage
- Typical accuracy: 70-85% with 8-channel EEG after ~5 min calibration

### TensorFlow.js Classifiers (model definitions ready, training integration in progress)

| Model | Architecture | Status |
|-------|--------------|--------|
| **Linear Classifier** | Dense(N×epoch → 2) | Defined, training WIP |
| **CNN-ERP** | Conv1D(3 layers) → Dense → Sigmoid | Defined, training WIP |
| **LSTM-P300** | LSTM(64) → Dense(32) → Dense(2) | Defined, training WIP |
| **EEGNet** | Depthwise Conv2D → Separable Conv2D | Defined, training WIP |
| **Attention-ERP** | Multi-head Attention → Dense | Defined, training WIP |

**Input:** Epoched EEG data ([-200ms, +800ms] post-flash, all channels)
**Output:** Binary classification (target vs. non-target) with confidence score

### Training & Calibration

1. **Copy-Spelling Task** – User focuses on displayed characters while system collects labeled EEG epochs
2. **LDA Training** – Trained in-browser from collected epochs with cross-validated accuracy report

> TFJS model training from in-browser calibration data is planned but not yet wired end-to-end. The LDA classifier is the current working path.

---

## 📝 Code Editor

Write custom P300 classifiers with a **VS Code-quality editing experience**:

- **Monaco Editor** with full IntelliSense
- **TensorFlow.js autocomplete** for `tf.layers`, `tf.sequential()`, etc.
- **AI-powered code generation** via Groq (natural language → P300 model code)
- **Quick templates** for CNN-ERP, LSTM, Attention, and other ERP classification architectures
- **Real-time validation** with syntax checking and best practices

See [docs/CODE_EDITOR.md](docs/CODE_EDITOR.md) for full documentation.

---

## 🚀 Deployment

### Deploy to Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yelabb/phantomSpell)

```bash
vercel --prod
```

### Deploy to Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/yelabb/phantomSpell)

- Build command: `npm run build`
- Publish directory: `dist`

---

## 🏗 Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | React 19 + TypeScript 5.9 |
| **Build Tool** | Vite 7 |
| **State** | Zustand (slice pattern) |
| **Styling** | Tailwind CSS |
| **Animations** | Framer Motion |
| **ML Runtime** | TensorFlow.js (WebGPU/WebGL) |
| **Classification** | LDA (Fisher) baseline + TFJS models |
| **Code Editor** | Monaco Editor |
| **Protocol** | MessagePack (binary) |
| **Testing** | Vitest + Cypress |

## ⚡ Real-Time Performance

| Metric | Target | Notes |
|--------|--------|-------|
| **EEG Sample Rate** | 250+ Hz | Minimum for P300 detection |
| **Flash Rate** | 125ms flash + 75ms ISI | Standard P300 timing (via rAF) |
| **Classification Latency** | <100ms | LDA: <5ms, TFJS: <100ms |
| **ITR (Bits/Min)** | 15-40 | Information Transfer Rate depends on accuracy |
| **Selection Time** | 10-15s | Per character (including multiple trial cycles) |

- **`requestAnimationFrame`-driven flashing** for frame-accurate stimulus timing
- **Frame timestamp markers** aligned to EEG stream clock for precise epoching
- **Circular EEG buffer** for efficient epoch extraction without memory allocation
- **Web Worker classification** for non-blocking TFJS inference

---

## 🛠 Configuration

### Environment Variables

Create `.env.local`:

```bash
VITE_WEBSOCKET_URL=ws://localhost:8766  # Default WebSocket bridge URL
VITE_GROQ_API_KEY=your_groq_api_key     # Optional: for AI code generation
