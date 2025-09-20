import React, { useState, useEffect } from 'react';
import { Typography, Box, Button, Paper, Alert, CircularProgress, Tooltip } from '@mui/material';
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
import HighlightIcon from '@mui/icons-material/Highlight';
import InfoIcon from '@mui/icons-material/Info';
import DownloadIcon from '@mui/icons-material/Download';

interface GenerateProps {
  sessionContext: CourseSessionContext;
  selectedCoursework: string[];
  onGenerationComplete: () => void;
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
  onGenerationComplete,
  isGenerating,
}: GenerateProps) {
  const intl = useIntl();
  const { getCourseContent } = useMoodleStore();
  const [generationError, setLocalGenerationError] = useState<string | null>(null);
  const [resultSummary, setResultSummary] = useState<string>('');
  const [streamBuffer, setStreamBuffer] = useState<string>('');

  // Highlight-related state
  const [highlightLoading, setHighlightLoading] = useState(false);
  const [currentPdfData, setCurrentPdfData] = useState<any>(null);

  // Download-related state
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [highlightedPdfPath, setHighlightedPdfPath] = useState<string | null>(null);

  const sessionId = `coursework-generation-${sessionContext.sessionId}`;
  const courseContent = getCourseContent(sessionContext.sessionId);

  // Get parsed PDF content and generation record methods from store
  const {
    getAllParsedContent,
    saveGenerationRecord,
    updateGenerationRecord,
    getGenerationRecord,
    clearGenerationRecord,
    selectedPdfPath,
    setSelectedPdf,
    // Generation progress methods
    startGeneration,
    finishGeneration,
    setGenerationError: setStoreGenerationError,
    abortGeneration,
    isGenerationInProgress,
    activeGenerationCourse
  } = useCourseworkGeneratorStore();

  // Get generation progress from store instead of local state
  const generationInProgress = isGenerationInProgress(sessionContext.sessionId);
  const isActiveGeneration = activeGenerationCourse === sessionContext.sessionId;

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
  const existingRecord = getGenerationRecord(sessionContext.sessionId);

  // Function to parse PDF data for highlighting
  const parsePdfForHighlighting = async (filePath: string) => {
    try {
      const parseResult = await window.electron.ipcRenderer.invoke('pdf:parse-to-json', {
        filePath,
        includeText: true,
        includeMetadata: true,
        includeStructure: false
      });

      if (parseResult.success) {
        setCurrentPdfData(parseResult.data);
        console.log('✅ PDF parsed for highlighting:', parseResult.data);
      } else {
        console.warn('Could not parse PDF for highlighting:', parseResult.error);
      }
    } catch (parseError) {
      console.warn('Could not parse PDF for highlighting:', parseError);
    }
  };

  // Handle real-time highlighting of current PDF
  const handleHighlightCurrentPdf = async () => {
    if (!selectedPdfPath) {
      alert('No PDF currently loaded for highlighting');
      return;
    }

    setHighlightLoading(true);

    try {
      // Always ensure we have fresh PDF data
      let pdfData = currentPdfData;

      if (!pdfData) {
        console.log('🔍 PDF data not available, attempting to parse...');

        try {
          const parseResult = await window.electron.ipcRenderer.invoke('pdf:parse-to-json', {
            filePath: selectedPdfPath,
            includeText: true,
            includeMetadata: true,
            includeStructure: false
          });

          if (parseResult.success) {
            pdfData = parseResult.data;
            setCurrentPdfData(pdfData);
            console.log('✅ PDF parsed for highlighting:', pdfData);
          } else {
            throw new Error(parseResult.error || 'Failed to parse PDF');
          }
        } catch (parseError: any) {
          console.error('❌ Could not parse PDF for highlighting:', parseError);
          alert(`Could not parse PDF data for highlighting: ${parseError.message || 'Unknown error'}`);
          return;
        }
      }

      if (!pdfData) {
        alert('Could not parse PDF data for highlighting. The file may no longer exist or be corrupted.');
        return;
      }

      console.log('🎯 Applying intelligent highlights to current PDF...');

      // Generate AI-style patches for key content
      const aiPatches: any[] = [];

      // Find mathematical and important content to highlight
      pdfData.elements?.forEach((element: any, index: number) => {
        const shouldHighlight =
          element.content.type === 'math_symbol' ||
          element.content.type === 'formula' ||
          element.content.type === 'greek_letter' ||
          element.content.type === 'theorem' ||
          element.content.type === 'solution' ||
          (element.content.type === 'number' && element.content.text.includes('.')) ||
          element.content.type === 'variable';

        if (shouldHighlight && aiPatches.length < 8) { // Limit to 8 highlights
          aiPatches.push({
            elementId: element.elementId,
            action: 'annotate',
            data: {
              comment: getSmartComment(element),
              highlightColor: getHighlightColor(element.content.type),
              importance: element.content.type.includes('formula') ? 'high' : 'medium'
            }
          });
        }
      });

      if (aiPatches.length === 0) {
        alert('No suitable content found for highlighting in this PDF');
        return;
      }

      // Apply the highlights using our AI patches handler
      const highlightResult = await window.electron.ipcRenderer.invoke('pdf:apply-ai-patches', {
        filePath: selectedPdfPath,
        outputPath: selectedPdfPath.replace('.pdf', '_highlighted.pdf'),
        pdfStructure: pdfData,
        patches: aiPatches
      });

      if (!highlightResult.success) {
        throw new Error(highlightResult.error || 'Failed to apply highlights');
      }

      console.log('✅ Highlights applied successfully:', highlightResult.data);

      // Update the preview to show the highlighted version
      setSelectedPdf(highlightResult.data.outputPath, `Highlighted - ${pdfData.document.metadata?.title || 'PDF'}`);

      // Save the highlighted PDF path for download
      setHighlightedPdfPath(highlightResult.data.outputPath);

      alert(`✅ Applied ${highlightResult.data.patchesApplied} highlights to PDF!\n\nHighlighted version now showing in preview.`);

    } catch (error: any) {
      console.error('❌ Error highlighting PDF:', error);
      alert(`Error applying highlights: ${error.message}`);
    } finally {
      setHighlightLoading(false);
    }
  };

  // Helper function to get smart comments based on element type
  const getSmartComment = (element: any): string => {
    switch (element.content.type) {
      case 'math_symbol': return 'Mathematical symbol';
      case 'formula': return 'Key formula';
      case 'greek_letter': return 'Greek letter';
      case 'theorem': return 'Important theorem';
      case 'solution': return 'Solution method';
      case 'variable': return 'Variable';
      case 'number': return 'Numerical value';
      default: return 'Important content';
    }
  };

  // Helper function to get highlight color based on content type
  const getHighlightColor = (type: string): 'yellow' | 'green' | 'blue' | 'red' => {
    if (type.includes('formula') || type.includes('theorem')) return 'red';
    if (type.includes('math') || type.includes('greek')) return 'yellow';
    if (type.includes('solution')) return 'green';
    return 'blue';
  };

  // Handle downloading the current PDF (highlighted or original)
  const handleDownloadCurrentPdf = async () => {
    // Use highlighted PDF if available, otherwise use the currently selected PDF
    const pdfToDownload = highlightedPdfPath || selectedPdfPath;

    if (!pdfToDownload) {
      alert('No PDF available for download. Please select a PDF first.');
      return;
    }

    setDownloadLoading(true);

    try {
      console.log('📥 Starting PDF download:', pdfToDownload);

      // Generate a suggested filename based on the PDF being downloaded
      const originalFileName = selectedPdfPath ? selectedPdfPath.split(/[/\\]/).pop()?.replace('.pdf', '') || 'document' : 'document';
      const isHighlighted = pdfToDownload === highlightedPdfPath;
      const suggestedFileName = isHighlighted ? `${originalFileName}_highlighted.pdf` : `${originalFileName}.pdf`;

      // Call the download IPC handler
      const downloadResult = await window.electron.ipcRenderer.invoke('pdf:download', {
        filePath: pdfToDownload,
        suggestedFileName
      });

      if (!downloadResult.success) {
        if (downloadResult.error === 'Download canceled by user') {
          console.log('📥 Download canceled by user');
          return; // Don't show error for user cancellation
        }
        throw new Error(downloadResult.error || 'Failed to download PDF');
      }

      console.log('✅ PDF downloaded successfully:', downloadResult.data);
      alert(`✅ PDF downloaded successfully!\n\nSaved to: ${downloadResult.data.downloadPath}`);

    } catch (error: any) {
      console.error('❌ Error downloading PDF:', error);
      alert(`Error downloading PDF: ${error.message}`);
    } finally {
      setDownloadLoading(false);
    }
  };

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
    setLocalGenerationError(null);
    setResultSummary('');
    setStreamBuffer('');
    setHighlightedPdfPath(null); // Clear highlighted PDF path

    // Clear stored record
    clearGenerationRecord(sessionContext.sessionId);
  };

  // Handle coursework generation
  const handleGenerateCoursework = async () => {
    if (selectedCoursework.length === 0) {
      setLocalGenerationError(intl.formatMessage({ id: 'courseworkGenerator.generate.noAssignmentsSelected' }, { defaultMessage: 'No assignments selected' }));
      return;
    }

    // Start generation tracking in store
    startGeneration(sessionContext.sessionId);
    setLocalGenerationError(null);
    setResultSummary('');
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
      saveGenerationRecord({
        sessionId,
        courseId: sessionContext.sessionId,
        selectedAssignments: selectedCoursework,
        resultSummary: '', // Will be updated when generation completes
        status: 'completed' // Will be updated based on result
      });

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
        specialInstructions: '' // No special instructions for now
      });

      console.log('🤖 Sending coursework generation prompt to agent...', {
        sessionId,
        promptLength: prompt.length,
        pageContentsCount: pageContents.length,
        prompt: prompt.substring(0, 200) + '...'
      });

      // Save prompt to AppData for debugging
      try {
        const debugResult = await window.electron.ipcRenderer.invoke('fileio:save-prompt-debug', {
          sessionId,
          prompt,
          metadata: {
            courseId: sessionContext.sessionId,
            courseName: sessionContext.sessionName,
            selectedCoursework,
            pageContentsCount: pageContents.length,
            promptLength: prompt.length,
            parsedContentCount: parsedContent.length
          }
        });

        if (debugResult.success) {
          console.log('💾 Prompt saved for debugging:', debugResult.filePath);
        } else {
          console.warn('⚠️ Failed to save prompt for debugging:', debugResult.error);
        }
      } catch (debugError) {
        console.warn('⚠️ Error saving prompt for debugging:', debugError);
      }

      // Send to agent using the correct IPC method
      await window.electron.ipcRenderer.invoke('chat:agent:run', {
        sessionId,
        prompt,
        courseId: sessionContext.sessionId
      });

      console.log('✅ Coursework generation started successfully');

    } catch (error: any) {
      console.error('❌ Error starting coursework generation:', error);
      const errorMessage = error.message || intl.formatMessage({ id: 'courseworkGenerator.generate.error' }, { defaultMessage: 'Failed to start coursework generation' });
      setLocalGenerationError(errorMessage);
      setStoreGenerationError(sessionContext.sessionId, errorMessage);
      // Reset the parent isGenerating state on error
      if (onGenerationComplete) {
        setTimeout(() => onGenerationComplete(), 100);
      }
    }
  };

  // Handle abort generation
  const handleAbortGeneration = async () => {
    try {
      // Use store's abort method which handles IPC and state cleanup
      abortGeneration(sessionContext.sessionId);

      clearPlan(sessionId);
      clearTodos(sessionId);
      setResultSummary('');
      setStreamBuffer('');

      // Reset the parent isGenerating state on abort
      if (onGenerationComplete) {
        setTimeout(() => onGenerationComplete(), 100);
      }
    } catch (error) {
      console.error('Failed to abort generation:', error);
      // Clear plan and todos even if abort fails
      clearPlan(sessionId);
      clearTodos(sessionId);

      // Reset the parent isGenerating state even if abort fails
      if (onGenerationComplete) {
        setTimeout(() => onGenerationComplete(), 100);
      }
    }
  };

  // Listen for streaming responses
  useEffect(() => {
    const ipc = window.electron?.ipcRenderer;
    if (!ipc) return;

    const handleStreamToken = (event: any, data: any) => {
      const eventData = data || event;
      if (eventData?.sessionId === sessionId) {
        setStreamBuffer(prev => prev + (eventData.token || ''));
      }
    };

    const handleStreamEnd = (event: any, data: any) => {
      const eventData = data || event;
      console.log('🏁 Stream end event received:', {
        sessionId: eventData?.sessionId,
        expectedSessionId: sessionId,
        hasResultSummary: !!eventData?.resultSummary,
        resultSummaryLength: eventData?.resultSummary?.length || 0,
        eventKeys: Object.keys(eventData || {})
      });

      if (eventData?.sessionId === sessionId) {
        // Finish generation tracking in store
        finishGeneration(sessionContext.sessionId);

        // Extract the result if available - try multiple possible fields
        const resultSummary = eventData.resultSummary || eventData.result || eventData.response || '';

        if (resultSummary && resultSummary.length > 0) {
          console.log('✅ Setting result summary:', resultSummary.substring(0, 100) + '...');
          setResultSummary(resultSummary);

          // Update the generation record with the result
          console.log('📝 Updating generation record with result');
          updateGenerationRecord(sessionContext.sessionId, {
            resultSummary: resultSummary,
            status: 'completed'
          });
        } else {
          console.warn('⚠️ No result summary found in stream end event:', eventData);

          // Still update the record as completed even without result summary
          updateGenerationRecord(sessionContext.sessionId, {
            status: 'completed'
          });
        }

        // Clear plan and todos when generation is complete
        clearPlan(sessionId);
        clearTodos(sessionId);

        // Reset the parent isGenerating state
        if (onGenerationComplete) {
          setTimeout(() => onGenerationComplete(), 100);
        }
      }
    };

    const handleStreamError = (event: any, data: any) => {
      const eventData = data || event;
      if (eventData?.sessionId === sessionId) {
        const errorMessage = eventData.error || 'Generation failed';
        setLocalGenerationError(errorMessage);
        setStoreGenerationError(sessionContext.sessionId, errorMessage);

        // Update the generation record with error status
        updateGenerationRecord(sessionContext.sessionId, {
          status: 'failed',
          error: errorMessage
        });

        // Clear plan and todos on error
        clearPlan(sessionId);
        clearTodos(sessionId);

        // Reset the parent isGenerating state on error
        if (onGenerationComplete) {
          setTimeout(() => onGenerationComplete(), 100);
        }
      }
    };

    // Handle plan updates
    const handlePlan = (event: any, data: any) => {
      const eventData = data || event;
      if (eventData?.sessionId === sessionId) {
        setPlan(sessionId, eventData.plan);
      }
    };

    // Handle todos updates
    const handleTodos = (event: any, data: any) => {
      const eventData = data || event;
      if (eventData?.sessionId === sessionId) {
        setTodos(sessionId, eventData.todos);
      }
    };

    // Handle todo completion updates
    const handleTodoUpdate = (event: any, data: any) => {
      const eventData = data || event;
      if (eventData?.sessionId === sessionId) {
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
  }, [sessionId, onGenerationComplete, setPlan, setTodos, updateTodoByIndex, clearPlan, clearTodos]);

  // Load existing generation results when component mounts
  useEffect(() => {
    console.log('🔄 Loading existing record:', {
      hasRecord: !!existingRecord,
      hasResultSummary: !!existingRecord?.resultSummary,
      resultSummaryLength: existingRecord?.resultSummary?.length || 0,
      status: existingRecord?.status
    });

    if (existingRecord) {
      // Set result summary if available
      if (existingRecord.resultSummary) {
        console.log('✅ Loading existing result summary:', existingRecord.resultSummary.substring(0, 100) + '...');
        setResultSummary(existingRecord.resultSummary);
      } else {
        console.log('⚠️ Existing record has no result summary');
        setResultSummary('');
      }
    } else {
      console.log('ℹ️ No existing record found');
      setResultSummary('');
    }
  }, [existingRecord]);

  // Auto-parse PDF data when selectedPdfPath changes
  useEffect(() => {
    if (selectedPdfPath && !currentPdfData) {
      console.log('🔄 Auto-parsing PDF data for:', selectedPdfPath);
      parsePdfForHighlighting(selectedPdfPath);
    }
  }, [selectedPdfPath, currentPdfData]);

  // Removed automatic generation trigger - user must manually click Generate button

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 0 // Important for flex children
    }}>
      {/* Header Section - Fixed */}
      <Box sx={{ flexShrink: 0 }}>
        {/* Title */}
        <Typography variant="h5" sx={{ fontWeight: 500, mb: 2 }}>
          {intl.formatMessage({ id: 'courseworkGenerator.generate.title' })}
        </Typography>

        {/* Action Buttons Row - Plainer UI */}
        <Box sx={{
          display: 'flex',
          gap: 1.5,
          mb: 3,
          pb: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          {/* Highlight PDF Button */}
          <Button
            variant="text"
            size="small"
            disabled={!selectedPdfPath || highlightLoading}
            onClick={handleHighlightCurrentPdf}
            startIcon={highlightLoading ? <CircularProgress size={16} /> : <HighlightIcon />}
            sx={{ minWidth: 'auto', px: 2 }}
          >
            {highlightLoading ? 'Highlighting...' : 'Highlight'}
          </Button>

          {/* Download PDF Button */}
          <Button
            variant="text"
            size="small"
            disabled={!selectedPdfPath || downloadLoading}
            onClick={handleDownloadCurrentPdf}
            startIcon={downloadLoading ? <CircularProgress size={16} /> : <DownloadIcon />}
            title={highlightedPdfPath ? 'Download highlighted PDF' : 'Download current PDF'}
            sx={{ minWidth: 'auto', px: 2 }}
          >
            {downloadLoading ? 'Downloading...' : 'Download'}
          </Button>

          {/* Clear Results Button - Only show when there's an existing record */}
          {existingRecord && !generationInProgress && (
            <Button
              variant="text"
              size="small"
              color="error"
              onClick={handleClearResults}
              sx={{ minWidth: 'auto', px: 2 }}
            >
              Clear Results
            </Button>
          )}

          {/* Generate Button */}
          <Button
            variant="contained"
            size="small"
            disabled={
              selectedCoursework.length === 0 ||
              generationInProgress
            }
            onClick={handleGenerateCoursework}
            startIcon={generationInProgress ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
            sx={{ ml: 'auto', px: 3 }}
          >
            {generationInProgress ? 'Generating...' : 'Generate'}
          </Button>

          {/* Info Icon */}
          <Tooltip
            title={intl.formatMessage({ id: 'courseworkGenerator.pdfFormatNotice' })}
            placement="top"
            arrow
          >
            <InfoIcon
              sx={{
                color: 'info.main',
                fontSize: 18,
                cursor: 'help',
                ml: 0.5
              }}
            />
          </Tooltip>
        </Box>

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
      </Box>

      {/* Content Section - Flexible */}
      <Box sx={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {existingRecord && !generationInProgress ? (
          /* Show existing generation result */
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

            <Paper variant="outlined" sx={{ flex: 1, p: 2, overflow: 'auto' }}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Generated: {new Date(existingRecord.generatedAt).toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Status: {existingRecord.status}
                </Typography>
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
                  {existingRecord.resultSummary}
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
  );
}

export default Generate;
