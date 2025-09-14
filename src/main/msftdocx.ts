import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';

// Function to add custom element indexing to HTML
function addElementIndexing(html: string): { indexedHtml: string; elementCounts: any } {
  const elementCounts = {
    paragraph: 0,
    heading1: 0,
    heading2: 0,
    heading3: 0,
    heading4: 0,
    heading5: 0,
    heading6: 0,
    list: 0,
    listItem: 0,
    table: 0,
    tableRow: 0,
    tableCell: 0
  };

  let indexedHtml = html;

  // Add indexing to headings (0-based indexing)
  indexedHtml = indexedHtml.replace(/<h1([^>]*)>/g, (match, attrs) => {
    const index = elementCounts.heading1++;
    elementCounts.paragraph++;
    return `<h1${attrs} data-element-type="heading1" data-element-index="${index}" data-paragraph-index="${elementCounts.paragraph}">`;
  });

  indexedHtml = indexedHtml.replace(/<h2([^>]*)>/g, (match, attrs) => {
    const index = elementCounts.heading2++;
    elementCounts.paragraph++;
    return `<h2${attrs} data-element-type="heading2" data-element-index="${index}" data-paragraph-index="${elementCounts.paragraph}">`;
  });

  indexedHtml = indexedHtml.replace(/<h3([^>]*)>/g, (match, attrs) => {
    const index = elementCounts.heading3++;
    elementCounts.paragraph++;
    return `<h3${attrs} data-element-type="heading3" data-element-index="${index}" data-paragraph-index="${elementCounts.paragraph}">`;
  });

  indexedHtml = indexedHtml.replace(/<h4([^>]*)>/g, (match, attrs) => {
    const index = elementCounts.heading4++;
    elementCounts.paragraph++;
    return `<h4${attrs} data-element-type="heading4" data-element-index="${index}" data-paragraph-index="${elementCounts.paragraph}">`;
  });

  indexedHtml = indexedHtml.replace(/<h5([^>]*)>/g, (match, attrs) => {
    const index = elementCounts.heading5++;
    elementCounts.paragraph++;
    return `<h5${attrs} data-element-type="heading5" data-element-index="${index}" data-paragraph-index="${elementCounts.paragraph}">`;
  });

  indexedHtml = indexedHtml.replace(/<h6([^>]*)>/g, (match, attrs) => {
    const index = elementCounts.heading6++;
    elementCounts.paragraph++;
    return `<h6${attrs} data-element-type="heading6" data-element-index="${index}" data-paragraph-index="${elementCounts.paragraph}">`;
  });

  // Add indexing to paragraphs (0-based indexing)
  indexedHtml = indexedHtml.replace(/<p([^>]*)>/g, (match, attrs) => {
    const index = elementCounts.paragraph++;
    return `<p${attrs} data-element-type="paragraph" data-element-index="${index}">`;
  });

  // Add indexing to tables (0-based indexing)
  indexedHtml = indexedHtml.replace(/<table([^>]*)>/g, (match, attrs) => {
    const index = elementCounts.table++;
    return `<table${attrs} data-element-type="table" data-element-index="${index}">`;
  });

  // Add indexing to table rows (0-based indexing)
  indexedHtml = indexedHtml.replace(/<tr([^>]*)>/g, (match, attrs) => {
    const index = elementCounts.tableRow++;
    return `<tr${attrs} data-element-type="tableRow" data-element-index="${index}">`;
  });

  // Add indexing to table cells (0-based indexing)
  indexedHtml = indexedHtml.replace(/<td([^>]*)>/g, (match, attrs) => {
    const index = elementCounts.tableCell++;
    return `<td${attrs} data-element-type="tableCell" data-element-index="${index}">`;
  });

  indexedHtml = indexedHtml.replace(/<th([^>]*)>/g, (match, attrs) => {
    const index = elementCounts.tableCell++;
    return `<th${attrs} data-element-type="tableCell" data-element-index="${index}">`;
  });

  // Add indexing to lists (0-based indexing)
  indexedHtml = indexedHtml.replace(/<ul([^>]*)>/g, (match, attrs) => {
    const index = elementCounts.list++;
    return `<ul${attrs} data-element-type="list" data-element-index="${index}">`;
  });

  indexedHtml = indexedHtml.replace(/<ol([^>]*)>/g, (match, attrs) => {
    const index = elementCounts.list++;
    return `<ol${attrs} data-element-type="list" data-element-index="${index}">`;
  });

  indexedHtml = indexedHtml.replace(/<li([^>]*)>/g, (match, attrs) => {
    const index = elementCounts.listItem++;
    return `<li${attrs} data-element-type="listItem" data-element-index="${index}">`;
  });

  // Debug: Log element counts only
  console.log('[DOCX] Element counts:', elementCounts);
  
  return { indexedHtml, elementCounts };
}


export function setupDocxHandlers() {
  // Parse DOCX file and extract text content
  ipcMain.handle('docx:parse-file', async (event, args: { filePath: string }) => {
    console.log('[DOCX] Parsing file:', args.filePath);
    
    if (!mammoth) {
      console.error('[DOCX] Mammoth library not available');
      return {
        success: false,
        error: 'DOCX parser not available. Please install mammoth library.'
      };
    }
    
    try {
      if (!fs.existsSync(args.filePath)) {
        console.error('[DOCX] File not found:', args.filePath);
        return {
          success: false,
          error: 'File not found'
        };
      }
      
      // Read and parse DOCX file
      const result = await mammoth.extractRawText({ path: args.filePath });
      const htmlResult = await mammoth.convertToHtml({ path: args.filePath });
      
      // Post-process HTML to add custom indexing
      const { indexedHtml, elementCounts } = addElementIndexing(htmlResult.value);
      
      const wordCount = result.value.split(/\s+/).filter((word: string) => word.length > 0).length;
      console.log('[DOCX] Parsed successfully - Words:', wordCount, 'Characters:', result.value.length);
      
      return {
        success: true,
        content: {
          text: result.value,
          html: indexedHtml,
          messages: result.messages || [],
          wordCount,
          characterCount: result.value.length,
          elementCounts: elementCounts
        }
      };
    } catch (error: any) {
      console.error('[DOCX] Error parsing file:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to parse DOCX file'
      };
    }
  });
  
  // Parse DOCX from buffer (for direct file uploads)
  ipcMain.handle('docx:parse-buffer', async (event, args: { buffer: Buffer }) => {
    console.log('[DOCX] Parsing buffer, size:', args.buffer.length);
    
    if (!mammoth) {
      return {
        success: false,
        error: 'DOCX parser not available. Please install mammoth library.'
      };
    }
    
    try {
      // Parse DOCX from buffer
      const result = await mammoth.extractRawText({ buffer: args.buffer });
      
      // Also get HTML version for better formatting
      const htmlResult = await mammoth.convertToHtml({ buffer: args.buffer });
      
      // Post-process HTML to add custom indexing
      const { indexedHtml, elementCounts } = addElementIndexing(htmlResult.value);
      
      return {
        success: true,
        content: {
          text: result.value,
          html: indexedHtml,
          messages: result.messages || [],
          wordCount: result.value.split(/\s+/).filter((word: string) => word.length > 0).length,
          characterCount: result.value.length,
          elementCounts: elementCounts
        }
      };
    } catch (error: any) {
      console.error('[DOCX] Error parsing buffer:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to parse DOCX buffer'
      };
    }
  });
  
  // Get DOCX metadata (if available)
  ipcMain.handle('docx:get-metadata', async (event, args: { filePath: string }) => {
    if (!mammoth) {
      return {
        success: false,
        error: 'DOCX parser not available. Please install mammoth library.'
      };
    }
    
    try {
      if (!fs.existsSync(args.filePath)) {
        return {
          success: false,
          error: 'File not found'
        };
      }
      
      // Get file stats
      const stats = fs.statSync(args.filePath);
      
      // For now, we'll return basic file metadata
      // The mammoth library doesn't expose document properties easily
      return {
        success: true,
        metadata: {
          filename: path.basename(args.filePath),
          size: stats.size,
          modified: stats.mtime,
          created: stats.birthtime,
          extension: path.extname(args.filePath)
        }
      };
    } catch (error: any) {
      console.error('[DOCX] Error getting metadata:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to get DOCX metadata'
      };
    }
  });
}
