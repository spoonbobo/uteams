import React, { useState, useEffect } from 'react';
import { Typography, Box, Button, Paper, Alert } from '@mui/material';
import { useIntl } from 'react-intl';
import { HTabPanel } from '@/components/HTabsPanel';
import type { CourseSessionContext } from '@/stores/useContextStore';
import { useCourseworkGeneratorStore } from '@/stores/useCourseworkGeneratorStore';
import { useMoodleStore } from '@/stores/useMoodleStore';
import { useChatStore } from '@/stores/useChatStore';
import { PlanWidget } from '@/components/PlanWidget';
import { generateQuestionVariantsFromCurrent } from '../../prompts/courseworkGeneratePrompt';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import StopIcon from '@mui/icons-material/Stop';

interface GenerateProps {
  sessionContext: CourseSessionContext;
  selectedCoursework: string[];
  examType: string;
  examInstructions: string;
  onGenerateExam: () => void;
  isGenerating: boolean;
}

// Helper function to extract text content from parsed PDF data
const extractTextFromParsedPdf = (parsedPdfData: any): string => {
  try {
    if (!parsedPdfData) return 'No content available';

    console.log('[PDF Extract] Processing parsed PDF data:', {
      hasElements: !!parsedPdfData.elements,
      hasPages: !!parsedPdfData.pages,
      elementsCount: parsedPdfData.elements?.length || 0,
      pagesCount: Object.keys(parsedPdfData.pages || {}).length
    });

    // Extract page-level text from AI-optimized PDF structure
    if (parsedPdfData.pages && typeof parsedPdfData.pages === 'object') {
      console.log('[PDF Extract] Extracting from pages object');
      const pageTexts = Object.values(parsedPdfData.pages)
        .map((page: any) => {
          // Try different possible text fields
          return page.fullText || page.text || page.content || '';
        })
        .filter(Boolean);

      if (pageTexts.length > 0) {
        const combinedText = pageTexts.join('\n\n');
        console.log('[PDF Extract] Successfully extracted from pages:', combinedText.substring(0, 200) + '...');
        return combinedText;
      }
    }

    // Fallback: try other common structures
    if (typeof parsedPdfData === 'string') {
      return parsedPdfData;
    }

    if (parsedPdfData.text) {
      return parsedPdfData.text;
    }

    if (parsedPdfData.content) {
      return typeof parsedPdfData.content === 'string' ? parsedPdfData.content : JSON.stringify(parsedPdfData.content, null, 2);
    }

    // Legacy pages array format
    if (parsedPdfData.pages && Array.isArray(parsedPdfData.pages)) {
      return parsedPdfData.pages
        .map((page: any, index: number) => {
          const pageText = page.fullText || page.text || page.content || '';
          return pageText ? `Page ${index + 1}:\n${pageText}` : '';
        })
        .filter(Boolean)
        .join('\n\n');
    }

    // Log the structure for debugging
    console.warn('[PDF Extract] Unknown PDF structure, available keys:', Object.keys(parsedPdfData));
    console.warn('[PDF Extract] Sample data:', JSON.stringify(parsedPdfData, null, 2).substring(0, 500));

    // If we can't find text, return a helpful debug message
    return `PDF structure found but no readable text extracted. Available keys: ${Object.keys(parsedPdfData).join(', ')}`;

  } catch (error) {
    console.error('Error extracting text from parsed PDF:', error);
    return 'Error extracting PDF content';
  }
};

function Generate({
  sessionContext,
  selectedCoursework,
  examType,
  examInstructions,
  onGenerateExam,
  isGenerating,
}: GenerateProps) {
  const intl = useIntl();
  const { getCourseContent } = useMoodleStore();
  const [generationInProgress, setGenerationInProgress] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<string>('');
  const [streamBuffer, setStreamBuffer] = useState<string>('');
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null);

  const sessionId = `coursework-generation-${sessionContext.sessionId}`;
  const courseContent = getCourseContent(sessionContext.sessionId);

  // Get parsed PDF content and generation record methods from store
  const {
    getAllParsedContent,
    saveGenerationRecord,
    updateGenerationRecord,
    getLatestGenerationRecord,
    clearGenerationRecords
  } = useCourseworkGeneratorStore();

  // Get chat store functions for agent communication
  const {
    clearPlan,
    clearTodos,
    setPlan,
    setTodos,
    updateTodoByIndex,
    todosBySession,
    planBySession
  } = useChatStore();

  // Get plan and todos for the current session
  const todos = todosBySession[sessionId] || [];
  const plan = planBySession?.[sessionId];

  // Check for existing generation record
  const existingRecord = getLatestGenerationRecord(sessionContext.sessionId);

  // Handle clearing generation results
  const handleClearResults = async () => {
    try {
      // First abort any active session
      await window.electron.ipcRenderer.invoke('chat:agent:abort', {
        sessionId,
        reason: 'Clearing generation records'
      });
      console.log('🛑 Aborted session during clear:', sessionId);
    } catch (abortError) {
      console.log('🔄 No active session to abort during clear:', abortError);
    }

    // Clear session data
    clearPlan(sessionId);
    clearTodos(sessionId);

    // Clear local state
    setGenerationInProgress(false);
    setGenerationError(null);
    setRawResponse('');
    setStreamBuffer('');
    setCurrentGenerationId(null);

    // Clear stored records
    clearGenerationRecords(sessionContext.sessionId);
  };

  // Handle coursework generation
  const handleGenerateCoursework = async () => {
    if (selectedCoursework.length === 0) {
      setGenerationError(intl.formatMessage({ id: 'courseworkGenerator.generate.noAssignmentsSelected' }, { defaultMessage: 'No assignments selected' }));
      return;
    }

    setGenerationInProgress(true);
    setGenerationError(null);
    setRawResponse('');
    setStreamBuffer('');

    try {
      console.log('🚀 Starting generation with session ID:', sessionId);

      // First, ensure any existing session is properly cleaned up
      try {
        await window.electron.ipcRenderer.invoke('chat:agent:abort', {
          sessionId,
          reason: 'Starting new generation - cleanup'
        });
        console.log('🛑 Cleaned up existing session:', sessionId);
        // Wait for cleanup to complete
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (cleanupError) {
        console.log('🔄 No existing session to cleanup:', cleanupError);
      }

      // Clear any existing plan data
      clearPlan(sessionId);
      clearTodos(sessionId);

      // Save generation record when starting
      const recordId = saveGenerationRecord({
        sessionId,
        courseId: sessionContext.sessionId,
        selectedAssignments: selectedCoursework,
        examType,
        examInstructions,
        rawResponse: '',
        status: 'completed' // Will be updated based on result
      });
      setCurrentGenerationId(recordId);

      // Get selected assignments data
      const selectedAssignments = selectedCoursework
        .map(id => courseContent?.assignments?.find(a => a.id.toString() === id))
        .filter(Boolean);

      // Get all parsed PDF content from the store
      const parsedContent = getAllParsedContent(sessionContext.sessionId);
      console.log('📄 Found parsed PDF content:', parsedContent.length, 'files');

      // Collect page contents: use parsed PDF content if available, otherwise fall back to assignment descriptions
      const pageContents: string[] = [];

      selectedAssignments.forEach(assignment => {
        if (!assignment) return;

        // Look for parsed PDF content for this assignment
        const assignmentParsedContent = parsedContent.filter(pc => pc.assignmentId === assignment.id.toString());

        if (assignmentParsedContent.length > 0) {
          // Use parsed PDF content
          assignmentParsedContent.forEach(pc => {
            console.log('📄 Using parsed PDF content for assignment', assignment.id, 'file:', pc.filename);
            // Convert parsed PDF data to text content
            const textContent = extractTextFromParsedPdf(pc.content);

            // Format the content better for AI processing
            const formattedContent = `
=== ASSIGNMENT: ${assignment.name} ===
SOURCE FILE: ${pc.filename}
ASSIGNMENT DESCRIPTION: ${assignment.intro || 'No description provided'}

DOCUMENT CONTENT:
${textContent}

=== END OF ASSIGNMENT ===
            `.trim();

            pageContents.push(formattedContent);
          });
        } else {
          // Fall back to assignment description
          console.log('📝 Using assignment description for assignment', assignment.id, '(no parsed PDF)');
          const formattedContent = `
=== ASSIGNMENT: ${assignment.name} ===
SOURCE: Assignment Description Only (No PDF content parsed)

ASSIGNMENT DESCRIPTION:
${assignment.intro || 'No content available'}

=== END OF ASSIGNMENT ===
          `.trim();

          pageContents.push(formattedContent);
        }
      });

      // Debug: Log the page contents being sent
      console.log('📋 Page contents being sent to AI:', {
        count: pageContents.length,
        totalLength: pageContents.join('\n\n').length,
        preview: pageContents.map(content => content.substring(0, 150) + '...').join('\n---\n')
      });

      // Generate the prompt
      const prompt = generateQuestionVariantsFromCurrent({
        pageContents,
        specialInstructions: examInstructions
      });

      console.log('🤖 Sending coursework generation prompt to agent...', {
        sessionId,
        promptLength: prompt.length,
        pageContentsCount: pageContents.length,
        prompt: prompt.substring(0, 200) + '...'
      });

      // Send to agent using the correct IPC method
      await window.electron.ipcRenderer.invoke('chat:agent:run', {
        sessionId,
        prompt,
        courseId: sessionContext.sessionId
      });

      console.log('✅ Coursework generation started successfully');

    } catch (error: any) {
      console.error('❌ Error starting coursework generation:', error);
      setGenerationError(error.message || intl.formatMessage({ id: 'courseworkGenerator.generate.error' }, { defaultMessage: 'Failed to start coursework generation' }));
      setGenerationInProgress(false);
      // Reset the parent isGenerating state on error
      if (onGenerateExam) {
        setTimeout(() => onGenerateExam(), 100);
      }
    }
  };

  // Handle abort generation
  const handleAbortGeneration = async () => {
    try {
      await window.electron.ipcRenderer.invoke('chat:agent:abort', {
        sessionId,
        reason: 'User stopped generation'
      });

      clearPlan(sessionId);
      clearTodos(sessionId);
      setGenerationInProgress(false);
      setRawResponse('');
      setStreamBuffer('');

      // Update the generation record with aborted status
      if (currentGenerationId) {
        updateGenerationRecord(sessionContext.sessionId, currentGenerationId, {
          status: 'aborted'
        });
      }

      // Reset the parent isGenerating state on abort
      if (onGenerateExam) {
        setTimeout(() => onGenerateExam(), 100);
      }
    } catch (error) {
      console.error('Failed to abort generation:', error);
      // Clear plan and todos even if abort fails
      clearPlan(sessionId);
      clearTodos(sessionId);

      // Update record even if abort fails
      if (currentGenerationId) {
        updateGenerationRecord(sessionContext.sessionId, currentGenerationId, {
          status: 'aborted',
          error: 'Failed to abort properly'
        });
      }

      // Reset the parent isGenerating state even if abort fails
      if (onGenerateExam) {
        setTimeout(() => onGenerateExam(), 100);
      }
    }
  };

  // Listen for streaming responses
  useEffect(() => {
    const ipc = window.electron?.ipcRenderer;
    if (!ipc) return;

    const handleStreamToken = (event: any, data: any) => {
      // Handle case where data might be undefined or have different structure
      const eventData = data || event;
      console.log('[CourseworkGenerator] Token event received:', { eventSessionId: eventData?.sessionId, currentSessionId: sessionId, hasToken: !!eventData?.token });
      if (eventData?.sessionId === sessionId) {
        setStreamBuffer(prev => {
          const newBuffer = prev + (eventData.token || '');

          // Try to extract final JSON response
          const jsonMatch = newBuffer.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            setRawResponse(jsonMatch[0]);
          }

          return newBuffer;
        });
      }
    };

    const handleStreamEnd = (event: any, data: any) => {
      // Handle case where data might be undefined or have different structure
      const eventData = data || event;
      if (eventData?.sessionId === sessionId) {
        setGenerationInProgress(false);
        console.log('✅ Coursework generation completed');

        // Extract the result if available
        if (eventData.resultSummary) {
          setRawResponse(eventData.resultSummary);

          // Update the generation record with the result
          if (currentGenerationId) {
            updateGenerationRecord(sessionContext.sessionId, currentGenerationId, {
              rawResponse: eventData.resultSummary,
              status: 'completed'
            });
          }
        }

        // Clear plan and todos when generation is complete (like in GradingResults)
        clearPlan(sessionId);
        clearTodos(sessionId);

        // Reset the parent isGenerating state
        if (onGenerateExam) {
          // Call the parent's completion handler
          setTimeout(() => onGenerateExam(), 100);
        }
      }
    };

    const handleStreamError = (event: any, data: any) => {
      // Handle case where data might be undefined or have different structure
      const eventData = data || event;
      if (eventData?.sessionId === sessionId) {
        const errorMessage = eventData.error || 'Generation failed';
        setGenerationError(errorMessage);
        setGenerationInProgress(false);

        // Update the generation record with error status
        if (currentGenerationId) {
          updateGenerationRecord(sessionContext.sessionId, currentGenerationId, {
            status: 'failed',
            error: errorMessage
          });
        }

        // Clear plan and todos on error (like in GradingResults)
        clearPlan(sessionId);
        clearTodos(sessionId);

        // Reset the parent isGenerating state on error
        if (onGenerateExam) {
          setTimeout(() => onGenerateExam(), 100);
        }
      }
    };

    // Handle plan updates
    const handlePlan = (event: any, data: any) => {
      const eventData = data || event;
      console.log('[CourseworkGenerator] Plan event received:', { eventSessionId: eventData?.sessionId, currentSessionId: sessionId });
      if (eventData?.sessionId === sessionId) {
        console.log('[CourseworkGenerator] Plan received for session:', sessionId, eventData.plan);
        setPlan(sessionId, eventData.plan);
      }
    };

    // Handle todos updates
    const handleTodos = (event: any, data: any) => {
      const eventData = data || event;
      console.log('[CourseworkGenerator] Todos event received:', { eventSessionId: eventData?.sessionId, currentSessionId: sessionId });
      if (eventData?.sessionId === sessionId) {
        console.log('[CourseworkGenerator] Todos received for session:', sessionId, eventData.todos);
        setTodos(sessionId, eventData.todos);
      }
    };

    // Handle todo completion updates
    const handleTodoUpdate = (event: any, data: any) => {
      const eventData = data || event;
      if (eventData?.sessionId === sessionId) {
        console.log('[CourseworkGenerator] Todo update for session:', sessionId, eventData.todoIndex);
        updateTodoByIndex(sessionId, eventData.todoIndex, eventData.completed);
      }
    };

    // Register event listeners with proper error handling
    try {
      const offToken = ipc.on('chat:agent:token' as any, handleStreamToken as any);
      const offDone = ipc.on('chat:agent:done' as any, handleStreamEnd as any);
      const offError = ipc.on('chat:agent:error' as any, handleStreamError as any);
      const offPlan = ipc.on('chat:agent:plan' as any, handlePlan as any);
      const offTodos = ipc.on('chat:agent:todos' as any, handleTodos as any);
      const offTodoUpdate = ipc.on('chat:agent:todo-update' as any, handleTodoUpdate as any);

      return () => {
        try {
          if (typeof offToken === 'function') offToken();
          if (typeof offDone === 'function') offDone();
          if (typeof offError === 'function') offError();
          if (typeof offPlan === 'function') offPlan();
          if (typeof offTodos === 'function') offTodos();
          if (typeof offTodoUpdate === 'function') offTodoUpdate();
        } catch (error) {
          console.warn('Error cleaning up IPC listeners:', error);
        }
      };
    } catch (error) {
      console.error('Error setting up IPC listeners:', error);
      return () => {};
    }
  }, [sessionId, onGenerateExam, setPlan, setTodos, updateTodoByIndex, clearPlan, clearTodos]);

  // Load existing generation results when component mounts
  useEffect(() => {
    if (existingRecord && existingRecord.rawResponse) {
      setRawResponse(existingRecord.rawResponse);
      setCurrentGenerationId(existingRecord.id);
    }
  }, [existingRecord]);

  // Trigger generation when the component receives the onGenerateExam call
  useEffect(() => {
    if (isGenerating && !generationInProgress) {
      console.log('[CourseworkGenerator] Triggering generation:', {
        isGenerating,
        generationInProgress,
        existingRecord: !!existingRecord,
        sessionId
      });
      handleGenerateCoursework();
    }
  }, [isGenerating]);

  return (
    <HTabPanel
      title={intl.formatMessage({ id: 'courseworkGenerator.generate.title' })}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        {/* Generation Status */}
        {generationInProgress && (
          <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
            <Typography variant="body1" sx={{ flex: 1 }}>
              {intl.formatMessage({ id: 'courseworkGenerator.generate.generatingProgress' }, { defaultMessage: 'Generating question variants...' })}
            </Typography>
            <Button
              variant="outlined"
              color="error"
              onClick={handleAbortGeneration}
              startIcon={<StopIcon />}
            >
              {intl.formatMessage({ id: 'plan.abort' }, { defaultMessage: 'Stop Generation' })}
            </Button>
          </Box>
        )}

        {/* Error Display */}
        {generationError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {generationError}
          </Alert>
        )}

        {/* Plan Widget or Existing Results */}
        <Box sx={{ flex: 1, minHeight: 400 }}>
          {existingRecord && !generationInProgress ? (
            /* Show existing generation result */
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 500, mb: 2 }}>
                  Previous Generation Result
                </Typography>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={handleClearResults}
                  sx={{ mb: 2 }}
                >
                  Clear Generation Record
                </Button>
              </Box>

              <Paper variant="outlined" sx={{ flex: 1, p: 2, overflow: 'auto' }}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Generated: {new Date(existingRecord.generatedAt).toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Status: {existingRecord.status}
                  </Typography>
                  {existingRecord.examType && (
                    <Typography variant="body2" color="text.secondary">
                      Type: {existingRecord.examType}
                    </Typography>
                  )}
                </Box>

                {existingRecord.error ? (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {existingRecord.error}
                  </Alert>
                ) : (
                  <Typography variant="body2" component="pre" sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {existingRecord.rawResponse || 'No response available'}
                  </Typography>
                )}
              </Paper>
            </Box>
          ) : !plan && !generationInProgress ? (
            /* Show default message when no plan and not generating */
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 200,
              color: 'text.secondary'
            }}>
              <Typography variant="h6">
                {intl.formatMessage({ id: 'courseworkGenerator.generate.noplan' }, { defaultMessage: 'Generate to get new coursework' })}
              </Typography>
            </Box>
          ) : (
            /* Show PlanWidget during generation */
            <PlanWidget sessionId={sessionId} />
          )}
        </Box>

      </Box>
    </HTabPanel>
  );
}

export default Generate;
