import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import {
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import type { MoodleAssignment } from '../../../stores/useMoodleStore';
import type { StudentSubmissionData, RubricContent, AIGradeResult, DetailedAIGradeResult } from '../../../stores/useGradingStore';
import { DocxPreview } from '../../../components/DocxPreview/DocxPreview';
import type { DocxContent } from '../../../components/DocxPreview/types';
import { PlanWidget } from '../../../components/PlanWidget';
import { useIntl } from 'react-intl';
import { pulseNewHighlights } from '../../../components/DocxPreview/utils';
import type { ElementHighlight } from '../../../components/DocxPreview/types';
import { useChatStore } from '../../../stores/useChatStore';
import { createGradingPrompt } from '../prompts/gradingPrompt';
import { useGradingStore } from '../../../stores/useGradingStore';

interface AIGradingPanelProps {
  selectedAssignment: string;
  selectedSubmission: string | null;
  selectedAssignmentData?: MoodleAssignment;
  selectedSubmissionData?: StudentSubmissionData;
  rubricContent: RubricContent | null;
  aiGradeResult: AIGradeResult | null;
  isGrading: boolean;
  onRunAIGrading: () => void;
  onBack: () => void;
  onNext: () => void;
}

interface SubmissionFile {
  filename: string;
  filesize: number;
  fileurl: string;
  mimetype: string;
  timemodified: number;
}

export const AIGradingPanel: React.FC<AIGradingPanelProps> = ({
  selectedAssignment,
  selectedSubmission,
  selectedAssignmentData,
  selectedSubmissionData,
  rubricContent,
  aiGradeResult,
  isGrading,
  onRunAIGrading,
  onBack,
  onNext,
}) => {
  const intl = useIntl();
  
  // Get grading store hook to be reactive to changes
  const { 
    getDetailedAIGradeResult, 
    gradingRecords,
    gradingInProgress,
    batchGradingActive,
    batchGradingProgress,
    activeGradingStudent 
  } = useGradingStore();
  
  const [submissionFiles, setSubmissionFiles] = useState<SubmissionFile[]>([]);
  const [docxContent, setDocxContent] = useState<DocxContent | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<ElementHighlight[]>([]);
  const [gradingComments, setGradingComments] = useState<Array<{
    elementType: string;
    elementIndex: string;
    color: 'red' | 'yellow' | 'green';
    comment: string;
  }>>([]);
  const [gradingResult, setGradingResult] = useState<{
    comments: Array<{
      elementType: string;
      elementIndex: string;
      color: 'red' | 'yellow' | 'green';
      comment: string;
    }>;
    overallScore: number;
    shortFeedback: string;
  } | null>(null);
  const [isGradingActive, setIsGradingActive] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState('');
  const [appliedCommentIndices, setAppliedCommentIndices] = useState<Set<string>>(new Set());

  // Session ID for plan widget and chat store
  // Use activeGradingStudent if available (during active grading), otherwise use selectedSubmission
  const displayStudent = activeGradingStudent || selectedSubmission;
  const sessionId = `grading-${selectedAssignment}-${displayStudent}`;
  
  // Debug logging to verify unique sessions
  console.log(`[AIGradingPanel] SessionId: ${sessionId}, ActiveGrading: ${activeGradingStudent}, Selected: ${selectedSubmission}`);
  
  // Get plan and todos from chat store for PlanWidget
  const { 
    todosBySession, 
    planBySession,
    setPlan,
    setTodos,
    updateTodoByIndex,
    clearPlan,
    clearTodos
  } = useChatStore();
  
  // Use batch grading state from store instead of checking todo sessions
  const isPartOfBatchGrading = batchGradingActive;
  
  const todos = todosBySession[sessionId] || [];
  const plan = planBySession?.[sessionId];

  // Listen for AI agent events using the same pattern as ChatWidget
  useEffect(() => {
    const ipc = (window as any).electron?.ipcRenderer;
    if (!ipc) return;

    // Handle token streaming for grading results
    const onToken = (payload: { sessionId: string; token: string; node?: string }) => {
      if (payload?.sessionId !== sessionId) return;
      
      setStreamBuffer(prev => {
        const newBuffer = prev + payload.token;
        
        // Debug: Log the current buffer length and new token
        if (newBuffer.length % 100 === 0) { // Log every 100 characters to avoid spam
          console.log(`📡 Stream buffer length: ${newBuffer.length}, looking for comments...`);
        }
        
        // More robust approach: Look for complete comment objects in the stream
        // This handles partial JSON better by looking for complete object patterns
        
        // Find all potential comment objects that look complete
        // Pattern: { ... "elementType": "...", "elementIndex": "...", "color": "...", "comment": "..." ... }
        // Updated pattern to handle escaped quotes and any field order
        const commentObjectPattern = /\{[^}]*"elementType"\s*:\s*"(?:[^"\\]|\\.)*"[^}]*"elementIndex"\s*:\s*"(?:[^"\\]|\\.)*"[^}]*"color"\s*:\s*"(?:red|yellow|green)"[^}]*"comment"\s*:\s*"(?:[^"\\]|\\.)*"[^}]*\}/g;
        
        let match;
        const foundComments = [];
        
        // Reset regex lastIndex to search from beginning
        commentObjectPattern.lastIndex = 0;
        
        while ((match = commentObjectPattern.exec(newBuffer)) !== null) {
          try {
            const commentObj = JSON.parse(match[0]);
            // Validate required fields
            if (commentObj.elementType && commentObj.elementIndex && commentObj.color && commentObj.comment) {
              // Create a unique key for this comment
              const commentKey = `${commentObj.elementType}-${commentObj.elementIndex}`;
              foundComments.push({ commentObj, commentKey });
            }
          } catch (e) {
            // Skip malformed objects
            continue;
          }
        }
        
        // If no complete objects found, try a more lenient approach for partial objects
        if (foundComments.length === 0) {
          // Look for individual field patterns that might indicate a comment is forming
          const partialCommentPattern = /"elementType"\s*:\s*"([^"]+)"\s*,\s*"elementIndex"\s*:\s*"([^"]+)"\s*,\s*"color"\s*:\s*"(red|yellow|green)"\s*,\s*"comment"\s*:\s*"([^"]+)"/g;
          let partialMatch;
          
          while ((partialMatch = partialCommentPattern.exec(newBuffer)) !== null) {
            const commentObj = {
              elementType: partialMatch[1],
              elementIndex: partialMatch[2],
              color: partialMatch[3] as 'red' | 'yellow' | 'green',
              comment: partialMatch[4]
            };
            
            const commentKey = `${commentObj.elementType}-${commentObj.elementIndex}`;
            foundComments.push({ commentObj, commentKey });
          }
        }
        
        // Debug: Log found comments
        if (foundComments.length > 0) {
          console.log(`🔍 Found ${foundComments.length} comment(s) in stream:`, foundComments.map(c => c.commentKey));
        }
        
        // Apply any new comments we found
        foundComments.forEach(({ commentObj, commentKey }) => {
          // Check if we've already applied this specific comment
          if (!appliedCommentIndices.has(commentKey)) {
            console.log(`🎯 Applying comment on-the-fly:`, commentObj);
            
            // Add to grading comments
            setGradingComments(prev => {
              const exists = prev.some(c => 
                c.elementType === commentObj.elementType && 
                c.elementIndex === commentObj.elementIndex
              );
              if (!exists) {
                return [...prev, commentObj];
              }
              return prev;
            });
            
            // Apply highlight immediately with proper type conversion and validation
            setHighlights(prev => {
              // Convert elementIndex from string to number and validate
              const elementIndex = parseInt(commentObj.elementIndex, 10);
              
              // Validate that elementIndex is a valid number
              if (isNaN(elementIndex) || elementIndex < 0) {
                console.warn(`⚠️ Invalid elementIndex for highlight: ${commentObj.elementIndex} (${commentObj.elementType})`);
                return prev;
              }
              
              // Validate against available element counts if available
              if (docxContent?.elementCounts) {
                const elementType = commentObj.elementType;
                const maxCount = docxContent.elementCounts[elementType as keyof typeof docxContent.elementCounts];
                
                if (typeof maxCount === 'number' && elementIndex >= maxCount) {
                  console.warn(`⚠️ ElementIndex ${elementIndex} exceeds available ${elementType} count (${maxCount}). Skipping highlight.`);
                  return prev;
                }
              }
              
              const newHighlight: ElementHighlight = {
                elementType: commentObj.elementType,
                elementIndex: elementIndex,
                color: commentObj.color,
                comment: commentObj.comment,
              };
              
              const exists = prev.some(h => 
                h.elementType === newHighlight.elementType && 
                h.elementIndex === newHighlight.elementIndex
              );
              
              if (!exists) {
                console.log(`🎨 Adding validated highlight for ${commentObj.elementType} #${elementIndex}`);
                // Note: Pulse animation will be handled by the DocxPreview component
                // when it re-renders with the new highlights
                return [...prev, newHighlight];
              }
              return prev;
            });
            
            // Mark this comment as applied using the unique key
            setAppliedCommentIndices(prev => new Set(prev).add(commentKey));
          }
        });
        
        // Also try to extract the complete JSON for final result
        const jsonStart = newBuffer.indexOf('{');
        if (jsonStart !== -1) {
          // Try to find the matching closing brace
          let braceCount = 0;
          let jsonEnd = -1;
          let inString = false;
          let escapeNext = false;
          
          for (let i = jsonStart; i < newBuffer.length; i++) {
            const char = newBuffer[i];
            
            if (escapeNext) {
              escapeNext = false;
              continue;
            }
            
            if (char === '\\') {
              escapeNext = true;
              continue;
            }
            
            if (char === '"' && !escapeNext) {
              inString = !inString;
              continue;
            }
            
            if (!inString) {
              if (char === '{') braceCount++;
              else if (char === '}') {
                braceCount--;
                if (braceCount === 0) {
                  jsonEnd = i;
                  break;
                }
              }
            }
          }
          
          // If we have a complete JSON object, parse it for the final result
          if (jsonEnd !== -1) {
            const jsonStr = newBuffer.substring(jsonStart, jsonEnd + 1);
            try {
              const parsed = JSON.parse(jsonStr);
              console.log('📊 Complete grading result received:', parsed);
              
              // Store the complete result (including score and feedback)
              setGradingResult({
                comments: parsed.comments || [],
                overallScore: parsed.overallScore || 0,
                shortFeedback: parsed.shortFeedback || '',
              });
              
              // Ensure all comments are applied
              if (parsed.comments && Array.isArray(parsed.comments)) {
                const allHighlights: ElementHighlight[] = parsed.comments.map((comment: any) => ({
                  elementType: comment.elementType,
                  elementIndex: comment.elementIndex,
                  color: comment.color,
                  comment: comment.comment,
                }));
                
                setHighlights(allHighlights);
                setGradingComments(parsed.comments);
              }
            } catch (e) {
              // Complete JSON not ready yet
            }
          }
        }
        
        return newBuffer;
      });
    };

    // Handle plan updates
    const onPlan = (payload: { sessionId: string; plan: any }) => {
      if (payload?.sessionId !== sessionId) return;
      console.log('📋 Plan received:', payload.plan);
      setPlan(sessionId, payload.plan);
    };

    // Handle todos updates
    const onTodos = (payload: { sessionId: string; todos: any[] }) => {
      if (payload?.sessionId !== sessionId) return;
      console.log('📝 Todos received:', payload.todos);
      setTodos(sessionId, payload.todos);
    };

    // Handle todo completion updates
    const onTodoUpdate = (payload: { sessionId: string; todoIndex: number; completed: boolean }) => {
      if (payload?.sessionId !== sessionId) return;
      console.log('✅ Todo update:', payload.todoIndex, payload.completed);
      updateTodoByIndex(sessionId, payload.todoIndex, payload.completed);
    };

    // Handle synthesis start
    const onSynthesisStart = (payload: { sessionId: string; progress: number }) => {
      if (payload?.sessionId !== sessionId) return;
      console.log('🚀 Synthesis started, expecting JSON response...');
      setStreamBuffer(''); // Clear buffer for clean JSON parsing
    };

    // Handle completion
    const onDone = (payload: { sessionId: string; final?: string }) => {
      if (payload?.sessionId !== sessionId) return;
      console.log('✅ Grading complete');
      
      // Persist grading results to store
      if (gradingResult && selectedAssignment && selectedSubmission) {
        const { saveDetailedGradingRecord } = useGradingStore.getState();
        saveDetailedGradingRecord(selectedAssignment, selectedSubmission, gradingResult);
        console.log('💾 Detailed grading results persisted to store');
      }
      
      setStreamBuffer('');
      setIsGradingActive(false);
      setAppliedCommentIndices(new Set());
      // Clear plan and todos when done
      clearPlan(sessionId);
      clearTodos(sessionId);
    };

    // Handle errors
    const onError = (payload: { sessionId: string; error: string }) => {
      if (payload?.sessionId !== sessionId) return;
      console.error('❌ AI Error:', payload.error);
      setIsGradingActive(false);
      setStreamBuffer('');
      // Clear plan and todos on error
      clearPlan(sessionId);
      clearTodos(sessionId);
    };

    // Subscribe to all events (same as ChatWidget)
    const offToken = ipc?.on?.('chat:agent:token' as any, onToken as any);
    const offPlan = ipc?.on?.('chat:agent:plan' as any, onPlan as any);
    const offTodos = ipc?.on?.('chat:agent:todos' as any, onTodos as any);
    const offTodoUpdate = ipc?.on?.('chat:agent:todo-update' as any, onTodoUpdate as any);
    const offSynthesisStart = ipc?.on?.('chat:agent:synthesis-start' as any, onSynthesisStart as any);
    const offDone = ipc?.on?.('chat:agent:done' as any, onDone as any);
    const offError = ipc?.on?.('chat:agent:error' as any, onError as any);

    // Cleanup
    return () => {
      try { offToken?.(); } catch {}
      try { offPlan?.(); } catch {}
      try { offTodos?.(); } catch {}
      try { offTodoUpdate?.(); } catch {}
      try { offSynthesisStart?.(); } catch {}
      try { offDone?.(); } catch {}
      try { offError?.(); } catch {}
    };
  }, [sessionId, selectedAssignment, selectedSubmission, gradingResult, setPlan, setTodos, updateTodoByIndex, clearPlan, clearTodos]);

  // Load existing AI grading results when student is selected or when store data changes
  useEffect(() => {
    console.log('🔄 AIGradingPanel effect triggered:', { selectedAssignment, selectedSubmission, gradingRecordsLength: gradingRecords?.length });
    
    if (selectedAssignment && selectedSubmission) {
      const existingResult = getDetailedAIGradeResult(selectedAssignment, selectedSubmission);
      
      console.log('🔍 Checking for existing result:', { 
        assignmentId: selectedAssignment, 
        studentId: selectedSubmission, 
        existingResult: !!existingResult 
      });
      
      if (existingResult) {
        console.log('📋 Restoring existing AI grading results:', existingResult);
        setGradingResult(existingResult);
        setGradingComments(existingResult.comments);
        
        // Convert comments to highlights with proper validation
        const restoredHighlights: ElementHighlight[] = existingResult.comments
          .map((comment: any) => {
            // Convert elementIndex from string to number and validate
            const elementIndex = parseInt(comment.elementIndex, 10);
            
            // Validate that elementIndex is a valid number
            if (isNaN(elementIndex) || elementIndex < 0) {
              console.warn(`⚠️ Invalid elementIndex for restored highlight: ${comment.elementIndex} (${comment.elementType})`);
              return null;
            }
            
            return {
              elementType: comment.elementType,
              elementIndex: elementIndex,
              color: comment.color,
              comment: comment.comment,
            } as ElementHighlight;
          })
          .filter((highlight): highlight is ElementHighlight => highlight !== null);
        
        setHighlights(restoredHighlights);
        console.log('🎨 Restored highlights from persisted data:', restoredHighlights);
      } else {
        // Clear results if no existing data
        console.log('🧹 No existing results found, clearing local state');
        setGradingResult(null);
        setGradingComments([]);
        setHighlights([]);
      }
    }
  }, [selectedAssignment, selectedSubmission, getDetailedAIGradeResult, gradingRecords]);

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
                    console.error(`[AIGradingPanel] Failed to parse DOCX on attempt ${attempt}:`, parseResult.error);
                    
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
                  console.error(`[AIGradingPanel] Failed to download file on attempt ${attempt}:`, downloadResult.error);
                }
              } catch (error: any) {
                lastError = error.message;
                console.error(`[AIGradingPanel] Exception on attempt ${attempt}:`, error);
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

  if (!selectedAssignment || !selectedSubmission) {
    return (
      <Alert severity="info">
        {intl.formatMessage({ id: 'grading.ai.selectFirst' })}
      </Alert>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Back Button */}
      <Box sx={{ mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
        >
          {intl.formatMessage({ id: 'grading.navigation.back' })}
        </Button>
      </Box>


      {/* Batch Grading Indicator */}
      {isPartOfBatchGrading && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            Batch grading in progress: {batchGradingProgress.completed}/{batchGradingProgress.total} completed
            {selectedSubmissionData && (
              <> - Currently viewing: <strong>{selectedSubmissionData.student.fullname}</strong></>
            )}
            {activeGradingStudent && activeGradingStudent !== selectedSubmission && (
              <> - Showing plan for student ID: <strong>{activeGradingStudent}</strong></>
            )}
            {batchGradingProgress.currentStudent && (
              <> - Processing: <strong>{batchGradingProgress.currentStudent}</strong></>
            )}
          </Typography>
        </Alert>
      )}

      {/* Main Content Area - Split Layout */}
      <Box sx={{ display: 'flex', gap: 3, flex: 1, mb: 3 }}>
        {/* Left Side - DOCX Preview */}
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

        {/* Right Side - Plan Widget with Start Grading Button */}
        <Box sx={{ width: 350, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            {intl.formatMessage({ id: 'grading.aiGradingProgress' })}
          </Typography>
          
          
          <Card sx={{ 
            flex: 1, 
            position: 'relative', 
            overflow: 'hidden',
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider'
          }}>
            {/* Show grading results if available */}
            {gradingResult ? (
              <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                {/* Simplified Score and Feedback Section */}
                <Box sx={{ textAlign: 'center', p: 3 }}>
                  {/* Score Display */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {intl.formatMessage({ id: 'grading.ai.score', defaultMessage: 'Score' })}
                    </Typography>
                    <Typography 
                      variant="h2" 
                      sx={{
                        fontWeight: 700,
                        color: gradingResult.overallScore >= 70 ? 'success.main' : 
                               gradingResult.overallScore >= 50 ? 'warning.main' : 'error.main',
                        mb: 1
                      }}
                    >
                      {gradingResult.overallScore}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      out of 100
                    </Typography>
                  </Box>
                  
                  {/* Feedback Display */}
                  {gradingResult.shortFeedback && (
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {intl.formatMessage({ id: 'grading.ai.feedback', defaultMessage: 'Feedback' })}
                      </Typography>
                      <Typography variant="body1" sx={{ 
                        lineHeight: 1.6,
                        color: 'text.primary'
                      }}>
                        {gradingResult.shortFeedback}
                      </Typography>
                    </Box>
                  )}
                  
                  {/* Comments count indicator */}
                  {gradingComments.length > 0 && (
                    <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                      <Typography variant="body2" color="text.secondary">
                        {gradingComments.length} detailed comment{gradingComments.length !== 1 ? 's' : ''} highlighted in document
                      </Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            ) : (
              /* Show spinner when grading is starting/in progress but no plan yet, otherwise show PlanWidget */
              (() => {
                const isCurrentlyGrading = displayStudent && gradingInProgress.has(displayStudent);
                const hasActivePlan = plan || todos.length > 0;
                const shouldShowSpinner = isCurrentlyGrading && !hasActivePlan;
                
                return shouldShowSpinner ? (
                  <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <CircularProgress size={40} sx={{ mb: 2 }} />
                    <Typography variant="body2" color="text.secondary" textAlign="center">
                      {intl.formatMessage({ id: 'grading.ai.initializing', defaultMessage: 'Initializing AI grading...' })}
                    </Typography>
                  </CardContent>
                ) : (
                  <PlanWidget sessionId={sessionId} />
                );
              })()
            )}
          </Card>
        </Box>
      </Box>

    </Box>
  );
};
