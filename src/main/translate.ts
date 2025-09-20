import { ChatOpenAI } from '@langchain/openai';
import { ipcMain } from 'electron';

// Translation service using OpenAI fast model
class TranslationService {
  private llm: ChatOpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_FAST_API_KEY;
    const baseURL = process.env.OPENAI_FAST_BASE_URL || 'https://askgenie-api.oagpuservices.com/v1';
    const model = process.env.OPENAI_FAST_MODEL || 'Llama-4-Maverick-17B-128E-Instruct-FP8';
    const temperature = parseFloat(process.env.OPENAI_FAST_MODEL_TEMPERATURE || '0.0');

    if (!apiKey) {
      throw new Error('OPENAI_FAST_API_KEY environment variable is required for translation service');
    }

    this.llm = new ChatOpenAI({
      model: model,
      temperature: temperature,
      streaming: false, // Disable streaming for translation results
      openAIApiKey: apiKey,
      configuration: {
        baseURL: baseURL,
      },
    });

    console.log('✅ Translation service initialized with model:', model);
  }

  /**
   * Translate text to a target language
   */
  async translateText(text: string, targetLanguage: string): Promise<string> {
    if (!text || !text.trim()) {
      throw new Error('Text to translate cannot be empty');
    }

    if (!targetLanguage || !targetLanguage.trim()) {
      throw new Error('Target language cannot be empty');
    }

    const prompt = this.createTranslationPrompt(text, targetLanguage);

    try {
      const response = await this.llm.invoke(prompt);

      // Extract the translated text from the response
      const translatedText = response.content.toString().trim();

      if (!translatedText) {
        throw new Error('Translation service returned empty response');
      }

      return translatedText;
    } catch (error) {
      console.error('Translation error:', error);
      throw new Error(`Failed to translate text: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create translation prompt
   */
  private createTranslationPrompt(text: string, targetLanguage: string): string {
    return `You are a professional translator. Translate the following text to ${targetLanguage}.

Important instructions:
- Provide ONLY the translated text, no explanations or additional content
- Maintain the original formatting and structure
- Preserve any technical terms appropriately
- Keep the tone and style consistent with the original

Text to translate:
${text}

Translation:`;
  }

  /**
   * Detect the language of the given text
   */
  async detectLanguage(text: string): Promise<string> {
    if (!text || !text.trim()) {
      throw new Error('Text for language detection cannot be empty');
    }

    const prompt = `You are a language detection expert. Detect the language of the following text and respond with ONLY the language name in English (e.g., "English", "Spanish", "French", "Chinese", etc.).

Text: ${text}

Language:`;

    try {
      const response = await this.llm.invoke(prompt);
      const detectedLanguage = response.content.toString().trim();

      if (!detectedLanguage) {
        throw new Error('Language detection service returned empty response');
      }

      return detectedLanguage;
    } catch (error) {
      console.error('Language detection error:', error);
      throw new Error(`Failed to detect language: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Initialize translation service
let translationService: TranslationService | null = null;

/**
 * Initialize the translation service
 */
function initializeTranslationService(): void {
  try {
    translationService = new TranslationService();
    console.log('✅ Translation service initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize translation service:', error);
    translationService = null;
  }
}

/**
 * Setup translation IPC handlers
 */
export function setupTranslationHandlers(): void {
  console.log('🔧 Setting up translation IPC handlers...');

  // Initialize the service
  initializeTranslationService();

  // Handle translation requests
  ipcMain.handle('translate:text', async (event, { text, targetLanguage }: { text: string; targetLanguage: string }) => {
    try {
      if (!translationService) {
        throw new Error('Translation service is not available');
      }

      const result = await translationService.translateText(text, targetLanguage);
      return { success: true, result };
    } catch (error) {
      console.error('Translation request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Translation failed'
      };
    }
  });

  // Handle language detection requests
  ipcMain.handle('translate:detect-language', async (event, { text }: { text: string }) => {
    try {
      if (!translationService) {
        throw new Error('Translation service is not available');
      }

      const result = await translationService.detectLanguage(text);
      return { success: true, result };
    } catch (error) {
      console.error('Language detection request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Language detection failed'
      };
    }
  });

  // Handle service status check
  ipcMain.handle('translate:status', async () => {
    return {
      available: translationService !== null,
      model: process.env.OPENAI_FAST_MODEL || 'Llama-4-Maverick-17B-128E-Instruct-FP8',
      baseURL: process.env.OPENAI_FAST_BASE_URL || 'https://askgenie-api.oagpuservices.com/v1'
    };
  });

  console.log('✅ Translation IPC handlers registered successfully');
}

/**
 * Cleanup translation service
 */
export function cleanupTranslationService(): void {
  if (translationService) {
    console.log('🧹 Cleaning up translation service...');
    translationService = null;
  }
}
