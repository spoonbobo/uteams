import React, { useState } from 'react';
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
  Badge,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Home as HomeIcon,
  Settings as SettingsIcon,
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  ChevronRight,
  ChevronLeft,
  Refresh as RefreshIcon,
  Login as LoginIcon,
  Assignment as TaskTrackingIcon,
} from '@mui/icons-material';
import { useIntl } from 'react-intl';
import { toast } from '@/utils/toast';
import { useAppStore } from '@/stores/useAppStore';
import { useContextStore } from '@/stores/useContextStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useMoodleStore } from '@/stores/useMoodleStore';
import { useAuthenticationState } from '@/stores/useUserStore';

export const SIDEBAR_WIDTH = 240;
export const SIDEBAR_COLLAPSED_WIDTH = 64;

interface SidebarProps {}

// Helper function to get the first letter of course name
const getCourseInitial = (name: string) => {
  // Handle edge cases: empty, undefined, or whitespace-only names
  if (!name || typeof name !== 'string') {
    return '?';
  }

  // Trim whitespace and get first non-whitespace character
  const trimmed = name.trim();
  if (!trimmed) {
    return '?';
  }

  return trimmed.charAt(0).toUpperCase();
};

// Helper to format date
const formatCourseDate = (timestamp?: number) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const nextYear = year + 1;
  return `${year % 100}/${nextYear % 100}`;
};

export const Sidebar: React.FC<SidebarProps> = () => {
  const intl = useIntl();
  const theme = useTheme();
  const { theme: appTheme, setTheme } = useAppStore();
  const { sidebarCollapsed, setSidebarCollapsed, hasNewWorkBadge, clearNewWorkBadge } = useLayoutStore();
  const { courses, isLoadingCourses, fetchCourses, isConfigured, isConnected } = useMoodleStore();
  const { isAuthenticated } = useAuthenticationState();
  const [isHoveringEdge, setIsHoveringEdge] = useState(false);

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
    navigateToWork,
  } = useContextStore();

  // Determine current width based on collapsed state
  const currentWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;
  const maxCourses = sidebarCollapsed ? 8 : 6;

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: currentWidth,
        flexShrink: 0,
        height: '100%',
        '& .MuiDrawer-paper': {
          width: currentWidth,
          boxSizing: 'border-box',
          backgroundColor: theme.palette.background.paper,
          borderRight: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
          boxShadow:
            theme.palette.mode === 'dark'
              ? 'none'
              : '0 0 10px rgba(0,0,0,0.02)',
          overflow: 'visible',
          position: 'static',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Toggle button on right edge */}
      <Box
        sx={{
          position: 'absolute',
          right: -12,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 24,
          height: 48,
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
          borderLeft: 'none',
          borderRadius: '0 8px 8px 0',
          cursor: 'pointer',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isHoveringEdge ? 1 : 0,
          transition: 'opacity 0.2s ease',
          boxShadow: theme.palette.mode === 'dark'
            ? '0 2px 8px rgba(0,0,0,0.4)'
            : '0 2px 8px rgba(0,0,0,0.1)',
          '&:hover': {
            backgroundColor: alpha(theme.palette.primary.main, 0.08),
            boxShadow: theme.palette.mode === 'dark'
              ? '0 4px 12px rgba(0,0,0,0.6)'
              : '0 4px 12px rgba(0,0,0,0.15)',
          },
        }}
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        onMouseEnter={() => setIsHoveringEdge(true)}
        onMouseLeave={() => setIsHoveringEdge(false)}
      >
        {sidebarCollapsed ? (
          <ChevronRight fontSize="small" color="primary" />
        ) : (
          <ChevronLeft fontSize="small" color="primary" />
        )}
      </Box>

      {/* Hover zone to show toggle button */}
      <Box
        sx={{
          position: 'absolute',
          right: -20,
          top: 0,
          bottom: 0,
          width: 20,
          zIndex: 9998,
        }}
        onMouseEnter={() => setIsHoveringEdge(true)}
        onMouseLeave={() => setIsHoveringEdge(false)}
      />

      {/* Header Section with Navigation - matches TopBar height */}
      <Box
        sx={{
          height: 64, // Match TopBar height exactly
          display: 'flex',
          alignItems: 'center',
          px: !sidebarCollapsed ? 1.5 : 1,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
          justifyContent: !sidebarCollapsed ? 'flex-start' : 'center',
        }}
      >
        <ListItemButton
          selected={currentContext === 'home'}
          onClick={() => navigateToHome()}
          sx={{
            borderRadius: 1,
            minHeight: 40,
            px: !sidebarCollapsed ? 2 : 1,
            py: 1,
            flex: !sidebarCollapsed ? 1 : 'none',
            minWidth: !sidebarCollapsed ? 'auto' : 40,
            backgroundColor:
              currentContext === 'home'
                ? alpha(theme.palette.primary.main, 0.15)
                : 'transparent',
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, 0.15),
            },
            justifyContent: !sidebarCollapsed ? 'flex-start' : 'center',
          }}
        >
          <ListItemIcon sx={{ minWidth: !sidebarCollapsed ? 36 : 'auto', justifyContent: 'center' }}>
            <HomeIcon
              fontSize="small"
              color={currentContext === 'home' ? 'primary' : 'inherit'}
            />
          </ListItemIcon>
          {!sidebarCollapsed && (
            <ListItemText
              primary={intl.formatMessage({ id: 'navigation.home' })}
              primaryTypographyProps={{
                fontSize: '0.875rem',
                fontWeight: currentContext === 'home' ? 500 : 400,
                color:
                  currentContext === 'home' ? 'primary.main' : 'text.primary',
              }}
            />
          )}
        </ListItemButton>
      </Box>

      <Divider sx={{ mx: !sidebarCollapsed ? 1.5 : 0.5, opacity: 0.15 }} />

      {/* Courses List */}
      <Box
        className="app-layout-scrollbar"
        sx={{
          flex: 1,
          overflowY: 'auto', // Only allow vertical scrolling
          overflowX: 'hidden', // Disable horizontal scrolling completely
          px: !sidebarCollapsed ? 1.5 : 0.5,
          py: 1,
          minHeight: 0,
        }}
      >
        {!sidebarCollapsed && isAuthenticated && isConnected && (
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
              <span>
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
                      backgroundColor: alpha(theme.palette.primary.main, 0.15),
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
              </span>
            </Tooltip>
          </Box>
        )}

        {sidebarCollapsed && isAuthenticated && isConnected && (
          <Box sx={{ display: 'flex', justifyContent: 'center', px: 0.5, py: 0.5 }}>
            <Tooltip title={intl.formatMessage({ id: 'sidebar.refreshCourses' }) || 'Refresh courses'}>
              <span>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    fetchCourses();
                    toast.info(intl.formatMessage({ id: 'sidebar.refreshingCourses' }) || 'Refreshing courses...');
                  }}
                  disabled={isLoadingCourses}
                  sx={{
                    width: 24,
                    height: 24,
                    color: 'text.secondary',
                    '&:hover': {
                      color: 'primary.main',
                      backgroundColor: alpha(theme.palette.primary.main, 0.15),
                    },
                    '&:disabled': {
                      color: 'text.disabled',
                    },
                  }}
                >
                  <RefreshIcon
                    fontSize="small"
                    sx={{
                      animation: isLoadingCourses ? 'spin 1s linear infinite' : 'none',
                      '@keyframes spin': {
                        '0%': { transform: 'rotate(0deg)' },
                        '100%': { transform: 'rotate(360deg)' },
                      },
                    }}
                  />
                </IconButton>
              </span>
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

          {isAuthenticated && isConnected && !isLoadingCourses && courses.slice(0, maxCourses).map((course) => {
            const isActive =
              currentContext === 'course-session' &&
              courseSessionContext?.sessionId === (course.shortname || course.id);

            // Debug logging for course data (only in development)
            if (process.env.NODE_ENV === 'development' && (!course.fullname || !course.fullname.trim())) {
              console.warn('[Sidebar] Course with empty or missing fullname:', course);
            }

            return (
              <Tooltip
                key={course.id}
                title={
                  <Box>
                    <Typography variant="caption" fontWeight={600}>
                      {course.fullname || course.shortname || `Course ${course.id}`}
                    </Typography>
                    <br />
                    <Typography variant="caption">
                      {course.shortname || course.id}
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
                disableHoverListener={!sidebarCollapsed}
              >
                <Box
                  onClick={() =>
                    navigateToCourseSession(course.shortname || course.id, course.fullname)
                  }
                  sx={{
                    p: !sidebarCollapsed ? 1.5 : 1,
                    mb: 0.5,
                    borderRadius: 1,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    backgroundColor: isActive
                      ? alpha(theme.palette.primary.main, 0.15)
                      : 'transparent',
                    '&:hover': {
                      backgroundColor: isActive
                        ? alpha(theme.palette.primary.main, 0.12)
                        : alpha(theme.palette.primary.main, 0.08),
                    },
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: !sidebarCollapsed ? 'flex-start' : 'center',
                  }}
                >
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      backgroundColor: alpha(theme.palette.primary.main, 0.2),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr: !sidebarCollapsed ? 1.5 : 0,
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
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
                        {getCourseInitial(course.fullname || course.shortname || course.id)}
                    </Typography>
                  </Box>
                  {!sidebarCollapsed && (
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
                          {course.fullname || course.shortname || `Course ${course.id}`}
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
                  )}
                </Box>
              </Tooltip>
            );
          })}
        </Box>

        {isAuthenticated && isConnected && !isLoadingCourses && courses.length === 0 && !sidebarCollapsed && (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography variant="caption" color="text.secondary">
              {intl.formatMessage({ id: 'sidebar.noCourses' }, { defaultMessage: 'No courses available' })}
            </Typography>
          </Box>
        )}
      </Box>

      <Divider sx={{ mx: !sidebarCollapsed ? 1.5 : 0.5, opacity: 0.15 }} />

      {/* Theme toggle and actions */}
      <Box sx={{ p: !sidebarCollapsed ? 1.5 : 0.5 }}>
        {/* Action Buttons */}
        <Box sx={{
          display: 'flex',
          gap: 0.5,
          alignItems: 'center',
          justifyContent: !sidebarCollapsed ? 'flex-start' : 'center',
          flexWrap: !sidebarCollapsed ? 'wrap' : 'nowrap',
          flexDirection: !sidebarCollapsed ? 'row' : 'column',
        }}>
          <Tooltip title={intl.formatMessage({ id: 'sidebar.workTracking' }, { defaultMessage: 'Work Tracking' })}>
            <Badge
              color="error"
              variant="dot"
              invisible={!hasNewWorkBadge}
              sx={{
                '& .MuiBadge-dot': {
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: theme.palette.error.main,
                  border: `2px solid ${theme.palette.background.paper}`,
                  animation: hasNewWorkBadge ? 'pulse 2s infinite' : 'none',
                  '@keyframes pulse': {
                    '0%': {
                      transform: 'scale(1)',
                      opacity: 1,
                    },
                    '50%': {
                      transform: 'scale(1.2)',
                      opacity: 0.8,
                    },
                    '100%': {
                      transform: 'scale(1)',
                      opacity: 1,
                    },
                  },
                },
              }}
            >
              <IconButton
                onClick={() => {
                  // Clear the badge when clicked
                  if (hasNewWorkBadge) {
                    clearNewWorkBadge();
                  }
                  navigateToWork();
                }}
                size="small"
                sx={{
                  backgroundColor:
                    currentContext === 'work'
                      ? alpha(theme.palette.primary.main, 0.15)
                      : 'transparent',
                  color:
                    currentContext === 'work'
                      ? 'primary.main'
                      : 'text.secondary',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.15),
                  },
                }}
              >
                <TaskTrackingIcon fontSize="small" />
              </IconButton>
            </Badge>
          </Tooltip>
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
                backgroundColor: alpha(theme.palette.primary.main, 0.15),
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
                  ? alpha(theme.palette.primary.main, 0.15)
                  : 'transparent',
              color:
                currentContext === 'settings'
                  ? 'primary.main'
                  : 'text.secondary',
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.15),
              },
            }}
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Drawer>
  );
};
