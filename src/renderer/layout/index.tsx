import React from 'react';
import { Box } from '@mui/material';
import { SidebarCollapse, SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from './SidebarCollapse';
import TopBar from './TopBar';
import MainView from './MainView';
import { useLayoutStore } from '@/stores/useLayoutStore';
import TitleBar from '@/components/TitleBar';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { sidebarCollapsed } = useLayoutStore();
  const [isFullScreenTransitioning, setIsFullScreenTransitioning] = React.useState(false);
  const currentSidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  // Removed sidebar transition state handling

  // Handle fullscreen transition state with smooth animation
  React.useEffect(() => {
    const handleFullScreenChange = () => {
      // Enable transition mode immediately when fullscreen starts changing
      setIsFullScreenTransitioning(true);

      // Use requestAnimationFrame to ensure smooth animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsFullScreenTransitioning(false);
        });
      });
    };

    const handleFullScreenChanging = () => {
      // Start transition immediately when we know fullscreen is about to change
      setIsFullScreenTransitioning(true);
    };

    const handleFullScreenChanged = () => {
      // End transition after fullscreen change is complete
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsFullScreenTransitioning(false);
        });
      });
    };

    // Listen for HTML5 fullscreen API changes
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullScreenChange);
    document.addEventListener('mozfullscreenchange', handleFullScreenChange);
    document.addEventListener('MSFullscreenChange', handleFullScreenChange);

    // Add Electron IPC listeners if available
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.on('fullscreen-changing', handleFullScreenChanging);
      window.electron.ipcRenderer.on('fullscreen-changed', handleFullScreenChanged);
    }

    // Fallback: Listen for window resize events that might indicate fullscreen changes
    const handleResize = () => {
      // Small delay to let the window finish resizing
      setTimeout(handleFullScreenChange, 16); // ~1 frame delay
    };

    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullScreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullScreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullScreenChange);
      window.removeEventListener('resize', handleResize);

      if (window.electron?.ipcRenderer) {
        window.electron.ipcRenderer.removeAllListeners('fullscreen-changing');
        window.electron.ipcRenderer.removeAllListeners('fullscreen-changed');
      }
    };
  }, []);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        // Remove transition from here - let child components handle their own
      }}
    >
      {/* Custom Title Bar */}
      <TitleBar />

      {/* Main Layout */}
      <Box
        className="app-main-layout"
        sx={{
          display: 'flex',
          flex: '1 1 auto',
          minHeight: 0, // Important for proper flex child sizing
          height: 'calc(100vh - 32px)', // Subtract title bar height
          overflow: 'hidden',
          // Remove transition - let it respond naturally to window changes
        }}
      >
        <Box
          className="app-sidebar"
          sx={{
            position: 'relative',
            zIndex: 1201,
            height: '100%',
            display: 'flex',
          }}
        >
          <SidebarCollapse />
        </Box>

        <MainView sidebarWidth={currentSidebarWidth}>
          <Box className="app-topbar">
            <TopBar />
          </Box>

          {/* Content Area */}
          <Box
            className="app-content app-layout-scrollbar"
            sx={{
              flex: '1 1 auto',
              overflow: 'auto',
              minHeight: 0, // Important: allows flex child to shrink
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              position: 'relative',
            }}
          >
            {children}
          </Box>
        </MainView>
      </Box>
    </Box>
  );
};

// Export individual components for direct use if needed
export { Sidebar } from './Sidebar';
export { SidebarCollapse } from './SidebarCollapse';
export { default as TopBar } from './TopBar';
export { default as MainView } from './MainView';
