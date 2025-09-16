import * as React from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  Divider,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  RadioGroup,
  Radio,
  FormControlLabel,
  Link,
  TextField,
} from '@mui/material';
import {
  Palette as PaletteIcon,
  Language as LanguageIcon,
  Notifications as NotificationsIcon,
  Info as InfoIcon,
  Wallpaper as WallpaperIcon,
  Api as ApiIcon,
} from '@mui/icons-material';
import { useIntl } from 'react-intl';

import { useAppStore, type ColorPalette } from '@/stores/useAppStore';
import { useContextStore } from '@/stores/useContextStore';
import { useMoodleStore } from '@/stores/useMoodleStore';
import { useTheme } from '@mui/material/styles';
import { toast } from '@/utils/toast';
import { languageNames } from '../../messages';
import { Disclaimer, useDisclaimer } from '@/components/Disclaimer';



export const SettingsView: React.FC = () => {
  const intl = useIntl();
  const muiTheme = useTheme();
  const { theme, setTheme, locale, setLocale, colorPalette, setColorPalette, preferences, updatePreferences } =
    useAppStore();
  const { settingsContext } = useContextStore();
  const {
    open: disclaimerOpen,
    showDisclaimer,
    hideDisclaimer,
  } = useDisclaimer();
  
  // Moodle store
  const {
    config,
    isConnected,
    isConnecting,
    connectionError,
    connectionInfo,
    saveApiKey,
    testConnection,
    clearConfig,
  } = useMoodleStore();
  
  // Local state for API key input
  const [moodleApiKey, setMoodleApiKey] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [isTesting, setIsTesting] = React.useState(false);
  
  // Initialize API key from store
  React.useEffect(() => {
    if (config.apiKey) {
      setMoodleApiKey(config.apiKey);
    }
  }, [config.apiKey]);

  const handleThemeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newTheme = event.target.checked ? 'dark' : 'light';
    setTheme(newTheme);
    toast.success(
      intl.formatMessage({ id: 'settings.themeChanged' }, { mode: newTheme }),
    );
  };

  const handleLocaleChange = (event: any) => {
    const newLocale = event.target.value as 'en' | 'zh-TW';
    setLocale(newLocale);
    toast.success(
      intl.formatMessage(
        { id: 'settings.languageChanged' },
        { language: languageNames[newLocale] },
      ),
    );
  };

  const handleColorPaletteChange = (event: any) => {
    const newPalette = event.target.value as ColorPalette;
    setColorPalette(newPalette);
    toast.success(
      intl.formatMessage(
        { id: 'settings.colorPaletteChanged' },
        { palette: intl.formatMessage({ id: `settings.colorSchemes.${newPalette}` }) },
      ),
    );
  };


  const renderGeneral = () => (
    <Paper sx={{ mb: 3 }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" component="h2">
          {intl.formatMessage({ id: 'settings.appearance' })}
        </Typography>
      </Box>
      <List>
        <ListItem>
          <ListItemIcon>
            <PaletteIcon />
          </ListItemIcon>
          <ListItemText
            primary={intl.formatMessage({ id: 'settings.darkMode' })}
            secondary={intl.formatMessage({ id: 'settings.darkModeDesc' })}
          />
          <ListItemSecondaryAction>
            <Switch
              checked={theme === 'dark'}
              onChange={handleThemeChange}
              color="primary"
            />
          </ListItemSecondaryAction>
        </ListItem>
        <Divider />
        <ListItem>
          <ListItemIcon>
            <LanguageIcon />
          </ListItemIcon>
          <ListItemText
            primary={intl.formatMessage({ id: 'settings.language' })}
            secondary={intl.formatMessage({ id: 'settings.languageDesc' })}
          />
          <ListItemSecondaryAction>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select value={locale} onChange={handleLocaleChange} displayEmpty>
                <MenuItem value="en">{languageNames.en}</MenuItem>
                <MenuItem value="zh-TW">{languageNames['zh-TW']}</MenuItem>
              </Select>
            </FormControl>
          </ListItemSecondaryAction>
        </ListItem>
        <Divider />
        <ListItem>
          <ListItemIcon>
            <PaletteIcon />
          </ListItemIcon>
          <ListItemText
            primary={intl.formatMessage({ id: 'settings.colorPalette' })}
            secondary={intl.formatMessage({ id: 'settings.colorPaletteDesc' })}
          />
          <ListItemSecondaryAction>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select value={colorPalette} onChange={handleColorPaletteChange} displayEmpty>
                <MenuItem value="blue">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 16, height: 16, backgroundColor: '#2563eb', borderRadius: '50%' }} />
                    {intl.formatMessage({ id: 'settings.colorSchemes.blue' })}
                  </Box>
                </MenuItem>
                <MenuItem value="green">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 16, height: 16, backgroundColor: '#10b981', borderRadius: '50%' }} />
                    {intl.formatMessage({ id: 'settings.colorSchemes.green' })}
                  </Box>
                </MenuItem>
                <MenuItem value="purple">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 16, height: 16, backgroundColor: '#7c3aed', borderRadius: '50%' }} />
                    {intl.formatMessage({ id: 'settings.colorSchemes.purple' })}
                  </Box>
                </MenuItem>
                <MenuItem value="orange">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 16, height: 16, backgroundColor: '#f59e0b', borderRadius: '50%' }} />
                    {intl.formatMessage({ id: 'settings.colorSchemes.orange' })}
                  </Box>
                </MenuItem>
                <MenuItem value="red">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 16, height: 16, backgroundColor: '#ef4444', borderRadius: '50%' }} />
                    {intl.formatMessage({ id: 'settings.colorSchemes.red' })}
                  </Box>
                </MenuItem>
                <MenuItem value="teal">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 16, height: 16, backgroundColor: '#14b8a6', borderRadius: '50%' }} />
                    {intl.formatMessage({ id: 'settings.colorSchemes.teal' })}
                  </Box>
                </MenuItem>
                <MenuItem value="pink">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 16, height: 16, backgroundColor: '#ec4899', borderRadius: '50%' }} />
                    {intl.formatMessage({ id: 'settings.colorSchemes.pink' })}
                  </Box>
                </MenuItem>
                <MenuItem value="indigo">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 16, height: 16, backgroundColor: '#6366f1', borderRadius: '50%' }} />
                    {intl.formatMessage({ id: 'settings.colorSchemes.indigo' })}
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
          </ListItemSecondaryAction>
        </ListItem>
      </List>

      {/* Others Section */}
      <Divider />
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle2" gutterBottom>
          {intl.formatMessage({ id: 'settings.others' })}
        </Typography>
      </Box>
      <List>
        <ListItem>
          <ListItemIcon>
            <NotificationsIcon />
          </ListItemIcon>
          <ListItemText
            primary={intl.formatMessage({ id: 'settings.systemNotifications' })}
            secondary={intl.formatMessage({
              id: 'settings.systemNotificationsDesc',
            })}
          />
          <ListItemSecondaryAction>
            <Switch 
              checked={preferences.notificationsEnabled} 
              onChange={(e) => {
                const enabled = e.target.checked;
                updatePreferences({ notificationsEnabled: enabled });
                toast.success(
                  intl.formatMessage(
                    { id: enabled ? 'settings.notificationsEnabled' : 'settings.notificationsDisabled' }
                  )
                );
              }}
              color="primary" 
            />
          </ListItemSecondaryAction>
        </ListItem>
      </List>

      {/* Legal */}
      <Divider />
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button variant="text" onClick={showDisclaimer} sx={{ textDecoration: 'underline' }}>
          {intl.formatMessage({ id: 'common.disclaimer' })}
        </Button>
      </Box>

      {/* Ported dialogs */}
      <Disclaimer open={disclaimerOpen} onClose={hideDisclaimer} />
    </Paper>
  );

  // No user/account in this app

  const handleSaveApiKey = async () => {
    if (!moodleApiKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }
    
    setIsSaving(true);
    try {
      const success = await saveApiKey(moodleApiKey);
      if (!success && connectionError) {
        toast.error(`Connection failed: ${connectionError}`);
      }
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleTestConnection = async () => {
    if (!moodleApiKey.trim()) {
      toast.error('Please enter an API key first');
      return;
    }
    
    setIsTesting(true);
    try {
      // First save the key if it's different
      if (moodleApiKey !== config.apiKey) {
        await saveApiKey(moodleApiKey);
      } else {
        // Just test the existing connection
        const success = await testConnection();
        if (success) {
          toast.success('Connection successful!');
        } else {
          toast.error(`Connection failed: ${connectionError || 'Unknown error'}`);
        }
      }
    } finally {
      setIsTesting(false);
    }
  };
  
  const handleClearConfig = () => {
    clearConfig();
    setMoodleApiKey('');
    toast.info('Moodle configuration cleared');
  };

  const renderApi = () => (
    <Paper sx={{ mb: 3 }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" component="h2">
          {intl.formatMessage({ id: 'settings.api' })}
        </Typography>
      </Box>
      
      {/* Connection Status */}
      {(isConnected || connectionError) && (
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          {isConnected ? (
            <Alert severity="success" sx={{ mb: 1 }}>
              Connected
            </Alert>
          ) : connectionError ? (
            <Alert severity="error">
              Connection Error: {connectionError}
            </Alert>
          ) : null}
        </Box>
      )}
      
      <List>
        <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, width: '100%' }}>
            <ListItemIcon>
              <ApiIcon />
            </ListItemIcon>
            <ListItemText
              primary={intl.formatMessage({ id: 'settings.moodleApiKey' })}
              secondary={intl.formatMessage({ id: 'settings.moodleApiKeyDesc' })}
            />
          </Box>
          <Box sx={{ width: '100%', pl: 7 }}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              type="password"
              value={moodleApiKey}
              onChange={(e) => setMoodleApiKey(e.target.value)}
              placeholder={intl.formatMessage({ id: 'settings.enterMoodleApiKey' })}
              disabled={isConnecting || isSaving || isTesting}
              sx={{ mb: 1 }}
              InputProps={{
                endAdornment: isConnected && (
                  <Typography variant="caption" color="success.main" sx={{ mr: 1 }}>
                    ✓
                  </Typography>
                ),
              }}
            />
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button 
                variant="contained" 
                size="small"
                onClick={handleSaveApiKey}
                disabled={isConnecting || isSaving || isTesting || !moodleApiKey.trim()}
              >
                {isSaving ? 'Saving...' : intl.formatMessage({ id: 'common.save' })}
              </Button>
              <Button 
                variant="outlined" 
                size="small"
                onClick={handleTestConnection}
                disabled={isConnecting || isSaving || isTesting || !moodleApiKey.trim()}
              >
                {isTesting || isConnecting ? 'Testing...' : intl.formatMessage({ id: 'settings.testConnection' })}
              </Button>
              {config.apiKey && (
                <Button 
                  variant="text" 
                  size="small"
                  color="error"
                  onClick={handleClearConfig}
                  disabled={isConnecting || isSaving || isTesting}
                >
                  Clear
                </Button>
              )}
            </Box>
            
            {/* Base URL Display */}
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Moodle URL: {config.baseUrl}
              </Typography>
            </Box>
          </Box>
        </ListItem>
      </List>
    </Paper>
  );


  const renderContent = () => {
    switch (settingsContext.section) {
      case 'general':
        return renderGeneral();
      case 'api':
        return renderApi();
      default:
        return renderGeneral();
    }
  };

  return (
    <Box 
      sx={{ 
        p: 4, 
        maxWidth: 'md', 
        mx: 'auto',
        boxSizing: 'border-box'
      }}
    >
      {renderContent()}
    </Box>
  );
};
