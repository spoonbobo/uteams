import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  TextField,
  Button,
} from '@mui/material';
import {
  DateRange as DateRangeIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useIntl } from 'react-intl';
import { useWorkStore, type TimeRange, type CustomTimeRange } from '@/stores/useWorkStore';
import type { Work } from '@/types/work';
import { HTabsPanel, HTabPanel, type TabSection } from '@/components/HTabsPanel';
import { GraphView } from './GraphPanel';
import { TabularView } from './TabularPanel';
import SpendingForecastView from './SpendingForecast';

// Time Range Selector Component
const TimeRangeSelector: React.FC<{
  timeRange: TimeRange;
  customRange: CustomTimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  onCustomRangeChange: (range: CustomTimeRange) => void;
  onRefresh: () => void;
  isLoading: boolean;
}> = ({ timeRange, customRange, onTimeRangeChange, onCustomRangeChange, onRefresh, isLoading }) => {
  const intl = useIntl();

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        <DateRangeIcon color="primary" />

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>{intl.formatMessage({ id: 'work.timeRange.title' }, { defaultMessage: 'Time Range' })}</InputLabel>
          <Select
            value={timeRange}
            label={intl.formatMessage({ id: 'work.timeRange.title' }, { defaultMessage: 'Time Range' })}
            onChange={(e) => onTimeRangeChange(e.target.value as TimeRange)}
          >
            <MenuItem value="all">{intl.formatMessage({ id: 'work.timeRange.all' }, { defaultMessage: 'All Time' })}</MenuItem>
            <MenuItem value="today">{intl.formatMessage({ id: 'work.timeRange.today' }, { defaultMessage: 'Today' })}</MenuItem>
            <MenuItem value="week">{intl.formatMessage({ id: 'work.timeRange.week' }, { defaultMessage: 'Last 7 Days' })}</MenuItem>
            <MenuItem value="month">{intl.formatMessage({ id: 'work.timeRange.month' }, { defaultMessage: 'This Month' })}</MenuItem>
            <MenuItem value="custom">{intl.formatMessage({ id: 'work.timeRange.custom' }, { defaultMessage: 'Custom Range' })}</MenuItem>
          </Select>
        </FormControl>

        {timeRange === 'custom' && (
          <>
            <TextField
              size="small"
              type="date"
              label={intl.formatMessage({ id: 'work.timeRange.startDate' }, { defaultMessage: 'Start Date' })}
              value={customRange.startDate.split('T')[0]}
              onChange={(e) => onCustomRangeChange({
                ...customRange,
                startDate: new Date(e.target.value).toISOString(),
              })}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              size="small"
              type="date"
              label={intl.formatMessage({ id: 'work.timeRange.endDate' }, { defaultMessage: 'End Date' })}
              value={customRange.endDate.split('T')[0]}
              onChange={(e) => onCustomRangeChange({
                ...customRange,
                endDate: new Date(e.target.value + 'T23:59:59').toISOString(),
              })}
              InputLabelProps={{ shrink: true }}
            />
          </>
        )}

        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={onRefresh}
          disabled={isLoading}
        >
          {intl.formatMessage({ id: 'work.refresh' }, { defaultMessage: 'Refresh' })}
        </Button>
      </Stack>
    </Paper>
  );
};


export const WorkView: React.FC = () => {
  const intl = useIntl();
  const { works, isLoading, loadWorks, loadWorksByTimeRange, filterWorksByTimeRange } = useWorkStore();

  const [selectedTab, setSelectedTab] = useState(0);
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [customRange, setCustomRange] = useState<CustomTimeRange>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    endDate: new Date().toISOString(),
  });

  // Load works on mount
  useEffect(() => {
    loadWorks();
  }, [loadWorks]);

  // Filter works based on time range
  const filteredWorks = useMemo(() => {
    return filterWorksByTimeRange(timeRange, timeRange === 'custom' ? customRange : undefined);
  }, [works, timeRange, customRange, filterWorksByTimeRange]);

  // Handle time range change
  const handleTimeRangeChange = (newTimeRange: TimeRange) => {
    setTimeRange(newTimeRange);
  };

  // Handle custom range change
  const handleCustomRangeChange = (newCustomRange: CustomTimeRange) => {
    setCustomRange(newCustomRange);
  };

  // Handle refresh
  const handleRefresh = () => {
    if (timeRange === 'all') {
      loadWorks();
    } else {
      loadWorksByTimeRange(timeRange, timeRange === 'custom' ? customRange : undefined);
    }
  };

  // Define the tab sections with shared filtered data
  const sections: TabSection[] = [
    {
      id: 'tabular',
      title: intl.formatMessage({ id: 'work.tabs.tabular' }, { defaultMessage: 'Tabular' }),
      component: (
        <HTabPanel
          title={intl.formatMessage({ id: 'work.tabs.tabular' }, { defaultMessage: 'Tabular' })}
          controlsConfig={{}}
        >
          <TabularView
            filteredWorks={filteredWorks}
            isLoading={isLoading}
            onRefresh={handleRefresh}
          />
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
          <GraphView filteredWorks={filteredWorks} />
        </HTabPanel>
      ),
    },
    {
      id: 'spendingForecast',
      title: intl.formatMessage({ id: 'work.tabs.spendingForecast' }, { defaultMessage: 'Spending Forecast' }),
      component: (
        <HTabPanel
          title={intl.formatMessage({ id: 'work.tabs.spendingForecast' }, { defaultMessage: 'Spending Forecast' })}
          controlsConfig={{}}
        >
          <SpendingForecastView filteredWorks={filteredWorks} />
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
        maxWidth: 'xl', // Same as CourseView
        mx: 'auto',
        boxSizing: 'border-box',
        backgroundColor: 'inherit',
      }}
    >
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          {intl.formatMessage({ id: 'work.title' }, { defaultMessage: 'Agent Work' })}
        </Typography>
      </Box>

      {/* Time Range Selector */}
      <TimeRangeSelector
        timeRange={timeRange}
        customRange={customRange}
        onTimeRangeChange={handleTimeRangeChange}
        onCustomRangeChange={handleCustomRangeChange}
        onRefresh={handleRefresh}
        isLoading={isLoading}
      />

      {/* Horizontal Tabs Panel */}
      <HTabsPanel
        sections={sections}
        selectedTab={selectedTab}
        onTabChange={handleTabChange}
      />
    </Box>
  );
};
