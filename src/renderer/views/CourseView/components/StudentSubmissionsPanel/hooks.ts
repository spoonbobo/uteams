import { useState, useEffect } from 'react';
import { useGradingStore } from '../../../../stores/useGradingStore';
import { createGradingPrompt } from '../../prompts/gradingPrompt';
import type { SubmissionFile, CollapsedCategories, SubmitGradeDialogData } from './types';
import type { StudentSubmissionData } from '../../../../types/grading';
import type { MoodleAssignment } from '../../../../types/moodle';
import type { DocxContent } from '../../../../components/DocxPreview/types';

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
    submitGradeDialogData,
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

export const useGradingActions = (selectedAssignment: string) => {
  const {
    getGradingRecord,
    clearGradingRecord,
    saveDetailedGradingRecord,
    getRubricForAssignment,
    gradingInProgress,
    startGrading,
    finishGrading,
    setGradingError,
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
      
      return new Promise<void>((resolve, reject) => {
        let resultReceived = false;
        let timeout: NodeJS.Timeout;
        
        const onToken = (_event: any, payload: { sessionId: string; token: string; node?: string }) => {
          if (payload?.sessionId !== sessionId) return;
        };

        const onDone = (_event: any, payload: { sessionId: string; resultSummary?: string }) => {
          if (payload?.sessionId !== sessionId) return;
          
          console.log('✅ Grading complete for session:', sessionId, 'ResultSummary:', !!payload.resultSummary);
          
          if (payload.resultSummary) {
            try {
              const jsonMatch = payload.resultSummary.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                console.log('📋 Parsed grading result for student:', studentId, parsed);
                
                saveDetailedGradingRecord(selectedAssignment, studentId, parsed);
                console.log('💾 Grading results saved for student:', studentId);
                resultReceived = true;
              }
            } catch (parseError) {
              console.error('❌ Failed to parse grading response:', parseError);
            }
          }
          
          finishGrading(studentId);
          
          if (timeout) clearTimeout(timeout);
          cleanup();
          resolve();
        };

        const onError = (_event: any, payload: { sessionId: string; error: string }) => {
          if (payload?.sessionId !== sessionId) return;
          console.error('❌ AI Error for session:', sessionId, payload.error);
          
          setGradingError(studentId);
          
          if (timeout) clearTimeout(timeout);
          cleanup();
          reject(new Error(payload.error));
        };

        const cleanup = () => {
          try { 
            ipc?.off?.('chat:agent:token', onToken);
          } catch {}
          try { 
            ipc?.off?.('chat:agent:done', onDone);
          } catch {}
          try { 
            ipc?.off?.('chat:agent:error', onError);
          } catch {}
        };

        ipc?.on?.('chat:agent:token', onToken);
        ipc?.on?.('chat:agent:done', onDone);
        ipc?.on?.('chat:agent:error', onError);

        timeout = setTimeout(() => {
          console.log('⏱️ Grading timeout for session:', sessionId);
          setGradingError(studentId);
          cleanup();
          reject(new Error('Grading timeout after 4 minutes'));
        }, 240000);

        ipc?.invoke?.('chat:agent:run', { 
          sessionId, 
          prompt: gradingPrompt 
        }).then((response: any) => {
          console.log('📬 IPC Response for session:', sessionId, { 
            success: response?.success, 
            hasResultSummary: !!response?.resultSummary 
          });
          
          if (response?.success && response?.resultSummary && !resultReceived) {
            try {
              const jsonMatch = response.resultSummary.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                console.log('📋 Immediate grading result for student:', studentId, parsed);
                saveDetailedGradingRecord(selectedAssignment, studentId, parsed);
                resultReceived = true;
                finishGrading(studentId);
                if (timeout) clearTimeout(timeout);
                cleanup();
                resolve();
              }
            } catch (parseError) {
              console.error('❌ Failed to parse immediate response:', parseError);
            }
          }
        }).catch((error: any) => {
          console.error('❌ IPC invoke error for session:', sessionId, error);
          setGradingError(studentId);
          if (timeout) clearTimeout(timeout);
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
    isStudentBeingGraded,
    clearAllGradingProgress,
    setActiveGradingStudent,
    handleStartGrading
  };
};
