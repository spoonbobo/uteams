import React from 'react';
import {
  Box,
  Typography,
  TableRow,
  TableCell,
  Chip,
  Avatar,
  CircularProgress,
  IconButton,
  Tooltip,
  Checkbox,
} from '@mui/material';
import {
  Description as DescriptionIcon,
  Send as SendIcon,
  Stop as StopIcon,
} from '@mui/icons-material';
import { useIntl } from 'react-intl';
import type { StudentSubmissionData } from '@/types/grading';
import type { SubmissionFile } from './types';
import { getSubmissionStatus, getGradeStatus, getInitials, getAvatarColor } from './utils';

interface StudentRowProps {
  data: StudentSubmissionData;
  selectedAssignment: string;
  files: SubmissionFile[];
  gradingRecord: any;
  hasAIResults: boolean;
  isCurrentlyGrading: boolean;
  isSelected: boolean;
  onToggleSelection: (studentId: string) => void;
  onStartGrading: (studentId: string) => void;
  onClearGrading: (assignmentId: string, studentId: string) => void;
  onAbortGrading: (studentId: string) => void;
  onFilePreview: (studentId: string, file: SubmissionFile, studentName: string) => Promise<void>;
  onLoadStudentFiles: (studentId: string) => Promise<SubmissionFile[]>;
  onViewGradingDetail?: (studentId: string) => void;
  onSubmitGradeDialogOpen: (studentData: StudentSubmissionData) => void;
  onSetActiveGradingStudent: (studentId: string | null) => void;
}

export const StudentRow: React.FC<StudentRowProps> = ({
  data,
  selectedAssignment,
  files,
  gradingRecord,
  hasAIResults,
  isCurrentlyGrading,
  isSelected,
  onToggleSelection,
  onStartGrading,
  onClearGrading,
  onAbortGrading,
  onFilePreview,
  onLoadStudentFiles,
  onViewGradingDetail,
  onSubmitGradeDialogOpen,
  onSetActiveGradingStudent,
}) => {
  const intl = useIntl();
  const submissionStatus = getSubmissionStatus(data);
  const gradeStatus = getGradeStatus(data);
  const hasSubmission = data.submission && data.submission.status === 'submitted';
  const docxFile = files.find((f: SubmissionFile) =>
    f.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    f.filename.toLowerCase().endsWith('.docx')
  );

  return (
    <TableRow
      key={data.student.id}
      sx={{
        opacity: hasSubmission ? 1 : 0.6,
        backgroundColor: isSelected ? 'action.selected' : 'inherit',
        '&:hover': {
          backgroundColor: 'action.hover',
        },
      }}
    >
      {/* Checkbox Column */}
      <TableCell padding="checkbox">
        <Checkbox
          checked={isSelected}
          onChange={() => onToggleSelection(data.student.id)}
          size="small"
        />
      </TableCell>

      {/* Student Column */}
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar
            sx={{
              bgcolor: getAvatarColor(data.student.fullname),
              width: 32,
              height: 32,
              fontSize: '0.8rem',
            }}
          >
            {getInitials(data.student.fullname)}
          </Avatar>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {data.student.fullname}
          </Typography>
        </Box>
      </TableCell>

      {/* Graded Status Column */}
      <TableCell align="center">
        <Chip
          label={gradeStatus.label}
          color={gradeStatus.color}
          size="small"
          variant="outlined"
        />
      </TableCell>

      {/* Submit Status Column */}
      <TableCell align="center">
        <Chip
          label={submissionStatus.label}
          color={submissionStatus.color}
          size="small"
          variant="outlined"
        />
      </TableCell>

      {/* Submission File Column */}
      <TableCell align="center">
        {hasSubmission ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {docxFile ? (
                <Tooltip title={intl.formatMessage({ id: 'grading.submissions.actions.previewDocument' }, { filename: docxFile.filename })}>
                  <IconButton
                    size="small"
                    onClick={async () => {
                      if (!files.length) {
                        const loadedFiles = await onLoadStudentFiles(data.student.id);
                        const loadedDocxFile = loadedFiles.find((f: SubmissionFile) =>
                          f.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                          f.filename.toLowerCase().endsWith('.docx')
                        );
                        if (loadedDocxFile) {
                          await onFilePreview(data.student.id, loadedDocxFile, data.student.fullname);
                        }
                      } else {
                        await onFilePreview(data.student.id, docxFile, data.student.fullname);
                      }
                    }}
                    color="primary"
                  >
                    <DescriptionIcon />
                  </IconButton>
                </Tooltip>
              ) : (
                <IconButton
                  size="small"
                  onClick={() => onLoadStudentFiles(data.student.id)}
                  disabled={!hasSubmission}
                >
                  <DescriptionIcon />
                </IconButton>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', fontSize: '0.7rem' }}>
              {files.length > 0 ? (
                docxFile ? docxFile.filename : intl.formatMessage({ id: 'grading.submissions.submissionFiles' }, { count: files.length })
              ) : intl.formatMessage({ id: 'grading.submissions.actions.loadFiles' })}
            </Typography>
          </Box>
        ) : (
          <Typography variant="caption" color="text.disabled">
            {intl.formatMessage({ id: 'grading.submissions.actions.noSubmission' })}
          </Typography>
        )}
      </TableCell>

      {/* Autograde Column */}
      <TableCell align="center">
        {hasSubmission ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
            {/* Start Grading */}
            <Typography
              variant="caption"
              sx={{
                color: (hasAIResults || isCurrentlyGrading) ? 'text.disabled' : 'primary.main',
                cursor: (hasAIResults || isCurrentlyGrading) ? 'not-allowed' : 'pointer',
                textDecoration: (hasAIResults || isCurrentlyGrading) ? 'none' : 'underline',
                fontWeight: 500,
                '&:hover': (hasAIResults || isCurrentlyGrading) ? {} : {
                  color: 'primary.dark'
                }
              }}
              onClick={(hasAIResults || isCurrentlyGrading) ? undefined : () => onStartGrading(data.student.id)}
            >
              {intl.formatMessage({ id: 'grading.submissions.actions.startGrading' })}
            </Typography>

            {/* Clear Grading - only show if there are AI results */}
            {hasAIResults && (
              <Typography
                variant="caption"
                sx={{
                  color: 'error.main',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontWeight: 500,
                  '&:hover': {
                    color: 'error.dark'
                  }
                }}
                onClick={() => {
                  console.log('🧹 Clearing grading record for student:', data.student.fullname, 'Assignment:', selectedAssignment);
                  onClearGrading(selectedAssignment, data.student.id);
                  console.log('✅ Clear grading record called');
                }}
              >
                {intl.formatMessage({ id: 'grading.submissions.actions.clearGrading' })}
              </Typography>
            )}
          </Box>
        ) : (
          <Typography variant="caption" color="text.disabled">
            -
          </Typography>
        )}
      </TableCell>

      {/* Autograde Result Column */}
      <TableCell align="center" sx={{
        borderLeft: '3px solid',
        borderLeftColor: gradingRecord?.hasError ? 'error.main' : 'primary.main',
        borderRight: '3px solid',
        borderRightColor: gradingRecord?.hasError ? 'error.main' : 'primary.main'
      }}>
        {isCurrentlyGrading ? (
          /* Show spinner during grading with view detail link and stop button */
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={20} />
              <Typography variant="caption" color="text.secondary">
                {intl.formatMessage({ id: 'grading.submissions.grading' })}
              </Typography>
              <Tooltip title={intl.formatMessage({ id: 'grading.submissions.actions.stopGrading' })}>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => onAbortGrading(data.student.id)}
                  sx={{ padding: 0.5 }}
                >
                  <StopIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Typography
              variant="caption"
              sx={{
                color: 'primary.main',
                cursor: 'pointer',
                textDecoration: 'underline',
                '&:hover': {
                  color: 'primary.dark'
                }
              }}
              onClick={() => {
                if (onViewGradingDetail) {
                  // When viewing during grading, ensure this student's plan is shown
                  if (isCurrentlyGrading) {
                    onSetActiveGradingStudent(data.student.id);
                  }
                  onViewGradingDetail(data.student.id);
                }
              }}
            >
              {intl.formatMessage({ id: 'grading.submissions.actions.viewDetail' })}
            </Typography>
          </Box>
        ) : gradingRecord?.hasError ? (
          /* Show error state with error message tooltip */
          <Tooltip
            title={gradingRecord.errorMessage || 'An error occurred during grading'}
            arrow
            placement="top"
          >
            <Typography
              variant="caption"
              sx={{
                color: 'error.main',
                fontWeight: 600,
                cursor: 'help',
                textAlign: 'center'
              }}
            >
              Error
              {gradingRecord.errorType && (
                <Typography variant="caption" sx={{ display: 'block', fontSize: '0.6rem', opacity: 0.8 }}>
                  ({gradingRecord.errorType})
                </Typography>
              )}
            </Typography>
          </Tooltip>
        ) : hasAIResults && gradingRecord?.aiGradeResult ? (
          /* Score with hover feedback and view detail text */
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            {/* Score with hover feedback */}
            <Tooltip title={gradingRecord.aiGradeResult.feedback} arrow>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  color: 'primary.main',
                  cursor: 'help'
                }}
              >
                {gradingRecord.aiGradeResult.grade}
              </Typography>
            </Tooltip>

            {/* View detail text */}
            <Typography
              variant="caption"
              sx={{
                color: 'primary.main',
                cursor: 'pointer',
                textDecoration: 'underline',
                '&:hover': {
                  color: 'primary.dark'
                }
              }}
              onClick={() => {
                if (onViewGradingDetail) {
                  // Clear active grading student when viewing completed results
                  onSetActiveGradingStudent(null);
                  onViewGradingDetail(data.student.id);
                }
              }}
            >
              {intl.formatMessage({ id: 'grading.submissions.actions.viewDetail' })}
            </Typography>
          </Box>
        ) : (
          /* No AI results yet - just show dash */
          <Typography variant="caption" color="text.disabled">
            -
          </Typography>
        )}
      </TableCell>

      {/* Submit Grade Column */}
      <TableCell align="center">
        {hasSubmission && hasAIResults ? (
          <Tooltip title={intl.formatMessage({ id: 'grading.submissions.actions.submitToMoodle' })}>
            <IconButton
              size="small"
              color="secondary"
              onClick={() => onSubmitGradeDialogOpen(data)}
            >
              <SendIcon />
            </IconButton>
          </Tooltip>
        ) : (
          <Typography variant="caption" color="text.disabled">
            -
          </Typography>
        )}
      </TableCell>
    </TableRow>
  );
};
