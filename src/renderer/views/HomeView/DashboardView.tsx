import React, { useState, useEffect, useCallback } from 'react';
import { 
  Typography, 
  Box, 
  Card, 
  Grid,
  Container,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  useTheme,
  alpha,
  CircularProgress
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  List as ListIcon,
} from '@mui/icons-material';
import { useIntl } from 'react-intl';
import { useMoodleStore } from '@/stores/useMoodleStore';
import { useUserStore, useAuthenticationState } from '@/stores/useUserStore';
import { Authenticate } from '@/components/Authenticate';
import { toast } from '@/utils/toast';

export const DashboardView: React.FC = () => {
  const intl = useIntl();
  const theme = useTheme();
  
  // User authentication state - now uses fixed hook
  const { isAuthenticated, isInitialized, user } = useAuthenticationState();
  
  // Moodle store - use minimal specific selectors to prevent unnecessary re-renders
  const isConnected = useMoodleStore((state) => state.isConnected);
  const connectionInfo = useMoodleStore((state) => state.connectionInfo);
  const courses = useMoodleStore((state) => state.courses);
  const isLoadingCourses = useMoodleStore((state) => state.isLoadingCourses);
  const coursesError = useMoodleStore((state) => state.coursesError);
  // Subscribe to courseContent changes to trigger re-renders when content is loaded
  const courseContent = useMoodleStore((state) => state.courseContent);
  
  // Show auth form only if initialized and not authenticated
  const showAuth = isInitialized && !isAuthenticated;
  
  // Check if all essential Moodle data is loaded
  const hasCoursesWithContent = React.useMemo(() => {
    if (courses.length === 0) return false;
    
    // Check if at least some courses have content loaded or attempted to load
    const contentProcessedCount = courses.filter(course => {
      const content = courseContent[course.id];
      // Consider content processed if it exists, is not loading, and has lastUpdated (even with errors)
      // This prevents getting stuck on courses that might have API errors
      return content && 
             !content.isLoading && 
             content.lastUpdated !== null;
    }).length;
    
    // Consider data ready if we have courses and at least 70% have been processed (success or failure)
    const threshold = Math.max(1, Math.ceil(courses.length * 0.7)); // At least 1 course must be processed
    const isReady = contentProcessedCount >= threshold;
    
    // Debug logging
    console.log('[Dashboard] Content check:', {
      totalCourses: courses.length,
      contentProcessedCount,
      threshold,
      isReady,
      courseContent: Object.keys(courseContent).map(courseId => ({
        courseId,
        hasLastUpdated: !!courseContent[courseId]?.lastUpdated,
        isLoading: !!courseContent[courseId]?.isLoading,
        hasError: !!courseContent[courseId]?.error,
        hasActivities: !!courseContent[courseId]?.activities?.length,
        hasAssignments: !!courseContent[courseId]?.assignments?.length
      }))
    });
    
    return isReady;
  }, [courses, courseContent]);
  
  const isMoodleDataReady = isAuthenticated && isConnected && !isLoadingCourses && courses.length > 0 && hasCoursesWithContent;
  const showLoadingState = isAuthenticated && (!isConnected || isLoadingCourses || (!coursesError && (courses.length === 0 || !hasCoursesWithContent)));
  
  // Debug logging (can be removed in production)
  console.log('[Dashboard] State:', { 
    isAuthenticated, 
    isInitialized, 
    isConnected, 
    hasUser: !!user,
    showAuth,
    showLoadingState,
    coursesCount: courses.length,
    isLoadingCourses,
    isMoodleDataReady,
    hasCoursesWithContent
  });
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [timelineFilter, setTimelineFilter] = useState('7');
  const [sortBy, setSortBy] = useState('dates');
  const [hasInitializedData, setHasInitializedData] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Check if Moodle needs to be reconnected when user is authenticated but not connected
  useEffect(() => {
    if (isAuthenticated && !isConnected && user) {
      console.log('[Dashboard] User is authenticated but Moodle is not connected. Checking for stored API key...');
      const moodleStore = useMoodleStore.getState();
      if (moodleStore.config.apiKey) {
        console.log('[Dashboard] Found stored API key, attempting to reconnect...');
        // Try to reconnect using the stored API key with timeout
        Promise.race([
          moodleStore.testConnection(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
        ]).then((success) => {
          if (!success) {
            console.log('[Dashboard] Reconnection failed. API key might be invalid.');
            // Show error but keep user authenticated - they can re-authenticate manually
          } else {
            console.log('[Dashboard] Reconnection successful!');
          }
        }).catch((error) => {
          console.error('[Dashboard] Reconnection error or timeout:', error);
          if (error.message === 'Timeout') {
            console.log('[Dashboard] Reconnection timed out after 10 seconds');
          }
        });
      } else {
        console.log('[Dashboard] No stored API key found. User needs to re-authenticate.');
        // If no API key is stored, user needs to re-authenticate
        const userStore = useUserStore.getState();
        userStore.setUnauthenticated();
      }
    }
  }, [isAuthenticated, isConnected, user]);

  // Initialize Moodle data when authenticated and connected
  useEffect(() => {
    if (isAuthenticated && isConnected && courses.length === 0 && !isLoadingCourses && !hasInitializedData) {
      console.log('[Dashboard] Starting initial data fetch...');
      setHasInitializedData(true);
      
      // Use timeout to avoid immediate state updates
      setTimeout(async () => {
        try {
          const store = useMoodleStore.getState();
          
          // First, ensure courses are loaded with timeout
          console.log('[Dashboard] Fetching courses...');
          const fetchCoursesPromise = store.fetchCourses();
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Courses fetch timeout')), 15000)
          );
          
          const fetchedCourses = await Promise.race([fetchCoursesPromise, timeoutPromise]);
          
          // Then fetch content for all courses with timeout
          if (fetchedCourses && fetchedCourses.length > 0) {
            console.log('[Dashboard] Fetching content for all courses...');
            const fetchContentPromise = store.fetchAllCourseContent();
            const contentTimeoutPromise = new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Course content fetch timeout')), 30000)
            );
            
            await Promise.race([fetchContentPromise, contentTimeoutPromise]);
            console.log('[Dashboard] ✅ All data loaded successfully');
          } else {
            console.log('[Dashboard] No courses found or courses fetch failed');
          }
        } catch (error) {
          console.error('[Dashboard] ❌ Error loading data:', error);
          // Reset initialization flag on error so it can be retried
          setHasInitializedData(false);
          
          if (error instanceof Error && error.message.includes('timeout')) {
            toast.error('Data loading is taking longer than expected. Please check your connection and try refreshing.');
          }
        }
      }, 100);
    } else if (!isAuthenticated && hasInitializedData) {
      // Reset initialization flag when unauthenticated
      setHasInitializedData(false);
    }
  }, [isAuthenticated, isConnected, courses.length, isLoadingCourses, hasInitializedData]);

  // Handle disconnection separately - but don't immediately log out on disconnect
  // Instead, let the reconnection logic try first
  useEffect(() => {
    if (!isConnected && isAuthenticated) {
      console.log('[Dashboard] Moodle disconnected, but keeping user authenticated. Reconnection will be attempted.');
      // Don't immediately log out - let the reconnection logic handle it
      // Only log out if there's an authentication error after reconnection attempts
    }
  }, [isConnected, isAuthenticated]);

  // Handle authentication success
  const handleAuthenticationSuccess = useCallback(() => {
    // Authentication state is now managed by UserStore
  }, []);

  // Get upcoming assignments (memoized) - avoid function dependency
  const upcomingAssignments = React.useMemo(() => {
    // Get the function fresh from store to avoid dependency issues
    const store = useMoodleStore.getState();
    const assignments = store.getUpcomingAssignments(parseInt(timelineFilter));
    
    // Filter by search query if present
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return assignments.filter(assignment => {
        const courseCode = (assignment as any).courseShortname || '';
        return assignment.name.toLowerCase().includes(query) || 
               courseCode.toLowerCase().includes(query);
      });
    }
    
    return assignments;
  }, [timelineFilter, searchQuery, courseContent]); // Add courseContent dependency to update when content changes

  // Memoized handlers
  const handleTimelineFilterChange = useCallback((event: any) => {
    setTimelineFilter(event.target.value);
  }, []);

  const handleSortByChange = useCallback((event: any) => {
    setSortBy(event.target.value);
  }, []);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  }, []);

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(intl.locale, { 
      year: 'numeric', 
      month: 'long' 
    });
  };

  const navigateMonth = useCallback((direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  }, []);

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const today = new Date().getDate();
    const isCurrentMonth = currentDate.getMonth() === new Date().getMonth() && 
                          currentDate.getFullYear() === new Date().getFullYear();

    const days = [];
    // Use internationalized day names
    const dayNames = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - date.getDay() + 1 + i); // Start from Monday
      return date.toLocaleDateString(intl.locale, { weekday: 'short' });
    });

    // Get assignments for this month
    const monthAssignments = upcomingAssignments.filter(assignment => {
      if (!assignment.duedate) return false;
      const assignmentDate = new Date(assignment.duedate * 1000);
      return assignmentDate.getMonth() === currentDate.getMonth() && 
             assignmentDate.getFullYear() === currentDate.getFullYear();
    });

    // Empty cells for days before first day of month
    for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
      days.push(
        <Box 
          key={`empty-${i}`} 
          sx={{ 
            p: 1.5, 
            minHeight: 120,
            backgroundColor: theme.palette.action.hover
          }} 
        />
      );
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = isCurrentMonth && day === today;
      
      // Check if this day has assignments
      const dayAssignments = monthAssignments.filter(assignment => {
        const assignmentDate = new Date(assignment.duedate * 1000);
        return assignmentDate.getDate() === day;
      });

      days.push(
        <Box
          key={day}
          sx={{
            p: 1.5,
            minHeight: 120,
            border: 'none', // Remove individual borders for cleaner look
            cursor: 'pointer',
            backgroundColor: isToday 
              ? alpha(theme.palette.primary.main, 0.08) 
              : theme.palette.background.paper,
            '&:hover': {
              backgroundColor: isToday 
                ? alpha(theme.palette.primary.main, 0.12) 
                : theme.palette.action.hover,
            },
            transition: 'background-color 0.2s ease',
          }}
        >
          <Typography 
            variant="body2" 
            sx={{ 
              fontWeight: isToday ? 600 : 500,
              color: isToday ? theme.palette.primary.main : theme.palette.text.primary,
              mb: 1,
              fontSize: '0.875rem'
            }}
          >
            {day}
          </Typography>
          
          {/* Show assignment indicators */}
          {dayAssignments.slice(0, 3).map((assignment, index) => {
            // Use the courseShortname from the enhanced assignment data
            const courseCode = (assignment as any).courseShortname || assignment.courseid;
            const displayText = `${courseCode}: ${assignment.name}`;
            
            return (
              <Box
                key={assignment.id}
                sx={{
                  fontSize: '0.65rem',
                  color: theme.palette.primary.main,
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  px: 0.75,
                  py: 0.25,
                  mb: 0.5,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.3,
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.15),
                  },
                }}
                title={displayText} // Show full text on hover
              >
                {displayText.length > 16 ? `${displayText.substring(0, 16)}...` : displayText}
              </Box>
            );
          })}
          
          {/* Show "+X more" if there are more assignments */}
          {dayAssignments.length > 3 && (
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                fontSize: '0.6rem',
                color: theme.palette.text.secondary,
                fontStyle: 'italic',
                mt: 0.5,
              }}
            >
              +{dayAssignments.length - 3} more
            </Typography>
          )}
        </Box>
      );
    }

    return (
      <Box>
        {/* Calendar Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
          <Button
            variant="text"
            size="small"
            onClick={() => navigateMonth('prev')}
            sx={{ 
              minWidth: 'auto', 
              width: 36,
              height: 36,
              borderRadius: 0,
              color: theme.palette.text.primary,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
              }
            }}
          >
            <ChevronLeftIcon fontSize="small" />
          </Button>
          <Typography 
            variant="h5" 
            sx={{ 
              fontWeight: 500,
              color: theme.palette.text.primary,
              textAlign: 'center',
              minWidth: 200
            }}
          >
            {formatDate(currentDate)}
          </Typography>
          <Button
            variant="text"
            size="small"
            onClick={() => navigateMonth('next')}
            sx={{ 
              minWidth: 'auto', 
              width: 36,
              height: 36,
              borderRadius: 0,
              color: theme.palette.text.primary,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
              }
            }}
          >
            <ChevronRightIcon fontSize="small" />
          </Button>
        </Box>

        {/* Calendar Grid Container */}
        <Box 
          sx={{ 
            border: '1px solid', 
            borderColor: theme.palette.divider,
            borderRadius: 0,
            overflow: 'hidden',
            boxShadow: theme.shadows[1],
            backgroundColor: theme.palette.background.paper,
          }}
        >
          {/* Day names header */}
          <Box sx={{ display: 'flex' }}>
            {dayNames.map((dayName, index) => (
              <Box 
                key={dayName} 
                sx={{ 
                  flex: 1,
                  py: 2, 
                  px: 1.5,
                  textAlign: 'center', 
                  borderRight: index !== dayNames.length - 1 ? `1px solid ${theme.palette.divider}` : 'none',
                  borderBottom: `2px solid ${theme.palette.primary.main}`,
                }}
              >
                <Typography 
                  variant="overline" 
                  sx={{ 
                    fontWeight: 700, 
                    color: theme.palette.primary.main,
                    fontSize: '0.75rem',
                    letterSpacing: '0.5px',
                    lineHeight: 1
                  }}
                >
                  {dayName}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Calendar days grid */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
            {days.map((day, index) => (
              <Box 
                key={index} 
                sx={{ 
                  width: `${100/7}%`,
                  borderRight: index % 7 !== 6 ? `1px solid ${theme.palette.divider}` : 'none',
                  borderTop: index >= 7 ? `1px solid ${theme.palette.divider}` : 'none',
                }}
              >
                {day}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    );
  };

  const renderTimeline = () => (
    <Box>
      {/* Timeline Controls */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>{intl.formatMessage({ id: 'dashboard.timeline.period' })}</InputLabel>
          <Select
            value={timelineFilter}
            label={intl.formatMessage({ id: 'dashboard.timeline.period' })}
            onChange={handleTimelineFilterChange}
          >
            <MenuItem value="7">{intl.formatMessage({ id: 'dashboard.timeline.next7days' })}</MenuItem>
            <MenuItem value="30">{intl.formatMessage({ id: 'dashboard.timeline.next30days' })}</MenuItem>
            <MenuItem value="90">{intl.formatMessage({ id: 'dashboard.timeline.next90days' })}</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>{intl.formatMessage({ id: 'dashboard.timeline.sortBy' })}</InputLabel>
          <Select
            value={sortBy}
            label={intl.formatMessage({ id: 'dashboard.timeline.sortBy' })}
            onChange={handleSortByChange}
          >
            <MenuItem value="dates">{intl.formatMessage({ id: 'dashboard.timeline.sortByDates' })}</MenuItem>
            <MenuItem value="courses">{intl.formatMessage({ id: 'dashboard.timeline.sortByCourses' })}</MenuItem>
          </Select>
        </FormControl>

        <TextField
          size="small"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder={intl.formatMessage({ id: 'dashboard.timeline.searchPlaceholder' })}
          sx={{ flexGrow: 1, maxWidth: 300 }}
        />
      </Box>

      {/* Timeline Content */}
      {upcomingAssignments.length > 0 ? (
        <Box>
          {upcomingAssignments.map((assignment) => {
            const courseCode = (assignment as any).courseShortname || assignment.courseid;
            
            return (
              <Box
                key={assignment.id}
                sx={{
                  p: 1.5,
                  mb: 1,
                  borderBottom: '1px solid',
                  borderColor: theme.palette.divider,
                  backgroundColor: theme.palette.background.paper,
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                  cursor: 'pointer',
                  '&:last-child': {
                    borderBottom: 'none',
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                      color: theme.palette.primary.main,
                      px: 0.75,
                      py: 0.25,
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      minWidth: 'fit-content',
                    }}
                  >
                    {courseCode}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: theme.palette.text.primary, flex: 1 }}>
                    {assignment.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                    {assignment.duedate 
                      ? new Date(assignment.duedate * 1000).toLocaleDateString(intl.locale)
                      : intl.formatMessage({ id: 'dashboard.timeline.noDueDate' })
                    }
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      ) : (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <ListIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="body1" color="text.secondary">
            {intl.formatMessage({ id: 'dashboard.timeline.noActivities' })}
          </Typography>
        </Box>
      )}
    </Box>
  );

  // Don't render anything until authentication state is initialized
  // Allow a brief grace period for store initialization
  if (!isInitialized && !isAuthenticated) {
    return (
      <Container maxWidth="xl" sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          {intl.formatMessage({ id: 'common.loading' })}
        </Typography>
      </Container>
    );
  }

  return (
    <>
      {/* Dashboard Header */}
      <Box py={2}>
      </Box>

      {/* Dashboard Content */}
      <Container maxWidth="xl" sx={{ py: 2 }}>
        {showAuth ? (
          // Show authentication when not authenticated
          <Authenticate onAuthenticated={handleAuthenticationSuccess} />
        ) : showLoadingState ? (
          // Show loading state while Moodle data is being fetched
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h5" sx={{ mb: 3, fontWeight: 400 }}>
              👋 {intl.formatMessage({ id: 'dashboard.greeting' }, { 
                userName: user?.firstname || user?.username || 'User' 
              })}
            </Typography>
            <Box sx={{ mb: 3 }}>
              <CircularProgress size={40} />
            </Box>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
              {!isConnected 
                ? intl.formatMessage({ id: 'dashboard.connecting.title' })
                : intl.formatMessage({ id: 'dashboard.loading.title' })
              }
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {!isConnected 
                ? intl.formatMessage({ id: 'dashboard.connecting.subtitle' })
                : intl.formatMessage({ id: 'dashboard.loading.subtitle' })
              }
            </Typography>
            
            {/* Add retry button if loading takes too long */}
            <Button 
              variant="outlined" 
              size="small"
              onClick={() => {
                console.log('[Dashboard] Manual retry requested');
                setHasInitializedData(false); // Reset to trigger refetch
                const store = useMoodleStore.getState();
                store.fetchCourses().then(() => {
                  store.fetchAllCourseContent();
                });
              }}
              sx={{ mt: 2 }}
            >
              {intl.formatMessage({ id: 'dashboard.retry' })}
            </Button>
          </Box>
        ) : coursesError ? (
          // Show error state if there's an error loading courses
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h5" sx={{ mb: 3, fontWeight: 400 }}>
              👋 {intl.formatMessage({ id: 'dashboard.greeting' }, { 
                userName: user?.firstname || user?.username || 'User' 
              })}
            </Typography>
            <Typography variant="body1" color="error" sx={{ mb: 2 }}>
              {intl.formatMessage({ id: 'dashboard.error.title' })}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {coursesError}
            </Typography>
            <Button 
              variant="contained" 
              onClick={() => {
                const store = useMoodleStore.getState();
                store.fetchCourses();
              }}
            >
              {intl.formatMessage({ id: 'dashboard.error.retry' })}
            </Button>
          </Box>
        ) : (
          // Show authenticated dashboard content when data is ready
          <>
            {/* Personal Greeting */}
            <Typography variant="h4" sx={{ mb: 4, fontWeight: 400 }}>
              👋 {intl.formatMessage({ id: 'dashboard.greeting' }, { 
                userName: user?.firstname || user?.username || 'User' 
              })}
            </Typography>

            <Grid container spacing={3}>
              {/* Timeline Section */}
              <Grid item xs={12}>
                <Card sx={{ p: 3, mb: 3 }}>
                  <Typography variant="h6" sx={{ mb: 3, fontWeight: 500 }}>
                    {intl.formatMessage({ id: 'dashboard.timeline.title' })}
                  </Typography>
                  {renderTimeline()}
                </Card>
              </Grid>

              {/* Calendar Section */}
              <Grid item xs={12}>
                <Card sx={{ p: 3 }}>
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" sx={{ fontWeight: 500 }}>
                      {intl.formatMessage({ id: 'dashboard.calendar.title' })}
                    </Typography>
                  </Box>
                  {renderCalendar()}
                </Card>
              </Grid>
            </Grid>
          </>
        )}
      </Container>
    </>
  );
};