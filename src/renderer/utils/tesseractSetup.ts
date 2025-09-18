/**
 * Tesseract.js Setup Utilities
 *
 * This module handles the initialization and configuration of Tesseract.js
 * for the renderer process, ensuring proper loading of local resources.
 */

import Tesseract from 'tesseract.js';

export interface TesseractConfig {
  workerPath?: string;
  langPath?: string;
  corePath?: string;
  cacheMethod?: 'write' | 'refresh' | 'none';
  gzip?: boolean;
}

/**
 * Get the default Tesseract.js configuration for local files only
 */
export function getDefaultTesseractConfig(): TesseractConfig {
  const isSafari = window.navigator.userAgent.includes('Safari') &&
                   !window.navigator.userAgent.includes('Chrome');

  // Use only local files served by webpack from public/tesseract/
  return {
    workerPath: '/tesseract/worker.min.js',
    langPath: '/tesseract',
    corePath: isSafari
      ? '/tesseract/tesseract-core.wasm.js'
      : '/tesseract/tesseract-core-simd.wasm.js',
    cacheMethod: 'write', // Cache language data in IndexedDB for faster subsequent loads
    gzip: true, // Our language files are gzipped
  };
}

/**
 * Create a configured Tesseract.js worker
 */
export async function createTesseractWorker(
  language: string = 'eng',
  oem: number = 1,
  config?: TesseractConfig,
  onProgress?: (progress: number, status: string) => void
): Promise<Tesseract.Worker> {
  // Check if local resources are available
  const localAvailable = await checkTesseractReady();

  if (!localAvailable) {
    throw new Error('Local Tesseract.js resources are not available. Please ensure files are in public/tesseract/');
  }

  console.log('📦 Using local Tesseract.js resources');

  const baseConfig = getDefaultTesseractConfig();
  const finalConfig = {
    ...baseConfig,
    ...config,
    logger: (m: any) => {
      if (onProgress) {
        const progress = m.progress || 0;
        const status = m.status || 'Processing';
        onProgress(progress, status);
      }

      // Log important status updates
      if (m.status === 'loading language traineddata') {
        console.log(`📦 Loading language data: ${language}...`);
      } else if (m.status === 'initializing tesseract') {
        console.log('🔧 Initializing Tesseract engine...');
      } else if (m.status === 'initialized tesseract') {
        console.log('✅ Tesseract engine ready');
      } else if (m.status === 'recognizing text') {
        console.log(`🔍 OCR Progress: ${Math.round(m.progress * 100)}%`);
      }
    }
  };

  try {
    // Create worker with configuration
    const worker = await Tesseract.createWorker(language, oem, finalConfig);
    console.log(`✅ Tesseract worker created for language: ${language}`);
    return worker;
  } catch (error) {
    console.error('❌ Failed to create Tesseract worker:', error);
    throw error;
  }
}

/**
 * Perform OCR on an image using a configured worker
 */
export async function performOCR(
  imageData: string | File | HTMLImageElement | HTMLCanvasElement,
  options: {
    language?: string;
    psm?: number;
    oem?: number;
    onProgress?: (progress: number, status: string) => void;
  } = {}
): Promise<{
  text: string;
  confidence: number;
  words: number;
  error?: string;
}> {
  const {
    language = 'eng',
    psm = 3, // PSM.AUTO
    oem = 1, // OEM.LSTM_ONLY
    onProgress
  } = options;

  let worker: Tesseract.Worker | null = null;

  try {
    // Create worker (OEM is set during worker creation, PSM can be set after)
    worker = await createTesseractWorker(language, oem, undefined, onProgress);

    // Set page segmentation mode only (OEM cannot be changed after initialization)
    await (worker as any).setParameters({
      tessedit_pageseg_mode: psm.toString(),
    });

    // Perform recognition
    const result = await worker.recognize(imageData);

    // Extract data
    const text = result.data.text?.trim() || '';
    const confidence = result.data.confidence || 0;
    const words = (result.data as any).words?.length || 0;

    return {
      text,
      confidence: confidence / 100, // Convert to 0-1 range
      words,
    };
  } catch (error) {
    console.error('❌ OCR failed:', error);
    return {
      text: '',
      confidence: 0,
      words: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    // Clean up worker
    if (worker) {
      try {
        await worker.terminate();
        console.log('🧹 Worker terminated');
      } catch (error) {
        console.warn('Failed to terminate worker:', error);
      }
    }
  }
}

/**
 * Check if Tesseract.js is properly configured and ready
 */
export async function checkTesseractReady(): Promise<boolean> {
  try {
    // Try to load the worker script
    const workerResponse = await fetch('/tesseract/worker.min.js');
    if (!workerResponse.ok) {
      console.warn('⚠️ Local worker script not found');
      return false;
    }

    // Try to load the core WASM file
    const coreResponse = await fetch('/tesseract/tesseract-core-simd.wasm.js');
    if (!coreResponse.ok) {
      console.warn('⚠️ Local core WASM file not found');
      return false;
    }

    // Check if language data is available
    const langResponse = await fetch('/tesseract/eng.traineddata.gz');
    if (!langResponse.ok) {
      console.warn('⚠️ Local language data not found');
      return false;
    }

    console.log('✅ Local Tesseract.js resources are available');
    return true;
  } catch (error) {
    console.warn('⚠️ Failed to check local Tesseract resources:', error);
    return false;
  }
}
