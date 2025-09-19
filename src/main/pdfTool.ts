import { ipcMain } from 'electron';
import { PDFDocument, PDFPage, rgb, StandardFonts, PageSizes } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import { executeQuery } from './db';

// PDF Tool handlers - comprehensive PDF reading, editing, and saving functionality
export function setupPdfHandlers() {
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

  // Extract text from PDF (basic text extraction)
  ipcMain.handle('pdf:extract-text', async (event, args: {
    filePath: string;
    pageNumber?: number;
    startPage?: number;
    endPage?: number;
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
      let startPage = args.startPage || 0;
      let endPage = args.endPage || pageCount - 1;

      // If specific page number is provided, extract from that page only
      if (args.pageNumber !== undefined) {
        startPage = args.pageNumber;
        endPage = args.pageNumber;
      }

      // Validate page ranges
      startPage = Math.max(0, Math.min(startPage, pageCount - 1));
      endPage = Math.max(startPage, Math.min(endPage, pageCount - 1));

      const extractedPages = [];

      for (let i = startPage; i <= endPage; i++) {
        const page = pdfDoc.getPage(i);
        const { width, height } = page.getSize();

        // Note: pdf-lib doesn't have built-in text extraction
        // For actual text extraction, you'd need additional libraries like pdf2pic + OCR
        // or pdf-parse. For now, we'll return page structure info
        extractedPages.push({
          pageNumber: i + 1,
          dimensions: { width, height },
          // text: '', // Would need additional library for text extraction
          hasText: true // Placeholder - would need actual text detection
        });
      }

      return {
        success: true,
        data: {
          filePath: args.filePath,
          totalPages: pageCount,
          extractedPages,
          note: 'Text extraction requires additional libraries like pdf-parse for full functionality'
        }
      };
    } catch (error: any) {
      console.error('[PDF Tool] Error extracting text:', error);
      return {
        success: false,
        error: error.message || 'Failed to extract text from PDF'
      };
    }
  });

  // Get PDF page as image data (for preview)
  ipcMain.handle('pdf:get-page-preview', async (event, args: {
    filePath: string;
    pageNumber: number;
    scale?: number;
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
      const { width, height } = page.getSize();
      const scale = args.scale || 1.0;

      return {
        success: true,
        data: {
          pageNumber: args.pageNumber + 1,
          dimensions: { width: width * scale, height: height * scale },
          originalDimensions: { width, height },
          scale,
          note: 'Page preview as image data requires additional libraries like pdf2pic'
        }
      };
    } catch (error: any) {
      console.error('[PDF Tool] Error getting page preview:', error);
      return {
        success: false,
        error: error.message || 'Failed to get page preview'
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

  // Insert new page to PDF
  ipcMain.handle('pdf:insert-page', async (event, args: {
    filePath: string;
    outputPath?: string;
    insertAt: number;
    pageSize?: { width: number; height: number };
    content?: string;
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

      // Validate insert position
      const pageCount = pdfDoc.getPageCount();
      const insertAt = Math.max(0, Math.min(args.insertAt, pageCount));

      // Create new page
      const pageSize = args.pageSize || { width: PageSizes.A4[0], height: PageSizes.A4[1] };
      const newPage = pdfDoc.insertPage(insertAt, [pageSize.width, pageSize.height]);

      // Add content if provided
      if (args.content) {
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        newPage.drawText(args.content, {
          x: 50,
          y: pageSize.height - 100,
          size: 12,
          font: font,
          color: rgb(0, 0, 0),
          maxWidth: pageSize.width - 100,
        });
      }

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
            type: 'insert-page',
            insertedAt: insertAt,
            newPageCount: pdfDoc.getPageCount(),
            pageSize,
            content: args.content || ''
          }
        }
      };
    } catch (error: any) {
      console.error('[PDF Tool] Error inserting page:', error);
      return {
        success: false,
        error: error.message || 'Failed to insert page to PDF'
      };
    }
  });

  // Remove page from PDF
  ipcMain.handle('pdf:remove-page', async (event, args: {
    filePath: string;
    outputPath?: string;
    pageNumber: number;
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

      if (pdfDoc.getPageCount() <= 1) {
        return {
          success: false,
          error: 'Cannot remove the last page from PDF'
        };
      }

      // Remove the page
      pdfDoc.removePage(args.pageNumber);

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
            type: 'remove-page',
            removedPage: args.pageNumber + 1,
            newPageCount: pdfDoc.getPageCount()
          }
        }
      };
    } catch (error: any) {
      console.error('[PDF Tool] Error removing page:', error);
      return {
        success: false,
        error: error.message || 'Failed to remove page from PDF'
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
