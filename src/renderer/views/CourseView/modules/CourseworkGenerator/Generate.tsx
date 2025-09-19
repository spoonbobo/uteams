import React from 'react';
import { Typography, Box } from '@mui/material';
import { useIntl } from 'react-intl';
import { HTabPanel } from '@/components/HTabsPanel';
import type { CourseSessionContext } from '@/stores/useContextStore';

interface GenerateProps {
  sessionContext: CourseSessionContext;
  selectedCoursework: string[];
  examType: string;
  examInstructions: string;
  onGenerateExam: () => void;
  isGenerating: boolean;
}

function Generate({
  sessionContext,
  selectedCoursework,
  examType,
  examInstructions,
  onGenerateExam,
  isGenerating,
}: GenerateProps) {
  const intl = useIntl();

  return (
    <HTabPanel
      title={intl.formatMessage({ id: 'courseworkGenerator.generate.title' })}
    >
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          Generate content will be implemented here
        </Typography>
      </Box>
    </HTabPanel>
  );
}

export default Generate;
