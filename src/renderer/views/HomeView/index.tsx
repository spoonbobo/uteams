import React from 'react';
import { 
  Box, 
  useTheme
} from '@mui/material';

import { useIntl } from 'react-intl';
import { useContextStore } from '../../stores/useContextStore';
import { useAuthenticationState } from '../../stores/useUserStore';
import { DashboardView } from './DashboardView';

export const HomeView: React.FC = () => {
  const intl = useIntl();
  const theme = useTheme();
  
  // Use the context store to get the current view
  const { homeContext } = useContextStore();
  const { view: currentView } = homeContext;
  
  // Use centralized authentication state
  const { isInitialized } = useAuthenticationState();

  // Render different content based on current view
  const renderContent = () => {
    // Always render DashboardView since features view is removed
    return <DashboardView />;
  };

  return (
    <Box 
      sx={{ 
        p: 4,
        maxWidth: 'xl',
        mx: 'auto',
        boxSizing: 'border-box'
      }}
    >
      {/* no login banner */}

      {/* Render content based on current view */}
      {renderContent()}
    </Box>
  );
};
