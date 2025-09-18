/**
 * OCR (Optical Character Recognition) type definitions
 */

export interface OcrResult {
  success: boolean;
  text?: string;
  error?: string;
  confidence?: number;
  language?: string;
}

export interface OcrOptions {
  language?: string; // Language code like 'en-US', 'zh-CN', etc.
  timeout?: number; // Timeout in milliseconds
}

export interface OcrAPI {
  /**
   * Perform OCR on an image file using Windows native OCR API
   * @param imagePath Path to the image file
   * @param options OCR options
   * @returns Promise resolving to OCR result
   */
  perform: (imagePath: string, options?: OcrOptions) => Promise<OcrResult>;

  /**
   * Get available OCR languages on the system
   * @returns Promise resolving to array of language codes
   */
  getLanguages: () => Promise<string[]>;

  /**
   * Take a screenshot of the entire screen and perform OCR
   * @param options OCR options
   * @returns Promise resolving to OCR result with screenshot path
   */
  screenshot: (options?: OcrOptions) => Promise<OcrResult & { screenshotPath?: string }>;

  /**
   * Run OCR system diagnostics
   * @returns Promise resolving to diagnostic information
   */
  diagnostics: () => Promise<any>;
}
