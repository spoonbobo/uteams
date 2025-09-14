import { ipcMain } from 'electron';
import { memoryManager, CourseMemory } from './memory';

export const registerMemoryIpc = () => {
  // Save course memory
  ipcMain.handle('memory:save-course', async (_event, courseMemory: CourseMemory) => {
    console.log(`[IPC] memory:save-course called for ${courseMemory.courseShortName} (${courseMemory.courseId})`);
    try {
      await memoryManager.saveCourseMemory(courseMemory);
      console.log(`[IPC] ✅ Course memory saved successfully`);
      return { success: true };
    } catch (error) {
      console.error('[IPC] ❌ Failed to save course memory:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to save course memory' 
      };
    }
  });

  // Get course memory
  ipcMain.handle('memory:get-course', async (_event, courseId: string) => {
    console.log(`[IPC] memory:get-course called for courseId: ${courseId}`);
    try {
      const courseMemory = await memoryManager.getCourseMemory(courseId);
      if (courseMemory) {
        console.log(`[IPC] ✅ Course memory retrieved: ${courseMemory.courseShortName}`);
      } else {
        console.log(`[IPC] ⚠️ No course memory found for ${courseId}`);
      }
      return { success: true, data: courseMemory };
    } catch (error) {
      console.error('[IPC] ❌ Failed to get course memory:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get course memory' 
      };
    }
  });

  // Get all course memories
  ipcMain.handle('memory:get-all-courses', async () => {
    try {
      const courses = await memoryManager.getAllCourseMemories();
      return { success: true, data: courses };
    } catch (error) {
      console.error('Failed to get all course memories:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get all course memories' 
      };
    }
  });

  // Search memories
  ipcMain.handle('memory:search', async (_event, { query, userId }: { query: string; userId?: string }) => {
    try {
      const results = await memoryManager.searchMemories(query, userId);
      return { success: true, data: results };
    } catch (error) {
      console.error('Failed to search memories:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to search memories' 
      };
    }
  });

  // Save user profile
  ipcMain.handle('memory:save-user-profile', async (_event, profile: any) => {
    try {
      await memoryManager.saveUserProfile(profile);
      return { success: true };
    } catch (error) {
      console.error('Failed to save user profile:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to save user profile' 
      };
    }
  });

  // Get user profile
  ipcMain.handle('memory:get-user-profile', async (_event, userId: string) => {
    try {
      const profile = await memoryManager.getUserProfile(userId);
      return { success: true, data: profile };
    } catch (error) {
      console.error('Failed to get user profile:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get user profile' 
      };
    }
  });

  // Get memory stats
  ipcMain.handle('memory:get-stats', async () => {
    try {
      const stats = memoryManager.getStats();
      return { success: true, data: stats };
    } catch (error) {
      console.error('Failed to get memory stats:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get memory stats' 
      };
    }
  });

  console.log('📝 Memory IPC handlers registered');
};
