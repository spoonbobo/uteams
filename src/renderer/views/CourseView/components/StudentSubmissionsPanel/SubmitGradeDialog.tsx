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
} from '@mui/material';
import type { MoodleAssignment } from '../../../../stores/useMoodleStore';
import type { StudentSubmissionData } from '../../../../stores/useGradingStore';
import { useGradingStore } from '../../../../stores/useGradingStore';
import { useMoodleStore } from '../../../../stores/useMoodleStore';
import { useIntl } from 'react-intl';

interface SubmitGradeDialogProps {
  open: boolean;
  onClose: () => void;
  selectedAssignment: string;
  selectedSubmission: string;
  selectedAssignmentData?: MoodleAssignment;
  selectedSubmissionData?: StudentSubmissionData;
}

export const SubmitGradeDialog: React.FC<SubmitGradeDialogProps> = ({
  open,
  onClose,
  selectedAssignment,
  selectedSubmission,
  selectedAssignmentData,
  selectedSubmissionData,
}) => {
  const intl = useIntl();
  const { config } = useMoodleStore();
  const { 
    getGradingRecord, 
    updateFinalGrading, 
    submitGrade,
    loadAssignmentData 
  } = useGradingStore();
  
  // Local state for the dialog
  const [finalGrade, setFinalGrade] = useState('');
  const [finalFeedback, setFinalFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Initialize dialog state when it opens
  useEffect(() => {
    if (open && selectedAssignment && selectedSubmission) {
      // Get AI grading results
      const gradingRecord = getGradingRecord(selectedAssignment, selectedSubmission);
      const aiGradeResult = gradingRecord?.aiGradeResult;
      
      // Initialize with AI results or empty values
      setFinalGrade(aiGradeResult?.grade?.toString() || '');
      setFinalFeedback(aiGradeResult?.feedback || '');
      setSubmitError(null);
    }
  }, [open, selectedAssignment, selectedSubmission, getGradingRecord]);

  const handleSubmitGrade = async () => {
    if (!finalGrade || !finalFeedback || !config) return;
    
    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      // Update the final grading record first
      updateFinalGrading(selectedAssignment, selectedSubmission, finalGrade, finalFeedback);
      
      // Submit grade to Moodle
      const result = await submitGrade(
        selectedAssignment,
        selectedSubmission,
        parseFloat(finalGrade),
        finalFeedback,
        config
      );
      
      if (result.success) {
        // Show success message
        alert(intl.formatMessage({ id: 'grading.submit.success' }, { grade: finalGrade }));
        
        // Optionally reload assignment data to reflect changes
        await loadAssignmentData(selectedAssignment, config);
        
        // Close dialog
        onClose();
      } else {
        setSubmitError(result.error || 'Failed to submit grade');
      }
    } catch (error: any) {
      console.error('Error submitting grade:', error);
      setSubmitError(error.message || 'Failed to submit grade');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = () => {
    // Get fresh AI grading results
    const gradingRecord = getGradingRecord(selectedAssignment, selectedSubmission);
    const aiGradeResult = gradingRecord?.aiGradeResult;
    
    setFinalGrade(aiGradeResult?.grade?.toString() || '');
    setFinalFeedback(aiGradeResult?.feedback || '');
    setSubmitError(null);
  };

  const handleClose = () => {
    handleClear();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        {intl.formatMessage({ id: 'grading.submit.title' })} - {selectedSubmissionData?.student.fullname}
      </DialogTitle>

      <DialogContent>
        <TextField
          label={intl.formatMessage({ id: 'grading.submit.enterGrade' })}
          type="number"
          value={finalGrade}
          onChange={(e) => setFinalGrade(e.target.value)}
          placeholder="0-100"
          fullWidth
          margin="normal"
        />
        
        <TextField
          label={intl.formatMessage({ id: 'grading.submit.enterFeedback' })}
          multiline
          rows={4}
          value={finalFeedback}
          onChange={(e) => setFinalFeedback(e.target.value)}
          fullWidth
          margin="normal"
        />

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
        <Button
          onClick={handleClear}
          disabled={isSubmitting}
        >
          {intl.formatMessage({ id: 'grading.submit.clear' })}
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmitGrade}
          disabled={!finalGrade || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <CircularProgress size={16} sx={{ mr: 1 }} />
              {intl.formatMessage({ id: 'grading.submit.submitting' })}
            </>
          ) : (
            intl.formatMessage({ id: 'grading.submit.submitGrade' })
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
