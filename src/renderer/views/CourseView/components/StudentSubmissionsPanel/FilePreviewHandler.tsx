import { useState } from 'react';
import type { SubmissionFile } from './types';
import type { DocxContent } from '@/components/DocxPreview/types';

export const useFilePreviewHandler = () => {
  const [docxContent, setDocxContent] = useState<DocxContent | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const handleFilePreview = async (
    studentId: string, 
    file: SubmissionFile, 
    studentName: string,
    selectedAssignment: string,
    onDialogOpen: (studentName: string, filename: string) => void
  ) => {
    if (file.mimetype !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && 
        !file.filename.toLowerCase().endsWith('.docx')) {
      return;
    }

    // Set dialog info and open it
    onDialogOpen(studentName, file.filename);
    setFileLoading(true);
    setFileError(null);
    setDocxContent(null);

    try {
      const configResult = await window.electron.ipcRenderer.invoke('moodle:get-config');
      if (!configResult.success) {
        throw new Error('No Moodle configuration found');
      }

      const config = configResult.data;
      const uniqueFilename = `${studentId}_${selectedAssignment}_${file.filename}`;
      
      let downloadUrl = file.fileurl;
      if (downloadUrl && !downloadUrl.includes('token=')) {
        const separator = downloadUrl.includes('?') ? '&' : '?';
        downloadUrl = `${downloadUrl}${separator}token=${config.apiKey}`;
      }

      const downloadResult = await window.electron.ipcRenderer.invoke('fileio:download-file', {
        url: downloadUrl,
        filename: uniqueFilename,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MoodleApp)',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (downloadResult.success) {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const parseResult = await window.electron.ipcRenderer.invoke('docx:parse-file', {
          filePath: downloadResult.filePath
        });

        if (parseResult.success) {
          setDocxContent(parseResult.content);
        } else {
          setFileError(parseResult.error);
        }
      } else {
        setFileError(downloadResult.error);
      }
    } catch (error: any) {
      console.error('Error previewing file:', error);
      setFileError(error.message || 'Failed to preview file');
    } finally {
      setFileLoading(false);
    }
  };

  const clearFilePreview = () => {
    setDocxContent(null);
    setFileError(null);
  };

  return {
    docxContent,
    fileLoading,
    fileError,
    handleFilePreview,
    clearFilePreview
  };
};
