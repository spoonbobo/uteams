import { ipcMain, app } from 'electron';
import { PDFDocument, PDFPage, rgb, StandardFonts, PageSizes } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import { executeQuery } from './db';

// Dynamic import for PDF.js to handle ESM/CommonJS compatibility
let pdfjsLib: any = null;

// Helper function to classify text type for AI processing
function classifyTextType(text: string): string {
  const cleanText = text.trim().toLowerCase();

  // Classify text content for AI analysis
  if (/[α-ωΑ-Ω]/.test(text)) {
    return 'greek_letter';
  } else if (/[∑∏∫√±×÷≤≥≠≈∞]/.test(text)) {
    return 'math_symbol';
  } else if (/\b(equation|formula)\b/.test(cleanText)) {
    return 'formula';
  } else if (/\b(theorem|proof|lemma|corollary)\b/.test(cleanText)) {
    return 'theorem';
  } else if (/\b(solution|answer|result)\b/.test(cleanText)) {
    return 'solution';
  } else if (/^\d+[\.\d]*$/.test(text.trim())) {
    return 'number';
  } else if (/^[x-z]\d*$/.test(cleanText) || /^[x-z]\^\d+$/.test(cleanText)) {
    return 'variable';
  } else if (/\b(important|note|key|critical|essential)\b/.test(cleanText)) {
    return 'keyword';
  } else if (/^[A-Z][A-Z\s]+$/.test(text.trim())) {
    return 'heading';
  } else if (text.length > 100) {
    return 'paragraph';
  } else if (/^\d+\.|\([a-z]\)|\([0-9]\)/.test(text.trim())) {
    return 'list_item';
  } else {
    return 'text';
  }
}

// Helper function to generate comments for highlighted text
function generateComment(text: string, index: number): string {
  const cleanText = text.trim().toLowerCase();

  // Generate contextual comments based on content
  if (/[α-ωΑ-Ω]/.test(text)) {
    return 'Greek letter found';
  } else if (/[∑∏∫√±×÷≤≥≠≈∞]/.test(text)) {
    return 'Math symbol detected';
  } else if (/\b(equation|formula)\b/.test(cleanText)) {
    return 'Formula identified';
  } else if (/\b(theorem|proof)\b/.test(cleanText)) {
    return 'Theorem/proof';
  } else if (/\b(solution|answer)\b/.test(cleanText)) {
    return 'Solution found';
  } else if (/\d+[\.\d]*/.test(text)) {
    return 'Numerical value';
  } else if (/[x-z]\^?\d*/.test(cleanText)) {
    return 'Variable detected';
  } else if (text.length > 50) {
    return 'Long text segment';
  } else if (/\b(important|key|critical)\b/.test(cleanText)) {
    return 'Key term';
  } else {
    return `Note ${index + 1}`;
  }
}

// Helper function to set minimal worker
function setMinimalWorker() {
  const minimalWorker = `
    // Minimal PDF.js worker for Node.js
    self.onmessage = function(e) {
      self.postMessage({
        targetName: e.data.targetName,
        sourceName: e.data.sourceName,
        action: e.data.action,
        data: null
      });
    };
  `;
  const dataUrl = `data:application/javascript;base64,${Buffer.from(minimalWorker).toString('base64')}`;
  pdfjsLib.GlobalWorkerOptions.workerSrc = dataUrl;
  console.log('[PDF Tool] Minimal worker configured');
}

// Configure PDF.js worker for Node.js/Electron environment
async function configurePdfJsWorker() {
  try {
    // Load PDF.js dynamically
    if (!pdfjsLib) {
      pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
      console.log('[PDF Tool] PDF.js loaded dynamically');
      console.log('[PDF Tool] PDF.js version:', pdfjsLib.version || 'unknown');
      console.log('[PDF Tool] GlobalWorkerOptions available:', !!pdfjsLib.GlobalWorkerOptions);

      // Immediately try to set a basic worker configuration to prevent errors
      if (pdfjsLib.GlobalWorkerOptions) {
        try {
          // Set a temporary minimal worker source to prevent immediate errors
          const tempWorker = `
            // Temporary minimal PDF.js worker
            self.onmessage = function(e) {
              self.postMessage({
                targetName: e.data.targetName,
                sourceName: e.data.sourceName,
                action: e.data.action,
                data: null
              });
            };
          `;
          const tempDataUrl = `data:application/javascript;base64,${Buffer.from(tempWorker).toString('base64')}`;
          pdfjsLib.GlobalWorkerOptions.workerSrc = tempDataUrl;
          console.log('[PDF Tool] Temporary minimal worker source set');
        } catch (tempError) {
          console.warn('[PDF Tool] Could not set temporary worker source:', tempError);
        }
      }
    }

    // Set up the worker for Node.js environment
    // In Electron main process, we don't need a web worker, PDF.js can run directly
    // But we need to disable the worker requirement for Node.js environment
    if (typeof globalThis !== 'undefined' && !globalThis.window) {
      // We're in Node.js environment (Electron main process)
      // PDF.js will work without a worker in Node.js
      console.log('[PDF Tool] Configuring PDF.js worker for Node.js/Electron main process');

      // Try to find the PDF.js worker file
      const possibleWorkerPaths = [
        // Legacy build path (what we're using)
        path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs'),
        // Production/packaged paths
        path.join(process.resourcesPath, 'app', 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs'),
        path.join(app.getAppPath(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs'),
      ];

      let workerPath: string | undefined;
      for (const testPath of possibleWorkerPaths) {
        if (fs.existsSync(testPath)) {
          workerPath = testPath;
          break;
        }
      }

      if (workerPath) {
        try {
          // Use data URL method for maximum compatibility and security
          const workerContent = fs.readFileSync(workerPath, 'utf8');
          const dataUrl = `data:application/javascript;base64,${Buffer.from(workerContent).toString('base64')}`;
          pdfjsLib.GlobalWorkerOptions.workerSrc = dataUrl;
          console.log('[PDF Tool] Worker configured with data URL');
        } catch (error) {
          console.warn('[PDF Tool] Failed to load worker file, using minimal worker');
          setMinimalWorker();
        }
      } else {
        console.log('[PDF Tool] No worker file found, using minimal worker');
        setMinimalWorker();
      }
    }
  } catch (error) {
    console.warn('[PDF Tool] Failed to configure PDF.js worker:', error);
    // Fallback: provide a minimal worker for Node.js environment
    if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
      try {
        setMinimalWorker();
      } catch (finalError) {
        console.error('[PDF Tool] All worker configuration attempts failed:', finalError);
      }
    }
  }
}

// PDF Tool handlers - comprehensive PDF reading, editing, and saving functionality
export async function setupPdfHandlers() {
  // Configure PDF.js worker first
  await configurePdfJsWorker();

  // Register all PDF-related IPC handlers
  setupPdfReadHandlers();
  setupPdfEditHandlers();
  setupPdfUtilityHandlers();
}

// PDF Reading Handlers
function setupPdfReadHandlers() {
  // Read PDF metadata and basic information
  ipcMain.handle('pdf:get-info', async (event, args: { filePath: string }) => {
    try {
      if (!fs.existsSync(args.filePath)) {
        return {
          success: false,
          error: 'PDF file not found'
        };
      }

      const pdfBytes = fs.readFileSync(args.filePath);
      const pdfDoc = await PDFDocument.load(pdfBytes);

      const pageCount = pdfDoc.getPageCount();
      const title = pdfDoc.getTitle() || '';
      const author = pdfDoc.getAuthor() || '';
      const subject = pdfDoc.getSubject() || '';
      const creator = pdfDoc.getCreator() || '';
      const producer = pdfDoc.getProducer() || '';
      const creationDate = pdfDoc.getCreationDate();
      const modificationDate = pdfDoc.getModificationDate();

      // Get page dimensions for first page
      const firstPage = pdfDoc.getPage(0);
      const { width, height } = firstPage.getSize();

      return {
        success: true,
        data: {
          filePath: args.filePath,
          pageCount,
          title,
          author,
          subject,
          creator,
          producer,
          creationDate: creationDate?.toISOString(),
          modificationDate: modificationDate?.toISOString(),
          firstPageDimensions: { width, height },
          fileSize: pdfBytes.length
        }
      };
    } catch (error: any) {
      console.error('[PDF Tool] Error getting PDF info:', error);
      return {
        success: false,
        error: error.message || 'Failed to read PDF information'
      };
    }
  });



  // Parse PDF to AI-friendly JSON format optimized for highlighting and commenting
  ipcMain.handle('pdf:parse-to-json', async (event, args: {
    filePath: string;
    includeText?: boolean;
    includeMetadata?: boolean;
    includeStructure?: boolean;
  }) => {
    try {
      // Ensure PDF.js is loaded
      if (!pdfjsLib) {
        return {
          success: false,
          error: 'PDF.js library not loaded'
        };
      }

      if (!fs.existsSync(args.filePath)) {
        return {
          success: false,
          error: 'PDF file not found'
        };
      }

      const pdfBuffer = fs.readFileSync(args.filePath);

      // Convert Buffer to Uint8Array for PDF.js
      const pdfBytes = new Uint8Array(pdfBuffer);

      // Load PDF with PDF.js
      const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
      const pdfDocument = await loadingTask.promise;

      // Create AI-friendly structure optimized for highlighting and processing
      const aiOptimizedStructure: any = {
        document: {
          filePath: args.filePath,
          totalPages: pdfDocument.numPages,
          fileSize: pdfBuffer.length,
          parsedAt: new Date().toISOString()
        },
        elements: [], // Flat array of all text elements with indices
        pages: {},   // Page-indexed text content
        aiReference: {
          format: "highlight_patch_v1",
          description: "Use element indices to create highlight patches",
          examplePatch: {
            action: "highlight",
            elementId: "page_1_element_5",
            comment: "This is a key mathematical concept",
            highlightColor: "yellow",
            commentType: "analysis"
          }
        }
      };

      // Extract metadata if requested (simplified for AI)
      if (args.includeMetadata !== false) {
        try {
          const metadata = await pdfDocument.getMetadata();
          const info: any = metadata.info;
          aiOptimizedStructure.document.metadata = {
            title: info?.Title || '',
            author: info?.Author || '',
            subject: info?.Subject || ''
          };
        } catch (metaError) {
          console.warn('[PDF Parser] Could not extract metadata:', metaError);
          aiOptimizedStructure.document.metadata = { error: 'Could not extract metadata' };
        }
      }

      let globalElementIndex = 0;

      // Extract page structure and text content (AI-optimized)
      for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
        try {
          const page = await pdfDocument.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.0 });

          // Initialize page data
          aiOptimizedStructure.pages[`page_${pageNum}`] = {
            pageNumber: pageNum,
            dimensions: {
              width: viewport.width,
              height: viewport.height
            },
            elementCount: 0,
            fullText: ''
          };

          // Extract text content if requested
          if (args.includeText !== false) {
            try {
              const textContent = await page.getTextContent();

              if (textContent.items.length > 0) {
                const pageElements: any[] = [];
                let pageText = '';

                // Process each text item and create AI-friendly elements
                textContent.items.forEach((item: any, itemIndex: number) => {
                  if (item.str && item.str.trim()) {
                    const elementId = `page_${pageNum}_element_${itemIndex}`;

                    // Create AI-friendly element structure
                    const element = {
                      elementId: elementId,
                      globalIndex: globalElementIndex++,
                      pageNumber: pageNum,
                      localIndex: itemIndex,
                      content: {
                        text: item.str,
                        type: classifyTextType(item.str),
                        length: item.str.length,
                        wordCount: item.str.split(/\s+/).length
                      },
                      position: {
                        x: item.transform[4],
                        y: item.transform[5],
                        width: item.width,
                        height: item.height
                      },
                      style: {
                        fontName: item.fontName || 'unknown',
                        fontSize: item.height || 12
                      },
                      context: {
                        hasEOL: item.hasEOL || false,
                        transform: item.transform
                      }
                    };

                    pageElements.push(element);
                    aiOptimizedStructure.elements.push(element);
                    pageText += item.str + ' ';
                  }
                });

                // Store page summary
                aiOptimizedStructure.pages[`page_${pageNum}`].elementCount = pageElements.length;
                aiOptimizedStructure.pages[`page_${pageNum}`].fullText = pageText.trim();
                aiOptimizedStructure.pages[`page_${pageNum}`].elements = pageElements.map(el => el.elementId);
              }

            } catch (textError: any) {
              console.warn(`[PDF Parser] Could not extract text from page ${pageNum}:`, textError);
              aiOptimizedStructure.pages[`page_${pageNum}`].error = textError.message || 'Text extraction failed';
            }
          }

        } catch (pageError: any) {
          console.error(`[PDF Parser] Error processing page ${pageNum}:`, pageError);
          aiOptimizedStructure.pages[`page_${pageNum}`] = {
            pageNumber: pageNum,
            error: pageError.message || 'Page processing failed',
            elementCount: 0,
            fullText: ''
          };
        }
      }

      // Generate AI-friendly summary statistics
      const totalElements = aiOptimizedStructure.elements.length;
      const totalTextLength = aiOptimizedStructure.elements.reduce((sum: number, el: any) => sum + el.content.length, 0);
      const totalWordCount = aiOptimizedStructure.elements.reduce((sum: number, el: any) => sum + el.content.wordCount, 0);

      // Group elements by type for AI analysis
      const elementsByType = aiOptimizedStructure.elements.reduce((acc: any, el: any) => {
        acc[el.content.type] = (acc[el.content.type] || 0) + 1;
        return acc;
      }, {});

      aiOptimizedStructure.summary = {
        totalPages: pdfDocument.numPages,
        totalElements,
        totalTextLength,
        totalWordCount,
        averageElementsPerPage: Math.round(totalElements / pdfDocument.numPages),
        elementTypes: elementsByType,
        aiReadyFormat: true
      };

      // Add AI processing instructions
      aiOptimizedStructure.aiInstructions = {
        howToHighlight: "Use elementId to reference specific text elements for highlighting",
        supportedActions: ["highlight", "comment", "annotate"],
        patchFormat: {
          elementId: "page_X_element_Y",
          action: "highlight|comment|annotate",
          data: {
            comment: "Your analysis comment",
            highlightColor: "yellow|green|blue|red",
            importance: "low|medium|high"
          }
        },
        exampleUsage: [
          {
            elementId: "page_1_element_0",
            action: "highlight",
            data: {
              comment: "Key mathematical concept",
              highlightColor: "yellow",
              importance: "high"
            }
          }
        ]
      };

      return {
        success: true,
        data: aiOptimizedStructure
      };

    } catch (error: any) {
      console.error('[PDF Tool] Error parsing PDF to JSON:', error);
      return {
        success: false,
        error: error.message || 'Failed to parse PDF to JSON'
      };
    }
  });
}

// PDF Editing Handlers
function setupPdfEditHandlers() {
  // Add text to PDF
  ipcMain.handle('pdf:add-text', async (event, args: {
    filePath: string;
    outputPath?: string;
    text: string;
    pageNumber: number;
    x: number;
    y: number;
    fontSize?: number;
    color?: { r: number; g: number; b: number };
    font?: string;
  }) => {
    try {
      if (!fs.existsSync(args.filePath)) {
        return {
          success: false,
          error: 'PDF file not found'
        };
      }

      const pdfBytes = fs.readFileSync(args.filePath);
      const pdfDoc = await PDFDocument.load(pdfBytes);

      if (args.pageNumber < 0 || args.pageNumber >= pdfDoc.getPageCount()) {
        return {
          success: false,
          error: 'Invalid page number'
        };
      }

      const page = pdfDoc.getPage(args.pageNumber);
      const fontSize = args.fontSize || 12;
      const color = args.color || { r: 0, g: 0, b: 0 };

      // Load font (default to Helvetica)
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // Add text to the page
      page.drawText(args.text, {
        x: args.x,
        y: args.y,
        size: fontSize,
        font: font,
        color: rgb(color.r / 255, color.g / 255, color.b / 255),
      });

      // Save the modified PDF
      const modifiedPdfBytes = await pdfDoc.save();
      const outputPath = args.outputPath || args.filePath;

      fs.writeFileSync(outputPath, modifiedPdfBytes);

      return {
        success: true,
        data: {
          inputPath: args.filePath,
          outputPath,
          modification: {
            type: 'text',
            text: args.text,
            pageNumber: args.pageNumber + 1,
            position: { x: args.x, y: args.y },
            fontSize,
            color
          }
        }
      };
    } catch (error: any) {
      console.error('[PDF Tool] Error adding text:', error);
      return {
        success: false,
        error: error.message || 'Failed to add text to PDF'
      };
    }
  });


  // Apply AI-generated highlight patches to PDF
  ipcMain.handle('pdf:apply-ai-patches', async (event, args: {
    filePath: string;
    outputPath?: string;
    pdfStructure: any; // The AI-optimized structure
    patches: Array<{
      elementId: string;
      action: 'highlight' | 'comment' | 'annotate';
      data: {
        comment?: string;
        highlightColor?: 'yellow' | 'green' | 'blue' | 'red';
        importance?: 'low' | 'medium' | 'high';
      };
    }>;
  }) => {
    try {
      if (!fs.existsSync(args.filePath)) {
        return {
          success: false,
          error: 'PDF file not found'
        };
      }

      const pdfBytes = fs.readFileSync(args.filePath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      let patchesApplied = 0;
      const appliedPatches = [];

      // Apply each patch
      for (const patch of args.patches) {
        try {
          // Find the element in the structure
          const element = args.pdfStructure.elements.find((el: any) => el.elementId === patch.elementId);

          if (!element) {
            console.warn(`[PDF Tool] Element not found: ${patch.elementId}`);
            continue;
          }

          const page = pdfDoc.getPage(element.pageNumber - 1);
          const { width, height } = page.getSize();

          // Get highlight color
          const colorMap = {
            yellow: rgb(1, 1, 0),
            green: rgb(0, 1, 0),
            blue: rgb(0, 0.7, 1),
            red: rgb(1, 0.3, 0.3)
          };
          const highlightColor = colorMap[patch.data.highlightColor || 'yellow'];

          if (patch.action === 'highlight' || patch.action === 'annotate') {
            // Draw highlight rectangle
            page.drawRectangle({
              x: element.position.x - 2,
              y: element.position.y - 2,
              width: element.position.width + 4,
              height: element.position.height + 4,
              color: highlightColor,
              opacity: 0.3,
            });
          }

          if (patch.action === 'comment' || patch.action === 'annotate') {
            // Add comment if provided
            if (patch.data.comment) {
              const sanitizedComment = patch.data.comment
                .replace(/[^\x00-\x7F]/g, '?')
                .replace(/[\x00-\x1F\x7F]/g, '')
                .trim();

              if (sanitizedComment) {
                // Position comment intelligently
                const commentX = Math.min(element.position.x + element.position.width + 10, width - 150);
                const commentY = Math.max(element.position.y + element.position.height + 5, 25);

                // Draw comment background
                page.drawRectangle({
                  x: commentX - 3,
                  y: commentY - 3,
                  width: 140,
                  height: 20,
                  color: rgb(0.95, 0.95, 1),
                  opacity: 0.9,
                  borderColor: rgb(0, 0, 1),
                  borderWidth: 1,
                });

                // Draw comment text
                page.drawText(sanitizedComment, {
                  x: commentX,
                  y: commentY + 2,
                  size: 8,
                  font: font,
                  color: rgb(0, 0, 0.8),
                  maxWidth: 134,
                });
              }
            }
          }

          appliedPatches.push({
            elementId: patch.elementId,
            action: patch.action,
            element: {
              text: element.content.text,
              type: element.content.type,
              page: element.pageNumber
            }
          });

          patchesApplied++;

        } catch (patchError: any) {
          console.warn(`[PDF Tool] Error applying patch ${patch.elementId}:`, patchError);
        }
      }

      // Save the modified PDF
      const modifiedPdfBytes = await pdfDoc.save();
      const outputPath = args.outputPath || args.filePath.replace('.pdf', '_ai_annotated.pdf');

      fs.writeFileSync(outputPath, modifiedPdfBytes);

      return {
        success: true,
        data: {
          inputPath: args.filePath,
          outputPath,
          patchesApplied,
          totalPatches: args.patches.length,
          appliedPatches
        }
      };
    } catch (error: any) {
      console.error('[PDF Tool] Error applying AI patches:', error);
      return {
        success: false,
        error: error.message || 'Failed to apply AI patches to PDF'
      };
    }
  });

  // Add annotation/comment to PDF
  ipcMain.handle('pdf:add-annotation', async (event, args: {
    filePath: string;
    outputPath?: string;
    pageNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
    content: string;
    color?: { r: number; g: number; b: number };
  }) => {
    try {
      if (!fs.existsSync(args.filePath)) {
        return {
          success: false,
          error: 'PDF file not found'
        };
      }

      const pdfBytes = fs.readFileSync(args.filePath);
      const pdfDoc = await PDFDocument.load(pdfBytes);

      if (args.pageNumber < 0 || args.pageNumber >= pdfDoc.getPageCount()) {
        return {
          success: false,
          error: 'Invalid page number'
        };
      }

      const page = pdfDoc.getPage(args.pageNumber);
      const color = args.color || { r: 255, g: 255, b: 0 }; // Default yellow

      // Draw a rectangle for the annotation
      page.drawRectangle({
        x: args.x,
        y: args.y,
        width: args.width,
        height: args.height,
        borderColor: rgb(color.r / 255, color.g / 255, color.b / 255),
        borderWidth: 1,
        color: rgb(color.r / 255, color.g / 255, color.b / 255),
        opacity: 0.3,
      });

      // Add the annotation text
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      page.drawText(args.content, {
        x: args.x + 5,
        y: args.y + args.height - 15,
        size: 10,
        font: font,
        color: rgb(0, 0, 0),
        maxWidth: args.width - 10,
      });

      // Save the modified PDF
      const modifiedPdfBytes = await pdfDoc.save();
      const outputPath = args.outputPath || args.filePath;

      fs.writeFileSync(outputPath, modifiedPdfBytes);

      return {
        success: true,
        data: {
          inputPath: args.filePath,
          outputPath,
          modification: {
            type: 'annotation',
            content: args.content,
            pageNumber: args.pageNumber + 1,
            position: { x: args.x, y: args.y },
            dimensions: { width: args.width, height: args.height },
            color
          }
        }
      };
    } catch (error: any) {
      console.error('[PDF Tool] Error adding annotation:', error);
      return {
        success: false,
        error: error.message || 'Failed to add annotation to PDF'
      };
    }
  });

}

// PDF Utility Handlers
function setupPdfUtilityHandlers() {
  // Merge multiple PDFs
  ipcMain.handle('pdf:merge', async (event, args: {
    inputPaths: string[];
    outputPath: string;
  }) => {
    try {
      if (!args.inputPaths || args.inputPaths.length === 0) {
        return {
          success: false,
          error: 'No input PDF files provided'
        };
      }

      // Check if all files exist
      for (const filePath of args.inputPaths) {
        if (!fs.existsSync(filePath)) {
          return {
            success: false,
            error: `PDF file not found: ${filePath}`
          };
        }
      }

      const mergedPdf = await PDFDocument.create();

      for (const filePath of args.inputPaths) {
        const pdfBytes = fs.readFileSync(filePath);
        const pdf = await PDFDocument.load(pdfBytes);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      // Save merged PDF
      const mergedPdfBytes = await mergedPdf.save();
      fs.writeFileSync(args.outputPath, mergedPdfBytes);

      return {
        success: true,
        data: {
          inputPaths: args.inputPaths,
          outputPath: args.outputPath,
          totalPages: mergedPdf.getPageCount(),
          inputFileCount: args.inputPaths.length
        }
      };
    } catch (error: any) {
      console.error('[PDF Tool] Error merging PDFs:', error);
      return {
        success: false,
        error: error.message || 'Failed to merge PDF files'
      };
    }
  });

  // Split PDF into separate files
  ipcMain.handle('pdf:split', async (event, args: {
    filePath: string;
    outputDir: string;
    splitType: 'pages' | 'range';
    pageRanges?: { start: number; end: number; name?: string }[];
    fileNamePrefix?: string;
  }) => {
    try {
      if (!fs.existsSync(args.filePath)) {
        return {
          success: false,
          error: 'PDF file not found'
        };
      }

      const pdfBytes = fs.readFileSync(args.filePath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pageCount = pdfDoc.getPageCount();

      // Ensure output directory exists
      if (!fs.existsSync(args.outputDir)) {
        fs.mkdirSync(args.outputDir, { recursive: true });
      }

      const outputFiles = [];
      const prefix = args.fileNamePrefix || 'split';

      if (args.splitType === 'pages') {
        // Split into individual pages
        for (let i = 0; i < pageCount; i++) {
          const newPdf = await PDFDocument.create();
          const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
          newPdf.addPage(copiedPage);

          const outputPath = path.join(args.outputDir, `${prefix}_page_${i + 1}.pdf`);
          const pdfBytes = await newPdf.save();
          fs.writeFileSync(outputPath, pdfBytes);

          outputFiles.push({
            path: outputPath,
            pageRange: { start: i + 1, end: i + 1 },
            pageCount: 1
          });
        }
      } else if (args.splitType === 'range' && args.pageRanges) {
        // Split by specified ranges
        for (let rangeIndex = 0; rangeIndex < args.pageRanges.length; rangeIndex++) {
          const range = args.pageRanges[rangeIndex];
          const startPage = Math.max(0, Math.min(range.start - 1, pageCount - 1));
          const endPage = Math.max(startPage, Math.min(range.end - 1, pageCount - 1));

          const newPdf = await PDFDocument.create();
          const pageIndices = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
          const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
          copiedPages.forEach((page) => newPdf.addPage(page));

          const fileName = range.name || `${prefix}_range_${rangeIndex + 1}`;
          const outputPath = path.join(args.outputDir, `${fileName}.pdf`);
          const pdfBytes = await newPdf.save();
          fs.writeFileSync(outputPath, pdfBytes);

          outputFiles.push({
            path: outputPath,
            pageRange: { start: startPage + 1, end: endPage + 1 },
            pageCount: endPage - startPage + 1
          });
        }
      }

      return {
        success: true,
        data: {
          inputPath: args.filePath,
          outputDir: args.outputDir,
          splitType: args.splitType,
          originalPageCount: pageCount,
          outputFiles
        }
      };
    } catch (error: any) {
      console.error('[PDF Tool] Error splitting PDF:', error);
      return {
        success: false,
        error: error.message || 'Failed to split PDF file'
      };
    }
  });

  // Create new PDF from scratch
  ipcMain.handle('pdf:create', async (event, args: {
    outputPath: string;
    pages: Array<{
      size?: { width: number; height: number };
      content?: string;
      textElements?: Array<{
        text: string;
        x: number;
        y: number;
        fontSize?: number;
        color?: { r: number; g: number; b: number };
      }>;
    }>;
    metadata?: {
      title?: string;
      author?: string;
      subject?: string;
      creator?: string;
    };
  }) => {
    try {
      const pdfDoc = await PDFDocument.create();

      // Set metadata if provided
      if (args.metadata) {
        if (args.metadata.title) pdfDoc.setTitle(args.metadata.title);
        if (args.metadata.author) pdfDoc.setAuthor(args.metadata.author);
        if (args.metadata.subject) pdfDoc.setSubject(args.metadata.subject);
        if (args.metadata.creator) pdfDoc.setCreator(args.metadata.creator);
      }

      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      for (const pageConfig of args.pages) {
        const pageSize = pageConfig.size || { width: PageSizes.A4[0], height: PageSizes.A4[1] };
        const page = pdfDoc.addPage([pageSize.width, pageSize.height]);

        // Add basic content if provided
        if (pageConfig.content) {
          page.drawText(pageConfig.content, {
            x: 50,
            y: pageSize.height - 100,
            size: 12,
            font: font,
            color: rgb(0, 0, 0),
            maxWidth: pageSize.width - 100,
          });
        }

        // Add custom text elements if provided
        if (pageConfig.textElements) {
          for (const textElement of pageConfig.textElements) {
            const color = textElement.color || { r: 0, g: 0, b: 0 };
            page.drawText(textElement.text, {
              x: textElement.x,
              y: textElement.y,
              size: textElement.fontSize || 12,
              font: font,
              color: rgb(color.r / 255, color.g / 255, color.b / 255),
            });
          }
        }
      }

      // Save the new PDF
      const pdfBytes = await pdfDoc.save();
      fs.writeFileSync(args.outputPath, pdfBytes);

      return {
        success: true,
        data: {
          outputPath: args.outputPath,
          pageCount: pdfDoc.getPageCount(),
          metadata: args.metadata,
          fileSize: pdfBytes.length
        }
      };
    } catch (error: any) {
      console.error('[PDF Tool] Error creating PDF:', error);
      return {
        success: false,
        error: error.message || 'Failed to create PDF file'
      };
    }
  });

  // Save PDF modifications history to database
  ipcMain.handle('pdf:save-modification-history', async (event, args: {
    filePath: string;
    modifications: Array<{
      type: string;
      timestamp: string;
      details: any;
    }>;
  }) => {
    try {
      const query = `
        INSERT INTO kv_store (namespace, key, value)
        VALUES ('pdf_history', ?, ?)
        ON CONFLICT(namespace, key)
        DO UPDATE SET value = excluded.value
      `;

      const historyData = JSON.stringify({
        filePath: args.filePath,
        modifications: args.modifications,
        lastModified: new Date().toISOString()
      });

      const key = Buffer.from(args.filePath).toString('base64');
      executeQuery(query, [key, historyData]);

      return { success: true };
    } catch (error: any) {
      console.error('[PDF Tool] Error saving modification history:', error);
      return {
        success: false,
        error: error.message || 'Failed to save modification history'
      };
    }
  });

  // Get PDF modifications history from database
  ipcMain.handle('pdf:get-modification-history', async (event, args: { filePath: string }) => {
    try {
      const query = `
        SELECT value FROM kv_store
        WHERE namespace = 'pdf_history' AND key = ?
      `;

      const key = Buffer.from(args.filePath).toString('base64');
      const result = executeQuery<{ value: string }>(query, [key]) as { value: string }[];

      if (result && result.length > 0) {
        const historyData = JSON.parse(result[0].value);
        return {
          success: true,
          data: historyData
        };
      } else {
        return {
          success: true,
          data: {
            filePath: args.filePath,
            modifications: [],
            lastModified: null
          }
        };
      }
    } catch (error: any) {
      console.error('[PDF Tool] Error getting modification history:', error);
      return {
        success: false,
        error: error.message || 'Failed to get modification history'
      };
    }
  });
}

