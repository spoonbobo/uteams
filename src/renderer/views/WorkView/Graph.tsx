import React, { useEffect, useMemo, useState } from 'react';
import { Box, Paper, Typography, Grid, useTheme, CircularProgress } from '@mui/material';
import { useIntl } from 'react-intl';
import { useWorkStore } from '@/stores/useWorkStore';

// Chart component wrapper
const ChartContainer: React.FC<{
  title: string;
  chartId: string;
  option: any;
}> = ({ title, chartId, option }) => {
  const theme = useTheme();
  const [echarts, setEcharts] = useState<any>(null);

  useEffect(() => {
    // Dynamic import of echarts
    import('echarts').then((echartsModule) => {
      setEcharts(echartsModule);
    });
  }, []);

  useEffect(() => {
    if (!echarts) return;

    const chartDom = document.getElementById(chartId);
    if (chartDom) {
      const myChart = echarts.init(chartDom, theme.palette.mode);
      myChart.setOption(option);

      const handleResize = () => {
        myChart.resize();
      };

      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
        myChart.dispose();
      };
    }
  }, [chartId, option, theme.palette.mode, echarts]);

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ mb: 2, fontWeight: 600 }}>
        {title}
      </Typography>
      {!echarts ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box
          id={chartId}
          sx={{
            width: '100%',
            height: 400,
          }}
        />
      )}
    </Paper>
  );
};

export const GraphView: React.FC = () => {
  const intl = useIntl();
  const theme = useTheme();
  const { works, loadWorks } = useWorkStore();

  // Load works on mount
  useEffect(() => {
    loadWorks();
  }, [loadWorks]);

  // Calculate duration in minutes for a work item
  const calculateDuration = (work: any) => {
    const start = new Date(work.createdAt);
    const end = work.endedAt ? new Date(work.endedAt) : new Date();
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60)); // minutes
  };

  // Chart data calculations
  const chartData = useMemo(() => {
    if (!works.length) return null;

    // 1. Category Distribution (Pie Chart)
    const categoryData = works.reduce((acc: any, work) => {
      acc[work.category] = (acc[work.category] || 0) + 1;
      return acc;
    }, {});

    const categoryPieData = Object.entries(categoryData).map(([name, value]) => ({
      name,
      value,
    }));

    // 2. Daily Work Count (Bar Chart)
    const dailyData = works.reduce((acc: any, work) => {
      const date = new Date(work.createdAt).toDateString();
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    const sortedDates = Object.keys(dailyData).sort((a, b) =>
      new Date(a).getTime() - new Date(b).getTime()
    ).slice(-14); // Last 14 days

    const dailyBarData = sortedDates.map(date => ({
      date: new Date(date).toLocaleDateString(),
      count: dailyData[date],
    }));

    // 3. Work Duration Analysis (Scatter Plot)
    const durationData = works
      .filter(work => work.endedAt) // Only completed works
      .map((work, index) => ({
        value: [index, calculateDuration(work)],
        category: work.category,
        description: work.description.length > 50 ? work.description.substring(0, 50) + '...' : work.description,
        duration: calculateDuration(work),
      }));

    // 4. Status Distribution (Donut Chart)
    const activeCount = works.filter(work => !work.endedAt).length;
    const completedCount = works.filter(work => work.endedAt).length;
    const statusData = [
      { name: 'Active', value: activeCount },
      { name: 'Completed', value: completedCount },
    ];

    // 5. Average Duration by Category (Horizontal Bar)
    const categoryDurations = works
      .filter(work => work.endedAt)
      .reduce((acc: any, work) => {
        const duration = calculateDuration(work);
        if (!acc[work.category]) {
          acc[work.category] = { total: 0, count: 0 };
        }
        acc[work.category].total += duration;
        acc[work.category].count += 1;
        return acc;
      }, {});

    const avgDurationData = Object.entries(categoryDurations).map(([category, data]: [string, any]) => ({
      category,
      avgDuration: Math.round(data.total / data.count),
    }));

    return {
      categoryPieData,
      dailyBarData,
      durationData,
      statusData,
      avgDurationData,
    };
  }, [works]);

  if (!chartData) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          {intl.formatMessage({ id: 'work.graphs.noData' }, { defaultMessage: 'No data available for charts' })}
        </Typography>
      </Box>
    );
  }

  // Chart options
  const categoryPieOption = {
    title: {
      text: 'Tasks by Category',
      left: 'center',
      textStyle: { color: theme.palette.text.primary },
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      textStyle: { color: theme.palette.text.primary },
    },
    series: [
      {
        name: 'Categories',
        type: 'pie',
        radius: '50%',
        data: chartData.categoryPieData,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
      },
    ],
    backgroundColor: 'transparent',
  };

  const dailyBarOption = {
    title: {
      text: 'Daily Task Count (Last 14 Days)',
      textStyle: { color: theme.palette.text.primary },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    xAxis: {
      type: 'category',
      data: chartData.dailyBarData.map(d => d.date),
      axisLabel: { color: theme.palette.text.secondary },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: theme.palette.text.secondary },
    },
    series: [
      {
        name: 'Tasks',
        type: 'bar',
        data: chartData.dailyBarData.map(d => d.count),
        itemStyle: {
          color: theme.palette.primary.main,
        },
      },
    ],
    backgroundColor: 'transparent',
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
  };

  const durationScatterOption = {
    title: {
      text: 'Task Duration Distribution',
      textStyle: { color: theme.palette.text.primary },
    },
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const data = params.data;
        return `${data.description}<br/>Duration: ${data.duration} minutes<br/>Category: ${data.category}`;
      },
    },
    xAxis: {
      type: 'value',
      name: 'Task Index',
      nameTextStyle: { color: theme.palette.text.secondary },
      axisLabel: { color: theme.palette.text.secondary },
    },
    yAxis: {
      type: 'value',
      name: 'Duration (minutes)',
      nameTextStyle: { color: theme.palette.text.secondary },
      axisLabel: { color: theme.palette.text.secondary },
    },
    series: [
      {
        name: 'Duration',
        type: 'scatter',
        data: chartData.durationData,
        itemStyle: {
          color: theme.palette.secondary.main,
        },
        symbolSize: 8,
      },
    ],
    backgroundColor: 'transparent',
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
  };

  const statusDonutOption = {
    title: {
      text: 'Task Status Distribution',
      left: 'center',
      textStyle: { color: theme.palette.text.primary },
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      textStyle: { color: theme.palette.text.primary },
    },
    series: [
      {
        name: 'Status',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        data: chartData.statusData,
        itemStyle: {
          color: (params: any) =>
            params.name === 'Active' ? theme.palette.warning.main : theme.palette.success.main,
        },
      },
    ],
    backgroundColor: 'transparent',
  };

  const avgDurationOption = {
    title: {
      text: 'Average Duration by Category',
      textStyle: { color: theme.palette.text.primary },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: '{b}: {c} minutes',
    },
    xAxis: {
      type: 'value',
      axisLabel: { color: theme.palette.text.secondary },
    },
    yAxis: {
      type: 'category',
      data: chartData.avgDurationData.map(d => d.category),
      axisLabel: { color: theme.palette.text.secondary },
    },
    series: [
      {
        name: 'Avg Duration',
        type: 'bar',
        data: chartData.avgDurationData.map(d => d.avgDuration),
        itemStyle: {
          color: theme.palette.info.main,
        },
      },
    ],
    backgroundColor: 'transparent',
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 600 }}>
        {intl.formatMessage({ id: 'work.graphs.title' }, { defaultMessage: 'Task Analytics' })}
      </Typography>

      {/* Row 1: Category Distribution */}
      <ChartContainer
        title="Category Distribution"
        chartId="categoryPieChart"
        option={categoryPieOption}
      />

      {/* Row 2: Daily Task Count */}
      <ChartContainer
        title="Daily Task Count"
        chartId="dailyBarChart"
        option={dailyBarOption}
      />

      {/* Row 3: Task Duration Distribution */}
      <ChartContainer
        title="Task Duration Analysis"
        chartId="durationScatterChart"
        option={durationScatterOption}
      />

      {/* Row 4: Status Distribution */}
      <ChartContainer
        title="Status Distribution"
        chartId="statusDonutChart"
        option={statusDonutOption}
      />

      {/* Row 5: Average Duration by Category */}
      <ChartContainer
        title="Average Duration by Category"
        chartId="avgDurationChart"
        option={avgDurationOption}
      />
    </Box>
  );
};
