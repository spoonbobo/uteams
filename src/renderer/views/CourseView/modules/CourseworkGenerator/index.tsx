import React, { useState, useEffect } from 'react';
import { Typography, Box, Paper, Card, CardContent } from '@mui/material';
import { useIntl } from 'react-intl';
import { HTabsPanel, type TabSection } from '@/components/HTabsPanel';
import type { CourseSessionContext } from '@/stores/useContextStore';
import { useCourseworkGeneratorStore } from '@/stores/useCourseworkGeneratorStore';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import Select from './Select';
import Generate from './Generate';

interface CourseworkGeneratorProps {
  sessionContext: CourseSessionContext;
}

function CourseworkGenerator({ sessionContext }: CourseworkGeneratorProps) {
  const intl = useIntl();
  const [selectedTab, setSelectedTab] = useState(0);
  const [examType, setExamType] = useState('');
  const [examInstructions, setExamInstructions] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // PDF preview state from store
  const {
    selectedPdfPath,
    selectedPdfFilename,
    pdfLoading,
    pdfError,
    clearPdfPreview,
    getSelectedAssignments,
    getCurrentPreviewPdf,
    setSelectedPdf
  } = useCourseworkGeneratorStore();

  // Get selected assignments from store
  const selectedCoursework = getSelectedAssignments(sessionContext.sessionId);

  // Sync PDF preview with current course when component mounts or course changes
  useEffect(() => {
    const currentPreview = getCurrentPreviewPdf(sessionContext.sessionId);

    // If there's a current preview for this course, set it
    if (currentPreview.filePath && currentPreview.filename) {
      // Only set if it's different from what's currently shown to avoid unnecessary updates
      if (selectedPdfPath !== currentPreview.filePath) {
        console.log(`📄 Switching to PDF preview for course ${sessionContext.sessionId}:`, currentPreview.filename);
        setSelectedPdf(currentPreview.filePath, currentPreview.filename);
      }
    } else {
      // If no preview for this course, clear the global preview
      if (selectedPdfPath) {
        console.log(`📄 Clearing PDF preview when switching to course ${sessionContext.sessionId} (no saved preview)`);
        clearPdfPreview();
      }
    }
    // Use sessionContext.sessionId as key dependency to ensure this runs when switching courses
  }, [sessionContext.sessionId]);

  // Cleanup effect when component unmounts
  useEffect(() => {
    return () => {
      // Don't clear the preview on unmount - let the course-specific logic handle it
      console.log(`📄 Coursework Generator unmounting for course ${sessionContext.sessionId}`);
    };
  }, [sessionContext.sessionId]);

  // Handle tab change
  const handleTabChange = (newValue: number) => {
    setSelectedTab(newValue);
  };

  // Coursework selection is now handled by the store in the Select component

  // Handle exam type change
  const handleExamTypeChange = (type: string) => {
    setExamType(type);
  };

  // Handle exam instructions change
  const handleExamInstructionsChange = (instructions: string) => {
    setExamInstructions(instructions);
  };

  // Handle proceed to generate
  const handleProceedToGenerate = () => {
    setSelectedTab(1);
    // Trigger generation when switching to Generate tab
    setIsGenerating(true);
  };

  // Handle exam generation completion (called by Generate component)
  const handleGenerateExam = () => {
    setIsGenerating(false);
  };

  const sections: TabSection[] = [
    {
      id: 'select-coursework',
      title: intl.formatMessage({
        id: 'courseworkGenerator.tabs.selectCoursework',
      }),
      component: (
        <Select
          sessionContext={sessionContext}
          examType={examType}
          onExamTypeChange={handleExamTypeChange}
          examInstructions={examInstructions}
          onExamInstructionsChange={handleExamInstructionsChange}
          onProceedToGenerate={handleProceedToGenerate}
          isGenerating={isGenerating}
        />
      ),
    },
    {
      id: 'generate',
      title: intl.formatMessage({ id: 'courseworkGenerator.tabs.newCoursework' }),
      component: (
        <Generate
          sessionContext={sessionContext}
          selectedCoursework={selectedCoursework}
          examType={examType}
          examInstructions={examInstructions}
          onGenerateExam={handleGenerateExam}
          isGenerating={isGenerating}
        />
      ),
    },
  ];

  return (
    <Box sx={{
      p: 3,
      backgroundColor: 'inherit',
      height: '100%',
      display: 'flex',
      flexDirection: 'column' // Enable flex layout for HTabsPanel compatibility
    }}>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 500 }}>
          {intl.formatMessage({ id: 'courseworkGenerator.title' })} •{' '}
          {sessionContext.sessionName}
        </Typography>
      </Box>

      {/* Split Layout: PDF Preview (50%) + Content (50%) - HTabsPanel Compatible */}
      <Box sx={{
        display: 'flex',
        gap: 2,
        flex: 1,
        minHeight: 0, // Allow natural flexbox shrinking for HTabsPanel compatibility
        maxHeight: '75vh' // Reasonable maximum height instead of viewport calculation
      }}>
        {/* Left Side: PDF Preview */}
        <Box sx={{ width: '50%', display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            PDF Preview
          </Typography>

          {selectedPdfPath ? (
            <Box sx={{ flex: 1 }}>
              <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  {(() => {
                    const currentPreview = getCurrentPreviewPdf(sessionContext.sessionId);
                    if (currentPreview.assignmentId) {
                      return `Assignment ${currentPreview.assignmentId}: ${selectedPdfFilename || 'PDF Preview'}`;
                    }
                    return selectedPdfFilename || 'PDF Preview';
                  })()}
                </Typography>
              </Box>
              <iframe
                src={`app-file://${selectedPdfPath}#toolbar=0&navpanes=0&view=FitH`}
                style={{
                  width: '100%',
                  height: 'calc(100% - 32px)', // Account for filename display
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px',
                }}
                title={selectedPdfFilename || 'PDF Preview'}
              />
            </Box>
          ) : (
            <Card
              variant="outlined"
              sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'background.default'
              }}
            >
              <CardContent sx={{ textAlign: 'center', py: 8 }}>
                <PictureAsPdfIcon
                  sx={{
                    fontSize: 64,
                    color: 'text.disabled',
                    mb: 2
                  }}
                />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No PDF Selected
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300 }}>
                  Select an assignment from the right panel to automatically preview its PDF attachments here
                </Typography>
              </CardContent>
            </Card>
          )}
        </Box>

        {/* Right Side: Tabs Content */}
        <Box sx={{ width: '50%' }}>
          <HTabsPanel
            sections={sections}
            selectedTab={selectedTab}
            onTabChange={handleTabChange}
          />
        </Box>
      </Box>
    </Box>
  );
}

export default CourseworkGenerator;
