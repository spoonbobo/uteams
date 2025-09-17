import {
  Box,
  Typography,
  Stack,
} from '@mui/material';
import { useIntl } from 'react-intl';
import type { ScoreBreakdownItem } from '@/types/grading';

interface RubricBreakdownProps {
  scoreBreakdown: ScoreBreakdownItem[];
  overallScore: number;
}

function RubricBreakdown({
  scoreBreakdown,
  overallScore,
}: RubricBreakdownProps) {
  const intl = useIntl();

  const getScoreColor = (
    score: number,
    maxScore: number,
  ): 'success' | 'warning' | 'error' => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return 'success';
    if (percentage >= 60) return 'warning';
    return 'error';
  };

  const totalMaxScore = scoreBreakdown.reduce(
    (sum, item) => sum + item.maxScore,
    0,
  );
  const totalScore = scoreBreakdown.reduce((sum, item) => sum + item.score, 0);

  const getOverallScoreColor = (): 'success' | 'warning' | 'error' => {
    if (overallScore >= 80) return 'success';
    if (overallScore >= 60) return 'warning';
    return 'error';
  };

  return (
    <Box>
      <Typography
        variant="subtitle1"
        sx={{
          fontWeight: 600,
          mb: 2,
          color: 'text.primary'
        }}
      >
        {intl.formatMessage({ id: 'grading.rubric.breakdown.title', defaultMessage: 'Score Breakdown' })}
      </Typography>

      {/* Individual Criteria Breakdown */}
      <Stack spacing={2}>
        {scoreBreakdown.map((item) => (
          <Box
            key={item.criteriaName}
            sx={{
              p: 2,
              bgcolor: 'background.default',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 1.5 }}
            >
              <Typography
                variant="body1"
                sx={{
                  fontWeight: 500,
                  color: 'text.primary'
                }}
              >
                {item.criteriaName}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  color: getScoreColor(item.score, item.maxScore) === 'success' ? 'success.main' :
                         getScoreColor(item.score, item.maxScore) === 'warning' ? 'warning.main' : 'error.main',
                  bgcolor: getScoreColor(item.score, item.maxScore) === 'success' ? 'success.light' :
                           getScoreColor(item.score, item.maxScore) === 'warning' ? 'warning.light' : 'error.light',
                  px: 1,
                  py: 0.5,
                  borderRadius: 0.5
                }}
              >
                {item.score}/{item.maxScore}
              </Typography>
            </Stack>

            {item.feedback && (
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  lineHeight: 1.5,
                  fontStyle: 'italic'
                }}
              >
                {item.feedback}
              </Typography>
            )}
          </Box>
        ))}
      </Stack>

      {/* Score Summary */}
      <Box sx={{
        mt: 2,
        pt: 2,
        borderTop: '1px solid',
        borderColor: 'divider'
      }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography variant="body2" color="text.secondary">
            {intl.formatMessage({ id: 'grading.rubric.breakdown.total', defaultMessage: 'Total Points' })}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 500,
              color: 'text.primary'
            }}
          >
            {totalScore}/{totalMaxScore}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}

export default RubricBreakdown;
