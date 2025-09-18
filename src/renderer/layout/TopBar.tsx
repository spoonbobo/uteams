import React from 'react';
import {
  Box,
  IconButton,
  Breadcrumbs,
  Typography,
  useTheme,
  alpha,
  Tabs,
  Tab,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Home as HomeIcon,
  Settings as SettingsIcon,
  AccountCircle as AccountCircleIcon,
  Security as SecurityIcon,
  Api as ApiIcon,
  Info as InfoIcon,
  Analytics as AnalyticsIcon,
  TrendingUp as TrendingUpIcon,
  Timeline as TimelineIcon,
  Chat as ChatIcon,
  ChatBubble as ChatBubbleIcon,
  ForumRounded as ForumRoundedIcon,
  Dashboard as DashboardIcon,
  ChildCare as ChildCareIcon,
  GradingOutlined as GradingIcon,
  Apps as AppsIcon,
  School as SchoolIcon,
} from '@mui/icons-material';
import { useIntl } from 'react-intl';
import { useContextStore } from '@/stores/useContextStore';
import { useAppStore } from '@/stores/useAppStore';

interface TopBarProps {
  sidebarWidth: number;
}

// Icon mapping function
const getTabIcon = (iconName: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    dashboard: <DashboardIcon />,  // Dashboard icon for My Dashboard
    ask: <ForumRoundedIcon />,  // Rounded forum/chat icon for Ask<CourseCode>
    grading: <GradingIcon />,  // Grading icon for grading assignments
    overview: <AnalyticsIcon />,  // Analytics icon for course overview (changed from DashboardIcon)
    companion: <ChildCareIcon />,  // Changed to baby angel icon
    general: <SettingsIcon />,
    account: <AccountCircleIcon />,
    security: <SecurityIcon />,
    api: <ApiIcon />,
    about: <InfoIcon />,
    performance: <TrendingUpIcon />,
    trends: <TimelineIcon />,
  };
  return iconMap[iconName] || null;
};

export const TopBar: React.FC<TopBarProps> = ({ sidebarWidth }) => {
  const intl = useIntl();
  const theme = useTheme();
  const { preferences } = useAppStore();

  const {
    currentContext,
    courseSessionContext,
    navigationHistory,
    historyIndex,
    goBack,
    goForward,
    getContextTabs,
    getCurrentTabValue,
    handleTabChange,
  } = useContextStore();

  // Memoize computed values to prevent recalculation
  const computedValues = React.useMemo(() => {
    const canGoBack = historyIndex > 0;
    const canGoForward = historyIndex < navigationHistory.length - 1;

    // Get breadcrumb from context store
    const breadcrumb: string[] = [];
    switch (currentContext) {
      case 'home':
        breadcrumb.push(intl.formatMessage({ id: 'navigation.home' }));
        break;
      case 'course-session':
        breadcrumb.push(intl.formatMessage({ id: 'navigation.courses' }));
        if (courseSessionContext?.sessionName) {
          breadcrumb.push(courseSessionContext.sessionName);
        }
        break;
      case 'settings':
        breadcrumb.push(intl.formatMessage({ id: 'navigation.settings' }));
        break;
    }

    return {
      canGoBack,
      canGoForward,
      breadcrumb,
    };
  }, [
    historyIndex,
    navigationHistory.length,
    currentContext,
    courseSessionContext,
    intl,
  ]);

  const tabs = getContextTabs();
  const currentTabValue = getCurrentTabValue();

  // Map string tab values to numeric indices for MUI Tabs to avoid value mismatches
  const tabValues = React.useMemo(() => tabs.map((t) => t.value), [tabs]);
  const currentIndex = currentTabValue ? tabValues.indexOf(currentTabValue) : -1;
  const safeCurrentIndex = currentIndex >= 0 ? currentIndex : tabValues.length > 0 ? 0 : -1;

  const showTabs = tabs.length > 1;
  const activeSessionId = courseSessionContext?.sessionId;
  const activeSessionName = courseSessionContext?.sessionName;

  return (
    <Box
      sx={{
        px: 2,
        py: 1.5,
        borderBottom: `1px solid ${alpha(theme.palette.divider, preferences.transparentMode ? 0.2 : 0.08)}`,
        backgroundColor: preferences.transparentMode ? 'transparent' : theme.palette.background.paper,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        height: 64, // Fixed height to match sidebar header
        minHeight: 64,
      }}
    >
      {/* Back/Forward Navigation */}
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <IconButton
          onClick={goBack}
          disabled={!computedValues.canGoBack}
          size="small"
          sx={{
            width: 32,
            height: 32,
            backgroundColor: computedValues.canGoBack
              ? alpha(theme.palette.primary.main, 0.08)
              : 'transparent',
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, 0.04),
            },
          }}
        >
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <IconButton
          onClick={goForward}
          disabled={!computedValues.canGoForward}
          size="small"
          sx={{
            width: 32,
            height: 32,
            backgroundColor: computedValues.canGoForward
              ? alpha(theme.palette.primary.main, 0.08)
              : 'transparent',
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, 0.04),
            },
          }}
        >
          <ArrowForwardIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Breadcrumbs */}
      <Breadcrumbs
        separator="/"
        sx={{ flex: showTabs ? '0 0 auto' : 1, mr: showTabs ? 2 : 0 }}
        aria-label="navigation breadcrumb"
      >
        {computedValues.breadcrumb.map((crumb, index) => (
          <Typography
            key={index}
            color={
              index === computedValues.breadcrumb.length - 1
                ? 'text.primary'
                : 'text.secondary'
            }
            variant="body2"
            sx={{
              fontWeight:
                index === computedValues.breadcrumb.length - 1 ? 500 : 400,
              fontSize: '0.875rem',
            }}
          >
            {crumb}
          </Typography>
        ))}
      </Breadcrumbs>

      {/* Inline Context Tabs */}
      {showTabs && (
        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <Tabs
            value={safeCurrentIndex}
            onChange={(_, newIndex) => {
              const newValue = tabValues[newIndex] ?? tabValues[0];
              if (newValue === 'companion') {
                // Summon overlay without switching the active tab
                if (activeSessionId && activeSessionName) {
                  try {
                    (window as any)?.electron?.companion?.open(
                      activeSessionId,
                      activeSessionName,
                    );
                  } catch {}
                }
                return; // Do not propagate tab change
              }
              // If overlay was previously active and user explicitly switches to another tab,
              // ensure overlay is closed and main window focused
              if (getCurrentTabValue() === 'companion') {
                try {
                  (window as any)?.electron?.companion?.close?.();
                } catch {}
              }
              if (newValue) handleTabChange(newValue);
            }}
            variant="standard"
            textColor="primary"
            indicatorColor="primary"
            sx={{
              minHeight: 'auto',
              '& .MuiTabs-flexContainer': {
                gap: 0.5,
              },
              '& .MuiTab-root': {
                minHeight: 28,
                minWidth: 36,
                width: 36,
                px: 0.5,
                py: 0,
                fontSize: '0.75rem',
                fontWeight: 500,
                textTransform: 'none',
                borderRadius: 1,
                transition: 'all 0.2s ease',
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.04),
                },
                '&.Mui-selected': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.08),
                  color: theme.palette.primary.main,
                },
              },
              '& .MuiTabs-indicator': {
                display: 'none', // Hide the default indicator
              },
            }}
          >
            {tabs.map((tab, index) => {
              // Handle custom labels (not translation keys)
              const labelText = (tab as any).customLabel
                ? tab.label
                : intl.formatMessage({ id: tab.label });
              const tabIconNode = (
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Box sx={{ '& svg': { fontSize: 18 } }}>
                    {getTabIcon(tab.value)}
                  </Box>
                </Box>
              );

              return (
                <Tooltip key={tab.id} title={labelText} arrow placement="bottom">
                  <Tab
                    value={index}
                    data-tab-value={tab.value}
                    icon={tabIconNode}
                    aria-label={labelText}
                    sx={{
                      minWidth: 36,
                      width: 36,
                      px: 0,
                      mx: 0,
                      '& .MuiSvgIcon-root': { fontSize: 18 },
                    }}
                  />
                </Tooltip>
              );
            })}
          </Tabs>
        </Box>
      )}
    </Box>
  );
};
