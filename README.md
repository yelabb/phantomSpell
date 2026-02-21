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
| **PhantomLink** | MC_Maze Dataset | 142 | 40 Hz | WebSocket (MessagePack) |
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

## �🏗 Architecture

PhantomLoop is a single-page React application with modular state management:

### System Overview
```
┌─────────────────────────┐     ┌─────────────────────────┐
│      Simulations        │     │      EEG Devices        │
│    (---ch @ --Hz)       │     │     (1-16ch @ 250Hz)    │
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
│  Dynamic Decoders │  │  Visualizations   │  │  Metrics Engine   │
│  (JS / TFJS)      │  │  (15+ components) │  │  (accuracy, FPS)  │
└───────────────────┘  └───────────────────┘  └───────────────────┘
```

### Core Components
1. **Stream Adapters** - Unified interface for any multichannel data source
2. **WebSocket Client** - Binary MessagePack protocol (40Hz streaming)
3. **State Management** - Zustand with 5 specialized slices
4. **Decoder Engine** - Supports JavaScript and TensorFlow.js models (dynamic input shapes)
5. **Visualization Suite** - 2D arena, neural activity, performance metrics

### State Slices (Zustand)
- **connectionSlice**: WebSocket lifecycle, session management
- **streamSlice**: Packet buffering with throttled updates (20Hz UI refresh)
- **decoderSlice**: Decoder registry, execution, loading states
- **metricsSlice**: Accuracy tracking, latency monitoring, error statistics
- **unifiedStreamSlice**: Stream source selection, adapter state, N-channel buffer

### Decoder Execution
- **JavaScript**: Direct execution in main thread (<1ms)
- **TensorFlow.js**: Web Worker execution (5-10ms)
- **Dynamic Models**: Input shape adapts to stream channel count
- **Timeout protection**: 10ms limit per inference
- **Error handling**: Falls back to passthrough on failure

---

## 🧠 Built-in Decoders

### JavaScript Baselines
| Decoder | Description |
|---------|-------------|
| **Passthrough** | Perfect tracking baseline (copies ground truth) |
| **Delayed** | 100ms lag test for desync detection |
| **Velocity Predictor** | Linear prediction using velocity |
| **Spike-Based Simple** | Naive spike-rate modulated decoder |

### TensorFlow.js Models
| Model | Architecture | Parameters |
|-------|--------------|------------|
| **Linear (OLE)** | Optimal Linear Estimator (N→2) | ~290 |
| **MLP** | Multi-layer perceptron (N→128→64→2) | ~27K |
| **LSTM** | Temporal decoder with 10-step history | ~110K |
| **BiGRU Attention** | Bidirectional GRU with max pooling | ~85K |
| **Kalman-Neural Hybrid** | MLP + Kalman fusion (α=0.6) | ~27K |

> All TensorFlow.js models support **dynamic input shapes** – they auto-adapt to the stream's channel count!

---

## 📝 Code Editor

Write custom decoders with a **VS Code-quality editing experience**:

- **Monaco Editor** with full IntelliSense
- **TensorFlow.js autocomplete** for `tf.layers`, `tf.sequential()`, etc.
- **AI-powered code generation** via Groq (natural language → code)
- **Quick templates** for MLP, LSTM, CNN, Attention architectures
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
| **Data Rate** | 40 Hz | From PhantomLink backend |
| **UI Refresh** | 60 FPS | Throttled to 20Hz for React |
| **Total Latency** | <50ms | Network + Decoder + Render |
| **Decoder Timeout** | 10ms | Auto-fallback on timeout |

- **Desync detection** when latency exceeds threshold
- **Web Worker decoders** for non-blocking computation
- **Draggable/resizable panels** with localStorage persistence

---

## 🛠 Configuration

### Environment Variables

Create `.env.local`:

```bash
VITE_PHANTOMLINK_URL=wss://phantomlink.fly.dev
```

### Constants

Edit [src/utils/constants.ts](src/utils/constants.ts):

```typescript
// Color scheme
export const COLORS = {
  BIOLINK: '#00FF00',    // Green - Ground Truth
  LOOPBACK: '#0080FF',   // Blue - Decoder Output
  TARGET: '#FF00FF',     // Magenta - Active Target
};

// Performance monitoring
export const PERFORMANCE_THRESHOLDS = {
  TARGET_FPS: 60,
  MAX_TOTAL_LATENCY_MS: 50,
  DESYNC_THRESHOLD_MS: 50,
  DECODER_TIMEOUT_MS: 10,
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

