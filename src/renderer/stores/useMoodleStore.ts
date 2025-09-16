import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { toast } from '../utils/toast';
import type {
  MoodleConfig,
  MoodleConnectionInfo,
  MoodleCourse,
  MoodleUser,
  MoodleAssignment,
  MoodleActivity,
  CourseContent,
} from '../types/moodle';

interface MoodleState {
  // Configuration
  config: MoodleConfig;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  connectionInfo: MoodleConnectionInfo | null;
  lastConnectionCheck: string | null;

  // Courses
  courses: MoodleCourse[];
  isLoadingCourses: boolean;
  coursesError: string | null;
  lastCoursesUpdate: string | null;

  // Course Content (keyed by courseId)
  courseContent: Record<string, CourseContent>;

  // Actions
  setConfig: (config: Partial<MoodleConfig>) => void;
  testConnection: () => Promise<boolean>;
  saveApiKey: (apiKey: string) => Promise<boolean>;
  loadStoredConfig: () => Promise<void>;
  clearConfig: () => void;
  getStoredApiKey: () => string;
  isConfigured: () => boolean;
  fetchCourses: () => Promise<MoodleCourse[]>;
  clearCourses: () => void;
  
  // Course Content Actions
  fetchCourseContent: (courseId: string) => Promise<CourseContent>;
  fetchAllCourseContent: () => Promise<void>;
  getCourseContent: (courseId: string) => CourseContent | null;
  clearCourseContent: (courseId?: string) => void;
  
  // Navigation helpers
  getMoodleAssignmentUrl: (assignment: MoodleAssignment) => string;
  getMoodleCourseUrl: (courseId: string) => string;
  getMoodleUserUrl: (userId: string) => string;
  
  // Assignment aggregation
  getAllAssignments: () => MoodleAssignment[];
  getUpcomingAssignments: (daysAhead?: number) => MoodleAssignment[];
}

export const useMoodleStore = create<MoodleState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        config: {
          baseUrl: 'https://moodle.onlysaid.com',
          apiKey: '',
        },
        isConnected: false,
        isConnecting: false,
        connectionError: null,
        connectionInfo: null,
        lastConnectionCheck: null,

        // Courses state
        courses: [],
        isLoadingCourses: false,
        coursesError: null,
        lastCoursesUpdate: null,

        // Course Content state
        courseContent: {},

        // Actions
        setConfig: (config) => {
          set(
            (state) => ({
              config: { ...state.config, ...config },
            }),
            false,
            'setMoodleConfig'
          );
        },

        testConnection: async () => {
          const { config } = get();
          
          if (!config.apiKey) {
            set({
              connectionError: 'API key is required',
              isConnected: false,
            });
            return false;
          }

          set({
            isConnecting: true,
            connectionError: null,
          });

          try {
            const result = await window.electron.ipcRenderer.invoke(
              'moodle:test-connection',
              {
                baseUrl: config.baseUrl,
                apiKey: config.apiKey,
              }
            );

            if (result.success && result.data) {
              set({
                isConnected: true,
                isConnecting: false,
                connectionError: null,
                connectionInfo: {
                  userid: result.data.userid,
                  username: result.data.username,
                  firstname: result.data.firstname,
                  lastname: result.data.lastname,
                  fullname: result.data.fullname,
                  email: result.data.useremail,
                  sitename: result.data.sitename,
                  siteurl: result.data.siteurl,
                },
                lastConnectionCheck: new Date().toISOString(),
              });
              return true;
            } else {
              set({
                isConnected: false,
                isConnecting: false,
                connectionError: result.error || 'Connection failed',
                connectionInfo: null,
              });
              return false;
            }
          } catch (error) {
            set({
              isConnected: false,
              isConnecting: false,
              connectionError: (error as Error).message,
              connectionInfo: null,
            });
            return false;
          }
        },

        saveApiKey: async (apiKey: string) => {
          const { config } = get();
          
          // Update local state
          set({
            config: { ...config, apiKey },
          });

          try {
            // Save to backend (SQLite)
            const result = await window.electron.ipcRenderer.invoke(
              'moodle:save-config',
              {
                baseUrl: config.baseUrl,
                apiKey,
              }
            );

            if (result.success) {
              // Test the connection with new API key
              const connected = await get().testConnection();
              
              if (connected) {
                toast.success('Moodle API key saved and verified');
                // Fetch courses after successful connection
                get().fetchCourses();
              } else {
                toast.warning('API key saved but connection failed. Please check your credentials.');
              }
              
              return connected;
            } else {
              toast.error('Failed to save API key');
              return false;
            }
          } catch (error) {
            toast.error('Error saving API key: ' + (error as Error).message);
            return false;
          }
        },

        loadStoredConfig: async () => {
          try {
            const result = await window.electron.ipcRenderer.invoke(
              'moodle:get-config'
            );

            if (result.success && result.data) {
              set({
                config: {
                  baseUrl: result.data.baseUrl || 'https://moodle.onlysaid.com',
                  apiKey: result.data.apiKey || '',
                },
              });

              // If we have an API key, test the connection and fetch courses
              if (result.data.apiKey) {
                get().testConnection().then((connected) => {
                  if (connected) {
                    get().fetchCourses();
                  }
                });
              }
            }
          } catch (error) {
            console.error('Failed to load Moodle config:', error);
          }
        },

        clearConfig: () => {
          set({
            config: {
              baseUrl: 'https://moodle.onlysaid.com',
              apiKey: '',
            },
            isConnected: false,
            connectionError: null,
            connectionInfo: null,
            lastConnectionCheck: null,
          });

          // Also clear from backend
          window.electron.ipcRenderer.invoke('moodle:clear-config').catch(console.error);
        },

        getStoredApiKey: () => {
          return get().config.apiKey;
        },

        isConfigured: () => {
          const { config } = get();
          return !!config.apiKey && !!config.baseUrl;
        },

        fetchCourses: async () => {
          const { config, isConnected } = get();
          
          if (!config.apiKey) {
            set({ coursesError: 'API key is required' });
            return [];
          }

          set({
            isLoadingCourses: true,
            coursesError: null,
          });

          try {
            const result = await window.electron.ipcRenderer.invoke(
              'moodle:get-courses',
              {
                baseUrl: config.baseUrl,
                apiKey: config.apiKey,
              }
            );

            if (result.success && result.data) {
              const courses = result.data as MoodleCourse[];
              set({
                courses,
                isLoadingCourses: false,
                coursesError: null,
                lastCoursesUpdate: new Date().toISOString(),
              });
              return courses;
            } else {
              set({
                courses: [],
                isLoadingCourses: false,
                coursesError: result.error || 'Failed to fetch courses',
              });
              return [];
            }
          } catch (error) {
            set({
              courses: [],
              isLoadingCourses: false,
              coursesError: (error as Error).message,
            });
            return [];
          }
        },

        clearCourses: () => {
          set({
            courses: [],
            coursesError: null,
            lastCoursesUpdate: null,
          });
        },

        // Course Content Actions
        fetchCourseContent: async (courseId: string) => {
          const { config } = get();
          
          if (!config.apiKey) {
            const error = 'API key is required';
            set((state) => ({
              courseContent: {
                ...state.courseContent,
                [courseId]: {
                  assignments: [],
                  students: [],
                  activities: [],
                  isLoading: false,
                  error,
                  lastUpdated: null,
                },
              },
            }));
            return {
              assignments: [],
              students: [],
              activities: [],
              isLoading: false,
              error,
              lastUpdated: null,
            };
          }

          // Set loading state
          set((state) => ({
            courseContent: {
              ...state.courseContent,
              [courseId]: {
                assignments: [],
                students: [],
                activities: [],
                isLoading: true,
                error: null,
                lastUpdated: null,
              },
            },
          }));

          try {
            // Fetch all course content in parallel
            const [assignmentsResult, studentsResult, activitiesResult] = await Promise.all([
              window.electron.ipcRenderer.invoke('moodle:get-assignments', {
                baseUrl: config.baseUrl,
                apiKey: config.apiKey,
                courseId,
              }),
              window.electron.ipcRenderer.invoke('moodle:get-enrolled-users', {
                baseUrl: config.baseUrl,
                apiKey: config.apiKey,
                courseId,
              }),
              window.electron.ipcRenderer.invoke('moodle:get-course-contents', {
                baseUrl: config.baseUrl,
                apiKey: config.apiKey,
                courseId,
              }),
            ]);

            const assignments = assignmentsResult.success ? assignmentsResult.data || [] : [];
            const students = studentsResult.success ? studentsResult.data || [] : [];
            const activities = activitiesResult.success ? activitiesResult.data || [] : [];

            const courseContent: CourseContent = {
              assignments,
              students,
              activities,
              isLoading: false,
              error: null,
              lastUpdated: new Date().toISOString(),
            };

            set((state) => ({
              courseContent: {
                ...state.courseContent,
                [courseId]: courseContent,
              },
            }));

            return courseContent;
          } catch (error) {
            const errorMessage = (error as Error).message;
            const courseContent: CourseContent = {
              assignments: [],
              students: [],
              activities: [],
              isLoading: false,
              error: errorMessage,
              lastUpdated: null,
            };

            set((state) => ({
              courseContent: {
                ...state.courseContent,
                [courseId]: courseContent,
              },
            }));

            return courseContent;
          }
        },

        fetchAllCourseContent: async () => {
          const { courses, config, courseContent } = get();
          
          if (!config.apiKey || courses.length === 0) {
            console.log('[MoodleStore] Cannot fetch all course content: no API key or no courses loaded');
            return;
          }

          // Filter out courses that already have content loaded
          const coursesToFetch = courses.filter(course => {
            const existingContent = courseContent[course.id];
            // Check if content exists and was successfully loaded (no error and has lastUpdated)
            const hasContent = existingContent && 
                             !existingContent.error && 
                             existingContent.lastUpdated && 
                             !existingContent.isLoading;
            if (hasContent) {
              console.log(`[MoodleStore] Skipping ${course.shortname} - content already loaded at ${existingContent.lastUpdated}`);
            }
            return !hasContent;
          });

          if (coursesToFetch.length === 0) {
            console.log('[MoodleStore] All courses already have content loaded');
            return;
          }

          console.log(`[MoodleStore] Fetching content for ${coursesToFetch.length} courses (${courses.length - coursesToFetch.length} already loaded)...`);
          
          // Fetch content for courses that don't have it yet
          const fetchPromises = coursesToFetch.map(course => 
            get().fetchCourseContent(course.id).catch(error => {
              console.error(`[MoodleStore] Failed to fetch content for course ${course.shortname}:`, error);
              return null;
            })
          );

          try {
            await Promise.all(fetchPromises);
            console.log('[MoodleStore] ✅ Finished fetching content for all courses');
          } catch (error) {
            console.error('[MoodleStore] ❌ Error fetching all course content:', error);
          }
        },

        getCourseContent: (courseId: string) => {
          const { courseContent } = get();
          return courseContent[courseId] || null;
        },

        clearCourseContent: (courseId?: string) => {
          if (courseId) {
            set((state) => {
              const newCourseContent = { ...state.courseContent };
              delete newCourseContent[courseId];
              return { courseContent: newCourseContent };
            });
          } else {
            set({ courseContent: {} });
          }
        },

        // Navigation helpers
        getMoodleAssignmentUrl: (assignment: MoodleAssignment) => {
          const { config } = get();
          // Use cmid if available, otherwise fall back to assignment id
          const moduleId = assignment.cmid || assignment.id;
          return `${config.baseUrl}/mod/assign/view.php?id=${moduleId}`;
        },

        getMoodleCourseUrl: (courseId: string) => {
          const { config } = get();
          return `${config.baseUrl}/course/view.php?id=${courseId}`;
        },

        getMoodleUserUrl: (userId: string) => {
          const { config } = get();
          return `${config.baseUrl}/user/profile.php?id=${userId}`;
        },

        // Assignment aggregation functions
        getAllAssignments: () => {
          const { courseContent, courses } = get();
          const allAssignments: (MoodleAssignment & { courseShortname?: string })[] = [];
          const seenAssignmentIds = new Set<string>();
          
          Object.entries(courseContent).forEach(([courseId, content]) => {
            if (content.assignments && content.assignments.length > 0) {
              const course = courses.find(c => c.id === courseId);
              
              content.assignments.forEach(assignment => {
                // Create a unique key combining assignment ID and course ID to handle cross-course duplicates
                const uniqueKey = `${assignment.id}-${courseId}`;
                
                // Skip if we've already seen this assignment ID globally
                if (seenAssignmentIds.has(assignment.id)) {
                  // Log only in development for debugging
                  if (process.env.NODE_ENV === 'development') {
                    console.debug(`[MoodleStore] Duplicate assignment ID detected: ${assignment.id} - ${assignment.name} in course ${courseId}`);
                  }
                  return;
                }
                
                seenAssignmentIds.add(assignment.id);
                allAssignments.push({
                  ...assignment,
                  courseShortname: course?.shortname || courseId
                });
              });
            }
          });
          
          if (process.env.NODE_ENV === 'development') {
            console.log(`[MoodleStore] getAllAssignments: Found ${allAssignments.length} unique assignments from ${Object.keys(courseContent).length} courses`);
          }
          
          // Sort by due date (earliest first)
          return allAssignments.sort((a, b) => {
            if (!a.duedate && !b.duedate) return 0;
            if (!a.duedate) return 1;
            if (!b.duedate) return -1;
            return a.duedate - b.duedate;
          });
        },

        getUpcomingAssignments: (daysAhead = 30) => {
          const allAssignments = get().getAllAssignments();
          const now = Date.now() / 1000; // Current time in seconds
          const futureLimit = now + (daysAhead * 24 * 60 * 60); // Days ahead in seconds
          
          return allAssignments.filter(assignment => {
            if (!assignment.duedate) return false;
            return assignment.duedate >= now && assignment.duedate <= futureLimit;
          });
        },
      }),
      {
        name: 'moodle-store',
        partialize: (state) => ({
          config: {
            baseUrl: state.config.baseUrl,
            // Persist API key for user convenience (stored in localStorage)
            // Note: In production, consider encrypting this or using secure storage
            apiKey: state.config.apiKey,
          },
          lastConnectionCheck: state.lastConnectionCheck,
        }),
      }
    ),
    {
      name: 'moodle-store',
    }
  )
);

// Load stored config on app start
if (typeof window !== 'undefined') {
  setTimeout(() => {
    useMoodleStore.getState().loadStoredConfig();
  }, 100);
}
