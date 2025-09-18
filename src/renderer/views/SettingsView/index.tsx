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
  Slider,
  Card,
  CardContent,
} from '@mui/material';
import {
  Palette as PaletteIcon,
  Language as LanguageIcon,
  Notifications as NotificationsIcon,
  Info as InfoIcon,
  Wallpaper as WallpaperIcon,
  Api as ApiIcon,
  PhotoLibrary as PhotoLibraryIcon,
  ViewCarousel as CarouselIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Speed as SpeedIcon,
  DeveloperMode as DeveloperModeIcon,
} from '@mui/icons-material';
import { useIntl } from 'react-intl';

import { useAppStore } from '@/stores/useAppStore';
import type { ColorPalette } from '@/types/color';
import { useContextStore } from '@/stores/useContextStore';
import { useMoodleStore } from '@/stores/useMoodleStore';
import { useTheme } from '@mui/material/styles';
import { toast } from '@/utils/toast';
import { languageNames } from '../../messages';
import { Disclaimer, useDisclaimer } from '@/components/Disclaimer';
import { getImageUrl } from '@/utils/background';



export const SettingsView: React.FC = () => {
  const intl = useIntl();
  const muiTheme = useTheme();
  const { theme, setTheme, locale, setLocale, colorPalette, setColorPalette, background, setBackground, preferences, updatePreferences } =
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

  // Local state for background settings
  const [isSelectingImage, setIsSelectingImage] = React.useState(false);
  const [selectedImages, setSelectedImages] = React.useState<string[]>(background.images || []);

  // Update selected images when background changes
  React.useEffect(() => {
    setSelectedImages(background.images || []);
  }, [background.images]);


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

  const handleBackgroundTypeChange = (event: any) => {
    const newType = event.target.value as 'none' | 'color' | 'image';
    let newValue = '';

    if (newType === 'color') {
      // Set default color to transparent/none
      newValue = 'transparent';
    } else if (newType === 'image') {
      // Keep the existing value if it's an image path, otherwise clear it
      newValue = background.value && !background.value.startsWith('#') ? background.value : '';
    }

    setBackground({ type: newType, value: newValue });
    toast.success(
      intl.formatMessage({ id: 'settings.backgroundTypeChanged' }, { type: intl.formatMessage({ id: `settings.background${newType.charAt(0).toUpperCase() + newType.slice(1)}` }) })
    );
  };

  const handleStaticColorSelect = (color: string) => {
    setBackground({ type: color === 'transparent' ? 'none' : 'color', value: color });
    toast.success(
      intl.formatMessage({ id: 'settings.backgroundColorChanged' })
    );
  };


  const handleBackgroundOpacityChange = (_event: any, newValue: number | number[]) => {
    setBackground({ opacity: Array.isArray(newValue) ? newValue[0] : newValue });
  };

  const handleBackgroundBlurChange = (_event: any, newValue: number | number[]) => {
    setBackground({ blur: Array.isArray(newValue) ? newValue[0] : newValue });
  };

  const handleSelectImage = async (addToSlideshow = false) => {
    setIsSelectingImage(true);
    try {
      // Open file dialog
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = addToSlideshow; // Allow multiple selection for slideshow
      input.onchange = async (e) => {
        const files = Array.from((e.target as HTMLInputElement).files || []);

        if (files.length === 0) {
          setIsSelectingImage(false);
          return;
        }

        // Limit to 3 images for slideshow
        const maxFiles = addToSlideshow ? Math.min(files.length, 3 - selectedImages.length) : 1;
        const filesToProcess = files.slice(0, maxFiles);

        const savedPaths: string[] = [];

        for (const file of filesToProcess) {
          // Convert file to array buffer for IPC
          const arrayBuffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          const filename = `background-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${file.name.split('.').pop()}`;

          // Save file using fileio handler
          const result = await window.electron.ipcRenderer.invoke('fileio:save-temp-file', {
            filename,
            data: Array.from(uint8Array)
          });

          if (result.success) {
            savedPaths.push(result.filePath);
          } else {
            toast.error(`Failed to save image: ${result.error}`);
          }
        }

        if (savedPaths.length > 0) {
          if (addToSlideshow) {
            const newImages = [...selectedImages, ...savedPaths].slice(0, 3);
            setSelectedImages(newImages);
            setBackground({
              type: 'image',
              images: newImages,
              value: newImages[0] || '',
              scrollEnabled: newImages.length > 1
            });
            toast.success(`Added ${savedPaths.length} image(s) to carousel`);
          } else {
            setBackground({
              type: 'image',
              value: savedPaths[0],
              images: [savedPaths[0]],
              scrollEnabled: false
            });
            setSelectedImages([savedPaths[0]]);
            toast.success('Background image selected successfully');
          }
        }
      };
      input.click();
    } catch (error: any) {
      toast.error(`Error selecting image: ${error.message}`);
    } finally {
      setIsSelectingImage(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    const newImages = selectedImages.filter((_, i) => i !== index);
    setSelectedImages(newImages);
    setBackground({
      images: newImages,
      value: newImages[0] || '',
      scrollEnabled: newImages.length > 1 && background.scrollEnabled
    });
    toast.success('Image removed from carousel');
  };

  const handleScrollToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = event.target.checked;
    setBackground({
      scrollEnabled: enabled,
      // Ensure value is set to first image when disabling scroll
      value: enabled ? (background.value || selectedImages[0] || '') : (selectedImages[0] || background.value || '')
    });
    toast.success(enabled ? 'Scrolling enabled' : 'Scrolling disabled');
  };

  const handleScrollSpeedChange = (_event: any, newValue: number | number[]) => {
    const speed = Array.isArray(newValue) ? newValue[0] : newValue;
    setBackground({ scrollSpeed: speed });
  };

  const handleScrollDirectionChange = (event: any) => {
    setBackground({ scrollDirection: event.target.value as 'left' | 'right' });
  };

  const handleRemoveBackground = () => {
    setBackground({ type: 'none', value: '' });
    toast.success('Background removed');
  };


  const renderGeneral = () => (
    <Paper
      sx={{
        mb: 3,
        backgroundColor: 'background.paper',
      }}
    >
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" component="h2">
          {intl.formatMessage({ id: 'settings.appearance' })}
        </Typography>
      </Box>
      <List>
        <ListItem
          secondaryAction={
            <Switch
              checked={theme === 'dark'}
              onChange={handleThemeChange}
              color="primary"
            />
          }
        >
          <ListItemIcon>
            <PaletteIcon />
          </ListItemIcon>
          <ListItemText
            primary={intl.formatMessage({ id: 'settings.darkMode' })}
            secondary={intl.formatMessage({ id: 'settings.darkModeDesc' })}
          />
        </ListItem>
        <Divider />
        <ListItem
          secondaryAction={
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select value={locale} onChange={handleLocaleChange} displayEmpty>
                <MenuItem value="en">{languageNames.en}</MenuItem>
                <MenuItem value="zh-TW">{languageNames['zh-TW']}</MenuItem>
              </Select>
            </FormControl>
          }
        >
          <ListItemIcon>
            <LanguageIcon />
          </ListItemIcon>
          <ListItemText
            primary={intl.formatMessage({ id: 'settings.language' })}
            secondary={intl.formatMessage({ id: 'settings.languageDesc' })}
          />
        </ListItem>
        <Divider />
        <ListItem
          secondaryAction={
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
          }
        >
          <ListItemIcon>
            <PaletteIcon />
          </ListItemIcon>
          <ListItemText
            primary={intl.formatMessage({ id: 'settings.colorPalette' })}
            secondary={intl.formatMessage({ id: 'settings.colorPaletteDesc' })}
          />
        </ListItem>
        <Divider />
        <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, width: '100%' }}>
            <ListItemIcon>
              <WallpaperIcon />
            </ListItemIcon>
            <ListItemText
              primary={intl.formatMessage({ id: 'settings.appBackground' })}
              secondary={intl.formatMessage({ id: 'settings.appBackgroundDesc' })}
            />
          </Box>
          <Box sx={{ width: '100%', pl: 7 }}>
            {/* Background Type Selection */}
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>{intl.formatMessage({ id: 'settings.backgroundType' })}</InputLabel>
              <Select
                value={background.type === 'none' || background.type === 'color' ? 'color' : 'image'}
                onChange={handleBackgroundTypeChange}
                label={intl.formatMessage({ id: 'settings.backgroundType' })}
              >
                <MenuItem value="color">{intl.formatMessage({ id: 'settings.backgroundStaticColor' })}</MenuItem>
                <MenuItem value="image">{intl.formatMessage({ id: 'settings.backgroundImage' })}</MenuItem>
              </Select>
            </FormControl>

            {/* Static Color Selection */}
            {(background.type === 'none' || background.type === 'color') && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  {intl.formatMessage({ id: 'settings.selectColor' })}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {/* Transparent/None option */}
                  <Box
                    onClick={() => handleStaticColorSelect('transparent')}
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 1,
                      border: 2,
                      borderColor: background.value === 'transparent' || background.type === 'none' ? 'primary.main' : 'divider',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'background.paper',
                      position: 'relative',
                      overflow: 'hidden',
                      '&:hover': {
                        borderColor: 'primary.main',
                        opacity: 0.8,
                      },
                    }}
                  >
                    <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary' }}>
                      None
                    </Typography>
                  </Box>

                  {/* Color options */}
                  {[
                    '#000000', // Black
                    '#1a1a1a', // Dark gray
                    '#2d2d2d', // Medium dark gray
                    '#404040', // Gray
                    '#0d47a1', // Dark blue
                    '#1a237e', // Indigo
                    '#4a148c', // Deep purple
                    '#880e4f', // Dark pink
                    '#b71c1c', // Dark red
                    '#e65100', // Dark orange
                    '#f57f17', // Dark yellow
                    '#33691e', // Dark green
                    '#004d40', // Teal
                    '#263238', // Blue gray
                    '#3e2723', // Brown
                  ].map((color) => (
                    <Box
                      key={color}
                      onClick={() => handleStaticColorSelect(color)}
                      sx={{
                        width: 40,
                        height: 40,
                        backgroundColor: color,
                        borderRadius: 1,
                        border: 2,
                        borderColor: background.value === color ? 'primary.main' : 'transparent',
                        cursor: 'pointer',
                        '&:hover': {
                          borderColor: 'primary.main',
                          opacity: 0.8,
                        },
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}


            {/* Image Selection */}
            {background.type === 'image' && (
              <Box sx={{ mb: 2 }}>
                {/* Single Image or Slideshow Mode Selection */}
                <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Button
                    variant="outlined"
                    onClick={() => handleSelectImage(false)}
                    disabled={isSelectingImage}
                    startIcon={<PhotoLibraryIcon />}
                  >
                    {isSelectingImage ? 'Selecting...' : intl.formatMessage({ id: 'settings.selectImage' })}
                  </Button>
                  {selectedImages.length < 3 && (
                    <Button
                      variant="outlined"
                      onClick={() => handleSelectImage(true)}
                      disabled={isSelectingImage || selectedImages.length >= 3}
                      startIcon={<AddIcon />}
                      size="small"
                    >
                      Add to Carousel
                    </Button>
                  )}
                  {background.value && (
                    <Button
                      variant="text"
                      color="error"
                      onClick={handleRemoveBackground}
                      size="small"
                    >
                      {intl.formatMessage({ id: 'settings.removeBackground' })}
                    </Button>
                  )}
                </Box>

                {/* Selected Images List */}
                {selectedImages.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" gutterBottom>
                      Selected Images ({selectedImages.length}/3)
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {selectedImages.map((imagePath, index) => (
                        <Box
                          key={index}
                          sx={{
                            position: 'relative',
                            width: 100,
                            height: 60,
                            borderRadius: 1,
                            overflow: 'hidden',
                            border: 1,
                            borderColor: 'divider',
                          }}
                        >
                          <Box
                            sx={{
                              width: '100%',
                              height: '100%',
                              backgroundImage: `url("${getImageUrl(imagePath)}")`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                            }}
                          />
                          <Box
                            sx={{
                              position: 'absolute',
                              top: 2,
                              right: 2,
                              backgroundColor: 'rgba(0,0,0,0.5)',
                              borderRadius: '50%',
                              width: 24,
                              height: 24,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              '&:hover': {
                                backgroundColor: 'rgba(0,0,0,0.7)',
                              },
                            }}
                            onClick={() => handleRemoveImage(index)}
                          >
                            <DeleteIcon sx={{ fontSize: 16, color: 'white' }} />
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Scrolling Carousel Settings */}
                {selectedImages.length > 1 && (
                  <Box
                    sx={{
                      mb: 2,
                      p: 2,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      backgroundColor: 'background.default',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <CarouselIcon sx={{ mr: 1 }} />
                      <Typography variant="subtitle2" sx={{ flex: 1 }}>
                        Scrolling Carousel
                      </Typography>
                      <Switch
                        checked={background.scrollEnabled || false}
                        onChange={handleScrollToggle}
                        color="primary"
                      />
                    </Box>

                    {background.scrollEnabled && (
                      <>
                        <Box sx={{ mb: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <SpeedIcon sx={{ mr: 1, fontSize: 20 }} />
                            <Typography variant="body2">
                              Scroll Speed: {background.scrollSpeed || 30} px/s
                            </Typography>
                          </Box>
                          <Slider
                            value={background.scrollSpeed || 30}
                            onChange={handleScrollSpeedChange}
                            min={10}
                            max={100}
                            step={5}
                            marks={[
                              { value: 10, label: 'Slow' },
                              { value: 30, label: 'Normal' },
                              { value: 60, label: 'Fast' },
                              { value: 100, label: 'Very Fast' }
                            ]}
                            valueLabelDisplay="auto"
                            valueLabelFormat={(value) => `${value} px/s`}
                          />
                        </Box>

                        <Box sx={{ mb: 1 }}>
                          <FormControl size="small" fullWidth>
                            <InputLabel>Scroll Direction</InputLabel>
                            <Select
                              value={background.scrollDirection || 'left'}
                              onChange={handleScrollDirectionChange}
                              label="Scroll Direction"
                            >
                              <MenuItem value="left">← Left</MenuItem>
                              <MenuItem value="right">→ Right</MenuItem>
                            </Select>
                          </FormControl>
                        </Box>
                      </>
                    )}
                  </Box>
                )}
              </Box>
            )}

            {/* Opacity Slider - Only for image backgrounds */}
            {background.type === 'image' && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  {intl.formatMessage({ id: 'settings.backgroundOpacity' })}: {background.opacity}%
                </Typography>
                <Slider
                  value={background.opacity}
                  onChange={handleBackgroundOpacityChange}
                  min={5}
                  max={95}
                  step={5}
                  marks
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${value}%`}
                />
              </Box>
            )}

            {/* Blur Slider */}
            {background.type === 'image' && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  {intl.formatMessage({ id: 'settings.backgroundBlur' })}: {background.blur}px
                </Typography>
                <Slider
                  value={background.blur}
                  onChange={handleBackgroundBlurChange}
                  min={0}
                  max={10}
                  step={1}
                  marks
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${value}px`}
                />
              </Box>
            )}

          </Box>
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
        <ListItem
          secondaryAction={
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
          }
        >
          <ListItemIcon>
            <NotificationsIcon />
          </ListItemIcon>
          <ListItemText
            primary={intl.formatMessage({ id: 'settings.systemNotifications' })}
            secondary={intl.formatMessage({
              id: 'settings.systemNotificationsDesc',
            })}
          />
        </ListItem>
        {/* Developer Mode - Only show in development */}
        {process.env.NODE_ENV === 'development' && (
          <>
            <Divider />
            <ListItem
              secondaryAction={
                <Switch
                  checked={preferences.developerMode}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    updatePreferences({ developerMode: enabled });
                    toast.success(
                      intl.formatMessage(
                        { id: enabled ? 'settings.developerModeEnabled' : 'settings.developerModeDisabled' }
                      )
                    );
                  }}
                  color="primary"
                />
              }
            >
              <ListItemIcon>
                <DeveloperModeIcon />
              </ListItemIcon>
              <ListItemText
                primary={intl.formatMessage({ id: 'settings.developerMode' })}
                secondary={intl.formatMessage({
                  id: 'settings.developerModeDesc',
                })}
              />
            </ListItem>
          </>
        )}
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
    <Paper
      sx={{
        mb: 3,
        backgroundColor: 'background.paper',
      }}
    >
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
        boxSizing: 'border-box',
        backgroundColor: 'inherit',
      }}
    >
      {renderContent()}
    </Box>
  );
};
