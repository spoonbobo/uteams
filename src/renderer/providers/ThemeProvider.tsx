import React, { useEffect } from 'react';
import {
  ThemeProvider as MUIThemeProvider,
  createTheme,
  ThemeOptions,
} from '@mui/material/styles';
import { CssBaseline, GlobalStyles } from '@mui/material';
import { useAppStore, type ColorPalette } from '../stores/useAppStore';

// Using locale-aware fonts via App.tsx imports

// Color palette definitions
const colorPalettes = {
  blue: {
    main: '#2563eb',
    light: '#60a5fa',
    dark: '#1d4ed8',
  },
  green: {
    main: '#10b981',
    light: '#34d399',
    dark: '#059669',
  },
  purple: {
    main: '#7c3aed',
    light: '#a78bfa',
    dark: '#5b21b6',
  },
  orange: {
    main: '#f59e0b',
    light: '#fbbf24',
    dark: '#d97706',
  },
  red: {
    main: '#ef4444',
    light: '#f87171',
    dark: '#dc2626',
  },
  teal: {
    main: '#14b8a6',
    light: '#5eead4',
    dark: '#0f766e',
  },
  pink: {
    main: '#ec4899',
    light: '#f9a8d4',
    dark: '#be185d',
  },
  indigo: {
    main: '#6366f1',
    light: '#a5b4fc',
    dark: '#4338ca',
  },
};

const baseThemeConfig = {
  typography: {
    fontFamily: '"IBM Plex Sans", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 600 },
    h2: { fontWeight: 600 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none' as const,
          fontWeight: 500,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        },
      },
    },
  },
};
const buildLightTheme = (isZh: boolean, colorPalette: ColorPalette) =>
  createTheme({
    ...baseThemeConfig,
    typography: {
      ...baseThemeConfig.typography,
      fontFamily: isZh
        ? '"Noto Serif HK", "IBM Plex Sans", "Roboto", "Helvetica", "Arial", sans-serif'
        : baseThemeConfig.typography.fontFamily,
    },
    palette: {
      mode: 'light',
      primary: colorPalettes[colorPalette],
      secondary: {
        main: '#7c3aed',
        light: '#a78bfa',
        dark: '#5b21b6',
      },
      success: {
        main: '#10b981',
        light: '#34d399',
        dark: '#059669',
      },
      warning: {
        main: '#f59e0b',
        light: '#fbbf24',
        dark: '#d97706',
      },
      error: {
        main: '#ef4444',
        light: '#f87171',
        dark: '#dc2626',
      },
      background: {
        default: '#f8fafc',
        paper: '#ffffff',
      },
      text: {
        primary: '#0f172a',
        secondary: '#64748b',
      },
    },
    components: {
      ...baseThemeConfig.components,
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            background: '#f8fafc',
            scrollbarWidth: 'thin',
            '&::-webkit-scrollbar': {
              width: '8px',
              height: '8px',
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: '#cbd5e1',
              borderRadius: '4px',
              minHeight: '24px',
              '&:hover': {
                backgroundColor: '#94a3b8',
              },
            },
          },
        },
      },
    },
  });

const buildDarkTheme = (isZh: boolean, colorPalette: ColorPalette) =>
  createTheme({
    ...baseThemeConfig,
    typography: {
      ...baseThemeConfig.typography,
      fontFamily: isZh
        ? '"Noto Serif HK", "IBM Plex Sans", "Roboto", "Helvetica", "Arial", sans-serif'
        : baseThemeConfig.typography.fontFamily,
    },
    palette: {
      mode: 'dark',
      primary: colorPalettes[colorPalette],
      secondary: {
        main: '#8b5cf6',
        light: '#a78bfa',
        dark: '#7c3aed',
      },
      success: {
        main: '#10b981',
        light: '#34d399',
        dark: '#059669',
      },
      warning: {
        main: '#f59e0b',
        light: '#fbbf24',
        dark: '#d97706',
      },
      error: {
        main: '#ef4444',
        light: '#f87171',
        dark: '#dc2626',
      },
      background: {
        default: '#0f172a',
        paper: '#1e293b',
      },
      text: {
        primary: '#f8fafc',
        secondary: '#cbd5e1',
      },
      divider: '#334155',
    },
    components: {
      ...baseThemeConfig.components,
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            background: '#1a1a1a',
            scrollbarWidth: 'thin',
            '&::-webkit-scrollbar': {
              width: '8px',
              height: '8px',
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: '#475569',
              borderRadius: '4px',
              minHeight: '24px',
              '&:hover': {
                backgroundColor: '#64748b',
              },
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            backgroundImage: 'none',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
    },
  });

interface ThemeProviderProps {
  children: React.ReactNode;
}

// Custom scrollbar styles for the app
const globalStyles = (theme: any) => ({
  '.app-layout-scrollbar': {
    scrollbarWidth: 'thin',
    scrollbarColor:
      theme.palette.mode === 'dark'
        ? '#475569 transparent'
        : '#cbd5e1 transparent',
    '&::-webkit-scrollbar': {
      width: '8px',
      height: '8px',
    },
    '&::-webkit-scrollbar-track': {
      backgroundColor: 'transparent',
    },
    '&::-webkit-scrollbar-thumb': {
      backgroundColor: theme.palette.mode === 'dark' ? '#475569' : '#cbd5e1',
      borderRadius: '4px',
      '&:hover': {
        backgroundColor: theme.palette.mode === 'dark' ? '#64748b' : '#94a3b8',
      },
    },
  },
  // Electron window controls styling
  '.electron-drag': {
    WebkitAppRegion: 'drag',
  },
  '.electron-no-drag': {
    WebkitAppRegion: 'no-drag',
  },
  // Custom animations
  '@keyframes fadeIn': {
    from: { opacity: 0, transform: 'translateY(10px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
  },
  '@keyframes pulse': {
    '0%, 100%': { opacity: 1 },
    '50%': { opacity: 0.5 },
  },
  '.fade-in': {
    animation: 'fadeIn 0.3s ease-out',
  },
  'html:lang(zh), html:lang(zh-TW), html:lang(zh-HK), body:lang(zh), body:lang(zh-TW), body:lang(zh-HK)': {
    fontFamily: '"Noto Serif HK", "IBM Plex Sans", "Roboto", "Helvetica", "Arial", sans-serif',
  },
});

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { theme, locale, colorPalette, initializeFromSystem } = useAppStore();

  // Initialize theme from system preferences on mount
  useEffect(() => {
    initializeFromSystem();
  }, [initializeFromSystem]);

  const isZh = locale.startsWith('zh');
  const currentTheme = theme === 'dark' ? buildDarkTheme(isZh, colorPalette) : buildLightTheme(isZh, colorPalette);

  return (
    <MUIThemeProvider theme={currentTheme}>
      <CssBaseline />
      <GlobalStyles styles={globalStyles(currentTheme)} />
      {children}
    </MUIThemeProvider>
  );
};
