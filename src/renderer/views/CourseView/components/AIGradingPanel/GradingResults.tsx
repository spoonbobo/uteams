import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Card,
  CardContent,
} from '@mui/material';
import type { ElementHighlight } from '@/components/DocxPreview/types';
import type { DocxContent } from '@/components/DocxPreview/types';
import { PlanWidget } from '@/components/PlanWidget';
import { useIntl } from 'react-intl';
import { useChatStore } from '@/stores/useChatStore';
import { useGradingStore } from '@/stores/useGradingStore';

interface GradingResultsProps {
  selectedAssignment: string;
  selectedSubmission: string | null;
  docxContent: DocxContent | null;
  onHighlightsChange: (highlights: ElementHighlight[]) => void;
  onGradingCommentsChange: (comments: Array<{
    elementType: string;
    elementIndex: string;
    color: 'red' | 'yellow' | 'green';
    comment: string;
  }>) => void;
}

export const GradingResults: React.FC<GradingResultsProps> = ({
  selectedAssignment,
  selectedSubmission,
  docxContent,
  onHighlightsChange,
  onGradingCommentsChange,
}) => {
  const intl = useIntl();
  
  // Get grading store hook to be reactive to changes
  const { 
    getDetailedAIGradeResult, 
    gradingRecords,
    gradingInProgress,
    activeGradingStudent 
  } = useGradingStore();
  
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
  // IMPORTANT: Always use selectedSubmission for the session ID to ensure proper task isolation
  // The AIGradingPanel should only show tasks for the currently selected student, not the one being graded in batch
  const sessionId = `grading-${selectedAssignment}-${selectedSubmission}`;
  
  // Debug logging to verify unique sessions
  console.log(`[GradingResults] SessionId: ${sessionId}, Selected: ${selectedSubmission}, ActiveGrading: ${activeGradingStudent}`);
  
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
  
  
  const todos = todosBySession[sessionId] || [];
  const plan = planBySession?.[sessionId];

  // Update parent component when highlights change
  useEffect(() => {
    onHighlightsChange(highlights);
  }, [highlights, onHighlightsChange]);

  // Update parent component when grading comments change
  useEffect(() => {
    onGradingCommentsChange(gradingComments);
  }, [gradingComments, onGradingCommentsChange]);

  // Listen for AI agent events using the same pattern as ChatWidget
  // IMPORTANT: We listen to ALL grading events and store them, not just for the selected student
  useEffect(() => {
    console.log(`🔄 useEffect running for listening to ALL grading events`);
    const ipc = (window as any).electron?.ipcRenderer;
    if (!ipc) {
      console.error('❌ IPC not available! window.electron:', (window as any).electron);
      return;
    }

    // Handle token streaming for grading results
    const onToken = (payload: { sessionId: string; token: string; node?: string }) => {
      // Only process tokens for the currently selected student to avoid UI confusion
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

    // Handle plan updates - Store ALL plans, not just for selected student
    const onPlan = (payload: { sessionId: string; plan: any }) => {
      // Store plan for ANY grading session
      if (payload?.sessionId && payload.sessionId.startsWith(`grading-${selectedAssignment}-`)) {
        console.log('📋 Plan received for session:', payload.sessionId, payload.plan);
        setPlan(payload.sessionId, payload.plan);
      }
    };

    // Handle todos updates - Store ALL todos, not just for selected student
    const onTodos = (payload: { sessionId: string; todos: any[] }) => {
      console.log('📝 Todos event received for session:', payload?.sessionId);
      // Store todos for ANY grading session of this assignment
      if (payload?.sessionId && payload.sessionId.startsWith(`grading-${selectedAssignment}-`)) {
        console.log('📝 Storing todos for session:', payload.sessionId, payload.todos);
        setTodos(payload.sessionId, payload.todos);
      }
    };

    // Handle todo completion updates - Store ALL updates
    const onTodoUpdate = (payload: { sessionId: string; todoIndex: number; completed: boolean }) => {
      // Store todo updates for ANY grading session of this assignment
      if (payload?.sessionId && payload.sessionId.startsWith(`grading-${selectedAssignment}-`)) {
        console.log('✅ Todo update for session:', payload.sessionId, payload.todoIndex, payload.completed);
        updateTodoByIndex(payload.sessionId, payload.todoIndex, payload.completed);
      }
    };

    // Handle synthesis start
    const onSynthesisStart = (payload: { sessionId: string; progress: number }) => {
      // Only process synthesis for current student to avoid UI confusion
      if (payload?.sessionId !== sessionId) return;
      console.log('🚀 Synthesis started, expecting JSON response...');
      setStreamBuffer(''); // Clear buffer for clean JSON parsing
    };

    // Handle completion - Clear plans/todos for ANY completed grading session
    const onDone = (payload: { sessionId: string; final?: string }) => {
      // Clear plan/todos for ANY completed grading session of this assignment
      if (payload?.sessionId && payload.sessionId.startsWith(`grading-${selectedAssignment}-`)) {
        console.log('✅ Grading complete for session:', payload.sessionId);
        clearPlan(payload.sessionId);
        clearTodos(payload.sessionId);
        
        // Only update local state if it's for the current student
        if (payload.sessionId === sessionId) {
          // Persist grading results to store
          if (gradingResult && selectedAssignment && selectedSubmission) {
            const { saveDetailedGradingRecord } = useGradingStore.getState();
            saveDetailedGradingRecord(selectedAssignment, selectedSubmission, gradingResult);
            console.log('💾 Detailed grading results persisted to store');
          }
          
          setStreamBuffer('');
          setIsGradingActive(false);
          setAppliedCommentIndices(new Set());
        }
      }
    };

    // Handle errors - Clear plans/todos for ANY errored grading session
    const onError = (payload: { sessionId: string; error: string }) => {
      // Clear plan/todos for ANY errored grading session of this assignment
      if (payload?.sessionId && payload.sessionId.startsWith(`grading-${selectedAssignment}-`)) {
        console.error('❌ AI Error for session:', payload.sessionId, payload.error);
        clearPlan(payload.sessionId);
        clearTodos(payload.sessionId);
        
        // Only update local state if it's for the current student
        if (payload.sessionId === sessionId) {
          setIsGradingActive(false);
          setStreamBuffer('');
        }
      }
    };

    // Subscribe to all events (same as ChatWidget)
    console.log(`📡 Setting up IPC listeners for session: ${sessionId}`);
    const offToken = ipc?.on?.('chat:agent:token' as any, onToken as any);
    const offPlan = ipc?.on?.('chat:agent:plan' as any, onPlan as any);
    const offTodos = ipc?.on?.('chat:agent:todos' as any, onTodos as any);
    const offTodoUpdate = ipc?.on?.('chat:agent:todo-update' as any, onTodoUpdate as any);
    const offSynthesisStart = ipc?.on?.('chat:agent:synthesis-start' as any, onSynthesisStart as any);
    const offDone = ipc?.on?.('chat:agent:done' as any, onDone as any);
    const offError = ipc?.on?.('chat:agent:error' as any, onError as any);
    console.log(`📡 IPC listeners set up for session: ${sessionId}`);

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
  }, [sessionId, selectedAssignment, selectedSubmission, gradingResult, setPlan, setTodos, updateTodoByIndex, clearPlan, clearTodos, docxContent]);

  // Load existing AI grading results when student is selected or when store data changes
  useEffect(() => {
    console.log('🔄 GradingResults effect triggered:', { selectedAssignment, selectedSubmission, gradingRecordsLength: gradingRecords?.length });
    
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

  return (
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
              
            </Box>
          </CardContent>
        ) : (
          /* Show spinner when grading is starting/in progress but no plan yet, otherwise show PlanWidget */
          (() => {
            const isCurrentlyGrading = selectedSubmission && gradingInProgress.has(selectedSubmission);
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
  );
};
