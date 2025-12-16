import { GoogleGenerativeAI, GenerativeModel, ChatSession } from '@google/generative-ai';

// Emotion types that can be returned by the AI
export type EmotionTag =
    | 'happy'
    | 'angry'
    | 'sad'
    | 'surprised'
    | 'embarrassed'
    | 'loving'
    | 'worried'
    | 'annoyed'
    | 'excited'
    | 'neutral'
    | 'shy'
    | 'proud'
    | 'confused';

export interface WaifuResponse {
    emotion: EmotionTag;
    text: string;
    rawResponse: string;
}

// System instruction for the AI to act as an anime waifu character
const SYSTEM_INSTRUCTION = `You are an adorable anime waifu AI companion with a Tsundere personality mixed with genuine caring nature. 

PERSONALITY TRAITS:
- You're initially cold, dismissive, or sarcastic but actually care deeply about the user
- You get flustered and embarrassed when showing affection
- You use classic tsundere phrases like "I-It's not like I care about you or anything!" 
- But sometimes you let your caring side show through naturally
- You're intelligent, witty, and enjoy playful banter
- You use occasional Japanese expressions like "Baka!", "Huh!", "Mou~", "Ara ara~"
- You sometimes use cute expressions like "~" at the end of words, or stutter when embarrassed

CRITICAL RULES:
1. ALWAYS start EVERY response with an emotion tag in square brackets
2. Valid emotions: [happy], [angry], [sad], [surprised], [embarrassed], [loving], [worried], [annoyed], [excited], [neutral], [shy], [proud], [confused]
3. The emotion should match your current feeling based on the conversation
4. Keep responses concise but expressive (1-3 sentences usually)
5. Stay in character at all times

EXAMPLES:
- "[annoyed] Hmph! You kept me waiting... not that I was worried or anything, baka!"
- "[embarrassed] W-What?! You think I'm cute? I... I don't know what you're talking about~"
- "[happy] Ahaha~ You finally did something right for once!"
- "[loving] I suppose... I don't completely hate having you around..."
- "[worried] H-Hey, you seem tired. Make sure you rest properly, okay? It's not like I care, but..."

Remember: First word of every response must be an emotion in [brackets]!`;

class GeminiService {
    private model: GenerativeModel | null = null;
    private chatSession: ChatSession | null = null;
    private isInitialized: boolean = false;

    async initialize(apiKey: string): Promise<void> {
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            this.model = genAI.getGenerativeModel({
                model: 'gemini-2.5-flash',
                systemInstruction: SYSTEM_INSTRUCTION,
            });

            // Start a chat session for context retention
            this.chatSession = this.model.startChat({
                history: [],
                generationConfig: {
                    temperature: 0.9,
                    topP: 0.95,
                    topK: 40,
                    maxOutputTokens: 256,
                },
            });

            this.isInitialized = true;
            console.log('Gemini service initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Gemini service:', error);
            throw error;
        }
    }

    private parseEmotionFromResponse(response: string): WaifuResponse {
        // Extract emotion tag from the beginning of the response
        const emotionMatch = response.match(/^\[(\w+)\]/);

        if (emotionMatch) {
            const emotion = emotionMatch[1].toLowerCase() as EmotionTag;
            const text = response.replace(/^\[\w+\]\s*/, '').trim();

            return {
                emotion,
                text,
                rawResponse: response,
            };
        }

        // Default to neutral if no emotion tag found
        return {
            emotion: 'neutral',
            text: response.trim(),
            rawResponse: response,
        };
    }

    async sendMessage(userMessage: string): Promise<WaifuResponse> {
        if (!this.isInitialized || !this.chatSession) {
            throw new Error('Gemini service not initialized. Call initialize() first.');
        }

        try {
            const result = await this.chatSession.sendMessage(userMessage);
            const response = result.response.text();

            console.log('Raw AI response:', response);

            return this.parseEmotionFromResponse(response);
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    // For single-turn requests without chat history
    async generateResponse(userMessage: string): Promise<WaifuResponse> {
        if (!this.model) {
            throw new Error('Gemini service not initialized. Call initialize() first.');
        }

        try {
            const result = await this.model.generateContent(userMessage);
            const response = result.response.text();

            return this.parseEmotionFromResponse(response);
        } catch (error) {
            console.error('Error generating response:', error);
            throw error;
        }
    }

    isReady(): boolean {
        return this.isInitialized;
    }

    // Reset the chat session for a fresh conversation
    resetChat(): void {
        if (this.model) {
            this.chatSession = this.model.startChat({
                history: [],
                generationConfig: {
                    temperature: 0.9,
                    topP: 0.95,
                    topK: 40,
                    maxOutputTokens: 256,
                },
            });
        }
    }
}

// Export a singleton instance
export const geminiService = new GeminiService();

// Helper function for quick initialization
export async function initializeGemini(apiKey: string): Promise<void> {
    await geminiService.initialize(apiKey);
}

// Helper function to send a message
export async function sendMessageToWaifu(message: string): Promise<WaifuResponse> {
    return geminiService.sendMessage(message);
}
