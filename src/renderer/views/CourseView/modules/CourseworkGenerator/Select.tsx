import React, { useState, useEffect } from 'react';
import { Typography, Box, Paper, Button, TextField, Chip, Stack, Radio, RadioGroup, FormControlLabel, FormControl, FormLabel, CircularProgress, IconButton, Tooltip } from '@mui/material';
import { useIntl } from 'react-intl';
import { HTabPanel } from '@/components/HTabsPanel';
import type { CourseSessionContext } from '@/stores/useContextStore';
import { useMoodleStore } from '@/stores/useMoodleStore';
import { useCourseworkGeneratorStore } from '@/stores/useCourseworkGeneratorStore';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SchoolIcon from '@mui/icons-material/School';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AddIcon from '@mui/icons-material/Add';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DescriptionIcon from '@mui/icons-material/Description';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DataObjectIcon from '@mui/icons-material/DataObject';
import InfoIcon from '@mui/icons-material/Info';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import PDFJsonDialog from '@/components/PDFPreview/PDFJsonDialog';
import PDFDialog from '@/components/PDFPreview/PDFDialog';

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
  const [jsonDialogOpen, setJsonDialogOpen] = useState(false);
  const [pdfJsonData, setPdfJsonData] = useState<any>(null);
  const [jsonLoading, setJsonLoading] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [selectedJsonFilename, setSelectedJsonFilename] = useState<string>('');

  // PDF Preview Dialog state
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [previewPdfData, setPreviewPdfData] = useState<{
    filePath: string;
    filename: string;
    studentName?: string;
  } | null>(null);

  const sessionId = sessionContext.sessionId;
  const courseContent = getCourseContent(sessionId);

  // Use store for PDF preview state and assignment selection
  const {
    setSelectedPdf,
    setPdfLoading,
    setPdfError,
    pdfLoading,
    clearPdfPreview,
    selectedPdfPath,
    getSelectedAssignments,
    toggleAssignment,
    // New granular PDF methods
    setAssignmentPdf,
    setCurrentPreviewPdf,
    getCurrentPreviewPdf,
    getAssignmentPdfs,
    // Parsed content methods
    setParsedContent,
    getAllParsedContent,
    // Legacy methods for backward compatibility
    setPreviewPdf,
    getPreviewPdf
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

  // Check if any selected assignments have PDF attachments
  const hasPdfAttachments = (): boolean => {
    return selectedCoursework.some(assignmentId => {
      const attachments = assignmentAttachments[assignmentId] || [];
      return attachments.some(attachment => isPdfFile(attachment.filename, attachment.mimetype));
    });
  };

  // Handle PDF preview - download PDF and show in left panel
  const handlePdfPreview = async (attachment: any, assignmentId: string) => {
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

      // Check if we already have this PDF downloaded
      const existingPdfs = getAssignmentPdfs(sessionId, assignmentId);
      const existingPdf = existingPdfs[attachment.filename];

      if (existingPdf) {
        console.log('📄 Using cached PDF:', attachment.filename);
        // Set the PDF in the store to show in left panel
        setSelectedPdf(existingPdf.filePath, existingPdf.filename);
        // Set as current preview
        setCurrentPreviewPdf(sessionId, assignmentId, attachment.filename);

        setPdfLoading(false);
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

      // Set the PDF in the store to show in left panel
      setSelectedPdf(downloadResult.filePath, attachment.filename);


    } catch (error: any) {
      console.error('❌ Error downloading PDF for preview:', error);
      setPdfError(error.message || 'Failed to download PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  // Handle PDF parsing to JSON
  const handlePdfParseJson = async (attachment: any, assignmentId: string) => {
    if (!attachment.fileurl || !attachment.filename) {
      console.error('PDF attachment missing required fields');
      return;
    }

    setJsonLoading(true);
    setJsonError(null);

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
      const uniqueFilename = `pdf_parse_${sessionId}_${attachment.filename}`;

      console.log('📄 Downloading PDF for parsing:', attachment.filename);

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

      console.log('✅ PDF downloaded successfully, parsing to JSON...');

      // Parse PDF to JSON using PDF.js
      const parseResult = await window.electron.ipcRenderer.invoke('pdf:parse-to-json', {
        filePath: downloadResult.filePath,
        includeText: true,
        includeMetadata: true,
        includeStructure: true
      });

      if (!parseResult.success) {
        throw new Error(parseResult.error || 'Failed to parse PDF');
      }

      console.log('✅ PDF parsed successfully (AI-optimized format):', parseResult.data);

      // Store the parsed content in the store for later use in generation
      console.log('💾 Storing parsed PDF content for assignment:', assignmentId, attachment.filename);
      setParsedContent(sessionId, assignmentId, attachment.filename, parseResult.data);

      // Open the AI-optimized JSON dialog (no data saving)
      setPdfJsonData(parseResult.data);
      setSelectedJsonFilename(attachment.filename);
      setJsonDialogOpen(true);

    } catch (error: any) {
      console.error('❌ Error parsing PDF to JSON:', error);
      setJsonError(error.message || 'Failed to parse PDF');
    } finally {
      setJsonLoading(false);
    }
  };

  // Close JSON dialog
  const handleCloseJsonDialog = () => {
    setJsonDialogOpen(false);
    setPdfJsonData(null);
    setSelectedJsonFilename('');
    setJsonError(null);
  };

  // Handle PDF preview in dialog
  const handlePdfPreviewDialog = async (attachment: any, assignmentId: string) => {
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

      // Prepare download URL with token
      let downloadUrl = attachment.fileurl;
      if (downloadUrl && !downloadUrl.includes('token=')) {
        const separator = downloadUrl.includes('?') ? '&' : '?';
        downloadUrl = `${downloadUrl}${separator}token=${config.apiKey}`;
      }

      // Create unique filename for temp storage
      const uniqueFilename = `pdf_preview_${sessionId}_${attachment.filename}`;

      console.log('📄 Downloading PDF for preview dialog:', attachment.filename);

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

      // Set preview data and open dialog
      setPreviewPdfData({
        filePath: downloadResult.filePath,
        filename: attachment.filename,
        studentName: `Assignment ${assignmentId}`
      });
      setPdfDialogOpen(true);

    } catch (error: any) {
      console.error('❌ Error downloading PDF for preview dialog:', error);
      // Show error toast or alert
      alert(`Error loading PDF preview: ${error.message}`);
    }
  };

  const handleClosePdfDialog = () => {
    setPdfDialogOpen(false);
    setPreviewPdfData(null);
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


  // Restore previously selected PDF on component mount or course change
  useEffect(() => {
    const currentPreview = getCurrentPreviewPdf(sessionId);
    if (currentPreview.filePath && currentPreview.filename) {
      console.log(`📄 Restoring PDF preview for course ${sessionId}:`, currentPreview.filename);
      setSelectedPdf(currentPreview.filePath, currentPreview.filename);
    } else {
      console.log(`📄 No saved PDF preview for course ${sessionId}`);
    }
  }, [sessionId, getCurrentPreviewPdf, setSelectedPdf]);

  // Auto-preview first PDF when assignments change (only if no PDF is currently selected)
  useEffect(() => {
    if (selectedCoursework.length === 0) {
      // Clear preview when no assignments selected
      clearPdfPreview();
      return;
    }

    // Only auto-preview if no PDF is currently selected
    if (!selectedPdfPath) {
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
    }
  }, [selectedCoursework, assignmentAttachments, selectedPdfPath, sessionId, clearPdfPreview]);

  return (
    <HTabPanel
      title={intl.formatMessage({ id: 'courseworkGenerator.selectCoursework.title' })}
    >
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        pb: 2 // Add bottom padding to prevent button cutoff
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
          pr: 1, // Add some right padding for scrollbar
          mr: -1 // Negative margin to compensate
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
                  borderColor: 'divider',
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
                    <SchoolIcon color="action" sx={{ ml: 2, opacity: 0.7 }} />
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
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  {/* Assignment Header */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <SchoolIcon color="action" sx={{ opacity: 0.7 }} />
                    <Typography variant="h6" sx={{ fontWeight: 500, flex: 1 }}>
                      {assignment.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {attachments.length} {intl.formatMessage({ id: 'courseworkGenerator.attachments' })}
                    </Typography>
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
                          // Check if this PDF has been parsed
                          const hasParsedContent = isPdf && getAllParsedContent(sessionId)
                            .some(pc => pc.assignmentId === assignmentId && pc.filename === attachment.filename);

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

                                {/* PDF Actions */}
                                {isPdf && attachment.fileurl && (
                                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                                    <Tooltip title="Preview PDF">
                                      <IconButton
                                        size="small"
                                        onClick={() => handlePdfPreviewDialog(attachment, assignmentId)}
                                        disabled={pdfLoading || jsonLoading}
                                      >
                                        <VisibilityIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>

                                    <Tooltip title={jsonLoading ? "Parsing PDF..." : "Parse to AI-Ready JSON"}>
                                      <span>
                                        <IconButton
                                          size="small"
                                          onClick={() => handlePdfParseJson(attachment, assignmentId)}
                                          disabled={pdfLoading || jsonLoading}
                                        >
                                          {jsonLoading ? (
                                            <CircularProgress size={16} />
                                          ) : (
                                            <DataObjectIcon fontSize="small" />
                                          )}
                                        </IconButton>
                                      </span>
                                    </Tooltip>
                                  </Box>
                                )}

                                <Typography variant="caption" color="text.secondary">
                                  {isPdf ? (hasParsedContent ? 'PDF ✓' : 'PDF') : (attachment.type || 'file')}
                                </Typography>
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
        </Box>

        {/* Action Button - Fixed at bottom */}
        <Box sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          pt: 2,
          mt: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          flexShrink: 0 // Prevent shrinking
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

      {/* PDF JSON Structure Dialog */}
      <PDFJsonDialog
        open={jsonDialogOpen}
        onClose={handleCloseJsonDialog}
        filename={selectedJsonFilename}
        jsonData={pdfJsonData}
        loading={jsonLoading}
        error={jsonError}
      />

      {/* PDF Preview Dialog */}
      <PDFDialog
        open={pdfDialogOpen}
        onClose={handleClosePdfDialog}
        studentName={previewPdfData?.studentName}
        filename={previewPdfData?.filename}
        filePath={previewPdfData?.filePath || ''}
      />


      {/* JSON Parse Error Display */}
      {jsonError && (
        <Box sx={{ position: 'fixed', top: 140, right: 20, zIndex: 9999 }}>
          <Paper sx={{ p: 2, bgcolor: 'warning.light', color: 'warning.contrastText', maxWidth: 300 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              PDF Parse Error
            </Typography>
            <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
              {jsonError}
            </Typography>
            <Button
              size="small"
              onClick={() => setJsonError(null)}
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
