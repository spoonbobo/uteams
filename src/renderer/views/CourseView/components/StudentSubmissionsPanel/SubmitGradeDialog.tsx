import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Box,
  Typography,
} from '@mui/material';
import type { MoodleAssignment } from '@/types/moodle';
import type { StudentSubmissionData } from '@/types/grading';
import { useGradingStore } from '@/stores/useGradingStore';
import { useMoodleStore } from '@/stores/useMoodleStore';
import { useIntl } from 'react-intl';

interface SubmitGradeDialogProps {
  open: boolean;
  onClose: () => void;
  selectedAssignment: string;
  selectedSubmission?: string;
  selectedSubmissions?: string[]; // For batch submit
  selectedAssignmentData?: MoodleAssignment;
  selectedSubmissionData?: StudentSubmissionData;
  selectedSubmissionsData?: StudentSubmissionData[]; // For batch submit
}

export const SubmitGradeDialog: React.FC<SubmitGradeDialogProps> = ({
  open,
  onClose,
  selectedAssignment,
  selectedSubmission,
  selectedSubmissions,
  selectedAssignmentData,
  selectedSubmissionData,
  selectedSubmissionsData,
}) => {
  const intl = useIntl();
  const { config } = useMoodleStore();
  const { 
    getGradingRecord, 
    updateFinalGrading, 
    submitGrade,
    loadAssignmentData 
  } = useGradingStore();
  
  // Determine if this is batch mode
  const isBatchMode = !!(selectedSubmissions && selectedSubmissions.length > 0);
  const submissionCount = isBatchMode ? selectedSubmissions.length : 1;
  
  // Local state for the dialog
  const [currentIndex, setCurrentIndex] = useState(0);
  const [finalGrades, setFinalGrades] = useState<Record<string, string>>({});
  const [finalFeedbacks, setFinalFeedbacks] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedCount, setSubmittedCount] = useState(0);

  // Get current student ID and data
  const currentStudentId = isBatchMode 
    ? selectedSubmissions[currentIndex] 
    : selectedSubmission;
  
  const currentStudentData = isBatchMode 
    ? selectedSubmissionsData?.[currentIndex]
    : selectedSubmissionData;

  // Initialize dialog state when it opens or current index changes
  useEffect(() => {
    if (open && selectedAssignment) {
      if (isBatchMode && selectedSubmissions) {
        // Initialize all grades and feedbacks for batch mode
        const grades: Record<string, string> = {};
        const feedbacks: Record<string, string> = {};
        
        selectedSubmissions.forEach(studentId => {
          const gradingRecord = getGradingRecord(selectedAssignment, studentId);
          const aiGradeResult = gradingRecord?.aiGradeResult;
          grades[studentId] = aiGradeResult?.grade?.toString() || '';
          feedbacks[studentId] = aiGradeResult?.feedback || '';
        });
        
        setFinalGrades(grades);
        setFinalFeedbacks(feedbacks);
      } else if (selectedSubmission) {
        // Single mode
        const gradingRecord = getGradingRecord(selectedAssignment, selectedSubmission);
        const aiGradeResult = gradingRecord?.aiGradeResult;
        
        setFinalGrades({ [selectedSubmission]: aiGradeResult?.grade?.toString() || '' });
        setFinalFeedbacks({ [selectedSubmission]: aiGradeResult?.feedback || '' });
      }
      
      setSubmitError(null);
      setCurrentIndex(0);
      setSubmittedCount(0);
    }
  }, [open, selectedAssignment, selectedSubmission, selectedSubmissions, isBatchMode, getGradingRecord]);

  const handleSubmitGrade = async () => {
    if (!config) return;
    
    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      if (isBatchMode && selectedSubmissions) {
        // Batch submit mode - similar to single mode but for multiple students
        let successCount = 0;
        const errors: string[] = [];
        const skipped: string[] = [];
        
        for (let i = 0; i < selectedSubmissions.length; i++) {
          const studentId = selectedSubmissions[i];
          const studentData = selectedSubmissionsData?.[i];
          const studentName = studentData?.student.fullname || studentId;
          const grade = finalGrades[studentId];
          const feedback = finalFeedbacks[studentId];
          
          // Skip if no grade or feedback
          if (!grade || !feedback) {
            skipped.push(studentName);
            continue;
          }
          
          // Validate grade range
          const gradeNum = parseFloat(grade);
          if (isNaN(gradeNum) || gradeNum < 0 || gradeNum > 100) {
            errors.push(`${studentName}: Invalid grade (must be 0-100)`);
            continue;
          }
          
          try {
            // Update the final grading record in store
            updateFinalGrading(selectedAssignment, studentId, grade, feedback);
            
            // Submit grade to Moodle
            const result = await submitGrade(
              selectedAssignment,
              studentId,
              gradeNum,
              feedback,
              config
            );
            
            if (result.success) {
              successCount++;
              setSubmittedCount(successCount);
            } else {
              errors.push(`${studentName}: ${result.error || 'Failed to submit'}`);
            }
          } catch (error: any) {
            errors.push(`${studentName}: ${error.message || 'Failed to submit'}`);
          }
        }
        
        // Build result message
        let resultMessage = '';
        if (successCount > 0) {
          resultMessage += intl.formatMessage({ id: 'grading.submit.batchSuccess' }, { count: successCount });
        }
        if (skipped.length > 0) {
          resultMessage += '\n' + intl.formatMessage({ id: 'grading.submit.skipped' }, { count: skipped.length });
          resultMessage += '\n' + skipped.join(', ');
        }
        if (errors.length > 0) {
          setSubmitError(errors.join('\n'));
        }
        
        // Show results
        if (resultMessage) {
          alert(resultMessage);
        }
        
        // Reload assignment data to refresh the UI
        await loadAssignmentData(selectedAssignment, config);
        
        // Close if all successful (no errors and no skipped)
        if (successCount === selectedSubmissions.length) {
          onClose();
        }
      } else if (currentStudentId) {
        // Single submit mode
        const grade = finalGrades[currentStudentId];
        const feedback = finalFeedbacks[currentStudentId];
        
        if (!grade || !feedback) {
          setSubmitError('Grade and feedback are required');
          return;
        }
        
        // Update the final grading record
        updateFinalGrading(selectedAssignment, currentStudentId, grade, feedback);
        
        // Submit grade to Moodle
        const result = await submitGrade(
          selectedAssignment,
          currentStudentId,
          parseFloat(grade),
          feedback,
          config
        );
        
        if (result.success) {
          alert(intl.formatMessage({ id: 'grading.submit.success' }, { grade }));
          await loadAssignmentData(selectedAssignment, config);
          onClose();
        } else {
          setSubmitError(result.error || 'Failed to submit grade');
        }
      }
    } catch (error: any) {
      console.error('Error submitting grades:', error);
      setSubmitError(error.message || 'Failed to submit grades');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSubmitError(null);
    setCurrentIndex(0);
    setSubmittedCount(0);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        {isBatchMode 
          ? intl.formatMessage({ id: 'grading.submit.batchTitle' }, { count: submissionCount })
          : intl.formatMessage({ id: 'grading.submit.title' }) + ' - ' + currentStudentData?.student.fullname
        }
        {isBatchMode && submittedCount > 0 && (
          <Typography variant="caption" sx={{ ml: 2, color: 'success.main' }}>
            ({submittedCount}/{submissionCount} {intl.formatMessage({ id: 'grading.submit.submitted' })})
          </Typography>
        )}
      </DialogTitle>

      <DialogContent>
        {isBatchMode ? (
          // Batch mode UI - Show editable forms for each student
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              {intl.formatMessage({ id: 'grading.submit.batchInfo' }, { count: submissionCount })}
            </Alert>
            
            <Typography variant="body2" sx={{ mb: 2 }}>
              {intl.formatMessage({ id: 'grading.submit.batchEditInfo' })}
            </Typography>
            
            {/* Show editable list of students */}
            <Box sx={{ maxHeight: 400, overflow: 'auto', mb: 2 }}>
              {selectedSubmissions?.map((studentId, index) => {
                const studentData = selectedSubmissionsData?.[index];
                const gradingRecord = getGradingRecord(selectedAssignment, studentId);
                const aiGradeResult = gradingRecord?.aiGradeResult;
                
                return (
                  <Box key={studentId} sx={{ 
                    p: 2, 
                    mb: 2, 
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: 'background.paper'
                  }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="subtitle2">
                        {studentData?.student.fullname || studentId}
                      </Typography>
                      {aiGradeResult && (
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => {
                            setFinalGrades({ ...finalGrades, [studentId]: aiGradeResult.grade?.toString() || '' });
                            setFinalFeedbacks({ ...finalFeedbacks, [studentId]: aiGradeResult.feedback || '' });
                          }}
                        >
                          {intl.formatMessage({ id: 'grading.submit.resetToAI' })}
                        </Button>
                      )}
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <TextField
                        label={intl.formatMessage({ id: 'grading.submit.grade' })}
                        type="number"
                        value={finalGrades[studentId] || ''}
                        onChange={(e) => setFinalGrades({ ...finalGrades, [studentId]: e.target.value })}
                        placeholder="0-100"
                        size="small"
                        sx={{ width: 100 }}
                        InputProps={{
                          inputProps: { min: 0, max: 100 }
                        }}
                      />
                      
                      <TextField
                        label={intl.formatMessage({ id: 'grading.submit.feedback' })}
                        value={finalFeedbacks[studentId] || ''}
                        onChange={(e) => setFinalFeedbacks({ ...finalFeedbacks, [studentId]: e.target.value })}
                        size="small"
                        multiline
                        rows={2}
                        fullWidth
                      />
                    </Box>
                    
                    {aiGradeResult && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        AI Grade: {aiGradeResult.grade} | AI Feedback: {aiGradeResult.feedback?.substring(0, 50)}...
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
            
            {/* Batch actions */}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                size="small"
                onClick={() => {
                  // Reset all to AI grades
                  const grades: Record<string, string> = {};
                  const feedbacks: Record<string, string> = {};
                  
                  selectedSubmissions?.forEach(studentId => {
                    const gradingRecord = getGradingRecord(selectedAssignment, studentId);
                    const aiGradeResult = gradingRecord?.aiGradeResult;
                    grades[studentId] = aiGradeResult?.grade?.toString() || '';
                    feedbacks[studentId] = aiGradeResult?.feedback || '';
                  });
                  
                  setFinalGrades(grades);
                  setFinalFeedbacks(feedbacks);
                }}
              >
                {intl.formatMessage({ id: 'grading.submit.resetAllToAI' })}
              </Button>
            </Box>
          </>
        ) : (
          // Single mode UI - Show form
          <>
            <TextField
              label={intl.formatMessage({ id: 'grading.submit.enterGrade' })}
              type="number"
              value={finalGrades[currentStudentId || ''] || ''}
              onChange={(e) => setFinalGrades({ ...finalGrades, [currentStudentId || '']: e.target.value })}
              placeholder="0-100"
              fullWidth
              margin="normal"
            />
            
            <TextField
              label={intl.formatMessage({ id: 'grading.submit.enterFeedback' })}
              multiline
              rows={4}
              value={finalFeedbacks[currentStudentId || ''] || ''}
              onChange={(e) => setFinalFeedbacks({ ...finalFeedbacks, [currentStudentId || '']: e.target.value })}
              fullWidth
              margin="normal"
            />
          </>
        )}

        {submitError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {submitError}
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={isSubmitting}>
          {intl.formatMessage({ id: 'common.cancel' })}
        </Button>
        {!isBatchMode && (
          <Button
            onClick={() => {
              // Reset to AI grading results
              if (currentStudentId) {
                const gradingRecord = getGradingRecord(selectedAssignment, currentStudentId);
                const aiGradeResult = gradingRecord?.aiGradeResult;
                setFinalGrades({ ...finalGrades, [currentStudentId]: aiGradeResult?.grade?.toString() || '' });
                setFinalFeedbacks({ ...finalFeedbacks, [currentStudentId]: aiGradeResult?.feedback || '' });
              }
            }}
            disabled={isSubmitting}
          >
            {intl.formatMessage({ id: 'grading.submit.clear' })}
          </Button>
        )}
        <Button
          variant="contained"
          onClick={handleSubmitGrade}
          disabled={
            isSubmitting || 
            (!isBatchMode && (!finalGrades[currentStudentId || ''] || !finalFeedbacks[currentStudentId || ''])) ||
            (isBatchMode && !Object.keys(finalGrades).some(id => finalGrades[id] && finalFeedbacks[id]))
          }
        >
          {isSubmitting ? (
            <>
              <CircularProgress size={16} sx={{ mr: 1 }} />
              {isBatchMode 
                ? intl.formatMessage({ id: 'grading.submit.submittingBatch' })
                : intl.formatMessage({ id: 'grading.submit.submitting' })
              }
            </>
          ) : (
            isBatchMode 
              ? intl.formatMessage({ id: 'grading.submit.submitAll' }, { count: submissionCount })
              : intl.formatMessage({ id: 'grading.submit.submitGrade' })
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
