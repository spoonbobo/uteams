import React from 'react';
import {
  Box,
  Typography,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  CircularProgress,
  Alert,
  Chip,
  TextField,
  InputAdornment,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  People as PeopleIcon,
  Search as SearchIcon,
  Email as EmailIcon,
  School as SchoolIcon,
} from '@mui/icons-material';
import { useIntl } from 'react-intl';
import type { MoodleUser } from '../../../stores/useMoodleStore';
import { useMoodleStore } from '../../../stores/useMoodleStore';

interface StudentsPanelProps {
  students: MoodleUser[];
  isLoading: boolean;
  error: string | null;
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export const StudentsPanel: React.FC<StudentsPanelProps> = ({
  students,
  isLoading,
  error,
  searchTerm,
  onSearchChange,
}) => {
  const intl = useIntl();
  const theme = useTheme();
  const { getMoodleUserUrl } = useMoodleStore();

  const filteredStudents = React.useMemo(() => {
    if (!searchTerm) return students;
    
    const term = searchTerm.toLowerCase();
    return students.filter(
      (student) =>
        student.fullname.toLowerCase().includes(term) ||
        student.email.toLowerCase().includes(term) ||
        student.username.toLowerCase().includes(term)
    );
  }, [students, searchTerm]);

  const getInitials = (fullname: string) => {
    return fullname
      .split(' ')
      .map((name) => name[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      '#f44336', '#e91e63', '#9c27b0', '#673ab7',
      '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4',
      '#009688', '#4caf50', '#8bc34a', '#cddc39',
      '#ffeb3b', '#ffc107', '#ff9800', '#ff5722',
    ];
    
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
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
        Failed to load students: {error}
      </Alert>
    );
  }

  if (students.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 0.5 }}>
          No students found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          This course doesn't have any enrolled students yet.
        </Typography>
      </Box>
    );
  }

  const handleStudentClick = (student: MoodleUser) => {
    const userUrl = getMoodleUserUrl(student.id);
    window.open(userUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Box>
      <Box sx={{ '& > *:not(:last-child)': { mb: 1 } }}>
        {filteredStudents.map((student) => (
          <Box
            key={student.id}
            onClick={() => handleStudentClick(student)}
            sx={{
              p: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              backgroundColor: 'background.paper',
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: 'action.hover',
                borderColor: 'primary.light',
              },
            }}
          >
            {/* Single row with all student information */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar
                sx={{
                  bgcolor: getAvatarColor(student.fullname),
                  width: 28,
                  height: 28,
                  fontSize: '0.8rem',
                  flexShrink: 0,
                }}
              >
                {getInitials(student.fullname)}
              </Avatar>
              
              {/* Student name */}
              <Typography 
                variant="subtitle2" 
                sx={{ 
                  fontWeight: 600,
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {student.fullname}
              </Typography>
              
              {/* Username badge */}
              <Box
                sx={{
                  backgroundColor: theme.palette.mode === 'dark' 
                    ? theme.palette.secondary.dark 
                    : theme.palette.secondary.light,
                  color: theme.palette.mode === 'dark' 
                    ? theme.palette.secondary.contrastText || theme.palette.text.primary
                    : theme.palette.secondary.dark,
                  px: 1,
                  py: 0.25,
                  borderRadius: theme.shape.borderRadius / 8,
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  flexShrink: 0,
                  border: `1px solid ${theme.palette.secondary.main}`,
                }}
              >
                @{student.username}
              </Box>
              
              {/* Email badge */}
              {student.email && (
                <Box
                  sx={{
                    backgroundColor: theme.palette.mode === 'dark' 
                      ? theme.palette.info.dark 
                      : theme.palette.info.light,
                    color: theme.palette.mode === 'dark' 
                      ? theme.palette.info.contrastText || theme.palette.text.primary
                      : theme.palette.info.dark,
                    px: 1,
                    py: 0.25,
                    borderRadius: theme.shape.borderRadius / 8,
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    flexShrink: 0,
                    maxWidth: 200,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    border: `1px solid ${theme.palette.info.main}`,
                  }}
                >
                  {student.email}
                </Box>
              )}
              
              {/* Department/Institution badge */}
              {(student.department || student.institution) && (
                <Box
                  sx={{
                    backgroundColor: theme.palette.mode === 'dark' 
                      ? theme.palette.primary.dark 
                      : theme.palette.primary.light,
                    color: theme.palette.mode === 'dark' 
                      ? theme.palette.primary.contrastText || theme.palette.text.primary
                      : theme.palette.primary.dark,
                    px: 1,
                    py: 0.25,
                    borderRadius: theme.shape.borderRadius / 8,
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    flexShrink: 0,
                    maxWidth: 150,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    border: `1px solid ${theme.palette.primary.main}`,
                  }}
                >
                  {[student.department, student.institution].filter(Boolean).join(', ')}
                </Box>
              )}
            </Box>
          </Box>
        ))}
      </Box>

      {filteredStudents.length === 0 && searchTerm && (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No students found matching "{searchTerm}"
          </Typography>
        </Box>
      )}
    </Box>
  );
};
