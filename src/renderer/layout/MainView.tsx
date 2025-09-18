import React from 'react';
import { Box } from '@mui/material';

interface MainViewProps {
  children: React.ReactNode;
  sidebarWidth: number;
}

export default function MainView({ children, sidebarWidth }: MainViewProps) {
  const [isFullScreen, setIsFullScreen] = React.useState(false);

  // Track fullscreen state with smooth transitions
  React.useEffect(() => {
    const handleFullScreenChange = () => {
      // Check both HTML5 fullscreen API and Electron window fullscreen
      const htmlFullScreen =
        document.fullscreenElement !== null ||
        (document as any).webkitFullscreenElement !== null ||
        (document as any).mozFullScreenElement !== null ||
        (document as any).msFullscreenElement !== null;

      // Check window dimensions as fallback for Electron fullscreen
      const windowFullScreen =
        window.innerWidth === window.screen.width &&
        window.innerHeight === window.screen.height;

      const newFullScreenState = htmlFullScreen || windowFullScreen;

      // Use requestAnimationFrame for smooth state update
      requestAnimationFrame(() => {
        setIsFullScreen(newFullScreenState);
      });
    };

    const handleFullScreenChanging = (...args: unknown[]) => {
      // Immediately set the target fullscreen state when we know it's about to change
      const targetState = args[1] as boolean;
      requestAnimationFrame(() => {
        setIsFullScreen(targetState);
      });
    };

    const handleFullScreenChanged = () => {
      // Double-check the actual state after change is complete
      handleFullScreenChange();
    };

    // Initial state check
    handleFullScreenChange();

    // Listen for HTML5 fullscreen API changes
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullScreenChange);
    document.addEventListener('mozfullscreenchange', handleFullScreenChange);
    document.addEventListener('MSFullscreenChange', handleFullScreenChange);

    // Listen for window resize (Electron fullscreen via menu)
    window.addEventListener('resize', handleFullScreenChange);

    // Listen for Electron IPC events if available
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.on(
        'fullscreen-changing',
        handleFullScreenChanging,
      );
      window.electron.ipcRenderer.on(
        'fullscreen-changed',
        handleFullScreenChanged,
      );
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
      document.removeEventListener(
        'webkitfullscreenchange',
        handleFullScreenChange,
      );
      document.removeEventListener(
        'mozfullscreenchange',
        handleFullScreenChange,
      );
      document.removeEventListener(
        'MSFullscreenChange',
        handleFullScreenChange,
      );
      window.removeEventListener('resize', handleFullScreenChange);

      if (window.electron?.ipcRenderer) {
        window.electron.ipcRenderer.removeAllListeners('fullscreen-changing');
        window.electron.ipcRenderer.removeAllListeners('fullscreen-changed');
      }
    };
  }, []);

  return (
    <Box
      component="main"
      sx={{
        flexGrow: 1,
        width: isFullScreen ? '100%' : `calc(100vw - ${sidebarWidth}px)`,
        height: '100%', // Changed from 100vh to 100%
        maxWidth: isFullScreen ? '100%' : `calc(100vw - ${sidebarWidth}px)`,
        marginLeft: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative', // Establish containing block
        boxSizing: 'border-box',
        backgroundColor: 'transparent', // Always transparent - background is handled by the background system
        transition:
          'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1)', // Smooth transitions always
        willChange: 'width, max-width, transform', // Optimize for all changes
      }}
    >
      {children}
    </Box>
  );
}
