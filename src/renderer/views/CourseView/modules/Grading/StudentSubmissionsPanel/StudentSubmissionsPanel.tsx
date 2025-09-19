import React, { useEffect, useState } from 'react';
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
  Tooltip,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';
import DocxDialog from '@/components/DocxPreview/DocxDialog';
import { SubmitGradeDialog } from './SubmitGradeDialog';
import { useIntl } from 'react-intl';

// Import decomposed components
import SubmissionsTableHeader from './SubmissionsTableHeader';
import { CategoryHeader } from './CategoryHeader';
import { StudentRow } from './StudentRow';
import useFilePreviewHandler from './FilePreviewHandler';
import {
  useSubmissionFiles,
  useStudentFiles,
  useDialogStates,
  useCollapsibleCategories,
  useGradingActions,
  useStudentSelection,
} from './hooks';
import { categorizeStudents } from './utils';
import type { StudentSubmissionsPanelProps } from './types';
import type { StudentSubmissionData } from '@/types/grading';



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
    isStudentBeingGraded,
    clearAllGradingProgress,
    setActiveGradingStudent,
    handleStartGrading,
    abortGrading
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
    setSubmitGradeDialogOpen,
    submitGradeDialogData,
    setSubmitGradeDialogData,
    handleDialogClose,
    handleSubmitGradeDialogOpen,
    handleSubmitGradeDialogClose
  } = useDialogStates();
  const { collapsedCategories, toggleCategoryCollapse } = useCollapsibleCategories();
  const {
    selectedStudents,
    toggleStudentSelection,
    selectAllInCategory,
    deselectAllInCategory,
    clearSelection,
    isStudentSelected,
    getSelectedStudentIds,
  } = useStudentSelection();
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

  // Get categorized students
  const categorizedStudents = categorizeStudents(studentData);
  const [isBatchGrading, setIsBatchGrading] = useState(false);

  // Handle file preview with dialog management
  const handleFilePreviewWithDialog = async (studentId: string, file: any, studentName: string) => {
    setDialogStudentName(studentName);
    setDialogFilename(file.filename);
    setDialogOpen(true);
    await handleFilePreview(studentId, file, studentName, selectedAssignment, (name: string, filename: string) => {
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
    if (onSubmissionSelect) {
      onSubmissionSelect(studentId);
    }

    return handleStartGrading(studentId, studentFiles, loadStudentFiles);
  };




  // Batch action handlers
  const handleBatchStartGrading = async (studentIds: string[]) => {
    setIsBatchGrading(true);

    // Process students concurrently with a small delay between each to simulate rapid clicking
    const promises = studentIds.map((studentId, index) =>
      new Promise(async (resolve) => {
        // Add a small delay between starting each grading (100ms * index)
        // This simulates clicking on each student rapidly but not all at exact same time
        await new Promise(delay => setTimeout(delay, index * 100));

        try {
          await handleStartGrading(studentId, studentFiles, loadStudentFiles);
          resolve({ success: true, studentId });
        } catch (error: any) {
          // Check if it's an abort error
          if (error.message?.includes('abort') || error.message?.includes('Grading aborted')) {
            console.log(`Grading aborted for student ${studentId}`);
            resolve({ success: false, studentId, aborted: true });
          } else {
            console.error(`Failed to grade student ${studentId}:`, error);
            resolve({ success: false, studentId, error });
          }
        }
      })
    );

    // Wait for all grading operations to complete
    const results = await Promise.all(promises);
    const abortedCount = results.filter((r: any) => r.aborted).length;
    const successCount = results.filter((r: any) => r.success).length;
    console.log(`Batch grading completed: ${successCount} successful, ${abortedCount} aborted`);

    setIsBatchGrading(false);
    clearSelection();
  };

  const handleBatchClearGrading = (studentIds: string[]) => {
    // Clear grading for each selected student
    studentIds.forEach(studentId => {
      clearGradingRecord(selectedAssignment, studentId);
    });
    clearSelection();
  };

  const handleBatchSubmitGrades = async (studentIds: string[]) => {
    // Get data for all selected students
    const selectedStudentsData = studentIds
      .map(id => studentData.find(s => s.student.id === id))
      .filter(Boolean) as StudentSubmissionData[];

    // Open batch submit dialog
    setSubmitGradeDialogData({
      assignment: selectedAssignment,
      submission: '', // Not used in batch mode
      submissions: studentIds, // Batch mode
      assignmentData: selectedAssignmentData,
      submissionData: undefined, // Not used in batch mode
      submissionsData: selectedStudentsData, // Batch mode
    });
    setSubmitGradeDialogOpen(true);

    clearSelection();
  };

  // Helper function to render a student row
  const renderStudentRow = (data: StudentSubmissionData) => {
    const files = studentFiles[data.student.id] || [];
    const gradingRecord = selectedAssignment ? getGradingRecord(selectedAssignment, data.student.id) : null;
    const hasAIResults = Boolean(gradingRecord && gradingRecord.isAIGraded && gradingRecord.aiGradeResult);
    const isCurrentlyGrading = isStudentBeingGraded(data.student.id);
    const isSelected = isStudentSelected(data.student.id);

    return (
      <StudentRow
        key={data.student.id}
        data={data}
        selectedAssignment={selectedAssignment}
        files={files}
        gradingRecord={gradingRecord}
        hasAIResults={hasAIResults}
        isCurrentlyGrading={isCurrentlyGrading}
        isSelected={isSelected}
        onToggleSelection={toggleStudentSelection}
        onStartGrading={handleIndividualGrading}
        onClearGrading={clearGradingRecord}
        onAbortGrading={abortGrading}
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
    <Paper
      sx={{
        p: 3,
        backgroundColor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 500 }}>
          {intl.formatMessage({ id: 'grading.steps.studentSubmissions' })}
        </Typography>

        {/* Batch Grade All Button - Only for ungraded students */}
        {categorizedStudents.notGradedSubmitted.length > 0 && (
          <Tooltip title={intl.formatMessage({ id: 'grading.submissions.batch.gradeAllTooltip' }, { count: categorizedStudents.notGradedSubmitted.length })}>
            <span>
              <Button
                variant="contained"
                color="primary"
                onClick={() => handleBatchStartGrading(categorizedStudents.notGradedSubmitted.map(s => s.student.id))}
                disabled={isBatchGrading}
                startIcon={isBatchGrading ? <CircularProgress size={16} /> : <PlayArrowIcon />}
                size="large"
              >
                {isBatchGrading
                  ? intl.formatMessage({ id: 'grading.submissions.batch.gradingInProgress' })
                  : intl.formatMessage({ id: 'grading.submissions.batch.gradeAll' }, { count: categorizedStudents.notGradedSubmitted.length })
                }
              </Button>
            </span>
          </Tooltip>
        )}
      </Box>

          {loading && <LinearProgress sx={{ mb: 2 }} />}

          {!loading && stats.submitted === 0 && stats.totalStudents > 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {intl.formatMessage({ id: 'grading.submissions.noSubmissions' })}
            </Alert>
          )}

      <TableContainer
        component={Paper}
        sx={{
          mb: 2,
          height: 'calc(100vh - 300px)',
          backgroundColor: 'background.paper',
        }}
      >
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
              students={categorizedStudents.notGradedSubmitted}
              selectedStudentIds={selectedStudents}
              onSelectAll={() => selectAllInCategory(categorizedStudents.notGradedSubmitted.map(s => s.student.id))}
              onDeselectAll={() => deselectAllInCategory(categorizedStudents.notGradedSubmitted.map(s => s.student.id))}
              onBatchStartGrading={() => {
                const selectedInCategory = categorizedStudents.notGradedSubmitted
                  .filter(s => isStudentSelected(s.student.id))
                  .map(s => s.student.id);
                handleBatchStartGrading(selectedInCategory);
              }}
              isBatchGrading={isBatchGrading}
              showGradingActions={true}
            />
            {!collapsedCategories.readyToGrade && categorizedStudents.notGradedSubmitted.map(renderStudentRow)}

            {/* Category 2: Graded - Completed work */}
            <CategoryHeader
              title={intl.formatMessage({ id: 'grading.submissions.categories.graded' })}
              count={categorizedStudents.graded.length}
              categoryKey="graded"
              isCollapsed={collapsedCategories.graded}
              onToggle={toggleCategoryCollapse}
              students={categorizedStudents.graded}
              selectedStudentIds={selectedStudents}
              onSelectAll={() => selectAllInCategory(categorizedStudents.graded.map(s => s.student.id))}
              onDeselectAll={() => deselectAllInCategory(categorizedStudents.graded.map(s => s.student.id))}
              onBatchStartGrading={() => {
                const selectedInCategory = categorizedStudents.graded
                  .filter(s => isStudentSelected(s.student.id))
                  .map(s => s.student.id);
                handleBatchStartGrading(selectedInCategory);
              }}
              onBatchClearGrading={() => {
                const selectedInCategory = categorizedStudents.graded
                  .filter(s => isStudentSelected(s.student.id))
                  .map(s => s.student.id);
                handleBatchClearGrading(selectedInCategory);
              }}
              onBatchSubmitGrades={() => {
                const selectedInCategory = categorizedStudents.graded
                  .filter(s => isStudentSelected(s.student.id))
                  .map(s => s.student.id);
                handleBatchSubmitGrades(selectedInCategory);
              }}
              isBatchGrading={isBatchGrading}
              showGradingActions={true}
              showSubmitAction={true}
            />
            {!collapsedCategories.graded && categorizedStudents.graded.map(renderStudentRow)}

            {/* Category 3: Not Submitted - Waiting for submission */}
            <CategoryHeader
              title={intl.formatMessage({ id: 'grading.submissions.categories.notSubmitted' })}
              count={categorizedStudents.notGradedNotSubmitted.length}
              categoryKey="notSubmitted"
              isCollapsed={collapsedCategories.notSubmitted}
              onToggle={toggleCategoryCollapse}
              students={categorizedStudents.notGradedNotSubmitted}
              selectedStudentIds={selectedStudents}
              onSelectAll={() => selectAllInCategory(categorizedStudents.notGradedNotSubmitted.map(s => s.student.id))}
              onDeselectAll={() => deselectAllInCategory(categorizedStudents.notGradedNotSubmitted.map(s => s.student.id))}
            />
            {!collapsedCategories.notSubmitted && categorizedStudents.notGradedNotSubmitted.map(renderStudentRow)}

            {/* Ensure table maintains layout even when all categories are collapsed */}
            {Object.values(collapsedCategories).every(collapsed => collapsed) && (
              <TableRow sx={{ height: '100px' }}>
                <TableCell colSpan={8} sx={{ textAlign: 'center', color: 'text.secondary' }}>
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
        selectedSubmissions={submitGradeDialogData.submissions}
        selectedAssignmentData={submitGradeDialogData.assignmentData}
        selectedSubmissionData={submitGradeDialogData.submissionData}
        selectedSubmissionsData={submitGradeDialogData.submissionsData}
      />
    </Paper>
  );
};
