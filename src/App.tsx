import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import AvatarCanvas from './components/AvatarCanvas';
import { geminiService, sendMessageToWaifu } from './services/geminiService';
import type { EmotionTag, WaifuResponse } from './services/geminiService';
import { speechService } from './services/speechService';
import { elevenLabsTTS } from './services/elevenLabsService';

interface Message {
  id: number;
  sender: 'user' | 'waifu';
  text: string;
  emotion?: EmotionTag;
  timestamp: Date;
}

function App() {
  const [isMicActive, setIsMicActive] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isApiReady, setIsApiReady] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<EmotionTag>('neutral');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [useElevenLabs, setUseElevenLabs] = useState(false);

  const pendingTranscriptRef = useRef<string>('');

  const [_messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      sender: 'waifu',
      text: "Hmph! So you finally decided to show up... I-It's not like I was waiting for you or anything!",
      emotion: 'annoyed',
      timestamp: new Date()
    },
  ]);

  // Add message helper
  const addMessage = useCallback((sender: 'user' | 'waifu', text: string, emotion?: EmotionTag) => {
    const newMessage: Message = {
      id: Date.now(),
      sender,
      text,
      emotion,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);

    if (emotion) {
      setCurrentEmotion(emotion);
    }
  }, []);

  // Speak using ElevenLabs or browser TTS
  const speakResponse = useCallback(async (text: string) => {
    setIsSpeaking(true);

    if (useElevenLabs && elevenLabsTTS.isReady()) {
      try {
        await elevenLabsTTS.speak(text);
      } catch (error) {
        console.error('ElevenLabs TTS error, falling back to browser TTS:', error);
        // Fallback to browser TTS
        speechService.speak(text, () => {
          setIsSpeaking(false);
          setAudioLevel(0);
        });
      }
    } else {
      // Use browser TTS
      speechService.speak(text, () => {
        setIsSpeaking(false);
        setAudioLevel(0);
      });
    }
  }, [useElevenLabs]);

  // Handle sending message to AI and speaking response
  const processMessage = useCallback(async (userMessage: string) => {
    if (!userMessage.trim() || isLoading || !isApiReady) return;

    addMessage('user', userMessage);
    setIsLoading(true);

    try {
      const response: WaifuResponse = await sendMessageToWaifu(userMessage);
      addMessage('waifu', response.text, response.emotion);

      // Speak the response
      await speakResponse(response.text);
    } catch (error) {
      console.error('Error getting response:', error);
      const errorText = "S-Something went wrong... but it's definitely not my fault, baka!";
      addMessage('waifu', errorText, 'embarrassed');
      await speakResponse(errorText);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isApiReady, addMessage, speakResponse]);

  // Initialize ElevenLabs TTS
  useEffect(() => {
    const elevenLabsApiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
    const elevenLabsVoiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID;

    if (elevenLabsApiKey && elevenLabsApiKey !== 'your_elevenlabs_api_key_here' && elevenLabsVoiceId) {
      elevenLabsTTS.initialize({
        apiKey: elevenLabsApiKey,
        voiceId: elevenLabsVoiceId,
        modelId: 'eleven_monolingual_v1', // Works on all plans including free
      });
      setUseElevenLabs(true);
      console.log('ElevenLabs TTS enabled');

      // Set up audio state callback for lip sync
      elevenLabsTTS.setStateCallback((state) => {
        setIsSpeaking(state.isPlaying);
        setAudioLevel(state.audioLevel);
      });
    } else {
      console.log('ElevenLabs not configured, using browser TTS');
      setUseElevenLabs(false);
    }
  }, []);

  // Initialize speech service callbacks
  useEffect(() => {
    speechService.setCallbacks({
      onSpeechStart: () => {
        console.log('🎤 Listening started');
      },
      onSpeechEnd: () => {
        console.log('🎤 Listening ended');
      },
      onResult: (transcript, isFinal) => {
        if (isFinal) {
          console.log('Final transcript received:', transcript);
          setInterimTranscript('');
          pendingTranscriptRef.current = transcript;
        } else {
          setInterimTranscript(transcript);
        }
      },
      onError: (error) => {
        console.error('Speech error:', error);
        if (error === 'not-allowed') {
          addMessage('waifu', "H-Hey! You need to allow microphone access, baka!", 'annoyed');
        }
      },
    });
  }, [addMessage]);

  // Process pending transcript when it changes
  useEffect(() => {
    const transcript = pendingTranscriptRef.current;
    if (transcript && isMicActive && isApiReady && !isLoading) {
      pendingTranscriptRef.current = '';
      processMessage(transcript);
    }
  }, [interimTranscript, isMicActive, isApiReady, isLoading, processMessage]);

  // Check for API key on mount
  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    const envKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (storedKey && storedKey !== 'your_api_key_here') {
      initializeApi(storedKey);
    } else if (envKey && envKey !== 'your_api_key_here') {
      initializeApi(envKey);
    } else {
      setShowApiKeyModal(true);
    }
  }, []);



  const initializeApi = async (apiKey: string) => {
    try {
      await geminiService.initialize(apiKey);
      setIsApiReady(true);
      setShowApiKeyModal(false);
      localStorage.setItem('gemini_api_key', apiKey);
    } catch (error) {
      console.error('Failed to initialize API:', error);
      setShowApiKeyModal(true);
    }
  };

  const handleApiKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKeyInput.trim()) {
      initializeApi(apiKeyInput.trim());
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading || !isApiReady) return;

    const userMessage = inputText.trim();
    setInputText('');
    await processMessage(userMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleMicrophone = () => {
    if (isMicActive) {
      speechService.stopListening();
      setIsMicActive(false);
      setInterimTranscript('');
    } else {
      if (!speechService.isRecognitionSupported()) {
        addMessage('waifu', "Your browser doesn't support speech recognition... How unfortunate!", 'sad');
        return;
      }

      const started = speechService.startListening();
      if (started) {
        setIsMicActive(true);
      }
    }
  };

  const stopSpeaking = () => {
    if (useElevenLabs) {
      elevenLabsTTS.stop();
    } else {
      speechService.stopSpeaking();
    }
    setIsSpeaking(false);
    setAudioLevel(0);
  };



  const getEmotionEmoji = (emotion?: EmotionTag): string => {
    const emojiMap: Record<EmotionTag, string> = {
      happy: '😊',
      angry: '😠',
      sad: '😢',
      surprised: '😲',
      embarrassed: '😳',
      loving: '💕',
      worried: '😟',
      annoyed: '😤',
      excited: '🤩',
      neutral: '😐',
      shy: '🥺',
      proud: '😏',
      confused: '😕',
    };
    return emotion ? emojiMap[emotion] || '💬' : '💬';
  };

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950">
      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-4">🔑 Enter Gemini API Key</h2>
            <p className="text-white/60 mb-6 text-sm">
              Get your API key from{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 underline"
              >
                Google AI Studio
              </a>
            </p>
            <form onSubmit={handleApiKeySubmit}>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="Paste your API key here..."
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-purple-500 mb-4"
              />
              <button
                type="submit"
                className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold hover:opacity-90 transition-opacity"
              >
                Connect to Waifu AI
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Fullscreen 3D Waifu Canvas */}
      <div className="absolute inset-0 w-full h-full">
        <AvatarCanvas
          modelUrl="/model.vrm"
          isSpeaking={isSpeaking}
          audioLevel={audioLevel}
          currentEmotion={currentEmotion}
        />
      </div>

      {/* Floating Chat Input - Bottom Right Corner */}
      <div className="fixed bottom-6 right-6 z-30 w-full max-w-md">
        {/* Speaking indicator */}
        {isSpeaking && (
          <div className="mb-3 flex justify-end">
            <div className="glass-panel px-4 py-2 flex items-center gap-3 animate-pulse">
              <div className="flex items-end gap-0.5 h-4">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-1 bg-pink-400 rounded-full transition-all duration-75"
                    style={{
                      height: `${Math.max(4, audioLevel * 16 * (1 + Math.sin(Date.now() / 100 + i) * 0.3))}px`,
                      opacity: audioLevel > 0.1 ? 1 : 0.3,
                    }}
                  />
                ))}
              </div>
              <span className="text-pink-400 text-sm">Speaking...</span>
              <button
                onClick={stopSpeaking}
                className="text-white/60 hover:text-white transition-colors"
                title="Stop speaking"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Voice activity indicator */}
        {isMicActive && (
          <div className="mb-3 flex justify-end">
            <div className="glass-panel px-4 py-2 flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="w-1 h-3 bg-pink-500 rounded-full animate-[pulse_0.5s_ease-in-out_infinite]"></span>
                <span className="w-1 h-5 bg-pink-400 rounded-full animate-[pulse_0.5s_ease-in-out_infinite_0.1s]"></span>
                <span className="w-1 h-4 bg-pink-500 rounded-full animate-[pulse_0.5s_ease-in-out_infinite_0.2s]"></span>
                <span className="w-1 h-6 bg-pink-400 rounded-full animate-[pulse_0.5s_ease-in-out_infinite_0.3s]"></span>
                <span className="w-1 h-3 bg-pink-500 rounded-full animate-[pulse_0.5s_ease-in-out_infinite_0.4s]"></span>
              </div>
              <span className="text-pink-400 text-sm">Listening...</span>
            </div>
          </div>
        )}

        {/* Input Container */}
        <div className="glass-panel p-3">
          <div className="flex gap-2">
            {/* Text Input */}
            <div className="flex-1 relative">
              <input
                type="text"
                value={isMicActive && interimTranscript ? interimTranscript : inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isMicActive ? "🎤 Listening..." : isApiReady ? "Say something..." : "Connect API first..."}
                disabled={!isApiReady || isLoading || isMicActive}
                className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-white placeholder-white/40 focus:outline-none transition-all disabled:opacity-50 ${isMicActive
                  ? 'border-pink-500/50 bg-pink-500/5'
                  : 'border-white/10 focus:border-purple-500/50 hover:border-white/20'
                  }`}
              />
              {isLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>

            {/* Send Button */}
            <button
              onClick={handleSendMessage}
              disabled={!inputText.trim() || isLoading || !isApiReady || isMicActive}
              className="p-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:opacity-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title="Send message"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>

            {/* Microphone Button */}
            <button
              onClick={toggleMicrophone}
              disabled={!isApiReady || isLoading}
              className={`p-3 rounded-xl transition-all duration-300 disabled:opacity-30 ${isMicActive
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-lg shadow-pink-500/50 scale-110'
                : 'glass-panel text-white/80 hover:text-white hover:bg-white/10'
                }`}
              title={isMicActive ? "Stop listening" : "Start voice input"}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Minimal Status Indicator - Top Right */}
      <div className="fixed top-4 right-4 z-30 flex items-center gap-2">
        {isApiReady && (
          <div className="glass-panel px-3 py-1.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
            <span className="text-green-400 text-xs font-medium">Online</span>
          </div>
        )}
        {useElevenLabs && (
          <div className="glass-panel px-3 py-1.5">
            <span className="text-purple-400 text-xs">🎙️</span>
          </div>
        )}
      </div>

      {/* Current Emotion Badge - Top Left */}
      <div className="fixed top-4 left-4 z-30">
        <div className="glass-panel px-4 py-2 flex items-center gap-2">
          <span className="text-lg">{getEmotionEmoji(currentEmotion)}</span>
          <span className="text-white/80 text-sm capitalize">{currentEmotion}</span>
        </div>
      </div>
    </div>
  );
}

export default App;
