import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Api as ApiIcon,
} from '@mui/icons-material';
import { useIntl } from 'react-intl';
import { useMoodleStore } from '../stores/useMoodleStore';
import { useUserStore } from '../stores/useUserStore';
import { toast } from '../utils/toast';

interface AuthenticateProps {
  onAuthenticated?: () => void;
}

export const Authenticate: React.FC<AuthenticateProps> = ({ onAuthenticated }) => {
  const intl = useIntl();
  const theme = useTheme();

  // User store
  const setAuthenticated = useUserStore((state) => state.setAuthenticated);

  // Moodle store - use specific selectors to prevent unnecessary re-renders
  const config = useMoodleStore((state) => state.config);
  const isConnected = useMoodleStore((state) => state.isConnected);
  const isConnecting = useMoodleStore((state) => state.isConnecting);
  const connectionError = useMoodleStore((state) => state.connectionError);
  const connectionInfo = useMoodleStore((state) => state.connectionInfo);
  const saveApiKey = useMoodleStore((state) => state.saveApiKey);

  // Local state - always initialize with empty string to avoid undefined issues
  const [moodleApiKey, setMoodleApiKey] = useState(() => config?.apiKey || '');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // Memoize intl messages to prevent re-renders
  const labels = useMemo(() => ({
    apiKey: intl.formatMessage({ id: 'auth.moodle.apiKey' }),
    apiKeyPlaceholder: intl.formatMessage({ id: 'auth.moodle.apiKeyPlaceholder' }),
  }), [intl]);

  // Initialize API key from config only once
  useEffect(() => {
    if (!hasInitialized && config?.apiKey) {
      setMoodleApiKey(config.apiKey);
      setHasInitialized(true);
    }
  }, [config?.apiKey, hasInitialized]);

  // Check if already authenticated and notify parent
  useEffect(() => {
    if (isConnected && connectionInfo && onAuthenticated) {
      onAuthenticated();
    }
  }, [isConnected, connectionInfo, onAuthenticated]);

  const handleMoodleAuth = async () => {
    if (!moodleApiKey.trim()) {
      toast.error(intl.formatMessage({ id: 'auth.moodle.apiKeyRequired' }));
      return;
    }

    setIsAuthenticating(true);
    try {
      const success = await saveApiKey(moodleApiKey);
      
      if (success) {
        // Wait for connection info to be available (with timeout)
        let attempts = 0;
        const maxAttempts = 20; // 2 seconds max wait
        
        while (attempts < maxAttempts) {
          const currentConnectionInfo = useMoodleStore.getState().connectionInfo;
          if (currentConnectionInfo) {
            console.log('[Authenticate] Connection info available, setting user as authenticated');
            setAuthenticated({
              id: currentConnectionInfo.userid?.toString() || 'unknown',
              username: currentConnectionInfo.username || 'unknown',
              firstname: currentConnectionInfo.firstname,
              lastname: currentConnectionInfo.lastname,
              fullname: currentConnectionInfo.fullname || currentConnectionInfo.username || 'User',
              email: currentConnectionInfo.email || '',
              sitename: currentConnectionInfo.sitename,
              siteurl: currentConnectionInfo.siteurl,
            }, 'moodle');
            break;
          }
          
          // Wait 100ms before checking again
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        if (attempts >= maxAttempts) {
          console.error('[Authenticate] Timeout waiting for connection info');
          toast.error('Connection successful but user info not available. Please try again.');
        } else {
          toast.success(intl.formatMessage({ id: 'auth.moodle.success' }));
          if (onAuthenticated) {
            onAuthenticated();
          }
        }
      } else if (connectionError) {
        toast.error(intl.formatMessage({ id: 'auth.moodle.failed' }, { error: connectionError }));
      }
    } finally {
      setIsAuthenticating(false);
    }
  };


  const renderMoodleAuth = () => (
    <Box sx={{ mt: 3 }}>
      {/* Connection Status */}
      {isConnected && connectionInfo ? (
        <Alert severity="success" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            {intl.formatMessage({ id: 'auth.moodle.connected' })}
          </Typography>
          <Typography variant="caption" display="block">
            {intl.formatMessage({ id: 'auth.moodle.site' })}: {connectionInfo.sitename}
          </Typography>
          <Typography variant="caption" display="block">
            {intl.formatMessage({ id: 'auth.moodle.user' })}: {connectionInfo.fullname} ({connectionInfo.username})
          </Typography>
        </Alert>
      ) : connectionError ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {intl.formatMessage({ id: 'auth.moodle.error' }, { error: connectionError })}
        </Alert>
      ) : null}

      {/* API Key Input */}
      <TextField
        fullWidth
        variant="outlined"
        label={labels.apiKey}
        type="password"
        value={moodleApiKey || ''}
        onChange={(e) => setMoodleApiKey(e.target.value)}
        placeholder={labels.apiKeyPlaceholder}
        disabled={isConnecting || isAuthenticating}
        sx={{ mb: 2 }}
      />

      {/* Base URL Display */}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        {intl.formatMessage({ id: 'auth.moodle.baseUrl' })}: {config.baseUrl}
      </Typography>

      {/* Action Button */}
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Button
          variant="contained"
          startIcon={<ApiIcon />}
          onClick={handleMoodleAuth}
          disabled={isConnecting || isAuthenticating || !moodleApiKey.trim()}
          sx={{ minWidth: 200 }}
        >
          {isAuthenticating || isConnecting 
            ? intl.formatMessage({ id: 'auth.moodle.connecting' })
            : intl.formatMessage({ id: 'auth.moodle.connect' })
          }
        </Button>
      </Box>

      {/* Help Text */}
      <Box sx={{ mt: 3, p: 2, backgroundColor: alpha(theme.palette.info.main, 0.05), borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {intl.formatMessage({ id: 'auth.moodle.helpText' })}
        </Typography>
      </Box>
    </Box>
  );


  return (
    <Card
      sx={{
        maxWidth: 500,
        mx: 'auto',
        mt: 4,
        boxShadow: theme.shadows[8],
      }}
    >
      <CardContent sx={{ p: 4 }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h5" gutterBottom color="primary">
            {intl.formatMessage({ id: 'auth.title' })}
          </Typography>
        </Box>

        {/* Authentication Form */}
        {renderMoodleAuth()}
      </CardContent>
    </Card>
  );
};
