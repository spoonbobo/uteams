import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Alert,
  Divider,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Assignment as AssignmentIcon,
  Schedule as ScheduleIcon,
  Grade as GradeIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useIntl } from 'react-intl';
import type { MoodleAssignment } from '../../../stores/useMoodleStore';
import { useMoodleStore } from '../../../stores/useMoodleStore';

export type SortOrder = 'newest' | 'oldest';

interface AssignmentsPanelProps {
  assignments: MoodleAssignment[];
  isLoading: boolean;
  error: string | null;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  sortOrder?: SortOrder;
  onSortChange?: (sortOrder: SortOrder) => void;
}

export const AssignmentsPanel: React.FC<AssignmentsPanelProps> = ({
  assignments,
  isLoading,
  error,
  searchTerm,
  onSearchChange,
  sortOrder = 'newest',
  onSortChange,
}) => {
  const intl = useIntl();
  const theme = useTheme();
  const { getMoodleAssignmentUrl } = useMoodleStore();

  const filteredAssignments = React.useMemo(() => {
    let filtered = assignments;
    
    // Filter by search term if provided
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = assignments.filter(assignment =>
        assignment.name.toLowerCase().includes(term) ||
        (assignment.intro && assignment.intro.toLowerCase().includes(term))
      );
    }
    
    // Sort by due date based on user preference
    // Assignments with no due date go to the end
    return filtered.sort((a, b) => {
      const isNewestFirst = sortOrder === 'newest';
      
      // If both have due dates, sort by due date
      if (a.duedate && b.duedate) {
        return isNewestFirst ? b.duedate - a.duedate : a.duedate - b.duedate;
      }
      // If only one has due date, prioritize the one with due date
      if (a.duedate && !b.duedate) return -1;
      if (!a.duedate && b.duedate) return 1;
      // If neither has due date, sort by ID
      return isNewestFirst ? Number(b.id) - Number(a.id) : Number(a.id) - Number(b.id);
    });
  }, [assignments, searchTerm, sortOrder]);

  // Calculate shared time scale for filtered assignments
  const getTimeScale = () => {
    const now = Date.now();
    const assignmentsWithDates = filteredAssignments.filter(a => a.duedate);
    
    if (assignmentsWithDates.length === 0) return { minTime: now, maxTime: now, range: 0 };
    
    const dueDates = assignmentsWithDates.map(a => a.duedate * 1000);
    const minTime = Math.min(now, ...dueDates);
    const maxTime = Math.max(now, ...dueDates);
    const range = maxTime - minTime;
    
    return { minTime, maxTime, range };
  };

  const timeScale = getTimeScale();

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'No due date';
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const getDaysInfo = (duedate: number) => {
    if (!duedate) return { text: 'No due date', days: null, isOverdue: false };
    
    const now = Date.now();
    const due = duedate * 1000;
    const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { 
        text: `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} overdue`, 
        days: Math.abs(diffDays), 
        isOverdue: true 
      };
    } else if (diffDays === 0) {
      return { text: 'Due today', days: 0, isOverdue: false };
    } else {
      return { 
        text: `${diffDays} day${diffDays === 1 ? '' : 's'} left`, 
        days: diffDays, 
        isOverdue: false 
      };
    }
  };

  const renderTimeline = (assignment: MoodleAssignment) => {
    if (!assignment.duedate) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            No due date
          </Typography>
        </Box>
      );
    }

    const daysInfo = getDaysInfo(assignment.duedate);
    const now = Date.now();
    const dueDate = new Date(assignment.duedate * 1000);
    const dueDateMs = assignment.duedate * 1000;
    
    // Calculate position on shared time scale
    let todayPosition = 0;
    let dueDatePosition = 1;
    
    if (timeScale.range > 0) {
      dueDatePosition = (dueDateMs - timeScale.minTime) / timeScale.range;
      todayPosition = (now - timeScale.minTime) / timeScale.range;
    }
    
    // Ensure chronological order: due date first, then today
    const leftMarker = dueDateMs <= now 
      ? { label: 'Due', date: dueDate, position: dueDatePosition }
      : { label: 'Today', date: new Date(), position: todayPosition };
      
    const rightMarker = dueDateMs <= now 
      ? { label: 'Today', date: new Date(), position: todayPosition }
      : { label: 'Due', date: dueDate, position: dueDatePosition };
    
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 300 }}>
        {/* Left marker */}
        <Box sx={{ textAlign: 'center', minWidth: 50, flexShrink: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
            {leftMarker.label}
          </Typography>
          <Typography 
            variant="caption" 
            sx={{ 
              fontSize: '0.7rem', 
              fontWeight: 500,
              color: leftMarker.label === 'Due' && daysInfo.isOverdue ? 'error.main' : 'text.primary'
            }}
          >
            {leftMarker.date.getDate()}/{leftMarker.date.getMonth() + 1}
          </Typography>
        </Box>
        
        {/* Timeline line */}
        <Box sx={{ flex: 1, position: 'relative', height: 24, display: 'flex', alignItems: 'center', mx: 1 }}>
          {/* Background line */}
          <Box
            sx={{
              width: '100%',
              height: 3,
              backgroundColor: 'grey.300',
              borderRadius: 1.5,
              position: 'relative',
            }}
          >
            {/* Progress line - from left marker to current position */}
            <Box
              sx={{
                width: `${Math.abs(todayPosition - dueDatePosition) * 100}%`,
                height: '100%',
                backgroundColor: daysInfo.isOverdue ? 'error.main' : daysInfo.days === 0 ? 'warning.main' : 'primary.main',
                borderRadius: 1.5,
                position: 'absolute',
                left: `${Math.min(todayPosition, dueDatePosition) * 100}%`,
                transition: 'all 0.3s ease',
              }}
            />
            
            {/* Today position indicator */}
            <Box
              sx={{
                position: 'absolute',
                left: `${todayPosition * 100}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: 'primary.main',
                border: '2px solid white',
                boxShadow: 1,
                zIndex: 2,
              }}
            />
            
            {/* Due date position indicator */}
            <Box
              sx={{
                position: 'absolute',
                left: `${dueDatePosition * 100}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: daysInfo.isOverdue ? 'error.main' : daysInfo.days === 0 ? 'warning.main' : 'success.main',
                border: '1px solid white',
                boxShadow: 1,
                zIndex: 1,
              }}
            />
          </Box>
          
          {/* Days indicator - positioned in center */}
          <Box
            sx={{
              position: 'absolute',
              left: '50%',
              top: '-8px',
              transform: 'translateX(-50%)',
              backgroundColor: daysInfo.isOverdue ? 'error.main' : daysInfo.days === 0 ? 'warning.main' : 'primary.main',
              color: 'white',
              px: 1,
              py: 0.25,
              borderRadius: 1,
              fontSize: '0.65rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              boxShadow: 1,
              zIndex: 3,
            }}
          >
            {daysInfo.text}
          </Box>
        </Box>
        
        {/* Right marker */}
        <Box sx={{ textAlign: 'center', minWidth: 50, flexShrink: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
            {rightMarker.label}
          </Typography>
          <Typography 
            variant="caption" 
            sx={{ 
              fontSize: '0.7rem', 
              fontWeight: 500,
              color: rightMarker.label === 'Today' && daysInfo.isOverdue ? 'error.main' : 'text.primary'
            }}
          >
            {rightMarker.date.getDate()}/{rightMarker.date.getMonth() + 1}
          </Typography>
        </Box>
      </Box>
    );
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Failed to load assignments: {error}
      </Alert>
    );
  }

  if (assignments.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 0.5 }}>
          No assignments found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          This course doesn't have any assignments yet.
        </Typography>
      </Box>
    );
  }

  const handleAssignmentClick = (assignment: MoodleAssignment) => {
    const assignmentUrl = getMoodleAssignmentUrl(assignment);
    window.open(assignmentUrl, '_blank', 'noopener,noreferrer');
  };


  return (
    <Box>
      {/* Assignments List */}
      <Box sx={{ '& > *:not(:last-child)': { mb: 1.5 } }}>
        {filteredAssignments.map((assignment) => (
          <Box
            key={assignment.id}
            onClick={() => handleAssignmentClick(assignment)}
            sx={{
              p: 2,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              backgroundColor: 'background.paper',
              cursor: 'pointer',
              '&:hover': {
                borderColor: 'primary.light',
                backgroundColor: 'action.hover',
              },
            }}
          >
            {/* Header with title and grade */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1, pr: 1 }}>
                {assignment.name}
              </Typography>
              
              {assignment.grade && (
                <Box
                  sx={{
                    backgroundColor: theme.palette.mode === 'dark' 
                      ? theme.palette.success.dark 
                      : theme.palette.success.light,
                    color: theme.palette.mode === 'dark' 
                      ? theme.palette.success.contrastText || theme.palette.text.primary
                      : theme.palette.success.dark,
                    px: 1.5,
                    py: 0.5,
                    borderRadius: theme.shape.borderRadius / 8, // Use theme's borderRadius
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    border: `1px solid ${theme.palette.success.main}`,
                  }}
                >
                  Max Grade: {assignment.grade}
                </Box>
              )}
            </Box>
            
            {/* Timeline visualization */}
            {renderTimeline(assignment)}
          </Box>
        ))}
      </Box>

      {filteredAssignments.length === 0 && searchTerm && (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No assignments found matching "{searchTerm}"
          </Typography>
        </Box>
      )}
    </Box>
  );
};
