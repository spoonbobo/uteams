import React, { useState } from 'react';
import { Typography, Box } from '@mui/material';
import { useIntl } from 'react-intl';
import { HTabsPanel, type TabSection } from '@/components/HTabsPanel';
import type { CourseSessionContext } from '@/stores/useContextStore';
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
    <Box
      sx={{
        p: 3,
        backgroundColor: 'inherit',
      }}
    >
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 500 }}>
          {intl.formatMessage({ id: 'courseworkGenerator.title' })} •{' '}
          {sessionContext.sessionName}
        </Typography>
      </Box>

      {/* Horizontal Tabs Panel */}
      <HTabsPanel
        sections={sections}
        selectedTab={selectedTab}
        onTabChange={handleTabChange}
      />
    </Box>
  );
}

export default CourseworkGenerator;
