import React, { useState, useEffect } from 'react';
import { Typography, Box, Paper, Button, TextField, Chip, Stack, Radio, RadioGroup, FormControlLabel, FormControl, FormLabel, CircularProgress, IconButton, Tooltip } from '@mui/material';
import { useIntl } from 'react-intl';
import { HTabPanel } from '@/components/HTabsPanel';
import type { CourseSessionContext } from '@/stores/useContextStore';
import { useMoodleStore } from '@/stores/useMoodleStore';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SchoolIcon from '@mui/icons-material/School';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AddIcon from '@mui/icons-material/Add';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DescriptionIcon from '@mui/icons-material/Description';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { PDFDialog } from '@/components/PDFPreview';

interface SelectProps {
  sessionContext: CourseSessionContext;
  selectedCoursework: string[];
  onCourseworkToggle: (assignmentId: string) => void;
  examType: string;
  onExamTypeChange: (type: string) => void;
  examInstructions: string;
  onExamInstructionsChange: (instructions: string) => void;
  onProceedToGenerate: () => void;
  isGenerating: boolean;
}

function Select({
  sessionContext,
  selectedCoursework,
  onCourseworkToggle,
  examType,
  onExamTypeChange,
  examInstructions,
  onExamInstructionsChange,
  onProceedToGenerate,
  isGenerating,
}: SelectProps) {
  const intl = useIntl();
  const { getCourseContent } = useMoodleStore();
  const [generationType, setGenerationType] = useState('current');
  const [assignmentAttachments, setAssignmentAttachments] = useState<Record<string, any[]>>({});
  const [loadingAttachments, setLoadingAttachments] = useState<Record<string, boolean>>({});
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [selectedPdfPath, setSelectedPdfPath] = useState<string>('');
  const [selectedPdfFilename, setSelectedPdfFilename] = useState<string>('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const sessionId = sessionContext.sessionId;
  const courseContent = getCourseContent(sessionId);

  const handleGenerationTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setGenerationType(event.target.value);
  };

  // Check if a file is a PDF
  const isPdfFile = (filename: string, mimetype?: string): boolean => {
    const filenameLower = filename.toLowerCase();
    return filenameLower.endsWith('.pdf') || mimetype === 'application/pdf';
  };

  // Handle PDF preview - download PDF first then preview
  const handlePdfPreview = async (attachment: any) => {
    if (!attachment.fileurl || !attachment.filename) {
      console.error('PDF attachment missing required fields');
      return;
    }

    setPdfLoading(true);
    setPdfError(null);

    try {
      // Get Moodle config for API key
      const { config } = useMoodleStore.getState();
      if (!config.apiKey) {
        throw new Error('No Moodle API key available');
      }

      // Prepare download URL with token
      let downloadUrl = attachment.fileurl;
      if (downloadUrl && !downloadUrl.includes('token=')) {
        const separator = downloadUrl.includes('?') ? '&' : '?';
        downloadUrl = `${downloadUrl}${separator}token=${config.apiKey}`;
      }

      // Create unique filename for temp storage
      const uniqueFilename = `pdf_preview_${sessionId}_${attachment.filename}`;

      console.log('📄 Downloading PDF for preview:', attachment.filename);

      // Download PDF to temp directory
      const downloadResult = await window.electron.ipcRenderer.invoke('fileio:download-file', {
        url: downloadUrl,
        filename: uniqueFilename,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MoodleApp)',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!downloadResult.success) {
        throw new Error(downloadResult.error || 'Failed to download PDF');
      }

      console.log('✅ PDF downloaded successfully:', downloadResult.filePath);

      // Set the local file path for preview
      setSelectedPdfPath(downloadResult.filePath);
      setSelectedPdfFilename(attachment.filename);
      setPdfDialogOpen(true);

    } catch (error: any) {
      console.error('❌ Error downloading PDF for preview:', error);
      setPdfError(error.message || 'Failed to download PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  // Close PDF dialog
  const handleClosePdfDialog = () => {
    setPdfDialogOpen(false);
    setSelectedPdfPath('');
    setSelectedPdfFilename('');
    setPdfError(null);
  };

  // Fetch attachments for a specific assignment
  const fetchAssignmentAttachments = async (assignmentId: string) => {
    if (assignmentAttachments[assignmentId] || loadingAttachments[assignmentId]) {
      return; // Already loaded or loading
    }

    const { config } = useMoodleStore.getState();
    if (!config.apiKey) {
      return; // No API key available
    }

    setLoadingAttachments(prev => ({ ...prev, [assignmentId]: true }));

    try {
      const result = await window.electron.ipcRenderer.invoke('moodle:get-assignment-attachments', {
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        assignmentId,
        courseId: sessionId
      });

      if (result.success) {
        setAssignmentAttachments(prev => ({
          ...prev,
          [assignmentId]: result.data || []
        }));
      }
    } catch (error) {
      console.error('Error fetching assignment attachments:', error);
      setAssignmentAttachments(prev => ({
        ...prev,
        [assignmentId]: []
      }));
    } finally {
      setLoadingAttachments(prev => ({ ...prev, [assignmentId]: false }));
    }
  };

  // Fetch attachments when assignments are selected
  useEffect(() => {
    selectedCoursework.forEach(assignmentId => {
      fetchAssignmentAttachments(assignmentId);
    });
  }, [selectedCoursework]);

  return (
    <HTabPanel
      title={intl.formatMessage({ id: 'courseworkGenerator.selectCoursework.title' })}
    >
      <Box sx={{ mb: 3 }}>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          {intl.formatMessage({ id: 'courseworkGenerator.selectCoursework.description' })}
        </Typography>
      </Box>

      {/* Generation Type Selection */}
      <Box sx={{ mb: 4 }}>
        <FormControl component="fieldset">
          <FormLabel component="legend" sx={{ mb: 2, fontWeight: 500 }}>
            <Typography variant="h6">
              {intl.formatMessage({ id: 'courseworkGenerator.generationType.title' })}
            </Typography>
          </FormLabel>
          <RadioGroup
            value={generationType}
            onChange={handleGenerationTypeChange}
            sx={{ gap: 2 }}
          >
            <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', md: 'row' } }}>
              <Paper
                sx={{
                  p: 2,
                  border: '2px solid',
                  borderColor: generationType === 'current' ? 'primary.main' : 'divider',
                  backgroundColor: generationType === 'current' ? 'action.selected' : 'background.paper',
                  transition: 'all 0.2s ease',
                  flex: 1,
                }}
              >
                <FormControlLabel
                  value="current"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AssignmentIcon color="primary" />
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                          {intl.formatMessage({ id: 'courseworkGenerator.generationType.current' })}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {intl.formatMessage({ id: 'courseworkGenerator.generationType.currentDescription' })}
                        </Typography>
                      </Box>
                    </Box>
                  }
                  sx={{ m: 0, width: '100%' }}
                />
              </Paper>

              <Paper
                sx={{
                  p: 2,
                  border: '2px solid',
                  borderColor: generationType === 'new' ? 'primary.main' : 'divider',
                  backgroundColor: generationType === 'new' ? 'action.selected' : 'background.paper',
                  opacity: 0.5,
                  transition: 'all 0.2s ease',
                  flex: 1,
                }}
              >
                <FormControlLabel
                  value="new"
                  control={<Radio />}
                  disabled
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AddIcon />
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                          {intl.formatMessage({ id: 'courseworkGenerator.generationType.new' })}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {intl.formatMessage({ id: 'courseworkGenerator.generationType.newDescription' })}
                        </Typography>
                        <Chip
                          size="small"
                          label={intl.formatMessage({ id: 'courseworkGenerator.comingSoon' })}
                          variant="outlined"
                          sx={{ mt: 1 }}
                        />
                      </Box>
                    </Box>
                  }
                  sx={{ m: 0, width: '100%' }}
                />
              </Paper>
            </Box>
          </RadioGroup>
        </FormControl>
      </Box>

      {/* Available Assignments - Only show when current assignments is selected */}
      {generationType === 'current' && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 500 }}>
            {intl.formatMessage({ id: 'courseworkGenerator.selectCoursework.availableAssignments' })}
          </Typography>

        {courseContent?.assignments && courseContent.assignments.length > 0 ? (
          <Stack spacing={2}>
            {courseContent.assignments.map((assignment) => (
              <Paper
                key={assignment.id}
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  border: '2px solid',
                  borderColor: selectedCoursework.includes(assignment.id.toString())
                    ? 'primary.main'
                    : 'divider',
                  backgroundColor: selectedCoursework.includes(assignment.id.toString())
                    ? 'action.selected'
                    : 'background.paper',
                  '&:hover': {
                    borderColor: 'primary.main',
                    backgroundColor: 'action.hover',
                  },
                }}
                onClick={() => onCourseworkToggle(assignment.id.toString())}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 500, mb: 1 }}>
                      {assignment.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {assignment.intro && assignment.intro.length > 200
                        ? `${assignment.intro.substring(0, 200)}...`
                        : assignment.intro || intl.formatMessage({ id: 'courseworkGenerator.noDescription' })}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip
                        size="small"
                        label={`${intl.formatMessage({ id: 'courseworkGenerator.dueDate' })}: ${new Date(assignment.duedate * 1000).toLocaleDateString()}`}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        label={`${intl.formatMessage({ id: 'courseworkGenerator.maxGrade' })}: ${assignment.grade}`}
                        variant="outlined"
                      />
                    </Box>
                  </Box>
                  {selectedCoursework.includes(assignment.id.toString()) && (
                    <SchoolIcon color="primary" sx={{ ml: 2 }} />
                  )}
                </Box>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              {intl.formatMessage({ id: 'courseworkGenerator.noAssignments' })}
            </Typography>
          </Paper>
        )}
        </Box>
      )}

      {/* Selected Assignments with Attachments */}
      {generationType === 'current' && selectedCoursework.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 500 }}>
            {intl.formatMessage({ id: 'courseworkGenerator.selectedAssignments' })} ({selectedCoursework.length})
          </Typography>

          <Stack spacing={2}>
            {selectedCoursework.map((assignmentId) => {
              const assignment = courseContent?.assignments?.find(a => a.id.toString() === assignmentId);
              const attachments = assignmentAttachments[assignmentId] || [];
              const isLoading = loadingAttachments[assignmentId];

              if (!assignment) return null;

              return (
                <Paper
                  key={assignmentId}
                  sx={{
                    p: 3,
                    border: '2px solid',
                    borderColor: 'primary.main',
                    backgroundColor: 'action.selected',
                  }}
                >
                  {/* Assignment Header */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <SchoolIcon color="primary" />
                    <Typography variant="h6" sx={{ fontWeight: 500, flex: 1 }}>
                      {assignment.name}
                    </Typography>
                    <Chip
                      size="small"
                      label={`${attachments.length} ${intl.formatMessage({ id: 'courseworkGenerator.attachments' })}`}
                      variant="outlined"
                      color="primary"
                    />
                  </Box>

                  {/* Assignment Description */}
                  {assignment.intro && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        {assignment.intro.length > 300
                          ? `${assignment.intro.substring(0, 300)}...`
                          : assignment.intro}
                      </Typography>
                    </Box>
                  )}

                  {/* Attachments */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AttachFileIcon fontSize="small" />
                      {intl.formatMessage({ id: 'courseworkGenerator.attachments' })}
                    </Typography>

                    {isLoading ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1 }}>
                        <CircularProgress size={16} />
                        <Typography variant="body2" color="text.secondary">
                          {intl.formatMessage({ id: 'courseworkGenerator.loadingAttachments' })}
                        </Typography>
                      </Box>
                    ) : attachments.length > 0 ? (
                      <Stack spacing={1}>
                        {attachments.map((attachment, index) => {
                          const isPdf = isPdfFile(attachment.filename, attachment.mimetype);

                          return (
                            <Paper
                              key={index}
                              sx={{
                                p: 1.5,
                                border: '1px solid',
                                borderColor: 'divider',
                                backgroundColor: 'background.paper',
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {isPdf ? (
                                  <PictureAsPdfIcon fontSize="small" color="error" />
                                ) : (
                                  <DescriptionIcon fontSize="small" color="action" />
                                )}
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                    {attachment.filename}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {attachment.filesize > 0 && `${(attachment.filesize / 1024).toFixed(1)} KB`}
                                    {attachment.mimetype && ` • ${attachment.mimetype}`}
                                  </Typography>
                                </Box>

                                {/* PDF Preview Button */}
                                {isPdf && attachment.fileurl && (
                                  <Tooltip title={pdfLoading ? "Downloading PDF..." : "Preview PDF"}>
                                    <span>
                                      <IconButton
                                        size="small"
                                        onClick={() => handlePdfPreview(attachment)}
                                        disabled={pdfLoading}
                                        sx={{ mr: 1 }}
                                      >
                                        {pdfLoading ? (
                                          <CircularProgress size={16} />
                                        ) : (
                                          <VisibilityIcon fontSize="small" />
                                        )}
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                )}

                                <Chip
                                  size="small"
                                  label={isPdf ? 'PDF' : (attachment.type || 'file')}
                                  variant="outlined"
                                  color={isPdf ? 'error' : 'default'}
                                />
                              </Box>
                            </Paper>
                          );
                        })}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        {intl.formatMessage({ id: 'courseworkGenerator.noAttachments' })}
                      </Typography>
                    )}
                  </Box>
                </Paper>
              );
            })}
          </Stack>
        </Box>
      )}

      {/* Action Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
        <Button
          variant="contained"
          size="large"
          disabled={
            generationType !== 'current' ||
            selectedCoursework.length === 0 ||
            isGenerating
          }
          onClick={onProceedToGenerate}
          startIcon={<AutoAwesomeIcon />}
        >
          {intl.formatMessage({ id: 'courseworkGenerator.proceedToGenerate' })}
        </Button>
      </Box>

      {/* PDF Preview Dialog */}
      <PDFDialog
        open={pdfDialogOpen}
        onClose={handleClosePdfDialog}
        filename={selectedPdfFilename}
        filePath={selectedPdfPath}
        error={pdfError}
      />

      {/* PDF Error Display */}
      {pdfError && (
        <Box sx={{ position: 'fixed', top: 80, right: 20, zIndex: 9999 }}>
          <Paper sx={{ p: 2, bgcolor: 'error.light', color: 'error.contrastText', maxWidth: 300 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              PDF Preview Error
            </Typography>
            <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
              {pdfError}
            </Typography>
            <Button
              size="small"
              onClick={() => setPdfError(null)}
              sx={{ mt: 1, color: 'inherit' }}
            >
              Dismiss
            </Button>
          </Paper>
        </Box>
      )}
    </HTabPanel>
  );
}

export default Select;
