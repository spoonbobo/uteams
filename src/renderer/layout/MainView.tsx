import React from 'react';
import { Box, useTheme } from '@mui/material';
import { useAppStore } from '@/stores/useAppStore';

interface MainViewProps {
  children: React.ReactNode;
  sidebarWidth: number;
}

export default function MainView({
  children,
  sidebarWidth,
}: MainViewProps) {
  const theme = useTheme();
  const { preferences } = useAppStore();

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
        backgroundColor: preferences.transparentMode
          ? 'transparent'
          : theme.palette.background.default,
      }}
    >
      {children}
    </Box>
  );
}
