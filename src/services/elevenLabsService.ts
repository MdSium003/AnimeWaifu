// ElevenLabs Text-to-Speech Service with Audio Analysis for Lip Sync

export interface ElevenLabsConfig {
    apiKey: string;
    voiceId: string;
    modelId?: string;
}

interface AudioState {
    isPlaying: boolean;
    audioLevel: number;  // 0-1 normalized audio level for lip sync
}

type AudioStateCallback = (state: AudioState) => void;

class ElevenLabsTTSService {
    private apiKey: string = '';
    private voiceId: string = '';
    private modelId: string = 'eleven_multilingual_v2'; // Works on free tier

    // Audio playback
    private audio: HTMLAudioElement | null = null;
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private source: MediaElementAudioSourceNode | null = null;
    private dataArray: Uint8Array | null = null;

    // State
    private isInitialized: boolean = false;
    private isPlaying: boolean = false;
    private animationFrameId: number | null = null;
    private stateCallback: AudioStateCallback | null = null;
    private currentAudioLevel: number = 0;

    initialize(config: ElevenLabsConfig): void {
        this.apiKey = config.apiKey;
        this.voiceId = config.voiceId;
        if (config.modelId) {
            this.modelId = config.modelId;
        }
        this.isInitialized = true;
        console.log('ElevenLabs TTS initialized');
        console.log('  Voice ID:', this.voiceId);
        console.log('  Model:', this.modelId);
        console.log('  API Key:', this.apiKey ? `${this.apiKey.substring(0, 8)}...${this.apiKey.substring(this.apiKey.length - 4)}` : 'NOT SET');
    }

    setStateCallback(callback: AudioStateCallback): void {
        this.stateCallback = callback;
    }

    private notifyState(): void {
        if (this.stateCallback) {
            this.stateCallback({
                isPlaying: this.isPlaying,
                audioLevel: this.currentAudioLevel,
            });
        }
    }

    private async setupAudioContext(audioElement: HTMLAudioElement): Promise<void> {
        // Create AudioContext if not exists
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        // Resume context if suspended (required for some browsers)
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        // Create analyser node
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.8;

        // Connect audio element to analyser
        // Only create source once per audio element
        if (!this.source) {
            this.source = this.audioContext.createMediaElementSource(audioElement);
        }

        this.source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);

        // Create data array for frequency analysis
        const bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(bufferLength);
    }

    private startAudioAnalysis(): void {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }

        const analyze = () => {
            if (!this.analyser || !this.dataArray || !this.isPlaying) {
                this.currentAudioLevel = 0;
                this.notifyState();
                return;
            }

            // Get frequency data
            this.analyser.getByteFrequencyData(this.dataArray);

            // Calculate average volume from lower frequencies (voice range)
            // Focus on frequencies 80-400 Hz which is typical for speech
            const voiceRangeStart = 2;  // Skip very low frequencies
            const voiceRangeEnd = Math.min(20, this.dataArray.length);

            let sum = 0;
            for (let i = voiceRangeStart; i < voiceRangeEnd; i++) {
                sum += this.dataArray[i];
            }

            const average = sum / (voiceRangeEnd - voiceRangeStart);

            // Normalize to 0-1 range with some amplification
            // Adjust threshold and scaling for better lip sync
            const normalized = Math.min(1, Math.max(0, (average - 30) / 150));

            // Apply smoothing
            this.currentAudioLevel = this.currentAudioLevel * 0.3 + normalized * 0.7;

            this.notifyState();

            this.animationFrameId = requestAnimationFrame(analyze);
        };

        analyze();
    }

    private stopAudioAnalysis(): void {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.currentAudioLevel = 0;
        this.notifyState();
    }

    async speak(text: string): Promise<void> {
        if (!this.isInitialized) {
            console.error('ElevenLabs TTS not initialized');
            return;
        }

        // Stop any currently playing audio
        this.stop();

        try {
            console.log('Requesting ElevenLabs TTS for:', text.substring(0, 50) + '...');

            // Make API request
            const response = await fetch(
                `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`,
                {
                    method: 'POST',
                    headers: {
                        'Accept': 'audio/mpeg',
                        'Content-Type': 'application/json',
                        'xi-api-key': this.apiKey,
                    },
                    body: JSON.stringify({
                        text: text,
                        model_id: "eleven_flash_v2_5",
                        voice_settings: {
                            stability: 0.5,
                            similarity_boost: 0.75,
                        },
                    }),
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error('ElevenLabs API error:', response.status, errorText);
                throw new Error(`ElevenLabs API error: ${response.status}`);
            }

            // Get audio blob
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);

            // Create audio element
            this.audio = new Audio(audioUrl);
            this.audio.crossOrigin = 'anonymous';

            // Setup audio context for analysis
            await this.setupAudioContext(this.audio);

            // Setup event handlers
            this.audio.onplay = () => {
                console.log('ElevenLabs audio started playing');
                this.isPlaying = true;
                this.startAudioAnalysis();
            };

            this.audio.onended = () => {
                console.log('ElevenLabs audio finished');
                this.isPlaying = false;
                this.stopAudioAnalysis();
                URL.revokeObjectURL(audioUrl);
            };

            this.audio.onerror = (e) => {
                console.error('Audio playback error:', e);
                this.isPlaying = false;
                this.stopAudioAnalysis();
                URL.revokeObjectURL(audioUrl);
            };

            // Play audio
            await this.audio.play();

        } catch (error) {
            console.error('ElevenLabs TTS error:', error);
            this.isPlaying = false;
            this.notifyState();
            throw error;
        }
    }

    stop(): void {
        if (this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
            this.audio = null;
        }
        this.isPlaying = false;
        this.stopAudioAnalysis();

        // Disconnect source to allow reconnecting
        if (this.source) {
            try {
                this.source.disconnect();
            } catch (e) {
                // Ignore disconnect errors
            }
            this.source = null;
        }
    }

    getIsPlaying(): boolean {
        return this.isPlaying;
    }

    getAudioLevel(): number {
        return this.currentAudioLevel;
    }

    isReady(): boolean {
        return this.isInitialized;
    }
}

// Export singleton instance
export const elevenLabsTTS = new ElevenLabsTTSService();

// Helper function for quick TTS
export async function playTTS(text: string): Promise<void> {
    return elevenLabsTTS.speak(text);
}
