import { ipcMain, app, protocol } from 'electron';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

// Get app data directory for storing downloaded files
const getDownloadsPath = () => {
  const appDataPath = app.getPath('userData');
  const appName = app?.getName?.() || 'ezzzbet';
  const downloadsPath = path.join(appDataPath, `${appName}-data`, 'downloads', 'assignments');

  // Ensure directory exists
  if (!fs.existsSync(downloadsPath)) {
    fs.mkdirSync(downloadsPath, { recursive: true });
  }

  return downloadsPath;
};

// Setup file I/O handlers
export function setupFileIOHandlers() {
  // Download file from URL
  ipcMain.handle('fileio:download-file', async (event, args: {
    url: string;
    filename: string;
    headers?: Record<string, string>;
  }) => {
    console.log('[FileIO] Downloading file:', args.filename, 'from:', args.url);

    try {
      const downloadsPath = getDownloadsPath();
      const filePath = path.join(downloadsPath, args.filename);

      // Download file with headers (for authentication)
      const response = await axios.get(args.url, {
        responseType: 'stream',
        headers: args.headers || {}
      });

      // Create write stream
      const writer = fs.createWriteStream(filePath);

      // Pipe response to file
      response.data.pipe(writer);

      // Wait for download to complete
      await new Promise<void>((resolve, reject) => {
        writer.on('finish', () => resolve());
        writer.on('error', reject);
      });

      console.log('[FileIO] File downloaded successfully:', filePath);

      return {
        success: true,
        filePath,
        filename: args.filename,
        size: fs.statSync(filePath).size
      };
    } catch (error: any) {
      console.error('[FileIO] Error downloading file:', error);
      return {
        success: false,
        error: error.message || 'Failed to download file'
      };
    }
  });

  // Get file info
  ipcMain.handle('fileio:get-file-info', async (event, args: { filename: string }) => {
    try {
      const downloadsPath = getDownloadsPath();
      const filePath = path.join(downloadsPath, args.filename);

      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          error: 'File not found'
        };
      }

      const stats = fs.statSync(filePath);

      return {
        success: true,
        filePath,
        filename: args.filename,
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to get file info'
      };
    }
  });

  // Delete file
  ipcMain.handle('fileio:delete-file', async (event, args: { filename: string }) => {
    try {
      const downloadsPath = getDownloadsPath();
      const filePath = path.join(downloadsPath, args.filename);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      return {
        success: true,
        message: 'File deleted successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to delete file'
      };
    }
  });

  // List downloaded files
  ipcMain.handle('fileio:list-files', async () => {
    try {
      const downloadsPath = getDownloadsPath();

      if (!fs.existsSync(downloadsPath)) {
        return {
          success: true,
          files: []
        };
      }

      const files = fs.readdirSync(downloadsPath).map(filename => {
        const filePath = path.join(downloadsPath, filename);
        const stats = fs.statSync(filePath);

        return {
          filename,
          filePath,
          size: stats.size,
          modified: stats.mtime,
          created: stats.birthtime
        };
      });

      return {
        success: true,
        files
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to list files'
      };
    }
  });

  // Save temporary file from array buffer data
  ipcMain.handle('fileio:save-temp-file', async (event, args: {
    filename: string;
    data: number[]; // Array of bytes
  }) => {
    console.log('[FileIO] Saving temp file:', args.filename);

    try {
      const downloadsPath = getDownloadsPath();
      const filePath = path.join(downloadsPath, args.filename);

      // Convert number array back to Buffer
      const buffer = Buffer.from(args.data);

      // Write file
      fs.writeFileSync(filePath, buffer);

      console.log('[FileIO] Temp file saved successfully:', filePath);

      return {
        success: true,
        filePath,
        filename: args.filename,
        size: buffer.length
      };
    } catch (error: any) {
      console.error('[FileIO] Error saving temp file:', error);
      return {
        success: false,
        error: error.message || 'Failed to save temp file'
      };
    }
  });

  // Get downloads directory path
  ipcMain.handle('fileio:get-downloads-path', async () => {
    try {
      return {
        success: true,
        path: getDownloadsPath()
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to get downloads path'
      };
    }
  });

  // Save prompt to AppData for debugging
  ipcMain.handle('fileio:save-prompt-debug', async (event, args: {
    sessionId: string;
    prompt: string;
    metadata?: Record<string, any>;
  }) => {
    console.log('[FileIO] Saving prompt for debugging:', args.sessionId);

    try {
      const appDataPath = app.getPath('userData');
      const appName = app?.getName?.() || 'ezzzbet';
      const debugPath = path.join(appDataPath, `${appName}-data`, 'debug', 'prompts');

      // Ensure directory exists
      if (!fs.existsSync(debugPath)) {
        fs.mkdirSync(debugPath, { recursive: true });
      }

      // Create filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `prompt_${args.sessionId}_${timestamp}.txt`;
      const filePath = path.join(debugPath, filename);

      // Prepare content with metadata
      let content = '';
      if (args.metadata) {
        content += `=== PROMPT DEBUG INFO ===\n`;
        content += `Session ID: ${args.sessionId}\n`;
        content += `Timestamp: ${new Date().toISOString()}\n`;
        Object.entries(args.metadata).forEach(([key, value]) => {
          content += `${key}: ${JSON.stringify(value)}\n`;
        });
        content += `\n=== PROMPT CONTENT ===\n`;
      }
      content += args.prompt;

      // Write file
      fs.writeFileSync(filePath, content, 'utf8');

      console.log('[FileIO] Prompt saved for debugging:', filePath);

      return {
        success: true,
        filePath,
        filename,
        debugPath
      };
    } catch (error: any) {
      console.error('[FileIO] Error saving prompt for debugging:', error);
      return {
        success: false,
        error: error.message || 'Failed to save prompt for debugging'
      };
    }
  });

  // Read file as base64 data URL for images
  ipcMain.handle('fileio:read-as-data-url', async (event, args: { filepath: string }) => {
    try {
      const filePath = args.filepath;

      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          error: 'File not found'
        };
      }

      // Read file as buffer
      const buffer = fs.readFileSync(filePath);

      // Determine mime type based on extension
      const ext = path.extname(filePath).toLowerCase();
      let mimeType = 'image/jpeg'; // default

      switch(ext) {
        case '.png':
          mimeType = 'image/png';
          break;
        case '.jpg':
        case '.jpeg':
          mimeType = 'image/jpeg';
          break;
        case '.gif':
          mimeType = 'image/gif';
          break;
        case '.webp':
          mimeType = 'image/webp';
          break;
        case '.svg':
          mimeType = 'image/svg+xml';
          break;
      }

      // Convert to base64 data URL
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64}`;

      return {
        success: true,
        dataUrl
      };
    } catch (error: any) {
      console.error('[FileIO] Error reading file as data URL:', error);
      return {
        success: false,
        error: error.message || 'Failed to read file'
      };
    }
  });
}

// Register secure custom protocol for serving local files
export function registerSecureFileProtocol() {
  // Register protocol to handle app-file:// URLs with proper security
  protocol.registerBufferProtocol('app-file', (request, callback) => {
    const url = request.url.replace('app-file://', '');

    try {
      // Remove URL fragments (like #page=1&zoom=100) from the path
      const urlWithoutFragment = url.split('#')[0];

      // Decode URL and handle Windows paths
      const decodedPath = decodeURIComponent(urlWithoutFragment).replace(/^\/?/, '');

      // On Windows, the path might start with a drive letter
      const filePath = process.platform === 'win32'
        ? decodedPath.replace(/\//g, '\\')
        : '/' + decodedPath;

      console.log('[Protocol] Serving file:', filePath);

      // Security: Validate that the file path is safe
      const normalizedPath = path.normalize(filePath);
      const appDataPath = app.getPath('userData');
      const userHomePath = app.getPath('home');

      // Allow files from user data directory, user home, or absolute paths for background images
      const isInUserData = normalizedPath.startsWith(path.normalize(appDataPath));
      const isInUserHome = normalizedPath.startsWith(path.normalize(userHomePath));
      const isAbsolutePath = path.isAbsolute(normalizedPath);

      if (!isInUserData && !isInUserHome && !isAbsolutePath) {
        console.error('[Protocol] File path not allowed for security reasons:', normalizedPath);
        callback({ error: -10 }); // NET_ERROR_ACCESS_DENIED
        return;
      }

      // Check if file exists
      if (!fs.existsSync(normalizedPath)) {
        console.error('[Protocol] File not found:', normalizedPath);
        callback({ error: -6 }); // NET_ERROR_FILE_NOT_FOUND
        return;
      }

      // Read file and determine MIME type
      const fileBuffer = fs.readFileSync(normalizedPath);
      const ext = path.extname(normalizedPath).toLowerCase();

      let mimeType = 'application/octet-stream'; // default
      switch(ext) {
        case '.png':
          mimeType = 'image/png';
          break;
        case '.jpg':
        case '.jpeg':
          mimeType = 'image/jpeg';
          break;
        case '.gif':
          mimeType = 'image/gif';
          break;
        case '.webp':
          mimeType = 'image/webp';
          break;
        case '.svg':
          mimeType = 'image/svg+xml';
          break;
        case '.bmp':
          mimeType = 'image/bmp';
          break;
        case '.ico':
          mimeType = 'image/x-icon';
          break;
        case '.tiff':
        case '.tif':
          mimeType = 'image/tiff';
          break;
        case '.pdf':
          mimeType = 'application/pdf';
          break;
      }

      console.log(`[Protocol] Serving ${mimeType} file: ${normalizedPath} (${fileBuffer.length} bytes)`);

      callback({
        mimeType,
        data: fileBuffer
      });

    } catch (error) {
      console.error('[Protocol] Error serving file:', error);
      callback({ error: -2 }); // NET_ERROR_FAILED
    }
  });
}

// Legacy function name for backward compatibility
export const registerLocalFileProtocol = registerSecureFileProtocol;
