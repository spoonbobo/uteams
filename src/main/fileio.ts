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

// Register custom protocol for serving local files
export function registerLocalFileProtocol() {
  // Register protocol to handle local-file:// URLs
  protocol.registerFileProtocol('local-file', (request, callback) => {
    const url = request.url.replace('local-file://', '');

    try {
      // Decode URL and handle Windows paths
      const decodedPath = decodeURIComponent(url).replace(/^\/?/, '');

      // On Windows, the path might start with a drive letter
      const filePath = process.platform === 'win32'
        ? decodedPath.replace(/\//g, '\\')
        : '/' + decodedPath;

      console.log('[Protocol] Serving file:', filePath);

      // Check if file exists
      if (fs.existsSync(filePath)) {
        callback({ path: filePath });
      } else {
        console.error('[Protocol] File not found:', filePath);
        callback({ error: -6 }); // NET_ERROR_FILE_NOT_FOUND
      }
    } catch (error) {
      console.error('[Protocol] Error serving file:', error);
      callback({ error: -2 }); // NET_ERROR_FAILED
    }
  });
}
