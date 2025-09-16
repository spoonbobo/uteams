import React from 'react';
import { Box } from '@mui/material';
import { SidebarCollapse, SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from './SidebarCollapse';
import { TopBar } from './TopBar';
import { MainView } from './MainView';
import { useLayoutStore } from '@/stores/useLayoutStore';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { sidebarCollapsed } = useLayoutStore();
  const currentSidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  return (
    <Box
      className="app-main-layout"
      sx={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        minHeight: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
        position: 'fixed', // Prevent any viewport issues
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      <Box className="app-sidebar" sx={{ position: 'relative', zIndex: 1201 }}>
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
            flex: 1,
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
  );
};

// Export individual components for direct use if needed
export { Sidebar } from './Sidebar';
export { SidebarCollapse } from './SidebarCollapse';
export { TopBar } from './TopBar';
export { MainView } from './MainView';
