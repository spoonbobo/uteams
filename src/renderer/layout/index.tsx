import React from 'react';
import { Box } from '@mui/material';
import { SidebarCollapse, SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from './SidebarCollapse';
import { TopBar } from './TopBar';
import MainView from './MainView';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useAppStore } from '@/stores/useAppStore';
import TitleBar from '@/components/TitleBar';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { sidebarCollapsed } = useLayoutStore();
  const { preferences } = useAppStore();
  const currentSidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

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
        right: 0,
        bottom: 0,
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
            <TopBar sidebarWidth={currentSidebarWidth} />
          </Box>

          {/* Content Area */}
          <Box
            className="app-content app-layout-scrollbar"
            sx={{
              flex: '1 1 auto',
              overflow: 'auto', // Handle scrolling at the layout level
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
export { TopBar } from './TopBar';
export { default as MainView } from './MainView';
