import { useState, useEffect } from 'react';
import { useGradingStore } from '@/stores/useGradingStore';
import { createGradingPrompt } from '../../../prompts/gradingPrompt';
import type { SubmissionFile, CollapsedCategories, SubmitGradeDialogData } from './types';
import type { StudentSubmissionData } from '@/types/grading';
import type { MoodleAssignment } from '@/types/moodle';
import type { DocxContent } from '@/components/DocxPreview/types';

export const useSubmissionFiles = (selectedSubmission: string | null, selectedAssignment: string) => {
  const [submissionFiles, setSubmissionFiles] = useState<SubmissionFile[]>([]);
  const [docxContent, setDocxContent] = useState<DocxContent | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

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
        const configResult = await window.electron.ipcRenderer.invoke('moodle:get-config');
        if (!configResult.success) {
          throw new Error('No Moodle configuration found');
        }

        const config = configResult.data;

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

            const uniqueFilename = `${selectedSubmission}_${selectedAssignment}_${file.filename}`;

            let downloadUrl = file.fileurl;
            if (downloadUrl && !downloadUrl.includes('token=')) {
              const separator = downloadUrl.includes('?') ? '&' : '?';
              downloadUrl = `${downloadUrl}${separator}token=${config.apiKey}`;
            }

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
                  await new Promise(resolve => setTimeout(resolve, 100));

                  const parseResult = await window.electron.ipcRenderer.invoke('docx:parse-file', {
                    filePath: downloadResult.filePath
                  });

                  if (parseResult.success) {
                    setDocxContent(parseResult.content);
                    success = true;
                  } else {
                    lastError = parseResult.error;
                    console.error(`[StudentPanel] Failed to parse DOCX on attempt ${attempt}:`, parseResult.error);

                    if (parseResult.error.includes('Corrupted zip') || parseResult.error.includes('End of data reached')) {
                      continue;
                    } else {
                      break;
                    }
                  }
                } else {
                  lastError = downloadResult.error;
                  console.error(`[StudentPanel] Failed to download file on attempt ${attempt}:`, downloadResult.error);
                }
              } catch (error: any) {
                lastError = error.message;
                console.error(`[StudentPanel] Exception on attempt ${attempt}:`, error);
              }

              if (attempt < maxRetries && !success) {
                await new Promise(resolve => setTimeout(resolve, 500 * attempt));
              }
            }

            if (!success) {
              setFileError(`Failed to download and parse ${file.filename} after ${maxRetries} attempts: ${lastError}`);
            }

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

  return { submissionFiles, docxContent, fileLoading, fileError };
};

export const useStudentFiles = (selectedAssignment: string) => {
  const [studentFiles, setStudentFiles] = useState<Record<string, SubmissionFile[]>>({});

  const loadStudentFiles = async (studentId: string): Promise<SubmissionFile[]> => {
    if (!selectedAssignment || studentFiles[studentId]) {
      return studentFiles[studentId] || [];
    }

    try {
      const configResult = await window.electron.ipcRenderer.invoke('moodle:get-config');
      if (!configResult.success) {
        throw new Error('No Moodle configuration found');
      }

      const config = configResult.data;
      const filesResult = await window.electron.ipcRenderer.invoke('moodle:get-submission-files', {
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        assignmentId: selectedAssignment,
        userId: studentId,
      });

      if (filesResult.success) {
        setStudentFiles(prev => ({
          ...prev,
          [studentId]: filesResult.data
        }));
        return filesResult.data;
      }
    } catch (error) {
      console.error('Error loading student files:', error);
    }
    return [];
  };

  return { studentFiles, loadStudentFiles };
};

export const useDialogStates = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogStudentName, setDialogStudentName] = useState<string>('');
  const [dialogFilename, setDialogFilename] = useState<string>('');
  const [submitGradeDialogOpen, setSubmitGradeDialogOpen] = useState(false);
  const [submitGradeDialogData, setSubmitGradeDialogData] = useState<SubmitGradeDialogData>({
    assignment: '',
    submission: ''
  });

  const handleDialogClose = () => {
    setDialogOpen(false);
    setDialogStudentName('');
    setDialogFilename('');
  };


  const handleSubmitGradeDialogOpen = (studentData: StudentSubmissionData, selectedAssignment: string, selectedAssignmentData?: MoodleAssignment) => {
    setSubmitGradeDialogData({
      assignment: selectedAssignment,
      submission: studentData.student.id,
      assignmentData: selectedAssignmentData,
      submissionData: studentData,
    });
    setSubmitGradeDialogOpen(true);
  };

  const handleSubmitGradeDialogClose = () => {
    setSubmitGradeDialogOpen(false);
    setSubmitGradeDialogData({ assignment: '', submission: '' });
  };

  return {
    dialogOpen,
    setDialogOpen,
    dialogStudentName,
    setDialogStudentName,
    dialogFilename,
    setDialogFilename,
    submitGradeDialogOpen,
    setSubmitGradeDialogOpen,
    submitGradeDialogData,
    setSubmitGradeDialogData,
    handleDialogClose,
    handleSubmitGradeDialogOpen,
    handleSubmitGradeDialogClose
  };
};

export const useCollapsibleCategories = () => {
  const [collapsedCategories, setCollapsedCategories] = useState<CollapsedCategories>({
    readyToGrade: false,
    graded: false,
    notSubmitted: false,
  });

  const toggleCategoryCollapse = (category: keyof CollapsedCategories) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  return { collapsedCategories, toggleCategoryCollapse };
};

export const useStudentSelection = () => {
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  const selectAllInCategory = (studentIds: string[]) => {
    setSelectedStudents(prev => {
      const newSet = new Set(prev);
      studentIds.forEach(id => newSet.add(id));
      return newSet;
    });
  };

  const deselectAllInCategory = (studentIds: string[]) => {
    setSelectedStudents(prev => {
      const newSet = new Set(prev);
      studentIds.forEach(id => newSet.delete(id));
      return newSet;
    });
  };

  const clearSelection = () => {
    setSelectedStudents(new Set());
  };

  const isStudentSelected = (studentId: string) => {
    return selectedStudents.has(studentId);
  };

  const getSelectedCount = () => {
    return selectedStudents.size;
  };

  const getSelectedStudentIds = () => {
    return Array.from(selectedStudents);
  };

  return {
    selectedStudents,
    toggleStudentSelection,
    selectAllInCategory,
    deselectAllInCategory,
    clearSelection,
    isStudentSelected,
    getSelectedCount,
    getSelectedStudentIds,
  };
};

export const useGradingActions = (selectedAssignment: string) => {
  const {
    getGradingRecord,
    clearGradingRecord,
    saveDetailedGradingRecord,
    initGradingStream,
    appendToGradingStream,
    processGradingStream,
    getGradingStream,
    getDetailedAIGradeResult,
    getRubricForAssignment,
    gradingInProgress,
    startGrading,
    finishGrading,
    setGradingError,
    abortGrading,
    isStudentBeingGraded,
    clearAllGradingProgress,
    setActiveGradingStudent
  } = useGradingStore();

  const handleStartGrading = async (studentId: string, studentFiles: Record<string, SubmissionFile[]>, loadStudentFiles: (id: string) => Promise<SubmissionFile[]>) => {
    if (!selectedAssignment) return;

    startGrading(studentId);

    try {
      const files = studentFiles[studentId] || await loadStudentFiles(studentId);
      const docxFile = files.find((f: SubmissionFile) =>
        f.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        f.filename.toLowerCase().endsWith('.docx')
      );

      if (!docxFile) {
        console.error('No DOCX file found for student');
        setGradingError(studentId);
        throw new Error('No DOCX file found');
      }

      const rubricContent = getRubricForAssignment(selectedAssignment);
      if (!rubricContent) {
        console.error('No rubric found for assignment');
        setGradingError(studentId);
        throw new Error('No rubric found');
      }

      const configResult = await window.electron.ipcRenderer.invoke('moodle:get-config');
      if (!configResult.success) {
        throw new Error('No Moodle configuration found');
      }

      const config = configResult.data;
      const uniqueFilename = `${studentId}_${selectedAssignment}_${docxFile.filename}`;

      let downloadUrl = docxFile.fileurl;
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

      if (!downloadResult.success) {
        throw new Error(downloadResult.error || 'Failed to download file');
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const parseResult = await window.electron.ipcRenderer.invoke('docx:parse-file', {
        filePath: downloadResult.filePath
      });

      if (!parseResult.success) {
        throw new Error(parseResult.error || 'Failed to parse DOCX file');
      }

      const docxContent = parseResult.content;
      const rubricData = rubricContent.html || rubricContent.text;
      const submissionData = docxContent.html || docxContent.text;

      const gradingPrompt = createGradingPrompt({
        rubricData,
        submissionData
      });

      const ipc = (window as any).electron?.ipcRenderer;
      if (!ipc) {
        throw new Error('IPC renderer not available');
      }

      const sessionId = `grading-${selectedAssignment}-${studentId}`;

      console.log('🎯 Starting AI Grading for student:', studentId, 'Session:', sessionId);

      // Initialize grading stream BEFORE starting any async operations
      initGradingStream(sessionId);

      return new Promise<void>((resolve, reject) => {
        let resultReceived = false;

        // Track token reception for debugging
        let tokenCount = 0;
        let lastTokenTime = Date.now();

        // Debounce timer for processing stream
        let processDebounceTimer: NodeJS.Timeout | null = null;

        // Handlers receive payload only per preload bridge contract
        const onToken = (payload: { sessionId: string; token: string; node?: string }) => {
          if (payload?.sessionId !== sessionId) return;
          tokenCount++;
          const now = Date.now();
          const timeSinceLastToken = now - lastTokenTime;
          lastTokenTime = now;

          // Log every 50th token for debugging
          if (tokenCount % 50 === 0) {
            console.log(`[Tokens] Session ${sessionId}: Received ${tokenCount} tokens, last gap: ${timeSinceLastToken}ms`);
          }

          try {
            // Always append the token immediately
            appendToGradingStream(sessionId, payload.token);

            // Debounce the processing to avoid excessive updates
            if (processDebounceTimer) {
              clearTimeout(processDebounceTimer);
            }
            processDebounceTimer = setTimeout(() => {
              try {
                processGradingStream(sessionId, selectedAssignment, studentId);
              } catch (e) {
                console.error(`[Tokens] Error processing stream for session ${sessionId}:`, e);
              }
            }, 100); // Process every 100ms at most
          } catch (e) {
            console.error(`[Tokens] Error processing token for session ${sessionId}:`, e);
          }
        };

        // Track if onDone has been called
        let onDoneReceived = false;

        const onDone = (payload: { sessionId: string; resultSummary?: string }) => {
          if (payload?.sessionId !== sessionId) return;

          console.log('✅ Grading complete for session:', sessionId, {
            hasResultSummary: !!payload.resultSummary,
            resultSummaryType: typeof payload.resultSummary,
            resultSummaryLength: typeof payload.resultSummary === 'string' ? payload.resultSummary.length : 'N/A'
          });
          onDoneReceived = true;

          // Clear any pending debounce timer and process immediately
          if (processDebounceTimer) {
            clearTimeout(processDebounceTimer);
            processDebounceTimer = null;
          }

          // Ensure stream exists (in case onDone fires very early)
          try {
            initGradingStream(sessionId);
          } catch {}

          // Try to parse resultSummary if provided (could be from event or fallback)
          if (payload.resultSummary && typeof payload.resultSummary === 'string') {
            try {
              const jsonMatch = payload.resultSummary.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                console.log('📋 Parsed grading result from resultSummary for student:', studentId, parsed);

                // Append the JSON to stream buffer to be processed
                appendToGradingStream(sessionId, JSON.stringify(parsed));

                // Process the stream to extract the result
                processGradingStream(sessionId, selectedAssignment, studentId);

                // Also save directly as fallback
                saveDetailedGradingRecord(selectedAssignment, studentId, parsed);
                console.log('💾 Grading results saved from resultSummary for student:', studentId);
                resultReceived = true;
              } else {
                console.warn('⚠️ resultSummary exists but no JSON found:', payload.resultSummary);
                // Set error for format issue - AI returned text instead of JSON
                setGradingError(studentId, 'AI returned text feedback instead of structured grading data. The response format may need adjustment.', 'format');
                cleanup();
                reject(new Error('AI returned text instead of structured grading data'));
                return;
              }
            } catch (parseError) {
              console.error('❌ Failed to parse grading response from resultSummary:', parseError, 'Content:', payload.resultSummary);
              setGradingError(studentId, `Failed to parse AI response: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`, 'parsing');
              cleanup();
              reject(parseError);
              return;
            }
          } else if (payload.resultSummary) {
            console.warn('⚠️ resultSummary is not a string:', typeof payload.resultSummary, payload.resultSummary);
            setGradingError(studentId, `Invalid response format: Expected string but got ${typeof payload.resultSummary}`, 'format');
            cleanup();
            reject(new Error('Invalid response format'));
            return;
          }

          // Process any final buffered stream content before finishing
          try {
            processGradingStream(sessionId, selectedAssignment, studentId);
          } catch {}

          // Check if we have a result now
          const currentResult = getDetailedAIGradeResult(selectedAssignment, studentId);
          if (currentResult) {
            console.log('✅ Result available, finishing grading for student:', studentId);
            resultReceived = true;
            finishGrading(studentId);
            cleanup();
            resolve();
          } else {
            // Log stream state when no result found
            console.log('⏳ No result yet in onDone, checking stream state...');
            const stream = getGradingStream ? getGradingStream(sessionId) : null;
            console.log(`[onDone] Stream state for ${sessionId}:`, {
              hasStream: !!stream,
              bufferLength: stream?.streamBuffer?.length || 0,
              hasTempResult: !!stream?.tempResult,
              tokenCount: tokenCount,
              bufferPreview: stream?.streamBuffer ?
                (stream.streamBuffer.length > 200 ?
                  stream.streamBuffer.substring(0, 100) + '...' + stream.streamBuffer.substring(stream.streamBuffer.length - 100) :
                  stream.streamBuffer) : 'No buffer'
            });
            console.log('⏳ Waiting for IPC response or timeout...');
          }
        };

        const onError = (payload: { sessionId: string; error: string }) => {
          if (payload?.sessionId !== sessionId) return;
          console.error('❌ AI Error for session:', sessionId, payload.error);

          setGradingError(studentId);

          cleanup();
          reject(new Error(payload.error));
        };

        const onAborted = (payload: { sessionId: string; reason: string }) => {
          if (payload?.sessionId !== sessionId) return;
          console.log(`[Grading] Session aborted: ${payload.reason}`);
          cleanup();
          setGradingError(studentId);
          reject(new Error(payload.reason || 'Grading aborted'));
        };

        // Subscribe and retain unsubscribe closures for proper cleanup
        const offToken = ipc?.on?.('chat:agent:token' as any, onToken as any);
        const offDone = ipc?.on?.('chat:agent:done' as any, onDone as any);
        const offError = ipc?.on?.('chat:agent:error' as any, onError as any);
        const offAborted = ipc?.on?.('chat:agent:aborted' as any, onAborted as any);

        const cleanup = () => {
          // Clear debounce timer if it exists
          if (processDebounceTimer) {
            clearTimeout(processDebounceTimer);
            processDebounceTimer = null;
          }
          try { offToken?.(); } catch {}
          try { offDone?.(); } catch {}
          try { offError?.(); } catch {}
          try { offAborted?.(); } catch {}
        };


        ipc?.invoke?.('chat:agent:run', {
          sessionId,
          prompt: gradingPrompt
        }).then((response: any) => {
          console.log('📬 IPC Response for session:', sessionId, {
            success: response?.success,
            hasResultSummary: !!response?.resultSummary,
            onDoneReceived,
            resultReceived
          });

          if (response?.success && response?.resultSummary && !resultReceived) {
            // Check if resultSummary is actually a string with JSON content
            if (typeof response.resultSummary === 'string') {
              try {
                const jsonMatch = response.resultSummary.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  const parsed = JSON.parse(jsonMatch[0]);
                  console.log('📋 Immediate grading result for student:', studentId, parsed);
                  saveDetailedGradingRecord(selectedAssignment, studentId, parsed);
                  resultReceived = true;

                  // If onDone was already called and we didn't have results then, finish now
                  if (onDoneReceived) {
                    console.log('📋 onDone was already called, finishing now with IPC results');
                    // Process stream once more (in case there were tokens) then finish
                    try { processGradingStream(sessionId, selectedAssignment, studentId); } catch {}
                    finishGrading(studentId);
                    cleanup();
                    resolve();
                  }
                  // Otherwise, onDone will handle finishing when it arrives
                } else {
                  console.warn('⚠️ IPC resultSummary exists but no JSON found:', response.resultSummary);
                  setGradingError(studentId, 'AI returned text feedback instead of structured grading data. The response format may need adjustment.', 'format');
                  // If onDone was called, we need to finish anyway
                  if (onDoneReceived) {
                    console.warn('⚠️ Finishing with error as onDone was called');
                    cleanup();
                    resolve();
                  }
                }
              } catch (parseError) {
                console.error('❌ Failed to parse immediate response:', parseError, 'Content:', response.resultSummary);
                setGradingError(studentId, `Failed to parse AI response: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`, 'parsing');
                // If onDone was called, we need to finish anyway
                if (onDoneReceived) {
                  console.warn('⚠️ Finishing with error due to parse error');
                  cleanup();
                  resolve();
                }
              }
            } else {
              console.warn('⚠️ IPC resultSummary is not a string:', typeof response.resultSummary, response.resultSummary);
              // If onDone was called, we need to finish anyway
              if (onDoneReceived) {
                console.warn('⚠️ Finishing without results as resultSummary is not parseable');
                finishGrading(studentId);
                cleanup();
                resolve();
              }
            }
          } else if (onDoneReceived && !resultReceived) {
            // onDone was called but we still don't have results
            console.warn('⚠️ IPC response received after onDone but no results available');
            finishGrading(studentId);
            cleanup();
            resolve();
          }
        }).catch((error: any) => {
          console.error('❌ IPC invoke error for session:', sessionId, error);
          setGradingError(studentId);
          cleanup();
          reject(error);
        });
      });

    } catch (error: any) {
      console.error('❌ Error during AI grading:', error);
      setGradingError(studentId);
      throw error;
    }
  };

  return {
    getGradingRecord,
    clearGradingRecord,
    saveDetailedGradingRecord,
    getRubricForAssignment,
    gradingInProgress,
    startGrading,
    finishGrading,
    setGradingError,
    abortGrading,
    isStudentBeingGraded,
    clearAllGradingProgress,
    setActiveGradingStudent,
    handleStartGrading
  };
};
