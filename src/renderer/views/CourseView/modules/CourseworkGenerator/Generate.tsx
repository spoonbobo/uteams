import React from 'react';
import { Typography, Box, Button, Chip } from '@mui/material';
import { useIntl } from 'react-intl';
import { HTabPanel } from '@/components/HTabsPanel';
import type { CourseSessionContext } from '@/stores/useContextStore';
import { useMoodleStore } from '@/stores/useMoodleStore';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

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
  const { getCourseContent } = useMoodleStore();

  const sessionId = sessionContext.sessionId;
  const courseContent = getCourseContent(sessionId);

  return (
    <HTabPanel
      title={intl.formatMessage({ id: 'courseworkGenerator.generate.title' })}
    >
      <Box sx={{ mb: 3 }}>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          {intl.formatMessage({ id: 'courseworkGenerator.generate.description' })}
        </Typography>
      </Box>

      {/* Configuration Summary */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 500 }}>
          {intl.formatMessage({ id: 'courseworkGenerator.generate.configurationSummary' })}
        </Typography>

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            {intl.formatMessage({ id: 'courseworkGenerator.generate.examType' })}:
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 500 }}>
            {examType || intl.formatMessage({ id: 'courseworkGenerator.notSpecified' })}
          </Typography>
        </Box>

        {examInstructions && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              {intl.formatMessage({ id: 'courseworkGenerator.generate.instructions' })}:
            </Typography>
            <Typography variant="body1">
              {examInstructions}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Selected Coursework Summary */}
      {selectedCoursework.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 500 }}>
            {intl.formatMessage({ id: 'courseworkGenerator.generate.basedOn' })} ({selectedCoursework.length})
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {selectedCoursework.map((assignmentId) => {
              const assignment = courseContent?.assignments?.find(a => a.id.toString() === assignmentId);
              return assignment ? (
                <Chip
                  key={assignmentId}
                  label={assignment.name}
                  color="primary"
                  variant="filled"
                />
              ) : null;
            })}
          </Box>
        </Box>
      )}

      {/* Generate Button */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <Button
          variant="contained"
          size="large"
          disabled={selectedCoursework.length === 0 || !examType.trim() || isGenerating}
          onClick={onGenerateExam}
          startIcon={<AutoAwesomeIcon />}
          sx={{ minWidth: 200 }}
        >
          {isGenerating
            ? intl.formatMessage({ id: 'courseworkGenerator.generating' })
            : intl.formatMessage({ id: 'courseworkGenerator.generateCoursework' })}
        </Button>
      </Box>

      {/* Results Area (placeholder) */}
      {isGenerating && (
        <Box sx={{ mt: 4, p: 3, bgcolor: 'action.hover', borderRadius: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {intl.formatMessage({ id: 'courseworkGenerator.generatingProgress' })}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {intl.formatMessage({ id: 'courseworkGenerator.pleaseWait' })}
          </Typography>
        </Box>
      )}
    </HTabPanel>
  );
}

export default Generate;
