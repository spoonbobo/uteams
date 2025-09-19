import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import type { ElementHighlight } from '@/components/DocxPreview/types';
import type { DocxContent } from '@/components/DocxPreview/types';
import { PlanWidget } from '@/components/PlanWidget';
import { useIntl } from 'react-intl';
import { useChatStore } from '@/stores/useChatStore';
import { useGradingStore } from '@/stores/useGradingStore';
import type { DetailedAIGradeResult } from '@/types/grading';

interface GradingResultsProps {
  selectedAssignment: string;
  selectedSubmission: string | null;
  selectedAssignmentData?: any;
  selectedSubmissionData?: any;
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
  selectedAssignmentData,
  selectedSubmissionData,
  docxContent,
  onHighlightsChange,
  onGradingCommentsChange,
}) => {
  // Track the last highlights to prevent duplicate updates
  const lastHighlightsRef = useRef<string>('');
  const lastCommentsRef = useRef<string>('');

  // Memoize callbacks with duplicate prevention
  const memoizedOnHighlightsChange = useCallback((highlights: ElementHighlight[]) => {
    const highlightsStr = JSON.stringify(highlights);
    if (highlightsStr !== lastHighlightsRef.current) {
      lastHighlightsRef.current = highlightsStr;
      onHighlightsChange(highlights);
    }
  }, [onHighlightsChange]);

  const memoizedOnGradingCommentsChange = useCallback((comments: any[]) => {
    const commentsStr = JSON.stringify(comments);
    if (commentsStr !== lastCommentsRef.current) {
      lastCommentsRef.current = commentsStr;
      onGradingCommentsChange(comments);
    }
  }, [onGradingCommentsChange]);
  const intl = useIntl();

  // Get grading store hook to be reactive to changes
  const {
    getDetailedAIGradeResult,
    gradingRecords,
    gradingInProgress,
    activeGradingStudent,
    initGradingStream,
    appendToGradingStream,
    processGradingStream,
    clearGradingStream,
    getGradingStream,
  } = useGradingStore();

  const [gradingResult, setGradingResult] = useState<DetailedAIGradeResult | null>(null);

  // Session ID for plan widget and chat store
  const sessionId = selectedAssignment && selectedSubmission
    ? `grading-${selectedAssignment}-${selectedSubmission}`
    : '';

  // Only log in development mode
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[GradingResults] SessionId: ${sessionId}, Selected: ${selectedSubmission}, ActiveGrading: ${activeGradingStudent}`);
  }

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

  // Listen for IPC events and delegate to store
  useEffect(() => {
    if (!sessionId || !selectedAssignment || !selectedSubmission) return;

    // Only log in development mode
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[GradingResults] Setting up IPC listeners for session: ${sessionId}`);
    }
    const ipc = (window as any).electron?.ipcRenderer;
    if (!ipc) {
      console.error('❌ IPC not available!');
      return;
    }

    // Initialize grading stream when starting to listen
    const isCurrentlyGrading = gradingInProgress.has(selectedSubmission);
    if (isCurrentlyGrading) {
      initGradingStream(sessionId);
    }

    // Handle token streaming - delegate to store
    const onToken = (payload: { sessionId: string; token: string; node?: string }) => {
      // Only process tokens for the currently selected student
      if (payload?.sessionId !== sessionId) return;

      // Append to stream buffer in store
      appendToGradingStream(sessionId, payload.token);

      // Process the stream to extract results
      processGradingStream(sessionId, selectedAssignment, selectedSubmission);
    };

    // Handle plan updates - Store ALL plans
    const onPlan = (payload: { sessionId: string; plan: any }) => {
      if (payload?.sessionId && payload.sessionId.startsWith(`grading-${selectedAssignment}-`)) {
        if (process.env.NODE_ENV === 'development') {
          console.debug('Plan received for session:', payload.sessionId);
        }
        setPlan(payload.sessionId, payload.plan);
      }
    };

    // Handle todos updates - Store ALL todos
    const onTodos = (payload: { sessionId: string; todos: any[] }) => {
      if (payload?.sessionId && payload.sessionId.startsWith(`grading-${selectedAssignment}-`)) {
        if (process.env.NODE_ENV === 'development') {
          console.debug('Todos received for session:', payload.sessionId);
        }
        setTodos(payload.sessionId, payload.todos);
      }
    };

    // Handle todo completion updates
    const onTodoUpdate = (payload: { sessionId: string; todoIndex: number; completed: boolean }) => {
      if (payload?.sessionId && payload.sessionId.startsWith(`grading-${selectedAssignment}-`)) {
        if (process.env.NODE_ENV === 'development') {
          console.debug('Todo update for session:', payload.sessionId, payload.todoIndex);
        }
        updateTodoByIndex(payload.sessionId, payload.todoIndex, payload.completed);
      }
    };

    // Handle synthesis start
    const onSynthesisStart = (payload: { sessionId: string; progress: number }) => {
      if (payload?.sessionId !== sessionId) return;
      if (process.env.NODE_ENV === 'development') {
        console.debug('Synthesis started for session:', sessionId);
      }
      // Re-initialize stream for clean JSON parsing
      initGradingStream(sessionId);
    };

    // Handle completion: UI-only cleanup; store will finalize/clear stream safely
    const onDone = (payload: { sessionId: string; final?: string }) => {
      if (payload?.sessionId && payload.sessionId.startsWith(`grading-${selectedAssignment}-`)) {
        if (process.env.NODE_ENV === 'development') {
          console.debug('Grading complete for session:', payload.sessionId);
        }
        clearPlan(payload.sessionId);
        clearTodos(payload.sessionId);
      }
    };

    // Handle errors: UI-only cleanup; store will clear stream on error
    const onError = (payload: { sessionId: string; error: string }) => {
      if (payload?.sessionId && payload.sessionId.startsWith(`grading-${selectedAssignment}-`)) {
        console.error('❌ AI Error for session:', payload.sessionId, payload.error);
        clearPlan(payload.sessionId);
        clearTodos(payload.sessionId);
      }
    };

    // Subscribe to all events
    // Only log in development mode
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[GradingResults] Subscribing to IPC events`);
    }
    const offToken = ipc?.on?.('chat:agent:token' as any, onToken as any);
    const offPlan = ipc?.on?.('chat:agent:plan' as any, onPlan as any);
    const offTodos = ipc?.on?.('chat:agent:todos' as any, onTodos as any);
    const offTodoUpdate = ipc?.on?.('chat:agent:todo-update' as any, onTodoUpdate as any);
    const offSynthesisStart = ipc?.on?.('chat:agent:synthesis-start' as any, onSynthesisStart as any);
    const offDone = ipc?.on?.('chat:agent:done' as any, onDone as any);
    const offError = ipc?.on?.('chat:agent:error' as any, onError as any);

    // Cleanup
    return () => {
      // Only log in development mode
      if (process.env.NODE_ENV === 'development') {
        console.debug(`[GradingResults] Cleaning up IPC listeners for session: ${sessionId}`);
      }
      try { offToken?.(); } catch {}
      try { offPlan?.(); } catch {}
      try { offTodos?.(); } catch {}
      try { offTodoUpdate?.(); } catch {}
      try { offSynthesisStart?.(); } catch {}
      try { offDone?.(); } catch {}
      try { offError?.(); } catch {}
    };
  }, [sessionId, selectedAssignment, selectedSubmission, setPlan, setTodos, updateTodoByIndex, clearPlan, clearTodos, initGradingStream, appendToGradingStream, processGradingStream, clearGradingStream]);

  // Load existing AI grading results from store
  useEffect(() => {
    // Only log in development mode
    if (process.env.NODE_ENV === 'development') {
      console.debug('[GradingResults] Checking for existing results:', {
        selectedAssignment,
        selectedSubmission,
        gradingRecordsLength: gradingRecords?.length
      });
    }

    if (selectedAssignment && selectedSubmission) {
      // First check if there's a result in the store
      const existingResult = getDetailedAIGradeResult(selectedAssignment, selectedSubmission);

      if (existingResult) {
        // Only update if the result has changed
        if (JSON.stringify(existingResult) !== JSON.stringify(gradingResult)) {
          if (process.env.NODE_ENV === 'development') {
            console.debug('[GradingResults] Found existing result in store');
          }
        setGradingResult(existingResult);

          // Convert to highlights
          const highlights: ElementHighlight[] = existingResult.comments
          .map((comment: any) => {
            const elementIndex = parseInt(comment.elementIndex, 10);
              if (isNaN(elementIndex) || elementIndex < 0) return null;

            return {
              elementType: comment.elementType,
              elementIndex: elementIndex,
              color: comment.color,
              comment: comment.comment,
            } as ElementHighlight;
          })
            .filter((h): h is ElementHighlight => h !== null);

          memoizedOnHighlightsChange(highlights);
          memoizedOnGradingCommentsChange(existingResult.comments);
        }
      } else {
        // Check if there's a temporary result in the grading stream
        const stream = getGradingStream(sessionId);
        if (stream?.tempResult) {
          // Only update if the result has changed
          if (JSON.stringify(stream.tempResult) !== JSON.stringify(gradingResult)) {
            if (process.env.NODE_ENV === 'development') {
              console.debug('[GradingResults] Found temp result in stream');
            }
            setGradingResult(stream.tempResult);

            // Convert to highlights
            const highlights: ElementHighlight[] = stream.tempResult.comments
              .map((comment: any) => {
                const elementIndex = parseInt(comment.elementIndex, 10);
                if (isNaN(elementIndex) || elementIndex < 0) return null;

                return {
                  elementType: comment.elementType,
                  elementIndex: elementIndex,
                  color: comment.color,
                  comment: comment.comment,
                } as ElementHighlight;
              })
              .filter((h): h is ElementHighlight => h !== null);

            memoizedOnHighlightsChange(highlights);
            memoizedOnGradingCommentsChange(stream.tempResult.comments);
          }
        } else if (gradingResult !== null) {
          // Clear if no results and we had results before
          if (process.env.NODE_ENV === 'development') {
            console.debug('[GradingResults] No results found, clearing state');
          }
        setGradingResult(null);
          memoizedOnHighlightsChange([]);
          memoizedOnGradingCommentsChange([]);
        }
      }
    }
  }, [selectedAssignment, selectedSubmission, getDetailedAIGradeResult, gradingRecords.length, sessionId, getGradingStream, gradingResult, memoizedOnHighlightsChange, memoizedOnGradingCommentsChange]);

  // Check for grading stream updates periodically
  useEffect(() => {
    if (!sessionId || !selectedSubmission || !gradingInProgress.has(selectedSubmission)) return;

    const interval = setInterval(() => {
      const stream = getGradingStream(sessionId);
      if (stream?.tempResult) {
        // Only update if the result has changed
        if (JSON.stringify(stream.tempResult) !== JSON.stringify(gradingResult)) {
          if (process.env.NODE_ENV === 'development') {
            console.debug('[GradingResults] Found new result in stream');
          }
          setGradingResult(stream.tempResult);

          // Convert to highlights
          const highlights: ElementHighlight[] = stream.tempResult.comments
            .map((comment: any) => {
              const elementIndex = parseInt(comment.elementIndex, 10);
              if (isNaN(elementIndex) || elementIndex < 0) return null;

              return {
                elementType: comment.elementType,
                elementIndex: elementIndex,
                color: comment.color,
                comment: comment.comment,
              } as ElementHighlight;
            })
            .filter((h): h is ElementHighlight => h !== null);

          memoizedOnHighlightsChange(highlights);
          memoizedOnGradingCommentsChange(stream.tempResult.comments);
        }
      }
    }, 500); // Check every 500ms

    return () => clearInterval(interval);
  }, [sessionId, selectedSubmission, gradingInProgress, gradingResult, getGradingStream, memoizedOnHighlightsChange, memoizedOnGradingCommentsChange]);

  return (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Simple Header */}
      <Typography
        variant="subtitle1"
        sx={{
          fontWeight: 500,
          mb: 2,
          color: 'text.primary'
        }}
      >
        {intl.formatMessage({ id: 'grading.ai.results' })}
      </Typography>

      <Box sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Show grading results if available */}
        {gradingResult ? (
          <Box sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto',
            gap: 2
          }}>
            {/* Clean Score Display */}
            <Box sx={{
              textAlign: 'center',
              py: 2
            }}>
              <Typography
                variant="h2"
                sx={{
                  fontWeight: 700,
                  color: gradingResult.overallScore >= 70 ? 'success.main' :
                         gradingResult.overallScore >= 50 ? 'warning.main' : 'error.main',
                  mb: 0.5,
                  fontSize: '3rem'
                }}
              >
                {gradingResult.overallScore}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {intl.formatMessage({ id: 'grading.ai.outOfHundred' })}
              </Typography>
            </Box>

            {/* Clean Feedback Display */}
            {gradingResult.shortFeedback && (
              <Box>
                <Typography
                  variant="body1"
                  sx={{
                    lineHeight: 1.7,
                    color: 'text.primary',
                    fontSize: '0.95rem'
                  }}
                >
                  {gradingResult.shortFeedback}
                </Typography>
              </Box>
            )}

            {/* Simplified Score Breakdown */}
            {gradingResult.scoreBreakdown && gradingResult.scoreBreakdown.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontWeight: 500 }}>
                  {intl.formatMessage({ id: 'grading.ai.scoreBreakdown' })}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {gradingResult.scoreBreakdown.map((item) => (
                    <Tooltip
                      key={item.criteriaName}
                      title={item.feedback || ''}
                      placement="left"
                      arrow
                      enterDelay={300}
                      leaveDelay={200}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          py: 1,
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                          cursor: item.feedback ? 'help' : 'default',
                          '&:hover': item.feedback ? {
                            backgroundColor: 'action.hover',
                            borderRadius: 0.5
                          } : {}
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'text.primary',
                            flex: 1
                          }}
                        >
                          {item.criteriaName}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            color: (item.score / item.maxScore) >= 0.8 ? 'success.main' :
                                   (item.score / item.maxScore) >= 0.6 ? 'warning.main' : 'error.main'
                          }}
                        >
                          {item.score}/{item.maxScore}
                        </Typography>
                      </Box>
                    </Tooltip>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        ) : (
          /* Clean Loading State */
          (() => {
            const isCurrentlyGrading = selectedSubmission && gradingInProgress.has(selectedSubmission);
            const hasActivePlan = plan || todos.length > 0;
            const shouldShowSpinner = isCurrentlyGrading && !hasActivePlan;

            return shouldShowSpinner ? (
              <Box sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                <CircularProgress size={32} sx={{ mb: 2, color: 'primary.main' }} />
                <Typography variant="body2" color="text.secondary">
                  {intl.formatMessage({ id: 'grading.ai.analyzingSubmission' })}
                </Typography>
              </Box>
            ) : (
              <PlanWidget sessionId={sessionId} />
            );
          })()
        )}
      </Box>
    </Box>
  );
};
