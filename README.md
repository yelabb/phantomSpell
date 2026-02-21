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

- **� P300 Matrix Speller** – 6×6 character grid with row/column flashing paradigm
- **🧠 EEG Device Support** – Optimized for PiEEG 8-channel, supports OpenBCI, Muse, LSL devices
- **⚡ Real-Time Classification** – TensorFlow.js models with WebGPU/WebGL acceleration
- **📚 Training & Calibration** – Supervised learning with copy-spelling tasks
- **💬 Word Prediction** – Smart autocomplete for faster communication
- **📊 Performance Metrics** – Accuracy tracking, ITR (bits/min), selection confidence
- **🎯 Signal Quality Monitoring** – Real-time electrode impedance and contact feedback
- **🔧 Brainflow Integration** – Export configurations for any Brainflow-compatible EEG device

---

## 📡 Universal EEG Device Support

PhantomSpell supports **any multichannel EEG device** through a unified adapter pattern.

### Supported Devices

| Manufacturer | Device | Channels | Sample Rate | Protocol |
|--------------|--------|----------|-------------|----------|
| **OpenBCI** | Cyton | 8 | 250 Hz | Serial/WiFi |
| **OpenBCI** | Cyton + Daisy | 16 | 125 Hz | Serial/WiFi |
| **OpenBCI** | Ganglion | 4 | 200 Hz | BLE |
| **Muse** | Muse 2 / Muse S | 4 | 256 Hz | BLE |
| **Emotiv** | Insight | 5 | 128 Hz | BLE |
| **Emotiv** | EPOC X | 14 | 128/256 Hz | BLE |
| **NeuroSky** | MindWave | 1 | 512 Hz | Bluetooth |
| **PiEEG** | PiEEG | 8 | 250-16000 Hz | SPI (Raspberry Pi) |
| **PiEEG** | PiEEG-16 | 16 | 250-8000 Hz | SPI (Raspberry Pi) |
| **PiEEG** | IronBCI | 8 | 250 Hz | BLE/WiFi |
| **PiEEG** | IronBCI-32 | 32 | 250 Hz | WiFi |
| **PiEEG** | JNEEG | 8 | 250-2000 Hz | SPI (Jetson Nano) |
| **PiEEG** | ardEEG | 8 | 250 Hz | Serial (Arduino) |
| **PiEEG** | MicroBCI | 8 | 250 Hz | BLE (STM32) |
| **Cerelog** | ESP-EEG | 8 | 250 Hz | WiFi (TCP) |
| **LSL** | Generic (8-64ch) | 8-64 | Variable | Lab Streaming Layer |
| **LSL** | Brain Products | 32+ | Up to 25kHz | LSL (via Connector) |
| **LSL** | BioSemi ActiveTwo | 32+ | Up to 16kHz | LSL |
| **LSL** | g.tec | 16+ | Up to 38kHz | LSL (g.NEEDaccess) |
| **LSL** | Cognionics | 20-30 | 500 Hz | LSL |
| **LSL** | ANT Neuro | 32+ | 2048 Hz | LSL |
| **LSL** | NIRx fNIRS | 16+ | 10 Hz | LSL |
| **Brainflow** | Synthetic | 8 | 250 Hz | Virtual |

> ⚠️ **Note:** Browsers cannot connect directly to TCP/Serial/BLE. Hardware devices require a WebSocket bridge (Python scripts included).

### 🥧 PiEEG Integration

[PiEEG](https://pieeg.com) is a low-cost, open-source EEG shield for Raspberry Pi using the ADS1299 ADC. PhantomLoop provides full support for the PiEEG device family:

| Device | Channels | Use Case | Link |
|--------|----------|----------|------|
| **PiEEG** | 8 | Raspberry Pi 3/4/5, research & learning | [pieeg.com/pieeg](https://pieeg.com/pieeg/) |
| **PiEEG-16** | 16 | Extended coverage, dual ADS1299 | [pieeg.com/pieeg-16](https://pieeg.com/pieeg-16/) |
| **IronBCI** | 8 | Wearable, BLE, mobile SDK | [pieeg.com/ironbci](https://pieeg.com/ironbci/) |
| **IronBCI-32** | 32 | High-density research | [pieeg.com/ironbci-32](https://pieeg.com/ironbci-32/) |
| **JNEEG** | 8 | Jetson Nano, GPU-accelerated DL | [pieeg.com/jneeg](https://pieeg.com/jneeg/) |
| **ardEEG** | 8 | Arduino shield, beginner-friendly | [pieeg.com/ardeeg](https://pieeg.com/ardeeg/) |
| **MicroBCI** | 8 | STM32 NUCLEO-WB55, ultra-compact | [pieeg.com/microbci](https://pieeg.com/microbci/) |

**Key Specs:**
- 24-bit resolution (ADS1299)
- Programmable gain: 1, 2, 4, 6, 8, 12, 24
- Configurable sample rates: 250-16000 SPS
- Supports EEG, EMG, and ECG signals
- BrainFlow compatible (board ID: 46)

⚠️ **Safety:** PiEEG must be powered by battery only (5V). Never connect to mains power!

### 🌐 Lab Streaming Layer (LSL) Integration

[Lab Streaming Layer (LSL)](https://labstreaminglayer.org) is the universal protocol for streaming EEG and biosignal data in research settings. PhantomLoop supports **130+ LSL-compatible devices** through the included WebSocket bridge.

**Key Features:**
- Real-time stream discovery on local network
- Sub-millisecond time synchronization
- Multi-stream support (EEG, markers, motion)
- Automatic reconnection on stream loss

**LSL-Compatible Devices:**

| Manufacturer | Devices | Notes |
|--------------|---------|-------|
| **Brain Products** | actiCHamp, LiveAmp, BrainVision | Via LSL Connector app |
| **BioSemi** | ActiveTwo 32-256ch | Research gold standard |
| **g.tec** | g.USBamp, g.Nautilus, g.HIamp | Via g.NEEDaccess |
| **ANT Neuro** | eego sport, eego mylab | Mobile & lab EEG |
| **Cognionics** | Quick-20, Quick-30, Mobile-72 | Dry electrode systems |
| **OpenBCI** | All models | Via OpenBCI GUI LSL |
| **Muse** | Muse 1/2/S | Via muse-lsl |
| **Emotiv** | EPOC, Insight, EPOC Flex | Via EmotivPRO LSL |
| **NIRx** | NIRSport, NIRScout | fNIRS devices |
| **Tobii** | Pro Glasses, Screen-based | Eye tracking |
| **Neurosity** | Notion, Crown | Consumer EEG |
| **BrainAccess** | HALO, MINI, MIDI | Affordable research EEG |

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

** PiEEG (Raspberry Pi)**
```bash
# 1. Connect PiEEG shield to Raspberry Pi GPIO
# 2. Enable SPI: sudo raspi-config → Interface Options → SPI
# 3. Run the WebSocket bridge on the Pi
pip install websockets spidev RPi.GPIO numpy
python scripts/pieeg_ws_bridge.py --rate 250 --gain 24

# 4. In PhantomLoop, connect to ws://<raspberry-pi-ip>:8766
# 5. Select "PiEEG" in the device selector
```

** Lab Streaming Layer (130+ Devices)**
```bash
# 1. Start your LSL source (OpenBCI GUI, muse-lsl, BrainVision, etc.)
# 2. Run the LSL WebSocket bridge
pip install websockets pylsl numpy
python scripts/lsl_ws_bridge.py

# 3. In PhantomLoop, connect to ws://localhost:8767
# 4. Select "LSL Stream" in the device selector

# Advanced: Connect to specific stream by name
python scripts/lsl_ws_bridge.py --stream "OpenBCI_EEG"

# List available LSL streams on your network
python scripts/lsl_ws_bridge.py --list
```

** Cerelog ESP-EEG (WiFi)**
```bash
# 1. Connect to ESP-EEG WiFi: SSID: CERELOG_EEG, Password: cerelog123
# 2. Run the WebSocket bridge
pip install websockets
python scripts/cerelog_ws_bridge.py

# 3. Select "Cerelog ESP-EEG" in PhantomLoop
```

---

## WebSocket Bridges

Since browsers cannot directly access hardware (SPI, Serial, BLE, TCP), PhantomLoop includes Python bridge scripts that expose devices via WebSocket:

| Script | Device | Port | Mode |
|--------|--------|------|------|
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

# Connect to Muse via muse-lsl
python scripts/lsl_ws_bridge.py --stream "Muse" --type EEG

# List available streams on network
python scripts/lsl_ws_bridge.py --list

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

**Response: Stream Metadata**
```json
{
  "type": "metadata",
  "stream": {
    "name": "OpenBCI_EEG",
    "stream_type": "EEG",
    "channel_count": 8,
    "sampling_rate": 250.0,
    "channel_labels": ["Fp1", "Fp2", "C3", "C4", "P3", "P4", "O1", "O2"]
  }
}
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

**WebSocket Commands:**
```json
{"command": "connect"}
{"command": "disconnect"}
{"command": "set_gain", "gain": 24}
{"command": "set_sample_rate", "rate": 500}
```

### PiEEG Bridge with DSP (Signal Hygiene)

The DSP-enhanced bridge applies real-time digital signal processing before streaming, removing common EEG artifacts at the source:

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

# Minimal processing (DC block only)
python scripts/pieeg_ws_bridge_dsp.py --no-notch --no-bandpass

# High sample rate with adjusted filters
python scripts/pieeg_ws_bridge_dsp.py --sample-rate 500 --notch 60 --lowpass 100
```

**All DSP Options:**
```bash
# Network
--host 0.0.0.0          # WebSocket bind address
--port 8766             # WebSocket port

# Hardware
--sample-rate 250       # 250, 500, 1000, 2000 Hz
--gain 24               # PGA gain: 1, 2, 4, 6, 8, 12, 24
--channels 8            # Number of channels

# Notch Filter
--notch 60              # Powerline frequency (50 or 60 Hz)
--notch-harmonics 3     # Filter fundamental + N harmonics
--notch-q 30            # Quality factor (higher = narrower)
--no-notch              # Disable notch filter

# Bandpass Filter
--highpass 0.5          # High-pass cutoff (Hz)
--lowpass 45            # Low-pass cutoff (Hz)
--filter-order 4        # Butterworth order
--no-bandpass           # Disable bandpass filter

# DC Blocking
--dc-alpha 0.995        # DC blocker pole (0.99-0.999)
--no-dc-block           # Disable DC blocking

# Artifact Rejection
--artifact-threshold 150  # Threshold in µV
--no-artifact            # Disable artifact rejection

# Common Average Reference
--car                    # Enable CAR
--car-exclude "0,7"      # Exclude channels from CAR

# Smoothing
--smooth 0.3             # Exponential smoothing alpha (0 = disabled)
```

**Extended Packet Format:**

DSP packets include artifact flags per sample:
```
Header: magic(2) + type(1) + samples(2) + channels(1) + timestamp(8)
Data:   [float32 × channels + artifact_byte] × samples
```
- `type = 0x02` indicates DSP-processed data
- `artifact_byte` is a bitmask of channels with blanked artifacts

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
│  P300 Classifiers │  │  Speller Grid     │  │  Metrics Engine   │
│  (TFJS / Custom)  │  │  (6×6 matrix)     │  │  (ITR, accuracy)  │
└───────────────────┘  └───────────────────┘  └───────────────────┘
```

### Core Components
1. **Stream Adapters** - Unified interface for any multichannel EEG device
2. **WebSocket Client** - Binary MessagePack protocol for real-time streaming
3. **State Management** - Zustand with 5 specialized slices (connection, stream, decoder, metrics, training)
4. **P300 Classifier Engine** - TensorFlow.js models with dynamic channel support
5. **Speller Grid** - 6×6 character matrix with row/column flashing paradigm
6. **Calibration System** - Copy-spelling task with labeled data collection

### State Slices (Zustand)
- **connectionSlice**: WebSocket lifecycle, session management
- **streamSlice**: EEG packet buffering with epoching for flash events
- **decoderSlice**: P300 classifier registry, execution, loading states
- **metricsSlice**: ITR tracking, accuracy monitoring, character selection stats
- **trainingSlice**: Calibration data collection and model training workflow

### P300 Classification Pipeline
1. **Flash Event** → Row/column illuminates for 125ms
2. **Epoch Extraction** → Capture 0-800ms post-flash EEG from all channels
3. **Preprocessing** → Bandpass filter (0.5-30 Hz), baseline correction
4. **Classification** → TensorFlow.js model predicts target vs. non-target
5. **Aggregation** → Accumulate scores across multiple flash cycles
6. **Character Selection** → Intersect highest-scoring row and column

---

## 🧠 P300 Classification Models

PhantomSpell uses machine learning to detect P300 event-related potentials (ERPs) in EEG signals and classify which row/column the user is attending to.

### TensorFlow.js Classifiers

| Model | Architecture | Description |
|-------|--------------|-------------|
| **Linear Classifier** | Dense(N×600 → 2) | Simple logistic regression on epoched EEG. Fast baseline. |
| **CNN-ERP** | Conv1D(3 layers) → Dense → Sigmoid | Convolutional classifier for temporal ERP patterns. |
| **LSTM-P300** | LSTM(64) → Dense(32) → Dense(2) | Recurrent model captures P300 waveform dynamics. |
| **EEGNet** | Depthwise Conv2D → Separable Conv2D | Compact architecture designed for ERP classification. |
| **Attention-ERP** | Multi-head Attention → Dense | Learns channel importance and temporal features. |

**Input:** Epoched EEG data (typically 0-800ms post-flash, all channels)  
**Output:** Binary classification (target vs. non-target) with confidence score

### Training & Calibration

1. **Copy-Spelling Task** – User focuses on displayed characters while system collects labeled EEG data
2. **Data Augmentation** – Synthetic noise injection and temporal jittering to improve robustness
3. **Online Learning** – Models can update incrementally during use to adapt to signal drift

> All models support **dynamic channel counts** and auto-adapt to your EEG device (4-64 channels).

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

### Deploy to Cloudflare Pages

```bash
npm run build
npx wrangler pages deploy dist
```

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
| **Code Editor** | Monaco Editor |
| **Protocol** | MessagePack (binary) |
| **Testing** | Vitest + Cypress |

## ⚡ Real-Time Performance

| Metric | Target | Notes |
|--------|--------|-------|
| **EEG Sample Rate** | 250+ Hz | Minimum for P300 detection |
| **Flash Rate** | 125ms flash + 75ms ISI | Standard P300 timing |
| **Classification Latency** | <100ms | TensorFlow.js inference time |
| **ITR (Bits/Min)** | 15-40 | Information Transfer Rate depends on accuracy |
| **Selection Time** | 10-15s | Per character (including multiple trial cycles) |

- **Event-locked epoching** for precise stimulus alignment
- **Web Worker classification** for non-blocking computation
- **Adaptive trial count** based on classification confidence
- **Real-time signal quality monitoring** with electrode impedance feedback

---

## 🛠 Configuration

### Environment Variables

Create `.env.local`:

```bash
VITE_WEBSOCKET_URL=ws://localhost:8766  # Default WebSocket bridge URL
VITE_GROQ_API_KEY=your_groq_api_key     # Optional: for AI code generation
```

### Constants

Edit [src/utils/constants.ts](src/utils/constants.ts):

```typescript
// P300 Speller Timing
export const P300_TIMING = {
  FLASH_DURATION_MS: 125,
  INTER_FLASH_INTERVAL_MS: 75,
  TRIAL_COUNT: 10,
  POST_SELECTION_PAUSE_MS: 1500,
};

// Color scheme
export const COLORS = {
  FLASH_ACTIVE: '#FFFF00',    // Yellow - Active flash
  FLASH_TARGET: '#00FF00',    // Green - Target (calibration)
  SELECTED_CHAR: '#00AAFF',   // Blue - Selected character
  GRID_DEFAULT: '#333333',    // Dark gray - Grid background
};

// Performance thresholds
export const PERFORMANCE_THRESHOLDS = {
  MIN_CLASSIFICATION_CONFIDENCE: 0.6,
  MIN_ITR_BITS_PER_MIN: 10,
  MAX_CLASSIFICATION_LATENCY_MS: 100,
};
```

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

This project was developed with assistance from AI coding assistants:
- Claude Opus 4.5 & Sonnet 4.5 (Anthropic)
- Grok code fast 1 (xAI)
- Gemini 3.0 Pro (Google)

---

<div align="center">


</div>

