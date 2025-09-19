import React, { useState } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Stack,
  Button,
  TablePagination,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useIntl } from 'react-intl';
import { useWorkStore } from '@/stores/useWorkStore';
import type { Work } from '@/types/work';

const formatDuration = (startTime: string, endTime?: string) => {
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : new Date();
  const durationMs = end.getTime() - start.getTime();

  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
};

const formatDateTime = (dateTime: string) => {
  return new Date(dateTime).toLocaleString();
};

interface TabularViewProps {
  filteredWorks: Work[];
  isLoading: boolean;
  onRefresh: () => void;
}

export const TabularView: React.FC<TabularViewProps> = ({
  filteredWorks,
  isLoading,
  onRefresh
}) => {
  const intl = useIntl();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchText, setSearchText] = useState('');

  // Get unique categories from filtered works
  const categories = Array.from(new Set(filteredWorks.map(work => work.category)));

  // Apply additional filters on top of time range filtering
  const doubleFilteredWorks = filteredWorks.filter(work => {
    const matchesCategory = filterCategory === 'all' || work.category === filterCategory;
    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'active' && !work.endedAt) ||
      (filterStatus === 'completed' && work.endedAt);
    const matchesSearch = searchText === '' ||
      work.description.toLowerCase().includes(searchText.toLowerCase());

    return matchesCategory && matchesStatus && matchesSearch;
  });

  // Paginated works
  const paginatedWorks = doubleFilteredWorks.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box>
      {/* Controls */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={onRefresh}
            disabled={isLoading}
          >
            {intl.formatMessage({ id: 'work.table.refresh' }, { defaultMessage: 'Refresh' })}
          </Button>

          <TextField
            size="small"
            label={intl.formatMessage({ id: 'work.table.search' }, { defaultMessage: 'Search' })}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            sx={{ minWidth: 200 }}
          />

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>{intl.formatMessage({ id: 'work.table.category' }, { defaultMessage: 'Category' })}</InputLabel>
            <Select
              value={filterCategory}
              label={intl.formatMessage({ id: 'work.table.category' }, { defaultMessage: 'Category' })}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <MenuItem value="all">{intl.formatMessage({ id: 'work.table.allCategories' }, { defaultMessage: 'All Categories' })}</MenuItem>
              {categories.map(category => (
                <MenuItem key={category} value={category}>
                  {category}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>{intl.formatMessage({ id: 'work.table.status' }, { defaultMessage: 'Status' })}</InputLabel>
            <Select
              value={filterStatus}
              label={intl.formatMessage({ id: 'work.table.status' }, { defaultMessage: 'Status' })}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <MenuItem value="all">{intl.formatMessage({ id: 'work.table.allStatus' }, { defaultMessage: 'All Status' })}</MenuItem>
              <MenuItem value="active">{intl.formatMessage({ id: 'work.active' }, { defaultMessage: 'Active' })}</MenuItem>
              <MenuItem value="completed">{intl.formatMessage({ id: 'work.completed' }, { defaultMessage: 'Completed' })}</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Work Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{intl.formatMessage({ id: 'work.table.description' }, { defaultMessage: 'Description' })}</TableCell>
                <TableCell>{intl.formatMessage({ id: 'work.table.category' }, { defaultMessage: 'Category' })}</TableCell>
                <TableCell>{intl.formatMessage({ id: 'work.table.status' }, { defaultMessage: 'Status' })}</TableCell>
                <TableCell>{intl.formatMessage({ id: 'work.table.started' }, { defaultMessage: 'Started' })}</TableCell>
                <TableCell>{intl.formatMessage({ id: 'work.table.ended' }, { defaultMessage: 'Ended' })}</TableCell>
                <TableCell>{intl.formatMessage({ id: 'work.table.duration' }, { defaultMessage: 'Duration' })}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedWorks.map((work) => (
                <TableRow key={work.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {work.description}
                    </Typography>
                    {work.sessionId && (
                      <Typography variant="caption" color="text.secondary">
                        {intl.formatMessage({ id: 'work.table.chatSession' }, { defaultMessage: 'Chat Session' })}: {work.sessionId}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={work.category}
                      size="small"
                      variant="outlined"
                      color={work.category === 'general' ? 'default' : 'primary'}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={work.endedAt ? intl.formatMessage({ id: 'work.completed' }, { defaultMessage: 'Completed' }) : intl.formatMessage({ id: 'work.active' }, { defaultMessage: 'Active' })}
                      size="small"
                      color={work.endedAt ? 'success' : 'warning'}
                      variant={work.endedAt ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDateTime(work.createdAt)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {work.endedAt ? formatDateTime(work.endedAt) : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {formatDuration(work.createdAt, work.endedAt)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={doubleFilteredWorks.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </Paper>
    </Box>
  );
};
