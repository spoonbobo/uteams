import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Box,
  Paper,
  Button,
  Chip,
  Stack,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  CircularProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import { useIntl } from 'react-intl';
import { HTabPanel } from '@/components/HTabsPanel';
import type { CourseSessionContext } from '@/stores/useContextStore';
import { useMoodleStore } from '@/stores/useMoodleStore';
import { useCourseworkGeneratorStore } from '@/stores/useCourseworkGeneratorStore';
import SchoolIcon from '@mui/icons-material/School';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AddIcon from '@mui/icons-material/Add';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DescriptionIcon from '@mui/icons-material/Description';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import InfoIcon from '@mui/icons-material/Info';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import VisibilityIcon from '@mui/icons-material/Visibility';

interface SelectProps {
  sessionContext: CourseSessionContext;
  examType: string;
  onExamTypeChange: (type: string) => void;
  examInstructions: string;
  onExamInstructionsChange: (instructions: string) => void;
  onProceedToGenerate: () => void;
  isGenerating: boolean;
}

function Select({
  sessionContext,
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

  const sessionId = sessionContext.sessionId;
  const courseContent = getCourseContent(sessionId);

  // Use store for PDF preview state and assignment selection
  const {
    getSelectedAssignments,
    toggleAssignment,
    setSelectedPdf,
    selectedPdfPath,
    setAssignmentPdf,
    setCurrentPreviewPdf,
    getAssignmentPdfs,
  } = useCourseworkGeneratorStore();

  // Get current course selections from store
  const selectedCoursework = getSelectedAssignments(sessionId);

  // Handle assignment toggle
  const onCourseworkToggle = (assignmentId: string) => {
    toggleAssignment(sessionId, assignmentId);
  };

  const handleGenerationTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setGenerationType(event.target.value);
  };

  // Check if a file is a PDF
  const isPdfFile = (filename: string, mimetype?: string): boolean => {
    const filenameLower = filename.toLowerCase();
    return filenameLower.endsWith('.pdf') || mimetype === 'application/pdf';
  };

  // Fetch attachments for a specific assignment
  const fetchAssignmentAttachments = useCallback(async (assignmentId: string) => {
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
  }, [sessionId, assignmentAttachments, loadingAttachments]);

  // Handle PDF preview selection
  const handlePdfPreview = useCallback(async (attachment: any, assignmentId: string) => {
    if (!attachment.fileurl || !attachment.filename) {
      console.error('PDF attachment missing required fields');
      return;
    }

    try {
      // Get Moodle config for API key
      const { config } = useMoodleStore.getState();
      if (!config.apiKey) {
        throw new Error('No Moodle API key available');
      }

      // Check if we already have this PDF downloaded
      const existingPdfs = getAssignmentPdfs(sessionId, assignmentId);
      const existingPdf = existingPdfs[attachment.filename];

      if (existingPdf) {
        console.log('📄 Using cached PDF:', attachment.filename);
        // Set the PDF in the store to show in preview
        setSelectedPdf(existingPdf.filePath, existingPdf.filename);
        // Set as current preview
        setCurrentPreviewPdf(sessionId, assignmentId, attachment.filename);
        return;
      }

      // Prepare download URL with token
      let downloadUrl = attachment.fileurl;
      if (downloadUrl && !downloadUrl.includes('token=')) {
        const separator = downloadUrl.includes('?') ? '&' : '?';
        downloadUrl = `${downloadUrl}${separator}token=${config.apiKey}`;
      }

      // Create unique filename for temp storage
      const uniqueFilename = `pdf_preview_${sessionId}_${assignmentId}_${attachment.filename}`;

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

      // Store the PDF in the granular store
      setAssignmentPdf(sessionId, assignmentId, attachment.filename, downloadResult.filePath);

      // Set as current preview
      setCurrentPreviewPdf(sessionId, assignmentId, attachment.filename);

      // Set the PDF in the store to show in preview
      setSelectedPdf(downloadResult.filePath, attachment.filename);

    } catch (error: any) {
      console.error('❌ Error downloading PDF for preview:', error);
      alert(`Failed to load PDF preview: ${error.message}`);
    }
  }, [sessionId, getAssignmentPdfs, setSelectedPdf, setCurrentPreviewPdf, setAssignmentPdf]);

  // Fetch attachments when assignments are selected
  useEffect(() => {
    selectedCoursework.forEach(assignmentId => {
      fetchAssignmentAttachments(assignmentId);
    });
  }, [selectedCoursework, fetchAssignmentAttachments]);

  // Auto-preview first PDF when attachments are loaded
  useEffect(() => {
    if (selectedCoursework.length === 0 || selectedPdfPath) {
      return; // Don't auto-preview if no assignments selected or already have a PDF
    }

    // Find first PDF attachment from selected assignments
    for (const assignmentId of selectedCoursework) {
      const attachments = assignmentAttachments[assignmentId];
      if (attachments && attachments.length > 0) {
        const firstPdf = attachments.find(att => isPdfFile(att.filename, att.mimetype));
        if (firstPdf && firstPdf.fileurl) {
          handlePdfPreview(firstPdf, assignmentId);
          break; // Only preview the first PDF found
        }
      }
    }
  }, [selectedCoursework, assignmentAttachments, selectedPdfPath, handlePdfPreview]);

  return (
    <HTabPanel
      title={intl.formatMessage({ id: 'courseworkGenerator.selectCoursework.title' })}
    >
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        pb: 2
      }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            {intl.formatMessage({ id: 'courseworkGenerator.selectCoursework.description' })}
          </Typography>
        </Box>

        {/* Scrollable Content Area */}
        <Box sx={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          pr: 1,
          mr: -1
        }}>
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
                      border: '1px solid',
                      borderColor: 'divider',
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
                      border: '1px solid',
                      borderColor: 'divider',
                      flex: 1,
                    }}
                  >
                    <FormControlLabel
                      value="upload"
                      control={<Radio />}
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <UploadFileIcon color="secondary" />
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                                {intl.formatMessage({ id: 'courseworkGenerator.generationType.upload' })}
                              </Typography>
                              <Tooltip
                                title={intl.formatMessage({ id: 'courseworkGenerator.generationType.uploadWarning' })}
                                placement="top"
                                arrow
                              >
                                <InfoIcon
                                  sx={{
                                    color: 'warning.main',
                                    fontSize: 16,
                                    cursor: 'help'
                                  }}
                                />
                              </Tooltip>
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                              {intl.formatMessage({ id: 'courseworkGenerator.generationType.uploadDescription' })}
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
                      border: '1px solid',
                      borderColor: 'divider',
                      opacity: 0.5,
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
                        border: '1px solid',
                        borderColor: selectedCoursework.includes(assignment.id.toString())
                          ? 'primary.main'
                          : 'divider',
                        backgroundColor: selectedCoursework.includes(assignment.id.toString())
                          ? 'action.selected'
                          : 'background.paper',
                        '&:hover': {
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

          {/* Selected Assignments Summary */}
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
                  const pdfAttachments = attachments.filter(att => isPdfFile(att.filename, att.mimetype));
                  const pdfCount = pdfAttachments.length;

                  if (!assignment) return null;

                  return (
                    <Paper
                      key={assignmentId}
                      sx={{
                        p: 2,
                        border: '1px solid',
                        borderColor: 'primary.main',
                        backgroundColor: 'action.selected'
                      }}
                    >
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: pdfCount > 0 ? 1 : 0 }}>
                          <SchoolIcon color="primary" />
                          <Typography variant="subtitle1" sx={{ fontWeight: 500, flex: 1 }}>
                            {assignment.name}
                          </Typography>
                          {isLoading ? (
                            <CircularProgress size={16} />
                          ) : (
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              {pdfCount > 0 && (
                                <Chip
                                  size="small"
                                  icon={<PictureAsPdfIcon />}
                                  label={`${pdfCount} PDF${pdfCount > 1 ? 's' : ''}`}
                                  color="error"
                                  variant="outlined"
                                />
                              )}
                              <Chip
                                size="small"
                                icon={<AttachFileIcon />}
                                label={`${attachments.length} files`}
                                variant="outlined"
                              />
                            </Box>
                          )}
                        </Box>

                        {/* PDF Preview Buttons */}
                        {pdfCount > 0 && !isLoading && (
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                            {pdfAttachments.map((pdf, index) => (
                              <Button
                                key={index}
                                size="small"
                                variant="outlined"
                                startIcon={<VisibilityIcon />}
                                onClick={() => handlePdfPreview(pdf, assignmentId)}
                                sx={{
                                  textTransform: 'none',
                                  fontSize: '0.75rem'
                                }}
                              >
                                {pdf.filename.length > 20
                                  ? `${pdf.filename.substring(0, 20)}...pdf`
                                  : pdf.filename}
                              </Button>
                            ))}
                          </Box>
                        )}
                      </Box>
                    </Paper>
                  );
                })}
              </Stack>
            </Box>
          )}
        </Box>

        {/* Action Button - Fixed at bottom */}
        <Box sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          pt: 2,
          mt: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          flexShrink: 0
        }}>
          <Button
            variant="contained"
            disabled={
              (generationType === 'current' && selectedCoursework.length === 0) ||
              generationType === 'new' ||
              isGenerating
            }
            onClick={onProceedToGenerate}
            size="large"
          >
            {intl.formatMessage({ id: 'courseworkGenerator.proceedToGenerate' })}
          </Button>
        </Box>
      </Box>
    </HTabPanel>
  );
}

export default Select;
