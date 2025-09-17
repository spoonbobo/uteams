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
        // Batch submit mode
        let successCount = 0;
        const errors: string[] = [];
        
        for (let i = 0; i < selectedSubmissions.length; i++) {
          const studentId = selectedSubmissions[i];
          const grade = finalGrades[studentId];
          const feedback = finalFeedbacks[studentId];
          
          if (!grade || !feedback) {
            errors.push(`Missing grade/feedback for student ${studentId}`);
            continue;
          }
          
          try {
            // Update the final grading record
            updateFinalGrading(selectedAssignment, studentId, grade, feedback);
            
            // Submit grade to Moodle
            const result = await submitGrade(
              selectedAssignment,
              studentId,
              parseFloat(grade),
              feedback,
              config
            );
            
            if (result.success) {
              successCount++;
              setSubmittedCount(successCount);
            } else {
              errors.push(`Student ${studentId}: ${result.error || 'Failed'}`);
            }
          } catch (error: any) {
            errors.push(`Student ${studentId}: ${error.message || 'Failed'}`);
          }
        }
        
        // Show results
        if (successCount === selectedSubmissions.length) {
          alert(intl.formatMessage({ id: 'grading.submit.batchSuccess' }, { count: successCount }));
        } else if (successCount > 0) {
          alert(intl.formatMessage({ id: 'grading.submit.batchPartial' }, { success: successCount, total: selectedSubmissions.length }));
        }
        
        if (errors.length > 0) {
          setSubmitError(errors.join('\n'));
        }
        
        // Reload assignment data
        await loadAssignmentData(selectedAssignment, config);
        
        // Close if all successful
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
          // Batch mode UI - Show summary
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              {intl.formatMessage({ id: 'grading.submit.batchInfo' }, { count: submissionCount })}
            </Alert>
            
            <Typography variant="body2" sx={{ mb: 2 }}>
              {intl.formatMessage({ id: 'grading.submit.batchConfirm' })}
            </Typography>
            
            {/* Show list of students to be submitted */}
            <Box sx={{ maxHeight: 300, overflow: 'auto', mb: 2 }}>
              {selectedSubmissions?.map((studentId, index) => {
                const studentData = selectedSubmissionsData?.[index];
                const grade = finalGrades[studentId];
                const feedback = finalFeedbacks[studentId];
                
                return (
                  <Box key={studentId} sx={{ 
                    p: 1, 
                    mb: 1, 
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: index === currentIndex ? 'action.selected' : 'background.paper'
                  }}>
                    <Typography variant="subtitle2">
                      {studentData?.student.fullname || studentId}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Grade: {grade || 'N/A'} | Feedback: {feedback ? feedback.substring(0, 50) + '...' : 'N/A'}
                    </Typography>
                  </Box>
                );
              })}
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
          disabled={isSubmitting || (!isBatchMode && (!finalGrades[currentStudentId || ''] || !finalFeedbacks[currentStudentId || '']))}
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
