import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { ColorPalette } from '../types/color';

interface AppState {
  // UI state
  theme: 'light' | 'dark';
  locale: 'en' | 'zh-TW';
  colorPalette: ColorPalette;

  // Background settings
  background: {
    type: 'none' | 'color' | 'image';
    value: string; // color hex or single image path
    images?: string[]; // array of image paths for scrolling (max 3)
    scrollEnabled?: boolean; // enable scrolling mode
    scrollSpeed?: number; // speed in pixels per second (10-100)
    scrollDirection?: 'left' | 'right'; // scroll direction
    opacity: number; // 0-100 for transparency
    blur: number; // 0-10 for blur effect
  };

  // User preferences (persisted)
  preferences: {
    notificationsEnabled: boolean;
    developerMode: boolean;
  };

  // Loading states (not persisted)
  isLoading: boolean;

  // Actions
  setTheme: (theme: 'light' | 'dark') => void;
  setLocale: (locale: 'en' | 'zh-TW') => void;
  setColorPalette: (palette: ColorPalette) => void;
  setBackground: (background: Partial<AppState['background']>) => void;
  setLoading: (loading: boolean) => void;
  updatePreferences: (preferences: Partial<AppState['preferences']>) => void;
  initializeFromSystem: () => void;
}

// Helper function to detect system theme
const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return 'light';
};

// Helper function to detect system locale
const getSystemLocale = (): 'en' | 'zh-TW' => {
  if (typeof window !== 'undefined' && navigator.language) {
    const lang = navigator.language.toLowerCase();
    if (lang.startsWith('zh')) {
      return 'zh-TW';
    }
  }
  return 'en';
};

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        theme: getSystemTheme(),
        locale: getSystemLocale(),
        colorPalette: 'blue',
        background: {
          type: 'color',
          value: '#1a1a1a',
          images: [],
          scrollEnabled: false,
          scrollSpeed: 30, // default 30 pixels per second
          scrollDirection: 'left',
          opacity: 20,
          blur: 2,
        },
        preferences: {
          notificationsEnabled: true,
          developerMode: false,
        },
        isLoading: false,

        // Actions
        setTheme: (theme) => {
          set({ theme }, false, 'setTheme');
          // Apply theme to document root for CSS variables
          if (typeof document !== 'undefined') {
            document.documentElement.setAttribute('data-theme', theme);
            document.documentElement.className = theme;
          }
        },

        setLocale: (locale) => set({ locale }, false, 'setLocale'),

        setColorPalette: (colorPalette) => set({ colorPalette }, false, 'setColorPalette'),

        setBackground: (newBackground) =>
          set(
            (state) => ({
              background: { ...state.background, ...newBackground },
            }),
            false,
            'setBackground',
          ),

        setLoading: (isLoading) => set({ isLoading }, false, 'setLoading'),

        updatePreferences: (newPreferences) =>
          set(
            (state) => ({
              preferences: { ...state.preferences, ...newPreferences },
            }),
            false,
            'updatePreferences',
          ),

        initializeFromSystem: () => {
          const currentState = get();
          const systemTheme = getSystemTheme();
          const systemLocale = getSystemLocale();

          // Only update if not already set by user preference
          if (!localStorage.getItem('app-store')) {
            set(
              {
                theme: systemTheme,
                locale: systemLocale,
              },
              false,
              'initializeFromSystem',
            );
          }

          // Apply current theme to document
          if (typeof document !== 'undefined') {
            document.documentElement.setAttribute(
              'data-theme',
              currentState.theme,
            );
            document.documentElement.className = currentState.theme;
          }

          // Listen for system theme changes
          if (typeof window !== 'undefined' && window.matchMedia) {
            const mediaQuery = window.matchMedia(
              '(prefers-color-scheme: dark)',
            );
            const handleChange = (e: MediaQueryListEvent) => {
              const newTheme = e.matches ? 'dark' : 'light';
              // Only auto-update if user hasn't manually set a preference
              const stored = localStorage.getItem('app-store');
              if (!stored || !JSON.parse(stored).state.theme) {
                get().setTheme(newTheme);
              }
            };
            mediaQuery.addListener(handleChange);
          }
        },
      }),
      {
        name: 'app-store',
        // Only persist certain fields
        partialize: (state) => ({
          theme: state.theme,
          locale: state.locale,
          colorPalette: state.colorPalette,
          background: state.background,
          preferences: state.preferences,
        }),
        // Initialize system settings after rehydration
        onRehydrateStorage: () => (state) => {
          if (state) {
            state.initializeFromSystem();
          }
        },
      },
    ),
    {
      name: 'app-store',
    },
  ),
);
