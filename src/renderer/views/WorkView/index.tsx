import React, { useEffect, useState } from 'react';
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
import { HTabsPanel, HTabPanel, type TabSection } from '@/components/HTabsPanel';
import { GraphView } from './Graph';

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

// Tabular view component
const TabularView: React.FC = () => {
  const intl = useIntl();
  const {
    works,
    isLoading,
    loadWorks,
  } = useWorkStore();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchText, setSearchText] = useState('');

  // Load works on mount
  useEffect(() => {
    loadWorks();
  }, [loadWorks]);

  // Get unique categories from works
  const categories = Array.from(new Set(works.map(work => work.category)));

  // Filter works based on current filters
  const filteredWorks = works.filter(work => {
    const matchesCategory = filterCategory === 'all' || work.category === filterCategory;
    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'active' && !work.endedAt) ||
      (filterStatus === 'completed' && work.endedAt);
    const matchesSearch = searchText === '' ||
      work.description.toLowerCase().includes(searchText.toLowerCase());

    return matchesCategory && matchesStatus && matchesSearch;
  });

  // Paginated works
  const paginatedWorks = filteredWorks.slice(
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
            onClick={loadWorks}
            disabled={isLoading}
          >
            Refresh
          </Button>

          <TextField
            size="small"
            label="Search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            sx={{ minWidth: 200 }}
          />

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={filterCategory}
              label="Category"
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <MenuItem value="all">All Categories</MenuItem>
              {categories.map(category => (
                <MenuItem key={category} value={category}>
                  {category}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filterStatus}
              label="Status"
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
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
                <TableCell>Description</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Started</TableCell>
                <TableCell>Ended</TableCell>
                <TableCell>Duration</TableCell>
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
                        Chat Session: {work.sessionId}
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
                      label={work.endedAt ? 'Completed' : 'Active'}
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
          count={filteredWorks.length}
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

// Graphs view component
const GraphsView: React.FC = () => {
  return <GraphView />;
};

// Price Table view component (placeholder)
const PriceTableView: React.FC = () => {
  const intl = useIntl();

  return (
    <Box sx={{ p: 4, textAlign: 'center' }}>
      <Typography variant="h5" color="text.secondary" gutterBottom>
        {intl.formatMessage({ id: 'work.priceTable.title' }, { defaultMessage: 'Price Table' })}
      </Typography>
      <Typography variant="body1" color="text.secondary">
        {intl.formatMessage({ id: 'work.priceTable.comingSoon' }, { defaultMessage: 'Coming soon - Task pricing and cost analysis' })}
      </Typography>
    </Box>
  );
};

export const WorkView: React.FC = () => {
  const intl = useIntl();
  const [selectedTab, setSelectedTab] = useState(0);

  // Define the tab sections
  const sections: TabSection[] = [
    {
      id: 'tabular',
      title: intl.formatMessage({ id: 'work.tabs.tabular' }, { defaultMessage: 'Tabular' }),
      component: (
        <HTabPanel
          title={intl.formatMessage({ id: 'work.tabs.tabular' }, { defaultMessage: 'Tabular' })}
          controlsConfig={{}}
        >
          <TabularView />
        </HTabPanel>
      ),
    },
    {
      id: 'graphs',
      title: intl.formatMessage({ id: 'work.tabs.graphs' }, { defaultMessage: 'Graphs' }),
      component: (
        <HTabPanel
          title={intl.formatMessage({ id: 'work.tabs.graphs' }, { defaultMessage: 'Graphs' })}
          controlsConfig={{}}
        >
          <GraphsView />
        </HTabPanel>
      ),
    },
    {
      id: 'priceTable',
      title: intl.formatMessage({ id: 'work.tabs.priceTable' }, { defaultMessage: 'Price Table' }),
      component: (
        <HTabPanel
          title={intl.formatMessage({ id: 'work.tabs.priceTable' }, { defaultMessage: 'Price Table' })}
          controlsConfig={{}}
        >
          <PriceTableView />
        </HTabPanel>
      ),
    },
  ];

  // Handle tab change
  const handleTabChange = (newValue: number) => {
    setSelectedTab(newValue);
  };

  return (
    <Box
      sx={{
        p: 4,
        maxWidth: 'xl', // Same as CourseView for consistency
        mx: 'auto',
        boxSizing: 'border-box',
        backgroundColor: 'inherit',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        // Hide scrollbars globally for this view
        '& *': {
          '&::-webkit-scrollbar': {
            display: 'none', // Hide scrollbar for WebKit browsers
          },
          scrollbarWidth: 'none', // Hide scrollbar for Firefox
          msOverflowStyle: 'none', // Hide scrollbar for IE/Edge
        },
      }}
    >
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          {intl.formatMessage({ id: 'work.title' }, { defaultMessage: 'Agent Task Tracking' })}
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
