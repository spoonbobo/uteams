import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Card,
  CardContent,
} from '@mui/material';
import type { MoodleAssignment } from '@/types/moodle';
import type { StudentSubmissionData } from '@/types/grading';
import DocxPreview from '@/components/DocxPreview/DocxPreview';
import type { DocxContent, ElementHighlight } from '@/components/DocxPreview/types';

interface SubmissionFile {
  filename: string;
  filesize: number;
  fileurl: string;
  mimetype: string;
  timemodified: number;
}

interface SubmissionPreviewProps {
  selectedAssignment: string;
  selectedSubmission: string | null;
  selectedAssignmentData?: MoodleAssignment;
  selectedSubmissionData?: StudentSubmissionData;
  highlights: ElementHighlight[];
}

export const SubmissionPreview: React.FC<SubmissionPreviewProps> = ({
  selectedAssignment,
  selectedSubmission,
  selectedAssignmentData,
  selectedSubmissionData,
  highlights,
}) => {
  const [submissionFiles, setSubmissionFiles] = useState<SubmissionFile[]>([]);
  const [docxContent, setDocxContent] = useState<DocxContent | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Load submission files when a student is selected (similar to StudentSubmissionsPanel)
  useEffect(() => {
    const loadSubmissionFiles = async () => {
      if (!selectedSubmission || !selectedAssignment) {
        setSubmissionFiles([]);
        setDocxContent(null);
        setFileError(null);
        return;
      }

      setFileLoading(true);
      setFileError(null);
      setDocxContent(null);

      try {
        // Get Moodle config
        const configResult = await window.electron.ipcRenderer.invoke('moodle:get-config');
        if (!configResult.success) {
          throw new Error('No Moodle configuration found');
        }

        const config = configResult.data;

        // Get submission files from Moodle
        const filesResult = await window.electron.ipcRenderer.invoke('moodle:get-submission-files', {
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          assignmentId: selectedAssignment,
          userId: selectedSubmission,
        });

        if (!filesResult.success) {
          throw new Error(filesResult.error || 'Failed to get submission files');
        }

        setSubmissionFiles(filesResult.data);

        // Download and parse DOCX files
        for (const file of filesResult.data) {
          if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
              file.filename.toLowerCase().endsWith('.docx')) {

            // Create unique filename to avoid conflicts
            const uniqueFilename = `${selectedSubmission}_${selectedAssignment}_${file.filename}`;

            // Download the file - Moodle files usually need token in URL, not headers
            let downloadUrl = file.fileurl;
            if (downloadUrl && !downloadUrl.includes('token=')) {
              // Add token to URL if not already present
              const separator = downloadUrl.includes('?') ? '&' : '?';
              downloadUrl = `${downloadUrl}${separator}token=${config.apiKey}`;
            }


            // Retry logic for file download and parsing
            let success = false;
            let lastError = '';
            const maxRetries = 3;

            for (let attempt = 1; attempt <= maxRetries && !success; attempt++) {

              try {
                const downloadResult = await window.electron.ipcRenderer.invoke('fileio:download-file', {
                  url: downloadUrl,
                  filename: `${uniqueFilename}_attempt${attempt}`,
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; MoodleApp)',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                  }
                });

                if (downloadResult.success) {

                  // Add a small delay before parsing to ensure file is fully written
                  await new Promise(resolve => setTimeout(resolve, 100));

                  // Parse the DOCX file
                  const parseResult = await window.electron.ipcRenderer.invoke('docx:parse-file', {
                    filePath: downloadResult.filePath
                  });


                  if (parseResult.success) {
                    setDocxContent(parseResult.content);
                    success = true;
                  } else {
                    lastError = parseResult.error;
                    console.error(`[SubmissionPreview] Failed to parse DOCX on attempt ${attempt}:`, parseResult.error);

                    // If it's a corruption error, try downloading again
                    if (parseResult.error.includes('Corrupted zip') || parseResult.error.includes('End of data reached')) {
                      continue;
                    } else {
                      // Non-corruption error, don't retry
                      break;
                    }
                  }
                } else {
                  lastError = downloadResult.error;
                  console.error(`[SubmissionPreview] Failed to download file on attempt ${attempt}:`, downloadResult.error);
                }
              } catch (error: any) {
                lastError = error.message;
                console.error(`[SubmissionPreview] Exception on attempt ${attempt}:`, error);
              }

              // Wait before retry (except on last attempt)
              if (attempt < maxRetries && !success) {
                await new Promise(resolve => setTimeout(resolve, 500 * attempt)); // Exponential backoff
              }
            }

            if (!success) {
              setFileError(`Failed to download and parse ${file.filename} after ${maxRetries} attempts: ${lastError}`);
            }

            // Only process the first DOCX file for now
            break;
          }
        }
      } catch (error: any) {
        console.error('Error loading submission files:', error);
        setFileError(error.message || 'Failed to load submission files');
      } finally {
        setFileLoading(false);
      }
    };

    loadSubmissionFiles();
  }, [selectedSubmission, selectedAssignment]);

  return (
    <Box sx={{ flex: 1 }}>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
        Grading {selectedSubmissionData?.student.fullname} for {selectedAssignmentData?.name}
      </Typography>

      <Card sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider'
      }}>
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* File Loading State */}
          {fileLoading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Loading submission files...
              </Typography>
            </Box>
          )}

          {/* File Error */}
          {fileError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {fileError}
            </Alert>
          )}

          {/* DOCX Content Display */}
          {docxContent && (
            <Box sx={{ flex: 1, mb: 2 }}>
              <DocxPreview
                content={{
                  text: docxContent.text,
                  html: docxContent.html, // No longer pre-apply highlights - handled by DOM manipulation
                  wordCount: docxContent.wordCount,
                  characterCount: docxContent.characterCount,
                  filename: submissionFiles.find(f =>
                    f.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                    f.filename.toLowerCase().endsWith('.docx')
                  )?.filename || 'Student Submission',
                  elementCounts: (docxContent as any).elementCounts
                }}
                highlights={highlights} // Pass highlights to be applied via DOM
                variant="full"
                showStats={true}
                showHoverPreview={false}
                showDebugInfo={false}
                showTestButton={false}
                showToggleButton={false}
                tooltipMode="comment-only"
                maxPreviewLength={400}
                sx={{ height: '100%' }}
              />
            </Box>
          )}

          {/* No Files Message */}
          {!fileLoading && submissionFiles.length === 0 && !fileError && (
            <Alert severity="info">
              No files found for this submission.
            </Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};
