import React from 'react';
import { Box, IconButton, Typography, alpha, useTheme, Tooltip, Select, MenuItem, FormControl } from '@mui/material';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined';
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
  const { updateBounds, ocrCaptureEnabled, toggleOcrCapture, ocrLanguage, setOcrLanguage } = useCompanionStore();
  const [availableLanguages, setAvailableLanguages] = React.useState<string[]>([]);

  // Language display names for the three supported languages
  const languageNames: Record<string, string> = {
    'eng': 'English',
    'chi_sim': '中文 (简体)',
    'chi_tra': '中文 (繁體)',
  };

  const handleExit = React.useCallback(() => {
    try {
      (window as any)?.electron?.companion?.close?.();
    } catch {}
  }, []);

  const handleToggleOcrCapture = React.useCallback(() => {
    toggleOcrCapture();
  }, [toggleOcrCapture]);

  const handleLanguageChange = React.useCallback((event: any) => {
    setOcrLanguage(event.target.value);
  }, [setOcrLanguage]);

  // Load available languages on mount
  React.useEffect(() => {
    // Only show English, Chinese Simplified, and Chinese Traditional
    setAvailableLanguages(['eng', 'chi_sim', 'chi_tra']);
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
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5, WebkitAppRegion: 'no-drag' }}>
            {/* OCR Language Selector */}
            <Tooltip title={intl.formatMessage({ id: 'overlay.selectLanguage' })} placement="bottom">
              <FormControl size="small" sx={{ minWidth: 80 }}>
                <Select
                  value={ocrLanguage}
                  onChange={handleLanguageChange}
                  displayEmpty
                  sx={{
                    height: 28,
                    fontSize: '0.75rem',
                    color: theme.palette.text.secondary,
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: alpha(theme.palette.divider, 0.3),
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: alpha(theme.palette.divider, 0.5),
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: theme.palette.primary.main,
                    },
                    '& .MuiSelect-select': {
                      py: 0.5,
                      px: 1,
                    },
                  }}
                >
                  {availableLanguages.map((lang) => (
                    <MenuItem key={lang} value={lang} sx={{ fontSize: '0.75rem' }}>
                      {languageNames[lang] || lang.toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Tooltip>

            {/* Capture Screen Toggle Button */}
            <Tooltip
              title={intl.formatMessage({
                id: ocrCaptureEnabled ? 'overlay.disableCapture' : 'overlay.enableCapture'
              })}
              placement="bottom"
            >
              <IconButton
                size="small"
                onClick={handleToggleOcrCapture}
                sx={{
                  color: ocrCaptureEnabled
                    ? theme.palette.primary.main
                    : theme.palette.text.secondary,
                  backgroundColor: ocrCaptureEnabled
                    ? alpha(theme.palette.primary.main, 0.1)
                    : 'transparent',
                  '&:hover': {
                    color: ocrCaptureEnabled
                      ? theme.palette.primary.dark
                      : theme.palette.text.primary,
                    backgroundColor: ocrCaptureEnabled
                      ? alpha(theme.palette.primary.main, 0.2)
                      : alpha(theme.palette.action.hover, 0.1),
                  },
                }}
              >
                <CameraAltOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {/* Back to App Button */}
            <Tooltip title={intl.formatMessage({ id: 'overlay.backToApp' })} placement="bottom">
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
          <ChatWidget
            sessionId={sessionId}
            sessionName={sessionName}
            ocrCaptureEnabled={ocrCaptureEnabled}
            ocrLanguage={ocrLanguage}
          />
        </Box>
      </Box>
    </Box>
  );
};


