import React, { useState } from 'react';
import { Typography, Box, Paper } from '@mui/material';
import { useIntl } from 'react-intl';
import { HTabsPanel, type TabSection } from '@/components/HTabsPanel';
import type { CourseSessionContext } from '@/stores/useContextStore';
import { useCourseworkGeneratorStore } from '@/stores/useCourseworkGeneratorStore';
import { PDFDialog } from '@/components/PDFPreview';
import Select from './Select';
import Generate from './Generate';

interface CourseworkGeneratorProps {
  sessionContext: CourseSessionContext;
}

function CourseworkGenerator({ sessionContext }: CourseworkGeneratorProps) {
  const intl = useIntl();
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedCoursework, setSelectedCoursework] = useState<string[]>([]);
  const [examType, setExamType] = useState('');
  const [examInstructions, setExamInstructions] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // PDF preview state from store
  const {
    selectedPdfPath,
    selectedPdfFilename,
    pdfLoading,
    pdfError,
    clearPdfPreview
  } = useCourseworkGeneratorStore();

  // Handle tab change
  const handleTabChange = (newValue: number) => {
    setSelectedTab(newValue);
  };

  // Handle coursework selection
  const handleCourseworkToggle = (assignmentId: string) => {
    setSelectedCoursework((prev) =>
      prev.includes(assignmentId)
        ? prev.filter((id) => id !== assignmentId)
        : [...prev, assignmentId],
    );
  };

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
  };

  // Handle exam generation
  const handleGenerateExam = async () => {
    if (selectedCoursework.length === 0 || !examType.trim()) return;

    setIsGenerating(true);
    try {
      // TODO: Implement exam generation logic
      // console.log('Generating exam with:', {
      //   coursework: selectedCoursework,
      //   type: examType,
      //   instructions: examInstructions,
      // });

      // Simulate API call
      await new Promise((resolve) => {
        setTimeout(resolve, 2000);
      });
    } catch {
      // console.error('Error generating exam:', error);
    } finally {
      setIsGenerating(false);
    }
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
          selectedCoursework={selectedCoursework}
          onCourseworkToggle={handleCourseworkToggle}
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
      title: intl.formatMessage({ id: 'courseworkGenerator.tabs.generate' }),
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
    <Box sx={{ p: 3, backgroundColor: 'inherit' }}>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 500 }}>
          {intl.formatMessage({ id: 'courseworkGenerator.title' })} •{' '}
          {sessionContext.sessionName}
        </Typography>
      </Box>

      {/* Split Layout: PDF Preview (50%) + Content (50%) */}
      <Box sx={{ display: 'flex', gap: 2, height: 'calc(100vh - 200px)' }}>
        {/* Left Side: PDF Preview */}
        <Box sx={{ width: '50%' }}>
          {selectedPdfPath ? (
            <iframe
              src={`app-file://${selectedPdfPath}#toolbar=0&navpanes=0&view=FitH`}
              style={{
                width: '100%',
                height: '100%',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
              }}
              title={selectedPdfFilename || 'PDF Preview'}
            />
          ) : (
            <Box
              sx={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'grey.50',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'grey.300'
              }}
            >
              <Typography variant="body1" color="text.secondary">
                Select an assignment to preview PDF
              </Typography>
            </Box>
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
