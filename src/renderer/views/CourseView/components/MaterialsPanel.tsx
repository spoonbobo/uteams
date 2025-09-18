import React from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Folder as FolderIcon,
  InsertDriveFile as FileIcon,
  Link as LinkIcon,
  Quiz as QuizIcon,
  Forum as ForumIcon,
  Assignment as AssignmentIcon,
  VideoLibrary as VideoIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';
import { useIntl } from 'react-intl';
import type { MoodleActivity } from '@/types/moodle';
import { useAppStore } from '@/stores/useAppStore';

interface MaterialsPanelProps {
  activities: MoodleActivity[];
  isLoading: boolean;
  error: string | null;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  typeFilter?: string[];
  onTypeFilterChange?: (filter: string[]) => void;
}

export const MaterialsPanel: React.FC<MaterialsPanelProps> = ({
  activities,
  isLoading,
  error,
  searchTerm,
  onSearchChange,
  typeFilter = [],
  onTypeFilterChange,
}) => {
  const intl = useIntl();
  const theme = useTheme();
  const { preferences } = useAppStore();

  const getActivityTypeLabel = (modname: string) => {
    const labelMap: Record<string, string> = {
      assign: 'Assignment',
      quiz: 'Quiz',
      forum: 'Forum',
      url: 'Link',
      resource: 'File',
      folder: 'Folder',
      page: 'Page',
      book: 'Book',
      video: 'Video',
      label: 'Label',
    };
    return labelMap[modname] || modname.charAt(0).toUpperCase() + modname.slice(1);
  };

  const filteredActivities = React.useMemo(() => {
    let filtered = activities;

    // Filter by type first (multi-select)
    if (typeFilter && typeFilter.length > 0) {
      filtered = filtered.filter(activity => typeFilter.includes(activity.modname));
    }

    // Then filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(activity =>
        activity.name.toLowerCase().includes(term) ||
        (activity.description && activity.description.toLowerCase().includes(term)) ||
        getActivityTypeLabel(activity.modname).toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [activities, searchTerm, typeFilter]);

  const getActivityIcon = (modname: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      assign: <AssignmentIcon />,
      quiz: <QuizIcon />,
      forum: <ForumIcon />,
      url: <LinkIcon />,
      resource: <FileIcon />,
      folder: <FolderIcon />,
      page: <DescriptionIcon />,
      book: <DescriptionIcon />,
      video: <VideoIcon />,
      label: <DescriptionIcon />,
    };
    return iconMap[modname] || <FileIcon />;
  };

  const getActivityTypeColor = (modname: string) => {
    const colorMap: Record<string, 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'> = {
      assign: 'primary',
      quiz: 'warning',
      forum: 'info',
      url: 'secondary',
      resource: 'success',
      folder: 'success',
      page: 'info',
      book: 'info',
      video: 'secondary',
    };
    return colorMap[modname] || 'default' as any;
  };

  // Flatten filtered activities with section info
  const flattenedActivities = React.useMemo(() => {
    return filteredActivities.map(activity => ({
      ...activity,
      sectionName: (activity.section || 0) === 0 ? 'General' : `Section ${activity.section}`,
      sectionNum: activity.section || 0
    })).sort((a, b) => a.sectionNum - b.sectionNum);
  }, [filteredActivities]);

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
        Failed to load materials: {error}
      </Alert>
    );
  }

  if (activities.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 0.5 }}>
          No materials found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          This course doesn't have any materials yet.
        </Typography>
      </Box>
    );
  }

  const handleActivityClick = (activity: any) => {
    if (activity.url) {
      window.open(activity.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Box>
      <Box sx={{ '& > *:not(:last-child)': { mb: 1 } }}>
        {flattenedActivities.map((activity) => (
          <Box
            key={activity.id}
            onClick={() => handleActivityClick(activity)}
            sx={{
              p: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              backgroundColor: preferences.transparentMode
                ? 'rgba(255, 255, 255, 0.02)'
                : 'background.paper',
              backdropFilter: preferences.transparentMode ? 'blur(5px)' : 'none',
              cursor: activity.url ? 'pointer' : 'default',
              '&:hover': {
                borderColor: activity.url ? 'primary.light' : 'divider',
                backgroundColor: activity.url
                  ? (preferences.transparentMode ? 'rgba(255, 255, 255, 0.05)' : 'action.hover')
                  : (preferences.transparentMode ? 'rgba(255, 255, 255, 0.02)' : 'background.paper'),
              },
            }}
          >
            {/* Single row with all information */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {/* Activity name */}
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  flex: 1,
                  color: activity.url ? 'primary.main' : 'text.primary',
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {activity.name}
              </Typography>

              {/* Section badge */}
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
                  border: `1px solid ${theme.palette.info.main}`,
                }}
              >
                {activity.sectionName}
              </Box>

              {/* Type badge */}
              <Box
                sx={{
                  backgroundColor: (() => {
                    const colorType = getActivityTypeColor(activity.modname);
                    const paletteColor = theme.palette[colorType] || theme.palette.secondary;
                    return theme.palette.mode === 'dark' ? paletteColor.dark : paletteColor.light;
                  })(),
                  color: (() => {
                    const colorType = getActivityTypeColor(activity.modname);
                    const paletteColor = theme.palette[colorType] || theme.palette.secondary;
                    return theme.palette.mode === 'dark'
                      ? paletteColor.contrastText || theme.palette.text.primary
                      : paletteColor.dark;
                  })(),
                  px: 1,
                  py: 0.25,
                  borderRadius: theme.shape.borderRadius / 8,
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  flexShrink: 0,
                  border: `1px solid ${(() => {
                    const colorType = getActivityTypeColor(activity.modname);
                    const paletteColor = theme.palette[colorType] || theme.palette.secondary;
                    return paletteColor.main;
                  })()}`,
                }}
              >
                {getActivityTypeLabel(activity.modname)}
              </Box>

              {!activity.visible && (
                <Box
                  sx={{
                    backgroundColor: theme.palette.mode === 'dark'
                      ? theme.palette.warning.dark
                      : theme.palette.warning.light,
                    color: theme.palette.mode === 'dark'
                      ? theme.palette.warning.contrastText || theme.palette.text.primary
                      : theme.palette.warning.dark,
                    px: 1,
                    py: 0.25,
                    borderRadius: theme.shape.borderRadius / 8,
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    flexShrink: 0,
                    border: `1px solid ${theme.palette.warning.main}`,
                  }}
                >
                  Hidden
                </Box>
              )}
            </Box>
          </Box>
        ))}
      </Box>

      {filteredActivities.length === 0 && searchTerm && (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No materials found matching "{searchTerm}"
          </Typography>
        </Box>
      )}
    </Box>
  );
};
