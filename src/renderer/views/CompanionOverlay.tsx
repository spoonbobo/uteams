import React from 'react';
import { Box, IconButton, Typography, alpha, useTheme, Tooltip } from '@mui/material';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import { useIntl } from 'react-intl';
import { ChatWidget } from '@/components/ChatWidget';
import { useCompanionStore } from '@/stores/useCompanionStore';

interface CompanionOverlayProps {
  sessionId: string;
  sessionName: string;
}

export const CompanionOverlay: React.FC<CompanionOverlayProps> = ({
  sessionId,
  sessionName,
}) => {
  const intl = useIntl();
  const theme = useTheme();
  const { updateBounds } = useCompanionStore();

  const handleExit = React.useCallback(() => {
    try {
      (window as any)?.electron?.companion?.close?.();
    } catch {}
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleExit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleExit]);

  // Listen for bounds changes from main process
  React.useEffect(() => {
    const handleBoundsChanged = (bounds: { x: number; y: number; width: number; height: number }) => {
      updateBounds(bounds);
    };

    // Use a global handler approach to avoid IPC cleanup issues
    (window as any).companionBoundsHandler = handleBoundsChanged;


    return () => {
      // Clean up the global handler
      delete (window as any).companionBoundsHandler;
    };
  }, [updateBounds]);

  return (
    <Box
      sx={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        p: 0,
        boxSizing: 'border-box',
        backgroundColor: 'transparent',
        border: 'none',
        outline: 'none',
      }}
    >
      {/* Single container with one translucent background */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          borderRadius: 1,
          overflow: 'hidden',
          backgroundColor: theme.palette.background.paper,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: 'none',
          outline: 'none',
          boxShadow: theme.shadows[8],
        }}
      >
        {/* Title bar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 1,
            borderBottom: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.mode === 'dark'
              ? alpha(theme.palette.background.default, 0.8)
              : alpha(theme.palette.background.default, 0.9),
            WebkitAppRegion: 'drag',
          }}
        >
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: theme.palette.text.primary,
            }}
          >
            {sessionName || intl.formatMessage({ id: 'overlay.companionTitle' })}
          </Typography>
          <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5, WebkitAppRegion: 'no-drag' }}>
            <Tooltip title={intl.formatMessage({ id: 'overlay.backToApp', defaultMessage: 'Back to app' })} placement="bottom">
              <IconButton
                size="small"
                onClick={handleExit}
                sx={{
                  color: theme.palette.text.secondary,
                  '&:hover': {
                    color: theme.palette.text.primary,
                    backgroundColor: alpha(theme.palette.action.hover, 0.1),
                  },
                }}
              >
                <LoginOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {null}
          </Box>
        </Box>

        {/* Body */}
        <Box sx={{
          p: 1,
          flex: 1,
          minHeight: 0,
          backgroundColor: theme.palette.background.paper,
          '& .MuiAppBar-root': { display: 'none' },
        }}>
          <ChatWidget sessionId={sessionId} sessionName={sessionName} />
        </Box>
      </Box>
    </Box>
  );
};


