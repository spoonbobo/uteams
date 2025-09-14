import React from 'react';
import {
  TableHead,
  TableRow,
  TableCell,
} from '@mui/material';
import { useIntl } from 'react-intl';

export const SubmissionsTableHeader: React.FC = () => {
  const intl = useIntl();

  return (
    <TableHead>
      <TableRow>
        <TableCell sx={{ width: '220px' }}>
          {intl.formatMessage({ id: 'grading.submissions.table.student' })}
        </TableCell>
        <TableCell align="center" sx={{ width: '110px' }}>
          {intl.formatMessage({ id: 'grading.submissions.table.gradedStatus' })}
        </TableCell>
        <TableCell align="center" sx={{ width: '110px' }}>
          {intl.formatMessage({ id: 'grading.submissions.table.submitStatus' })}
        </TableCell>
        <TableCell align="center" sx={{ width: '140px' }}>
          {intl.formatMessage({ id: 'grading.submissions.table.submissionFile' })}
        </TableCell>
        <TableCell align="center" sx={{ width: '110px' }}>
          {intl.formatMessage({ id: 'grading.submissions.table.autograde' })}
        </TableCell>
        <TableCell align="center" sx={{ 
          width: '150px', 
          color: 'primary.main', 
          fontWeight: 600,
          borderLeft: '3px solid',
          borderLeftColor: 'primary.main',
          borderRight: '3px solid',
          borderRightColor: 'primary.main'
        }}>
          {intl.formatMessage({ id: 'grading.submissions.table.autogradeResult' })}
        </TableCell>
        <TableCell align="center" sx={{ width: '90px' }}>
          {intl.formatMessage({ id: 'grading.submissions.table.submitGrade' })}
        </TableCell>
      </TableRow>
    </TableHead>
  );
};
