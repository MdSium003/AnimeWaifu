# 🌸 Anime Waifu AI

An interactive 3D anime companion powered by AI. Chat with your virtual waifu using voice or text, watch her respond with realistic lip-sync, expressive emotions, and natural body animations.

![Anime Waifu AI](https://img.shields.io/badge/React-19.2-blue?logo=react)
![Three.js](https://img.shields.io/badge/Three.js-0.182-black?logo=three.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-7.2-purple?logo=vite)

## ✨ Features

### 🎭 **3D VRM Avatar**
- Full 3D anime character using VRM (Virtual Reality Model) format
- Real-time rendering with Three.js and React Three Fiber
- Customizable - use any VRM model

### 💬 **AI Conversation**
- Powered by Google Gemini AI
- Natural, personality-driven responses
- Emotion detection and expression

### 🎤 **Voice Interaction**
- **Speech-to-Text**: Talk to your waifu using your microphone
- **Text-to-Speech**: Hear responses with ElevenLabs high-quality voices
- **Real-time Lip Sync**: Mouth movements synchronized with audio

### 🎨 **Expressive Animations**
- **Facial Expressions**: Happy, sad, angry, surprised, shy, and more
- **Natural Blinking**: Randomized, realistic eye blinking
- **Body Poses**: 5 distinct poses with smooth transitions
  - Relaxed (hands clasped in front)
  - Arms Crossed
  - Waving
  - Shy (hands near chest)
  - Touching Head
- **Breathing Animation**: Subtle chest/spine movement
- **Speaking Gestures**: Enhanced head movement while talking

### 🖥️ **Immersive UI**
- Full-screen 3D experience
- Minimal, floating chat interface
- Emotion and status indicators

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ 
- **npm** or **yarn**
- **Google Gemini API Key** (free tier available)
- **ElevenLabs API Key** (optional, for premium voice)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/anime-waifu.git
   cd anime-waifu
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your API keys:
   ```env
   # Required - Get from https://aistudio.google.com/app/apikey
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   
   # Optional - Get from https://elevenlabs.io/
   VITE_ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
   VITE_ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
   ```

4. **Add your VRM model**
   
   Place your VRM model file in the `public/` folder as `model.vrm`
   
   > 💡 You can download free VRM models from [VRoid Hub](https://hub.vroid.com/) or create your own with [VRoid Studio](https://vroid.com/en/studio)

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open in browser**
   
   Navigate to `http://localhost:5173`

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **React 19** | UI Framework |
| **TypeScript** | Type Safety |
| **Vite** | Build Tool & Dev Server |
| **Three.js** | 3D Graphics Engine |
| **React Three Fiber** | React renderer for Three.js |
| **@pixiv/three-vrm** | VRM Model Loading & Animation |
| **Google Gemini AI** | Conversational AI |
| **ElevenLabs** | Text-to-Speech |
| **Web Speech API** | Speech-to-Text |
| **TailwindCSS** | Styling |

---

## 📁 Project Structure

```
anime-waifu/
├── public/
│   └── model.vrm          # Your VRM avatar model
├── src/
│   ├── components/
│   │   ├── Avatar.tsx     # VRM model loader & animations
│   │   └── AvatarCanvas.tsx # 3D scene setup
│   ├── services/
│   │   ├── geminiService.ts    # Gemini AI integration
│   │   ├── elevenLabsService.ts # ElevenLabs TTS
│   │   └── speechService.ts     # Speech recognition
│   ├── App.tsx            # Main application
│   ├── index.css          # Global styles
│   └── main.tsx           # Entry point
├── .env.example           # Environment template
├── package.json
└── README.md
```

---

## 🎮 Usage

### Text Chat
1. Type your message in the input box
2. Press Enter or click Send
3. Watch your waifu respond with voice and animations

### Voice Chat
1. Click the 🎤 microphone button
2. Speak your message
3. Release to send
4. Your waifu will respond verbally

### Camera Controls
- **Scroll**: Zoom in/out
- **Drag**: Rotate camera around the model

---

## ⚙️ Configuration

### Changing the VRM Model
Replace `public/model.vrm` with any VRM-compatible model.

### Changing the Voice
Update `VITE_ELEVENLABS_VOICE_ID` in `.env` with a different voice ID from the [ElevenLabs Voice Library](https://elevenlabs.io/voice-library).

### Customizing Personality
Edit the system prompt in `src/services/geminiService.ts` to change your waifu's personality.

---

## 🔧 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

---

## 📝 API Keys

### Google Gemini (Required)
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key
3. Add to `.env` as `VITE_GEMINI_API_KEY`

### ElevenLabs (Optional)
1. Sign up at [ElevenLabs](https://elevenlabs.io/)
2. Get your API key from Settings
3. Choose a voice from the Voice Library
4. Add to `.env` as `VITE_ELEVENLABS_API_KEY` and `VITE_ELEVENLABS_VOICE_ID`

> Without ElevenLabs, the app will use the browser's built-in text-to-speech.

---

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

## 🙏 Acknowledgments

- [VRoid Studio](https://vroid.com/en/studio) - VRM model creation
- [Pixiv's three-vrm](https://github.com/pixiv/three-vrm) - VRM loader for Three.js
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) - React renderer for Three.js
- [Google Gemini](https://ai.google.dev/) - Conversational AI
- [ElevenLabs](https://elevenlabs.io/) - Text-to-Speech

---

<p align="center">
  Made with 💕 for anime fans
</p>
