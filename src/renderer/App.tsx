import * as React from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import '@fontsource/ibm-plex-sans/200.css';
import '@fontsource/ibm-plex-sans/300.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
// Chinese locale font for better CJK rendering
import '@fontsource-variable/noto-sans-tc';

import { ThemeProvider } from './providers/ThemeProvider';
import { IntlProvider } from './providers/IntlProvider';
import { ToastProvider } from './providers/ToastProvider';
import { AppLayout } from './layout';
import { HomeView } from '@/views/HomeView';
import { SettingsView } from '@/views/SettingsView';
import { CourseView } from '@/views/CourseView';
import { CompanionOverlay } from '@/views/CompanionOverlay';
import { useContextStore } from '@/stores/useContextStore';
import { useAppStore } from '@/stores/useAppStore';
import { useBackgroundEffect } from '@/utils/background';
import './App.css';


function Dashboard() {
  const { currentContext, courseSessionContext } = useContextStore();
  const { preferences } = useAppStore();
  // Detect companion overlay mode from query string
  const search = typeof window !== 'undefined' ? window.location.search : '';
  const params = new URLSearchParams(search);
  const overlay = params.get('overlay');

  // Ensure proper layout on mount
  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      // Reset any potential layout issues
      document.documentElement.style.height = '100%';
      document.documentElement.style.width = '100%';
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.margin = '0';
      document.documentElement.style.padding = '0';

      if (overlay === 'companion') {
        document.body.style.background = 'transparent';
      }
      // Don't set any background here for normal mode - let the background system handle it

      // Ensure body maintains proper layout
      document.body.style.height = '100vh';
      document.body.style.width = '100vw';
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.body.style.overflow = 'hidden';

      // Remove fixed positioning to prevent layout issues
      if (overlay !== 'companion') {
        document.body.style.position = 'relative';
      }
    }
  }, [overlay]);

  const renderCurrentView = () => {
    switch (currentContext) {
      case 'home':
        return <HomeView />;
      case 'settings':
        return <SettingsView />;

      case 'course-session':
        return <CourseView sessionContext={courseSessionContext} />;

      default:
        return <HomeView />;
    }
  };

  // If this is a companion overlay window, render only the overlay view without app layout
  if (overlay === 'companion') {
    const sessionId = params.get('sessionId') || '';
    const sessionName = params.get('sessionName') || '';
    return <CompanionOverlay sessionId={sessionId} sessionName={sessionName} />;
  }

  return <AppLayout>{renderCurrentView()}</AppLayout>;
}

export default function App() {
  const { background, preferences } = useAppStore();

  // Use the background effect hook from the utility
  useBackgroundEffect(background);

  // Ensure proper layout initialization
  React.useEffect(() => {
    // Add utility classes to body for consistent behavior
    if (typeof document !== 'undefined') {
      document.body.classList.add('electron-app');
      document.documentElement.style.height = '100%';
      document.documentElement.style.overflow = 'hidden';

      // Ensure root element takes full height
      const root = document.getElementById('root');
      if (root) {
        root.style.height = '100vh';
        root.style.overflow = 'hidden';
        root.style.position = 'fixed';
        root.style.top = '0';
        root.style.left = '0';
        root.style.right = '0';
        root.style.bottom = '0';
        root.style.visibility = 'visible';
      }
    }
  }, []);

  return (
    <ThemeProvider>
      <IntlProvider>
        <ToastProvider>
          <Router>
            <Routes>
              <Route path="/" element={<Dashboard />} />
            </Routes>
          </Router>
        </ToastProvider>
      </IntlProvider>
    </ThemeProvider>
  );
}
