// Web Speech API Service for Speech Recognition and Synthesis

// TypeScript declarations for Web Speech API (not fully typed in lib.dom.d.ts)
interface SpeechRecognitionEvent extends Event {
    resultIndex: number;
    results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
    error: string;
    message: string;
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    onstart: (() => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
}

declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognition;
        webkitSpeechRecognition: new () => SpeechRecognition;
    }
}

export interface SpeechServiceCallbacks {
    onSpeechStart?: () => void;
    onSpeechEnd?: () => void;
    onResult?: (transcript: string, isFinal: boolean) => void;
    onError?: (error: string) => void;
}

class SpeechService {
    private recognition: SpeechRecognition | null = null;
    private synthesis: SpeechSynthesis | null = null;
    private selectedVoice: SpeechSynthesisVoice | null = null;
    private isListening: boolean = false;
    private callbacks: SpeechServiceCallbacks = {};

    constructor() {
        this.initializeSpeechRecognition();
        this.initializeSpeechSynthesis();
    }

    private initializeSpeechRecognition(): void {
        // Check for browser support
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognitionAPI) {
            console.warn('Speech Recognition API not supported in this browser');
            return;
        }

        this.recognition = new SpeechRecognitionAPI();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
            console.log('Speech recognition started');
            this.isListening = true;
            this.callbacks.onSpeechStart?.();
        };

        this.recognition.onresult = (event: SpeechRecognitionEvent) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            if (finalTranscript) {
                console.log('Final transcript:', finalTranscript);
                this.callbacks.onResult?.(finalTranscript.trim(), true);
            } else if (interimTranscript) {
                this.callbacks.onResult?.(interimTranscript.trim(), false);
            }
        };

        this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            console.error('Speech recognition error:', event.error);
            this.callbacks.onError?.(event.error);

            // Don't stop on "no-speech" error, just continue listening
            if (event.error !== 'no-speech') {
                this.isListening = false;
            }
        };

        this.recognition.onend = () => {
            console.log('Speech recognition ended');
            // Restart if we're still supposed to be listening
            if (this.isListening && this.recognition) {
                console.log('Restarting speech recognition...');
                try {
                    this.recognition.start();
                } catch (e) {
                    console.log('Could not restart recognition:', e);
                    this.isListening = false;
                    this.callbacks.onSpeechEnd?.();
                }
            } else {
                this.callbacks.onSpeechEnd?.();
            }
        };
    }

    private initializeSpeechSynthesis(): void {
        if (!('speechSynthesis' in window)) {
            console.warn('Speech Synthesis API not supported in this browser');
            return;
        }

        this.synthesis = window.speechSynthesis;

        // Load voices - they may not be available immediately
        this.loadVoices();

        // Some browsers fire voiceschanged event when voices are loaded
        if (this.synthesis.onvoiceschanged !== undefined) {
            this.synthesis.onvoiceschanged = () => this.loadVoices();
        }
    }

    private loadVoices(): void {
        if (!this.synthesis) return;

        const voices = this.synthesis.getVoices();
        console.log('Available voices:', voices.map(v => `${v.name} (${v.lang})`));

        // Priority list for female voices (ordered by preference)
        const femaleVoiceKeywords = [
            'female', 'woman', 'girl',
            'zira', 'hazel', 'susan', 'linda', 'samantha', 'karen', 'victoria',
            'moira', 'fiona', 'tessa', 'veena', 'ava', 'allison', 'sara',
            'microsoft zira', 'google us english female', 'google uk english female',
            'aria', 'jenny', 'sonia',
        ];

        // Try to find a female English voice
        let selectedVoice: SpeechSynthesisVoice | null = null;

        // First, try to find a voice with female keywords
        for (const keyword of femaleVoiceKeywords) {
            const found = voices.find(voice =>
                voice.name.toLowerCase().includes(keyword) &&
                voice.lang.startsWith('en')
            );
            if (found) {
                selectedVoice = found;
                break;
            }
        }

        // If no female voice found, try any English voice that sounds feminine
        if (!selectedVoice) {
            // Prefer certain voice names that are typically female
            const commonFemaleNames = ['zira', 'heather', 'catherine', 'emily', 'rachel', 'amelie'];
            for (const name of commonFemaleNames) {
                const found = voices.find(v => v.name.toLowerCase().includes(name));
                if (found) {
                    selectedVoice = found;
                    break;
                }
            }
        }

        // Fallback to first English voice
        if (!selectedVoice) {
            selectedVoice = voices.find(v => v.lang.startsWith('en')) || voices[0] || null;
        }

        if (selectedVoice) {
            this.selectedVoice = selectedVoice;
            console.log('Selected voice:', this.selectedVoice.name);
        }
    }

    setCallbacks(callbacks: SpeechServiceCallbacks): void {
        this.callbacks = callbacks;
    }

    startListening(): boolean {
        if (!this.recognition) {
            console.error('Speech recognition not available');
            this.callbacks.onError?.('Speech recognition not supported in this browser');
            return false;
        }

        if (this.isListening) {
            console.log('Already listening');
            return true;
        }

        // Stop any ongoing speech synthesis when starting to listen
        this.stopSpeaking();

        try {
            this.recognition.start();
            return true;
        } catch (error) {
            console.error('Failed to start speech recognition:', error);
            this.callbacks.onError?.('Failed to start microphone');
            return false;
        }
    }

    stopListening(): void {
        if (!this.recognition) return;

        this.isListening = false;
        try {
            this.recognition.stop();
        } catch (error) {
            console.log('Error stopping recognition:', error);
        }
    }

    speak(text: string, onEnd?: () => void): void {
        if (!this.synthesis) {
            console.error('Speech synthesis not available');
            onEnd?.();
            return;
        }

        // Cancel any ongoing speech
        this.synthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        // Set voice
        if (this.selectedVoice) {
            utterance.voice = this.selectedVoice;
        }

        // Configure speech parameters for anime-style voice
        utterance.rate = 1.0;      // Normal speed
        utterance.pitch = 1.2;     // Slightly higher pitch for cuter voice
        utterance.volume = 1.0;    // Full volume

        utterance.onend = () => {
            console.log('Speech synthesis ended');
            onEnd?.();
        };

        utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event);
            onEnd?.();
        };

        console.log('Speaking:', text);
        this.synthesis.speak(utterance);
    }

    stopSpeaking(): void {
        if (this.synthesis) {
            this.synthesis.cancel();
        }
    }

    isSpeaking(): boolean {
        return this.synthesis?.speaking || false;
    }

    isRecognitionSupported(): boolean {
        return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    }

    isSynthesisSupported(): boolean {
        return 'speechSynthesis' in window;
    }

    getIsListening(): boolean {
        return this.isListening;
    }

    // Get available voices for UI selection
    getAvailableVoices(): SpeechSynthesisVoice[] {
        return this.synthesis?.getVoices() || [];
    }

    setVoice(voice: SpeechSynthesisVoice): void {
        this.selectedVoice = voice;
        console.log('Voice changed to:', voice.name);
    }

    getCurrentVoice(): SpeechSynthesisVoice | null {
        return this.selectedVoice;
    }
}

// Export singleton instance
export const speechService = new SpeechService();
