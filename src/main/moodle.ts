import { ipcMain } from 'electron';
// eslint-disable-next-line import/no-extraneous-dependencies
import axios from 'axios';
import { executeQuery, initializeDatabase, runMigrations } from './db';

// Moodle configuration from environment
const MOODLE_BASE_URL = (process.env.MOODLE_BASE_URL || 'https://moodle.onlysaid.com').replace(/\/+$/, '');

// Note: Database will be initialized lazily when first accessed via executeQuery
// runMigrations will be called during initializeSqliteOnStartup

// Helper function to get user ID
async function getUserId(baseUrl: string, apiKey: string): Promise<number> {
  const response = await axios.get(`${baseUrl}/webservice/rest/server.php`, {
    params: {
      wstoken: apiKey,
      wsfunction: 'core_webservice_get_site_info',
      moodlewsrestformat: 'json'
    }
  });
  
  if (response.data && response.data.userid) {
    return response.data.userid;
  }
  
  throw new Error('Could not get user ID');
}

// Main setup function - registers all Moodle handlers
export function setupMoodleHandlers() {
  // Get preset Moodle URL handler (useful for configuration)
  ipcMain.handle('moodle:get-preset-url', async () => {
    return {
      success: true,
      url: MOODLE_BASE_URL,
      configured: true
    };
  });

  // Add API handlers
  setupMoodleApiHandlers();
  
  // Add configuration handlers
  setupMoodleConfigHandlers();
}

// Register all Moodle API handlers
export function setupMoodleApiHandlers() {
  // Test connection to Moodle
  ipcMain.handle('moodle:test-connection', async (event, args: { baseUrl: string; apiKey: string }) => {
    try {
      const response = await axios.get(`${args.baseUrl}/webservice/rest/server.php`, {
        params: {
          wstoken: args.apiKey,
          wsfunction: 'core_webservice_get_site_info',
          moodlewsrestformat: 'json'
        }
      });

      if (response.data && !response.data.exception) {
        return {
          success: true,
          data: response.data
        };
      } else {
        return {
          success: false,
          error: response.data?.message || 'Invalid API response'
        };
      }
    } catch (error: any) {
      console.error('[Moodle API] Test connection error:', error);
      return {
        success: false,
        error: error.message || 'Connection failed'
      };
    }
  });

  // Get available courses for user
  ipcMain.handle('moodle:get-courses', async (event, args: { baseUrl: string; apiKey: string }) => {
    try {
      // First, get the current user info to get the userid
      const userInfoResponse = await axios.get(`${args.baseUrl}/webservice/rest/server.php`, {
        params: {
          wstoken: args.apiKey,
          wsfunction: 'core_webservice_get_site_info',
          moodlewsrestformat: 'json'
        }
      });

      if (!userInfoResponse.data || userInfoResponse.data.exception) {
        throw new Error(userInfoResponse.data?.message || 'Failed to get user information');
      }

      const userId = userInfoResponse.data.userid;

      // Now get courses for this specific user
      const requestUrl = `${args.baseUrl}/webservice/rest/server.php`;
      const params = {
        wstoken: args.apiKey,
        wsfunction: 'core_enrol_get_users_courses',
        moodlewsrestformat: 'json',
        userid: userId
      };

      const response = await axios.get(requestUrl, { params });

      if (response.data && response.data.exception) {
        throw new Error(response.data.message || 'Moodle API error');
      }

      if (response.data && Array.isArray(response.data)) {
        const courses = response.data.map((course: any) => ({
          id: course.id.toString(),
          fullname: course.fullname,
          shortname: course.shortname,
          categoryid: course.categoryid,
          summary: course.summary,
          startdate: course.startdate * 1000,
          enddate: course.enddate * 1000,
          visible: course.visible,
          enrollmentmethods: course.enrollmentmethods
        }));

        return {
          success: true,
          data: courses
        };
      } else {
        return {
          success: false,
          error: response.data?.message || 'Failed to get courses - unexpected response format'
        };
      }
    } catch (error: any) {
      console.error('[Moodle API] Error getting courses:', error.message);
      
      return {
        success: false,
        error: error.message || 'Failed to fetch courses'
      };
    }
  });

  // Get course information
  ipcMain.handle('moodle:get-course', async (event, args: { baseUrl: string; apiKey: string; courseId: string }) => {
    try {
      const response = await axios.get(`${args.baseUrl}/webservice/rest/server.php`, {
        params: {
          wstoken: args.apiKey,
          wsfunction: 'core_course_get_courses_by_field',
          moodlewsrestformat: 'json',
          field: 'id',
          value: args.courseId
        }
      });

      if (response.data && response.data.courses && response.data.courses.length > 0) {
        return {
          success: true,
          data: response.data.courses[0]
        };
      } else {
        return {
          success: false,
          error: 'Course not found'
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch course'
      };
    }
  });

  // Get enrolled users in course
  ipcMain.handle('moodle:get-enrolled-users', async (event, args: { baseUrl: string; apiKey: string; courseId: string }) => {
    try {
      // Ensure courseId is numeric
      let numericCourseId = parseInt(args.courseId);
      
      if (isNaN(numericCourseId)) {
        // Find the numeric course ID
        const coursesResponse = await axios.get(`${args.baseUrl}/webservice/rest/server.php`, {
          params: {
            wstoken: args.apiKey,
            wsfunction: 'core_enrol_get_users_courses',
            moodlewsrestformat: 'json',
            userid: await getUserId(args.baseUrl, args.apiKey)
          }
        });
        
        if (coursesResponse.data && Array.isArray(coursesResponse.data)) {
          const course = coursesResponse.data.find((c: any) => 
            c.shortname === args.courseId || c.fullname.includes(args.courseId)
          );
          
          if (course) {
            numericCourseId = parseInt(course.id);
          } else {
            return {
              success: true,
              data: []
            };
          }
        }
      }
      
      const response = await axios.get(`${args.baseUrl}/webservice/rest/server.php`, {
        params: {
          wstoken: args.apiKey,
          wsfunction: 'core_enrol_get_enrolled_users',
          moodlewsrestformat: 'json',
          courseid: numericCourseId
        }
      });

      if (response.data && Array.isArray(response.data)) {
        return {
          success: true,
          data: response.data
        };
      } else {
        return {
          success: false,
          error: response.data?.message || 'Failed to get enrolled users'
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch enrolled users'
      };
    }
  });

  // Get course activities
  ipcMain.handle('moodle:get-course-contents', async (event, args: { baseUrl: string; apiKey: string; courseId: string }) => {
    try {
      // Ensure courseId is numeric
      let numericCourseId = parseInt(args.courseId);
      
      if (isNaN(numericCourseId)) {
        // Find the numeric course ID
        const coursesResponse = await axios.get(`${args.baseUrl}/webservice/rest/server.php`, {
          params: {
            wstoken: args.apiKey,
            wsfunction: 'core_enrol_get_users_courses',
            moodlewsrestformat: 'json',
            userid: await getUserId(args.baseUrl, args.apiKey)
          }
        });
        
        if (coursesResponse.data && Array.isArray(coursesResponse.data)) {
          const course = coursesResponse.data.find((c: any) => 
            c.shortname === args.courseId || c.fullname.includes(args.courseId)
          );
          
          if (course) {
            numericCourseId = parseInt(course.id);
          } else {
            return {
              success: true,
              data: []
            };
          }
        }
      }
      
      const response = await axios.get(`${args.baseUrl}/webservice/rest/server.php`, {
        params: {
          wstoken: args.apiKey,
          wsfunction: 'core_course_get_contents',
          moodlewsrestformat: 'json',
          courseid: numericCourseId
        }
      });

      if (response.data && Array.isArray(response.data)) {
        // Flatten activities from all sections
        const activities = response.data.flatMap((section: any) => 
          // @ts-ignore
          section.modules?.map((module: any) => ({
            id: module.id,
            name: module.name,
            modname: module.modname,
            courseid: args.courseId,
            section: section.section,
            visible: module.visible,
            url: module.url,
            description: module.description
          })) || []
        );

        return {
          success: true,
          data: activities
        };
      } else {
        return {
          success: false,
          error: response.data?.message || 'Failed to get course contents'
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch course contents'
      };
    }
  });

  // Get grades for course
  ipcMain.handle('moodle:get-grades', async (event, args: { baseUrl: string; apiKey: string; courseId: string }) => {
    try {
      const response = await axios.get(`${args.baseUrl}/webservice/rest/server.php`, {
        params: {
          wstoken: args.apiKey,
          wsfunction: 'gradereport_user_get_grades_table',
          moodlewsrestformat: 'json',
          courseid: args.courseId
        }
      });

      if (response.data) {
        return {
          success: true,
          data: response.data
        };
      } else {
        return {
          success: false,
          error: 'Failed to get grades'
        };
      }
    } catch (error: any) {
      // If this function doesn't exist, try alternative
      try {
        const altResponse = await axios.get(`${args.baseUrl}/webservice/rest/server.php`, {
          params: {
            wstoken: args.apiKey,
            wsfunction: 'core_grades_get_grades',
            moodlewsrestformat: 'json',
            courseid: args.courseId
          }
        });

        return {
          success: true,
          data: altResponse.data || []
        };
      } catch (altError: any) {
        return {
          success: false,
          error: altError.message || 'Failed to fetch grades'
        };
      }
    }
  });

  // Get user info
  ipcMain.handle('moodle:get-user-info', async (event, args: { baseUrl: string; apiKey: string }) => {
    try {
      const response = await axios.get(`${args.baseUrl}/webservice/rest/server.php`, {
        params: {
          wstoken: args.apiKey,
          wsfunction: 'core_webservice_get_site_info',
          moodlewsrestformat: 'json'
        }
      });

      if (response.data && !response.data.exception) {
        return {
          success: true,
          data: {
            userid: response.data.userid,
            username: response.data.username,
            firstname: response.data.firstname,
            lastname: response.data.lastname,
            fullname: response.data.fullname,
            email: response.data.useremail,
            sitename: response.data.sitename,
            siteurl: response.data.siteurl
          }
        };
      } else {
        return {
          success: false,
          error: response.data?.message || 'Failed to get user info'
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch user info'
      };
    }
  });

  // Get assignments for course
  ipcMain.handle('moodle:get-assignments', async (event, args: { baseUrl: string; apiKey: string; courseId: string }) => {
    try {
      // Ensure courseId is numeric - try to parse it or find the actual course ID
      let numericCourseId = parseInt(args.courseId);
      
      // If courseId is not numeric (like "COMP7404"), we need to find the actual course ID first
      if (isNaN(numericCourseId)) {
        
        // First get all courses to find the numeric ID
        const coursesResponse = await axios.get(`${args.baseUrl}/webservice/rest/server.php`, {
          params: {
            wstoken: args.apiKey,
            wsfunction: 'core_enrol_get_users_courses',
            moodlewsrestformat: 'json',
            userid: await getUserId(args.baseUrl, args.apiKey)
          }
        });
        
        if (coursesResponse.data && Array.isArray(coursesResponse.data)) {
          const course = coursesResponse.data.find((c: any) => 
            c.shortname === args.courseId || c.fullname.includes(args.courseId)
          );
          
          if (course) {
            numericCourseId = parseInt(course.id);
          } else {
            return {
              success: true,
              data: []
            };
          }
        }
      }
      
      // Get the full details for assignments
      const assignmentsResponse = await axios.get(`${args.baseUrl}/webservice/rest/server.php`, {
        params: {
          wstoken: args.apiKey,
          wsfunction: 'mod_assign_get_assignments',
          moodlewsrestformat: 'json',
          'courseids[0]': numericCourseId,
        }
      });

      let assignments = [];
      if (assignmentsResponse.data && assignmentsResponse.data.courses && assignmentsResponse.data.courses.length > 0) {
        // The assignments are nested inside the courses array
        const rawAssignments = assignmentsResponse.data.courses.flatMap((course: any) => course.assignments || []);
        
        // Get course contents to find module IDs for assignments
        const contentsResponse = await axios.get(`${args.baseUrl}/webservice/rest/server.php`, {
          params: {
            wstoken: args.apiKey,
            wsfunction: 'core_course_get_contents',
            moodlewsrestformat: 'json',
            courseid: numericCourseId
          }
        });

        // Create a map of assignment instances to their module IDs
        const assignmentModuleMap = new Map();
        if (contentsResponse.data && Array.isArray(contentsResponse.data)) {
          contentsResponse.data.forEach((section: any) => {
            section.modules?.forEach((module: any) => {
              if (module.modname === 'assign' && module.instance) {
                assignmentModuleMap.set(module.instance.toString(), module.id);
              }
            });
          });
        }

        // Enhance assignments with module IDs
        assignments = rawAssignments.map((assignment: any) => ({
          ...assignment,
          cmid: assignmentModuleMap.get(assignment.id.toString()) || assignment.id,
        }));

      } else {
      }

      return {
        success: true,
        data: assignments
      };

    } catch (error: any) {
      console.error('[Moodle API] Error fetching assignments:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to fetch assignments'
      };
    }
  });

  // Get submission files for a specific user and assignment
  ipcMain.handle('moodle:get-submission-files', async (event, args: { 
    baseUrl: string; 
    apiKey: string; 
    assignmentId: string; 
    userId: string; 
  }) => {
    try {
      // Try multiple approaches to get submission files
      
      // Approach 1: Use mod_assign_get_submission_status
      const statusParams = {
        wstoken: args.apiKey,
        wsfunction: 'mod_assign_get_submission_status',
        moodlewsrestformat: 'json',
        assignid: args.assignmentId,
        userid: args.userId
      };
      
      const statusResponse = await axios.get(`${args.baseUrl}/webservice/rest/server.php`, { params: statusParams });

      let files: any[] = [];
      
      // Extract files from status response
      if (statusResponse.data) {
        const data = statusResponse.data;
        
        // Check lastattempt
        if (data.lastattempt && data.lastattempt.submission && data.lastattempt.submission.plugins) {
          for (const plugin of data.lastattempt.submission.plugins) {
            files = files.concat(extractFilesFromPlugin(plugin));
          }
        }
        
        // Check feedback plugins
        if (data.feedback && data.feedback.plugins) {
          for (const plugin of data.feedback.plugins) {
            files = files.concat(extractFilesFromPlugin(plugin));
          }
        }
        
        // Check assignmentdata
        if (data.assignmentdata && data.assignmentdata.attachments) {
          for (const [key, attachments] of Object.entries(data.assignmentdata.attachments)) {
            if (Array.isArray(attachments)) {
              for (const file of attachments) {
                if (file && typeof file === 'object' && file.filename) {
                  files.push({
                    filename: file.filename,
                    filesize: file.filesize || 0,
                    fileurl: file.fileurl || file.url || '',
                    mimetype: file.mimetype || '',
                    timemodified: file.timemodified || 0
                  });
                }
              }
            }
          }
        }
      }
      
      // If no files found, try approach 2: Get submissions directly
      if (files.length === 0) {
        
        const submissionsParams = {
          wstoken: args.apiKey,
          wsfunction: 'mod_assign_get_submissions',
          moodlewsrestformat: 'json',
          'assignmentids[0]': args.assignmentId
        };
        
        const submissionsResponse = await axios.get(`${args.baseUrl}/webservice/rest/server.php`, { params: submissionsParams });
        
        if (submissionsResponse.data && submissionsResponse.data.assignments && submissionsResponse.data.assignments.length > 0) {
          const submissions = submissionsResponse.data.assignments[0].submissions || [];
          const userSubmission = submissions.find((sub: any) => sub.userid.toString() === args.userId.toString());
          
          if (userSubmission && userSubmission.plugins) {
            for (const plugin of userSubmission.plugins) {
              files = files.concat(extractFilesFromPlugin(plugin));
            }
          }
        }
      }
      
      return {
        success: true,
        data: files
      };
    } catch (error: any) {
      console.error('[Moodle API] Error fetching submission files:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch submission files'
      };
    }
  });
  
  // Helper function to extract files from a plugin
  function extractFilesFromPlugin(plugin: any): any[] {
    const files = [];
    
    if (plugin.fileareas) {
      for (const filearea of plugin.fileareas) {
        if (filearea.files && Array.isArray(filearea.files)) {
          for (const file of filearea.files) {
            if (file && file.filename && file.filename !== '.') {
              files.push({
                filename: file.filename,
                filesize: file.filesize || 0,
                fileurl: file.fileurl || file.url || '',
                mimetype: file.mimetype || '',
                timemodified: file.timemodified || 0
              });
            }
          }
        }
      }
    }
    
    // Also check if files are directly in the plugin
    if (plugin.files && Array.isArray(plugin.files)) {
      for (const file of plugin.files) {
        if (file && file.filename && file.filename !== '.') {
          files.push({
            filename: file.filename,
            filesize: file.filesize || 0,
            fileurl: file.fileurl || file.url || '',
            mimetype: file.mimetype || '',
            timemodified: file.timemodified || 0
          });
        }
      }
    }
    
    return files;
  }

  // Get assignment submissions
  ipcMain.handle('moodle:get-assignment-submissions', async (event, args: { baseUrl: string; apiKey: string; assignmentId: string }) => {
    try {
      const params = {
        wstoken: args.apiKey,
        wsfunction: 'mod_assign_get_submissions',
        moodlewsrestformat: 'json',
        'assignmentids[0]': args.assignmentId  // Fix: Use proper array format
      };
      
      const response = await axios.get(`${args.baseUrl}/webservice/rest/server.php`, { params });

      if (response.data && response.data.assignments && response.data.assignments.length > 0) {
        const submissions = response.data.assignments[0].submissions || [];
        return {
          success: true,
          data: submissions
        };
      } else {
        return {
          success: true,
          data: []
        };
      }
    } catch (error: any) {
      console.error('[Moodle API] Error fetching assignment submissions:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch assignment submissions'
      };
    }
  });

  // Get assignment grades
  ipcMain.handle('moodle:get-assignment-grades', async (event, args: { baseUrl: string; apiKey: string; assignmentId: string }) => {
    try {
      const params = {
        wstoken: args.apiKey,
        wsfunction: 'mod_assign_get_grades',
        moodlewsrestformat: 'json',
        'assignmentids[0]': args.assignmentId  // Fix: Use proper array format
      };
      
      const response = await axios.get(`${args.baseUrl}/webservice/rest/server.php`, { params });

      if (response.data && response.data.assignments && response.data.assignments.length > 0) {
        const grades = response.data.assignments[0].grades || [];
        return {
          success: true,
          data: grades
        };
      } else {
        return {
          success: true,
          data: []
        };
      }
    } catch (error: any) {
      console.error('[Moodle API] Error fetching assignment grades:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch assignment grades'
      };
    }
  });

  // Update assignment grade
  ipcMain.handle('moodle:update-assignment-grade', async (event, args: { 
    baseUrl: string; 
    apiKey: string; 
    assignmentId: string; 
    userId: string; 
    grade: number; 
    feedback?: string;
    courseId?: string; // Optional for validation
  }) => {

    try {
      // Prepare the grade update request with all required parameters
      const params: any = {
        wstoken: args.apiKey,
        wsfunction: 'mod_assign_save_grade',
        moodlewsrestformat: 'json',
        assignmentid: args.assignmentId,
        userid: args.userId,
        grade: args.grade,
        attemptnumber: -1, // -1 means current attempt
        addattempt: 0, // 0 = false, don't add new attempt
        workflowstate: '', // Empty string for default workflow
        applytoall: 1 // 1 = true, apply to all team members if it's a group assignment
      };

      // Add feedback using correct form parameter format
      if (args.feedback) {
        params['plugindata[assignfeedbackcomments_editor][text]'] = args.feedback;
        params['plugindata[assignfeedbackcomments_editor][format]'] = 1; // 1 = HTML format
      }

      const response = await axios.post(`${args.baseUrl}/webservice/rest/server.php`, null, { params });

      // Handle different success response formats
      // Moodle's mod_assign_save_grade can return null, empty array, or object on success
      const isSuccess = response.data === null || 
                       response.data === '' ||
                       (Array.isArray(response.data) && response.data.length === 0) ||
                       (response.data && !response.data.exception);

      if (isSuccess) {
        return {
          success: true,
          data: {
            assignmentId: args.assignmentId,
            userId: args.userId,
            grade: args.grade,
            feedback: args.feedback,
            courseId: args.courseId,
            timestamp: new Date().toISOString(),
            moodleResponse: response.data
          }
        };
      } else {
        return {
          success: false,
          error: response.data?.message || response.data?.debuginfo || 'Failed to update grade'
        };
      }
    } catch (error: any) {
      console.error('[Moodle API] Error updating assignment grade:', error.message);
      
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to update assignment grade'
      };
    }
  });

  // Batch publish grades
  ipcMain.handle('moodle:publish-grades-batch', async (event, args: {
    baseUrl: string;
    apiKey: string;
    courseId: string;
    assignmentId: string;
    grades: Array<{
      userId: string;
      grade: number;
      feedback?: string;
    }>;
  }) => {

    const results = [];
    const errors = [];

    // Process each grade individually using the actual update function
    for (const gradeData of args.grades) {
      try {

        // Prepare the grade update request with all required parameters
        const params: any = {
          wstoken: args.apiKey,
          wsfunction: 'mod_assign_save_grade',
          moodlewsrestformat: 'json',
          assignmentid: args.assignmentId,
          userid: gradeData.userId,
          grade: gradeData.grade,
          attemptnumber: -1, // -1 means current attempt
          addattempt: 0, // 0 = false, don't add new attempt
          workflowstate: '', // Empty string for default workflow
          applytoall: 1 // 1 = true, apply to all team members if it's a group assignment
        };

        // Add feedback using correct form parameter format
        if (gradeData.feedback) {
          params['plugindata[assignfeedbackcomments_editor][text]'] = gradeData.feedback;
          params['plugindata[assignfeedbackcomments_editor][format]'] = 1; // 1 = HTML format
        }

        const response = await axios.post(`${args.baseUrl}/webservice/rest/server.php`, null, { params });

        // Handle different success response formats
        const isSuccess = response.data === null || 
                         response.data === '' ||
                         (Array.isArray(response.data) && response.data.length === 0) ||
                         (response.data && !response.data.exception);

        if (isSuccess) {
          results.push({
            userId: gradeData.userId,
            success: true,
            grade: gradeData.grade,
            response: response.data
          });
        } else {
          errors.push({
            userId: gradeData.userId,
            error: response.data?.message || response.data?.debuginfo || 'Failed to update grade'
          });
        }
      } catch (error: any) {
        errors.push({
          userId: gradeData.userId,
          error: error.response?.data?.message || error.message || 'Failed to update grade'
        });
      }
    }

    return {
      success: errors.length === 0,
      data: {
        successful: results,
        failed: errors,
        total: args.grades.length,
        successCount: results.length,
        errorCount: errors.length
      }
    };
  });

  // Get detailed grade information for an assignment
  ipcMain.handle('moodle:get-assignment-grade-details', async (event, args: {
    baseUrl: string;
    apiKey: string;
    assignmentId: string;
    userId?: string;
  }) => {
    try {
      const response = await axios.get(`${args.baseUrl}/webservice/rest/server.php`, {
        params: {
          wstoken: args.apiKey,
          wsfunction: 'mod_assign_get_grades',
          moodlewsrestformat: 'json',
          assignmentids: [args.assignmentId]
        }
      });

      if (response.data && response.data.assignments && response.data.assignments.length > 0) {
        let grades = response.data.assignments[0].grades || [];
        
        // Filter by user if specified
        if (args.userId) {
          grades = grades.filter((grade: any) => grade.userid.toString() === args.userId);
        }

        // Enhance grade data with additional info
        const enhancedGrades = grades.map((grade: any) => ({
          id: grade.id,
          userid: grade.userid,
          grade: grade.grade,
          grader: grade.grader,
          timemodified: grade.timemodified,
          timecreated: grade.timecreated,
          feedback: grade.plugindata?.assignfeedbackcomments_editor?.text || '',
          feedbackformat: grade.plugindata?.assignfeedbackcomments_editor?.format || 1,
          assignmentId: args.assignmentId,
          isPublished: grade.grade > 0 // Consider grade published if > 0
        }));

        return {
          success: true,
          data: enhancedGrades
        };
      } else {
        return {
          success: true,
          data: []
        };
      }
    } catch (error: any) {
      console.error('[Moodle API] Error getting grade details:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch assignment grade details'
      };
    }
  });

  // Delete assignment grade and feedback
  ipcMain.handle('moodle:delete-assignment-grade', async (event, args: {
    baseUrl: string;
    apiKey: string;
    assignmentId: string;
    userId: string;
    courseId?: string;
  }) => {

    try {
      // To delete a grade in Moodle, we set grade to -1 (no grade) and clear feedback
      const params: any = {
        wstoken: args.apiKey,
        wsfunction: 'mod_assign_save_grade',
        moodlewsrestformat: 'json',
        assignmentid: args.assignmentId,
        userid: args.userId,
        grade: -1, // -1 means no grade (delete grade)
        attemptnumber: -1, // -1 means current attempt
        addattempt: 0, // 0 = false, don't add new attempt
        workflowstate: '', // Empty string for default workflow
        applytoall: 1 // 1 = true, apply to all team members if it's a group assignment
      };

      // Clear feedback by setting empty text
      params['plugindata[assignfeedbackcomments_editor][text]'] = '';
      params['plugindata[assignfeedbackcomments_editor][format]'] = 1; // 1 = HTML format

      const response = await axios.post(`${args.baseUrl}/webservice/rest/server.php`, null, { params });

      // Handle different success response formats (same as update grade)
      const isSuccess = response.data === null || 
                       response.data === '' ||
                       (Array.isArray(response.data) && response.data.length === 0) ||
                       (response.data && !response.data.exception);

      if (isSuccess) {
        return {
          success: true,
          data: {
            assignmentId: args.assignmentId,
            userId: args.userId,
            courseId: args.courseId,
            timestamp: new Date().toISOString(),
            moodleResponse: response.data
          }
        };
      } else {
        return {
          success: false,
          error: response.data?.message || response.data?.debuginfo || 'Failed to delete grade'
        };
      }
    } catch (error: any) {
      console.error('[Moodle API] Error deleting assignment grade:', error.message);
      
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to delete assignment grade'
      };
    }
  });
}

// Setup configuration handlers for storing Moodle settings
export function setupMoodleConfigHandlers() {
  // Save Moodle configuration
  ipcMain.handle('moodle:save-config', async (event, args: { baseUrl: string; apiKey: string }) => {
    try {
      // Store in SQLite using key-value store
      const query = `
        INSERT INTO kv_store (namespace, key, value) 
        VALUES ('moodle', 'config', ?)
        ON CONFLICT(namespace, key) 
        DO UPDATE SET value = excluded.value
      `;
      
      const configData = JSON.stringify({
        baseUrl: args.baseUrl,
        apiKey: args.apiKey,
        updatedAt: new Date().toISOString()
      });
      
      executeQuery(query, [configData]);
      return { success: true };
    } catch (error: any) {
      console.error('[Moodle Config] Error saving configuration:', error);
      return {
        success: false,
        error: error.message || 'Failed to save configuration'
      };
    }
  });

  // Get Moodle configuration
  ipcMain.handle('moodle:get-config', async () => {
    try {
      const query = `
        SELECT value FROM kv_store 
        WHERE namespace = 'moodle' AND key = 'config'
      `;
      
      const result = executeQuery<{ value: string }>(query) as { value: string }[];
      
      if (result && result.length > 0) {
        const config = JSON.parse(result[0].value);
        return {
          success: true,
          data: config
        };
      } else {
        // Return default config if none exists
        return {
          success: true,
          data: {
            baseUrl: MOODLE_BASE_URL,
            apiKey: ''
          }
        };
      }
    } catch (error: any) {
      console.error('[Moodle Config] Error loading configuration:', error);
      return {
        success: false,
        error: error.message || 'Failed to load configuration'
      };
    }
  });

  // Clear Moodle configuration
  ipcMain.handle('moodle:clear-config', async () => {
    try {
      const query = `
        DELETE FROM kv_store 
        WHERE namespace = 'moodle' AND key = 'config'
      `;
      
      executeQuery(query);
      return { success: true };
    } catch (error: any) {
      console.error('[Moodle Config] Error clearing configuration:', error);
      return {
        success: false,
        error: error.message || 'Failed to clear configuration'
      };
    }
  });
}
