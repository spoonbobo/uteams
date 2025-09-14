import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Box,
  Typography,
  TextField,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import type { MoodleAssignment } from '../../../stores/useMoodleStore';
import type { StudentSubmissionData } from '../../../stores/useGradingStore';
import { useGradingStore } from '../../../stores/useGradingStore';
import { useMoodleStore } from '../../../stores/useMoodleStore';
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
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          minHeight: '500px',
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        pb: 1 
      }}>
        <Box>
          <Typography variant="h6" component="div">
            {intl.formatMessage({ id: 'grading.submit.title' })}
          </Typography>
          <Typography variant="subtitle2" color="text.secondary">
            {selectedSubmissionData?.student.fullname}
          </Typography>
        </Box>
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={{
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            {intl.formatMessage({ id: 'grading.submit.finalGrade' })}
          </Typography>
          
          <TextField
            label={intl.formatMessage({ id: 'grading.submit.enterGrade' })}
            type="number"
            value={finalGrade}
            onChange={(e) => setFinalGrade(e.target.value)}
            InputProps={{
              endAdornment: <Typography>/100</Typography>,
            }}
            sx={{ mb: 2 }}
            fullWidth
          />
          
          <TextField
            label={intl.formatMessage({ id: 'grading.submit.enterFeedback' })}
            multiline
            rows={4}
            value={finalFeedback}
            onChange={(e) => setFinalFeedback(e.target.value)}
            fullWidth
          />
        </Box>

        {submitError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {submitError}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 2 }}>
        <Button
          variant="outlined"
          onClick={handleClear}
          disabled={isSubmitting}
        >
          {intl.formatMessage({ id: 'grading.submit.clear' })}
        </Button>
        <Button
          variant="contained"
          color="success"
          startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
          onClick={handleSubmitGrade}
          disabled={!finalGrade || isSubmitting}
        >
          {isSubmitting 
            ? intl.formatMessage({ id: 'grading.submit.submitting' })
            : intl.formatMessage({ id: 'grading.submit.submitGrade' })
          }
        </Button>
      </DialogActions>
    </Dialog>
  );
};
