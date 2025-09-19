import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { ReactNode } from 'react';

// Context definitions for SPA navigation
export type AppContext = 'home' | 'course-session' | 'settings' | 'work';

// Navigation history entry that includes context details
export type NavigationEntry = {
  context: AppContext;
  sessionId?: string;
  sessionName?: string;
};

export type CourseSessionContext = {
  sessionId: string;
  sessionName: string;
  view: 'ask' | 'grading' | 'overview' | 'courseworkGenerator' | 'companion';
};

// Store for individual session states
export type CourseSessionState = {
  [sessionId: string]: {
    view: 'ask' | 'grading' | 'overview' | 'courseworkGenerator' | 'companion';
  };
};

export type SettingsContext = {
  section: 'general' | 'api';
};

export type HomeContext = {
  view: 'dashboard';
};

export type WorkContext = {
  view: 'tracking';
};



// Tab definition interface
export interface TabDefinition {
  id: string;
  label: string;
  icon?: ReactNode;
  value: string;
}

// Context-specific tab configurations (labels will be translated in components)
export const contextTabsConfig: Record<
  AppContext,
  Omit<TabDefinition, 'icon'>[]
> = {
  home: [
    { id: 'dashboard', label: 'tabs.dashboard', value: 'dashboard' },
  ],
  'course-session': [
    { id: 'overview', label: 'tabs.overview', value: 'overview' },
    { id: 'ask', label: 'tabs.ask', value: 'ask' },
    { id: 'grading', label: 'tabs.grading', value: 'grading' },
    { id: 'courseworkGenerator', label: 'tabs.courseworkGenerator', value: 'courseworkGenerator' },
    { id: 'companion', label: 'tabs.companion', value: 'companion' },
  ],
  settings: [
    { id: 'general', label: 'tabs.general', value: 'general' },
    { id: 'api', label: 'tabs.api', value: 'api' },
  ],
  work: [
    { id: 'tracking', label: 'tabs.workTracking', value: 'tracking' },
  ],
};

// Context state interface
interface ContextState {
  // Current active context
  currentContext: AppContext;

  // Context-specific states
  homeContext: HomeContext;
  courseSessionContext: CourseSessionContext | null;
  courseSessionStates: CourseSessionState; // Store each session's state separately
  settingsContext: SettingsContext;
  workContext: WorkContext;

  // Navigation history for back/forward functionality
  navigationHistory: NavigationEntry[];
  historyIndex: number;

  // Actions
  navigateToHome: (view?: HomeContext['view']) => void;
  navigateToCourseSession: (
    sessionId: string,
    sessionName: string,
    view?: CourseSessionContext['view'],
  ) => void;
  navigateToSettings: (section?: SettingsContext['section']) => void;
  navigateToWork: (view?: WorkContext['view']) => void;

  // Context-specific actions
  updateHomeView: (view: HomeContext['view']) => void;
  updateCourseSessionView: (view: CourseSessionContext['view']) => void;
  updateSettingsSection: (section: SettingsContext['section']) => void;
  updateWorkView: (view: WorkContext['view']) => void;


  // Navigation utilities
  goBack: () => void;
  goForward: () => void;

  // Utility functions
  getContextTitle: () => string;
  getContextBreadcrumb: () => string[];
  getContextTabs: () => TabDefinition[];
  getCurrentTabValue: () => string | null;
  handleTabChange: (newValue: string) => void;
  resetContext: () => void;
}

export const useContextStore = create<ContextState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        currentContext: 'home',
        homeContext: { view: 'dashboard' },
        courseSessionContext: null,
        courseSessionStates: {}, // Empty object to store session states
        settingsContext: { section: 'general' },
        workContext: { view: 'tracking' },

        navigationHistory: [{ context: 'home' as AppContext }],
        historyIndex: 0,

        // Navigation actions
        navigateToHome: (view = 'dashboard') => {
          set(
            (state: ContextState) => {
              const newHistory = [
                ...state.navigationHistory.slice(0, state.historyIndex + 1),
                { context: 'home' as AppContext },
              ];
              return {
                ...state,
                currentContext: 'home' as AppContext,
                homeContext: { view },
                navigationHistory: newHistory,
                historyIndex: newHistory.length - 1,
              };
            },
            false,
            'navigateToHome',
          );
        },

        navigateToCourseSession: (
          sessionId,
          sessionName,
          view?: CourseSessionContext['view'],
        ) => {
          set(
            (state: ContextState) => {
              const newHistory = [
                ...state.navigationHistory.slice(0, state.historyIndex + 1),
                {
                  context: 'course-session' as AppContext,
                  sessionId,
                  sessionName,
                },
              ];

        // Priority: 1) Explicit view param, 2) Existing persisted state, 3) Default 'ask'
        const existingSessionState =
          state.courseSessionStates[sessionId];
        // Coerce any 'companion' view to 'ask' since companion is overlay-only
        const requestedView = view ?? existingSessionState?.view ?? 'ask';
        const sessionView = requestedView === 'companion' ? 'ask' : requestedView;

              // Update the session state in our store
              const updatedSessionStates = {
                ...state.courseSessionStates,
                [sessionId]: { view: sessionView },
              };

              return {
                ...state,
                currentContext: 'course-session' as AppContext,
                courseSessionContext: {
                  sessionId,
                  sessionName,
                  view: sessionView,
                },
                courseSessionStates: updatedSessionStates,
                navigationHistory: newHistory,
                historyIndex: newHistory.length - 1,
              };
            },
            false,
            'navigateToCourseSession',
          );
        },

        navigateToSettings: (section = 'general') => {
          set(
            (state: ContextState) => {
              const newHistory = [
                ...state.navigationHistory.slice(0, state.historyIndex + 1),
                { context: 'settings' as AppContext },
              ];
              return {
                ...state,
                currentContext: 'settings' as AppContext,
                settingsContext: { section },
                navigationHistory: newHistory,
                historyIndex: newHistory.length - 1,
              };
            },
            false,
            'navigateToSettings',
          );
        },

        navigateToWork: (view = 'tracking') => {
          set(
            (state: ContextState) => {
              const newHistory = [
                ...state.navigationHistory.slice(0, state.historyIndex + 1),
                { context: 'work' as AppContext },
              ];
              return {
                ...state,
                currentContext: 'work' as AppContext,
                workContext: { view },
                navigationHistory: newHistory,
                historyIndex: newHistory.length - 1,
              };
            },
            false,
            'navigateToWork',
          );
        },





        // Context-specific updates (don't add to history)
        updateHomeView: (view) =>
          set(
            (state) => ({
              homeContext: { view: 'dashboard' }, // Always dashboard since features is removed
            }),
            false,
            'updateHomeView',
          ),

        updateCourseSessionView: (view) =>
          set(
            (state) => {
              if (!state.courseSessionContext) return state;

        const { sessionId } = state.courseSessionContext;
        // Prevent persisting/selecting 'companion' as an inline view
        const coercedView = view === 'companion' ? 'ask' : view;
        const updatedSessionStates = {
          ...state.courseSessionStates,
          [sessionId]: { view: coercedView }, // ✅ This updates the persisted state
        };

              return {
                courseSessionContext: { ...state.courseSessionContext, view: coercedView },
                courseSessionStates: updatedSessionStates, // ✅ This triggers persistence
              };
            },
            false,
            'updateCourseSessionView',
          ),

        updateSettingsSection: (section) =>
          set(
            (state) => ({
              settingsContext: { ...state.settingsContext, section },
            }),
            false,
            'updateSettingsSection',
          ),

        updateWorkView: (view) =>
          set(
            (state) => ({
              workContext: { ...state.workContext, view },
            }),
            false,
            'updateWorkView',
          ),



        // Navigation utilities
        goBack: () => {
          const state = get();
          if (state.historyIndex > 0) {
            const newIndex = state.historyIndex - 1;
            const targetEntry = state.navigationHistory[newIndex];
            const updates: Partial<ContextState> = {
              currentContext: targetEntry.context,
              historyIndex: newIndex,
            };

            // If navigating to a betting session, restore the session context
            if (
              targetEntry.context === 'course-session' &&
              targetEntry.sessionId &&
              targetEntry.sessionName
            ) {
              const sessionState =
                state.courseSessionStates[targetEntry.sessionId];
              updates.courseSessionContext = {
                sessionId: targetEntry.sessionId,
                sessionName: targetEntry.sessionName,
                view: sessionState?.view || 'ask',
              };
            } else if (targetEntry.context !== 'course-session') {
              updates.courseSessionContext = null;
            }

            set(updates, false, 'goBack');
          }
        },

        goForward: () => {
          const state = get();
          if (state.historyIndex < state.navigationHistory.length - 1) {
            const newIndex = state.historyIndex + 1;
            const targetEntry = state.navigationHistory[newIndex];
            const updates: Partial<ContextState> = {
              currentContext: targetEntry.context,
              historyIndex: newIndex,
            };

            // If navigating to a betting session, restore the session context
            if (
              targetEntry.context === 'course-session' &&
              targetEntry.sessionId &&
              targetEntry.sessionName
            ) {
              const sessionState =
                state.courseSessionStates[targetEntry.sessionId];
              updates.courseSessionContext = {
                sessionId: targetEntry.sessionId,
                sessionName: targetEntry.sessionName,
                view: sessionState?.view || 'ask',
              };
            } else if (targetEntry.context !== 'course-session') {
              updates.courseSessionContext = null;
            }

            set(updates, false, 'goForward');
          }
        },

        // Tab management utilities
        getContextTabs: () => {
          const state = get();
          const tabs = contextTabsConfig[state.currentContext] || [];

          // Customize the ask tab label for course sessions
          if (state.currentContext === 'course-session' && state.courseSessionContext) {
            return tabs.map(tab => {
              if (tab.id === 'ask') {
                // Session ID should now be the course shortname (e.g., COMP7404)
                // If not available, extract from course name or create abbreviation
                const sessionId = state.courseSessionContext!.sessionId;
                const courseName = state.courseSessionContext!.sessionName;

                let courseCode = sessionId;

                // Check if sessionId looks like a proper course code
                if (!/^[A-Z]{2,10}\d{0,6}$/i.test(sessionId)) {
                  // Try to extract course code from the course name
                  const courseCodeMatch = courseName.match(/^([A-Z]{2,10}\d{0,6})/i);
                  if (courseCodeMatch) {
                    courseCode = courseCodeMatch[1].toUpperCase();
                  } else {
                    // Last resort: create abbreviation from course name
                    courseCode = courseName
                      .split(' ')
                      .filter(word => word.length > 0)
                      .map(word => word[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 4);
                  }
                } else {
                  // Session ID is already a course code, just ensure uppercase
                  courseCode = sessionId.toUpperCase();
                }

                return {
                  ...tab,
                  label: `Ask ${courseCode}`, // Custom label instead of translation key
                  customLabel: true, // Flag to indicate this is a custom label
                };
              }
              return tab;
            });
          }

          return tabs;
        },

        getCurrentTabValue: () => {
          const state = get();
          switch (state.currentContext) {
            case 'home':
              return state.homeContext.view;
            case 'course-session':
            // Never report 'companion' as current tab; default to 'ask'
            return state.courseSessionContext?.view === 'companion'
              ? 'ask'
              : state.courseSessionContext?.view || 'ask';
            case 'settings':
              return state.settingsContext.section;
            case 'work':
              return state.workContext.view;
            default:
              return null;
          }
        },

        handleTabChange: (newValue: string) => {
          const state = get();
          switch (state.currentContext) {
            case 'home':
              set(
                (state) => ({
                  homeContext: { view: newValue as 'dashboard' },
                }),
                false,
                'updateHomeView',
              );
              break;
            case 'course-session':
              // Ignore 'companion' changes; it is overlay-only
              if (newValue === 'companion') return;
              get().updateCourseSessionView(
                newValue as CourseSessionContext['view'],
              );
              break;
            case 'settings':
              get().updateSettingsSection(
                newValue as SettingsContext['section'],
              );
              break;
            case 'work':
              get().updateWorkView(
                newValue as WorkContext['view'],
              );
              break;

          }
        },

        getContextTitle: () => {
          const state = get();
          switch (state.currentContext) {
            case 'home':
              return 'Home';
            case 'course-session':
              return (
                state.courseSessionContext?.sessionName || 'Course Session'
              );
            case 'settings':
              return 'Settings';
            case 'work':
              return 'Agent Task Tracking';
            default:
              return 'uTeams';
          }
        },

        getContextBreadcrumb: () => {
          const state = get();
          const breadcrumb: string[] = [];
          switch (state.currentContext) {
            case 'home':
              breadcrumb.push('Home');
              break;
            case 'course-session':
              breadcrumb.push('Courses');
              if (state.courseSessionContext?.sessionName) {
                breadcrumb.push(state.courseSessionContext.sessionName);
              }
              break;
            case 'settings':
              breadcrumb.push('Settings');
              break;
            case 'work':
              breadcrumb.push('Agent Task Tracking');
              break;

          }
          return breadcrumb;
        },

          resetContext: () =>
          set(
            {
              currentContext: 'home',
              homeContext: { view: 'dashboard' },
              courseSessionContext: null,
              courseSessionStates: {},
              settingsContext: { section: 'general' },
              workContext: { view: 'tracking' },
              navigationHistory: [{ context: 'home' as AppContext }],
              historyIndex: 0,
            },
            false,
            'resetContext',
          ),
      }),
      {
        name: 'context-store',
        // Persist course session states and context preferences
        partialize: (state) => ({
          courseSessionStates: state.courseSessionStates, // ✅ Persist tab states per session
          homeContext: state.homeContext, // ✅ Persist home preferences
          settingsContext: state.settingsContext, // ✅ Persist settings
          workContext: state.workContext, // ✅ Persist work preferences
          // Don't persist: currentContext, courseSessionContext, navigationHistory, historyIndex
        }),
      },
    ),
    {
      name: 'context-store',
    },
  ),
);

// Simple selector hooks - no complex computations
export const useCurrentContext = () =>
  useContextStore((state) => state.currentContext);
