import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  LinearProgress,
} from '@mui/material';
import { useIntl } from 'react-intl';

interface BatchGradingProgressProps {
  batchGradingActive: boolean;
  batchGradingProgress: {
    completed: number;
    failed: number;
    total: number;
    currentStudent: string | null;
  };
}

export const BatchGradingProgress: React.FC<BatchGradingProgressProps> = ({
  batchGradingActive,
  batchGradingProgress,
}) => {
  const intl = useIntl();

  if (!batchGradingActive) {
    return null;
  }

  return (
    <Card sx={{ 
      mb: 2, 
      bgcolor: (theme) => theme.palette.mode === 'dark' 
        ? theme.palette.primary.dark + '20' 
        : 'primary.50'
    }}>
      <CardContent>
        <Typography variant="subtitle2" gutterBottom>
          {intl.formatMessage({ id: 'grading.submissions.batchGrading.progress' })}
        </Typography>
        <LinearProgress 
          variant="determinate" 
          value={(batchGradingProgress.completed + batchGradingProgress.failed) / batchGradingProgress.total * 100}
          sx={{ mb: 1 }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Typography variant="body2" color="success.main">
              ✅ Completed: {batchGradingProgress.completed}
            </Typography>
            {batchGradingProgress.failed > 0 && (
              <Typography variant="body2" color="error.main">
                ❌ Failed: {batchGradingProgress.failed}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              / Total: {batchGradingProgress.total}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};
