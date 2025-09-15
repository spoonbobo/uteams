import React, { useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  LinearProgress,
  Table,
  TableBody,
  TableContainer,
  TableRow,
  TableCell,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';
import { DocxDialog } from '../DocxDialog';
import { SubmitGradeDialog } from '../SubmitGradeDialog';
import { useIntl } from 'react-intl';

// Import decomposed components
import { BatchGradingProgress } from './BatchGradingProgress';
import { SubmissionsTableHeader } from './SubmissionsTableHeader';
import { CategoryHeader } from './CategoryHeader';
import { StudentRow } from './StudentRow';
import { useFilePreviewHandler } from './FilePreviewHandler';
import { useBatchGradingHandler } from './BatchGradingHandler';
import {
  useSubmissionFiles,
  useStudentFiles,
  useDialogStates,
  useCollapsibleCategories,
  useGradingActions,
} from './hooks';
import { categorizeStudents } from './utils';
import type { StudentSubmissionsPanelProps } from './types';
import type { StudentSubmissionData } from '../../../../stores/useGradingStore';



export const StudentSubmissionsPanel: React.FC<StudentSubmissionsPanelProps> = ({
  selectedAssignment,
  selectedSubmission,
  selectedAssignmentData,
  selectedSubmissionData,
  studentData,
  loading,
  stats,
  onSubmissionSelect,
  onBack,
  onNext,
  onViewGradingDetail,
}) => {
  const intl = useIntl();
  
  // Use decomposed hooks
  const { 
    getGradingRecord, 
    clearGradingRecord, 
    batchGradingActive,
    batchGradingProgress,
    isStudentBeingGraded,
    startBatchGrading,
    updateBatchGradingProgress,
    endBatchGrading,
    clearAllGradingProgress,
    setActiveGradingStudent,
    handleStartGrading
  } = useGradingActions(selectedAssignment);
  
  const { submissionFiles, docxContent, fileLoading, fileError } = useSubmissionFiles(selectedSubmission, selectedAssignment);
  const { studentFiles, loadStudentFiles } = useStudentFiles(selectedAssignment);
  const {
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
  } = useDialogStates();
  const { collapsedCategories, toggleCategoryCollapse } = useCollapsibleCategories();
  const {
    docxContent: previewDocxContent,
    fileLoading: previewFileLoading,
    fileError: previewFileError,
    handleFilePreview,
    clearFilePreview
  } = useFilePreviewHandler();

  // Only clear grading progress when assignment changes, not on every unmount
  // This allows grading state to persist when switching views
  useEffect(() => {
    // Clear progress only if assignment is being changed/cleared
    return () => {
      // Don't clear progress on unmount - let it persist for view switching
      // Progress will be cleared when assignment changes or explicitly requested
    };
  }, []);

  // Get categorized students and batch grading handler
  const categorizedStudents = categorizeStudents(studentData);
  const { handleBatchGrading } = useBatchGradingHandler(
    selectedAssignment,
    categorizedStudents,
    batchGradingActive,
    batchGradingProgress,
    startBatchGrading,
    updateBatchGradingProgress,
    endBatchGrading,
    getGradingRecord,
    handleStartGrading
  );
  
  // Handle file preview with dialog management
  const handleFilePreviewWithDialog = async (studentId: string, file: any, studentName: string) => {
    setDialogStudentName(studentName);
    setDialogFilename(file.filename);
    setDialogOpen(true);
    await handleFilePreview(studentId, file, studentName, selectedAssignment, (name, filename) => {
      setDialogStudentName(name);
      setDialogFilename(filename);
    });
  };
  
  // Enhanced dialog close that also clears preview
  const handleEnhancedDialogClose = () => {
    handleDialogClose();
    clearFilePreview();
  };
  
  // Handler for starting individual grading with submission selection
  const handleIndividualGrading = async (studentId: string) => {
    // When manually starting grading, also update the selected submission to view the grading
    if (!batchGradingActive && onSubmissionSelect) {
      onSubmissionSelect(studentId);
    }
    
    return handleStartGrading(studentId, studentFiles, loadStudentFiles);
  };




  // Helper function to render a student row
  const renderStudentRow = (data: StudentSubmissionData) => {
    const files = studentFiles[data.student.id] || [];
    const gradingRecord = selectedAssignment ? getGradingRecord(selectedAssignment, data.student.id) : null;
    const hasAIResults = Boolean(gradingRecord && gradingRecord.isAIGraded && gradingRecord.aiGradeResult);
    const isCurrentlyGrading = isStudentBeingGraded(data.student.id);

    return (
      <StudentRow
        key={data.student.id}
        data={data}
        selectedAssignment={selectedAssignment}
        files={files}
        gradingRecord={gradingRecord}
        hasAIResults={hasAIResults}
        isCurrentlyGrading={isCurrentlyGrading}
        batchGradingActive={batchGradingActive}
        onStartGrading={handleIndividualGrading}
        onClearGrading={clearGradingRecord}
        onFilePreview={handleFilePreviewWithDialog}
        onLoadStudentFiles={loadStudentFiles}
        onViewGradingDetail={onViewGradingDetail}
        onSubmitGradeDialogOpen={(studentData) => handleSubmitGradeDialogOpen(studentData, selectedAssignment, selectedAssignmentData)}
        onSetActiveGradingStudent={setActiveGradingStudent}
      />
    );
  };


  if (!selectedAssignment) {
    return (
      <Alert severity="info">
        {intl.formatMessage({ id: 'grading.assignment.selectAssignment' })}
      </Alert>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 500 }}>
          {intl.formatMessage({ id: 'grading.steps.studentSubmissions' })}
        </Typography>
        
        {/* Batch Grading Button */}
        {categorizedStudents.notGradedSubmitted.length > 0 && (
          <Button
            variant="contained"
            color="primary"
            onClick={() => handleBatchGrading(studentFiles, loadStudentFiles)}
            disabled={batchGradingActive || loading}
            startIcon={batchGradingActive ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />}
          >
            {batchGradingActive 
              ? intl.formatMessage({ id: 'grading.submissions.batchGrading.inProgress' }, { 
                  completed: batchGradingProgress.completed, 
                  total: batchGradingProgress.total 
                })
              : intl.formatMessage({ id: 'grading.submissions.batchGrading.start' }, { 
                  count: categorizedStudents.notGradedSubmitted.length 
                })
            }
          </Button>
        )}
      </Box>
      
      {/* Batch Grading Progress */}
      <BatchGradingProgress
        batchGradingActive={batchGradingActive}
        batchGradingProgress={batchGradingProgress}
      />
      
          {loading && <LinearProgress sx={{ mb: 2 }} />}
          
          {!loading && stats.submitted === 0 && stats.totalStudents > 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {intl.formatMessage({ id: 'grading.submissions.noSubmissions' })}
            </Alert>
          )}
          
      <TableContainer component={Paper} sx={{ mb: 2, height: 'calc(100vh - 300px)' }}>
        <Table size="small" stickyHeader sx={{ tableLayout: 'fixed' }}>
          <SubmissionsTableHeader />
          <TableBody>
            {/* Category 1: Ready to grade - Priority for grading */}
            <CategoryHeader
              title={intl.formatMessage({ id: 'grading.submissions.categories.readyToGrade' })}
              count={categorizedStudents.notGradedSubmitted.length}
              categoryKey="readyToGrade"
              isCollapsed={collapsedCategories.readyToGrade}
              onToggle={toggleCategoryCollapse}
            />
            {!collapsedCategories.readyToGrade && categorizedStudents.notGradedSubmitted.map(renderStudentRow)}

            {/* Category 2: Graded - Completed work */}
            <CategoryHeader
              title={intl.formatMessage({ id: 'grading.submissions.categories.graded' })}
              count={categorizedStudents.graded.length}
              categoryKey="graded"
              isCollapsed={collapsedCategories.graded}
              onToggle={toggleCategoryCollapse}
            />
            {!collapsedCategories.graded && categorizedStudents.graded.map(renderStudentRow)}

            {/* Category 3: Not Submitted - Waiting for submission */}
            <CategoryHeader
              title={intl.formatMessage({ id: 'grading.submissions.categories.notSubmitted' })}
              count={categorizedStudents.notGradedNotSubmitted.length}
              categoryKey="notSubmitted"
              isCollapsed={collapsedCategories.notSubmitted}
              onToggle={toggleCategoryCollapse}
            />
            {!collapsedCategories.notSubmitted && categorizedStudents.notGradedNotSubmitted.map(renderStudentRow)}
            
            {/* Ensure table maintains layout even when all categories are collapsed */}
            {Object.values(collapsedCategories).every(collapsed => collapsed) && (
              <TableRow sx={{ height: '100px' }}>
                <TableCell colSpan={7} sx={{ textAlign: 'center', color: 'text.secondary' }}>
                  <Typography variant="body2">
                    {intl.formatMessage({ id: 'grading.submissions.categories.allCategoriesCollapsed' })}
                    </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

                {/* Navigation Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-start', mt: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<ArrowBackIcon />}
                    onClick={onBack}
                  >
                    {intl.formatMessage({ id: 'grading.navigation.back' })}
                  </Button>
      </Box>

      {/* Document Preview Dialog */}
      <DocxDialog
        open={dialogOpen}
        onClose={handleEnhancedDialogClose}
        studentName={dialogStudentName}
        filename={dialogFilename}
        docxContent={previewDocxContent || docxContent}
        loading={previewFileLoading || fileLoading}
        error={previewFileError || fileError}
      />


      {/* Submit Grade Dialog */}
      <SubmitGradeDialog
        open={submitGradeDialogOpen}
        onClose={handleSubmitGradeDialogClose}
        selectedAssignment={submitGradeDialogData.assignment}
        selectedSubmission={submitGradeDialogData.submission}
        selectedAssignmentData={submitGradeDialogData.assignmentData}
        selectedSubmissionData={submitGradeDialogData.submissionData}
      />
    </Paper>
  );
};
