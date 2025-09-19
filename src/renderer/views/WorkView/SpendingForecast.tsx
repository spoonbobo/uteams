/* eslint-disable */
import { useMemo, useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
  alpha,
  CircularProgress,
  Button,
  Stack,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  AttachMoney as MoneyIcon,
  Work as WorkIcon,
  Category as CategoryIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import { useIntl } from 'react-intl';
import type { Work } from '@/types/work';

// Mock pricing configuration
const PRICING = {
  ask: 0.1, // $0.10 per ask query
  grading: 0.2, // $0.20 per grading task
  general: 0.05, // $0.05 per general task
} as const;

interface SpendingForecastProps {
  filteredWorks: Work[];
}

// Helper function to calculate cost for a work item
const calculateWorkCost = (work: Work): number => {
  return PRICING[work.category as keyof typeof PRICING] || PRICING.general;
};

// Helper function to format currency
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
};

// Helper function to get category color
const getCategoryColor = (
  category: string,
): 'primary' | 'secondary' | 'default' => {
  if (category === 'ask') return 'primary';
  if (category === 'grading') return 'secondary';
  return 'default';
};

// Helper function to get category description
const getCategoryDescription = (category: string): string => {
  if (category === 'ask') return 'Ask Query';
  if (category === 'grading') return 'Grading Task';
  return 'General Task';
};

// Helper function to group works by date
const groupWorksByDate = (works: Work[]): Record<string, Work[]> => {
  return works.reduce(
    (acc, work) => {
      const date = new Date(work.createdAt).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(work);
      return acc;
    },
    {} as Record<string, Work[]>,
  );
};

// ECharts-based spending trend chart
function SpendingTrendChart({
  data,
  forecastData,
  onForecast,
  isForecasting,
}: {
  data: Array<{ date: string; amount: number }>;
  forecastData: Array<{ date: string; amount: number; isForecast: boolean }> | null;
  onForecast: () => void;
  isForecasting: boolean;
}) {
  const theme = useTheme();
  const [echarts, setEcharts] = useState<any>(null);
  const chartId = 'spending-trend-chart';

  useEffect(() => {
    // Dynamic import of echarts
    import('echarts').then((echartsModule) => {
      setEcharts(echartsModule);
    });
  }, []);

  useEffect(() => {
    if (!echarts || data.length === 0) return;

    const chartDom = document.getElementById(chartId);
    if (chartDom) {
      const myChart = echarts.init(chartDom, theme.palette.mode);

      // Use forecast data if available, otherwise use original data
      const displayData = forecastData || data;
      const historicalData = displayData.filter(d => !('isForecast' in d) || !d.isForecast);
      const forecastPoints = displayData.filter(d => 'isForecast' in d && d.isForecast);

      const allDates = displayData.map((d) => new Date(d.date).toLocaleDateString());

      const series: any[] = [
        {
          name: 'Historical Spending',
          type: 'line',
          data: historicalData.map((d) => d.amount),
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          itemStyle: {
            color: theme.palette.primary.main,
          },
          lineStyle: {
            color: theme.palette.primary.main,
            width: 3,
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: alpha(theme.palette.primary.main, 0.3) },
                { offset: 1, color: alpha(theme.palette.primary.main, 0.1) },
              ],
            },
          },
        },
      ];

      // Add forecast series if we have forecast data
      if (forecastPoints.length > 0) {
        // Create data array with nulls for historical points and values for forecast
        const forecastSeriesData = displayData.map((d, index) => {
          if ('isForecast' in d && d.isForecast) {
            return d.amount;
          }
          // Add connection point from last historical data
          if (index === historicalData.length - 1) {
            return d.amount;
          }
          return null;
        });

        series.push({
          name: 'Forecast',
          type: 'line',
          data: forecastSeriesData,
          smooth: true,
          symbol: 'diamond',
          symbolSize: 8,
          itemStyle: {
            color: theme.palette.warning.main,
          },
          lineStyle: {
            color: theme.palette.warning.main,
            width: 2,
            type: 'dashed',
          },
          connectNulls: true,
        });
      }

      const option = {
        title: {
          text: 'Daily Spending Trend',
          textStyle: { color: theme.palette.text.primary, fontSize: 16 },
          left: 'center',
        },
        tooltip: {
          trigger: 'axis',
          formatter: (params: any) => {
            let result = '';
            params.forEach((param: any) => {
              if (param.value !== null) {
                const isForecast = param.seriesName === 'Forecast';
                result += `${param.axisValue}<br/>${param.seriesName}: ${formatCurrency(param.value)}${isForecast ? ' (Predicted)' : ''}`;
              }
            });
            return result;
          },
        },
        legend: {
          data: series.map(s => s.name),
          bottom: 0,
          textStyle: { color: theme.palette.text.primary },
        },
        xAxis: {
          type: 'category',
          data: allDates,
          axisLabel: {
            color: theme.palette.text.secondary,
            rotate: allDates.length > 7 ? 45 : 0,
          },
          axisLine: { lineStyle: { color: theme.palette.divider } },
        },
        yAxis: {
          type: 'value',
          name: 'Amount (USD)',
          nameTextStyle: { color: theme.palette.text.secondary },
          axisLabel: {
            color: theme.palette.text.secondary,
            formatter: (value: number) => formatCurrency(value),
          },
          axisLine: { lineStyle: { color: theme.palette.divider } },
          splitLine: {
            lineStyle: { color: alpha(theme.palette.divider, 0.3) },
          },
        },
        series,
        backgroundColor: 'transparent',
        grid: {
          left: '3%',
          right: '4%',
          bottom: '15%',
          top: '15%',
          containLabel: true,
        },
      };

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
  }, [echarts, data, forecastData, theme]);

  if (data.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No data available for chart
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Forecast Button */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          startIcon={<TimelineIcon />}
          onClick={onForecast}
          disabled={isForecasting || data.length < 1}
          size="small"
        >
          {isForecasting ? 'Forecasting...' : 'Generate Forecast'}
        </Button>
      </Box>

      {/* Chart */}
      <Box sx={{ height: 350, position: 'relative' }}>
        {!echarts ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
            }}
          >
            <CircularProgress />
          </Box>
        ) : (
          <Box
            id={chartId}
            sx={{
              width: '100%',
              height: '100%',
            }}
          />
        )}
      </Box>
    </Box>
  );
}

// ECharts-based category pie chart
function CategoryPieChart({
  costByCategory,
}: {
  costByCategory: Record<string, { count: number; cost: number }>;
}) {
  const theme = useTheme();
  const [echarts, setEcharts] = useState<any>(null);
  const chartId = 'category-pie-chart';

  useEffect(() => {
    // Dynamic import of echarts
    import('echarts').then((echartsModule) => {
      setEcharts(echartsModule);
    });
  }, []);

  useEffect(() => {
    if (!echarts || Object.keys(costByCategory).length === 0) return;

    const chartDom = document.getElementById(chartId);
    if (chartDom) {
      const myChart = echarts.init(chartDom, theme.palette.mode);

      const pieData = Object.entries(costByCategory).map(
        ([category, data]) => ({
          name: category,
          value: data.cost,
          count: data.count,
        }),
      );

      const option = {
        tooltip: {
          trigger: 'item',
          formatter: (params: any) => {
            return `${params.name}<br/>Cost: ${formatCurrency(params.value)}<br/>Items: ${params.data.count}<br/>Percentage: ${params.percent}%`;
          },
        },
        legend: {
          orient: 'horizontal',
          bottom: '5%',
          textStyle: { color: theme.palette.text.primary },
        },
        series: [
          {
            name: 'Cost by Category',
            type: 'pie',
            radius: ['30%', '70%'],
            center: ['50%', '40%'],
            data: pieData,
            itemStyle: {
              color: (params: any) => {
                const colors = {
                  ask: theme.palette.primary.main,
                  grading: theme.palette.secondary.main,
                  general: theme.palette.info.main,
                };
                return (
                  colors[params.name as keyof typeof colors] ||
                  theme.palette.grey[500]
                );
              },
            },
            label: {
              show: true,
              formatter: (params: any) => {
                return `${params.name}\n${formatCurrency(params.value)}`;
              },
              color: theme.palette.text.primary,
            },
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
  }, [echarts, costByCategory, theme]);

  if (Object.keys(costByCategory).length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No category data available
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: 250, position: 'relative' }}>
      {!echarts ? (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
          }}
        >
          <CircularProgress />
        </Box>
      ) : (
        <Box
          id={chartId}
          sx={{
            width: '100%',
            height: '100%',
          }}
        />
      )}
    </Box>
  );
}

export default function SpendingForecastView({
  filteredWorks,
}: SpendingForecastProps) {
  const intl = useIntl();
  const theme = useTheme();
  const [forecastData, setForecastData] = useState<Array<{ date: string; amount: number; isForecast: boolean }> | null>(null);
  const [isForecasting, setIsForecasting] = useState(false);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalWorks = filteredWorks.length;
    const totalCost = filteredWorks.reduce(
      (sum, work) => sum + calculateWorkCost(work),
      0,
    );
    const averageCostPerWork = totalWorks > 0 ? totalCost / totalWorks : 0;

    // Group by category
    const costByCategory = filteredWorks.reduce(
      (acc, work) => {
        const { category } = work;
        const cost = calculateWorkCost(work);
        if (!acc[category]) {
          acc[category] = { count: 0, cost: 0 };
        }
        acc[category].count += 1;
        acc[category].cost += cost;
        return acc;
      },
      {} as Record<string, { count: number; cost: number }>,
    );

    // Generate time series data (daily spending)
    const worksByDate = groupWorksByDate(filteredWorks);
    const timeSeriesData = Object.entries(worksByDate)
      .map(([date, works]) => ({
        date,
        amount: works.reduce((sum, work) => sum + calculateWorkCost(work), 0),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalWorks,
      totalCost,
      averageCostPerWork,
      costByCategory,
      timeSeriesData,
    };
  }, [filteredWorks]);

  // Handle forecast generation
  const handleForecast = async () => {
    if (stats.timeSeriesData.length < 1) {
      return;
    }

    setIsForecasting(true);
    try {
      // Use ORT forecasting service
      const result = await window.electron.ort.forecastTimeSeries(stats.timeSeriesData, 7);

      if (result && !('error' in result)) {
        setForecastData(result);
      } else {
        console.error('Forecasting failed:', result);
        // Fallback to simple client-side forecasting
        const fallbackForecast = generateSimpleForecast(stats.timeSeriesData, 7);
        setForecastData(fallbackForecast);
      }
    } catch (error) {
      console.error('Forecast error:', error);
      // Fallback to simple client-side forecasting
      const fallbackForecast = generateSimpleForecast(stats.timeSeriesData, 7);
      setForecastData(fallbackForecast);
    } finally {
      setIsForecasting(false);
    }
  };

  // Simple client-side forecast fallback
  const generateSimpleForecast = (
    timeSeriesData: Array<{ date: string; amount: number }>,
    forecastDays: number = 7
  ): Array<{ date: string; amount: number; isForecast: boolean }> => {
    const result: Array<{ date: string; amount: number; isForecast: boolean }> = [];

    // Add historical data
    timeSeriesData.forEach(d => {
      result.push({ ...d, isForecast: false });
    });

    if (timeSeriesData.length < 1) {
      return result;
    }

    // Handle forecasting logic
    const n = timeSeriesData.length;
    let slope = 0;
    let intercept = 0;

    if (n === 1) {
      // For single data point, assume flat trend with slight variation
      slope = 0;
      intercept = timeSeriesData[0].amount;
    } else {
      // Simple linear regression for multiple points
      const x = timeSeriesData.map((_, i) => i);
      const y = timeSeriesData.map(d => d.amount);

      const sumX = x.reduce((a, b) => a + b, 0);
      const sumY = y.reduce((a, b) => a + b, 0);
      const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
      const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

      slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      intercept = (sumY - slope * sumX) / n;
    }

    // Generate forecast points
    const lastDate = new Date(timeSeriesData[timeSeriesData.length - 1].date);

    for (let i = 1; i <= forecastDays; i++) {
      const forecastDate = new Date(lastDate);
      forecastDate.setDate(forecastDate.getDate() + i);

      const forecastValue = slope * (n + i - 1) + intercept;

      // Add some randomness
      let noise = 0;
      if (n === 1) {
        // For single data point, add more variation to show trend possibilities
        noise = (Math.random() - 0.5) * 0.3 * forecastValue;
      } else {
        // For multiple points, use standard noise
        noise = (Math.random() - 0.5) * 0.1 * forecastValue;
      }

      const adjustedValue = Math.max(0, forecastValue + noise);

      result.push({
        date: forecastDate.toISOString().split('T')[0],
        amount: adjustedValue,
        isForecast: true,
      });
    }

    return result;
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          {intl.formatMessage(
            { id: 'work.spendingForecast.title' },
            { defaultMessage: 'Spending Forecast' },
          )}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {intl.formatMessage(
            { id: 'work.spendingForecast.subtitle' },
            { defaultMessage: 'Cost analysis and spending trends' },
          )}
        </Typography>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <WorkIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6" color="primary">
                  {stats.totalWorks}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {intl.formatMessage(
                  { id: 'work.spendingForecast.totalWorks' },
                  { defaultMessage: 'Total Work Items' },
                )}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <MoneyIcon color="success" sx={{ mr: 1 }} />
                <Typography variant="h6" color="success.main">
                  {formatCurrency(stats.totalCost)}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {intl.formatMessage(
                  { id: 'work.spendingForecast.totalCost' },
                  { defaultMessage: 'Total Cost' },
                )}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TrendingUpIcon color="info" sx={{ mr: 1 }} />
                <Typography variant="h6" color="info.main">
                  {formatCurrency(stats.averageCostPerWork)}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {intl.formatMessage(
                  { id: 'work.spendingForecast.averageCostPerWork' },
                  { defaultMessage: 'Average Cost per Work' },
                )}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <CategoryIcon color="warning" sx={{ mr: 1 }} />
                <Typography variant="h6" color="warning.main">
                  {Object.keys(stats.costByCategory).length}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Categories Used
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Spending Trend Chart */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {intl.formatMessage(
                { id: 'work.spendingForecast.spendingTrend' },
                { defaultMessage: 'Spending Trend' },
              )}
            </Typography>
            <SpendingTrendChart
              data={stats.timeSeriesData}
              forecastData={forecastData}
              onForecast={handleForecast}
              isForecasting={isForecasting}
            />
          </Paper>
        </Grid>

        {/* Cost by Category - ECharts Pie Chart */}
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              {intl.formatMessage(
                { id: 'work.spendingForecast.costByCategory' },
                { defaultMessage: 'Cost by Category' },
              )}
            </Typography>
            <CategoryPieChart costByCategory={stats.costByCategory} />
          </Paper>
        </Grid>

        {/* Pricing Table */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {intl.formatMessage(
                { id: 'work.spendingForecast.pricingStructure.title' },
                { defaultMessage: 'Pricing Structure' },
              )}
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>
                      {intl.formatMessage(
                        {
                          id: 'work.spendingForecast.pricingStructure.category',
                        },
                        { defaultMessage: 'Category' },
                      )}
                    </TableCell>
                    <TableCell>
                      {intl.formatMessage(
                        {
                          id: 'work.spendingForecast.pricingStructure.description',
                        },
                        { defaultMessage: 'Description' },
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {intl.formatMessage(
                        {
                          id: 'work.spendingForecast.pricingStructure.pricePerUnit',
                        },
                        { defaultMessage: 'Price per Unit' },
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {intl.formatMessage(
                        {
                          id: 'work.spendingForecast.pricingStructure.worksInDataset',
                        },
                        { defaultMessage: 'Works in Dataset' },
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {intl.formatMessage(
                        {
                          id: 'work.spendingForecast.pricingStructure.totalCost',
                        },
                        { defaultMessage: 'Total Cost' },
                      )}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(PRICING).map(([category, price]) => {
                    const categoryData = stats.costByCategory[category];
                    const count = categoryData?.count || 0;
                    const totalCost = categoryData?.cost || 0;

                    return (
                      <TableRow key={category}>
                        <TableCell>
                          <Chip
                            label={category}
                            size="small"
                            color={getCategoryColor(category)}
                          />
                        </TableCell>
                        <TableCell>
                          {intl.formatMessage(
                            { id: `work.spendingForecast.pricing.${category}` },
                            {
                              defaultMessage: getCategoryDescription(category),
                            },
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={500}>
                            {formatCurrency(price)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">{count}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={500}>
                            {formatCurrency(totalCost)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
