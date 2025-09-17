import React from 'react';
import {
  Box,
  Typography,
  TableRow,
  TableCell,
  IconButton,
  Checkbox,
  Button,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  PlayArrow as PlayArrowIcon,
  Send as SendIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { useIntl } from 'react-intl';
import type { CategoryKey } from './types';
import type { StudentSubmissionData } from '../../../../types/grading';

interface CategoryHeaderProps {
  title: string;
  count: number;
  categoryKey: CategoryKey;
  isCollapsed: boolean;
  onToggle: (category: CategoryKey) => void;
  students: StudentSubmissionData[];
  selectedStudentIds: Set<string>;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBatchStartGrading?: () => void;
  onBatchClearGrading?: () => void;
  onBatchSubmitGrades?: () => void;
  isBatchGrading?: boolean;
  showGradingActions?: boolean;
  showSubmitAction?: boolean;
}

export const CategoryHeader: React.FC<CategoryHeaderProps> = ({
  title,
  count,
  categoryKey,
  isCollapsed,
  onToggle,
  students,
  selectedStudentIds,
  onSelectAll,
  onDeselectAll,
  onBatchStartGrading,
  onBatchClearGrading,
  onBatchSubmitGrades,
  isBatchGrading = false,
  showGradingActions = false,
  showSubmitAction = false,
}) => {
  const intl = useIntl();
  
  if (count === 0) return null;

  const categoryStudentIds = students.map(s => s.student.id);
  const selectedInCategory = categoryStudentIds.filter(id => selectedStudentIds.has(id));
  const isAllSelected = selectedInCategory.length === categoryStudentIds.length && categoryStudentIds.length > 0;
  const isIndeterminate = selectedInCategory.length > 0 && selectedInCategory.length < categoryStudentIds.length;

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAllSelected) {
      onDeselectAll();
    } else {
      onSelectAll();
    }
  };

  const handleActionClick = (e: React.MouseEvent, action?: () => void) => {
    e.stopPropagation();
    action?.();
  };

  return (
    <TableRow>
      <TableCell 
        colSpan={8} 
        sx={{ 
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50',
          borderTop: '1px solid',
          borderTopColor: 'divider',
          py: 1,
          position: 'sticky',
        }}
      >
        <Box sx={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Checkbox for select all */}
            <Checkbox
              checked={isAllSelected}
              indeterminate={isIndeterminate}
              onClick={handleCheckboxClick}
              size="small"
              disabled={isCollapsed}
            />
            
            {/* Expand/Collapse button and title */}
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1, 
                cursor: 'pointer',
                '&:hover': {
                  opacity: 0.8
                }
              }}
              onClick={() => onToggle(categoryKey)}
            >
              <IconButton size="small" sx={{ p: 0 }}>
                {isCollapsed ? <ChevronRightIcon /> : <ExpandMoreIcon />}
              </IconButton>
              <Typography variant="subtitle2" sx={{ 
                fontWeight: 500, 
                color: 'text.primary'
              }}>
                {title} ({count})
              </Typography>
            </Box>

            {/* Selected count */}
            {selectedInCategory.length > 0 && (
              <Typography variant="caption" sx={{ color: 'primary.main', ml: 1 }}>
                ({selectedInCategory.length} {intl.formatMessage({ id: 'common.selected' })})
              </Typography>
            )}
          </Box>

          {/* Batch action buttons */}
          {!isCollapsed && selectedInCategory.length > 0 && (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {/* Batch Start Grading - For "Ready to Grade" category */}
              {showGradingActions && onBatchStartGrading && categoryKey === 'readyToGrade' && (
                <Tooltip title={intl.formatMessage({ id: 'grading.submissions.batch.startGrading' }, { count: selectedInCategory.length })}>
                  <Button
                    size="small"
                    variant="outlined"
                    color="primary"
                    startIcon={isBatchGrading ? <CircularProgress size={16} /> : <PlayArrowIcon />}
                    onClick={(e) => handleActionClick(e, onBatchStartGrading)}
                    disabled={isBatchGrading}
                  >
                    {intl.formatMessage({ id: 'grading.submissions.batch.grade' })} ({selectedInCategory.length})
                  </Button>
                </Tooltip>
              )}

              {/* Batch Re-grade - For "Graded" category */}
              {showGradingActions && onBatchStartGrading && categoryKey === 'graded' && (
                <Tooltip title={intl.formatMessage({ id: 'grading.submissions.batch.regrading' }, { count: selectedInCategory.length })}>
                  <Button
                    size="small"
                    variant="outlined"
                    color="primary"
                    startIcon={isBatchGrading ? <CircularProgress size={16} /> : <PlayArrowIcon />}
                    onClick={(e) => handleActionClick(e, onBatchStartGrading)}
                    disabled={isBatchGrading}
                  >
                    {intl.formatMessage({ id: 'grading.submissions.batch.regrade' })} ({selectedInCategory.length})
                  </Button>
                </Tooltip>
              )}

              {/* Batch Clear Grading */}
              {showGradingActions && onBatchClearGrading && categoryKey === 'graded' && (
                <Tooltip title={intl.formatMessage({ id: 'grading.submissions.batch.clearGrading' }, { count: selectedInCategory.length })}>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<ClearIcon />}
                    onClick={(e) => handleActionClick(e, onBatchClearGrading)}
                  >
                    {intl.formatMessage({ id: 'grading.submissions.batch.clear' })} ({selectedInCategory.length})
                  </Button>
                </Tooltip>
              )}

              {/* Batch Submit Grades */}
              {showSubmitAction && onBatchSubmitGrades && categoryKey === 'graded' && (
                <Tooltip title={intl.formatMessage({ id: 'grading.submissions.batch.submitGrades' }, { count: selectedInCategory.length })}>
                  <Button
                    size="small"
                    variant="contained"
                    color="secondary"
                    startIcon={<SendIcon />}
                    onClick={(e) => handleActionClick(e, onBatchSubmitGrades)}
                  >
                    {intl.formatMessage({ id: 'grading.submissions.batch.submit' })} ({selectedInCategory.length})
                  </Button>
                </Tooltip>
              )}
            </Box>
          )}
        </Box>
      </TableCell>
    </TableRow>
  );
};
