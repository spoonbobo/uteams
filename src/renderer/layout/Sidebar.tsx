import React from 'react';
import {
  Box,
  Drawer,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  IconButton,
  Divider,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Home as HomeIcon,
  Settings as SettingsIcon,
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  Refresh as RefreshIcon,
  Login as LoginIcon,
} from '@mui/icons-material';
import { useIntl } from 'react-intl';
import { toast } from '@/utils/toast';
import { useAppStore } from '@/stores/useAppStore';
import { useContextStore } from '@/stores/useContextStore';
import { useMoodleStore } from '@/stores/useMoodleStore';
import { useAuthenticationState } from '@/stores/useUserStore';
// Disclaimer moved into Settings General view

const SIDEBAR_WIDTH = 240;

// Helper function to get the first letter of course name
const getCourseInitial = (name: string) => {
  return name.charAt(0).toUpperCase();
};

// Helper to format date
const formatCourseDate = (timestamp?: number) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const nextYear = year + 1;
  return `${year % 100}/${nextYear % 100}`;
};

export const Sidebar: React.FC = () => {
  const intl = useIntl();
  const theme = useTheme();
  const { theme: appTheme, setTheme } = useAppStore();
  const { courses, isLoadingCourses, fetchCourses, isConfigured, isConnected } = useMoodleStore();
  const { isAuthenticated } = useAuthenticationState();
  // Disclaimer controls are now managed in SettingsView

  // Fetch courses on mount if configured and authenticated
  React.useEffect(() => {
    if (isAuthenticated && isConnected && isConfigured() && courses.length === 0) {
      fetchCourses();
    }
  }, [isAuthenticated, isConnected]);

  const {
    currentContext,
    courseSessionContext,
    navigateToHome,
    navigateToCourseSession,
    navigateToSettings,
  } = useContextStore();

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        height: '100%',
        '& .MuiDrawer-paper': {
          width: SIDEBAR_WIDTH,
          boxSizing: 'border-box',
          backgroundColor: theme.palette.background.paper,
          borderRight: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          boxShadow:
            theme.palette.mode === 'dark'
              ? 'none'
              : '0 0 10px rgba(0,0,0,0.02)',
          height: '100%',
          position: 'static',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Header Section with Navigation - matches TopBar height */}
      <Box
        sx={{
          height: 64, // Match TopBar height exactly
          display: 'flex',
          alignItems: 'center',
          px: 1.5,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        }}
      >
        <ListItemButton
          selected={currentContext === 'home'}
          onClick={() => navigateToHome()}
          sx={{
            borderRadius: 1,
            minHeight: 40,
            px: 2,
            py: 1,
            flex: 1,
            backgroundColor:
              currentContext === 'home'
                ? alpha(theme.palette.primary.main, 0.08)
                : 'transparent',
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, 0.04),
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            <HomeIcon
              fontSize="small"
              color={currentContext === 'home' ? 'primary' : 'inherit'}
            />
          </ListItemIcon>
          <ListItemText
            primary={intl.formatMessage({ id: 'navigation.home' })}
            primaryTypographyProps={{
              fontSize: '0.875rem',
              fontWeight: currentContext === 'home' ? 500 : 400,
              color:
                currentContext === 'home' ? 'primary.main' : 'text.primary',
            }}
          />
        </ListItemButton>
      </Box>

      <Divider sx={{ mx: 1.5 }} />

      {/* Courses List */}
      <Box
        className="app-layout-scrollbar"
        sx={{
          flex: 1,
          overflow: 'auto',
          px: 1.5,
          py: 1,
          minHeight: 0,
        }}
      >
        {isAuthenticated && isConnected && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1, py: 0.5 }}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 500,
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {intl.formatMessage({ id: 'sidebar.myCourses' })}
            </Typography>
            <Tooltip title={intl.formatMessage({ id: 'sidebar.refreshCourses' }) || 'Refresh courses'}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  fetchCourses();
                  toast.info(intl.formatMessage({ id: 'sidebar.refreshingCourses' }) || 'Refreshing courses...');
                }}
                disabled={isLoadingCourses}
                sx={{
                  width: 20,
                  height: 20,
                  color: 'text.secondary',
                  '&:hover': {
                    color: 'primary.main',
                    backgroundColor: alpha(theme.palette.primary.main, 0.04),
                  },
                  '&:disabled': {
                    color: 'text.disabled',
                  },
                }}
              >
                <RefreshIcon 
                  fontSize="inherit" 
                  sx={{
                    fontSize: '0.875rem',
                    animation: isLoadingCourses ? 'spin 1s linear infinite' : 'none',
                    '@keyframes spin': {
                      '0%': { transform: 'rotate(0deg)' },
                      '100%': { transform: 'rotate(360deg)' },
                    },
                  }}
                />
              </IconButton>
            </Tooltip>
          </Box>
        )}

        <Box sx={{ mt: 0.5 }}>
          {!isAuthenticated && (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Tooltip title="Login to view courses">
                <IconButton
                  onClick={() => navigateToHome()}
                  size="small"
                  sx={{
                    width: 36,
                    height: 36,
                    backgroundColor: alpha(theme.palette.warning.main, 0.08),
                    color: 'warning.main',
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.warning.main, 0.15),
                    },
                  }}
                >
                  <LoginIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          )}
          
          {isAuthenticated && isConnected && isLoadingCourses && (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="caption" color="text.secondary">
                {intl.formatMessage({ id: 'sidebar.loadingCourses' }) || 'Loading courses...'}
              </Typography>
            </Box>
          )}
          
          {isAuthenticated && isConnected && !isLoadingCourses && courses.slice(0, 6).map((course) => {
            const isActive =
              currentContext === 'course-session' &&
              courseSessionContext?.sessionId === (course.shortname || course.id);

            return (
              <Tooltip
                key={course.id}
                title={
                  <Box>
                    <Typography variant="caption" fontWeight={600}>
                      {course.fullname}
                    </Typography>
                    <br />
                    <Typography variant="caption">
                      {course.shortname}
                    </Typography>
                    {course.startdate && (
                      <>
                        <br />
                        <Typography variant="caption">
                          {intl.formatMessage({ id: 'courses.academicYear' }) || 'Year'}: {formatCourseDate(course.startdate)}
                        </Typography>
                      </>
                    )}
                  </Box>
                }
                placement="right"
                arrow
              >
                <Box
                  onClick={() =>
                    navigateToCourseSession(course.shortname || course.id, course.fullname)
                  }
                  sx={{
                    p: 1.5,
                    mb: 0.5,
                    borderRadius: 1,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    backgroundColor: isActive
                      ? alpha(theme.palette.primary.main, 0.08)
                      : 'transparent',
                    '&:hover': {
                      backgroundColor: isActive
                        ? alpha(theme.palette.primary.main, 0.12)
                        : alpha(theme.palette.primary.main, 0.04),
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        backgroundColor: alpha(theme.palette.primary.main, 0.1),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mr: 1.5,
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: 'primary.main',
                          lineHeight: 1,
                        }}
                      >
                        {getCourseInitial(course.fullname)}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Typography
                          variant="body2"
                          fontWeight={400}
                          noWrap
                          sx={{
                            fontSize: '0.8125rem',
                            color: 'text.primary',
                            lineHeight: 1.2,
                            flex: 1,
                            mr: 1,
                          }}
                        >
                          {course.fullname}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: '0.6875rem',
                            fontWeight: 500,
                            color: 'text.secondary',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {course.shortname || formatCourseDate(course.startdate)}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </Tooltip>
            );
          })}
        </Box>

        {isAuthenticated && isConnected && !isLoadingCourses && courses.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography variant="caption" color="text.secondary">
              {intl.formatMessage({ id: 'sidebar.noCourses' }, { defaultMessage: 'No courses available' })}
            </Typography>
          </Box>
        )}
      </Box>

      <Divider sx={{ mx: 1.5 }} />

      {/* Theme toggle and actions (no user) */}
      <Box sx={{ p: 1.5 }}>
        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <Tooltip
            title={intl.formatMessage({
              id:
                appTheme === 'dark' ? 'sidebar.lightMode' : 'sidebar.darkMode',
            })}
          >
            <IconButton
              onClick={() => {
                const newTheme = appTheme === 'light' ? 'dark' : 'light';
                setTheme(newTheme);
                toast.info(
                  intl.formatMessage(
                    { id: 'common.switchedToMode' },
                    { mode: newTheme },
                  ),
                );
              }}
              size="small"
              className="theme-toggle-button"
              sx={{
                width: 36,
                height: 36,
                backgroundColor: alpha(theme.palette.primary.main, 0.08),
                color: 'primary.main',
                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.15),
                  transform: 'scale(1.08)',
                  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
                },
                '&:active': {
                  transform: 'scale(0.95)',
                },
              }}
            >
              {appTheme === 'dark' ? (
                <LightModeIcon
                  fontSize="small"
                  className="theme-icon-transition"
                  sx={{
                    color: theme.palette.warning.main,
                    filter: 'drop-shadow(0 0 4px rgba(255, 193, 7, 0.3))',
                  }}
                />
              ) : (
                <DarkModeIcon
                  fontSize="small"
                  className="theme-icon-transition"
                  sx={{
                    color: theme.palette.info.main,
                    filter: 'drop-shadow(0 0 4px rgba(33, 150, 243, 0.3))',
                  }}
                />
              )}
            </IconButton>
          </Tooltip>
          <IconButton
            onClick={() => navigateToSettings()}
            size="small"
            sx={{
              backgroundColor:
                currentContext === 'settings'
                  ? alpha(theme.palette.primary.main, 0.08)
                  : 'transparent',
              color:
                currentContext === 'settings'
                  ? 'primary.main'
                  : 'text.secondary',
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.04),
              },
            }}
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
          {/* Disclaimer link moved to Settings */}
        </Box>
      </Box>
    </Drawer>
  );
};

export { SIDEBAR_WIDTH };
