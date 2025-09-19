import React, { useState } from 'react';
import { Typography, Box, Paper, Button, TextField, Chip, Stack } from '@mui/material';
import { useIntl } from 'react-intl';
import { HTabsPanel, HTabPanel, type TabSection } from '@/components/HTabsPanel';
import type { CourseSessionContext } from '@/stores/useContextStore';
import { useMoodleStore } from '@/stores/useMoodleStore';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SchoolIcon from '@mui/icons-material/School';

interface CourseworkGeneratorProps {
  sessionContext: CourseSessionContext;
}

export const CourseworkGenerator: React.FC<CourseworkGeneratorProps> = ({
  sessionContext,
}) => {
  const intl = useIntl();
  const { getCourseContent } = useMoodleStore();
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedCoursework, setSelectedCoursework] = useState<string[]>([]);
  const [examType, setExamType] = useState('');
  const [examInstructions, setExamInstructions] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const sessionId = sessionContext.sessionId;
  const courseContent = getCourseContent(sessionId);

  // Handle tab change
  const handleTabChange = (newValue: number) => {
    setSelectedTab(newValue);
  };

  // Handle coursework selection
  const handleCourseworkToggle = (assignmentId: string) => {
    setSelectedCoursework(prev =>
      prev.includes(assignmentId)
        ? prev.filter(id => id !== assignmentId)
        : [...prev, assignmentId]
    );
  };

  // Handle exam generation
  const handleGenerateExam = async () => {
    if (selectedCoursework.length === 0) return;

    setIsGenerating(true);
    try {
      // TODO: Implement exam generation logic
      console.log('Generating exam with:', {
        coursework: selectedCoursework,
        type: examType,
        instructions: examInstructions
      });

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Navigate to generate tab to show results
      setSelectedTab(1);
    } catch (error) {
      console.error('Error generating exam:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const sections: TabSection[] = [
    {
      id: 'select-coursework',
      title: intl.formatMessage({ id: 'courseworkGenerator.tabs.selectCoursework' }),
      component: (
        <HTabPanel
          title={intl.formatMessage({ id: 'courseworkGenerator.selectCoursework.title' })}
        >
          <Box sx={{ mb: 3 }}>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              {intl.formatMessage({ id: 'courseworkGenerator.selectCoursework.description' })}
            </Typography>
          </Box>

          {/* Available Assignments */}
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
                      transition: 'all 0.2s ease',
                    }}
                    onClick={() => handleCourseworkToggle(assignment.id.toString())}
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

          {/* Selected Summary */}
          {selectedCoursework.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 500 }}>
                {intl.formatMessage({ id: 'courseworkGenerator.selectedSummary' })} ({selectedCoursework.length})
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {selectedCoursework.map((assignmentId) => {
                  const assignment = courseContent?.assignments?.find(a => a.id.toString() === assignmentId);
                  return assignment ? (
                    <Chip
                      key={assignmentId}
                      label={assignment.name}
                      onDelete={() => handleCourseworkToggle(assignmentId)}
                      color="primary"
                      variant="outlined"
                    />
                  ) : null;
                })}
              </Box>
            </Box>
          )}

          {/* Action Button */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
            <Button
              variant="contained"
              size="large"
              disabled={selectedCoursework.length === 0 || isGenerating}
              onClick={() => setSelectedTab(1)}
              startIcon={<AutoAwesomeIcon />}
            >
              {intl.formatMessage({ id: 'courseworkGenerator.proceedToGenerate' })}
            </Button>
          </Box>
        </HTabPanel>
      ),
    },
    {
      id: 'generate',
      title: intl.formatMessage({ id: 'courseworkGenerator.tabs.generate' }),
      component: (
        <HTabPanel
          title={intl.formatMessage({ id: 'courseworkGenerator.generate.title' })}
        >
          <Box sx={{ mb: 3 }}>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              {intl.formatMessage({ id: 'courseworkGenerator.generate.description' })}
            </Typography>
          </Box>

          {/* Exam Configuration */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 500 }}>
              {intl.formatMessage({ id: 'courseworkGenerator.generate.configuration' })}
            </Typography>

            <Stack spacing={3}>
              <TextField
                label={intl.formatMessage({ id: 'courseworkGenerator.generate.examType' })}
                value={examType}
                onChange={(e) => setExamType(e.target.value)}
                placeholder={intl.formatMessage({ id: 'courseworkGenerator.generate.examTypePlaceholder' })}
                fullWidth
              />

              <TextField
                label={intl.formatMessage({ id: 'courseworkGenerator.generate.instructions' })}
                value={examInstructions}
                onChange={(e) => setExamInstructions(e.target.value)}
                placeholder={intl.formatMessage({ id: 'courseworkGenerator.generate.instructionsPlaceholder' })}
                multiline
                rows={4}
                fullWidth
              />
            </Stack>
          </Box>

          {/* Selected Coursework Summary */}
          {selectedCoursework.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 500 }}>
                {intl.formatMessage({ id: 'courseworkGenerator.generate.basedOn' })}
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
              onClick={handleGenerateExam}
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
          {intl.formatMessage({ id: 'courseworkGenerator.title' })} • {sessionContext.sessionName}
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
};
