import React from 'react';
import { Box } from '@mui/material';

interface MainViewProps {
  children: React.ReactNode;
  sidebarWidth: number;
}

export const MainView: React.FC<MainViewProps> = ({
  children,
  sidebarWidth,
}) => {
  return (
    <Box
      component="main"
      sx={{
        flexGrow: 1,
        width: `calc(100vw - ${sidebarWidth}px)`,
        height: '100%', // Changed from 100vh to 100%
        maxWidth: `calc(100vw - ${sidebarWidth}px)`,
        marginLeft: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative', // Establish containing block
        boxSizing: 'border-box',
      }}
    >
      {children}
    </Box>
  );
};
