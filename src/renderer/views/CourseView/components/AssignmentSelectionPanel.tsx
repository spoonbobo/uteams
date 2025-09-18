import React, { useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Chip,
  Card,
  CardContent,
  LinearProgress,
  Alert,
  CircularProgress,
  Divider,
  Grid,
} from '@mui/material';
import { useAppStore } from '@/stores/useAppStore';
import {
  Assignment as AssignmentIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  CloudUpload as CloudUploadIcon,
  Description as DescriptionIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import type { MoodleAssignment } from '@/types/moodle';
import type { GradingStats, RubricContent } from '@/types/grading';
import { DocxPreview } from '@/components/DocxPreview/DocxPreview';
import { useIntl } from 'react-intl';

interface AssignmentSelectionPanelProps {
  assignments: MoodleAssignment[];
  selectedAssignment: string;
  selectedAssignmentData?: MoodleAssignment;
  stats: GradingStats;
  rubricFile: File | null;
  rubricContent: RubricContent | null;
  rubricLoading: boolean;
  rubricError: string | null;
  onAssignmentChange: (event: any) => void;
  onRubricFileChange: (file: File | null) => void;
  onLoadRubricContent: (file: File) => Promise<void>;
  onClearRubric: () => void;
  onBack?: () => void;
  onNext: () => void;
}

export const AssignmentSelectionPanel: React.FC<AssignmentSelectionPanelProps> = ({
  assignments,
  selectedAssignment,
  selectedAssignmentData,
  stats,
  rubricFile,
  rubricContent,
  rubricLoading,
  rubricError,
  onAssignmentChange,
  onRubricFileChange,
  onLoadRubricContent,
  onClearRubric,
  onBack,
  onNext,
}) => {
  const intl = useIntl();
  const { preferences } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.name.toLowerCase().endsWith('.docx')) {
        alert(intl.formatMessage({ id: 'grading.assignment.uploadRubric' }));
        return;
      }

      onRubricFileChange(file);
      onLoadRubricContent(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleClearRubric = () => {
    onRubricFileChange(null);
    onClearRubric();
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  return (
    <Paper
      sx={{
        p: 3,
        backgroundColor: preferences.transparentMode
          ? 'transparent'
          : 'background.paper',
        backdropFilter: preferences.transparentMode ? 'blur(10px)' : 'none',
        border: preferences.transparentMode ? 1 : 0,
        borderColor: preferences.transparentMode ? 'divider' : 'transparent',
      }}
    >
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 500, mb: 3 }}>
        {intl.formatMessage({ id: 'grading.steps.selectAssignment' })}: {intl.formatMessage({ id: 'grading.assignment.title' })}
      </Typography>

      <Grid container spacing={3}>
        {/* Assignment Selection Section */}
        <Grid item xs={12} md={6}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 500 }}>
            {intl.formatMessage({ id: 'grading.assignment.selectAssignment' })}
          </Typography>

          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel id="assignment-select-label">{intl.formatMessage({ id: 'grading.assignment.selectAssignment' })}</InputLabel>
            <Select
              labelId="assignment-select-label"
              value={
                selectedAssignment && assignments.some(a => a.id === selectedAssignment)
                  ? selectedAssignment
                  : ''
              }
              onChange={onAssignmentChange}
              label={intl.formatMessage({ id: 'grading.assignment.selectAssignment' })}
              renderValue={(selected) => {
                if (!selected) return '';
                const assignment = assignments.find(a => a.id === selected);
                if (!assignment) return '';
                return (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AssignmentIcon fontSize="small" />
                    <Typography noWrap>{assignment.name}</Typography>
                  </Box>
                );
              }}
            >
              {assignments.map((assignment) => (
                <MenuItem key={assignment.id} value={assignment.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                    <AssignmentIcon fontSize="small" color="action" />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" noWrap>{assignment.name}</Typography>
                      {assignment.duedate && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {intl.formatMessage({ id: 'common.due' })}: {new Date(assignment.duedate * 1000).toLocaleDateString()}
                        </Typography>
                      )}
                    </Box>
                    {assignment.grade && (
                      <Chip
                        label={`${intl.formatMessage({ id: 'common.max' })}: ${assignment.grade}`}
                        size="small"
                        variant="outlined"
                        sx={{ ml: 'auto', flexShrink: 0 }}
                      />
                    )}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {selectedAssignmentData && (
            <Card
              sx={{
                backgroundColor: preferences.transparentMode
                  ? 'rgba(255, 255, 255, 0.05)'
                  : 'action.hover',
                backdropFilter: preferences.transparentMode ? 'blur(5px)' : 'none',
              }}
            >
              <CardContent>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                  {selectedAssignmentData.name}
                </Typography>
                {selectedAssignmentData.duedate && (
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {intl.formatMessage({ id: 'common.due' })}: {new Date(selectedAssignmentData.duedate * 1000).toLocaleDateString()}
                  </Typography>
                )}
                {(stats.totalStudents > 0 || stats.submitted > 0 || stats.graded > 0) && (
                  <Box sx={{ mt: 2 }}>
                    {stats.totalStudents > 0 ? (
                      <>
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="caption" color="text.secondary">
                            {intl.formatMessage({ id: 'grading.assignment.submissions' })}: {stats.submitted}/{stats.totalStudents}
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={stats.totalStudents > 0 ? (stats.submitted / stats.totalStudents) * 100 : 0}
                            sx={{ height: 6, borderRadius: 3, mt: 0.5 }}
                          />
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {intl.formatMessage({ id: 'grading.assignment.graded' })}: {stats.published}/{stats.totalStudents}
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={stats.totalStudents > 0 ? (stats.published / stats.totalStudents) * 100 : 0}
                            sx={{ height: 6, borderRadius: 3, mt: 0.5 }}
                            color="success"
                          />
                        </Box>
                      </>
                    ) : (
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {stats.submitted > 0 && `${intl.formatMessage({ id: 'grading.assignment.submissionsFound' })}: ${stats.submitted}`}
                          {stats.submitted > 0 && stats.graded > 0 && ' • '}
                          {stats.graded > 0 && `${intl.formatMessage({ id: 'grading.assignment.gradesFound' })}: ${stats.graded}`}
                          {stats.submitted === 0 && stats.graded === 0 && intl.formatMessage({ id: 'grading.assignment.loadingSubmissionData' })}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Rubric Section */}
        <Grid item xs={12} md={6}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 500 }}>
            {intl.formatMessage({ id: 'grading.assignment.markingRubricOptional' })}
          </Typography>

          {!rubricFile && !rubricContent ? (
            <Card
              sx={{
                border: '2px dashed',
                borderColor: 'divider',
                backgroundColor: preferences.transparentMode
                  ? 'rgba(255, 255, 255, 0.02)'
                  : 'background.default',
                backdropFilter: preferences.transparentMode ? 'blur(5px)' : 'none',
              }}
            >
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".docx"
                  style={{ display: 'none' }}
                />

                <CloudUploadIcon
                  sx={{
                    fontSize: 40,
                    color: 'text.secondary',
                    mb: 1
                  }}
                />

                <Typography variant="subtitle2" gutterBottom>
                  {intl.formatMessage({ id: 'grading.assignment.uploadMarkingRubric' })}
                </Typography>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {intl.formatMessage({ id: 'grading.assignment.addDocxFile' })}
                </Typography>

                <Button
                  variant="outlined"
                  startIcon={<CloudUploadIcon />}
                  onClick={handleUploadClick}
                  disabled={rubricLoading}
                  size="small"
                >
                  {intl.formatMessage({ id: 'grading.assignment.chooseDocxFile' })}
                </Button>

                <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
                  {intl.formatMessage({ id: 'grading.assignment.optionalHelps' })}
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <DescriptionIcon color="primary" />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {rubricFile?.name || rubricContent?.filename || 'Rubric File'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {rubricFile ? formatFileSize(rubricFile.size) : (rubricContent ? 'Loaded from storage' : 'Unknown size')}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    startIcon={<DeleteIcon />}
                    onClick={handleClearRubric}
                    color="error"
                    disabled={rubricLoading}
                  >
                    {intl.formatMessage({ id: 'grading.assignment.remove' })}
                  </Button>
                </Box>

                {rubricLoading && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <CircularProgress size={16} />
                    <Typography variant="body2" color="text.secondary">
                      {intl.formatMessage({ id: 'grading.assignment.processingRubric' })}
                    </Typography>
                  </Box>
                )}

                {rubricError && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {rubricError}
                  </Alert>
                )}

                {rubricContent && !rubricLoading && (() => {
                  // Debug logging
                  // console.log('[AssignmentPanel] Rubric Content:', {
                  //   text: rubricContent.text.substring(0, 200) + '...',
                  //   html: rubricContent.html ? rubricContent.html.substring(0, 500) + '...' : 'No HTML',
                  //   wordCount: rubricContent.wordCount,
                  //   characterCount: rubricContent.characterCount,
                  //   hasHtml: !!rubricContent.html,
                  //   htmlLength: rubricContent.html?.length || 0,
                  //   elementCounts: rubricContent.elementCounts || 'No element counts'
                  // });

                  return (
                    <>
                      <Alert severity="success" sx={{ mb: 2 }}>
                        {intl.formatMessage({ id: 'grading.assignment.rubricLoadedSuccessfully' })} {rubricContent.wordCount} {intl.formatMessage({ id: 'grading.assignment.wordsParsed' })}.
                      </Alert>

                    <DocxPreview
                      content={{
                        text: rubricContent.text,
                        html: rubricContent.html || '',
                        wordCount: rubricContent.wordCount,
                        characterCount: rubricContent.characterCount,
                        filename: rubricFile?.name || 'Rubric',
                        elementCounts: rubricContent.elementCounts
                      }}
                      variant="full"
                      showStats={true}
                      showHoverPreview={false}
                      showDebugInfo={true}
                      maxPreviewLength={300}
                    />
                  </>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Navigation */}
      <Divider sx={{ my: 3 }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        {onBack ? (
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={onBack}
          >
            {intl.formatMessage({ id: 'common.back' })}
          </Button>
        ) : (
          <div />
        )}
        <Button
          variant="contained"
          endIcon={<ArrowForwardIcon />}
          onClick={onNext}
          disabled={!selectedAssignment}
        >
          {intl.formatMessage({ id: 'common.next' })}: {intl.formatMessage({ id: 'grading.steps.studentSubmissions' })}
        </Button>
      </Box>
    </Paper>
  );
};
