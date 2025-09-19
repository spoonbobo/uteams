import React, { useState } from 'react';
import {
  Box,
  Button,
  Alert,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import type { MoodleAssignment } from '@/types/moodle';
import type { StudentSubmissionData, RubricContent, AIGradeResult } from '@/types/grading';
import type { DocxContent } from '@/components/DocxPreview/types';
import { useIntl } from 'react-intl';
import type { ElementHighlight } from '@/components/DocxPreview/types';
import { SubmissionPreview } from './SubmissionPreview';
import { GradingResults } from './GradingResults';

interface AIGradingPanelProps {
  selectedAssignment: string;
  selectedSubmission: string | null;
  selectedAssignmentData?: MoodleAssignment;
  selectedSubmissionData?: StudentSubmissionData;
  rubricContent: RubricContent | null;
  aiGradeResult: AIGradeResult | null;
  isGrading: boolean;
  onRunAIGrading: () => void;
  onBack: () => void;
  onNext: () => void;
}

export const AIGradingPanel: React.FC<AIGradingPanelProps> = ({
  selectedAssignment,
  selectedSubmission,
  selectedAssignmentData,
  selectedSubmissionData,
  rubricContent,
  aiGradeResult,
  isGrading,
  onRunAIGrading,
  onBack,
  onNext,
}) => {
  const intl = useIntl();

  const [docxContent, setDocxContent] = useState<DocxContent | null>(null);
  const [highlights, setHighlights] = useState<ElementHighlight[]>([]);
  const [gradingComments, setGradingComments] = useState<Array<{
    elementType: string;
    elementIndex: string;
    color: 'red' | 'yellow' | 'green';
    comment: string;
  }>>([]);

  const handleHighlightsChange = (newHighlights: ElementHighlight[]) => {
    setHighlights(newHighlights);
  };

  const handleGradingCommentsChange = (newComments: Array<{
    elementType: string;
    elementIndex: string;
    color: 'red' | 'yellow' | 'green';
    comment: string;
  }>) => {
    setGradingComments(newComments);
  };

  if (!selectedAssignment || !selectedSubmission) {
    return (
      <Alert severity="info">
        {intl.formatMessage({ id: 'grading.ai.selectFirst' })}
      </Alert>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Back Button */}
      <Box sx={{ mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
        >
          {intl.formatMessage({ id: 'grading.navigation.back' })}
        </Button>
      </Box>



      {/* Main Content Area - Optimized Layout */}
      <Box sx={{
        display: 'flex',
        gap: 2,
        flex: 1,
        height: 'calc(100vh - 200px)', // Fixed height to prevent overflow
        minHeight: '600px'
      }}>
        {/* Left Side - Submission Preview */}
        <Box sx={{
          flex: '1 1 60%',
          minWidth: 0, // Allow shrinking
          display: 'flex',
          flexDirection: 'column'
        }}>
          <SubmissionPreview
            selectedAssignment={selectedAssignment}
            selectedSubmission={selectedSubmission}
            selectedAssignmentData={selectedAssignmentData}
            selectedSubmissionData={selectedSubmissionData}
            highlights={highlights}
          />
        </Box>

        {/* Right Side - Grading Results */}
        <Box sx={{
          flex: '1 1 40%',
          minWidth: '320px',
          maxWidth: '400px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <GradingResults
            selectedAssignment={selectedAssignment}
            selectedSubmission={selectedSubmission}
            selectedAssignmentData={selectedAssignmentData}
            selectedSubmissionData={selectedSubmissionData}
            docxContent={docxContent}
            onHighlightsChange={handleHighlightsChange}
            onGradingCommentsChange={handleGradingCommentsChange}
          />
        </Box>
      </Box>

    </Box>
  );
};
