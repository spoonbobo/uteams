import React from 'react';
import { TableHead, TableRow, TableCell, useTheme, alpha } from '@mui/material';
import { useIntl } from 'react-intl';

function SubmissionsTableHeader() {
  const intl = useIntl();
  const theme = useTheme();

  return (
    <TableHead>
      <TableRow
        sx={{
          bgcolor:
            theme.palette.mode === 'dark'
              ? alpha(theme.palette.background.paper, 0.8)
              : alpha(theme.palette.primary.main, 0.06),
          '& .MuiTableCell-root': {
            borderBottom: `2px solid ${theme.palette.divider}`,
            fontWeight: theme.typography.fontWeightMedium,
            fontSize: theme.typography.pxToRem(13),
            color: theme.palette.text.primary,
            py: theme.spacing(2),
          },
        }}
      >
        <TableCell
          padding="checkbox"
          sx={{
            width: theme.spacing(6.25), // 50px equivalent
            minWidth: theme.spacing(6.25),
          }}
        >
          {/* Empty header for checkbox column */}
        </TableCell>
        <TableCell
          sx={{
            width: theme.spacing(25), // 200px equivalent
            minWidth: theme.spacing(20),
            [theme.breakpoints.down('md')]: {
              width: theme.spacing(18),
              minWidth: theme.spacing(15),
            },
          }}
        >
          {intl.formatMessage({
            id: 'grading.submissions.table.student',
          })}
        </TableCell>
        <TableCell
          align="center"
          sx={{
            width: theme.spacing(13.75), // 110px equivalent
            minWidth: theme.spacing(12),
            [theme.breakpoints.down('md')]: {
              width: theme.spacing(10),
              minWidth: theme.spacing(8),
            },
          }}
        >
          {intl.formatMessage({
            id: 'grading.submissions.table.gradedStatus',
          })}
        </TableCell>
        <TableCell
          align="center"
          sx={{
            width: theme.spacing(13.75), // 110px equivalent
            minWidth: theme.spacing(12),
            [theme.breakpoints.down('md')]: {
              width: theme.spacing(10),
              minWidth: theme.spacing(8),
            },
          }}
        >
          {intl.formatMessage({
            id: 'grading.submissions.table.submitStatus',
          })}
        </TableCell>
        <TableCell
          align="center"
          sx={{
            width: theme.spacing(17.5), // 140px equivalent
            minWidth: theme.spacing(15),
            [theme.breakpoints.down('md')]: {
              width: theme.spacing(12),
              minWidth: theme.spacing(10),
            },
          }}
        >
          {intl.formatMessage({
            id: 'grading.submissions.table.submissionFile',
          })}
        </TableCell>
        <TableCell
          align="center"
          sx={{
            width: theme.spacing(13.75), // 110px equivalent
            minWidth: theme.spacing(12),
            [theme.breakpoints.down('md')]: {
              width: theme.spacing(10),
              minWidth: theme.spacing(8),
            },
          }}
        >
          {intl.formatMessage({
            id: 'grading.submissions.table.autograde',
          })}
        </TableCell>
        <TableCell
          align="center"
          sx={{
            width: theme.spacing(18.75), // 150px equivalent
            minWidth: theme.spacing(15),
            color: theme.palette.primary.main,
            fontWeight: theme.typography.fontWeightBold,
            fontSize: theme.typography.pxToRem(13),
            borderLeft: `3px solid ${theme.palette.primary.main}`,
            borderRight: `3px solid ${theme.palette.primary.main}`,
            backgroundColor: alpha(theme.palette.primary.main, 0.08),
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: -1,
              right: -1,
              backgroundColor: alpha(theme.palette.primary.main, 0.04),
              zIndex: -1,
            },
            [theme.breakpoints.down('md')]: {
              width: theme.spacing(12),
              minWidth: theme.spacing(10),
              fontSize: theme.typography.pxToRem(12),
            },
          }}
        >
          {intl.formatMessage({
            id: 'grading.submissions.table.autogradeResult',
          })}
        </TableCell>
        <TableCell
          align="center"
          sx={{
            width: theme.spacing(11.25), // 90px equivalent
            minWidth: theme.spacing(10),
            [theme.breakpoints.down('md')]: {
              width: theme.spacing(8),
              minWidth: theme.spacing(7),
            },
          }}
        >
          {intl.formatMessage({
            id: 'grading.submissions.table.submitGrade',
          })}
        </TableCell>
      </TableRow>
    </TableHead>
  );
}

export default SubmissionsTableHeader;
