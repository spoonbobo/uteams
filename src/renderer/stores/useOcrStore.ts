import { create } from 'zustand';
import Tesseract from 'tesseract.js';
import { createTesseractWorker } from '@/utils/tesseractSetup';

export interface OcrResult {
  success: boolean;
  text?: string;
  error?: string;
  confidence?: number;
  language?: string;
  wordCount?: number;
  apiType?: string;
  imageInfo?: {
    originalSize: string;
    processedSize: string;
    scaleFactor: number;
  };
  debug?: {
    actualLanguageUsed?: string;
    ocrEngineCreated?: boolean;
    processingTime?: string;
    approach?: string;
    psm?: string;
    oem?: string;
  };
}

export interface OcrOptions {
  language?: string; // Language code like 'eng', 'chi_sim', 'chi_tra', etc.
  timeout?: number; // Timeout in milliseconds
  psm?: number; // Page segmentation mode (0-13)
  oem?: number; // OCR Engine Mode (0-3)
}

interface OcrState {
  // Current OCR status
  isProcessing: boolean;
  lastResult: OcrResult | null;
  lastError: string | null;

  // Available languages
  availableLanguages: string[];

  // Actions
  performOcr: (imagePath: string, options?: OcrOptions) => Promise<OcrResult>;
  performScreenshotOcr: (options?: OcrOptions) => Promise<OcrResult>;
  performRendererOcr: (imageData: string | File, options?: OcrOptions) => Promise<OcrResult>;
  getAvailableLanguages: () => Promise<string[]>;
  testMinimalOcr: () => Promise<any>;
  getDiagnostics: () => Promise<any>;

  // Internal state management
  setProcessing: (processing: boolean) => void;
  setLastResult: (result: OcrResult | null) => void;
  setLastError: (error: string | null) => void;
  setAvailableLanguages: (languages: string[]) => void;
}

export const useOcrStore = create<OcrState>((set, get) => ({
  // Initial state
  isProcessing: false,
  lastResult: null,
  lastError: null,
  availableLanguages: [],

  // Actions
  performOcr: async (imagePath: string, options?: OcrOptions): Promise<OcrResult> => {
    set({ isProcessing: true, lastError: null });

    try {
      const result = await (window as any)?.electron?.ocr?.perform?.(imagePath, options);

      set({
        lastResult: result,
        isProcessing: false,
        lastError: result?.success ? null : result?.error || 'OCR failed'
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown OCR error';
      const failureResult: OcrResult = {
        success: false,
        error: errorMessage
      };

      set({
        lastResult: failureResult,
        isProcessing: false,
        lastError: errorMessage
      });

      return failureResult;
    }
  },

  performScreenshotOcr: async (options?: OcrOptions): Promise<OcrResult> => {
    set({ isProcessing: true, lastError: null });

    try {
      // First, get the screenshot from main process (which handles screen capture)
      const screenshotResult = await (window as any)?.electron?.ocr?.screenshot?.(options);

      if (!screenshotResult?.success || !screenshotResult?.screenshotPath) {
        set({
          lastResult: screenshotResult,
          isProcessing: false,
          lastError: screenshotResult?.error || 'Failed to take screenshot'
        });
        return screenshotResult;
      }

      // Now perform actual OCR in renderer process using the screenshot path
      // Use the file path directly - Tesseract.js can handle file paths in Electron
      try {
        console.log('🔍 Processing OCR in renderer with file:', screenshotResult.screenshotPath);

        // Use our renderer-based OCR with the file path
        const ocrResult = await get().performRendererOcr(screenshotResult.screenshotPath, options);

        // Clean up the temporary file after OCR is complete
        try {
          await (window as any)?.electron?.ocr?.cleanup?.(screenshotResult.screenshotPath);
        } catch (cleanupError) {
          console.warn('Failed to cleanup screenshot file:', cleanupError);
        }

        set({
          lastResult: ocrResult,
          isProcessing: false,
          lastError: ocrResult?.success ? null : ocrResult?.error || 'OCR processing failed'
        });

        return ocrResult;
      } catch (ocrError) {
        // Clean up file even if OCR fails
        try {
          await (window as any)?.electron?.ocr?.cleanup?.(screenshotResult.screenshotPath);
        } catch (cleanupError) {
          console.warn('Failed to cleanup screenshot file after error:', cleanupError);
        }

        // Return the OCR error
        const errorMessage = ocrError instanceof Error ? ocrError.message : 'OCR processing failed';
        const failureResult: OcrResult = {
          success: false,
          error: errorMessage
        };

        set({
          lastResult: failureResult,
          isProcessing: false,
          lastError: errorMessage
        });

        return failureResult;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown screenshot OCR error';
      const failureResult: OcrResult = {
        success: false,
        error: errorMessage
      };

      set({
        lastResult: failureResult,
        isProcessing: false,
        lastError: errorMessage
      });

      return failureResult;
    }
  },

  performRendererOcr: async (imageData: string | File, options?: OcrOptions): Promise<OcrResult> => {
    const startTime = Date.now();
    const {
      language = 'eng',
      timeout = 30000,
      psm = 3, // PSM.AUTO
      oem = 1  // OEM.LSTM_ONLY
    } = options || {};

      try {
        console.log(`🔍 Starting Tesseract.js OCR in renderer process - Language: ${language}`);

        // Convert file path to data URL if it's a string (file path)
        let processedImageData: string | File = imageData;
        if (typeof imageData === 'string' && (imageData.startsWith('file://') || (!imageData.startsWith('data:') && !imageData.startsWith('blob:')))) {
          console.log('🔄 Converting file path to data URL for OCR processing');
          try {
            // Clean up file path (remove file:// prefix if present)
            const cleanPath = imageData.replace('file:///', '').replace('file://', '');

            // Use IPC to read the file as data URL from main process
            const result = await (window as any)?.electron?.ipcRenderer?.invoke?.('fileio:read-as-data-url', { filepath: cleanPath });
            if (result?.success && result.dataUrl) {
              processedImageData = result.dataUrl;
              console.log('✅ File converted to data URL');
            } else {
              throw new Error(result?.error || 'Failed to read file as data URL');
            }
          } catch (error) {
            console.error('❌ Failed to convert file path to data URL:', error);
            throw new Error(`Failed to load image file: ${error}`);
          }
        }

        // Create Tesseract.js worker with proper configuration
        const worker = await createTesseractWorker(
        language,
        oem,
        undefined,
        (progress, status) => {
          console.log(`OCR Status: ${status} (${Math.round(progress * 100)}%)`);
        }
      );

      // Set parameters - use any to bypass strict typing for these parameters
      // Note: OEM is set during worker creation, only PSM can be set afterward
      await (worker as any).setParameters({
        tessedit_pageseg_mode: psm.toString(),
      });

        // Perform OCR with processed image data
        const { data } = await worker.recognize(processedImageData);

      // Clean up worker
      await worker.terminate();

      const processingTime = Date.now() - startTime;
      console.log(`✅ OCR completed in ${processingTime}ms`);

      // Extract results
      const extractedText = data.text?.trim() || '';
      const confidence = data.confidence / 100; // Convert to 0-1 range
      const wordCount = (data as any).words?.length || 0;

      // Get image dimensions safely
      const imageWidth = (data as any).width || 0;
      const imageHeight = (data as any).height || 0;

      return {
        success: true,
        text: extractedText,
        confidence,
        language,
        wordCount,
        apiType: 'Tesseract.js (Renderer)',
        imageInfo: {
          originalSize: `${imageWidth}x${imageHeight}`,
          processedSize: `${imageWidth}x${imageHeight}`,
          scaleFactor: 1.0
        },
        debug: {
          actualLanguageUsed: language,
          ocrEngineCreated: true,
          processingTime: `${processingTime}ms`,
          approach: 'Renderer Process (Tesseract.js)',
          psm: psm.toString(),
          oem: oem.toString()
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ Renderer OCR failed after ${processingTime}ms:`, error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown OCR error occurred',
        debug: {
          processingTime: `${processingTime}ms`,
          approach: 'Renderer Process (Failed)'
        }
      };
    }
  },

  getAvailableLanguages: async (): Promise<string[]> => {
    try {
      const languages = await (window as any)?.electron?.ocr?.getLanguages?.();
      set({ availableLanguages: languages || [] });
      return languages || [];
    } catch (error) {
      console.error('Failed to get OCR languages:', error);
      return [];
    }
  },

  testMinimalOcr: async (): Promise<any> => {
    try {
      return await (window as any)?.electron?.ocr?.testMinimal?.();
    } catch (error) {
      console.error('Failed to test minimal OCR:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Test failed'
      };
    }
  },

  getDiagnostics: async (): Promise<any> => {
    try {
      return await (window as any)?.electron?.ocr?.diagnostics?.();
    } catch (error) {
      console.error('Failed to get OCR diagnostics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Diagnostics failed'
      };
    }
  },

  // Internal state management
  setProcessing: (processing: boolean) => set({ isProcessing: processing }),
  setLastResult: (result: OcrResult | null) => set({ lastResult: result }),
  setLastError: (error: string | null) => set({ lastError: error }),
  setAvailableLanguages: (languages: string[]) => set({ availableLanguages: languages }),
}));
