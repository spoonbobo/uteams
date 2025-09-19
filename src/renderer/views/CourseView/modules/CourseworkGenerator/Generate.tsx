import React from 'react';
import { Typography, Box } from '@mui/material';
import { useIntl } from 'react-intl';
import { HTabPanel } from '@/components/HTabsPanel';
import type { CourseSessionContext } from '@/stores/useContextStore';
import { useCourseworkGeneratorStore } from '@/stores/useCourseworkGeneratorStore';

interface GenerateProps {
  sessionContext: CourseSessionContext;
  examType: string;
  examInstructions: string;
  onGenerateExam: () => void;
  isGenerating: boolean;
}

function Generate({
  sessionContext,
  examType,
  examInstructions,
  onGenerateExam,
  isGenerating,
}: GenerateProps) {
  const intl = useIntl();
  const { getSelectedAssignments } = useCourseworkGeneratorStore();

  // Get selected coursework from store
  const selectedCoursework = getSelectedAssignments(sessionContext.sessionId);

  // TODO: Use these props when implementing the generation logic
  // eslint-disable-next-line no-console
  console.log('Generate component props:', {
    examType,
    examInstructions,
    selectedCoursework,
    isGenerating,
    onGenerateExam: typeof onGenerateExam,
  });

  return (
    <HTabPanel
      title={intl.formatMessage({ id: 'courseworkGenerator.generate.title' })}
    >
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          Generate content will be implemented here
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Selected assignments: {selectedCoursework.length}
        </Typography>
        {/* TODO: Add generate button that calls onGenerateExam when implemented */}
        {/* onGenerateExam will be used in the future implementation */}
      </Box>
    </HTabPanel>
  );
}

export default Generate;
