import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
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
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {intl.formatMessage({ id: 'grading.rubric.breakdown.title' })}
        </Typography>

        {/* Overall Score Summary */}
        <Box
          sx={{
            mb: 3,
            p: 2,
            bgcolor: 'background.paper',
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 1 }}
          >
            <Typography variant="subtitle1" fontWeight="bold">
              {intl.formatMessage({ id: 'grading.rubric.breakdown.overall' })}
            </Typography>
            <Chip
              label={`${overallScore}/100`}
              color={getOverallScoreColor()}
              variant="filled"
            />
          </Stack>
          <LinearProgress
            variant="determinate"
            value={overallScore}
            sx={{ height: 8, borderRadius: 4 }}
            color={getOverallScoreColor()}
          />
        </Box>

        {/* Individual Criteria Breakdown */}
        <Stack spacing={2}>
          {scoreBreakdown.map((item) => (
            <Box
              key={item.criteriaName}
              sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 1 }}
              >
                <Typography variant="subtitle2" fontWeight="medium">
                  {item.criteriaName}
                </Typography>
                <Chip
                  label={`${item.score}/${item.maxScore}`}
                  color={getScoreColor(item.score, item.maxScore)}
                  size="small"
                  variant="outlined"
                />
              </Stack>

              <LinearProgress
                variant="determinate"
                value={(item.score / item.maxScore) * 100}
                sx={{ mb: 1, height: 6, borderRadius: 3 }}
                color={getScoreColor(item.score, item.maxScore)}
              />

              <Typography variant="body2" color="text.secondary">
                {item.feedback}
              </Typography>
            </Box>
          ))}
        </Stack>

        {/* Score Summary */}
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="body2" color="text.secondary">
              {intl.formatMessage({ id: 'grading.rubric.breakdown.total' })}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {totalScore}/{totalMaxScore}{' '}
              {intl.formatMessage({ id: 'grading.rubric.breakdown.points' })}
            </Typography>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}

export default RubricBreakdown;
