import React, { useState, useEffect } from 'react';
import {
  Box,
  IconButton,
  Typography,
  Menu,
  MenuItem,
  Divider,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Minimize as MinimizeIcon,
  CropSquare as MaximizeIcon,
  FilterNone as RestoreIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import './TitleBar.css';

interface TitleBarProps {
  title?: string;
}

export const TitleBar: React.FC<TitleBarProps> = ({ title = 'THEiTeams' }) => {
  const theme = useTheme();
  const [isMaximized, setIsMaximized] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string>('');

  // Check if window is maximized on mount and listen for changes
  useEffect(() => {
    const checkMaximized = async () => {
      const maximized = await (window as any).electron?.ipcRenderer?.invoke('window:is-maximized');
      setIsMaximized(maximized || false);
    };
    
    checkMaximized();
    
    // Listen for window state changes if needed
    const interval = setInterval(checkMaximized, 500);
    return () => clearInterval(interval);
  }, []);

  // Fetch app version on mount
  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const version = await (window as any).electron?.ipcRenderer?.invoke('app:get-version');
        setAppVersion(version || '');
      } catch (error) {
        console.error('Failed to fetch app version:', error);
      }
    };
    fetchVersion();
  }, []);

  const handleMinimize = () => {
    (window as any).electron?.ipcRenderer?.invoke('window:minimize');
  };

  const handleMaximize = () => {
    (window as any).electron?.ipcRenderer?.invoke('window:maximize');
    setIsMaximized(!isMaximized);
  };

  const handleClose = () => {
    (window as any).electron?.ipcRenderer?.invoke('window:close');
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, menuName: string) => {
    setAnchorEl(event.currentTarget);
    setActiveMenu(menuName);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setActiveMenu(null);
  };

  const handleZoomIn = () => {
    (window as any).electron?.ipcRenderer?.invoke('app:zoom-in');
    handleMenuClose();
  };

  const handleZoomOut = () => {
    (window as any).electron?.ipcRenderer?.invoke('app:zoom-out');
    handleMenuClose();
  };

  const handleZoomReset = () => {
    (window as any).electron?.ipcRenderer?.invoke('app:zoom-reset');
    handleMenuClose();
  };

  const handleReload = () => {
    window.location.reload();
    handleMenuClose();
  };

  const handleToggleDevTools = () => {
    (window as any).electron?.ipcRenderer?.invoke('window:toggle-dev-tools');
    handleMenuClose();
  };

  const isWindows = navigator.platform.indexOf('Win') > -1;
  const isMac = navigator.platform.indexOf('Mac') > -1;

  return (
    <Box
      className="titlebar-container titlebar-drag"
      sx={{
        display: 'flex',
        alignItems: 'center',
        height: 32,
        minHeight: 32,
        maxHeight: 32,
        backgroundColor: theme.palette.background.paper,
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        position: 'relative',
        zIndex: 1300,
        flexShrink: 0, // Prevent shrinking
      }}
    >
      {/* App Icon and Title - Keep draggable */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 1.5,
          gap: 1,
        }}
      >
        <img
          src="/assets/icon.png"
          alt="App Icon"
          style={{ width: 20, height: 20 }}
          onError={(e) => {
            // Fallback if icon doesn't load
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {title}
        </Typography>
      </Box>

      {/* Menu Bar */}
      <Box
        className="titlebar-no-drag"
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 1,
          gap: 0.5,
        }}
      >

        {/* Edit Menu */}
        <Box
          onClick={(e) => handleMenuOpen(e, 'edit')}
          sx={{
            px: 1.5,
            py: 0.25,
            cursor: 'pointer',
            borderRadius: 0.5,
            display: 'flex',
            alignItems: 'center',
            height: '100%',
            '&:hover': {
              backgroundColor: alpha(theme.palette.action.hover, 0.08),
            },
          }}
        >
          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
            Edit
          </Typography>
        </Box>

        {/* View Menu */}
        <Box
          onClick={(e) => handleMenuOpen(e, 'view')}
          sx={{
            px: 1.5,
            py: 0.25,
            cursor: 'pointer',
            borderRadius: 0.5,
            display: 'flex',
            alignItems: 'center',
            height: '100%',
            '&:hover': {
              backgroundColor: alpha(theme.palette.action.hover, 0.08),
            },
          }}
        >
          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
            View
          </Typography>
        </Box>

        {/* Help Menu */}
        <Box
          onClick={(e) => handleMenuOpen(e, 'help')}
          sx={{
            px: 1.5,
            py: 0.25,
            cursor: 'pointer',
            borderRadius: 0.5,
            display: 'flex',
            alignItems: 'center',
            height: '100%',
            '&:hover': {
              backgroundColor: alpha(theme.palette.action.hover, 0.08),
            },
          }}
        >
          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
            Help
          </Typography>
        </Box>
      </Box>
      
      {/* Spacer for draggable area */}
      <Box sx={{ flex: 1 }} />

      {/* Version Display */}
      {appVersion && (
        <Typography
          variant="caption"
          sx={{
            color: alpha(theme.palette.text.secondary, 0.7),
            fontSize: '0.75rem',
            fontWeight: 400,
            mx: 2,
            userSelect: 'none',
          }}
        >
          v{appVersion}
        </Typography>
      )}

      {/* Window Controls */}
      <Box
        className="titlebar-no-drag"
        sx={{
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <IconButton
          size="small"
          onClick={handleMinimize}
          sx={{
            borderRadius: 0,
            width: 46,
            height: 32,
            '&:hover': {
              backgroundColor: alpha(theme.palette.action.hover, 0.08),
            },
          }}
        >
          <MinimizeIcon sx={{ fontSize: 16 }} />
        </IconButton>
        
        <IconButton
          size="small"
          onClick={handleMaximize}
          sx={{
            borderRadius: 0,
            width: 46,
            height: 32,
            '&:hover': {
              backgroundColor: alpha(theme.palette.action.hover, 0.08),
            },
          }}
        >
          {isMaximized ? (
            <RestoreIcon sx={{ fontSize: 16 }} />
          ) : (
            <MaximizeIcon sx={{ fontSize: 16 }} />
          )}
        </IconButton>
        
        <IconButton
          size="small"
          onClick={handleClose}
          sx={{
            borderRadius: 0,
            width: 46,
            height: 32,
            '&:hover': {
              backgroundColor: alpha(theme.palette.error.main, 0.15),
              color: theme.palette.error.main,
            },
          }}
        >
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {/* Menu Dropdowns */}

      <Menu
        anchorEl={anchorEl}
        open={activeMenu === 'edit'}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        <MenuItem onClick={handleMenuClose}>Undo</MenuItem>
        <MenuItem onClick={handleMenuClose}>Redo</MenuItem>
        <Divider />
        <MenuItem onClick={handleMenuClose}>Cut</MenuItem>
        <MenuItem onClick={handleMenuClose}>Copy</MenuItem>
        <MenuItem onClick={handleMenuClose}>Paste</MenuItem>
        <MenuItem onClick={handleMenuClose}>Select All</MenuItem>
      </Menu>

      <Menu
        anchorEl={anchorEl}
        open={activeMenu === 'view'}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        <MenuItem onClick={handleReload}>
          Reload {isMac ? '⌘R' : 'Ctrl+R'}
        </MenuItem>
        {process.env.NODE_ENV === 'development' && (
          <MenuItem onClick={handleToggleDevTools}>
            Toggle Developer Tools {isMac ? '⌥⌘I' : 'Ctrl+Shift+I'}
          </MenuItem>
        )}
        <Divider />
        <MenuItem onClick={handleZoomIn}>
          Zoom In {isMac ? '⌘+' : 'Ctrl++'}
        </MenuItem>
        <MenuItem onClick={handleZoomOut}>
          Zoom Out {isMac ? '⌘-' : 'Ctrl+-'}
        </MenuItem>
        <MenuItem onClick={handleZoomReset}>
          Reset Zoom {isMac ? '⌘0' : 'Ctrl+0'}
        </MenuItem>
      </Menu>

      <Menu
        anchorEl={anchorEl}
        open={activeMenu === 'help'}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        <MenuItem onClick={handleMenuClose}>Documentation</MenuItem>
        <MenuItem onClick={handleMenuClose}>About</MenuItem>
      </Menu>
    </Box>
  );
};
