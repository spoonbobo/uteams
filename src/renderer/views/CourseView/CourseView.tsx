import React, { useEffect } from 'react';
import { Typography, Box } from '@mui/material';
import { AskView } from './AskView';
import { CourseOverview } from './CourseOverview';
import { GradingView } from './GradingView';
import { useIntl } from 'react-intl';
import { useMoodleStore } from '@/stores/useMoodleStore';
import type { CourseSessionContext } from '@/stores/useContextStore';

interface CourseViewProps {
  sessionContext: CourseSessionContext | null;
}

export const CourseView: React.FC<CourseViewProps> = ({
  sessionContext,
}) => {
  const intl = useIntl();
  const { fetchCourseContent, getCourseContent, courses, fetchCourses } = useMoodleStore();

  // Load course content and save to memory when component mounts or session changes
  useEffect(() => {
    if (sessionContext?.sessionId) {
      const courseContent = getCourseContent(sessionContext.sessionId);
      // Only fetch if we don't have the content or if it's been more than 5 minutes
      if (!courseContent ||
          (courseContent.lastUpdated &&
           new Date().getTime() - new Date(courseContent.lastUpdated).getTime() > 5 * 60 * 1000)) {
        console.log(`[CourseView] Fetching fresh content for course ${sessionContext.sessionId}`);
        fetchCourseContent(sessionContext.sessionId).then(async (content) => {
          // Save course data to episodic memory
          if (content && !content.error) {
            // Try to find course in the courses list
            let course = courses.find(c => c.id === sessionContext.sessionId);

            // If not found in courses list, create a minimal course object from sessionContext
            if (!course) {
              console.log(`[CourseView] Course not in store, using session context data`);
              course = {
                id: sessionContext.sessionId,
                fullname: sessionContext.sessionName,
                shortname: sessionContext.sessionId, // Use ID as shortname fallback
                summary: '',
              };

              // Try to fetch courses if they're not loaded
              if (courses.length === 0) {
                console.log(`[CourseView] No courses loaded, attempting to fetch...`);
                fetchCourses().then(fetchedCourses => {
                  const foundCourse = fetchedCourses.find(c => c.id === sessionContext.sessionId);
                  if (foundCourse) {
                    console.log(`[CourseView] Course found after fetching: ${foundCourse.shortname}`);
                  }
                });
              }
            }

            console.log(`[CourseView] Preparing to save memory for ${course.shortname || sessionContext.sessionId}`);
            console.log(`[CourseView] Content stats:`, {
              assignments: content.assignments.length,
              students: content.students.length,
              activities: content.activities.length
            });

            const courseMemory = {
              courseId: sessionContext.sessionId,
              courseName: course.fullname,
              courseShortName: course.shortname || sessionContext.sessionId,
              summary: course.summary || '',
              assignments: content.assignments.map(a => ({
                id: a.id,
                name: a.name,
                dueDate: a.duedate,
                description: a.intro,
              })),
              students: content.students.map(s => ({
                id: s.id,
                name: s.fullname,
                email: s.email,
              })),
              activities: content.activities.map(a => ({
                id: a.id,
                name: a.name,
                type: a.modname,
              })),
              lastUpdated: new Date().toISOString(),
            };

            // Save to memory via IPC
            try {
              console.log(`[CourseView] Invoking IPC to save course memory...`);
              const result = await window.electron.ipcRenderer.invoke(
                'memory:save-course',
                courseMemory
              );
              if (result.success) {
                console.log(`[CourseView] ✅ Course memory saved successfully for ${course.shortname || sessionContext.sessionId}`);
              } else {
                console.error(`[CourseView] ❌ Failed to save course memory:`, result.error);
              }
            } catch (error) {
              console.error('[CourseView] ❌ IPC error saving course memory:', error);
            }
          } else {
            console.warn(`[CourseView] No content or error in content for course ${sessionContext.sessionId}`);
          }
        });
      } else if (courseContent && !courseContent.error) {
        console.log(`[CourseView] Content already loaded for ${sessionContext.sessionId}, checking memory freshness...`);
        // Content already loaded, just save to memory if not already saved
        const saveCourseMemory = async () => {
          // Try to find course in the courses list
          let course = courses.find(c => c.id === sessionContext.sessionId);

          // If not found in courses list, create a minimal course object from sessionContext
          if (!course) {
            console.log(`[CourseView] Course not in store, using session context data`);
            course = {
              id: sessionContext.sessionId,
              fullname: sessionContext.sessionName,
              shortname: sessionContext.sessionId, // Use ID as shortname fallback
              summary: '',
            };

            // Try to fetch courses if they're not loaded
            if (courses.length === 0) {
              console.log(`[CourseView] No courses loaded, attempting to fetch...`);
              fetchCourses();
            }
          }

          console.log(`[CourseView] Checking existing memory for ${course.shortname || sessionContext.sessionId}...`);
            // Check if memory already exists and is recent
            const existingMemory = await window.electron.ipcRenderer.invoke(
              'memory:get-course',
              sessionContext.sessionId
            );

            if (!existingMemory.data) {
              console.log(`[CourseView] No existing memory found, will save new memory`);
            } else if (existingMemory.data.lastUpdated &&
                 new Date().getTime() - new Date(existingMemory.data.lastUpdated).getTime() > 5 * 60 * 1000) {
              console.log(`[CourseView] Existing memory is stale (>5 mins), will update`);
            } else {
              console.log(`[CourseView] Memory is fresh, skipping save`);
              return;
            }

            if (!existingMemory.data ||
                (existingMemory.data.lastUpdated &&
                 new Date().getTime() - new Date(existingMemory.data.lastUpdated).getTime() > 5 * 60 * 1000)) {
              const courseMemory = {
                courseId: sessionContext.sessionId,
                courseName: course.fullname,
                courseShortName: course.shortname || sessionContext.sessionId,
                summary: course.summary || '',
                assignments: courseContent.assignments.map(a => ({
                  id: a.id,
                  name: a.name,
                  dueDate: a.duedate,
                  description: a.intro,
                })),
                students: courseContent.students.map(s => ({
                  id: s.id,
                  name: s.fullname,
                  email: s.email,
                })),
                activities: courseContent.activities.map(a => ({
                  id: a.id,
                  name: a.name,
                  type: a.modname,
                })),
                lastUpdated: new Date().toISOString(),
              };

              try {
                const result = await window.electron.ipcRenderer.invoke(
                  'memory:save-course',
                  courseMemory
                );
                if (result.success) {
                  console.log(`[CourseView] ✅ Course memory updated for ${course.shortname || sessionContext.sessionId}`);
                }
              } catch (error) {
                console.error('Failed to save course memory:', error);
              }
            }
        };
        saveCourseMemory();
      }
    }
  }, [sessionContext?.sessionId, sessionContext?.sessionName, fetchCourseContent, getCourseContent, courses, fetchCourses]);

  if (!sessionContext) {
    return (
      <Box
        sx={{
          p: 4,
          maxWidth: 'lg',
          mx: 'auto',
          backgroundColor: 'inherit',
        }}
      >
        <Typography variant="h4" color="text.secondary" textAlign="center">
          No course selected
        </Typography>
      </Box>
    );
  }

  const renderContent = () => {
    switch (sessionContext.view) {
      case 'ask':
        return <AskView sessionContext={sessionContext} />;
      case 'grading':
        return <GradingView sessionContext={sessionContext} />;
      case 'overview':
        return <CourseOverview sessionContext={sessionContext} />;
      default:
        return <AskView sessionContext={sessionContext} />;
    }
  };

  return (
    <Box
      sx={{
        p: 4,
        maxWidth: 'xl', // Changed from 'lg' to 'xl' for more space
        mx: 'auto',
        boxSizing: 'border-box',
        backgroundColor: 'inherit',
      }}
    >
      {renderContent()}
    </Box>
  );
};
